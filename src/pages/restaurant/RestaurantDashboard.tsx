import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    HiOutlineRefresh,
    HiOutlineShoppingCart, HiOutlineCash,
    HiOutlineTrendingUp, HiOutlineArrowRight,
    HiOutlineBookOpen,
} from 'react-icons/hi';


import { HiOutlineCake } from 'react-icons/hi2';
import { Card, Button, Skeleton } from '../../components/ui';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { useRestaurantDashboard } from '../../hooks/useRestaurant';
import { HiOutlineLightBulb, HiOutlineUserGroup, HiOutlineFire } from 'react-icons/hi2';


import { cn, formatCurrency } from '../../utils';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9'];
type TimeRange = '1M' | '2M' | '3M' | '6M' | '1Y';

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
            {/* ── Soft Premium Header ── */}
            <div className="relative overflow-hidden rounded-lg bg-red-100 dark:bg-red-900/30 p-8 shadow-md shadow-red-500/5 border-none text-red-950 dark:text-red-50">
                <HiOutlineCake className="absolute right-4 top-1/2 -translate-y-1/2 w-48 h-48 opacity-10 rotate-12 text-red-600" aria-hidden="true" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-red-100 font-bold uppercase tracking-widest text-[10px]">
                            <HiOutlineTrendingUp className="w-3 h-3" />
                            Gestão de Excelência
                        </div>
                        <h1 className="text-3xl font-black">Restaurante</h1>
                        <p className="text-red-100/70 text-sm max-w-md">Performance operacional em tempo real e análise de fluxo de clientes.</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1 bg-white/50 dark:bg-black/20 backdrop-blur-md rounded-lg p-1 border border-red-200/50 dark:border-white/10">
                            {(['1M', '2M', '3M', '6M', '1Y'] as TimeRange[]).map(r => (
                                <button key={r} onClick={() => setRange(r)}
                                    className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all',
                                        range === r ? 'bg-white text-red-700 shadow-md' : 'text-red-900/60 dark:text-white/60 hover:text-red-700 dark:hover:text-white hover:bg-white/20'
                                    )}>{r}</button>
                            ))}
                        </div>
                        <Button 
                            variant="ghost" 
                            onClick={() => refetchStats()} 
                            className="text-red-600 dark:text-white hover:bg-white/20"
                            leftIcon={<HiOutlineRefresh className={cn("w-5 h-5", loading && "animate-spin")} />}
                        >
                            Atualizar
                        </Button>
                    </div>
                </div>
            </div>

            {/* Smart Insights */}
            {insights.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600" />
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
                {[
                    { label: 'Receita Líquida', value: summary.totalRevenue || summary.totalSales, type: 'currency', icon: HiOutlineCash,
                      cardBg: 'bg-red-50/60 dark:bg-red-950/30', cardBorder: 'border border-red-200/70 dark:border-red-800/40',
                      iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-400', accent: 'bg-red-500' },
                    { label: 'Fluxo de Pedidos', value: summary.pendingOrders || summary.totalOrders, type: 'number', icon: HiOutlineShoppingCart,
                      cardBg: 'bg-orange-50/60 dark:bg-orange-950/30', cardBorder: 'border border-orange-200/70 dark:border-orange-800/40',
                      iconBg: 'bg-orange-100 dark:bg-orange-900/40', iconColor: 'text-orange-600 dark:text-orange-400', accent: 'bg-orange-500' },
                    { label: 'Mesas Ativas', value: summary.activeTables || summary.occupiedTables, type: 'number', icon: HiOutlineFire,
                      cardBg: 'bg-indigo-50/60 dark:bg-indigo-950/30', cardBorder: 'border border-indigo-200/70 dark:border-indigo-800/40',
                      iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-400', accent: 'bg-indigo-500' },
                    { label: 'Prep. Médio (min)', value: summary.avgPrepTime, type: 'number', icon: HiOutlineCake,
                      cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/30', cardBorder: 'border border-emerald-200/70 dark:border-emerald-800/40',
                      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
                ].map(({ label, value, type, icon: Icon, cardBg, cardBorder, iconBg, iconColor, accent }) => (
                    <div key={label} className={`relative group overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ${cardBg} ${cardBorder}`}>
                        <div className="p-5">
                            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4 shadow-sm transition-transform group-hover:scale-110 duration-300', iconBg, iconColor)}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {type === 'currency' ? formatCurrency(value) : value}
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1">{label}</p>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-8 ${accent}`} />
                    </div>
                ))}
            </div>

            {/* Table Status Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md" color="emerald">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center shadow-sm">
                            <HiOutlineCake className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Mesas Disponíveis</p>
                            <p className="text-2xl font-bold text-emerald-600">{summary.availableTables}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md" color="danger">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center shadow-sm">
                            <HiOutlineShoppingCart className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Mesas Ocupadas</p>
                            <p className="text-2xl font-bold text-red-600">{summary.occupiedTables}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md" color="info">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center shadow-sm">
                            <HiOutlineTrendingUp className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total de Mesas</p>
                            <p className="text-2xl font-bold text-blue-600">{summary.totalTables}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card padding="md" color="slate" className="lg:col-span-2">
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

                <Card padding="md" color="slate">
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
                <Card padding="md" className="lg:col-span-2">
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
                                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
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

                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Ações Rápidas</h2>
                    <div className="space-y-3">
                        {[
                            { to: '/restaurant/pos', icon: HiOutlineShoppingCart, color: 'red', label: 'Terminal POS', desc: 'Registo rápido de pedidos' },
                            { to: '/restaurant/kitchen', icon: HiOutlineFire, color: 'orange', label: 'Painel Cozinha', desc: ' Kitchen Display System (KDS)' },
                            { to: '/restaurant/reservations', icon: HiOutlineUserGroup, color: 'indigo', label: 'Reservas', desc: 'Gestão de convidados' },
                            { to: '/restaurant/menu', icon: HiOutlineBookOpen, color: 'emerald', label: 'Cardápio / Menu', desc: 'Gestão de pratos e preços' },
                            { to: '/restaurant/tables', icon: HiOutlineCake, color: 'amber', label: 'Mesas', desc: 'Status e ocupação' },
                        ].map(({ to, icon: Icon, color, label, desc }) => (
                            <Link key={to} to={to}>
                                <button className={cn(
                                    'w-full flex items-center gap-4 p-4 rounded-lg border border-gray-100 dark:border-dark-700 transition-all group text-left',
                                    `hover:border-${color}-500 hover:bg-${color}-50 dark:hover:bg-${color}-900/10`
                                )}>
                                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110', `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600`)}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{label}</p>
                                        <p className="text-xs text-gray-500">{desc}</p>
                                    </div>
                                </button>
                            </Link>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
