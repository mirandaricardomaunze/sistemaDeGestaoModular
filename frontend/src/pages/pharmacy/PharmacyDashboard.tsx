import { useState, useMemo, useEffect, type ReactNode } from 'react';
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

import { Card, Button, Badge, Skeleton, LoadingOverlay, PageHeader } from '../../components/ui';
import { formatCurrency, formatRelativeTime, cn } from '../../utils/helpers';
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

type ChartTooltipItem = {
    color?: string;
    fill?: string;
    name?: ReactNode;
    value?: unknown;
};

type GlassmorphicTooltipProps = {
    active?: boolean;
    payload?: ChartTooltipItem[];
    label?: ReactNode;
    formatter?: (value: unknown) => ReactNode;
};

type ChartLegendItem = {
    color?: string;
    value?: ReactNode;
};

const GlassmorphicTooltip = ({ active, payload, label, formatter }: GlassmorphicTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="backdrop-blur-md bg-white/95 dark:bg-dark-900/95 border border-slate-200/90 dark:border-white/10 p-3 rounded-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] z-50">
                {label && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>}
                {payload.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                            {item.name}:
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                            {formatter ? formatter(item.value) : String(item.value ?? '')}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const CustomLegend = ({ payload }: { payload?: ChartLegendItem[] }) => {
    return (
        <div className="flex items-center justify-end gap-4 mt-2">
            {payload?.map((entry, index) => (
                <div key={`item-${index}`} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-400">
                        {entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
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
        return (salesChart || []).map((item) => ({
            name: item.date.slice(-5), // Show MM-DD
            vendas: item.total,
        }));
    }, [salesChart]);

    // Transform weekly chart data
    const weeklySalesData = useMemo(() => {
        return (weeklyChart || []).map((item) => {
            const date = new Date(item.date);
            const dayName = dayNames[date.getDay().toString()] || item.date;
            return {
                name: dayName,
                valor: Number(item.total ?? 0)
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
        const sales = Array.isArray(recentSales) ? recentSales : (recentSales?.data || []);
        return sales.map((sale) => ({
            id: sale.id,
            action: 'Venda realizada',
            detail: `Venda #${sale.id.slice(-6)} - ${formatCurrency(Number(sale.total))}`,
            time: formatRelativeTime(sale.createdAt),
            icon: '💊'
        }));
    }, [recentSales]);

    if (isLoading && !summary) {
        return (
            <div className="space-y-6 animate-fade-in relative min-h-screen">
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
        <div className="space-y-6 pb-12 relative min-h-screen">
            <PageHeader
                title="Dashboard Farmácia"
                subtitle="Gestão Inteligente de Medicamentos e Vendas"
                icon={<HiOutlineBeaker />}
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center bg-slate-100 dark:bg-dark-800 rounded-xl p-1 border border-slate-200 dark:border-white/5 shadow-inner h-10">
                            <ModulePeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="h-10 px-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-teal-600 transition-all"
                            leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4 text-teal-600", isRefreshing && "animate-spin")} />}
                        >
                            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
                        </Button>

                        <Link to="/pharmacy/pos">
                            <Button 
                                size="sm" 
                                variant="primary"
                                className="h-10 px-6 bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest border-none" 
                                leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                            >
                                Nova Venda
                            </Button>
                        </Link>
                    </div>
                }
            />

            {/* Premium Loading Overlay for Background Refresh */}
            {isRefreshing && (
                <LoadingOverlay 
                    fullScreen={false} 
                    message="A atualizar dados da farmácia..." 
                    subtext="Inteligência Multicore em Acção"
                />
            )}

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
                    color="indigo"
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
                <Card padding="md" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            Vendas por Período
                        </h2>
                        <Link to="/pharmacy/reports">
                            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">
                                Ver Mais
                                <HiOutlineArrowRight className="w-3.5 h-3.5 ml-1.5 inline" />
                            </Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        {isLoadingChart ? <Skeleton className="w-full h-full rounded-lg" /> : (
                            <ResponsiveContainer width="100%" height={288}>
                                <AreaChart data={salesData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200/50 dark:stroke-white/5" />
                                    <XAxis tickLine={false} axisLine={false} dataKey="name" className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500" stroke="currentColor" />
                                    <YAxis tickLine={false} axisLine={false} className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500" stroke="currentColor" tickFormatter={(val) => formatCurrency(val).replace(',00', '')} />
                                    <Tooltip content={<GlassmorphicTooltip formatter={(v) => formatCurrency(Number(v))} />} />
                                    <Legend content={<CustomLegend />} />
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
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
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
                                        innerRadius={62}
                                        outerRadius={82}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<GlassmorphicTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {categoryData.slice(0, 4).map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-700/30 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                    />
                                    <span className="text-xs font-semibold text-slate-655 dark:text-slate-400 truncate">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="text-xs font-black text-slate-900 dark:text-white flex-shrink-0">
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
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            Alertas de Stock
                        </h2>
                        <Badge variant="danger">{(summary?.lowStockItems || 0) + (summary?.expiringSoonBatches || 0)}</Badge>
                    </div>
                    <div className="space-y-3">
                        {(summary?.lowStockItems || 0) > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-sm">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    <HiOutlineExclamationCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                                        Stock Baixo
                                    </p>
                                    <p className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/60 uppercase mt-0.5">
                                        {summary?.lowStockItems} medicamentos abaixo do mínimo
                                    </p>
                                </div>
                            </div>
                        )}
                        {(summary?.expiringSoonBatches || 0) > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-rose-500/5 dark:bg-rose-500/10 rounded-xl border border-rose-500/20 shadow-sm">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    <HiOutlineExclamationCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-tight">
                                        Próximo da Validade
                                    </p>
                                    <p className="text-[10px] font-bold text-rose-600/80 dark:text-rose-400/60 uppercase mt-0.5">
                                        {summary?.expiringSoonBatches} medicamentos expiram em 90 dias
                                    </p>
                                </div>
                            </div>
                        )}
                        {(summary?.lowStockItems || 0) === 0 && (summary?.expiringSoonBatches || 0) === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                                <HiOutlineExclamationCircle className="w-8 h-8 opacity-45 mb-1.5" />
                                <p className="text-sm font-semibold uppercase tracking-wide text-center">Nenhum alerta pendente</p>
                            </div>
                        )}
                    </div>
                    <Link
                        to="/pharmacy/manage"
                        className="block mt-4 text-center text-xs font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors"
                    >
                        Ver Stock Completo
                    </Link>
                </Card>

                <RecentActivityWidget recentActivities={recentActivities} />
            </div>

            {/* Quick Actions */}
            <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
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
