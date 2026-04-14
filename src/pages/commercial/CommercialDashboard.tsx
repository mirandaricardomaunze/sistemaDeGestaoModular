import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
    HiOutlineLightBulb,
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
import { Card, Badge, Button, PageHeader } from '../../components/ui';
import { formatCurrency, cn } from '../../utils/helpers';
import { useDashboard } from '../../hooks/useDashboard';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { useCommercialAnalytics, useMarginAnalysis } from '../../hooks/useCommercial';
import { useCategories } from '../../hooks/useData';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// ── Mini stat card ───────────────────────────────────────────────────────────

interface MiniStatProps {
    label: string;
    value: string;
    sub?: string;
    color: string;
    icon: React.ElementType;
    onClick?: () => void;
    alert?: boolean;
}

function MiniStat({ label, value, sub, color, icon: Icon, onClick, alert }: MiniStatProps) {
    return (
        <div
            className={cn('relative p-4 rounded-2xl border border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-sm transition-all duration-300',
                onClick && 'cursor-pointer hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-1'
            )}
            onClick={onClick}
        >
            {alert && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
            <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-dark-800", color.split(' ').pop())}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.15em]">{label}</span>
            </div>
            <p className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{value}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-1 font-bold italic">{sub}</p>}
        </div>
    );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function CommercialDashboard() {
    const navigate = useNavigate();
    const { stats, salesChart, isLoading: dashLoading } = useDashboard();
    const { insights } = useSmartInsights();
    const { data: analytics, isLoading: analyticsLoading } = useCommercialAnalytics();
    const { data: marginData, isLoading: marginLoading } = useMarginAnalysis(30);
    const { categories, isLoading: categoriesLoading } = useCategories();

    const isLoading = dashLoading || analyticsLoading || marginLoading || categoriesLoading;

    const metrics = useMemo(() => {
        const totalRevenue = Number(stats?.commercialRevenue || stats?.totalRevenue || 0);
        const totalProfit = analytics?.grossProfit ?? (stats?.totalProfit || 0);
        const margin = analytics?.grossMargin ?? (totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0);

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
            <div className="space-y-6 animate-pulse">
                <div className="h-10 bg-gray-200 dark:bg-dark-700 rounded-lg w-1/4" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-200 dark:bg-dark-700 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-80 bg-gray-200 dark:bg-dark-700 rounded-xl" />
                    <div className="h-80 bg-gray-200 dark:bg-dark-700 rounded-xl" />
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
                            onClick={() => window.location.reload()} 
                            className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                            leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                        >
                            Actualizar
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
                            onClick={() => navigate('/pos')}
                        >
                            Novo Pedido
                        </Button>
                    </>
                }
            />

            {/* Smart Insights */}
            {insights && insights.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <HiOutlineLightBulb className="w-5 h-5 text-amber-500" />
                        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">Insights Inteligentes</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {insights.slice(0, 3).map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} />
                        ))}
                    </div>
                </div>
            )}

            {/* Main KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card variant="premium" padding="lg" className="border-l-4 border-l-primary-500 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300 group">
                    <div className="relative z-10">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Receita este Mês</p>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                                {formatCurrency(metrics.totalRevenue)}
                            </span>
                        </div>
                        <div className={cn('flex items-center text-xs font-bold mt-1',
                            metrics.salesGrowth >= 0 ? 'text-green-500' : 'text-red-500')}>
                            {metrics.salesGrowth >= 0 ? <HiOutlineArrowTrendingUp className="w-3.5 h-3.5 mr-1" /> : <HiOutlineArrowTrendingDown className="w-3.5 h-3.5 mr-1" />}
                            {Math.abs(metrics.salesGrowth).toFixed(1)}% vs mês anterior
                        </div>
                    </div>
                    <HiOutlineCurrencyDollar className="absolute right-[-8px] bottom-[-8px] w-20 h-20 text-primary-500/5 group-hover:text-primary-500/10 transition-colors" />
                </Card>

                <Card variant="premium" padding="lg" className="border-l-4 border-l-green-500 hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300 group">
                    <div className="relative z-10">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Lucro Bruto</p>
                        <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block tracking-tighter">
                            {formatCurrency(metrics.totalProfit)}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={metrics.margin >= 20 ? 'success' : metrics.margin >= 10 ? 'warning' : 'danger'} size="sm">
                                {metrics.margin.toFixed(1)}% margem
                            </Badge>
                            {metrics.marginTrend !== 0 && (
                                <span className={cn('text-xs font-bold', metrics.marginTrend >= 0 ? 'text-green-500' : 'text-red-500')}>
                                    {metrics.marginTrend >= 0 ? '+' : ''}{metrics.marginTrend.toFixed(1)}pp
                                </span>
                            )}
                        </div>
                    </div>
                    <HiOutlineArrowTrendingUp className="absolute right-[-8px] bottom-[-8px] w-20 h-20 text-green-500/5 group-hover:text-green-500/10 transition-colors" />
                </Card>

                <Card variant="premium" padding="lg" className="border-l-4 border-l-orange-500 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 group">
                    <div className="relative z-10">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">COGS (Custo Vendas)</p>
                        <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block tracking-tighter">
                            {formatCurrency(metrics.cogs)}
                        </span>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">
                            {metrics.totalRevenue > 0
                                ? `${(100 - metrics.margin).toFixed(1)}% da receita`
                                : 'Sem vendas este mês'
                            }
                        </p>
                    </div>
                    <HiOutlineShoppingCart className="absolute right-[-8px] bottom-[-8px] w-20 h-20 text-orange-500/5 group-hover:text-orange-500/10 transition-colors" />
                </Card>

                <Card variant="premium" padding="lg" className="border-l-4 border-l-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group">
                    <div className="relative z-10">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Vendas Hoje</p>
                        <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block tracking-tighter">
                            {formatCurrency(metrics.todaySales)}
                        </span>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">Compras OC: {formatCurrency(metrics.poSpend)}</p>
                    </div>
                    <HiOutlineChartBar className="absolute right-[-8px] bottom-[-8px] w-20 h-20 text-blue-500/5 group-hover:text-blue-500/10 transition-colors" />
                </Card>
            </div>

            {/* Secondary KPIs – Inventory, Turnover, POs, Reorder */}
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
                <Card padding="lg">
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
                    {/* Category Revenue Distribution */}
                    <Card padding="lg">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Receita por Categoria</h3>
                        <div className="h-52 flex items-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={marginData?.byCategory.slice(0, 5).map(c => ({ name: c.category, value: c.revenue })) || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        animationDuration={1500}
                                    >
                                        {marginData?.byCategory.slice(0, 5).map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number | undefined) => formatCurrency(Number(value || 0))}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-1/2 space-y-2">
                                {marginData?.byCategory.slice(0, 5).map((cat, i) => (
                                    <div key={cat.category} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        <span className="text-[11px] text-gray-600 dark:text-gray-400 capitalize truncate">{cat.category}</span>
                                        <span className="text-[11px] font-bold ml-auto">
                                            {((cat.revenue / (marginData?.byCategory.reduce((s, x) => s + x.revenue, 0) || 1)) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Category Product Distribution */}
                    <Card padding="lg">
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
                    <Card padding="md" className="bg-gradient-to-br from-slate-900 to-black text-white border-0 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/20 transition-colors" />
                        <h3 className="font-black mb-3 text-primary-400 text-[10px] uppercase tracking-widest relative z-10">Acções Rápidas</h3>
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
                                        className="flex items-center gap-2 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-gray-300 hover:text-white transition-all hover:scale-[1.02] border border-white/5"
                                    >
                                        <Icon className="w-3.5 h-3.5 text-primary-400" />
                                        {action.label}
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
