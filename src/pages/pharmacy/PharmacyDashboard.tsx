/**
 * Pharmacy Dashboard
 * 
 * Professional dashboard for pharmacy module with:
 * - Period filters (1m, 3m, 6m, 1y)
 * - Key metrics with growth indicators
 * - Sales charts (area, bar, pie)
 * - Recent alerts and activities
 * - Quick actions
 * 
 * Follows the same design patterns as the commercial dashboard
 * for consistency across modules.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
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
    HiOutlineBeaker,
    HiOutlineExclamationCircle,
    HiOutlineTrendingUp,
    HiOutlineTrendingDown,
    HiOutlineArrowRight,
    HiOutlinePlus,
    HiOutlineRefresh,
    HiOutlineCalendar,
    HiOutlineCube,
} from 'react-icons/hi';
import { Card, Button, Badge, LoadingSpinner } from '../../components/ui';
import { formatCurrency, formatRelativeTime, cn } from '../../utils/helpers';
import { pharmacyAPI } from '../../services/api';

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

interface DashboardSummary {
    todaySales: { total: number; count: number };
    monthSales: number;
    lowStockCount: number;
    expiringCount: number;
    totalMedications: number;
    pendingPrescriptions: number;
    monthlyGrowth?: number;
    totalProfit?: number;
    profitMargin?: number;
}

export default function PharmacyDashboard() {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [salesChart, setSalesChart] = useState<any[]>([]);
    const [weeklyChart, setWeeklyChart] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [recentSales, setRecentSales] = useState<any[]>([]);

    const fetchDashboard = async () => {
        try {
            setIsLoading(true);
            const [summaryData, chartData, weeklyData, topData, salesData] = await Promise.all([
                pharmacyAPI.getDashboardSummary(),
                pharmacyAPI.getSalesChart(selectedPeriod === '1m' ? '30days' : selectedPeriod === '3m' ? '90days' : selectedPeriod === '6m' ? '180days' : '365days'),
                pharmacyAPI.getSalesChart('7days'),
                pharmacyAPI.getTopProducts(6),
                pharmacyAPI.getSales({ limit: 5 })
            ]);
            setSummary(summaryData);
            setSalesChart(chartData);
            setWeeklyChart(weeklyData);
            setTopProducts(topData);
            setRecentSales(salesData?.items || []);
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [selectedPeriod]);

    // Transform sales chart data
    const salesData = useMemo(() => {
        return salesChart.map(item => ({
            name: item.date.slice(-5), // Show MM-DD
            vendas: item.total,
            meta: 0
        }));
    }, [salesChart]);

    // Transform weekly chart data
    const weeklyData = useMemo(() => {
        return weeklyChart.map(item => {
            const date = new Date(item.date);
            const dayName = dayNames[date.getDay().toString()] || item.date;
            return {
                name: dayName,
                valor: item.total
            };
        });
    }, [weeklyChart]);

    // Category data for pie chart
    const categoryData = useMemo(() => {
        if (topProducts.length === 0) return [];
        return topProducts.map((product) => ({
            name: product.name,
            value: product.quantity || product.totalSold || 1
        }));
    }, [topProducts]);

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!summary) return null;
        return {
            totalSales: summary.monthSales || 0,
            salesGrowth: summary.monthlyGrowth || 0,
            ordersToday: summary.todaySales?.count || 0,
            ordersValue: summary.todaySales?.total || 0,
            lowStock: summary.lowStockCount || 0,
            totalMedications: summary.totalMedications || 0,
            expiring: summary.expiringCount || 0,
            pendingPrescriptions: summary.pendingPrescriptions || 0,
            grossProfit: summary.totalProfit || 0,
            profitMargin: summary.profitMargin || 0,
        };
    }, [summary]);

    // Recent activities
    const recentActivities = useMemo(() => {
        return recentSales.slice(0, 5).map((sale: any) => ({
            id: sale.id,
            action: 'Venda realizada',
            detail: `Venda #${sale.id.slice(-6)} - ${formatCurrency(Number(sale.total))}`,
            time: formatRelativeTime(sale.createdAt),
            icon: '💰'
        }));
    }, [recentSales]);

    if (isLoading || !metrics) {
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
                        Dashboard - Farmácia
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Visão geral de vendas, stock e métricas farmacêuticas
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {/* Refresh Button */}
                    <Button
                        variant="ghost"
                        onClick={fetchDashboard}
                        leftIcon={<HiOutlineRefresh className="w-5 h-5" />}
                    >
                        Actualizar
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
                    <Link to="/pharmacy/reports">
                        <Button variant="outline">
                            Relatórios
                        </Button>
                    </Link>
                    <Link to="/pharmacy">
                        <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                            Nova Venda
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
                            Vendas Mensais
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
                            <Badge variant="success">Hoje</Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.ordersToday}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Vendas Hoje
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
                                Atenção
                            </Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.lowStock}/{metrics.totalMedications}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Stock Baixo
                        </p>
                    </div>
                </Card>

                {/* Expiring Soon */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-red-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <HiOutlineCalendar className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <Badge variant="danger">90 dias</Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.expiring}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            A Expirar
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
                            <p className="text-sm text-gray-500 dark:text-gray-400">Lucro Bruto</p>
                            <p className="text-2xl font-bold text-green-600">
                                {formatCurrency(metrics.grossProfit)}
                            </p>
                            <p className="text-xs text-gray-400">
                                Margem: {metrics.profitMargin.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Total Medications */}
                <Card padding="md" className="border-l-4 border-l-purple-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <HiOutlineBeaker className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Medicamentos</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {metrics.totalMedications}
                            </p>
                            <p className="text-xs text-gray-400">
                                Produtos cadastrados
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Pending Prescriptions */}
                <Card padding="md" className="border-l-4 border-l-cyan-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                            <HiOutlineExclamationCircle className="w-6 h-6 text-cyan-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receitas Pendentes</p>
                            <p className="text-2xl font-bold text-cyan-600">
                                {metrics.pendingPrescriptions}
                            </p>
                            <p className="text-xs text-gray-400">
                                Aguardando processamento
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <Card padding="md" className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Vendas por Período
                        </h2>
                        <Link to="/pharmacy/reports">
                            <Button variant="ghost" size="sm">
                                Ver Mais
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
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Top Products */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        Mais Vendidos
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
                        Vendas Semanais
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

                {/* Stock Alerts */}
                <Card padding="md">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Alertas de Stock
                        </h2>
                        <Badge variant="danger">{metrics.lowStock + metrics.expiring}</Badge>
                    </div>
                    <div className="space-y-3">
                        {metrics.lowStock > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600">
                                    <HiOutlineExclamationCircle className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        Stock Baixo
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {metrics.lowStock} medicamentos abaixo do mínimo
                                    </p>
                                </div>
                            </div>
                        )}
                        {metrics.expiring > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-100 dark:bg-red-900/30 text-red-600">
                                    <HiOutlineExclamationCircle className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        Próximo da Validade
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {metrics.expiring} medicamentos expiram em 90 dias
                                    </p>
                                </div>
                            </div>
                        )}
                        {metrics.lowStock === 0 && metrics.expiring === 0 && (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                Nenhum alerta pendente
                            </p>
                        )}
                    </div>
                    <Link
                        to="/pharmacy"
                        className="block mt-4 text-center text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        Ver Stock Completo
                    </Link>
                </Card>

                {/* Recent Activity */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Actividade Recente
                    </h2>
                    <div className="space-y-4">
                        {recentActivities.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                                Nenhuma actividade recente
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
                    Acções Rápidas
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link to="/pharmacy">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Nova Venda
                            </p>
                        </button>
                    </Link>
                    <Link to="/pharmacy">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineBeaker className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Medicamentos
                            </p>
                        </button>
                    </Link>
                    <Link to="/pharmacy/employees">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineCube className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Stock
                            </p>
                        </button>
                    </Link>
                    <Link to="/pharmacy/reports">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineCurrencyDollar className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Relatórios
                            </p>
                        </button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
