import { useMemo, useState } from 'react';
import {
    HiOutlineBookOpen,
    HiOutlineCalculator,
    HiOutlineCheckCircle,
    HiOutlineDocumentChartBar,
    HiOutlinePlus,
} from 'react-icons/hi2';
import { Badge, Button, Card, Input, PageHeader, Select, TableLoadingState } from '../components/ui';
import {
    useAccounts,
    useBalanceSheet,
    useCreateJournalEntry,
    useIncomeStatement,
    useJournalEntries,
    useSeedDefaultChartOfAccounts,
    useTrialBalance,
} from '../hooks/useAccounting';
import type { AccountNature, AccountType } from '../types/accounting';
import { formatCurrency } from '../utils/helpers';

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
    { value: 'ASSET', label: 'Activo' },
    { value: 'LIABILITY', label: 'Passivo' },
    { value: 'EQUITY', label: 'Capital proprio' },
    { value: 'REVENUE', label: 'Receitas' },
    { value: 'EXPENSE', label: 'Despesas' },
    { value: 'COST_OF_GOODS', label: 'CMV' },
];

const natureOptions: Array<{ value: AccountNature; label: string }> = [
    { value: 'DEBIT', label: 'Devedora' },
    { value: 'CREDIT', label: 'Credora' },
];

function toISODate(date: Date) {
    return date.toISOString().slice(0, 10);
}

export default function AccountingPage() {
    const today = toISODate(new Date());
    const firstDay = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    const [tab, setTab] = useState<'accounts' | 'journal' | 'reports'>('accounts');
    const [period, setPeriod] = useState({ startDate: firstDay, endDate: today, asOfDate: today });
    const [accountForm, setAccountForm] = useState({
        code: '',
        name: '',
        type: 'ASSET' as AccountType,
        nature: 'DEBIT' as AccountNature,
        level: 1,
        allowsEntries: true,
        isActive: true,
    });
    const [entryForm, setEntryForm] = useState({
        date: today,
        description: '',
        reference: '',
        debitAccountId: '',
        creditAccountId: '',
        amount: 0,
    });

    const accountsQuery = useAccounts();
    const journalQuery = useJournalEntries({ startDate: period.startDate, endDate: period.endDate });
    const trialBalanceQuery = useTrialBalance({ startDate: period.startDate, endDate: period.endDate });
    const incomeStatementQuery = useIncomeStatement({ startDate: period.startDate, endDate: period.endDate });
    const balanceSheetQuery = useBalanceSheet({ asOfDate: period.asOfDate });
    const seedMutation = useSeedDefaultChartOfAccounts();
    const createEntryMutation = useCreateJournalEntry();

    const accountOptions = useMemo(
        () => (accountsQuery.data ?? [])
            .filter((account) => account.allowsEntries && account.isActive)
            .map((account) => ({ value: account.id, label: `${account.code} - ${account.name}` })),
        [accountsQuery.data]
    );

    const createAccount = async () => {
        await import('../services/api/accounting.api').then(({ accountingAPI }) => accountingAPI.createAccount(accountForm));
        await accountsQuery.refetch();
        setAccountForm((previous) => ({ ...previous, code: '', name: '' }));
    };

    const createEntry = async () => {
        await createEntryMutation.mutateAsync({
            date: entryForm.date,
            description: entryForm.description,
            reference: entryForm.reference || null,
            lines: [
                { debitAccountId: entryForm.debitAccountId, amount: Number(entryForm.amount), description: entryForm.description },
                { creditAccountId: entryForm.creditAccountId, amount: Number(entryForm.amount), description: entryForm.description },
            ],
        });
        setEntryForm((previous) => ({ ...previous, description: '', reference: '', amount: 0 }));
        trialBalanceQuery.refetch();
        incomeStatementQuery.refetch();
        balanceSheetQuery.refetch();
    };

    const tabs = [
        { id: 'accounts', label: 'Plano de contas', icon: HiOutlineBookOpen },
        { id: 'journal', label: 'Lancamentos', icon: HiOutlinePlus },
        { id: 'reports', label: 'Relatorios', icon: HiOutlineDocumentChartBar },
    ] as const;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Contabilidade"
                subtitle="Plano de contas, partidas dobradas e relatorios financeiros."
                icon={<HiOutlineCalculator />}
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<HiOutlineCheckCircle className="w-4 h-4" />}
                        isLoading={seedMutation.isPending}
                        onClick={() => seedMutation.mutate()}
                    >
                        Criar plano padrao
                    </Button>
                }
                tabs={
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setTab(item.id)}
                                    className={`h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 transition-colors ${tab === item.id ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                }
            />

            {tab === 'accounts' && (
                <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
                    <Card variant="glass" className="p-5">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-4">Nova conta</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Input size="sm" label="Codigo" value={accountForm.code} onChange={(event) => setAccountForm({ ...accountForm, code: event.target.value })} />
                                <Input size="sm" type="number" label="Nivel" value={accountForm.level} onChange={(event) => setAccountForm({ ...accountForm, level: Number(event.target.value) })} />
                            </div>
                            <Input size="sm" label="Nome" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} />
                            <div className="grid grid-cols-2 gap-3">
                                <Select size="sm" label="Tipo" options={accountTypeOptions} value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value as AccountType })} />
                                <Select size="sm" label="Natureza" options={natureOptions} value={accountForm.nature} onChange={(event) => setAccountForm({ ...accountForm, nature: event.target.value as AccountNature })} />
                            </div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={accountForm.allowsEntries}
                                    onChange={(event) => setAccountForm({ ...accountForm, allowsEntries: event.target.checked })}
                                />
                                Aceita lancamentos
                            </label>
                            <Button size="sm" fullWidth disabled={!accountForm.code || !accountForm.name} onClick={createAccount}>
                                Guardar conta
                            </Button>
                        </div>
                    </Card>

                    <Card variant="glass" padding="none" className="overflow-hidden">
                        {accountsQuery.isLoading ? (
                            <TableLoadingState columns={5} rows={8} message="A carregar contas..." />
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-dark-900/60 text-[10px] uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4 text-left">Codigo</th>
                                        <th className="px-5 py-4 text-left">Conta</th>
                                        <th className="px-5 py-4 text-left">Tipo</th>
                                        <th className="px-5 py-4 text-left">Natureza</th>
                                        <th className="px-5 py-4 text-center">Lancamentos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {(accountsQuery.data ?? []).map((account) => (
                                        <tr key={account.id}>
                                            <td className="px-5 py-3 font-mono font-bold">{account.code}</td>
                                            <td className="px-5 py-3 font-semibold">{account.name}</td>
                                            <td className="px-5 py-3"><Badge variant="gray">{account.type}</Badge></td>
                                            <td className="px-5 py-3">{account.nature}</td>
                                            <td className="px-5 py-3 text-center">{account.allowsEntries ? 'Sim' : 'Nao'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                </div>
            )}

            {tab === 'journal' && (
                <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
                    <Card variant="glass" className="p-5">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-4">Novo lancamento</h2>
                        <div className="space-y-4">
                            <Input size="sm" type="date" label="Data" value={entryForm.date} onChange={(event) => setEntryForm({ ...entryForm, date: event.target.value })} />
                            <Input size="sm" label="Descricao" value={entryForm.description} onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })} />
                            <Input size="sm" label="Referencia" value={entryForm.reference} onChange={(event) => setEntryForm({ ...entryForm, reference: event.target.value })} />
                            <Select size="sm" label="Conta debito" options={accountOptions} value={entryForm.debitAccountId} onChange={(event) => setEntryForm({ ...entryForm, debitAccountId: event.target.value })} />
                            <Select size="sm" label="Conta credito" options={accountOptions} value={entryForm.creditAccountId} onChange={(event) => setEntryForm({ ...entryForm, creditAccountId: event.target.value })} />
                            <Input size="sm" type="number" label="Valor" value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: Number(event.target.value) })} />
                            <Button
                                size="sm"
                                fullWidth
                                isLoading={createEntryMutation.isPending}
                                disabled={!entryForm.description || !entryForm.debitAccountId || !entryForm.creditAccountId || entryForm.amount <= 0}
                                onClick={createEntry}
                            >
                                Registar partida dobrada
                            </Button>
                        </div>
                    </Card>

                    <Card variant="glass" padding="none" className="overflow-hidden">
                        {journalQuery.isLoading ? (
                            <TableLoadingState columns={4} rows={8} message="A carregar lancamentos..." />
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-dark-900/60 text-[10px] uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4 text-left">Numero</th>
                                        <th className="px-5 py-4 text-left">Data</th>
                                        <th className="px-5 py-4 text-left">Descricao</th>
                                        <th className="px-5 py-4 text-right">Linhas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {(journalQuery.data ?? []).map((entry) => (
                                        <tr key={entry.id}>
                                            <td className="px-5 py-3 font-mono font-bold">{entry.number}</td>
                                            <td className="px-5 py-3">{entry.date.slice(0, 10)}</td>
                                            <td className="px-5 py-3 font-semibold">{entry.description}</td>
                                            <td className="px-5 py-3 text-right">{entry.lines.length}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                </div>
            )}

            {tab === 'reports' && (
                <div className="space-y-6">
                    <Card variant="glass" className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <Input size="sm" type="date" label="Inicio" value={period.startDate} onChange={(event) => setPeriod({ ...period, startDate: event.target.value })} />
                            <Input size="sm" type="date" label="Fim" value={period.endDate} onChange={(event) => setPeriod({ ...period, endDate: event.target.value, asOfDate: event.target.value })} />
                            <Input size="sm" type="date" label="Balanco ate" value={period.asOfDate} onChange={(event) => setPeriod({ ...period, asOfDate: event.target.value })} />
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card variant="glass" className="p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Receitas</p>
                            <h3 className="text-2xl font-black">{formatCurrency(incomeStatementQuery.data?.revenues || 0)}</h3>
                        </Card>
                        <Card variant="glass" className="p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Despesas + CMV</p>
                            <h3 className="text-2xl font-black">{formatCurrency((incomeStatementQuery.data?.expenses || 0) + (incomeStatementQuery.data?.costOfGoods || 0))}</h3>
                        </Card>
                        <Card variant="glass" className="p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Resultado liquido</p>
                            <h3 className="text-2xl font-black">{formatCurrency(incomeStatementQuery.data?.netProfit || 0)}</h3>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card variant="glass" padding="none" className="overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5">
                                <h2 className="text-xs font-black uppercase tracking-widest">Balancete</h2>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-dark-900/60 text-[10px] uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4 text-left">Conta</th>
                                        <th className="px-5 py-4 text-right">Debito</th>
                                        <th className="px-5 py-4 text-right">Credito</th>
                                        <th className="px-5 py-4 text-right">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {(trialBalanceQuery.data ?? []).map((row) => (
                                        <tr key={row.id}>
                                            <td className="px-5 py-3 font-semibold">{row.code} - {row.name}</td>
                                            <td className="px-5 py-3 text-right">{formatCurrency(row.totalDebit)}</td>
                                            <td className="px-5 py-3 text-right">{formatCurrency(row.totalCredit)}</td>
                                            <td className="px-5 py-3 text-right font-black">{formatCurrency(row.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>

                        <Card variant="glass" className="p-5">
                            <h2 className="text-xs font-black uppercase tracking-widest mb-4">Balanco patrimonial</h2>
                            <div className="space-y-3">
                                <BalanceRow label="Activo" value={balanceSheetQuery.data?.totalAssets || 0} />
                                <BalanceRow label="Passivo" value={balanceSheetQuery.data?.totalLiabilities || 0} />
                                <BalanceRow label="Capital proprio" value={balanceSheetQuery.data?.totalEquity || 0} />
                                <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-widest">Estado</span>
                                    <Badge variant={balanceSheetQuery.data?.isBalanced ? 'success' : 'warning'}>
                                        {balanceSheetQuery.data?.isBalanced ? 'Balanceado' : 'Com diferenca'}
                                    </Badge>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}

function BalanceRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-dark-800 px-4 py-3">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{label}</span>
            <span className="font-black">{formatCurrency(value)}</span>
        </div>
    );
}
