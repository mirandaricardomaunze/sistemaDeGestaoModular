import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    HiOutlineCake, HiOutlineShoppingCart, HiOutlineBanknotes,
    HiOutlineArrowTrendingUp, HiOutlineArrowRight, HiOutlineArrowPath,
    HiOutlineLightBulb, HiOutlineUserGroup, HiOutlineFire, HiOutlineBookOpen,
    HiOutlinePlus,
} from 'react-icons/hi2';
import { Card, Button, Skeleton } from '../../components/ui';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { useRestaurantDashboard } from '../../hooks/useRestaurant';
import type {
    RestaurantDashboardCategory,
    RestaurantDashboardSummary,
    RestaurantRecentSale,
} from '../../types/restaurant';
import { MetricCard, StatCard } from '../../components/common/ModuleMetricCard';
import { QuickActionCard } from '../../components/common/QuickActionCard';


import { SegmentedControl } from '../../components/common/SegmentedControl';
import { cn, formatCurrency } from '../../utils';

const CHART_COLORS = ['#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#0ea5e9'];

const PERIOD_OPTIONS = [
    { label: '1 Mês', value: '1M' },
    { label: '3 Meses', value: '3M' },
    { label: '6 Meses', value: '6M' },
    { label: '1 Ano', value: '1Y' },
];

type TimeRange = '1M' | '3M' | '6M' | '1Y';

const GlassmorphicTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="backdrop-blur-md bg-white/95 dark:bg-dark-900/95 border border-slate-200/90 dark:border-white/10 p-3 rounded-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] z-50">
                {label && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>}
                {payload.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.name}:</span>
                        <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                            {formatter ? formatter(item.value) : item.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function RestaurantDashboard() {
    const [range, setRange] = useState<TimeRange>('1M');
    const { data, isLoading: loading, refetch: refetchStats } = useRestaurantDashboard(range);
    const { insights } = useSmartInsights();

    const summary: RestaurantDashboardSummary = data?.summary || {
        totalSales: 0,
        totalOrders: 0,
        avgTicket: 0,
        totalTables: 0,
        occupiedTables: 0,
        availableTables: 0,
    };
    const stats_evol = data?.chartData || [];

    type CategoryEntry = RestaurantDashboardCategory & { color: string };
    const categoryData = useMemo<CategoryEntry[]>(() =>
        (data?.categoryData || []).map((e, i) => ({ ...e, color: CHART_COLORS[i % CHART_COLORS.length] })),
        [data]
    );

    if (loading && !data) {
        return (
            <div className="space-y-6 animate-pulse p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2"><Skeleton height={32} className="w-48" /><Skeleton height={20} className="w-64" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Card key={i} padding="md"><Skeleton height={80} /></Card>)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2" padding="md"><Skeleton height={288} /></Card>
                    <Card padding="md"><Skeleton height={288} /></Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 animate-fade-in px-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25 flex items-center justify-center">
                            <HiOutlineCake className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </span>
                        Dashboard Restaurante
                    </h1>
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 ml-1">
                        Performance Operacional e Fluxo de Clientes
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white/40 dark:bg-dark-900/40 p-2 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
                    <SegmentedControl
                        options={PERIOD_OPTIONS}
                        value={range}
                        onChange={(val) => setRange(val as TimeRange)}
                    />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetchStats()}
                        leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4 text-red-600", loading && "animate-spin")} />}
                    >
                        {loading ? 'A carregar...' : 'Actualizar'}
                    </Button>

                    <Link to="/restaurant/pos">
                        <Button 
                            size="sm" 
                            variant="danger"
                            leftIcon={<HiOutlinePlus className="w-4 h-4 text-white" />}
                        >
                            Novo Pedido
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Smart Insights */}
            {insights.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 border border-transparent dark:border-amber-500/25 flex items-center justify-center backdrop-blur-sm">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-300" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conselheiro Inteligente</h2>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                        {insights.map(insight => <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />)}
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineBanknotes className="w-5 h-5" />}
                    color="danger"
                    value={formatCurrency(summary.totalRevenue || summary.totalSales)}
                    label="Receita Líquida"
                />
                <MetricCard
                    icon={<HiOutlineShoppingCart className="w-5 h-5" />}
                    color="orange"
                    value={summary.pendingOrders || summary.totalOrders}
                    label="Fluxo de Pedidos"
                />
                <MetricCard
                    icon={<HiOutlineFire className="w-5 h-5" />}
                    color="indigo"
                    value={summary.activeTables || summary.occupiedTables}
                    label="Mesas Ativas"
                />
                <MetricCard
                    icon={<HiOutlineCake className="w-5 h-5" />}
                    color="success"
                    value={`${summary.avgPrepTime} min`}
                    label="Prep. Médio"
                />
            </div>

            {/* Table Status Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    icon={<HiOutlineCake className="w-5 h-5" />}
                    color="success"
                    value={summary.availableTables}
                    label="Mesas Disponíveis"
                />
                <StatCard
                    icon={<HiOutlineShoppingCart className="w-5 h-5" />}
                    color="danger"
                    value={summary.occupiedTables}
                    label="Mesas Ocupadas"
                />
                <StatCard
                    icon={<HiOutlineArrowTrendingUp className="w-5 h-5" />}
                    color="info"
                    value={summary.totalTables}
                    label="Total de Mesas"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card padding="lg" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Evolução de Receita</h2>
                        <Link to="/restaurant/reports">
                            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">Ver mais <HiOutlineArrowRight className="w-3.5 h-3.5 ml-1.5 inline" /></Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height={288}>
                            <AreaChart data={stats_evol} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200/50 dark:stroke-white/5" />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => formatCurrency(v).replace(',00', '')} />
                                <Tooltip content={<GlassmorphicTooltip formatter={formatCurrency} />} />
                                <Area type="monotone" dataKey="amount" name="Receita" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRest)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card padding="lg" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">Mix por Categoria</h2>
                    {categoryData.length > 0 ? (
                        <>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height={224}>
                                    <PieChart>
                                        <Pie data={categoryData as unknown as Parameters<typeof Pie>[0]['data']} cx="50%" cy="50%" innerRadius={57} outerRadius={77} paddingAngle={4} dataKey="value">
                                            {categoryData.map((e, i) => <Cell key={i} fill={e.color} stroke="rgba(255,255,255,0.05)" />)}
                                        </Pie>
                                        <Tooltip content={<GlassmorphicTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                {categoryData.map((item) => (
                                    <div key={item.name} className="flex items-center gap-2 min-w-0 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-700/30 transition-colors">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Sem dados no período</div>
                    )}
                </Card>
            </div>

            {/* Recent Activity + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card padding="lg" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Pedidos Recentes</h2>
                        <Link to="/restaurant/reports"><Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">Ver Tudo</Button></Link>
                    </div>
                    <div className="divide-y divide-slate-100/70 dark:divide-white/5">
                        {(data?.recentActivity || []).length === 0 ? (
                            <p className="text-center py-8 text-gray-500 text-sm">Sem pedidos recentes</p>
                        ) : (
                            (data?.recentActivity || []).slice(0, 6).map((sale: RestaurantRecentSale, idx: number) => (
                                <div key={idx} className="flex items-center justify-between py-3 hover:bg-slate-50/50 dark:hover:bg-dark-700/20 px-1 rounded-lg transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-sm">
                                            <HiOutlineCake className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {sale.table ? `Mesa ${sale.table.number}${sale.table.name ? ` — ${sale.table.name}` : ''}` : 'Balcão'}
                                            </p>
                                            <p className="text-xs text-gray-500">{sale.receiptNumber}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(sale.total)}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                <Card padding="lg" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">Ações Rápidas</h2>
                    <div className="space-y-3">
                        <QuickActionCard
                            icon={HiOutlineShoppingCart}
                            label="Terminal POS"
                            description="Registo rápido de pedidos"
                            path="/restaurant/pos"
                            color="red"
                        />
                        <QuickActionCard
                            icon={HiOutlineFire}
                            label="Painel Cozinha"
                            description="Kitchen Display System (KDS)"
                            path="/restaurant/kitchen"
                            color="orange"
                        />
                        <QuickActionCard
                            icon={HiOutlineUserGroup}
                            label="Reservas"
                            description="Gestão de convidados"
                            path="/restaurant/reservations"
                            color="indigo"
                        />
                        <QuickActionCard
                            icon={HiOutlineBookOpen}
                            label="Cardápio / Menu"
                            description="Gestão de pratos e preços"
                            path="/restaurant/menu"
                            color="emerald"
                        />
                        <QuickActionCard
                            icon={HiOutlineCake}
                            label="Mesas"
                            description="Status e ocupação"
                            path="/restaurant/tables"
                            color="amber"
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
}
