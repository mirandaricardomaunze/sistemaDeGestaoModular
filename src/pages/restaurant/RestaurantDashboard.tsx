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

export default function RestaurantDashboard() {
    const [range, setRange] = useState<TimeRange>('1M');
    const { data, isLoading: loading, refetch: refetchStats } = useRestaurantDashboard(range);
    const { insights } = useSmartInsights();

    const summary = (data?.summary || {
        totalRevenue: 0,
        activeTables: 0,
        pendingOrders: 0,
        avgPrepTime: 0,
        estimatedRevenue: 0,
        totalSales: 0,
        totalOrders: 0,
        avgTicket: 0,
        totalTables: 0,
        occupiedTables: 0,
        availableTables: 0,
        pendingReservations: 0
    }) as any;
    const stats_evol = data?.stats?.ordersOverTime || [];

    const categoryData = useMemo(() =>
        (data?.stats?.categoryDistribution || []).map((e: any, i: number) => ({ ...e, color: CHART_COLORS[i % CHART_COLORS.length] })),
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
                <Card padding="lg" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Evolução de Receita</h2>
                        <Link to="/restaurant/reports">
                            <Button variant="ghost" size="sm">Ver mais <HiOutlineArrowRight className="w-4 h-4 ml-2" /></Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height={288}>
                            <AreaChart data={stats_evol}>
                                <defs>
                                    <linearGradient id="colorRestá" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-dark-700" />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={v => `${v / 1000}k`} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                                <Area type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRestá)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card padding="lg" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Mix por Categoria</h2>
                    {categoryData.length > 0 ? (
                        <>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height={224}>
                                    <PieChart>
                                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                                            {categoryData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                {categoryData.map((item: any) => (
                                    <div key={item.name} className="flex items-center gap-2 min-w-0">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.name}</span>
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
                <Card padding="lg" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pedidos Recentes</h2>
                        <Link to="/restaurant/reports"><Button variant="ghost" size="sm">Ver Tudo</Button></Link>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-dark-700">
                        {((data as any)?.recentActivity || []).length === 0 ? (
                            <p className="text-center py-8 text-gray-500 text-sm">Sem pedidos recentes</p>
                        ) : (
                            ((data as any)?.recentActivity || []).slice(0, 6).map((sale: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200/50 dark:border-red-500/20 flex items-center justify-center shadow-inner transition-transform group-hover:scale-110">
                                            <HiOutlineCake className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {sale.table ? `Mesa ${sale.table.number}${sale.table.name ? ` "" ${sale.table.name}` : ''}` : 'Balcão'}
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

                <Card padding="lg" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Ações Rápidas</h2>
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
