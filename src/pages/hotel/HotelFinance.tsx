import { useState } from 'react';
import {
    HiOutlineDocumentReport,
    HiOutlineRefresh,
    HiOutlineDownload,
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineCurrencyDollar,
    HiOutlineTrendingUp,
    HiOutlineTrendingDown,
    HiOutlineCheck,
} from 'react-icons/hi';
import { generateHotelFinanceReport } from '../../utils/documentGenerator';
import { FinanceSummaryCards } from './components/FinanceSummaryCards';
import { FinanceCharts } from './components/FinanceCharts';
import { ReportCharts } from './components/ReportCharts';
import { ExpenseModal, expenseCategories } from './components/ExpenseModal';
import {
    Card,
    Button,
    Badge,
    LoadingSpinner,
    Pagination,
    Input,
    Select,
} from '../../components/ui';
import { useStore } from '../../stores/useStore';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { cn } from '../../utils/helpers';
import * as XLSX from 'xlsx';
import { useHotelFinance, type TimePeriod } from '../../hooks/useHotelFinance';

// Time period options
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

type Tab = 'dashboard' | 'revenues' | 'expenses' | 'reports';

export default function HotelFinance() {
    const { companySettings } = useStore();
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);

    const {
        isLoading,
        dashboard,
        revenues,
        expenses,
        revenuePagination,
        expensePagination,
        profitLossReport,
        roomRevenueReport,
        isLoadingReports,
        revenueByCatArray,
        expenseByCatArray,
        roomsReportArray,
        revenueCatPagination,
        expenseCatPagination,
        roomRevenuePagination,
        monthlyData,
        categoryData,
        expenseCategoryData,
        pendingExpenses,
        searchQuery,
        setSearchQuery,
        filterStatus,
        setFilterStatus,
        searchQueryRevenue,
        setSearchQueryRevenue,
        filterStatusRevenue,
        setFilterStatusRevenue,
        fetchDashboard,
        fetchExpenses,
        handleDeleteExpense,
        handleMarkAsPaid
    } = useHotelFinance(selectedPeriod, activeTab);

    // Export to PDF
    const exportToPDF = () => {
        try {
            if (!dashboard) {
                toast.error('Nenhum dado disponível para exportar');
                return;
            }

            const periodLabel = periodOptions.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

            generateHotelFinanceReport({
                period: periodLabel,
                summary: {
                    totalRevenue: dashboard.summary?.totalRevenue || 0,
                    totalExpenses: dashboard.summary?.totalExpenses || 0,
                    netProfit: dashboard.summary?.netProfit || 0,
                    profitMargin: dashboard.summary?.profitMargin || 0
                },
                monthlyTrend: dashboard.monthlyTrend || [],
                revenueByCategory: dashboard.revenueByCategory || {},
                expensesByCategory: dashboard.expensesByCategory || {},
                companyInfo: companySettings
            });

            toast.success('PDF exportado com sucesso!');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            toast.error('Erro ao exportar PDF');
        }
    };

    // Export to Excel
    const exportToExcel = () => {
        try {
            const wb = XLSX.utils.book_new();

            // Summary sheet
            const summaryData = [
                [companySettings.companyName || 'Empresa'],
                [companySettings.address || ''],
                [`NUIT: ${companySettings.taxId || ''} | Tel: ${companySettings.phone || ''}`],
                [''],
                ['Relatório Financeiro - Hotelaria'],
                [''],
                ['Período', periodOptions.find(p => p.value === selectedPeriod)?.label],
                ['Receitas Totais', dashboard?.summary?.totalRevenue || 0],
                ['Despesas Totais', dashboard?.summary?.totalExpenses || 0],
                ['Lucro Líquido', dashboard?.summary?.netProfit || 0],
                ['Margem de Lucro (%)', dashboard?.summary?.profitMargin || 0],
            ];
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo');

            // Monthly trend sheet
            if (monthlyData.length > 0) {
                const monthlySheet = XLSX.utils.json_to_sheet(monthlyData);
                XLSX.utils.book_append_sheet(wb, monthlySheet, 'Tendência Mensal');
            }

            XLSX.writeFile(wb, 'relatorio-financeiro-hotel.xlsx');
            toast.success('Excel exportado com sucesso!');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            toast.error('Erro ao exportar Excel');
        }
    };

    const handleSaveExpense = () => {
        fetchExpenses();
        fetchDashboard();
    };

    if (isLoading && !dashboard) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Gestão Financeira - Hotelaria
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Controle completo de receitas, despesas e relatórios financeiros
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="ghost"
                        onClick={fetchDashboard}
                        leftIcon={<HiOutlineRefresh className="w-5 h-5" />}
                    >
                        Actualizar
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={exportToPDF}
                        leftIcon={<HiOutlineDownload className="w-5 h-5" />}
                    >
                        PDF
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={exportToExcel}
                        leftIcon={<HiOutlineDownload className="w-5 h-5" />}
                    >
                        Excel
                    </Button>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        {periodOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedPeriod(option.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
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
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-dark-600">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: HiOutlineCurrencyDollar },
                        { id: 'revenues', label: 'Receitas', icon: HiOutlineTrendingUp },
                        { id: 'expenses', label: 'Despesas', icon: HiOutlineTrendingDown },
                        { id: 'reports', label: 'Relatórios', icon: HiOutlineDocumentReport },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={cn(
                                'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
                                activeTab === tab.id
                                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            )}
                        >
                            <tab.icon className={cn(
                                'mr-2 h-5 w-5',
                                activeTab === tab.id
                                    ? 'text-primary-500 dark:text-primary-400'
                                    : 'text-gray-400 group-hover:text-gray-500'
                            )} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && dashboard && (
                <div className="space-y-6">
                    <FinanceSummaryCards
                        summary={dashboard.summary}
                        pendingExpenses={pendingExpenses}
                    />

                    <FinanceCharts
                        monthlyData={monthlyData}
                        categoryData={categoryData}
                        expenseCategoryData={expenseCategoryData}
                    />
                </div>
            )}

            {/* Revenues Tab */}
            {activeTab === 'revenues' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <Card padding="md">
                        <div className="flex flex-col lg:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <Input
                                    placeholder="Buscar por descrição, categoria ou referência..."
                                    value={searchQueryRevenue}
                                    onChange={(e) => setSearchQueryRevenue(e.target.value)}
                                    leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                />
                            </div>
                            <div className="w-full lg:w-48">
                                <Select
                                    value={filterStatusRevenue}
                                    onChange={(e) => setFilterStatusRevenue(e.target.value)}
                                    options={[
                                        { value: 'all', label: 'Todos os Status' },
                                        { value: 'completed', label: 'Completos' },
                                        { value: 'pending', label: 'Pendentes' },
                                    ]}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card padding="md">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Histórico de Receitas
                        </h2>
                        {revenues.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500 dark:text-gray-400">Nenhuma receita encontrada</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
                                        <thead className="bg-gray-50 dark:bg-dark-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Data
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Descrição
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Categoria
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Valor
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-600">
                                            {revenuePagination.paginatedItems.map((revenue) => (
                                                <tr key={revenue.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        {formatDate(revenue.date)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                                        {revenue.description}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        <Badge variant="success">
                                                            {revenue.category === 'accommodation' ? 'Hospedagem' : 'Consumos'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                                        {formatCurrency(Number(revenue.amount))}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <Badge variant={revenue.status === 'completed' ? 'success' : 'warning'}>
                                                            {revenue.status === 'completed' ? 'Completo' : 'Pendente'}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination
                                    currentPage={revenuePagination.currentPage}
                                    totalItems={revenuePagination.totalItems}
                                    itemsPerPage={revenuePagination.itemsPerPage}
                                    onPageChange={revenuePagination.setCurrentPage}
                                    onItemsPerPageChange={revenuePagination.setItemsPerPage}
                                    className="p-4 bg-white dark:bg-dark-800 border-t border-gray-100 dark:border-dark-700"
                                />
                            </>
                        )}
                    </Card>
                </div>
            )}

            {/* Expenses Tab */}
            {activeTab === 'expenses' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <Card padding="md">
                        <div className="flex flex-col lg:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <Input
                                    placeholder="Buscar por descrição, categoria ou referência..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                />
                            </div>
                            <div className="w-full lg:w-48">
                                <Select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    options={[
                                        { value: 'all', label: 'Todos os Status' },
                                        { value: 'pending', label: 'Pendentes' },
                                        { value: 'completed', label: 'Pagos' },
                                        { value: 'cancelled', label: 'Cancelados' },
                                    ]}
                                />
                            </div>
                            <div className="w-full lg:w-auto">
                                <Button
                                    fullWidth
                                    leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                                    onClick={() => {
                                        setEditingExpense(null);
                                        setShowExpenseModal(true);
                                    }}
                                >
                                    Nova Despesa
                                </Button>
                            </div>
                        </div>
                    </Card>
                    <Card padding="md">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Histórico de Despesas
                        </h2>
                        {expenses.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500 dark:text-gray-400">Nenhuma despesa encontrada</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
                                        <thead className="bg-gray-50 dark:bg-dark-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Data
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Descrição
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Categoria
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Valor
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Ações
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-600">
                                            {expensePagination.paginatedItems.map((expense) => (
                                                <tr key={expense.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        {formatDate(expense.date)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                                        {expense.description}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        <Badge variant="warning">
                                                            {expenseCategories.find(c => c.value === expense.category)?.label || expense.category}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                                                        {formatCurrency(Number(expense.amount))}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <Badge variant={expense.status === 'completed' ? 'success' : expense.status === 'pending' ? 'warning' : 'danger'}>
                                                            {expense.status === 'completed' ? 'Pago' : expense.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {expense.status === 'pending' && (
                                                                <button
                                                                    onClick={() => handleMarkAsPaid(expense.id)}
                                                                    className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-500 hover:text-green-600 transition-colors"
                                                                    title="Marcar como Pago"
                                                                >
                                                                    <HiOutlineCheck className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setEditingExpense(expense);
                                                                    setShowExpenseModal(true);
                                                                }}
                                                                className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-500 hover:text-primary-600 transition-colors"
                                                                title="Editar"
                                                            >
                                                                <HiOutlinePencil className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteExpense(expense.id)}
                                                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <HiOutlineTrash className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination
                                    currentPage={expensePagination.currentPage}
                                    totalItems={expensePagination.totalItems}
                                    itemsPerPage={expensePagination.itemsPerPage}
                                    onPageChange={expensePagination.setCurrentPage}
                                    onItemsPerPageChange={expensePagination.setItemsPerPage}
                                    className="p-4 border-t border-gray-100 dark:border-dark-700"
                                />
                            </>
                        )}
                    </Card>
                </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
                <div className="space-y-6">
                    {isLoadingReports ? (
                        <div className="flex items-center justify-center h-96">
                            <LoadingSpinner size="lg" />
                        </div>
                    ) : (
                        <>
                            {/* Profit & Loss Report */}
                            {profitLossReport && (
                                <Card padding="md">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                            Relatório de Lucros e Perdas
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Período: {profitLossReport.period?.startDate && formatDate(profitLossReport.period.startDate)} - {profitLossReport.period?.endDate && formatDate(profitLossReport.period.endDate)}
                                        </p>
                                    </div>

                                    {/* Charts Section */}
                                    <ReportCharts profitLossReport={profitLossReport} type="profit-loss" />

                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Receitas Totais</p>
                                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                                {formatCurrency(profitLossReport.summary?.totalRevenue || 0)}
                                            </p>
                                        </div>
                                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                            <p className="text-sm text-red-600 dark:text-red-400 font-medium">Despesas Totais</p>
                                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                                                {formatCurrency(profitLossReport.summary?.totalExpenses || 0)}
                                            </p>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Lucro Líquido</p>
                                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                                {formatCurrency(profitLossReport.summary?.netProfit || 0)}
                                            </p>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Margem de Lucro</p>
                                            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                                                {profitLossReport.summary?.profitMargin?.toFixed(1) || 0}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Revenue Breakdown */}
                                    <div className="mb-8">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Receitas por Categoria</h3>
                                        <div className="overflow-x-auto">
                                            {revenueByCatArray.length > 0 ? (
                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
                                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-600">
                                                        {revenueCatPagination.paginatedItems.map((item: any) => (
                                                            <tr key={item.category}>
                                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize font-medium">
                                                                    {item.category === 'accommodation' ? 'Hospedagem' : item.category === 'consumption' ? 'Consumos' : item.category}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                                                                    {formatCurrency(item.total)}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-400">
                                                                    {item.count}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                                    Nenhuma receita encontrada para este período
                                                </div>
                                            )}
                                        </div>
                                        <Pagination
                                            currentPage={revenueCatPagination.currentPage}
                                            totalItems={revenueCatPagination.totalItems}
                                            itemsPerPage={revenueCatPagination.itemsPerPage}
                                            onPageChange={revenueCatPagination.setCurrentPage}
                                            onItemsPerPageChange={revenueCatPagination.setItemsPerPage}
                                            className="p-4 border-t border-gray-100 dark:border-dark-700"
                                        />
                                    </div>

                                    {/* Expense Breakdown */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Despesas por Categoria</h3>
                                        <div className="overflow-x-auto">
                                            {expenseByCatArray.length > 0 ? (
                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
                                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-600">
                                                        {expenseCatPagination.paginatedItems.map((item: any) => (
                                                            <tr key={item.category}>
                                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                                                    {expenseCategories.find(c => c.value === item.category)?.label || item.category}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">
                                                                    {formatCurrency(item.total)}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-400">
                                                                    {item.count}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                                    Nenhuma despesa encontrada para este período
                                                </div>
                                            )}
                                        </div>
                                        <Pagination
                                            currentPage={expenseCatPagination.currentPage}
                                            totalItems={expenseCatPagination.totalItems}
                                            itemsPerPage={expenseCatPagination.itemsPerPage}
                                            onPageChange={expenseCatPagination.setCurrentPage}
                                            onItemsPerPageChange={expenseCatPagination.setItemsPerPage}
                                            className="p-4 border-t border-gray-100 dark:border-dark-700"
                                        />
                                    </div>
                                </Card>
                            )}

                            {/* Room Revenue Report */}
                            {roomRevenueReport && (
                                <Card padding="md">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                            Receitas por Quarto
                                        </h2>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            <span className="font-medium">{roomRevenueReport.summary?.totalRooms || 0}</span> quartos geraram{' '}
                                            <span className="font-semibold text-green-600">{formatCurrency(roomRevenueReport.summary?.totalRevenue || 0)}</span>
                                        </div>
                                    </div>

                                    <ReportCharts roomRevenueReport={roomRevenueReport} type="room-revenue" />

                                    <div className="overflow-x-auto">
                                        {roomsReportArray.length > 0 ? (
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-600">
                                                <thead className="bg-gray-50 dark:bg-dark-700">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quarto</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receita Total</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nº Transações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-600">
                                                    {roomRevenuePagination.paginatedItems.map((room: any, index: number) => (
                                                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                                                Quarto {room.roomNumber}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 capitalize">
                                                                {room.roomType}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                                                                {formatCurrency(room.total)}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-400">
                                                                {room.count}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                                Nenhum dado de quarto encontrado para este período
                                            </div>
                                        )}
                                    </div>
                                    <Pagination
                                        currentPage={roomRevenuePagination.currentPage}
                                        totalItems={roomRevenuePagination.totalItems}
                                        itemsPerPage={roomRevenuePagination.itemsPerPage}
                                        onPageChange={roomRevenuePagination.setCurrentPage}
                                        onItemsPerPageChange={roomRevenuePagination.setItemsPerPage}
                                        className="p-4 border-t border-gray-100 dark:border-dark-700"
                                    />
                                </Card>
                            )}

                            {/* No Data Message */}
                            {(!profitLossReport && !roomRevenueReport) && (
                                <Card padding="md">
                                    <div className="text-center py-12">
                                        <HiOutlineDocumentReport className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-500 dark:text-gray-400">
                                            Nenhum dado disponível para o período selecionado
                                        </p>
                                    </div>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Expense Modal */}
            <ExpenseModal
                isOpen={showExpenseModal}
                onClose={() => {
                    setShowExpenseModal(false);
                    setEditingExpense(null);
                }}
                onSave={handleSaveExpense}
                expense={editingExpense}
            />
        </div>
    );
}
