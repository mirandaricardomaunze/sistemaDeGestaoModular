import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import {
    HiOutlineCurrencyDollar,
    HiOutlineShoppingCart,
    HiOutlineCube,
    HiOutlineUsers,
    HiOutlineExclamationCircle,
    HiOutlineTrendingUp,
    HiOutlineTrendingDown,
    HiOutlineArrowRight,
    HiOutlinePlus,
    HiOutlineRefresh,
} from 'react-icons/hi';
import { Card, Button, Badge, LoadingSpinner } from '../components/ui';
import { formatCurrency, formatRelativeTime, cn } from '../utils/helpers';
import { categoryLabels } from '../utils/constants';
import { useDashboard, useProducts, useAlerts, useEmployees, useCategories } from '../hooks/useData';


// Chart colors
const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Time period options
type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

// Day name mapping for weekly chart
const dayNames: Record<string, string> = {
    '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sab'
};

export default function Dashboard() {
    const { t } = useTranslation();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');

    // Fetch data from API
    const { stats, salesChart, weeklyChart, recentActivity, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useDashboard();
    const { products, isLoading: isLoadingProducts } = useProducts();
    const { alerts, isLoading: isLoadingAlerts } = useAlerts();
    const { employees, isLoading: isLoadingEmployees } = useEmployees();
    const { categories, isLoading: isLoadingCategories } = useCategories();

    const isLoading = isLoadingDashboard || isLoadingProducts || isLoadingAlerts || isLoadingEmployees || isLoadingCategories;


    // Transform sales chart data for the graph
    const salesData = useMemo(() => {
        return salesChart.map(item => ({
            name: item.date.slice(-5), // Show MM-DD
            vendas: item.value,
            meta: 0 // Meta can be set from settings if needed
        }));
    }, [salesChart]);

    // Transform weekly chart data for the bar graph
    const weeklyData = useMemo(() => {
        return weeklyChart.map(item => {
            const date = new Date(item.date);
            const dayName = dayNames[date.getDay().toString()] || item.date;
            return {
                name: dayName,
                valor: item.value
            };
        });
    }, [weeklyChart]);

    // Calculate metrics
    const metrics = useMemo(() => {
        const totalSales = stats?.totalRevenue || 0;
        const lowStockCount = products.filter((p) => p.currentStock <= p.minStock).length;
        const activeEmployees = employees.filter((e) => e.isActive).length;
        const pendingAlerts = alerts.filter((a) => !a.isResolved).length;

        // Calculate profit from products
        const stockSaleValue = products.reduce((sum, p) => sum + p.price * p.currentStock, 0);
        const stockCostValue = products.reduce((sum, p) => sum + p.costPrice * p.currentStock, 0);
        const potentialProfit = stockSaleValue - stockCostValue;

        return {
            totalSales: totalSales,
            salesGrowth: stats?.monthlyGrowth || 0,
            ordersToday: stats?.todaySales || 0,
            ordersGrowth: 0,
            lowStock: lowStockCount,
            totalProducts: products.length,
            employees: activeEmployees,
            pendingAlerts,
            grossProfit: stats?.totalProfit || 0,
            profitMargin: stats?.totalRevenue ? (stats.totalProfit / stats.totalRevenue * 100) : 0,
            stockCostValue: stockCostValue,
            stockSaleValue: stockSaleValue,
            potentialProfit: potentialProfit,
        };
    }, [products, alerts, employees, selectedPeriod, stats]);

    // Category distribution for pie chart - using categories from API with productCount
    const categoryData = useMemo(() => {
        if (categories.length === 0) {
            // Fallback to products if categories not loaded
            const counts: Record<string, number> = {};
            products.forEach((p) => {
                counts[p.category] = (counts[p.category] || 0) + 1;
            });
            return Object.entries(counts).map(([category, value]) => ({
                name: categoryLabels[category] || category,
                value,
            }));
        }
        // Use categories with productCount from API
        return categories
            .filter(c => (c.productCount || 0) > 0)
            .map(c => ({
                name: c.name,
                value: c.productCount || 0,
            }))
            .sort((a, b) => b.value - a.value);
    }, [categories, products]);

    // Recent alerts
    const recentAlerts = alerts.filter((a) => !a.isResolved).slice(0, 5);

    // Recent activities from API
    const recentActivities = useMemo(() => {
        if (!recentActivity) return [];

        const activities: Array<{ id: string; action: string; detail: string; time: string; icon: string }> = [];

        // Add recent sales
        recentActivity.recentSales?.forEach((sale: any) => {
            activities.push({
                id: `sale-${sale.id}`,
                action: 'Venda realizada',
                detail: `Pedido #${sale.saleNumber || sale.id.slice(-6)} - ${formatCurrency(Number(sale.total))}`,
                time: formatRelativeTime(sale.createdAt),
                icon: '💰'
            });
        });

        // Add recent invoices
        recentActivity.recentInvoices?.forEach((invoice: any) => {
            activities.push({
                id: `invoice-${invoice.id}`,
                action: 'Fatura emitida',
                detail: `Fatura #${invoice.invoiceNumber} - ${invoice.customerName}`,
                time: formatRelativeTime(invoice.createdAt),
                icon: '📄'
            });
        });

        // Sort by time (most recent first) and take first 5
        return activities
            .sort((a, b) => b.time.localeCompare(a.time))
            .slice(0, 5);
    }, [recentActivity]);

    if (isLoading) {
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
                        {t('dashboard.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {t('dashboard.overview')}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {/* Refresh Button */}
                    <Button
                        variant="ghost"
                        onClick={() => refetchDashboard()}
                        leftIcon={<HiOutlineRefresh className="w-5 h-5" />}
                    >
                        {t('common.refresh')}
                    </Button>
                    {/* Period Filter */}
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
                    <Link to="/reports">
                        <Button variant="outline">
                            {t('common.report')}
                        </Button>
                    </Link>
                    <Link to="/pos">
                        <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                            {t('dashboard.newSale')}
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Sales */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-primary-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <HiOutlineCurrencyDollar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className={cn(
                                'flex items-center gap-1 text-sm font-medium',
                                metrics.salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                                {metrics.salesGrowth >= 0 ? (
                                    <HiOutlineTrendingUp className="w-4 h-4" />
                                ) : (
                                    <HiOutlineTrendingDown className="w-4 h-4" />
                                )}
                                {Math.abs(metrics.salesGrowth)}%
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(metrics.totalSales)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('dashboard.monthlySales')}
                        </p>
                    </div>
                </Card>

                {/* Orders Today */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-secondary-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
                                <HiOutlineShoppingCart className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                            </div>
                            <div className={cn(
                                'flex items-center gap-1 text-sm font-medium',
                                metrics.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                                {metrics.ordersGrowth >= 0 ? (
                                    <HiOutlineTrendingUp className="w-4 h-4" />
                                ) : (
                                    <HiOutlineTrendingDown className="w-4 h-4" />
                                )}
                                {Math.abs(metrics.ordersGrowth)}%
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.ordersToday}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('dashboard.ordersToday')}
                        </p>
                    </div>
                </Card>

                {/* Low Stock */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-yellow-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <HiOutlineCube className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <Badge variant={metrics.lowStock > 5 ? 'danger' : 'warning'}>
                                {t('common.attention')}
                            </Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.lowStock}/{metrics.totalProducts}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('dashboard.productsLow')}
                        </p>
                    </div>
                </Card>

                {/* Active Employees */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-accent-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                                <HiOutlineUsers className="w-6 h-6 text-accent-600 dark:text-accent-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.employees}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('dashboard.activeEmployees')}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Profit Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gross Profit */}
                <Card padding="md" className="border-l-4 border-l-green-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <HiOutlineTrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.grossProfit')}</p>
                            <p className="text-2xl font-bold text-green-600">
                                {formatCurrency(metrics.grossProfit)}
                            </p>
                            <p className="text-xs text-gray-400">
                                {t('dashboard.profitMargin')}: {metrics.profitMargin.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Stock Cost Value */}
                <Card padding="md" className="border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <HiOutlineCube className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.stockCost')}</p>
                            <p className="text-xl font-bold text-blue-600">
                                {formatCurrency(metrics.stockCostValue)}
                            </p>
                            <p className="text-xs text-gray-400">
                                {t('dashboard.purchaseValue')}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Potential Profit */}
                <Card padding="md" className="border-l-4 border-l-purple-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.potentialProfit')}</p>
                            <p className="text-xl font-bold text-purple-600">
                                {formatCurrency(metrics.potentialProfit)}
                            </p>
                            <p className="text-xs text-gray-400">
                                {t('dashboard.sellAllStock')}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <Card padding="md" className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('dashboard.salesVsTarget')}
                        </h2>
                        <Link to="/reports">
                            <Button variant="ghost" size="sm">
                                {t('common.viewMore')}
                                <HiOutlineArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-dark-700" />
                                <XAxis dataKey="name" className="text-sm" stroke="#94a3b8" />
                                <YAxis className="text-sm" stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--tooltip-bg, #fff)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                    }}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="vendas"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fill="url(#colorVendas)"
                                    name="Vendas"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="meta"
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Meta"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Category Distribution */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        {t('dashboard.productsByCategory')}
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {categoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {categoryData.slice(0, 4).map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: CHART_COLORS[index] }}
                                    />
                                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="text-xs font-medium text-gray-900 dark:text-white flex-shrink-0">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Sales */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        {t('dashboard.weeklySales')}
                    </h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-dark-700" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    }}
                                />
                                <Bar dataKey="valor" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Pending Alerts */}
                <Card padding="md">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('dashboard.pendingAlerts')}
                        </h2>
                        <Link to="/alerts">
                            <Badge variant="danger">{metrics.pendingAlerts}</Badge>
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {recentAlerts.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                {t('dashboard.noPendingAlerts')}
                            </p>
                        ) : (
                            recentAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl"
                                >
                                    <div className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                        alert.priority === 'critical'
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                            : alert.priority === 'high'
                                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
                                    )}>
                                        <HiOutlineExclamationCircle className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {alert.title}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatRelativeTime(alert.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <Link
                        to="/alerts"
                        className="block mt-4 text-center text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        {t('dashboard.viewAllAlerts')}
                    </Link>
                </Card>

                {/* Recent Activity */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {t('dashboard.recentActivity')}
                    </h2>
                    <div className="space-y-4">
                        {recentActivities.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                                {t('dashboard.noRecentActivity')}
                            </p>
                        ) : recentActivities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm">{activity.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {activity.action}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {activity.detail}
                                    </p>
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                    {activity.time}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card padding="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('dashboard.quickActions')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link to="/pos">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                {t('sales.newSale')}
                            </p>
                        </button>
                    </Link>
                    <Link to="/inventory">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineCube className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                {t('dashboard.newProduct')}
                            </p>
                        </button>
                    </Link>
                    <Link to="/employees">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineUsers className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                {t('nav.employees')}
                            </p>
                        </button>
                    </Link>
                    <Link to="/reports">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineCurrencyDollar className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                {t('nav.reports')}
                            </p>
                        </button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
