import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Card, TableContainer, Badge, Button, LoadingSpinner, Modal, Input, Select } from '../../components/ui';
import { hospitalityAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import {
    HiOutlineBanknotes,
    HiOutlineArrowUpCircle,
    HiOutlineArrowDownCircle,
    HiOutlineArrowPath,
    HiOutlinePlus,
    HiOutlineXMark,
} from 'react-icons/hi2';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

const EXPENSE_CATEGORIES = [
    { value: 'maintenance', label: 'Manutenção' },
    { value: 'utilities', label: 'Serviços (Água/Luz)' },
    { value: 'salaries', label: 'Salários' },
    { value: 'supplies', label: 'Materiais/Consumíveis' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'taxes', label: 'Impostos/Taxas' },
    { value: 'other', label: 'Outros' },
];

const REVENUE_CATEGORIES = [
    { value: 'accommodation', label: 'Acomodação' },
    { value: 'food_beverage', label: 'F&B' },
    { value: 'spa', label: 'Spa/Wellness' },
    { value: 'events', label: 'Eventos/Salas' },
    { value: 'other', label: 'Outros' },
];

export default function HotelFinance() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [financeData, setFinanceData] = useState<any>(null);
    const [revenues, setRevenues] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);

    // Modal state
    const [modal, setModal] = useState<{ open: boolean; type: 'expense' | 'revenue' }>({ open: false, type: 'expense' });
    const [form, setForm] = useState({
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
        paymentMethod: 'cash',
    });

    const resetForm = () => setForm({
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
        paymentMethod: 'cash',
    });

    const openModal = (type: 'expense' | 'revenue') => {
        resetForm();
        setModal({ open: true, type });
    };

    const loadFinanceData = useCallback(async () => {
        setLoading(true);
        try {
            const [summary, revs, exps] = await Promise.all([
                hospitalityAPI.getFinanceDashboard(),
                hospitalityAPI.getRevenues({ limit: 10 }),
                hospitalityAPI.getExpenses({ limit: 10 })
            ]);
            setFinanceData(summary);
            setRevenues(revs.data || []);
            setExpenses(exps.data || []);
        } catch (err) {
            logger.error('Error loading finance data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadFinanceData(); }, [loadFinanceData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.description || !form.amount || !form.category) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                description: form.description,
                amount: Number(form.amount),
                category: form.category,
                date: form.date,
                notes: form.notes || undefined,
                paymentMethod: form.paymentMethod,
                type: modal.type,
            };
            if (modal.type === 'expense') {
                await hospitalityAPI.createExpense(payload);
                toast.success('Despesa registada com sucesso!');
            } else {
                await hospitalityAPI.createExpense({ ...payload, type: 'revenue' });
                toast.success('Receita registada com sucesso!');
            }
            setModal({ open: false, type: 'expense' });
            loadFinanceData();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Erro ao registar lançamento');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && !financeData) {
        return (
            <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const profit = (financeData?.totalRevenue || 0) - (financeData?.totalExpenses || 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('hotel_module.finance.title')}
                subtitle="Receitas, despesas e balanço financeiro do hotel"
                icon={<HiOutlineBanknotes />}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-4 h-4" />} onClick={loadFinanceData}>
                            {t('common.refresh')}
                        </Button>
                        <Button variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => openModal('revenue')}>
                            Nova Receita
                        </Button>
                        <Button variant="primary" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => openModal('expense')}>
                            Nova Despesa
                        </Button>
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-l-4 border-l-green-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
                            <HiOutlineArrowUpCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Receitas</p>
                            <h3 className="text-2xl font-black text-green-600">{formatCurrency(financeData?.totalRevenue || 0)}</h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-red-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
                            <HiOutlineArrowDownCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Despesas</p>
                            <h3 className="text-2xl font-black text-red-600">{formatCurrency(financeData?.totalExpenses || 0)}</h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-primary-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-lg">
                            <HiOutlineBanknotes className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Lucro Líquido</p>
                            <h3 className={`text-2xl font-black ${profit >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
                                {formatCurrency(profit)}
                            </h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Chart */}
            <Card className="p-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-6">Evolução Financeira</h3>
                <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={financeData?.chartData || []}>
                            <defs>
                                <linearGradient id="colorRevHotel" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12}/>
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,.1)' }} />
                            <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorRevHotel)" name="Receita" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Recent lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Receitas Recentes</h3>
                        <Button size="sm" variant="ghost" className="text-green-600 text-xs" onClick={() => openModal('revenue')}
                            leftIcon={<HiOutlinePlus className="w-3 h-3" />}>Adicionar</Button>
                    </div>
                    <TableContainer isLoading={false} isEmpty={revenues.length === 0}>
                        <Card padding="none" className="overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 dark:bg-dark-800/50 border-b border-gray-100 dark:border-dark-700">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Descrição</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Cat.</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                    {revenues.slice(0, 6).map((rev: any) => (
                                        <tr key={rev.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{rev.description || rev.customerName}</p>
                                                <p className="text-[10px] text-gray-400">{formatDate(rev.date || rev.createdAt)}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge size="sm" variant="success">{rev.category || '-'}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-green-600">
                                                +{formatCurrency(rev.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </TableContainer>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Despesas Recentes</h3>
                        <Button size="sm" variant="ghost" className="text-red-500 text-xs" onClick={() => openModal('expense')}
                            leftIcon={<HiOutlinePlus className="w-3 h-3" />}>Adicionar</Button>
                    </div>
                    <TableContainer isLoading={false} isEmpty={expenses.length === 0}>
                        <Card padding="none" className="overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 dark:bg-dark-800/50 border-b border-gray-100 dark:border-dark-700">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Descrição</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Cat.</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                    {expenses.slice(0, 6).map((exp: any) => (
                                        <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{exp.description}</p>
                                                <p className="text-[10px] text-gray-400">{formatDate(exp.date || exp.createdAt)}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge size="sm" variant="danger">{exp.category || '-'}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-red-600">
                                                -{formatCurrency(exp.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </TableContainer>
                </div>
            </div>

            {/* Transaction Modal */}
            <Modal
                isOpen={modal.open}
                onClose={() => setModal({ ...modal, open: false })}
                title={modal.type === 'expense' ? 'Registar Nova Despesa' : 'Registar Nova Receita'}
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${modal.type === 'expense' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                        {modal.type === 'expense'
                            ? <HiOutlineArrowDownCircle className="w-5 h-5 text-red-500" />
                            : <HiOutlineArrowUpCircle className="w-5 h-5 text-green-500" />}
                        <span className={`text-sm font-semibold ${modal.type === 'expense' ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                            {modal.type === 'expense' ? 'Lançamento de Despesa' : 'Lançamento de Receita'}
                        </span>
                    </div>

                    <Input
                        label="Descrição *"
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder={modal.type === 'expense' ? 'Ex: Manutenção de ar condicionado' : 'Ex: Reserva quarto 101 - Hóspede João'}
                        required
                        autoFocus
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Valor (MT) *"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.amount}
                            onChange={e => setForm({ ...form, amount: e.target.value })}
                            placeholder="0.00"
                            required
                        />
                        <Input
                            label="Data *"
                            type="date"
                            value={form.date}
                            onChange={e => setForm({ ...form, date: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Select
                            label="Categoria *"
                            value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            options={[
                                { value: '', label: 'Selecionar...' },
                                ...(modal.type === 'expense' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES)
                            ]}
                            required
                        />
                        <Select
                            label="Método de Pagamento"
                            value={form.paymentMethod}
                            onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                            options={[
                                { value: 'cash', label: 'Dinheiro' },
                                { value: 'mpesa', label: 'M-Pesa' },
                                { value: 'emola', label: 'e-Mola' },
                                { value: 'card', label: 'Cartão' },
                                { value: 'transfer', label: 'Transferência' },
                            ]}
                        />
                    </div>

                    <Input
                        label="Notas (opcional)"
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Observações adicionais..."
                    />

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="ghost" fullWidth onClick={() => setModal({ ...modal, open: false })}>
                            <HiOutlineXMark className="w-4 h-4 mr-1" /> Cancelar
                        </Button>
                        <Button
                            type="submit"
                            fullWidth
                            isLoading={submitting}
                            variant={modal.type === 'expense' ? 'danger' : 'primary'}
                        >
                            <HiOutlinePlus className="w-4 h-4 mr-1" />
                            {modal.type === 'expense' ? 'Registar Despesa' : 'Registar Receita'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
