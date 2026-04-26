import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, PageHeader, Modal, Skeleton } from '../../components/ui';
import {
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp,
    HiOutlineShoppingCart,
    HiOutlineCube,

    HiOutlineChartBar,
    HiOutlineClipboardDocumentList,
    HiOutlineExclamationTriangle,
    HiOutlineArrowPath,
    HiOutlinePresentationChartLine,
    HiOutlineUsers,
} from 'react-icons/hi2';
import {
    LineChart,
    Line,
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
import { MetricCard, StatCard } from '../../components/common/ModuleMetricCard';
import { QuickActionCard } from '../../components/common/QuickActionCard';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// ── Main Dashboard ──────────────────────────────────────────────────────────-

export default function CommercialDashboard() {
    const navigate = useNavigate();
    const { stats, salesChart, recentSales, isLoading: dashLoading, refetch: refetchDash } = useDashboard();
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
        // Prefer commercial-specific analytics over generic dashboard stats
        const totalRevenue = Number(analytics?.revenue ?? stats?.totalRevenue ?? 0);
        const cogs = analytics?.cogs ?? 0;
        const totalProfit = analytics?.grossProfit ?? stats?.totalProfit ?? 0;
        const margin = analytics?.grossMargin ?? (totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0);

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
        <div className="space-y-6 pb-20">
            <PageHeader 
                title="Dashboard Comercial"
                subtitle="Visão consolidada de vendas, margens e inventário comercial"
                icon={<HiOutlinePresentationChartLine className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-gray-400 hover:text-primary-600"
                        leftIcon={<HiOutlineArrowPath className={`w-4 h-4 text-primary-600 dark:text-primary-400 ${refreshing ? 'animate-spin' : ''}`} />}
                    >
                        {refreshing ? 'Actualizando...' : 'Actualizar Tudo'}
                    </Button>
                }
            />

            {/* 1. Quick Actions Bar - More prominent at the top */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Nova Venda', path: '/commercial/pos', icon: HiOutlineShoppingCart, color: 'emerald' },
                    { label: 'Nova OC', path: '/commercial/purchase-orders', icon: HiOutlineClipboardDocumentList, color: 'amber' },
                    { label: 'Stock', path: '/commercial/inventory', icon: HiOutlineCube, color: 'primary' },
                    { label: 'Relatórios', path: '/commercial/reports', icon: HiOutlineArrowTrendingUp, color: 'rose' },
                    { label: 'Clientes', path: '/commercial/customers', icon: HiOutlineUsers, color: 'indigo' },
                    { label: 'Margens', path: '/commercial/margins', icon: HiOutlinePresentationChartLine, color: 'cyan' },
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
                    color="success"
                    value={formatCurrency(metrics.totalProfit)}
                    label="Lucro Bruto"
                    badge={<Badge variant="success" size="sm">{metrics.margin.toFixed(1)}%</Badge>}
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

            {/* 3. Main Content Grid - Analytics & Management */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Deep Analytics (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Sales chart */}
                    <Card padding="lg">
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
                                <LineChart data={salesChart?.slice(-14) || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
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
                                        contentStyle={{
                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                            backdropFilter: 'blur(12px)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            fontSize: '12px',
                                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                                            padding: '12px'
                                        }}
                                        itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                                        formatter={(value: number | undefined) => [formatCurrency(Number(value || 0)), 'Receita']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3b82f6"
                                        strokeWidth={4}
                                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }}
                                        animationDuration={1500}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* ABC Pareto Chart */}
                    <ABCClassificationChart data={abcData} />
                </div>

                {/* Right Column: Operational Focus & Lists (1/3 width) */}
                <div className="space-y-6">
                    {/* Foco de Gestão - Compact Alerts */}
                    <div className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-slate-200 dark:border-dark-700 shadow-sm">
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

                    {/* Inventory Stats - Compact */}
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard
                            icon={<HiOutlineCube className="w-4 h-4" />}
                            color="slate"
                            value={formatCurrency(metrics.inventoryValue).split(',')[0]}
                            label="Inventário"
                            className="scale-95 origin-top-left"
                        />
                        <StatCard
                            icon={<HiOutlineArrowPath className="w-4 h-4" />}
                            color="cyan"
                            value={`${metrics.inventoryTurnover.toFixed(1)}x`}
                            label="Giro"
                            className="scale-95 origin-top-right"
                        />
                    </div>

                    {/* Últimas Vendas - List */}
                    <Card padding="md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-[11px] text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <HiOutlineClipboardDocumentList className="w-4 h-4 text-primary-500" />
                                Últimas Vendas
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {recentSales && recentSales.length > 0 ? recentSales.slice(0, 4).map((sale: any) => (
                                <div key={sale.id} className="flex justify-between items-center p-2.5 bg-indigo-50/30 dark:bg-dark-900/50 rounded-lg border border-indigo-100/50 dark:border-dark-700/50 hover:bg-indigo-50/50 transition-colors">
                                    <div className="min-w-0">
                                        <p className="font-bold text-[12px] text-gray-900 dark:text-white truncate">
                                            {sale.customerName || 'Cliente Final'}
                                        </p>
                                        <p className="text-[10px] text-gray-500 font-medium">
                                            #{sale.receiptNumber || sale.id.substring(0, 4)} • {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-black text-[12px] text-primary-600">
                                            {formatCurrency(sale.total || 0).split(',')[0]}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center py-4 text-[10px] font-bold text-gray-400 uppercase">Sem vendas</p>
                            )}
                        </div>
                    </Card>

                    {/* Category Distribution - Compact */}
                    <Card padding="md">
                        <h3 className="font-bold text-[11px] text-gray-500 uppercase tracking-widest mb-4">Mix de Produtos</h3>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryProductData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryProductData.map((_, index) => (
                                            <Cell key={`cell-prod-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
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
