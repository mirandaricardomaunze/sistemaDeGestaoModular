import { useState, useEffect, useCallback } from 'react';
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
import { Card, Button, Input, Select, Modal, Badge, Pagination, ResponsiveValue, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { commercialAPI } from '../../services/api';
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

export default function CommercialFinance() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [summary, setSummary] = useState({ 
        totalRevenue: 0, 
        totalExpenses: 0, 
        netProfit: 0, 
        profitMargin: 0, 
        transactionCount: 0 
    });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [showFormModal, setShowFormModal] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<any | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

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
        resolver: zodResolver(transactionSchema) as any,
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
            toast.error('Erro ao processar lançamento');
        }
    };

    const handleEdit = (transaction: any) => {
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

    const paymentMethods = [
        { value: 'cash', label: 'Numerário' },
        { value: 'card', label: 'Cartão / POS' },
        { value: 'bank_transfer', label: 'Transferência Bancária' },
        { value: 'mpesa', label: 'M-Pesa / E-Mola' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Gestão Financeira Comercial"
                subtitle="Controle de fluxo de caixa, compra de mercadoria e custos de trading"
                icon={<HiOutlineCurrencyDollar />}
                actions={
                    <>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={fetchData}
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
                        >
                            Nova Operação
                        </Button>
                    </>
                }
            />

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card padding="md" className="bg-orange-100/40 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-800/30 shadow-card-strong transition-all hover:scale-[1.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-200/60 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex items-center justify-center shadow-inner">
                            <HiOutlineArrowTrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600/70 dark:text-orange-400/60 mb-1">Vendas Totais</p>
                            <ResponsiveValue value={summary.totalRevenue} size="md" className="text-orange-900 dark:text-white font-black" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="bg-rose-100/40 dark:bg-rose-900/20 border border-rose-200/50 dark:border-rose-800/30 shadow-card-strong transition-all hover:scale-[1.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-rose-200/60 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 flex items-center justify-center shadow-inner">
                            <HiOutlineArrowTrendingDown className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600/70 dark:text-rose-400/60 mb-1">Custos Operacionais</p>
                            <ResponsiveValue value={summary.totalExpenses} size="md" className="text-rose-900 dark:text-white font-black" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="bg-primary-100/40 dark:bg-primary-900/20 border border-primary-200/50 dark:border-primary-800/30 shadow-card-strong transition-all hover:scale-[1.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-200/60 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center shadow-inner">
                            <HiOutlineCurrencyDollar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-600/70 dark:text-primary-400/60 mb-1">EBITDA / Lucro</p>
                            <ResponsiveValue value={summary.netProfit} size="md" className={cn("font-black", summary.netProfit >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-rose-700 dark:text-rose-400')} />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="bg-amber-100/40 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 shadow-card-strong transition-all hover:scale-[1.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-200/60 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-inner">
                            <HiOutlineClipboardDocumentList className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/70 dark:text-amber-400/60 mb-1">Margem Comercial</p>
                            <span className="text-lg md:text-xl font-black text-amber-900 dark:text-white">
                                {summary.profitMargin.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filter & Period Header */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-1 bg-gray-100/50 dark:bg-dark-800 p-1 rounded-lg w-full lg:w-auto">
                    {periodOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => { setSelectedPeriod(option.value); setPage(1); }}
                            className={cn(
                                'flex-1 lg:px-6 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest',
                                selectedPeriod === option.value
                                    ? 'bg-white dark:bg-dark-700 text-orange-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <Input
                        placeholder="Filtrar por descrição..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                        className="bg-white dark:bg-dark-800 border-none shadow-sm h-10 min-w-[280px]"
                    />
                    <Select
                        options={[
                            { value: 'all', label: 'Todos tipos' },
                            { value: 'income', label: 'Vendas/Receitas' },
                            { value: 'expense', label: 'Custos/Gastos' },
                        ]}
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                        className="w-40 border-none shadow-sm h-10"
                    />
                </div>
            </div>

            {/* Table Area */}
            <Card padding="none" className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
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
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4 h-16 bg-gray-50/20"></td>
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic font-medium">
                                        Não existem movimentações comerciais para os critrios seleccionados.
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
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(t)}
                                                    className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 transition-colors"
                                                >
                                                    <HiOutlineCog className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setTransactionToDelete(t);
                                                        setDeleteModalOpen(true);
                                                    }}
                                                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-600 transition-colors"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
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
