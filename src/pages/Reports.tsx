import { useState, useMemo } from 'react';
import {
    HiOutlineDocumentDownload,
    HiOutlineCalendar,
    HiOutlineChartBar,
    HiOutlineCurrencyDollar,
    HiOutlineShoppingCart,
    HiOutlineFilter,
    HiOutlineRefresh,
    HiOutlineCube,
    HiOutlineDownload,
} from 'react-icons/hi';

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { useStore } from '../stores/useStore';
import { useSales, useProducts } from '../hooks/useData';
import { Button, Card, Pagination, usePagination } from '../components/ui';
import { formatCurrency, formatDate } from '../utils/helpers';
import ShareButton from '../components/share/ShareButton';
import { useTenant } from '../contexts/TenantContext';
import { HospitalityReports } from '../components/hospitality';
import { ExportSalesButton } from '../components/common/ExportButton';
import { exportAPI } from '../services/api';
import type { Sale } from '../types';

// Time period options
type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mês' },
    { value: 'year', label: 'Este Ano' },
    { value: 'custom', label: 'Personalizado' },
];

type ReportType = 'overview' | 'daily' | 'products' | 'categories';

const reportTypes: { value: ReportType; label: string; icon: typeof HiOutlineChartBar }[] = [
    { value: 'overview', label: 'Visão Geral', icon: HiOutlineChartBar },
    { value: 'daily', label: 'Vendas Diárias', icon: HiOutlineCalendar },
    { value: 'products', label: 'Por Produto', icon: HiOutlineShoppingCart },
    { value: 'categories', label: 'Por Categoria', icon: HiOutlineFilter },
];

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export default function Reports() {
    const { companySettings } = useStore();
    const { hasModule } = useTenant();

    // Check if user has HOTEL module - if so, show hotel reports
    if (hasModule('HOTEL')) {
        return <HospitalityReports />;
    }

    // Otherwise show sales reports (for COMMERCIAL, PHARMACY, etc.)
    // Fetch real data from API
    const { sales: apiSales } = useSales();
    const { products } = useProducts();
    const [period, setPeriod] = useState<TimePeriod>('month');
    const [startDateCustom, setStartDateCustom] = useState<string>(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [endDateCustom, setEndDateCustom] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [reportType, setReportType] = useState<ReportType>('overview');

    // Use real sales data from API
    const allSales = useMemo(() => {
        return (apiSales || []).map((sale: any) => ({
            ...sale,
            total: Number(sale.total) || 0,
            subtotal: Number(sale.subtotal) || 0,
            tax: Number(sale.tax) || 0,
            discount: Number(sale.discount) || 0,
            amountPaid: Number(sale.amountPaid) || 0,
            change: Number(sale.change) || 0,
        })) as Sale[];
    }, [apiSales]);

    // Filter sales by period
    const filteredSales = useMemo(() => {
        const now = new Date();
        let start: Date;
        let end: Date = new Date();

        switch (period) {
            case 'today':
                start = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                start = new Date(now);
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start = new Date(now);
                start.setMonth(start.getMonth() - 1);
                break;
            case 'quarter':
                start = new Date(now);
                start.setMonth(start.getMonth() - 3);
                break;
            case 'year':
                start = new Date(now);
                start.setFullYear(start.getFullYear() - 1);
                break;
            case 'custom':
                start = new Date(startDateCustom);
                start.setHours(0, 0, 0, 0);
                end = new Date(endDateCustom);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date(0);
        }

        return allSales.filter((sale) => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= start && saleDate <= end;
        });
    }, [allSales, period, startDateCustom, endDateCustom]);

    // Calculate metrics
    const metrics = useMemo(() => {
        const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
        const totalTax = filteredSales.reduce((sum, sale) => sum + sale.tax, 0);
        const totalCost = filteredSales.reduce((sum, sale) => {
            return sum + (sale.items || []).reduce((itemSum, item: any) => {
                // Try to find product cost from the item or the products list
                const product = (products || []).find(p => p.id === (item.productId || item.product?.id));
                const unitCost = Number(item.costPrice || product?.costPrice || 0);
                return itemSum + (unitCost * (item.quantity || 1));
            }, 0);
        }, 0);

        const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
        const profit = totalSales - totalCost;
        const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

        // Stock valuation
        const stockValuationCost = (products || []).reduce((sum, p) => sum + (Number(p.costPrice) * p.currentStock), 0);
        const stockValuationRetail = (products || []).reduce((sum, p) => sum + (Number(p.price) * p.currentStock), 0);

        return {
            totalSales,
            totalTax,
            avgTicket,
            transactionCount: filteredSales.length,
            totalCost,
            profit,
            profitMargin,
            stockValuationCost,
            stockValuationRetail
        };
    }, [filteredSales, products]);

    // Daily sales data for chart
    const dailySalesData = useMemo(() => {
        const dailyMap = new Map<string, { date: string; total: number; count: number }>();

        filteredSales.forEach((sale) => {
            const date = formatDate(sale.createdAt, 'dd/MM');
            const existing = dailyMap.get(date) || { date, total: 0, count: 0 };
            existing.total += sale.total;
            existing.count += 1;
            dailyMap.set(date, existing);
        });

        return Array.from(dailyMap.values()).reverse().slice(-14);
    }, [filteredSales]);

    // Payment method distribution
    const paymentMethodData = useMemo(() => {
        const methodMap = new Map<string, number>();

        filteredSales.forEach((sale) => {
            const count = methodMap.get(sale.paymentMethod) || 0;
            methodMap.set(sale.paymentMethod, count + sale.total);
        });

        const methodLabels: Record<string, string> = {
            cash: 'Dinheiro',
            card: 'Cartão',
            pix: 'M-Pesa',
            transfer: 'Transferência',
            credit: 'Crédito',
        };

        return Array.from(methodMap.entries()).map(([method, value]) => ({
            name: methodLabels[method] || method,
            value,
        }));
    }, [filteredSales]);

    // Top products - aggregate from real sales items
    const topProducts = useMemo(() => {
        const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

        filteredSales.forEach((sale) => {
            (sale.items || []).forEach((item: any) => {
                const productId = item.productId || item.product?.id;
                const productName = item.productName || item.product?.name || 'Produto';
                const quantity = item.quantity || 1;
                const revenue = Number(item.total) || (quantity * Number(item.unitPrice || item.price || 0));

                const existing = productMap.get(productId) || { name: productName, quantity: 0, revenue: 0 };
                existing.quantity += quantity;
                existing.revenue += revenue;
                productMap.set(productId, existing);
            });
        });

        return Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredSales]);

    // Unified Export Handler
    const handleExport = async (type: 'pdf' | 'excel') => {
        const periodLabel = periodOptions.find((p) => p.value === period)?.label || period;

        const columns = [
            { header: 'Data', key: 'date', width: 120 },
            { header: 'Recibo', key: 'receipt', width: 120 },
            { header: 'Cliente', key: 'customer', width: 150 },
            { header: 'Método', key: 'method', width: 100 },
            { header: 'Total', key: 'total', width: 100 }
        ];

        const data = filteredSales.map(sale => ({
            date: formatDate(sale.createdAt, 'dd/MM/yyyy HH:mm'),
            receipt: sale.receiptNumber,
            customer: sale.customer?.name || 'Cliente Balcão',
            method: sale.paymentMethod,
            total: formatCurrency(sale.total)
        }));

        await exportAPI.export({
            type,
            title: 'Relatório de Vendas',
            subtitle: `Período: ${periodLabel} | Total: ${formatCurrency(metrics.totalSales)}`,
            columns,
            data,
            filename: `Relatorio_Vendas_${periodLabel}`
        });
    };

    // Legacy PDF Generator (now using backend version)
    const generatePDF = () => handleExport('pdf');

    // Pagination for Top Products
    const {
        currentPage: topProductsPage,
        setCurrentPage: setTopProductsPage,
        itemsPerPage: topProductsPerPage,
        setItemsPerPage: setTopProductsPerPage,
        paginatedItems: paginatedTopProducts,
        totalItems: totalTopProducts,
    } = usePagination(topProducts, 5);

    // Pagination for Transaction History
    const {
        currentPage: transactionsPage,
        setCurrentPage: setTransactionsPage,
        itemsPerPage: transactionsPerPage,
        setItemsPerPage: setTransactionsPerPage,
        paginatedItems: paginatedTransactions,
        totalItems: totalTransactions,
    } = usePagination(filteredSales, 10);



    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Relatórios de Vendas
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Análise detalhada das vendas e desempenho
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ShareButton
                        title="Relatório de Vendas"
                        description={`Total: ${formatCurrency(metrics.totalSales)} | Transações: ${metrics.transactionCount} | IVA: ${formatCurrency(metrics.totalTax)}`}
                        fileName={`relatorio-vendas-${formatDate(new Date(), 'yyyy-MM-dd')}`}
                        companyName={companySettings?.companyName ?? 'Empresa'}
                        onGeneratePDF={generatePDF}
                    />
                    <ExportSalesButton data={filteredSales} />
                    <Button variant="outline" onClick={() => handleExport('excel')}>
                        <HiOutlineDownload className="w-5 h-5 mr-2" />
                        Gerar XLSX
                    </Button>
                    <Button onClick={() => handleExport('pdf')}>
                        <HiOutlineDocumentDownload className="w-5 h-5 mr-2" />
                        Exportar PDF Profissional
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Period Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</span>
                            <div className="flex flex-wrap gap-1">
                                {periodOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setPeriod(option.value)}
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${period === option.value
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {period === 'custom' && (
                            <div className="flex items-center gap-2 animate-fade-in">
                                <input
                                    type="date"
                                    value={startDateCustom}
                                    onChange={(e) => setStartDateCustom(e.target.value)}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                />
                                <span className="text-gray-500">até</span>
                                <input
                                    type="date"
                                    value={endDateCustom}
                                    onChange={(e) => setEndDateCustom(e.target.value)}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                />
                            </div>
                        )}
                    </div>

                    {/* Report Type Filter */}
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo:</span>
                        <div className="flex gap-1">
                            {reportTypes.map((type) => {
                                const Icon = type.icon;
                                return (
                                    <button
                                        key={type.value}
                                        onClick={() => setReportType(type.value)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${reportType === type.value
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{type.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                <Card padding="sm" className="bg-gradient-to-br from-primary-500 to-primary-600 text-white overflow-hidden">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] sm:text-xs text-white/80 uppercase font-bold tracking-wider">Recolha Total</p>
                            <HiOutlineCurrencyDollar className="w-4 h-4 text-white/40" />
                        </div>
                        <p className="text-lg sm:text-xl font-bold truncate">{formatCurrency(metrics.totalSales)}</p>
                    </div>
                </Card>

                <Card padding="sm" className="bg-gradient-to-br from-green-500 to-green-600 text-white overflow-hidden">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] sm:text-xs text-white/80 uppercase font-bold tracking-wider">Lucro Estimado</p>
                            <HiOutlineChartBar className="w-4 h-4 text-white/40" />
                        </div>
                        <div>
                            <p className="text-lg sm:text-xl font-bold truncate">{formatCurrency(metrics.profit)}</p>
                            <p className="text-[10px] text-white/70">{metrics.profitMargin.toFixed(1)}% margem</p>
                        </div>
                    </div>
                </Card>

                <Card padding="sm" className="bg-gradient-to-br from-amber-500 to-amber-600 text-white overflow-hidden">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] sm:text-xs text-white/80 uppercase font-bold tracking-wider">Transações</p>
                            <HiOutlineShoppingCart className="w-4 h-4 text-white/40" />
                        </div>
                        <p className="text-lg sm:text-xl font-bold truncate">{metrics.transactionCount}</p>
                    </div>
                </Card>

                <Card padding="sm" className="bg-gradient-to-br from-purple-500 to-purple-600 text-white overflow-hidden">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] sm:text-xs text-white/80 uppercase font-bold tracking-wider">Ticket Médio</p>
                            <HiOutlineChartBar className="w-4 h-4 text-white/40" />
                        </div>
                        <p className="text-lg sm:text-xl font-bold truncate">{formatCurrency(metrics.avgTicket)}</p>
                    </div>
                </Card>

                <Card padding="sm" className="bg-gray-800 text-white overflow-hidden">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] sm:text-xs text-white/80 uppercase font-bold tracking-wider">Valor Stock (C)</p>
                            <HiOutlineCube className="w-4 h-4 text-white/40" />
                        </div>
                        <p className="text-lg sm:text-xl font-bold truncate" title={formatCurrency(metrics.stockValuationCost)}>
                            {formatCurrency(metrics.stockValuationCost)}
                        </p>
                    </div>
                </Card>

                <Card padding="sm" className="bg-indigo-700 text-white overflow-hidden">
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] sm:text-xs text-white/80 uppercase font-bold tracking-wider">Valor Stock (V)</p>
                            <HiOutlineCube className="w-4 h-4 text-white/40" />
                        </div>
                        <p className="text-lg sm:text-xl font-bold truncate" title={formatCurrency(metrics.stockValuationRetail)}>
                            {formatCurrency(metrics.stockValuationRetail)}
                        </p>
                    </div>
                </Card>
            </div>


            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Trend Chart */}
                <Card padding="md">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Evolução de Vendas
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailySalesData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(value) => [formatCurrency(value as number), 'Total']}
                                    labelStyle={{ color: '#374151' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Payment Methods Chart */}
                <Card padding="md">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Métodos de Pagamento
                    </h3>
                    <div className="h-72 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={paymentMethodData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {paymentMethodData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Top Products Table */}
            <Card padding="md">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Produtos Mais Vendidos
                    </h3>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                        <HiOutlineRefresh className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-dark-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">#</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Produto</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Qtd.</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Receita</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTopProducts.map((product, index) => (
                                <tr key={index} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                    <td className="py-3 px-4 text-sm text-gray-500">{(topProductsPage - 1) * topProductsPerPage + index + 1}</td>
                                    <td className="py-3 px-4">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300">{product.quantity}</td>
                                    <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(product.revenue)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={topProductsPage}
                    totalItems={totalTopProducts}
                    itemsPerPage={topProductsPerPage}
                    onPageChange={setTopProductsPage}
                    onItemsPerPageChange={setTopProductsPerPage}
                    itemsPerPageOptions={[5, 10, 20]}
                    showInfo={false}
                    className="mt-4 border-t-0 py-0"
                />
            </Card>

            {/* Transaction History */}
            <Card padding="md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Últimas Transações
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-dark-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Recibo</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Data</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Pagamento</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">IVA</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTransactions.map((sale) => (
                                <tr key={sale.id} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                    <td className="py-3 px-4 text-sm font-mono text-primary-600 dark:text-primary-400">
                                        {sale.receiptNumber}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                        {formatDate(sale.createdAt, 'dd/MM/yyyy HH:mm')}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300">
                                            {sale.paymentMethod === 'cash' && 'Dinheiro'}
                                            {sale.paymentMethod === 'card' && 'Cartão'}
                                            {sale.paymentMethod === 'pix' && 'M-Pesa'}
                                            {sale.paymentMethod === 'transfer' && 'Transferência'}
                                            {sale.paymentMethod === 'credit' && 'Crédito'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300">
                                        {formatCurrency(sale.tax)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(sale.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={transactionsPage}
                    totalItems={totalTransactions}
                    itemsPerPage={transactionsPerPage}
                    onPageChange={setTransactionsPage}
                    onItemsPerPageChange={(size) => {
                        setTransactionsPerPage(size);
                        setTransactionsPage(1);
                    }}
                    itemsPerPageOptions={[5, 10, 20, 50, 100]}
                />
            </Card>
        </div>
    );
}
