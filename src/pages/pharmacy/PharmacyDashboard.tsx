import { logger } from '../../utils/logger';
﻿/**
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
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineArrowRight,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineCalendar,
    HiOutlineCube,
} from 'react-icons/hi2';
import { Card, Button, Badge, LoadingSpinner, PageHeader } from '../../components/ui';
import { formatCurrency, formatRelativeTime, cn } from '../../utils/helpers';
import { pharmacyAPI } from '../../services/api';
import { alertsAPI } from '../../services/api';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { MetricCard, StatCard, CHART_COLORS } from '../../components/common/ModuleMetricCard';
import { ModulePeriodFilter } from '../../components/common/ModulePeriodFilter';
import type { TimePeriod } from '../../components/common/ModulePeriodFilter';
import { WeeklySalesWidget, RecentActivityWidget } from '../../components/dashboard/DashboardWidgets';
import { HiOutlineLightBulb } from 'react-icons/hi';

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
    const { insights } = useSmartInsights();

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
            logger.error('Error fetching dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [selectedPeriod]);

    // Auto-generate pharmacy alerts (expiry, low stock) on first load
    useEffect(() => {
        alertsAPI.generateForModule('pharmacy').catch(() => { /* silent */ });
    }, []);

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
            <PageHeader 
                title="Dashboard Farmácia"
                subtitle="Visão geral de vendas, stock e métricas farmacêuticas"
                icon={<HiOutlineBeaker />}
                actions={
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchDashboard}
                            className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                        >
                            Actualizar
                        </Button>
                        <ModulePeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
                        <Link to="/pharmacy/reports">
                            <Button variant="outline" size="sm" className="font-black text-[10px] uppercase tracking-widest">
                                Relatórios
                            </Button>
                        </Link>
                        <Link to="/pharmacy/manage">
                            <Button size="sm" className="font-black text-[10px] uppercase tracking-widest" leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                                Nova Venda
                            </Button>
                        </Link>
                    </>
                }
            />

            {/* Smart Insights / Intelligent Advisor */}
            {insights.length > 0 && (
                <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conselheiro Inteligente</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Alertas de validade e reposição farmacêutica</p>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                        {insights.map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />
                        ))}
                    </div>
                </div>
            )}

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                    color="teal"
                    value={formatCurrency(metrics.totalSales)}
                    label="Vendas Mensais"
                    growth={metrics.salesGrowth}
                />
                <MetricCard
                    icon={<HiOutlineShoppingCart className="w-6 h-6" />}
                    color="secondary"
                    value={metrics.ordersToday}
                    label="Vendas Hoje"
                    badge={<Badge variant="success">Hoje</Badge>}
                />
                <MetricCard
                    icon={<HiOutlineCube className="w-6 h-6" />}
                    color="yellow"
                    value={`${metrics.lowStock}/${metrics.totalMedications}`}
                    label="Stock Baixo"
                    badge={<Badge variant={metrics.lowStock > 5 ? 'danger' : 'warning'}>Atenção</Badge>}
                />
                <MetricCard
                    icon={<HiOutlineCalendar className="w-6 h-6" />}
                    color="red"
                    value={metrics.expiring}
                    label="A Expirar"
                    badge={<Badge variant="danger">90 dias</Badge>}
                />
            </div>

            {/* Profit Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
                    color="green"
                    value={formatCurrency(metrics.grossProfit)}
                    label="Lucro Bruto"
                    sublabel={`Margem: ${metrics.profitMargin.toFixed(1)}%`}
                />
                <StatCard
                    icon={<HiOutlineBeaker className="w-6 h-6" />}
                    color="purple"
                    value={metrics.totalMedications}
                    label="Total Medicamentos"
                    sublabel="Produtos cadastrados"
                />
                <StatCard
                    icon={<HiOutlineExclamationCircle className="w-6 h-6" />}
                    color="cyan"
                    value={metrics.pendingPrescriptions}
                    label="Receitas Pendentes"
                    sublabel="Aguardando processamento"
                />
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
                        <ResponsiveContainer width="100%" height={288}>
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
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
                                    stroke="#0d9488"
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
                        <ResponsiveContainer width="100%" height={256}>
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
                <WeeklySalesWidget weeklyData={weeklyData} />

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
                        to="/pharmacy/manage"
                        className="block mt-4 text-center text-sm text-teal-600 dark:text-teal-400 hover:underline"
                    >
                        Ver Stock Completo
                    </Link>
                </Card>

                <RecentActivityWidget recentActivities={recentActivities} />
            </div>

            {/* Quick Actions */}
            <Card padding="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Acções Rápidas
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link to="/pharmacy/pos">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-teal-500 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-all group">
                            <HiOutlineShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-teal-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-teal-600">
                                Nova Venda
                            </p>
                        </button>
                    </Link>
                    <Link to="/pharmacy/manage">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineBeaker className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Medicamentos
                            </p>
                        </button>
                    </Link>
                    <Link to="/pharmacy/reconciliation">
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
