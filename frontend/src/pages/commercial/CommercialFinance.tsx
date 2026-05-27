import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
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
import { Card, Button, Input, Select, Modal, Badge, Pagination, ResponsiveValue, PageHeader, LoadingOverlay, SkeletonTable } from '../../components/ui';
import { StatCard } from '../../components/common/ModuleMetricCard';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { commercialAPI } from '../../services/api';
import type {
    CommercialTransaction,
    CommercialTransactionPaymentMethod,
    CommercialTransactionType,
} from '../../services/api/commercial.api';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

// Validation Schema
const transactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Categoria é obrigatória'),
    description: z.string().min(2, 'Descrição é obrigatória'),
    amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
    date: z.string().min(1, 'Data é obrigatória'),
    dueDate: z.string().optional().nullable(),
    paymentMethod: z.enum(['cash', 'card', 'mpesa', 'emola', 'transfer', 'bank_transfer', 'credit']).optional().nullable(),
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

export default function CommercialFinance() {
    const [transactions, setTransactions] = useState<CommercialTransaction[]>([]);
    const [summary, setSummary] = useState({ 
        totalRevenue: 0, 
        totalExpenses: 0, 
        netProfit: 0, 
        profitMargin: 0, 
        transactionCount: 0 
    });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | CommercialTransactionType>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [showFormModal, setShowFormModal] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<CommercialTransaction | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<CommercialTransaction | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalRows, setTotalRows] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [dashboardData, transData] = await Promise.all([
                commercialAPI.getFinanceDashboard(selectedPeriod),
                commercialAPI.getTransactions({
                    page,
                    limit,
                    search,
                    type: filterType !== 'all' ? filterType : undefined,
                    period: selectedPeriod
                })
            ]);
            setSummary(dashboardData.summary);
            setTransactions(transData.data);
            setTotalRows(transData.pagination.total);
        } catch (error) {
            logger.error('Error fetching commercial finance data:', error);
            toast.error('Erro ao carregar dados financeiros');
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, filterType, selectedPeriod]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<TransactionFormData>({
        resolver: zodResolver(transactionSchema) as Resolver<TransactionFormData>,
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
                await commercialAPI.updateTransaction(editingTransaction.id, data);
                toast.success('Lançamento actualizado!');
            } else {
                await commercialAPI.createTransaction(data);
                toast.success('Movimentação guardada com sucesso!');
            }
            setShowFormModal(false);
            setEditingTransaction(null);
            reset();
            fetchData();
        } catch (error) {
            logger.error('Failed to save commercial finance transaction:', error);
            toast.error('Erro ao processar lançamento');
        }
    };

    const handleEdit = (transaction: CommercialTransaction) => {
        setEditingTransaction(transaction);
        setValue('type', transaction.type);
        setValue('category', transaction.category);
        setValue('description', transaction.description);
        setValue('amount', transaction.amount);
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
            await commercialAPI.deleteTransaction(transactionToDelete.id);
            toast.success('Lançamento eliminado!');
            setDeleteModalOpen(false);
            setTransactionToDelete(null);
            fetchData();
        } catch (error) {
            logger.error('Failed to delete commercial finance transaction:', error);
            toast.error('Erro ao eliminar lançamento');
        }
    };

    const incomeCategories = [
        { value: 'Product_Sales', label: 'Vendas de Mercadorias' },
        { value: 'Service_Income', label: 'Prestação de Serviços' },
        { value: 'Commissions', label: 'Comissões de Parceiros' },
        { value: 'Dividends', label: 'Dividendos / Investimentos' },
        { value: 'Other_Income', label: 'Outras Receitas' },
    ];

    const expenseCategories = [
        { value: 'Stock_Purchase', label: 'Compra de Stock / Mercadoria' },
        { value: 'Logistics_Freight', label: 'Logística e Fretes' },
        { value: 'Rent_Warehouse', label: 'Aluguer de Armazéns/Loja' },
        { value: 'Marketing_Sales', label: 'Marketing e Vendas' },
        { value: 'Software_SaaS', label: 'Licenças de Software / SaaS' },
        { value: 'Salary_Team', label: 'Salários e Comissões Vendas' },
        { value: 'Taxes_Fees', label: 'Impostos e Taxas' },
        { value: 'Other_Expense', label: 'Outras Custas' },
    ];

    const paymentMethods: Array<{ value: CommercialTransactionPaymentMethod; label: string }> = [
        { value: 'cash', label: 'Numerário' },
        { value: 'card', label: 'Cartão / POS' },
        { value: 'bank_transfer', label: 'Transferência Bancária' },
        { value: 'mpesa', label: 'M-Pesa / E-Mola' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Gestão Financeira Comercial" 
                subtitle="Controle de receitas, custos e margens de lucro"
                icon={<HiOutlineCurrencyDollar className="text-primary-600 dark:text-primary-400" />}
            />
            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-end gap-3 bg-white/50 dark:bg-dark-900/50 p-2 rounded-xl border border-gray-100 dark:border-dark-700/50">
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
                    Nova Operação
                </Button>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Vendas Totais"
                    value={<ResponsiveValue value={summary.totalRevenue} size="md" className="text-orange-900 dark:text-white font-black" />}
                    icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
                    color="orange"
                />

                <StatCard
                    label="Custos Operacionais"
                    value={<ResponsiveValue value={summary.totalExpenses} size="md" className="text-rose-900 dark:text-white font-black" />}
                    icon={<HiOutlineArrowTrendingDown className="w-6 h-6" />}
                    color="rose"
                />

                <StatCard
                    label="EBITDA / Lucro"
                    value={<ResponsiveValue value={summary.netProfit} size="md" className={cn("font-black", summary.netProfit >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-rose-700 dark:text-rose-400')} />}
                    icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                    color="primary"
                />

                <StatCard
                    label="Margem Comercial"
                    value={`${summary.profitMargin.toFixed(1)}%`}
                    icon={<HiOutlineClipboardDocumentList className="w-6 h-6" />}
                    color="amber"
                />
            </div>

            {/* Filter & Period Header */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 py-2">
                <div className="flex w-full items-center gap-1 overflow-x-auto overscroll-x-contain bg-gray-100/50 dark:bg-dark-800 p-1 rounded-lg scrollbar-none lg:w-auto">
                    {periodOptions.map((option) => (
                        <Button
                            key={option.value}
                            onClick={() => { setSelectedPeriod(option.value); setPage(1); }}
                            variant="ghost"
                            size="sm"
                            className={cn(
                                'min-h-11 lg:h-8 flex-1 lg:px-6 rounded-lg text-[10px] font-black uppercase tracking-widest',
                                selectedPeriod === option.value
                                    ? 'bg-white dark:bg-dark-700 text-orange-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            )}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>

                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:items-center">
                    <Input
                        placeholder="Filtrar por descrição..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                        className="bg-white dark:bg-dark-800 border-none shadow-sm w-full lg:min-w-[280px]"
                        size="sm"
                    />
                    <Select
                        options={[
                            { value: 'all', label: 'Todos tipos' },
                            { value: 'income', label: 'Vendas/Receitas' },
                            { value: 'expense', label: 'Custos/Gastos' },
                        ]}
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value as 'all' | CommercialTransactionType); setPage(1); }}
                        className="w-full lg:w-40 border-none shadow-sm"
                        size="sm"
                    />
                </div>
            </div>

            {/* Table Area */}
            <Card padding="none" className="min-h-[500px] relative overflow-hidden border-none shadow-sm">
                {loading && transactions.length === 0 ? (
                    <div className="p-3 sm:p-6">
                        <SkeletonTable rows={8} columns={6} />
                    </div>
                ) : (
                    <>
                        {loading && (
                            <div className="absolute inset-0 z-20">
                                <LoadingOverlay 
                                    fullScreen={false} 
                                    message="A carregar transações..." 
                                />
                            </div>
                        )}
                        <div className="max-w-full overflow-x-auto overscroll-x-contain scrollbar-thin">
                            <table className="w-full min-w-[720px] divide-y divide-gray-200 dark:divide-dark-700">
                                <thead className="bg-gray-50/50 dark:bg-dark-900/50">
                                    <tr className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] italic">
                                        <th className="px-6 py-4 text-left">Canal</th>
                                        <th className="px-6 py-4 text-left">Data</th>
                                        <th className="px-6 py-4 text-left">Descrição</th>
                                        <th className="px-6 py-4 text-left">Categoria</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4 text-center">Gestão</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-100 dark:divide-dark-700">
                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic font-medium">
                                                Não existem movimentações comerciais para os critérios seleccionados.
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge variant={t.type === 'income' ? 'success' : 'danger'} className="uppercase font-black text-[9px] tracking-widest px-2.5 py-0.5 rounded-full">
                                                        {t.type === 'income' ? 'Entrada' : 'Saída'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
                                                    {formatDate(t.date)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{t.description}</span>
                                                        {t.reference && <span className="text-[10px] text-gray-400 font-medium italic">MOV: {t.reference}</span>}
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
                                                        t.type === 'income' ? 'text-teal-600' : 'text-rose-600'
                                                    )}>
                                                        {formatCurrency(t.amount)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            onClick={() => handleEdit(t)}
                                                            variant="ghost"
                                                            size="xs"
                                                            className="h-8 w-8 p-0 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600"
                                                        >
                                                            <HiOutlineCog className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => {
                                                                setTransactionToDelete(t);
                                                                setDeleteModalOpen(true);
                                                            }}
                                                            variant="ghost"
                                                            size="xs"
                                                            className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-600"
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
                    </>
                )}

                <div className="px-3 sm:px-6 py-4 bg-gray-50/30 dark:bg-dark-900/30 border-t border-gray-100 dark:border-dark-700">
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
                title={editingTransaction ? "Actualizar Operação" : "Nova Movimentação Comercial"}
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                                selectedType === 'income'
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                    : 'border-gray-100 dark:border-dark-700'
                            )}
                        >
                            <input type="radio" value="income" {...register('type')} className="hidden" />
                            <HiOutlineArrowTrendingUp className={cn(
                                'w-6 h-6',
                                selectedType === 'income' ? 'text-orange-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-black uppercase text-xs tracking-widest',
                                selectedType === 'income' ? 'text-orange-600' : 'text-gray-500'
                            )}>
                                Entrada
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
                                Saída
                            </span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Categoria de Operação *"
                            options={selectedType === 'income' ? incomeCategories : expenseCategories}
                            {...register('category')}
                            error={errors.category?.message}
                        />
                        <Input
                            label="Valor da Operação *"
                            type="number"
                            step="0.01"
                            {...register('amount')}
                            error={errors.amount?.message}
                            placeholder="0.00"
                            leftIcon={<span className="text-gray-400 font-bold">MT</span>}
                        />
                    </div>

                    <Input
                        label="Descrição da Movimentação *"
                        {...register('description')}
                        error={errors.description?.message}
                        placeholder="Ex: Pagamento de fornecedor de mercadoria"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Data Operativa *"
                            type="date"
                            {...register('date')}
                            error={errors.date?.message}
                        />
                        <Input
                            label="Data de Vencimento"
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
                            placeholder="Ex: FT-COM-00123"
                        />
                    </div>

                    <Input
                        label="Notas Adicionais"
                        {...register('notes')}
                        placeholder="Informações extra sobre a operação..."
                    />

                    <div className="flex gap-3 justify-end pt-6 border-t border-gray-100 dark:border-dark-700">
                        <Button type="button" variant="ghost" onClick={() => setShowFormModal(false)}>
                            Descartar
                        </Button>
                        <Button type="submit" variant={selectedType === 'income' ? 'primary' : 'danger'}>
                            {editingTransaction ? 'Actualizar Registo' : 'Guardar Operação'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Eliminação */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Eliminar Operação Comercial"
                size="sm"
            >
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Deseja realmente eliminar este lançamento permanente? Esta acção é irreversível e afectar a margem histórica.
                    </p>
                    <div className="flex gap-3 justify-end pt-4">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Eliminar Permanentemente
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
