import { useMemo, useState, useCallback } from 'react';
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
import { useDashboard } from '../../hooks/useDashboard';
import { useCategories, useWarehouses } from '../../hooks/useData';
import { useCommercialAnalytics, useMarginAnalysis } from '../../hooks/useCommercial';
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

// ── Main Dashboard ──────────────────────────────────────────────────────────-

export default function CommercialDashboard() {
    const [selectedDays, setSelectedDays] = useState(30);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const { warehouses } = useWarehouses();
    const { stats, salesChart, recentSales, isLoading: dashLoading, refetch: refetchDash } = useDashboard(selectedWarehouseId);
    const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useCommercialAnalytics(selectedWarehouseId);
    const { data: marginData, isLoading: marginLoading, refetch: refetchMargins } = useMarginAnalysis(selectedDays, selectedWarehouseId);
    const { categories, isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();
    const {
        abcData,
        atRiskCustomers,
        nearExpiry,
        isLoading: advancedLoading
    } = useDerivedCommercialAnalytics(selectedDays, selectedWarehouseId);
    const { heatmapData, isLoading: heatmapLoading, refetch: refetchHeatmap } = useSalesHeatmap(selectedDays, selectedWarehouseId);
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchDash(), refetchAnalytics(), refetchMargins(), refetchCategories(), refetchHeatmap()]);
        setRefreshing(false);
    }, [refetchDash, refetchAnalytics, refetchMargins, refetchCategories, refetchHeatmap]);

    const isLoading = dashLoading || marginLoading || categoriesLoading || advancedLoading || analyticsLoading || heatmapLoading;

    const metrics = useMemo(() => {
        // Prefer commercial-specific analytics over generic dashboard stats
        const totalRevenue = Number(analytics?.revenue ?? stats?.totalRevenue ?? 0);
        const cogs = analytics?.cogs ?? 0;
        const totalProfit = analytics?.grossProfit ?? stats?.totalProfit ?? 0;
        const margin = analytics?.grossMargin ?? (totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0);

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
            salesGrowth: stats?.monthlyGrowth || 0,
            todaySales: Number(stats?.todaySales || 0),
            lowStock: stats?.lowStockCount || 0,
            cogs,
            inventoryValue: analytics?.inventoryValue ?? 0,
            inventoryTurnover: analytics?.inventoryTurnover ?? 0,
            reorderNeeded: analytics?.reorderNeeded ?? 0,
            pendingPOs,
            overduePOs,
            poSpend: analytics?.poSpend ?? 0,
            replenishmentEfficiency,
        };
    }, [analytics, stats]);

    const categoryProductData = useMemo(() => {
        if (!categories || categories.length === 0) return [];
        return categories
            .filter(c => (c.productCount || 0) > 0)
            .map(c => ({ name: c.name, value: c.productCount || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [categories]);

    const categoryRevenueData = useMemo(() => {
        if (!marginData?.byCategory) return [];
        return marginData.byCategory
            .map(c => ({ name: c.category, value: c.revenue }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // Top 8 categories by revenue
    }, [marginData]);

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
            <div className="flex flex-wrap items-center justify-end gap-3 bg-white/40 dark:bg-dark-900/40 p-2.5 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
                {/* Warehouse Filter as Dropdown styled like the buttons */}
                <div className="w-48">
                    <Select
                        size="sm"
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        options={[
                            { value: '', label: 'Todos os Armazéns' },
                            ...(warehouses || []).map(w => ({ value: w.id, label: w.name }))
                        ]}
                        className="h-9 text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-white/10 shadow-sm focus:ring-0 rounded-xl bg-white dark:bg-dark-800"
                    />
                </div>

                <SegmentedControl
                    options={PERIOD_OPTIONS}
                    value={selectedDays}
                    onChange={setSelectedDays}
                />
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4 text-primary-600 dark:text-primary-400", refreshing && "animate-spin")} />}
                >
                    {refreshing ? 'Actualizando...' : 'Actualizar Tudo'}
                </Button>
            </div>

            {/* 1. Quick Actions Bar - More prominent at the top */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Nova Venda', path: '/commercial/pos', icon: HiOutlineShoppingCart, color: 'emerald' },
                    { label: 'Nova OC', path: '/commercial/purchase-orders', icon: HiOutlineClipboardDocumentList, color: 'amber' },
                    { label: 'Stock', path: '/commercial/inventory', icon: HiOutlineCube, color: 'primary' },
                    { label: 'Relatórios', path: '/commercial/reports', icon: HiOutlineArrowTrendingUp, color: 'rose' },
                    { label: 'Encomendas', path: '/commercial/orders', icon: HiOutlineQueueList, color: 'indigo' },
                    { label: 'Faturas', path: '/commercial/invoices', icon: HiOutlineDocumentText, color: 'cyan' },
                ].map((action) => (
                    <QuickActionCard
                        key={action.label}
                        icon={action.icon}
                        label={action.label}
                        path={action.path}
                        color={action.color as any}
                    />
                ))}
            </div>

            {/* 2. Main Performance KPIs - Hero Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                    color="primary"
                    value={formatCurrency(metrics.totalRevenue)}
                    label="Receita este Mês"
                    growth={parseFloat(metrics.salesGrowth.toFixed(1))}
                />
                <MetricCard
                    icon={<HiOutlineArrowTrendingUp className="w-5 h-5" />}
                    color={metrics.totalProfit >= 0 ? "success" : "danger"}
                    value={formatCurrency(metrics.totalProfit)}
                    label="Lucro Bruto"
                    badge={<Badge variant={metrics.totalProfit >= 0 ? "success" : "danger"} size="sm">{metrics.margin.toFixed(1)}%</Badge>}
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
                        <Card padding="lg" className="h-full bg-white dark:bg-dark-800 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-card">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
                                    <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/15 border border-primary-200 dark:border-primary-500/25 flex items-center justify-center">
                                        <HiOutlineArrowTrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    </span>
                                    Tendência de Vendas
                                </h3>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={salesChart?.slice(-14) || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />

                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
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
                                                        <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-white/20 p-3 rounded-xl shadow-2xl">
                                                            <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                                                                {label ? new Date(label).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' }) : ''}
                                                            </p>
                                                            <p className="text-sm font-black text-primary-600 dark:text-primary-400">
                                                                {formatCurrency(Number(payload[0].value))}
                                                            </p>
                                                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Receita</p>
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
                        </Card>
                    </div>

                    {/* Right Column: Operational Focus */}
                    <div className="bg-white dark:bg-dark-800 backdrop-blur-xl rounded-xl p-5 border border-slate-200 dark:border-white/10 shadow-card">
                        <div className="flex items-center gap-2 mb-4">
                            <HiOutlineExclamationTriangle className="w-4 h-4 text-red-600" />
                            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Foco de Gestão</h2>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-red-100/50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 transition-all hover:shadow-md group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-red-200/50 dark:bg-red-500/20 flex items-center justify-center text-red-700">
                                        <HiOutlineExclamationTriangle className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-red-800 dark:text-red-400 uppercase tracking-tight">Validades</p>
                                        <p className="text-[10px] text-red-700/70 dark:text-red-400/60 font-bold uppercase">{nearExpiry.length} produtos críticos</p>
                                    </div>
                                </div>
                                <HiOutlineArrowTrendingUp className="w-4 h-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <div 
                                className="flex items-center justify-between p-3 rounded-lg bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 transition-all hover:shadow-md cursor-pointer group"
                                onClick={() => setShowRiskModal(true)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-200/50 dark:bg-amber-500/20 flex items-center justify-center text-amber-700">
                                        <HiOutlineUsers className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-tight">Risco Churn</p>
                                        <p className="text-[10px] text-amber-700/70 dark:text-amber-400/60 font-bold uppercase">{atRiskCustomers.length} inactivos</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-amber-700 uppercase">Ver</span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-100/50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 transition-all hover:shadow-md group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-200/50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-700">
                                        <HiOutlineArrowTrendingUp className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Classe A</p>
                                        <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/60 font-bold uppercase">{abcData.filter(p => p.classification === 'A').length} estratégicos</p>
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
                    <Card padding="md" className="bg-white dark:bg-dark-800 backdrop-blur-xl border border-slate-200 dark:border-white/10 flex flex-col shadow-card">
                        <h3 className="font-bold text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                            Mix de Produtos
                        </h3>
                        <div className="flex-1 min-h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryProductData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={70}
                                        paddingAngle={0}
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
                                                    <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-white/20 p-2 rounded-lg shadow-xl">
                                                        <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1">{payload[0].name}</p>
                                                        <p className="text-xs font-black text-gray-900 dark:text-white">{payload[0].value} Produtos</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Row 3: Final Operational Cards - Symmetrical 3-column layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Card 1: Últimas Vendas */}
                    <Card padding="md" className="bg-white dark:bg-dark-800 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-card flex flex-col">
                        <h3 className="font-bold text-[11px] text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <HiOutlineClipboardDocumentList className="w-4 h-4 text-primary-500" />
                            Últimas Vendas
                        </h3>
                        <div className="space-y-2 flex-1">
                            {recentSales && recentSales.length > 0 ? recentSales.slice(0, 4).map((sale: any) => (
                                <div key={sale.id} className="flex justify-between items-center p-2.5 bg-indigo-50/30 dark:bg-dark-900/50 rounded-lg border border-indigo-100/50 dark:border-dark-700/50 hover:bg-indigo-50/50 transition-colors">
                                    <div className="min-w-0">
                                        <p className="font-bold text-[11px] text-gray-900 dark:text-white truncate">
                                            {sale.customerName || 'Cliente Final'}
                                        </p>
                                        <p className="text-[9px] text-gray-500 font-medium">
                                            {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <p className="font-black text-[11px] text-primary-600 flex-shrink-0">
                                        {formatCurrency(sale.total || 0).split(',')[0]}
                                    </p>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center h-32 opacity-40">
                                    <HiOutlineShoppingCart className="w-8 h-8 mb-2" />
                                    <p className="text-[10px] font-bold uppercase">Sem vendas</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Card 2: Valor do Inventário */}
                    <Card padding="md" className="bg-white dark:bg-dark-800 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-card flex flex-col">
                        <h3 className="font-bold text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <HiOutlineCube className="w-4 h-4 text-slate-500" />
                            Valor em Stock
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center py-4">
                            <div className="text-3xl font-black text-slate-700 dark:text-white tracking-tighter mb-1">
                                {formatCurrency(metrics.inventoryValue).split(',')[0]}
                                <span className="text-sm font-bold text-slate-400 ml-1">MTn</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{metrics.reorderNeeded} produtos a repor</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Ordens Pendentes</p>
                                <p className="text-sm font-black text-gray-700 dark:text-white">{metrics.pendingPOs}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Atrasadas</p>
                                <p className="text-sm font-black text-red-500">{metrics.overduePOs}</p>
                            </div>
                        </div>
                    </Card>

                    {/* Card 3: Giro de Stock */}
                    <Card padding="md" className="bg-white dark:bg-dark-800 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-card flex flex-col">
                        <h3 className="font-bold text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <HiOutlineArrowPath className="w-4 h-4 text-cyan-500" />
                            Giro de Inventário
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center py-4">
                            <div className="text-4xl font-black text-cyan-600 dark:text-cyan-400 tracking-tighter mb-1">
                                {metrics.inventoryTurnover.toFixed(1)}
                                <span className="text-lg font-bold ml-1">x</span>
                            </div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rotação Média Anual</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Eficiência de Reposição</span>
                                <span className="text-[10px] font-black text-cyan-600">
                                    {metrics.replenishmentEfficiency !== null
                                        ? `${metrics.replenishmentEfficiency.toFixed(0)}%`
                                        : '—'}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-dark-900 rounded-full overflow-hidden">
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
                    <div className="overflow-hidden border border-gray-100 dark:border-dark-700 rounded-lg">
                        <table className="w-full text-left text-sm">
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
                    </div>
                </div>
            </Modal>
        </div>
    );
}
