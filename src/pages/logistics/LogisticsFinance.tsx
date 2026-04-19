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
import { Card, Button, Input, Select, Modal, Badge, Pagination, ResponsiveValue, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { logisticsAPI } from '../../services/api';
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

export default function LogisticsFinance() {
    useTranslation();
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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashboardData, transData] = await Promise.all([
                logisticsAPI.getFinanceDashboard(selectedPeriod),
                logisticsAPI.getTransactions({ 
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
            logger.error('Error fetching logistics finance data:', error);
            toast.error('Erro ao carregar dados financeiros');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, limit, search, filterType, selectedPeriod]);

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
                await logisticsAPI.updateTransaction(editingTransaction.id, data);
                toast.success('Transação actualizada!');
            } else {
                await logisticsAPI.createTransaction(data);
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
            await logisticsAPI.deleteTransaction(transactionToDelete.id);
            toast.success('Transação eliminada!');
            setDeleteModalOpen(false);
            setTransactionToDelete(null);
            fetchData();
        } catch (error) {
            toast.error('Erro ao eliminar transação');
        }
    };

    const incomeCategories = [
        { value: 'Deliveries', label: 'Prestação de Serviços (Entregas)' },
        { value: 'Freight', label: 'Fretes e Transportes' },
        { value: 'Contracts', label: 'Contratos Fixos' },
        { value: 'Fleet_Mgmt', label: 'Gestão de Frota' },
        { value: 'Other_Income', label: 'Outras Receitas' },
    ];

    const expenseCategories = [
        { value: 'Fuel', label: 'Combustível' },
        { value: 'Maintenance', label: 'Manutenção e Reparaces' },
        { value: 'Insurance', label: 'Seguros e Inspeções' },
        { value: 'Salary', label: 'Salários e Subsídios' },
        { value: 'Tolls', label: 'Portagens e Taxas Rodoviárias' },
        { value: 'Parts', label: 'Peças e Acessórios' },
        { value: 'Fines', label: 'Multas e Regularizaces' },
        { value: 'Other_Expense', label: 'Outras Despesas' },
    ];

    const paymentMethods = [
        { value: 'cash', label: 'Numerário' },
        { value: 'card', label: 'Cartão / TPA' },
        { value: 'mpesa', label: 'M-Pesa' },
        { value: 'emola', label: 'E-Mola' },
        { value: 'transfer', label: 'Transferência Bancária' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Gestão Financeira Logística"
                subtitle="Controle de custos de frota, combustível e receitas de transporte"
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
                            Novo Registo
                        </Button>
                    </>
                }
            />

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card padding="md" className="border-l-4 border-l-cyan-500 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                            <HiOutlineArrowTrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1 italic">Receitas (Fretes)</p>
                            <ResponsiveValue value={summary.totalRevenue} size="md" className="text-cyan-600 font-black" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-orange-500 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <HiOutlineArrowTrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1 italic">Custos Operacionais</p>
                            <ResponsiveValue value={summary.totalExpenses} size="md" className="text-orange-600 font-black" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-primary-500 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1 italic">Saldo Líquido</p>
                            <ResponsiveValue value={summary.netProfit} size="md" className={cn("font-black", summary.netProfit >= 0 ? 'text-teal-600' : 'text-rose-600')} />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-amber-500 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineClipboardDocumentList className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1 italic">Eficiência Provedor</p>
                            <span className="text-lg md:text-xl font-black text-amber-600">
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
                                    ? 'bg-white dark:bg-dark-700 text-cyan-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <Input
                        placeholder="Pesquisar transação..."
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

            {/* Table Area */}
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
                                        Nenhum registo encontrado.
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
                                                {t.reference && <span className="text-[10px] text-gray-400 font-medium italic">REF: {t.reference}</span>}
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
                                                {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
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

            {/* Modal de Formulário */}
            <Modal
                isOpen={showFormModal}
                onClose={() => {
                    setShowFormModal(false);
                    setEditingTransaction(null);
                    reset();
                }}
                title={editingTransaction ? "Editar Registo Financeiro" : "Novo Registo Financeiro"}
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                                selectedType === 'income'
                                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                                    : 'border-gray-100 dark:border-dark-700'
                            )}
                        >
                            <input type="radio" value="income" {...register('type')} className="hidden" />
                            <HiOutlineArrowTrendingUp className={cn(
                                'w-6 h-6',
                                selectedType === 'income' ? 'text-cyan-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-black uppercase text-xs tracking-widest',
                                selectedType === 'income' ? 'text-cyan-600' : 'text-gray-500'
                            )}>
                                Receita
                            </span>
                        </label>
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                                selectedType === 'expense'
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                    : 'border-gray-100 dark:border-dark-700'
                            )}
                        >
                            <input type="radio" value="expense" {...register('type')} className="hidden" />
                            <HiOutlineArrowTrendingDown className={cn(
                                'w-6 h-6',
                                selectedType === 'expense' ? 'text-orange-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-black uppercase text-xs tracking-widest',
                                selectedType === 'expense' ? 'text-orange-600' : 'text-gray-500'
                            )}>
                                Despesa
                            </span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Categoria Operacional *"
                            options={selectedType === 'income' ? incomeCategories : expenseCategories}
                            {...register('category')}
                            error={errors.category?.message}
                        />
                        <Input
                            label="Valor Monetrio *"
                            type="number"
                            step="0.01"
                            {...register('amount')}
                            error={errors.amount?.message}
                            placeholder="0.00"
                            leftIcon={<span className="text-gray-400 font-bold">MT</span>}
                        />
                    </div>

                    <Input
                        label="Descrição Detalhada *"
                        {...register('description')}
                        error={errors.description?.message}
                        placeholder="Ex: Abastecimento Toyota Hilux - 50L"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Data Operacional *"
                            type="date"
                            {...register('date')}
                            error={errors.date?.message}
                        />
                        <Input
                            label="Vencimento (Opcional)"
                            type="date"
                            {...register('dueDate')}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Via de Pagamento"
                            options={paymentMethods}
                            {...register('paymentMethod')}
                        />
                        <Input
                            label="Nº da Guia / Referência"
                            {...register('reference')}
                            placeholder="Ex: Fatura #FT2024/01"
                        />
                    </div>

                    <Input
                        label="Notas Adicionais"
                        {...register('notes')}
                        placeholder="Observações pertinentes..."
                    />

                    <div className="flex gap-3 justify-end pt-6 border-t border-gray-100 dark:border-dark-700">
                        <Button type="button" variant="ghost" onClick={() => setShowFormModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant={selectedType === 'income' ? 'primary' : 'danger'}>
                            {editingTransaction ? 'Actualizar' : 'Registar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Confirmação de Eliminação */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Eliminar Transacção"
                size="sm"
            >
                <div className="space-y-4 py-2 text-center lg:text-left">
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Deseja realmente eliminar este registo permanente? Esta acção impactar os relatórios operacionais.
                    </p>
                    <div className="flex gap-3 justify-center lg:justify-end pt-4">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
                            Cancelar
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
