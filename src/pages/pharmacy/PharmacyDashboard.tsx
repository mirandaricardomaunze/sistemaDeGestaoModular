import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    AreaChart,
    Area,
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
    HiOutlineArrowRight,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineCalendar,
    HiOutlineCube,
    HiOutlineLightBulb,
} from 'react-icons/hi2';

import { Card, Button, Badge, PageHeader, Skeleton } from '../../components/ui';
import { formatCurrency, formatRelativeTime } from '../../utils/helpers';
import { 
    usePharmacyDashboard, 
    usePharmacySalesChart, 
    usePharmacySales 
} from '../../hooks/usePharmacy';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { MetricCard, StatCard, CHART_COLORS } from '../../components/common/ModuleMetricCard';
import { ModulePeriodFilter } from '../../components/common/ModulePeriodFilter';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import type { TimePeriod } from '../../components/common/ModulePeriodFilter';
import { WeeklySalesWidget, RecentActivityWidget } from '../../components/dashboard/DashboardWidgets';
import { alertsAPI } from '../../services/api';

// Day name mapping for weekly chart
const dayNames: Record<string, string> = {
    '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sab'
};

export default function PharmacyDashboard() {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const { insights } = useSmartInsights();

    // TanStack Query Hooks
    const { 
        data: summary, 
        isLoading: isLoadingSummary, 
        refetch: refetchSummary,
        isRefetching: isRefetchingSummary 
    } = usePharmacyDashboard();

    const chartDays = selectedPeriod === '1m' ? '30days' : selectedPeriod === '3m' ? '90days' : selectedPeriod === '6m' ? '180days' : '365days';
    const { data: salesChart = [], isLoading: isLoadingChart } = usePharmacySalesChart(chartDays);
    const { data: weeklyChart = [], isLoading: isLoadingWeekly } = usePharmacySalesChart('7days');
    const { data: recentSales = [], isLoading: isLoadingSales } = usePharmacySales({ limit: 5 });

    const isLoading = isLoadingSummary || isLoadingChart || isLoadingWeekly || isLoadingSales;
    const isRefreshing = isRefetchingSummary;

    // Auto-generate pharmacy alerts on first load
    useEffect(() => {
        alertsAPI.generateForModule('pharmacy').catch(() => { /* silent */ });
    }, []);

    const handleRefresh = () => {
        refetchSummary();
    };

    // Transform sales chart data
    const salesData = useMemo(() => {
        const data = Array.isArray(salesChart) ? salesChart : (salesChart as any)?.data || [];
        return data.map((item: any) => ({
            name: item.date.slice(-5), // Show MM-DD
            vendas: item.total,
        }));
    }, [salesChart]);

    // Transform weekly chart data
    const weeklySalesData = useMemo(() => {
        const data = Array.isArray(weeklyChart) ? weeklyChart : (weeklyChart as any)?.data || [];
        return data.map((item: any) => {
            const date = new Date(item.date);
            const dayName = dayNames[date.getDay().toString()] || item.date;
            return {
                name: dayName,
                valor: item.total
            };
        });
    }, [weeklyChart]);

    // Top products for pie chart (extracted from summary)
    const categoryData = useMemo(() => {
        if (!summary?.topMedications) return [];
        return summary.topMedications.map(item => ({
            name: item.name,
            value: item.quantity
        }));
    }, [summary]);

    // Recent activities from recent sales
    const recentActivities = useMemo(() => {
        const sales = Array.isArray(recentSales) ? recentSales : (recentSales as any)?.data || [];
        return sales.map((sale: any) => ({
            id: sale.id,
            action: 'Venda realizada',
            detail: `Venda #${sale.id.slice(-6)} - ${formatCurrency(Number(sale.total))}`,
            time: formatRelativeTime(sale.createdAt),
            icon: '💊'
        }));
    }, [recentSales]);

    if (isLoading && !summary) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-20 bg-gray-200 dark:bg-dark-700 rounded-xl mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 dark:bg-dark-700 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-80 bg-gray-200 dark:bg-dark-700 rounded-xl" />
                    <div className="h-80 bg-gray-200 dark:bg-dark-700 rounded-xl" />
                </div>
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
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-teal-600"
                            leftIcon={<HiOutlineArrowPath className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />}
                        >
                            {isRefreshing ? 'A actualizar...' : 'Actualizar'}
                        </Button>
                        <ModulePeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
                        <Link to="/pharmacy/reports">
                            <Button variant="outline" size="sm" className="font-black text-[10px] uppercase tracking-widest">
                                Relatórios
                            </Button>
                        </Link>
                        <Link to="/pharmacy/pos">
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
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200/50 dark:border-amber-500/25 flex items-center justify-center backdrop-blur-sm shadow-sm transition-all duration-300">
                            <HiOutlineLightBulb className="w-6 h-6 text-amber-600 dark:text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Conselheiro Inteligente</h2>
                            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Alertas de validade e reposição farmacêutica</p>
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
                    value={formatCurrency(summary?.totalSales || 0)}
                    label="Vendas Mensais"
                />
                <MetricCard
                    icon={<HiOutlineShoppingCart className="w-6 h-6" />}
                    color="secondary"
                    value={summary?.salesCount || 0}
                    label="Vendas Hoje"
                    badge={<Badge variant="success">Hoje</Badge>}
                />
                <MetricCard
                    icon={<HiOutlineCube className="w-6 h-6" />}
                    color="yellow"
                    value={summary?.lowStockItems || 0}
                    label="Stock Baixo"
                    badge={<Badge variant={(summary?.lowStockItems || 0) > 5 ? 'danger' : 'warning'}>Atenção</Badge>}
                />
                <MetricCard
                    icon={<HiOutlineCalendar className="w-6 h-6" />}
                    color="red"
                    value={summary?.expiringSoonBatches || 0}
                    label="A Expirar"
                    badge={<Badge variant="danger">90 dias</Badge>}
                />
            </div>

            {/* Profit Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
                    color="green"
                    value={formatCurrency(summary?.avgSaleAmount || 0)}
                    label="Valor Médio Venda"
                />
                <StatCard
                    icon={<HiOutlineBeaker className="w-6 h-6" />}
                    color="purple"
                    value={summary?.totalPrescriptions || 0}
                    label="Receitas"
                    sublabel="Processadas no período"
                />
                <StatCard
                    icon={<HiOutlineExclamationCircle className="w-6 h-6" />}
                    color="cyan"
                    value={summary?.expiredBatches || 0}
                    label="Lotes Expirados"
                    sublabel="Necessário descarte"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <Card padding="md" color="slate" className="lg:col-span-2">
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
                        {isLoadingChart ? <Skeleton className="w-full h-full rounded-lg" /> : (
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
                        )}
                    </div>
                </Card>

                {/* Top Products */}
                <Card padding="md" color="slate">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        Mais Vendidos
                    </h2>
                    <div className="h-64">
                        {isLoadingSummary ? <Skeleton className="w-full h-full rounded-lg" /> : (
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
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {categoryData.slice(0, 4).map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
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
                <WeeklySalesWidget weeklyData={weeklySalesData} />

                {/* Stock Alerts */}
                <Card padding="md" color="slate">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Alertas de Stock
                        </h2>
                        <Badge variant="danger">{(summary?.lowStockItems || 0) + (summary?.expiringSoonBatches || 0)}</Badge>
                    </div>
                    <div className="space-y-3">
                        {(summary?.lowStockItems || 0) > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-amber-100/40 dark:bg-amber-500/10 rounded-xl border border-amber-200/50 dark:border-amber-500/20">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-200/60 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 shadow-inner">
                                    <HiOutlineExclamationCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-amber-900 dark:text-amber-400 uppercase tracking-tight">
                                        Stock Baixo
                                    </p>
                                    <p className="text-[10px] font-bold text-amber-800/70 dark:text-amber-400/60 uppercase">
                                        {summary?.lowStockItems} medicamentos abaixo do mínimo
                                    </p>
                                </div>
                            </div>
                        )}
                        {(summary?.expiringSoonBatches || 0) > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-red-100/40 dark:bg-red-500/10 rounded-xl border border-red-200/50 dark:border-red-500/20">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-200/60 text-red-700 dark:bg-red-500/20 dark:text-red-300 shadow-inner">
                                    <HiOutlineExclamationCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-red-900 dark:text-red-400 uppercase tracking-tight">
                                        Próximo da Validade
                                    </p>
                                    <p className="text-[10px] font-bold text-red-800/70 dark:text-red-400/60 uppercase">
                                        {summary?.expiringSoonBatches} medicamentos expiram em 90 dias
                                    </p>
                                </div>
                            </div>
                        )}
                        {(summary?.lowStockItems || 0) === 0 && (summary?.expiringSoonBatches || 0) === 0 && (
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
                    <QuickActionCard
                        icon={HiOutlineShoppingCart}
                        label="Nova Venda"
                        description="Iniciar transação no POS"
                        path="/pharmacy/pos"
                        color="teal"
                    />
                    <QuickActionCard
                        icon={HiOutlineBeaker}
                        label="Medicamentos"
                        description="Gestão de catálogo"
                        path="/pharmacy/manage"
                        color="primary"
                    />
                    <QuickActionCard
                        icon={HiOutlineCube}
                        label="Stock"
                        description="Reconciliação e inventário"
                        path="/pharmacy/reconciliation"
                        color="indigo"
                    />
                    <QuickActionCard
                        icon={HiOutlineCurrencyDollar}
                        label="Relatórios"
                        description="Análise de vendas"
                        path="/pharmacy/reports"
                        color="purple"
                    />
                </div>
            </Card>
        </div>
    );
}
