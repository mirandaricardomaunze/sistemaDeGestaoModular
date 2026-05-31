import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Button, Modal, Skeleton, Select, PageHeader } from '../../components/ui';
import {
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp,
    HiOutlineShoppingCart,
    HiOutlineCube,

    HiOutlineChartBar,
    HiOutlineClipboardDocumentList,
    HiOutlineExclamationTriangle,
    HiOutlineArrowPath,
    HiOutlineUsers,
    HiOutlineDocumentText,
    HiOutlineQueueList,
} from 'react-icons/hi2';
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
import { formatCurrency, cn } from '../../utils/helpers';
import { commercialAPI, salesAPI } from '../../services/api';
import { useWarehouses } from '../../hooks/useData';
import { useCommercialAnalytics, useMarginAnalysis, useSalesReport } from '../../hooks/useCommercial';
import { useDerivedCommercialAnalytics } from '../../hooks/useCommercialAnalytics';
import { useSalesHeatmap } from '../../hooks/useSalesHeatmap';
import { ABCClassificationChart } from '../../components/commercial/analytics/ABCClassificationChart';
import { CategoryRevenueChart } from '../../components/commercial/analytics/CategoryRevenueChart';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import { SalesHeatmap } from '../../components/commercial/analytics/SalesHeatmap';
import { SegmentedControl } from '../../components/common/SegmentedControl';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const PERIOD_OPTIONS = [
    { label: '1 Mês', value: 30 },
    { label: '3 Meses', value: 90 },
    { label: '6 Meses', value: 180 },
    { label: '1 Ano', value: 365 },
];

const PANEL_SURFACE = 'bg-white dark:bg-dark-800 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]';
const PANEL_TITLE = 'font-black text-[11px] text-slate-700 dark:text-gray-300 uppercase tracking-widest';
const MICRO_LABEL = 'text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-300';

type SalesTrendPoint = {
    date?: string;
    value?: number | string;
};

type QuickActionColor = 'primary' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan';

interface RecentCommercialSale {
    id: string;
    customerName?: string | null;
    createdAt: string | Date;
    total?: number | string | null;
}

// ── Main Dashboard ──────────────────────────────────────────────────────────-

export default function CommercialDashboard() {
    const [selectedDays, setSelectedDays] = useState(30);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const { warehouses } = useWarehouses();
    const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useCommercialAnalytics(selectedWarehouseId);
    const { data: marginData, isLoading: marginLoading, refetch: refetchMargins } = useMarginAnalysis(selectedDays, selectedWarehouseId);
    const { data: salesReport, isLoading: salesReportLoading, refetch: refetchSalesReport } = useSalesReport(selectedDays, selectedWarehouseId);
    const {
        abcData,
        atRiskCustomers,
        nearExpiry,
        productCategoryMix,
        isLoading: advancedLoading
    } = useDerivedCommercialAnalytics(selectedDays, selectedWarehouseId);
    const { heatmapData, isLoading: heatmapLoading, refetch: refetchHeatmap } = useSalesHeatmap(selectedDays, selectedWarehouseId);
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [recentSales, setRecentSales] = useState<RecentCommercialSale[]>([]);
    const [recentSalesLoading, setRecentSalesLoading] = useState(true);

    const fetchRecentSales = useCallback(async () => {
        setRecentSalesLoading(true);
        try {
            const response = await salesAPI.getAll({
                limit: 10,
                warehouseId: selectedWarehouseId || undefined,
                originModule: 'commercial'
            });
            const rows = Array.isArray(response) ? response : response?.data || [];
            setRecentSales(rows.map((sale: {
                id: string;
                createdAt: string | Date;
                total?: number | string | null;
                customerName?: string | null;
                customer?: { name?: string | null } | null;
            }) => ({
                id: sale.id,
                createdAt: sale.createdAt,
                total: sale.total,
                customerName: sale.customerName || sale.customer?.name || 'Cliente Final'
            })));
        } catch {
            setRecentSales([]);
        } finally {
            setRecentSalesLoading(false);
        }
    }, [selectedWarehouseId]);

    useEffect(() => {
        fetchRecentSales();
    }, [fetchRecentSales]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        // Invalida primeiro o cache server-side para garantir dados frescos
        await commercialAPI.invalidateCache().catch(() => {});
        await Promise.all([refetchAnalytics(), refetchMargins(), refetchSalesReport(), refetchHeatmap(), fetchRecentSales()]);
        setRefreshing(false);
    }, [fetchRecentSales, refetchAnalytics, refetchMargins, refetchSalesReport, refetchHeatmap]);

    const isLoading = marginLoading || advancedLoading || analyticsLoading || heatmapLoading || salesReportLoading || recentSalesLoading;

    const metrics = useMemo(() => {
        const totalRevenue = Number(analytics?.revenue ?? 0);
        const cogs = analytics?.cogs ?? 0;
        const totalProfit = analytics?.grossProfit ?? 0;
        const margin = analytics?.grossMargin ?? (totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0);
        const todayKey = new Date().toISOString().slice(0, 10);
        const todaySales = salesReport?.dailySales?.find(day => day.date === todayKey)?.revenue ?? 0;

        // Replenishment efficiency: share of POs delivered on time.
        // Proxy = pending non-overdue / pending. When all open POs are still on time → 100%.
        const pendingPOs = analytics?.pendingPOs ?? 0;
        const overduePOs = analytics?.overduePOs ?? 0;
        const replenishmentEfficiency = pendingPOs > 0
            ? Math.max(0, Math.min(100, ((pendingPOs - overduePOs) / pendingPOs) * 100))
            : null;

        return {
            totalRevenue,
            totalProfit,
            margin,
            marginTrend: analytics?.marginTrend ?? 0,
            todaySales,
            cogs,
            inventoryValue: analytics?.inventoryValue ?? 0,
            inventoryTurnover: analytics?.inventoryTurnover ?? 0,
            reorderNeeded: analytics?.reorderNeeded ?? 0,
            pendingPOs,
            overduePOs,
            poSpend: analytics?.poSpend ?? 0,
            replenishmentEfficiency,
        };
    }, [analytics, salesReport]);

    const categoryProductData = useMemo(() => {
        return productCategoryMix;
    }, [productCategoryMix]);

    const categoryRevenueData = useMemo(() => {
        if (!marginData?.byCategory) return [];
        return marginData.byCategory
            .map(c => ({ name: c.category, value: c.revenue }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // Top 8 categories by revenue
    }, [marginData]);

    const salesTrendData = useMemo<SalesTrendPoint[]>(
        () => salesReport?.dailySales?.slice(-14).map(day => ({ date: day.date, value: day.revenue })) || [],
        [salesReport]
    );
    const salesTrendTotal = useMemo(
        () => salesTrendData.reduce((sum, item) => sum + Number(item.value || 0), 0),
        [salesTrendData]
    );
    const salesTrendAverage = salesTrendData.length > 0 ? salesTrendTotal / salesTrendData.length : 0;
    const hasSalesTrend = salesTrendData.some((item) => Number(item.value || 0) > 0);
    const categoryProductTotal = categoryProductData.reduce((sum, item) => sum + item.value, 0);
    const hasCategoryProductMix = categoryProductData.length > 0 && categoryProductTotal > 0;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/4 rounded-lg" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-80 rounded-xl" />
                        <Skeleton className="h-80 rounded-xl" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-60 rounded-xl" />
                        <Skeleton className="h-60 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            <PageHeader
                title="Dashboard Comercial"
                subtitle="Análise estratégica de vendas, margens e performance de stock"
                icon={<HiOutlineChartBar />}
            />
            {analyticsError && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <div className="flex items-center gap-2.5">
                        <HiOutlineExclamationTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <p className="text-[11px] font-bold text-red-700 dark:text-red-400">
                            {analyticsError} — alguns indicadores podem estar desactualizados.
                        </p>
                    </div>
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => refetchAnalytics()}
                    >
                        Tentar Novamente
                    </Button>
                </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 w-full bg-white dark:bg-dark-900/40 p-2.5 rounded-2xl border border-slate-200/90 dark:border-white/5 backdrop-blur-md shadow-[0_14px_30px_-24px_rgba(15,23,42,0.75)]">
                {/* Warehouse Filter as Dropdown styled like the buttons */}
                <div className="w-full sm:w-48">
                    <Select
                        size="sm"
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        options={[
                            { value: '', label: 'Todos os Armazéns' },
                            ...(warehouses || []).map(w => ({ value: w.id, label: w.name }))
                        ]}
                        className="w-full h-10 text-[10px] font-black uppercase tracking-widest border-slate-300/80 dark:border-white/10 shadow-sm focus:ring-0 rounded-xl bg-white dark:bg-dark-800 text-slate-700 dark:text-gray-200"
                    />
                </div>

                <SegmentedControl
                    options={PERIOD_OPTIONS}
                    value={selectedDays}
                    onChange={setSelectedDays}
                    className="w-full sm:w-auto"
                />
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4 text-primary-600 dark:text-primary-400", refreshing && "animate-spin")} />}
                    className="h-10 px-4 text-slate-700 hover:text-primary-700 dark:text-gray-300 dark:hover:text-primary-400 w-full sm:w-auto flex items-center justify-center"
                >
                    {refreshing ? 'Actualizando...' : 'Actualizar Tudo'}
                </Button>
            </div>

            {/* 1. Quick Actions Bar */}
            <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 pl-1 flex items-center gap-2">
                    Acesso Rápido
                    <div className="h-px flex-1 bg-slate-200 dark:bg-dark-700" />
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Nova Venda', path: '/commercial/pos', icon: HiOutlineShoppingCart, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' },
                        { label: 'Nova OC', path: '/commercial/purchase-orders', icon: HiOutlineClipboardDocumentList, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20' },
                        { label: 'Stock', path: '/commercial/inventory', icon: HiOutlineCube, color: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/20 hover:bg-primary-100 dark:hover:bg-primary-500/20' },
                        { label: 'Relatórios', path: '/commercial/reports', icon: HiOutlineArrowTrendingUp, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20' },
                        { label: 'Encomendas', path: '/commercial/orders', icon: HiOutlineQueueList, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20' },
                        { label: 'Faturas', path: '/commercial/invoices', icon: HiOutlineDocumentText, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/20' },
                    ].map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.label}
                                to={action.path}
                                className={cn(
                                    "flex items-center gap-1.5 p-1.5 rounded-xl transition-all duration-200 border bg-white dark:bg-dark-800/40 hover:-translate-y-0.5 active:scale-95 shadow-sm hover:shadow",
                                    "border-slate-200 dark:border-dark-700 hover:border-slate-300 dark:hover:border-dark-600 group"
                                )}
                            >
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors", action.color)}>
                                    <Icon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white truncate transition-colors">
                                    {action.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* 2. Main Performance KPIs - Hero Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                    color="primary"
                    value={formatCurrency(metrics.totalRevenue)}
                    label="Receita este Mês"
                    badge={
                        <span className="text-[10px] font-black text-primary-600 dark:text-primary-300">
                            Comercial
                        </span>
                    }
                />
                <MetricCard
                    icon={<HiOutlineArrowTrendingUp className="w-5 h-5" />}
                    color={metrics.totalProfit >= 0 ? "success" : "danger"}
                    value={formatCurrency(metrics.totalProfit)}
                    label="Lucro Bruto"
                    badge={
                        <div className="flex flex-col items-end gap-1">
                            <Badge variant={metrics.totalProfit >= 0 ? "success" : "danger"} size="sm">
                                Margem {metrics.margin.toFixed(1)}%
                            </Badge>
                            {metrics.totalProfit < 0 && (
                                <span className="text-[9px] font-black text-red-500 dark:text-red-300 uppercase tracking-wider">
                                    Rever custos
                                </span>
                            )}
                        </div>
                    }
                />
                <MetricCard
                    icon={<HiOutlineShoppingCart className="w-5 h-5" />}
                    color="amber"
                    value={formatCurrency(metrics.cogs)}
                    label="Custo Vendas (COGS)"
                    badge={metrics.totalRevenue > 0
                        ? <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">{(100 - metrics.margin).toFixed(1)}%</span>
                        : undefined}
                />
                <MetricCard
                    icon={<HiOutlineChartBar className="w-5 h-5" />}
                    color="purple"
                    value={formatCurrency(metrics.todaySales)}
                    label="Vendas Hoje"
                    badge={<span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />Live</span>}
                />
            </div>

            {/* 3. Sales Heatmap - Full Width prominence */}
            <div className="animate-slide-up">
                <SalesHeatmap data={heatmapData} isLoading={isLoading} />
            </div>

            {/* 4. Analytics & Management Grid */}
            <div className="space-y-6">
                
                {/* Row 1: Sales Trend & Management Focus */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Sales chart */}
                    <div className="lg:col-span-2">
                        <Card padding="lg" className={cn('h-full', PANEL_SURFACE)}>
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
                                    <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/15 border border-primary-200 dark:border-primary-500/25 flex items-center justify-center">
                                        <HiOutlineArrowTrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    </span>
                                    Tendência de Vendas
                                </h3>
                                <div className="flex items-center gap-3 text-right">
                                    <div>
                                        <p className={MICRO_LABEL}>Total 14 dias</p>
                                        <p className="text-xs font-black text-primary-600 dark:text-primary-300">{formatCurrency(salesTrendTotal).split(',')[0]}</p>
                                    </div>
                                    <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
                                    <div>
                                        <p className={MICRO_LABEL}>Média/dia</p>
                                        <p className="text-xs font-black text-slate-700 dark:text-white">{formatCurrency(salesTrendAverage).split(',')[0]}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="h-72 relative">
                                {!hasSalesTrend && (
                                    <div className="absolute inset-0 z-10 rounded-xl border border-dashed border-slate-300/80 dark:border-white/10 bg-slate-50 dark:bg-dark-900/80 flex flex-col items-center justify-center text-center px-6">
                                        <HiOutlineArrowTrendingUp className="w-10 h-10 text-primary-500/60 mb-3" />
                                        <p className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-wide">Sem vendas no período</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
                                            Assim que houver faturação, este gráfico passa a mostrar tendência, picos e média diária.
                                        </p>
                                    </div>
                                )}
                                <div className={cn("h-full", !hasSalesTrend && "opacity-20 pointer-events-none")}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.12} />

                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }}
                                            dy={10}
                                            tickFormatter={(val) => {
                                                const d = new Date(val);
                                                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                                            }}
                                        />
                                        <YAxis hide />
                                        <Tooltip
                                            cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-xl shadow-2xl text-[12px] text-slate-900 dark:text-white">
                                                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                                                                {label ? new Date(label).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' }) : ''}
                                                            </p>
                                                            <p className="text-sm font-black text-primary-600 dark:text-primary-400">
                                                                {formatCurrency(Number(payload[0].value))}
                                                            </p>
                                                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Receita</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#3b82f6"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorValue)"
                                            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }}
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Operational Focus */}
                    <div className={cn('rounded-xl p-5', PANEL_SURFACE)}>
                        <div className="flex items-center gap-2 mb-4">
                            <HiOutlineExclamationTriangle className="w-4 h-4 text-red-600" />
                            <h2 className={PANEL_TITLE}>Foco de Gestão</h2>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-white/5 border-l-4 border-l-red-500 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(148,163,184,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] shadow-[0_2px_8px_rgba(148,163,184,0.04)] dark:shadow-none group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm border border-red-100 dark:border-red-500/20">
                                        <HiOutlineExclamationTriangle className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-gray-200 uppercase tracking-tight">Validades</p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase">{nearExpiry.length} produtos críticos</p>
                                    </div>
                                </div>
                                <HiOutlineArrowTrendingUp className="w-4 h-4 text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full h-auto justify-between p-3 rounded-xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-white/5 border-l-4 border-l-amber-500 hover:bg-slate-50 dark:hover:bg-dark-850 hover:shadow-[0_8px_30px_rgba(148,163,184,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 cursor-pointer shadow-[0_2px_8px_rgba(148,163,184,0.04)] dark:shadow-none group text-left normal-case tracking-normal transition-all duration-300"
                                onClick={() => setShowRiskModal(true)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm border border-amber-100 dark:border-amber-500/20">
                                        <HiOutlineUsers className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-gray-200 uppercase tracking-tight">Risco Churn</p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase">{atRiskCustomers.length} inactivos</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-500/20">Ver</span>
                            </Button>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-white/5 border-l-4 border-l-emerald-500 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(148,163,184,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] shadow-[0_2px_8px_rgba(148,163,184,0.04)] dark:shadow-none group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100 dark:border-emerald-500/20">
                                        <HiOutlineArrowTrendingUp className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-gray-200 uppercase tracking-tight">Classe A</p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase">{abcData.filter(p => p.classification === 'A').length} estratégicos</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Row 2: The Analytical Trio (Height Sincronized) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ABCClassificationChart data={abcData} />
                    <CategoryRevenueChart data={categoryRevenueData} isLoading={marginLoading} />
                    <Card padding="md" className={cn(PANEL_SURFACE, 'flex flex-col')}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={cn(PANEL_TITLE, 'flex items-center gap-2')}>
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                Mix de Produtos
                            </h3>
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{categoryProductTotal} itens</span>
                        </div>
                        <div className="flex-1 min-h-[200px] relative">
                            {hasCategoryProductMix ? (
                                <>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryProductData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={78}
                                                paddingAngle={categoryProductData.length === 1 ? 0 : 3}
                                                dataKey="value"
                                                stroke="transparent"
                                            >
                                                {categoryProductData.map((_, index) => (
                                                    <Cell key={`cell-prod-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-xl shadow-2xl text-[12px] text-slate-900 dark:text-white">
                                                                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{payload[0].name}</p>
                                                                <p className="text-xs font-black text-slate-900 dark:text-white">{payload[0].value} Produtos</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total</p>
                                            <p className="text-lg font-black text-slate-950 dark:text-white tracking-tight">{categoryProductTotal}</p>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                                                {categoryProductData.length === 1 ? '1 categoria' : `${categoryProductData.length} categorias`}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-full rounded-xl border border-dashed border-slate-300/80 dark:border-white/10 bg-slate-50 dark:bg-dark-900/50 flex flex-col items-center justify-center text-center px-5">
                                    <HiOutlineCube className="w-9 h-9 text-slate-400 mb-2" />
                                    <p className="text-[11px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-widest">Sem categorias com produtos</p>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">Cadastre produtos por categoria para ativar o mix.</p>
                                </div>
                            )}
                        </div>
                        {hasCategoryProductMix && (
                            <div className="mt-4 space-y-2 border-t border-gray-100 dark:border-white/5 pt-4">
                                {categoryProductData.slice(0, 4).map((item, index) => {
                                    const share = categoryProductTotal > 0 ? (item.value / categoryProductTotal) * 100 : 0;
                                    return (
                                        <div key={item.name}>
                                            <div className="flex items-center justify-between gap-3 mb-1">
                                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase truncate">{item.name}</span>
                                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{share.toFixed(0)}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-dark-900 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${share}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Row 3: Final Operational Cards - Symmetrical 3-column layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Card 1: Últimas Vendas */}
                    <Card padding="md" className={cn(PANEL_SURFACE, 'flex flex-col')}>
                        <h3 className={cn(PANEL_TITLE, 'mb-4 flex items-center gap-2')}>
                            <HiOutlineClipboardDocumentList className="w-4 h-4 text-primary-500" />
                            Últimas Vendas
                        </h3>
                        <div className="space-y-2 flex-1">
                            {recentSales && recentSales.length > 0 ? recentSales.slice(0, 4).map((sale: RecentCommercialSale) => (
                                <div key={sale.id} className="flex justify-between items-center p-2.5 bg-indigo-50 dark:bg-dark-900/50 rounded-lg border border-indigo-100 dark:border-dark-700/50 hover:bg-indigo-100/60 transition-colors">
                                    <div className="min-w-0">
                                        <p className="font-bold text-[11px] text-gray-900 dark:text-white truncate">
                                            {sale.customerName || 'Cliente Final'}
                                        </p>
                                        <p className="text-[9px] text-slate-600 font-semibold">
                                            {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <p className="font-black text-[11px] text-primary-600 flex-shrink-0">
                                        {formatCurrency(Number(sale.total || 0)).split(',')[0]}
                                    </p>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center h-36 rounded-xl border border-dashed border-slate-300/80 dark:border-white/10 bg-slate-50 dark:bg-dark-900/50 text-center px-5">
                                    <HiOutlineShoppingCart className="w-9 h-9 mb-2 text-slate-400" />
                                    <p className="text-[11px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-widest">Sem vendas recentes</p>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">As últimas transacções aparecem aqui assim que forem registadas.</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Card 2: Valor do Inventário */}
                    <Card padding="md" className={cn(PANEL_SURFACE, 'flex flex-col')}>
                        <h3 className={cn(PANEL_TITLE, 'mb-4 flex items-center gap-2')}>
                            <HiOutlineCube className="w-4 h-4 text-slate-500" />
                            Valor em Stock
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center py-4">
                            <div className="text-3xl font-black text-slate-950 dark:text-white tracking-tighter mb-1">
                                {formatCurrency(metrics.inventoryValue).split(',')[0]}
                                <span className="text-sm font-bold text-slate-400 ml-1">MTn</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200/80 dark:border-white/5">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{metrics.reorderNeeded} produtos a repor</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase">Ordens Pendentes</p>
                                <p className="text-sm font-black text-gray-700 dark:text-white">{metrics.pendingPOs}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase">Atrasadas</p>
                                <p className="text-sm font-black text-red-500">{metrics.overduePOs}</p>
                            </div>
                        </div>
                    </Card>

                    {/* Card 3: Giro de Stock */}
                    <Card padding="md" className={cn(PANEL_SURFACE, 'flex flex-col')}>
                        <h3 className={cn(PANEL_TITLE, 'mb-4 flex items-center gap-2')}>
                            <HiOutlineArrowPath className="w-4 h-4 text-cyan-500" />
                            Giro de Inventário
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center py-4">
                            <div className="text-4xl font-black text-cyan-600 dark:text-cyan-400 tracking-tighter mb-1">
                                {metrics.inventoryTurnover.toFixed(1)}
                                <span className="text-lg font-bold ml-1">x</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-600 dark:text-gray-400 uppercase tracking-widest">Rotação Média Anual</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-500 dark:text-gray-400 uppercase">Eficiência de Reposição</span>
                                <span className="text-[10px] font-black text-cyan-600">
                                    {metrics.replenishmentEfficiency !== null
                                        ? `${metrics.replenishmentEfficiency.toFixed(0)}%`
                                        : '—'}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-dark-900 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 rounded-full transition-all"
                                    style={{ width: `${metrics.replenishmentEfficiency ?? 0}%` }}
                                />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modal de Clientes em Risco - Mantido igual */}
            <Modal
                isOpen={showRiskModal}
                onClose={() => setShowRiskModal(false)}
                title="Clientes em Risco (Inactivos)"
                size="lg"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Estes clientes não realizam compras há algum tempo. Considere entrar em contacto.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800">
                        {/* Desktop Table */}
                        <table className="hidden sm:table w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-800 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Inactivo há</th>
                                    <th className="px-4 py-3 text-right">Risco</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {atRiskCustomers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                        <td className="px-4 py-3 font-bold">{customer.name}</td>
                                        <td className="px-4 py-3 font-medium text-amber-600">{customer.daysSinceLastPurchase} dias</td>
                                        <td className="px-4 py-3 text-right">
                                            <Badge variant={customer.riskLevel === 'critical' ? 'danger' : 'warning'} size="sm">
                                                {customer.riskLevel.toUpperCase()}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* Mobile Cards */}
                        <div className="flex flex-col sm:hidden divide-y divide-gray-100 dark:divide-dark-700">
                            {atRiskCustomers.map(customer => (
                                <div key={customer.id} className="p-4 space-y-3">
                                    <div className="flex justify-between items-start gap-3">
                                        <span className="font-bold text-sm text-gray-900 dark:text-white uppercase leading-tight">
                                            {customer.name}
                                        </span>
                                        <Badge variant={customer.riskLevel === 'critical' ? 'danger' : 'warning'} size="sm" className="shrink-0 text-[9px] px-2">
                                            {customer.riskLevel.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500">Inactivo há:</span>
                                        <span className="font-bold text-amber-600">{customer.daysSinceLastPurchase} dias</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
