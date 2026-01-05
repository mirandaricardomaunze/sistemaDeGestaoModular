import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlineTrendingUp,
    HiOutlineTrendingDown,
    HiOutlineSearch,
    HiOutlineTrash,
    HiOutlineCheck,
    HiOutlineRefresh,
    HiOutlineCalculator,
    HiOutlineDocumentReport,
    HiOutlineCog,
    HiOutlineHome,
} from 'react-icons/hi';
import { subDays, parseISO } from 'date-fns';
import { Card, Button, Input, Select, Modal, Badge, Pagination, LoadingSpinner, EmptyState } from '../components/ui';
import { formatCurrency, formatDate, generateId, cn } from '../utils/helpers';
import ModuleFiscalView from '../components/shared/ModuleFiscalView';
import type { Transaction, TransactionType, TransactionStatus } from '../types';
import toast from 'react-hot-toast';

// Time period options
type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

// Validation Schema
const transactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Categoria é obrigatória'),
    description: z.string().min(2, 'Descrição é obrigatória'),
    amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
    date: z.string().min(1, 'Data é obrigatória'),
    dueDate: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
});

type FinancialTab = 'transactions' | 'reports' | 'fiscal' | 'settings';

export default function Financial() {
    // Local state for transactions (would come from store in production)
    const [transactions, setTransactions] = useState<Transaction[]>([
        {
            id: '1',
            type: 'income',
            category: 'vendas',
            description: 'Venda do dia #1234',
            amount: 2500.00,
            date: '2024-12-20',
            status: 'completed',
        },
        {
            id: '2',
            type: 'expense',
            category: 'fornecedores',
            description: 'Pagamento Fornecedor ABC',
            amount: 1200.00,
            date: '2024-12-19',
            dueDate: '2024-12-25',
            status: 'pending',
        },
        {
            id: '3',
            type: 'income',
            category: 'servicos',
            description: 'Serviço de consultoria',
            amount: 3500.00,
            date: '2024-12-18',
            status: 'completed',
        },
        {
            id: '4',
            type: 'expense',
            category: 'aluguel',
            description: 'Aluguel mensal',
            amount: 5000.00,
            date: '2024-12-01',
            dueDate: '2024-12-05',
            status: 'completed',
        },
    ]);

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all');
    const [showFormModal, setShowFormModal] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const { t } = useTranslation();

    // Get date range based on period
    const periodStartDate = useMemo(() => {
        const now = new Date();
        switch (selectedPeriod) {
            case '1m': return subDays(now, 30);
            case '3m': return subDays(now, 90);
            case '6m': return subDays(now, 180);
            case '1y': return subDays(now, 365);
        }
    }, [selectedPeriod]);

    // Filter transactions by selected period
    const periodTransactions = useMemo(() => {
        return transactions.filter((t) => parseISO(t.date) >= periodStartDate);
    }, [transactions, periodStartDate]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<TransactionFormData>({
        resolver: zodResolver(transactionSchema) as never,
        defaultValues: {
            type: 'income',
            category: '',
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            dueDate: '',
            reference: '',
            notes: '',
        },
    });

    const selectedType = watch('type');

    const [activeTab, setActiveTab] = useState<FinancialTab>('transactions');

    // Filter transactions (based on period + search + filters)
    const filteredTransactions = useMemo(() => {
        return periodTransactions.filter((t) => {
            const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase());
            const matchesType = filterType === 'all' || t.type === filterType;
            const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
            return matchesSearch && matchesType && matchesStatus;
        });
    }, [periodTransactions, search, filterType, filterStatus]);

    // Pagination (manual implementation since usePagination was removed or to match other pages)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const totalItems = filteredTransactions.length;
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage, itemsPerPage]);

    // Calculate summary (based on period)
    const summary = useMemo(() => {
        const income = periodTransactions
            .filter((t) => t.type === 'income' && t.status === 'completed')
            .reduce((sum, t) => sum + t.amount, 0);
        const expenses = periodTransactions
            .filter((t) => t.type === 'expense' && t.status === 'completed')
            .reduce((sum, t) => sum + t.amount, 0);
        const pending = periodTransactions
            .filter((t) => t.status === 'pending')
            .reduce((sum, t) => sum + t.amount, 0);
        return { income, expenses, balance: income - expenses, pending };
    }, [periodTransactions]);

    const onSubmit = (data: TransactionFormData) => {
        const newTransaction: Transaction = {
            id: generateId(),
            type: data.type,
            category: data.category,
            description: data.description,
            amount: data.amount,
            date: data.date,
            dueDate: data.dueDate || undefined,
            status: 'pending',
            reference: data.reference || undefined,
            notes: data.notes || undefined,
        };
        setTransactions((prev) => [newTransaction, ...prev]);
        toast.success('Transação registrada com sucesso!');
        setShowFormModal(false);
        reset();
    };

    const handleMarkComplete = (id: string) => {
        setTransactions((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: 'completed' as const } : t))
        );
        toast.success('Transação concluída!');
    };

    const handleDelete = () => {
        if (transactionToDelete) {
            setTransactions((prev) => prev.filter((t) => t.id !== transactionToDelete.id));
            toast.success('Transação excluída!');
            setDeleteModalOpen(false);
            setTransactionToDelete(null);
        }
    };

    const incomeCategories = [
        { value: 'vendas', label: 'Vendas' },
        { value: 'servicos', label: 'Serviços' },
        { value: 'comissoes', label: 'Comissões' },
        { value: 'outros_receitas', label: 'Outros' },
    ];

    const expenseCategories = [
        { value: 'fornecedores', label: 'Fornecedores' },
        { value: 'aluguel', label: 'Aluguel' },
        { value: 'salarios', label: 'Salários' },
        { value: 'agua_luz', label: 'Água/Luz' },
        { value: 'internet', label: 'Internet/Telefone' },
        { value: 'impostos', label: 'Impostos' },
        { value: 'outros_despesas', label: 'Outros' },
    ];

    const typeOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'income', label: 'Receitas' },
        { value: 'expense', label: 'Despesas' },
    ];

    const tabs = [
        { id: 'transactions' as const, label: 'Lançamentos', icon: <HiOutlineTrendingUp className="w-5 h-5" /> },
        { id: 'reports' as const, label: 'Relatórios', icon: <HiOutlineDocumentReport className="w-5 h-5" /> },
        { id: 'fiscal' as const, label: 'Fiscal', icon: <HiOutlineCalculator className="w-5 h-5" /> },
        { id: 'settings' as const, label: 'Configuração', icon: <HiOutlineCog className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            {/* Header with Responsive Tabs */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Gestão Financeira</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Controle de Fluxo de Caixa, Contas a Pagar e Receber</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-5 h-5" />}>Actualizar</Button>
                        <Button size="sm" leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => setShowFormModal(true)}>Novo Lançamento</Button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="mt-6 border-b border-gray-100 dark:border-dark-700">
                    <div className="flex overflow-x-auto no-scrollbar -mb-px">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as FinancialTab)}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap uppercase tracking-wider",
                                    activeTab === tab.id
                                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'transactions' && (
                    <div className="space-y-6">
                        {/* Period Filter for Transactions */}
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                                {periodOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setSelectedPeriod(option.value)}
                                        className={cn(
                                            'px-6 py-2 rounded-md text-xs font-bold transition-all uppercase tracking-widest',
                                            selectedPeriod === option.value
                                                ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card padding="md" className="border-l-4 border-l-green-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <HiOutlineTrendingUp className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Receitas</p>
                                        <p className="text-xl font-bold text-green-600">{formatCurrency(summary.income)}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card padding="md" className="border-l-4 border-l-red-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                        <HiOutlineTrendingDown className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Despesas</p>
                                        <p className="text-xl font-bold text-red-600">{formatCurrency(summary.expenses)}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card padding="md" className="border-l-4 border-l-primary-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                        <HiOutlineTrendingUp className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Saldo</p>
                                        <p className={cn(
                                            'text-xl font-bold',
                                            summary.balance >= 0 ? 'text-green-600' : 'text-red-600'
                                        )}>
                                            {formatCurrency(summary.balance)}
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <Card padding="md" className="border-l-4 border-l-yellow-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                        <HiOutlineTrendingDown className="w-6 h-6 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Pendentes</p>
                                        <p className="text-xl font-bold text-yellow-600">{formatCurrency(summary.pending)}</p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Filters */}
                        <Card padding="md">
                            <div className="flex flex-col lg:flex-row gap-4">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Buscar transações..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                                    />
                                </div>
                                <div className="w-full lg:w-40">
                                    <Select
                                        options={typeOptions}
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value as TransactionType | 'all')}
                                    />
                                </div>
                                <div className="w-full lg:w-40">
                                    <Select
                                        options={statusOptions}
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as TransactionStatus | 'all')}
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Transactions List */}
                        <Card padding="none">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-dark-800">
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Tipo
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Descrição
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Categoria
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Data
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Valor
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                        {filteredTransactions.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                                    Nenhuma transação encontrada
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedTransactions.map((t) => (
                                                <tr key={t.id} className="bg-white dark:bg-dark-900 hover:bg-gray-50 dark:hover:bg-dark-800">
                                                    <td className="px-6 py-4">
                                                        <Badge variant={t.type === 'income' ? 'success' : 'danger'}>
                                                            {t.type === 'income' ? 'Receita' : 'Despesa'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="font-medium text-gray-900 dark:text-white">{t.description}</p>
                                                        {t.reference && (
                                                            <p className="text-xs text-gray-500">Ref: {t.reference}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 capitalize">
                                                        {t.category.replace('_', ' ')}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                        {formatDate(t.date)}
                                                    </td>
                                                    <td className={cn(
                                                        'px-6 py-4 font-semibold',
                                                        t.type === 'income' ? 'text-green-600' : 'text-red-600'
                                                    )}>
                                                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant={t.status === 'completed' ? 'success' : 'warning'}>
                                                            {t.status === 'completed' ? 'Concluído' : 'Pendente'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1">
                                                            {t.status === 'pending' && (
                                                                <button
                                                                    onClick={() => handleMarkComplete(t.id)}
                                                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-green-600 transition-colors"
                                                                    title="Marcar como concluído"
                                                                >
                                                                    <HiOutlineCheck className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setTransactionToDelete(t);
                                                                    setDeleteModalOpen(true);
                                                                }}
                                                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-red-600 transition-colors"
                                                                title="Excluir"
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
                        </Card>

                        {/* Pagination */}
                        <div className="flex justify-center mt-6">
                            <Pagination
                                currentPage={currentPage}
                                totalItems={totalItems}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <Card padding="lg" className="flex flex-col items-center justify-center py-20">
                        <HiOutlineDocumentReport className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Relatórios Financeiros</h3>
                        <p className="text-gray-500 text-center max-w-md">Gere relatórios detalhados de DRE, fluxo de caixa e balancetes.</p>
                    </Card>
                )}

                {activeTab === 'fiscal' && <ModuleFiscalView module="financial" title="Gestão Financeira & Fiscal" />}

                {activeTab === 'settings' && (
                    <Card padding="lg" className="flex flex-col items-center justify-center py-20">
                        <HiOutlineCog className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Configurações Financeiras</h3>
                        <p className="text-gray-500 text-center max-w-md">Configure categorias, contas bancárias e automações.</p>
                    </Card>
                )}
            </div>

            {/* Add Transaction Modal */}
            <Modal
                isOpen={showFormModal}
                onClose={() => {
                    setShowFormModal(false);
                    reset();
                }}
                title="Nova Transação"
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-6">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                                selectedType === 'income'
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                    : 'border-gray-200 dark:border-dark-600'
                            )}
                        >
                            <input type="radio" value="income" {...register('type')} className="hidden" />
                            <HiOutlineTrendingUp className={cn(
                                'w-6 h-6',
                                selectedType === 'income' ? 'text-green-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-medium',
                                selectedType === 'income' ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'
                            )}>
                                Receita
                            </span>
                        </label>
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                                selectedType === 'expense'
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                    : 'border-gray-200 dark:border-dark-600'
                            )}
                        >
                            <input type="radio" value="expense" {...register('type')} className="hidden" />
                            <HiOutlineTrendingDown className={cn(
                                'w-6 h-6',
                                selectedType === 'expense' ? 'text-red-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-medium',
                                selectedType === 'expense' ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'
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
                        />
                    </div>

                    <Input
                        label="Descrição *"
                        {...register('description')}
                        error={errors.description?.message}
                        placeholder="Descrição da transação"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Data *"
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
                        <Input
                            label="Referência"
                            {...register('reference')}
                            placeholder="Nº nota, pedido, etc."
                        />
                        <Input
                            label="Observações"
                            {...register('notes')}
                            placeholder="Notas adicionais"
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button type="button" variant="ghost" onClick={() => {
                            setShowFormModal(false);
                            reset();
                        }}>
                            Cancelar
                        </Button>
                        <Button type="submit">
                            Registrar Transação
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Confirmar Exclusão"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Tem certeza que deseja excluir esta transação?
                    </p>
                    <div className="flex gap-3 justify-end">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
