import { useState, useCallback } from 'react';
import {
    HiOutlineCurrencyDollar, HiOutlineRefresh, HiOutlineExclamationCircle,
    HiOutlineCheckCircle, HiOutlineClock, HiOutlineSearch,
} from 'react-icons/hi';
import { Card, Badge, Input, Select } from '../../components/ui';
import { formatCurrency, cn } from '../../utils/helpers';
import { useAccountsReceivable } from '../../hooks/useCommercial';

// ── Types ────────────────────────────────────────────────────────────────────-

type FilterOption = 'all' | 'overdue' | 'pending';

const FILTER_OPTIONS: Array<{ value: FilterOption; label: string }> = [
    { value: 'all',     label: 'Todos'         },
    { value: 'pending', label: 'Pendentes'      },
    { value: 'overdue', label: 'Em Atraso'      },
];

const STATUS_CONFIG = {
    sent:    { label: 'Pendente',    variant: 'warning' as const, icon: HiOutlineClock             },
    partial: { label: 'Parcial',     variant: 'info'    as const, icon: HiOutlineCheckCircle       },
    overdue: { label: 'Em Atraso',   variant: 'danger'  as const, icon: HiOutlineExclamationCircle },
};

// ── Summary Card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
    label: string;
    value: string;
    sub?: string;
    colorClass: string;
    icon: React.ElementType;
}

function SummaryCard({ label, value, sub, colorClass, icon: Icon }: SummaryCardProps) {
    return (
        <Card padding="md" className={`border-l-4 ${colorClass}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                </div>
                <Icon className={cn('w-6 h-6 mt-1', colorClass.replace('border-l-', 'text-').replace('-500', '-400'))} />
            </div>
        </Card>
    );
}

// ── Row ──────────────────────────────────────────────────────────────────────-

interface ReceivableRowProps {
    invoice: {
        id: string;
        number: string;
        customer?: { name: string; phone: string } | null;
        customerName?: string;
        customerPhone?: string;
        issueDate?: string;
        createdAt?: string;
        dueDate: string | null;
        total: number;
        amountPaid: number;
        amountDue: number;
        status: 'sent' | 'partial' | 'overdue';
        daysOverdue: number;
    };
}

function ReceivableRow({ invoice }: ReceivableRowProps) {
    const cfg        = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.sent;
    const Icon       = cfg.icon;
    const customerName  = invoice.customer?.name  ?? invoice.customerName  ?? '';
    const customerPhone = invoice.customer?.phone ?? invoice.customerPhone ?? '';
    const dateStr    = invoice.issueDate ?? invoice.createdAt;
    const issuedAt   = dateStr ? new Date(dateStr).toLocaleDateString('pt-MZ') : '';
    const dueAt      = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('pt-MZ') : '';
    const progress   = invoice.total > 0 ? (invoice.amountPaid / invoice.total) * 100 : 0;

    return (
        <tr className="border-b border-gray-50 dark:border-dark-700 hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors">
            <td className="py-3 px-4">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{invoice.number}</p>
                <p className="text-xs text-gray-400">{issuedAt}</p>
            </td>
            <td className="py-3 px-4">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{customerName}</p>
                <p className="text-xs text-gray-400">{customerPhone}</p>
            </td>
            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{dueAt}</td>
            <td className="py-3 px-4 text-right">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(invoice.total)}</p>
                {invoice.amountPaid > 0 && (
                    <p className="text-xs text-green-500">{formatCurrency(invoice.amountPaid)} pago</p>
                )}
            </td>
            <td className="py-3 px-4 text-right">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(invoice.amountDue)}</p>
                {invoice.total > 0 && (
                    <div className="mt-1 h-1.5 w-20 ml-auto bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-400 rounded-full"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                )}
            </td>
            <td className="py-3 px-4 text-center">
                <Badge variant={cfg.variant} size="sm">
                    <Icon className="w-3 h-3 mr-1 inline-block" />
                    {cfg.label}
                </Badge>
                {invoice.daysOverdue > 0 && (
                    <p className="text-xs text-red-400 mt-0.5">{invoice.daysOverdue}d atraso</p>
                )}
            </td>
        </tr>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────-

export default function AccountsReceivable() {
    const [filter, setFilter]   = useState<FilterOption>('all');
    const [search, setSearch]   = useState('');
    const [page, setPage]       = useState(1);

    const { data, isLoading, error, refetch } = useAccountsReceivable({
        filter,
        search: search || undefined,
        page,
        limit: 20,
    });

    const invoices   = data?.data ?? [];
    const summary    = data?.summary;
    const pagination = data?.pagination;

    const handleFilterChange = useCallback((val: FilterOption) => {
        setFilter(val);
        setPage(1);
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineCurrencyDollar className="text-primary-500" />
                        Contas a Receber
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Faturas em aberto e dívidas de clientes
                    </p>
                </div>
                <button
                    onClick={refetch}
                    title="Actualizar"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-600 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-sm"
                >
                    <HiOutlineRefresh className="w-4 h-4" /> Actualizar
                </button>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                    label="Total a Receber"
                    value={formatCurrency(summary?.totalReceivable ?? 0)}
                    sub={`${summary?.invoiceCount ?? 0} faturas abertas`}
                    colorClass="border-l-blue-500"
                    icon={HiOutlineCurrencyDollar}
                />
                <SummaryCard
                    label="Em Atraso"
                    value={formatCurrency(summary?.overdueAmount ?? 0)}
                    sub={`${summary?.overdueCount ?? 0} faturas vencidas`}
                    colorClass="border-l-red-500"
                    icon={HiOutlineExclamationCircle}
                />
                <SummaryCard
                    label="Faturas Abertas"
                    value={String(summary?.invoiceCount ?? 0)}
                    colorClass="border-l-yellow-500"
                    icon={HiOutlineClock}
                />
                <SummaryCard
                    label="Taxa de Atraso"
                    value={
                        summary?.invoiceCount
                            ? `${Math.round(((summary.overdueCount ?? 0) / summary.invoiceCount) * 100)}%`
                            : '0%'
                    }
                    sub="do total de faturas"
                    colorClass="border-l-orange-500"
                    icon={HiOutlineExclamationCircle}
                />
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                        <Input
                            placeholder="Pesquisar por nº de fatura ou cliente..."
                            value={search}
                            onChange={handleSearchChange}
                            leftIcon={<HiOutlineSearch className="w-4 h-4" />}
                        />
                    </div>
                    <div className="w-44">
                        <Select
                            options={FILTER_OPTIONS}
                            value={filter}
                            onChange={e => handleFilterChange(e.target.value as FilterOption)}
                        />
                    </div>
                </div>
            </Card>

            {/* Table */}
            <Card padding="none">
                {error ? (
                    <div className="p-8 text-center">
                        <HiOutlineExclamationCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                        <p className="text-sm text-red-500">{error}</p>
                        <button onClick={refetch} className="mt-2 text-sm text-primary-500 hover:underline">
                            Tentar novamente
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="p-6 space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="p-16 text-center">
                        <HiOutlineCheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Sem faturas em aberto</p>
                        <p className="text-xs text-gray-400 mt-1">Todos os pagamentos estáão em dia</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700/50 border-b border-gray-200 dark:border-dark-600">
                                <tr>
                                    {['Fatura', 'Cliente', 'Vencimento', 'Total', 'Em Aberto', 'Estado'].map(h => (
                                        <th
                                            key={h}
                                            className={cn(
                                                'py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                                                ['Total', 'Em Aberto'].includes(h) ? 'text-right' : 'text-left',
                                                h === 'Estado' && 'text-center',
                                            )}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(invoice => (
                                    <ReceivableRow key={invoice.id} invoice={invoice} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-dark-700">
                        <p className="text-xs text-gray-400">
                            Mostrando {invoices.length} de {pagination.total} faturas
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(p - 1, 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                                {page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(p + 1, pagination.totalPages))}
                                disabled={page === pagination.totalPages}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
