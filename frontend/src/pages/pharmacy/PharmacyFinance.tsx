import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineMagnifyingGlass,
    HiOutlineTrash,

    HiOutlineArrowPath,
    HiOutlineCog,
    HiOutlineCurrencyDollar,
    HiOutlineClipboardDocumentList,
} from 'react-icons/hi2';
import { Card, Button, Input, Select, Modal, Badge, Pagination, PageHeader } from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { pharmacyAPI } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

// Validation Schema (Matches backend validation)
const transactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Categoria é obrigatória'),
    description: z.string().min(2, 'Descrição é obrigatória'),
    amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
    date: z.string().min(1, 'Data é obrigatória'),
    dueDate: z.string().optional().nullable(),
    paymentMethod: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

type FinanceTransaction = {
    id: string;
    type: 'income' | 'expense';
    category: string;
    description: string;
    amount: number | string;
    date: string;
    dueDate?: string | null;
    paymentMethod?: string;
    reference?: string;
    notes?: string;
};

export default function PharmacyFinance() {
    useTranslation();
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
    const [summary, setSummary] = useState({ 
        totalRevenue: 0, 
        totalExpenses: 0, 
        netProfit: 0, 
        profitMargin: 0, 
        transactionCount: 0 
    });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 350);
    const [filterType, setFilterType] = useState<string>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [showFormModal, setShowFormModal] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<FinanceTransaction | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalRows, setTotalRows] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashboardData, transData] = await Promise.all([
                pharmacyAPI.getFinanceDashboard(selectedPeriod),
                pharmacyAPI.getTransactions({
                    page,
                    limit,
                    search: debouncedSearch,
                    type: filterType !== 'all' ? filterType : undefined,
                    period: selectedPeriod
                })
            ]);
            setSummary(dashboardData.summary);
            setTransactions(transData.data);
            setTotalRows(transData.pagination.total);
        } catch (error) {
            logger.error('Error fetching finance data:', error);
            toast.error('Erro ao carregar dados financeiros');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, limit, debouncedSearch, filterType, selectedPeriod]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<TransactionFormData>({
        resolver: zodResolver(transactionSchema) as unknown as import('react-hook-form').Resolver<TransactionFormData>,
        defaultValues: {
            type: 'expense',
            category: '',
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            paymentMethod: 'cash'
        },
    });

    const selectedType = watch('type');

    const onSubmit = async (data: TransactionFormData) => {
        try {
            if (editingTransaction) {
                await pharmacyAPI.updateTransaction(editingTransaction.id, data);
                toast.success('Transação actualizada!');
            } else {
                await pharmacyAPI.createTransaction(data);
                toast.success('Transação registrada!');
            }
            setShowFormModal(false);
            setEditingTransaction(null);
            reset();
            fetchData();
        } catch (error) {
            toast.error('Ocorreu um erro ao salvar');
        }
    };

    const handleEdit = (transaction: FinanceTransaction) => {
        setEditingTransaction(transaction);
        setValue('type', transaction.type);
        setValue('category', transaction.category);
        setValue('description', transaction.description);
        setValue('amount', Number(transaction.amount));
        setValue('date', new Date(transaction.date).toISOString().split('T')[0]);
        setValue('dueDate', transaction.dueDate ? new Date(transaction.dueDate).toISOString().split('T')[0] : '');
        setValue('paymentMethod', transaction.paymentMethod || 'cash');
        setValue('reference', transaction.reference || '');
        setValue('notes', transaction.notes || '');
        setShowFormModal(true);
    };

    const handleDelete = async () => {
        if (!transactionToDelete) return;
        try {
            await pharmacyAPI.deleteTransaction(transactionToDelete.id);
            toast.success('Transação eliminada!');
            setDeleteModalOpen(false);
            setTransactionToDelete(null);
            fetchData();
        } catch (error) {
            toast.error('Erro ao eliminar transação');
        }
    };

    const incomeCategories = [
        { value: 'Sales', label: 'Vendas (POS)' },
        { value: 'Insurance', label: 'Seguradoras / Convênios' },
        { value: 'Consultation', label: 'Consultas Farmacêuticas' },
        { value: 'Other_Income', label: 'Outros Proveitos' },
    ];

    const expenseCategories = [
        { value: 'inventory', label: 'Compra de Stock' },
        { value: 'Salary', label: 'Salários' },
        { value: 'Rent', label: 'Aluguer da Instalação' },
        { value: 'Medical_Equipment', label: 'Equipamento Médico' },
        { value: 'Disposables', label: 'Consumíveis / Descartveis' },
        { value: 'Utilities', label: 'Água / Luz / Internet' },
        { value: 'Licensing', label: 'Licenciamento e Taxas' },
        { value: 'Other_Expense', label: 'Outras Despesas' },
    ];

    const paymentMethods = [
        { value: 'cash', label: 'Numerário (Dinheiro)' },
        { value: 'card', label: 'Cartão (POS/TPA)' },
        { value: 'mpesa', label: 'M-Pesa' },
        { value: 'emola', label: 'E-Mola' },
        { value: 'transfer', label: 'Transferência Bancária' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Gestão Financeira da Farmácia"
                subtitle="Controle profissional de despesas, receitas e fluxo de caixa"
                icon={<HiOutlineCurrencyDollar />}
                actions={
                    <>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={fetchData}
                            className="font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-gray-400 hover:text-primary-600 transition-all"
                            leftIcon={<HiOutlineArrowPath className={cn('w-4 h-4', loading && 'animate-spin')} />}
                        >
                            Actualizar
                        </Button>
                        <Button 
                            variant="primary"
                            size="sm" 
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />} 
                            onClick={() => {
                                setEditingTransaction(null);
                                reset();
                                setShowFormModal(true);
                            }}
                            className="font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            Nova Despesa/Receita
                        </Button>
                    </>
                }
            />

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Total Receitas"
                    value={summary.totalRevenue}
                    icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
                    color="emerald"
                    isCurrency
                />

                <MetricCard
                    label="Total Despesas"
                    value={summary.totalExpenses}
                    icon={<HiOutlineArrowTrendingDown className="w-6 h-6" />}
                    color="rose"
                    isCurrency
                />

                <MetricCard
                    label="Lucro Líquido"
                    value={summary.netProfit}
                    icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                    color="teal"
                    isCurrency
                />

                <MetricCard
                    label="Margem de Lucro"
                    value={`${summary.profitMargin.toFixed(1)}%`}
                    icon={<HiOutlineClipboardDocumentList className="w-6 h-6" />}
                    color="amber"
                />
            </div>

            {/* Filter & Period Header */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-1 bg-gray-100/50 dark:bg-dark-800 p-1 rounded-lg w-full lg:w-auto">
                    {periodOptions.map((option) => (
                        <Button variant="ghost"
                            key={option.value}
                            onClick={() => { setSelectedPeriod(option.value); setPage(1); }}
                            className={cn(
                                'flex-1 lg:px-6 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest',
                                selectedPeriod === option.value
                                    ? 'bg-white dark:bg-dark-700 text-teal-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            )}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <Input
                        placeholder="Buscar por descrição..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                        className="bg-white dark:bg-dark-800 border-none shadow-sm h-10 min-w-[280px]"
                    />
                    <Select
                        options={[
                            { value: 'all', label: 'Todos tipos' },
                            { value: 'income', label: 'Receitas' },
                            { value: 'expense', label: 'Despesas' },
                        ]}
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                        className="w-40 border-none shadow-sm h-10"
                    />
                </div>
            </div>

            {/* List area */}
            <Card padding="none" className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="bg-gray-50/50 dark:bg-dark-900/50">
                            <tr className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] italic">
                                <th className="px-6 py-4 text-left">Tipo</th>
                                <th className="px-6 py-4 text-left">Data</th>
                                <th className="px-6 py-4 text-left">Descrição</th>
                                <th className="px-6 py-4 text-left">Categoria</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-100 dark:divide-dark-700">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4 h-16 bg-gray-50/20"></td>
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic font-medium">
                                        Nenhuma transação encontrada no período selecionado.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant={t.type === 'income' ? 'success' : 'danger'} className="uppercase font-black text-[9px] tracking-widest px-2.5 py-0.5 rounded-full">
                                                {t.type === 'income' ? 'Receita' : 'Despesa'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {formatDate(t.date)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{t.description}</span>
                                                {t.reference && <span className="text-[10px] text-gray-400 font-medium">REF: {t.reference}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 rounded-lg font-black uppercase tracking-wider italic">
                                                {t.category.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className={cn(
                                                "text-sm font-black tracking-tight",
                                                t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                                            )}>
                                                {t.type === 'income' ? '+' : '-'} {formatCurrency(Number(t.amount))}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost"
                                                    onClick={() => handleEdit(t)}
                                                    className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 transition-colors"
                                                    title="Editar"
                                                >
                                                    <HiOutlineCog className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost"
                                                    onClick={() => {
                                                        setTransactionToDelete(t);
                                                        setDeleteModalOpen(true);
                                                    }}
                                                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-600 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-gray-50/30 dark:bg-dark-900/30 border-t border-gray-100 dark:border-dark-700">
                    <Pagination
                        currentPage={page}
                        totalItems={totalRows}
                        itemsPerPage={limit}
                        onPageChange={setPage}
                        onItemsPerPageChange={setLimit}
                    />
                </div>
            </Card>

            {/* Form Modal */}
            <Modal
                isOpen={showFormModal}
                onClose={() => {
                    setShowFormModal(false);
                    setEditingTransaction(null);
                    reset();
                }}
                title={editingTransaction ? "Editar Transação" : "Nova Transação Financeira"}
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                                selectedType === 'income'
                                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                    : 'border-gray-100 dark:border-dark-700'
                            )}
                        >
                            <input type="radio" value="income" {...register('type')} className="hidden" />
                            <HiOutlineArrowTrendingUp className={cn(
                                'w-6 h-6',
                                selectedType === 'income' ? 'text-teal-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-black uppercase text-xs tracking-widest',
                                selectedType === 'income' ? 'text-teal-600' : 'text-gray-500'
                            )}>
                                Receita
                            </span>
                        </label>
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                                selectedType === 'expense'
                                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                                    : 'border-gray-100 dark:border-dark-700'
                            )}
                        >
                            <input type="radio" value="expense" {...register('type')} className="hidden" />
                            <HiOutlineArrowTrendingDown className={cn(
                                'w-6 h-6',
                                selectedType === 'expense' ? 'text-rose-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-black uppercase text-xs tracking-widest',
                                selectedType === 'expense' ? 'text-rose-600' : 'text-gray-500'
                            )}>
                                Despesa
                            </span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Categoria *"
                            options={selectedType === 'income' ? incomeCategories : expenseCategories}
                            {...register('category')}
                            error={errors.category?.message}
                        />
                        <Input
                            label="Valor *"
                            type="number"
                            step="0.01"
                            {...register('amount')}
                            error={errors.amount?.message}
                            placeholder="0.00"
                            leftIcon={<span className="text-gray-400 font-bold">MT</span>}
                        />
                    </div>

                    <Input
                        label="Descrição da Transação *"
                        {...register('description')}
                        error={errors.description?.message}
                        placeholder="Ex: Pagamento mensal de aluguer"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Data da Operação *"
                            type="date"
                            {...register('date')}
                            error={errors.date?.message}
                        />
                        <Input
                            label="Data de Vencimento (Opcional)"
                            type="date"
                            {...register('dueDate')}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Forma de Pagamento"
                            options={paymentMethods}
                            {...register('paymentMethod')}
                        />
                        <Input
                            label="Referência / Documento"
                            {...register('reference')}
                            placeholder="Ex: Factura #1234"
                        />
                    </div>

                    <Input
                        label="Observações Internas (Opcional)"
                        {...register('notes')}
                        placeholder="Notas adicionais para controle..."
                    />

                    <div className="flex gap-3 justify-end pt-6 border-t border-gray-100 dark:border-dark-700">
                        <Button type="button" variant="ghost" onClick={() => setShowFormModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant={selectedType === 'income' ? 'primary' : 'danger'}>
                            {editingTransaction ? 'Salvar Alterações' : 'Gravar Transação'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Confirmar Eliminação"
                size="sm"
            >
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Esta acção não pode ser desfeita. Tem certeza que deseja eliminar este registo financeiro?
                    </p>
                    <div className="flex gap-3 justify-end pt-4">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
                            Manter
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Sim, Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
