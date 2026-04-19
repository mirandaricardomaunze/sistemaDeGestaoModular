import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, PageHeader, Modal, Skeleton } from '../../components/ui';
import {
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp,
    HiOutlineShoppingCart,
    HiOutlineCube,
    HiOutlineArrowTrendingDown,
    HiOutlineChartBar,
    HiOutlineClipboardDocumentList,
    HiOutlineExclamationTriangle,
    HiOutlineArrowPath,
    HiOutlinePresentationChartLine
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
import { useCategories } from '../../hooks/useData';
import { useCommercialAnalytics as useOriginalAnalytics, useMarginAnalysis } from '../../hooks/useCommercial';
import { useCommercialAnalytics as useAdvancedAnalytics } from '../../hooks/useCommercialAnalytics';
import { ABCClassificationChart } from '../../components/commercial/analytics/ABCClassificationChart';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// ── Mini stat card ──────────────────────────────────────────────────────────-

interface MiniStatProps {
    label: string;
    value: string;
    sub?: string;
    color: string;
    icon: React.ElementType;
    onClick?: () => void;
    alert?: boolean;
}

const MINI_STAT_PALETTES: Record<string, { cardBg: string; cardBorder: string; iconBg: string; accent: string }> = {
    purple: {
        cardBg: 'bg-purple-50/60 dark:bg-purple-950/30',
        cardBorder: 'border border-purple-200/70 dark:border-purple-800/40',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        accent: 'bg-purple-500',
    },
    blue: {
        cardBg: 'bg-blue-50/60 dark:bg-blue-950/30',
        cardBorder: 'border border-blue-200/70 dark:border-blue-800/40',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        accent: 'bg-blue-500',
    },
    amber: {
        cardBg: 'bg-amber-50/60 dark:bg-amber-950/30',
        cardBorder: 'border border-amber-200/70 dark:border-amber-800/40',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
        accent: 'bg-amber-500',
    },
    red: {
        cardBg: 'bg-red-50/60 dark:bg-red-950/30',
        cardBorder: 'border border-red-200/70 dark:border-red-800/40',
        iconBg: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        accent: 'bg-red-500',
    },
};

function MiniStat({ label, value, sub, color, icon: Icon, onClick }: MiniStatProps) {
    const paletteKey = color.includes('purple') ? 'purple'
        : color.includes('blue') ? 'blue'
        : color.includes('yellow') || color.includes('amber') ? 'amber'
        : 'red';
    const p = MINI_STAT_PALETTES[paletteKey];

    return (
        <div
            className={cn(
                'relative group overflow-hidden rounded-xl p-4 h-full transition-all duration-300 shadow-sm',
                p.cardBg, p.cardBorder,
                onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
            )}
            onClick={onClick}
        >
            <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', p.iconBg)}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.15em]">{label}</span>
            </div>
            <p className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{value}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-1 font-bold italic">{sub}</p>}
            <div className={`absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-6 ${p.accent}`} />
        </div>
    );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────-

export default function CommercialDashboard() {
    const navigate = useNavigate();
    const { stats, salesChart, isLoading: dashLoading, refetch: refetchDash } = useDashboard();
    const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useOriginalAnalytics();
    const { isLoading: marginLoading, refetch: refetchMargins } = useMarginAnalysis(30);
    const { categories, isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();
    const {
        abcData,
        atRiskCustomers,
        nearExpiry,
        isLoading: advancedLoading
    } = useAdvancedAnalytics(90);
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchDash(), refetchAnalytics(), refetchMargins(), refetchCategories()]);
        setRefreshing(false);
    }, [refetchDash, refetchAnalytics, refetchMargins, refetchCategories]);

    const isLoading = dashLoading || marginLoading || categoriesLoading || advancedLoading || analyticsLoading;

    const metrics = useMemo(() => {
        const totalRevenue = Number(stats?.commercialRevenue || stats?.totalRevenue || 0);
        const totalProfit = stats?.totalProfit || 0;
        const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            totalProfit,
            margin,
            marginTrend: analytics?.marginTrend ?? 0,
            salesGrowth: stats?.monthlyGrowth || 0,
            todaySales: Number(stats?.todaySales || 0),
            lowStock: stats?.lowStockCount || 0,
            cogs: analytics?.cogs ?? 0,
            inventoryValue: analytics?.inventoryValue ?? 0,
            inventoryTurnover: analytics?.inventoryTurnover ?? 0,
            reorderNeeded: analytics?.reorderNeeded ?? 0,
            pendingPOs: analytics?.pendingPOs ?? 0,
            overduePOs: analytics?.overduePOs ?? 0,
            poSpend: analytics?.poSpend ?? 0,
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

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/4 rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-80 rounded-xl" />
                    <Skeleton className="h-80 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Dashboard Comercial"
                subtitle="Visão consolidada de vendas, margens e inventário comercial"
                icon={<HiOutlinePresentationChartLine />}
                actions={
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-gray-400 hover:text-primary-600"
                            leftIcon={<HiOutlineArrowPath className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
                        >
                            {refreshing ? 'Actualizando...' : 'Actualizar Tudo'}
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="font-black text-[10px] uppercase tracking-widest"
                            onClick={() => navigate('/commercial/reports')}
                        >
                            Relatórios
                        </Button>
                        <Button
                            size="sm"
                            className="font-black text-[10px] uppercase tracking-widest"
                            onClick={() => navigate('/commercial/pos')}
                        >
                            Novo Pedido
                        </Button>
                    </>
                }
            />

            {/* Main KPIs section placeholder - no changes here */}

            {/* Smart Insights and foco icons */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500" />
                    <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Foco de Gestão</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Validades Críticas */}
                    <div className="relative group overflow-hidden rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">Validades Críticas</p>
                                <h4 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{nearExpiry.length}</h4>
                                <p className="text-[10px] text-red-500 font-bold mt-1">Produtos a expirar em 30 dias</p>
                            </div>
                            <div className="p-2.5 bg-red-100 dark:bg-red-900/40 rounded-xl transition-transform group-hover:scale-110 duration-300">
                                <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500" />
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 transition-all duration-500 group-hover:w-full w-6" />
                    </div>

                    {/* Clientes em Risco */}
                    <div
                        className="relative group overflow-hidden rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-4 cursor-pointer"
                        onClick={() => setShowRiskModal(true)}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">Clientes em Risco</p>
                                <h4 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{atRiskCustomers.length}</h4>
                                <p className="text-[10px] text-amber-500 font-bold mt-1">Clique para ver lista de contacto</p>
                            </div>
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 rounded-xl transition-transform group-hover:scale-110 duration-300">
                                <HiOutlinePresentationChartLine className="w-5 h-5 text-amber-500" />
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500 transition-all duration-500 group-hover:w-full w-6" />
                    </div>

                    {/* Produtos Classe A */}
                    <div className="relative group overflow-hidden rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">Produtos Classe A</p>
                                <h4 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{abcData.filter(p => p.classification === 'A').length}</h4>
                                <p className="text-[10px] text-blue-500 font-bold mt-1">Geram 80% da sua receita</p>
                            </div>
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl transition-transform group-hover:scale-110 duration-300">
                                <HiOutlineArrowTrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-500 group-hover:w-full w-6" />
                    </div>
                </div>
            </div>

            {/* Main KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Receita */}
                <div className="relative group overflow-hidden rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-110 duration-300">
                            <HiOutlineCurrencyDollar className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-1">Receita este Mês</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">{formatCurrency(metrics.totalRevenue)}</p>
                    <div className={cn('flex items-center text-xs font-bold', metrics.salesGrowth >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                        {metrics.salesGrowth >= 0 ? <HiOutlineArrowTrendingUp className="w-3.5 h-3.5 mr-1" /> : <HiOutlineArrowTrendingDown className="w-3.5 h-3.5 mr-1" />}
                        {Math.abs(metrics.salesGrowth).toFixed(1)}% vs mês anterior
                    </div>
                    <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-500 group-hover:w-full w-8" />
                </div>

                {/* Lucro Bruto */}
                <div className="relative group overflow-hidden rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110 duration-300">
                            <HiOutlineArrowTrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-1">Lucro Bruto</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">{formatCurrency(metrics.totalProfit)}</p>
                    <div className="flex items-center gap-2">
                        <Badge variant={metrics.margin >= 20 ? 'success' : metrics.margin >= 10 ? 'warning' : 'danger'} size="sm">
                            {metrics.margin.toFixed(1)}% margem
                        </Badge>
                        {metrics.marginTrend !== 0 && (
                            <span className={cn('text-xs font-bold', metrics.marginTrend >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                                {metrics.marginTrend >= 0 ? '+' : ''}{metrics.marginTrend.toFixed(1)}pp
                            </span>
                        )}
                    </div>
                    <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 transition-all duration-500 group-hover:w-full w-8" />
                </div>

                {/* COGS */}
                <div className="relative group overflow-hidden rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-110 duration-300">
                            <HiOutlineShoppingCart className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-1">COGS (Custo Vendas)</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">{formatCurrency(metrics.cogs)}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        {metrics.totalRevenue > 0 ? `${(100 - metrics.margin).toFixed(1)}% da receita` : 'Sem vendas este mês'}
                    </p>
                    <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500 transition-all duration-500 group-hover:w-full w-8" />
                </div>

                {/* Vendas Hoje */}
                <div className="relative group overflow-hidden rounded-xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/70 dark:border-violet-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 transition-transform group-hover:scale-110 duration-300">
                            <HiOutlineChartBar className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-1">Vendas Hoje</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">{formatCurrency(metrics.todaySales)}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Compras OC: {formatCurrency(metrics.poSpend)}</p>
                    <div className="absolute bottom-0 left-0 h-0.5 bg-violet-500 transition-all duration-500 group-hover:w-full w-8" />
                </div>
            </div>

            {/* Secondary KPIs - Inventory, Turnover, POs, Reorder */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat
                    label="Valor em Inventário"
                    value={formatCurrency(metrics.inventoryValue)}
                    sub="stock actual a custo"
                    color="border border-gray-200 dark:border-dark-700 text-purple-500"
                    icon={HiOutlineCube}
                    onClick={() => navigate('/commercial/inventory')}
                />
                <MiniStat
                    label="Rotatividade Anual"
                    value={`${metrics.inventoryTurnover.toFixed(1)}x`}
                    sub="vezes/ano (estimativa)"
                    color="text-blue-500"
                    icon={HiOutlineArrowPath}
                    onClick={() => navigate('/commercial/margins')}
                />
                <MiniStat
                    label="OC Pendentes"
                    value={String(metrics.pendingPOs)}
                    sub={metrics.overduePOs > 0 ? `${metrics.overduePOs} atrasadas` : 'Todas em prazo'}
                    color="border border-gray-200 dark:border-dark-700 text-yellow-500"
                    icon={HiOutlineClipboardDocumentList}
                    onClick={() => navigate('/commercial/purchase-orders')}
                    alert={metrics.overduePOs > 0}
                />
                <MiniStat
                    label="Reabastecimento"
                    value={String(metrics.reorderNeeded)}
                    sub="produtos abaixo do mínimo"
                    color="border border-gray-200 dark:border-dark-700 text-red-500"
                    icon={HiOutlineExclamationTriangle}
                    onClick={() => navigate('/commercial/inventory')}
                    alert={metrics.reorderNeeded > 0}
                />
            </div>

            {/* Charts & Secondary content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales chart */}
                <Card padding="lg" color="slate">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <HiOutlineArrowTrendingUp className="text-primary-500" />
                            Tendência de Vendas
                        </h3>
                    </div>
                    <div className="h-64 pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesChart?.slice(-7) || []}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5 5' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        fontSize: '12px',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
                                    }}
                                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                    formatter={(value: number | undefined) => [formatCurrency(Number(value || 0)), '']}
                                    labelStyle={{ display: 'none' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Right column */}
                <div className="space-y-6">
                    {/* ABC Pareto Chart */}
                    <ABCClassificationChart data={abcData} />

                    {/* Category Product Distribution */}

                    {/* Category Product Distribution */}
                    <Card padding="lg" color="slate">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Produtos por Categoria</h3>
                        <div className="h-52 flex items-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryProductData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        animationDuration={1500}
                                    >
                                        {categoryProductData.map((_, index) => (
                                            <Cell key={`cell-prod-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-1/2 space-y-2">
                                {categoryProductData.map((cat, i) => (
                                    <div key={cat.name} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[(i + 2) % CHART_COLORS.length] }} />
                                        <span className="text-[11px] text-gray-600 dark:text-gray-400 capitalize truncate">{cat.name}</span>
                                        <span className="text-[11px] font-bold ml-auto">{cat.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Quick actions overlays */}
                    <Card padding="md" className="bg-slate-100 dark:bg-dark-800/80 backdrop-blur-sm text-slate-900 dark:text-white border-none shadow-premium relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors" />
                        <h3 className="font-black mb-3 text-slate-500 dark:text-primary-400 text-[10px] uppercase tracking-widest relative z-10">Acções Rápidas</h3>
                        <div className="grid grid-cols-2 gap-2 relative z-10">
                            {[
                                { label: 'Nova OC', path: '/commercial/purchase-orders', icon: HiOutlineClipboardDocumentList },
                                { label: 'Análise Margem', path: '/commercial/margins', icon: HiOutlineChartBar },
                                { label: 'Stock Crítico', path: '/commercial/reports', icon: HiOutlineExclamationTriangle },
                                { label: 'Relatórios', path: '/commercial/reports', icon: HiOutlineArrowTrendingUp },
                            ].map(action => {
                                const Icon = action.icon;
                                return (
                                     <button
                                        key={action.label}
                                        onClick={() => navigate(action.path)}
                                        className="flex items-center gap-2 p-3 bg-white dark:bg-dark-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-[10px] font-black text-slate-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400 transition-all hover:scale-[1.02] border border-slate-200 dark:border-white/10 shadow-sm shadow-slate-200/50 dark:shadow-none group/action"
                                    >
                                        <Icon className="w-4 h-4 text-slate-400 dark:text-gray-500 group-hover/action:text-primary-600 dark:group-hover/action:text-primary-400 transition-colors" />
                                        {action.label}
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </div>

            {/* At Risk Customers Modal */}
            <Modal
                isOpen={showRiskModal}
                onClose={() => setShowRiskModal(false)}
                title="Clientes em Risco (Inactivos)"
                size="lg"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Estes clientes não realizam compras h algum tempo. Considere entrar em contacto com promoções específicas.
                    </p>
                    <div className="overflow-hidden border border-gray-100 dark:border-dark-700 rounded-lg">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-800 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Contacto</th>
                                    <th className="px-4 py-3">Inactivo há</th>
                                    <th className="px-4 py-3 text-right">Risco</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {atRiskCustomers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                        <td className="px-4 py-3 font-bold">{customer.name}</td>
                                        <td className="px-4 py-3 text-xs">{customer.phone}</td>
                                        <td className="px-4 py-3 font-medium text-amber-600">{customer.daysSinceLastPurchase} dias</td>
                                        <td className="px-4 py-3 text-right">
                                            <Badge 
                                                variant={
                                                    customer.riskLevel === 'critical' ? 'danger' : 
                                                    customer.riskLevel === 'high' ? 'warning' : 'info'
                                                }
                                                size="sm"
                                            >
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
