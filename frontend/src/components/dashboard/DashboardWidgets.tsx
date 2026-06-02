import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Line
} from 'recharts';
import {
    HiOutlineCurrencyDollar,
    HiOutlineShoppingCart,
    HiOutlineCube,
    HiOutlineUsers,
    HiOutlineExclamationCircle,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineArrowRight,
    HiOutlineArrowUp,
    HiOutlineArrowDown,
    HiOutlineArrowsRightLeft,
    HiOutlineAdjustmentsHorizontal,
    HiOutlineTrash,
    HiOutlineReceiptRefund,
    HiOutlineClock,
} from 'react-icons/hi2';
import { Card, Button, Badge, ResponsiveValue } from '../ui';
import { formatRelativeTime, cn, formatCurrency } from '../../utils/helpers';
import { productsAPI } from '../../services/api/products.api';
import type { StockMovement, MovementType } from '../../types';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9'];

type DashboardMetrics = {
    salesGrowth: number;
    lowStock: number;
    totalProducts: number;
    employees: number;
    pendingAlerts: number;
    grossProfit?: number;
    profitMargin?: number;
    stockCostValue?: number;
    stockSaleValue?: number;
    potentialProfit?: number;
};

type DashboardStatsLite = {
    totalRevenue?: number;
    commercialRevenue?: number;
    hospitalityRevenue?: number;
    pharmacyRevenue?: number;
    bottleStoreRevenue?: number;
} | null;

type SalesDataPoint = { name: string; vendas: number; meta: number };
type CategoryDataPoint = { name: string; value: number };
type WeeklyDataPoint = { name: string; valor: number };

type AlertItem = {
    id: string;
    title: string;
    createdAt: string;
    priority?: string;
};

type ActivityItem = {
    id: string;
    icon?: React.ElementType | string;
    action: string;
    detail?: string;
    time: string;
};

export const StatsWidget = ({ metrics, stats }: { metrics: DashboardMetrics; stats: DashboardStatsLite }) => {
    const { t } = useTranslation();
    const totalRevenue = stats?.totalRevenue ?? 0;
    const revenuePercent = (value?: number) => totalRevenue > 0 ? ((value ?? 0) / totalRevenue) * 100 : 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="relative group overflow-hidden rounded-xl bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-600 dark:bg-indigo-500/15 border border-indigo-600 dark:border-indigo-500/25 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300">
                        <HiOutlineCurrencyDollar className="w-6 h-6 text-white dark:text-indigo-400" />
                    </div>
                    <div className={cn('flex items-center gap-1 text-xs font-black', metrics.salesGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                        {metrics.salesGrowth >= 0 ? <HiOutlineArrowTrendingUp className="w-3.5 h-3.5" /> : <HiOutlineArrowTrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(metrics.salesGrowth)}%
                    </div>
                </div>
                <ResponsiveValue value={stats?.totalRevenue ?? 0} size="xl" className="mb-1 text-slate-950 dark:text-white" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">Faturação Consolidada</p>
                <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 transition-all duration-500 group-hover:w-full w-8" />
            </div>

            <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                <div className="flex items-center justify-between mb-3 text-slate-950 dark:text-white">
                    <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Desempenho por Módulo</h3>
                    <Badge variant="outline" size="sm" className="text-[10px]">Mensal</Badge>
                </div>
                <div className="space-y-3">
                    {stats?.commercialRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">Comercial</span>
                                <ResponsiveValue value={stats.commercialRevenue} size="sm" className="font-black text-slate-950 dark:text-white" />
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600/80 dark:to-indigo-500 h-full transition-all duration-1000" style={{ width: `${revenuePercent(stats.commercialRevenue)}%` }} />
                            </div>
                        </div>
                    ) : null}
                    {stats?.hospitalityRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">Hotelaria</span>
                                <ResponsiveValue value={stats.hospitalityRevenue} size="sm" className="font-black text-slate-950 dark:text-white" />
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600/80 dark:to-teal-500 h-full transition-all duration-1000" style={{ width: `${revenuePercent(stats.hospitalityRevenue)}%` }} />
                            </div>
                        </div>
                    ) : null}
                    {stats?.pharmacyRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">Farmácia</span>
                                <ResponsiveValue value={stats.pharmacyRevenue} size="sm" className="font-black text-slate-950 dark:text-white" />
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600/80 dark:to-amber-500 h-full transition-all duration-1000" style={{ width: `${revenuePercent(stats.pharmacyRevenue)}%` }} />
                            </div>
                        </div>
                    ) : null}
                    {stats?.bottleStoreRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">Bottle Store</span>
                                <ResponsiveValue value={stats.bottleStoreRevenue} size="sm" className="font-black text-slate-950 dark:text-white" />
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-purple-600/80 dark:to-purple-500 h-full transition-all duration-1000" style={{ width: `${revenuePercent(stats.bottleStoreRevenue)}%` }} />
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            <div className="relative group overflow-hidden rounded-xl bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-500 dark:bg-amber-500/15 border border-amber-500 dark:border-amber-500/25 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300">
                        <HiOutlineCube className="w-6 h-6 text-white dark:text-amber-400" />
                    </div>
                    <Badge variant={metrics.lowStock > 5 ? 'danger' : 'warning'}>{t('common.attention')}</Badge>
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white tracking-tighter">{metrics.lowStock}/{metrics.totalProducts}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">{t('dashboard.productsLow')}</p>
                <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500 transition-all duration-500 group-hover:w-full w-8" />
            </div>

            <div className="relative group overflow-hidden rounded-xl bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-cyan-600 dark:bg-cyan-500/15 border border-cyan-600 dark:border-cyan-500/25 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300">
                        <HiOutlineUsers className="w-6 h-6 text-white dark:text-cyan-400" />
                    </div>
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white tracking-tighter">{metrics.employees}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">{t('dashboard.activeEmployees')}</p>
                <div className="absolute bottom-0 left-0 h-0.5 bg-cyan-500 transition-all duration-500 group-hover:w-full w-8" />
            </div>
        </div>
    );
};

export const RevenueChartWidget = ({ salesData }: { salesData: SalesDataPoint[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" className="w-full bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">{t('dashboard.salesVsTarget')}</h2>
                <Link to="/reports">
                    <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">
                        {t('common.viewMore')}
                        <HiOutlineArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                </Link>
            </div>
            <div className="h-72">
                <ResponsiveContainer width="100%" height={288}>
                    <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} className="stroke-gray-200 dark:stroke-dark-700" />
                        <XAxis dataKey="name" className="text-[10px] font-bold" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis className="text-[10px] font-bold" stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val).split(',')[0]} />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-xl shadow-2xl text-[12px] text-slate-900 dark:text-white">
                                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                            <div className="space-y-1">
                                                {payload.map((pld, index) => {
                                                    const value = Number(pld.value ?? 0);
                                                    const isTarget = pld.dataKey === 'meta';
                                                    return (
                                                        <div key={index} className="flex items-center justify-between gap-4">
                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">{pld.name}:</span>
                                                            <span className={cn("text-sm font-black", isTarget ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-400")}>
                                                                {formatCurrency(value)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="vendas" stroke="#6366f1" strokeWidth={3} fill="url(#colorVendas)" name="Vendas" />
                        <Line type="monotone" dataKey="meta" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Meta" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export const CategoryPieWidget = ({ categoryData }: { categoryData: CategoryDataPoint[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" className="w-full bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">{t('dashboard.productsByCategory')}</h2>
            <div className="h-64">
                <ResponsiveContainer width="100%" height={256}>
                    <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                            {categoryData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const entry = payload[0];
                                    return (
                                        <div className="bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-xl shadow-2xl text-[12px] text-slate-900 dark:text-white">
                                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{entry.name}</p>
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">Produtos:</span>
                                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{entry.value}</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
                {categoryData.slice(0, 4).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-950 dark:text-white flex-shrink-0">{item.value}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export const RecentAlertsWidget = ({ alerts, metrics }: { alerts: AlertItem[]; metrics: DashboardMetrics }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.pendingAlerts')}</h2>
                <Link to="/alerts"><Badge variant="danger">{metrics.pendingAlerts}</Badge></Link>
            </div>
            <div className="space-y-3">
                {alerts.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('dashboard.noPendingAlerts')}</p>
                ) : (
                    alerts.slice(0, 5).map((alert) => (
                        <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-100/50 dark:bg-dark-700 rounded-lg border border-gray-200/50 dark:border-transparent">
                            <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                alert.priority === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                            )}>
                                <HiOutlineExclamationCircle className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{alert.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(alert.createdAt)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <Link to="/alerts" className="block mt-4 text-center text-sm text-primary-600 hover:underline">{t('dashboard.viewAllAlerts')}</Link>
        </Card>
    );
};

export const WeeklySalesWidget = ({ weeklyData }: { weeklyData: WeeklyDataPoint[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" className="w-full bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
                {t('dashboard.weeklySales')}
            </h2>
            <div className="h-48">
                <ResponsiveContainer width="100%" height={192}>
                    <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.6} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} className="stroke-gray-200 dark:stroke-dark-700" />
                        <XAxis dataKey="name" className="text-[10px] font-bold" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis className="text-[10px] font-bold" stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val).split(',')[0]} />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 p-3 rounded-xl shadow-2xl text-[12px] text-slate-900 dark:text-white">
                                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                            {payload.map((pld, index) => (
                                                <div key={index} className="flex items-center justify-between gap-4">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">{pld.name}:</span>
                                                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                                        {formatCurrency(Number(pld.value ?? 0))}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="valor" fill="url(#weeklyBarGradient)" radius={[4, 4, 0, 0]} name="Vendas" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export const RecentActivityWidget = ({ recentActivities }: { recentActivities: ActivityItem[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" className="w-full bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
                {t('dashboard.recentActivity')}
            </h2>
            <div className="space-y-4">
                {recentActivities.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">
                        {t('dashboard.noRecentActivity')}
                    </p>
                ) : recentActivities.map((activity) => {
                    const legacyIcon = typeof activity.icon === 'string' ? activity.icon : null;
                    const Icon = legacyIcon ? null : (activity.icon ?? HiOutlineClock);

                    return (
                        <div key={activity.id} className="flex items-start gap-3 p-2 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 rounded-lg transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-700/80 flex items-center justify-center flex-shrink-0 border border-slate-200/50 dark:border-white/5">
                                {Icon ? (
                                    <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                    <span className="text-sm leading-none">{legacyIcon}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {activity.action}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {activity.detail}
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 flex-shrink-0 uppercase">
                                {activity.time}
                            </span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export const QuickActionsWidget = () => {
    const { t } = useTranslation();
    return (
        <Card padding="md" className="w-full bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
                {t('dashboard.quickActions')}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Link to="/pos">
                    <Button className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-all group bg-transparent">
                        <HiOutlineShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 break-words line-clamp-2 uppercase tracking-wide">
                            {t('sales.newSale')}
                        </p>
                    </Button>
                </Link>
                <Link to="/inventory">
                    <Button className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-all group bg-transparent">
                        <HiOutlineCube className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 break-words line-clamp-2 uppercase tracking-wide">
                            {t('dashboard.newProduct')}
                        </p>
                    </Button>
                </Link>
                <Link to="/employees">
                    <Button className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-all group bg-transparent">
                        <HiOutlineUsers className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 break-words line-clamp-2 uppercase tracking-wide">
                            {t('nav.employees')}
                        </p>
                    </Button>
                </Link>
                <Link to="/reports">
                    <Button className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-all group bg-transparent">
                        <HiOutlineCurrencyDollar className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 break-words line-clamp-2 uppercase tracking-wide">
                            {t('nav.reports')}
                        </p>
                    </Button>
                </Link>
            </div>
        </Card>
    );
};

// ─── Movement type config ──────────────────────────────────────────────────────
const MOVEMENT_CONFIG: Record<MovementType, {
    label: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    qtyColor: string;
    sign: '+' | '-' | '±';
}> = {
    purchase:   { label: 'Compra',        icon: HiOutlineArrowDown,             iconBg: 'bg-emerald-500/10 border border-emerald-500/20',   iconColor: 'text-emerald-600 dark:text-emerald-400',  qtyColor: 'text-emerald-600 dark:text-emerald-400',  sign: '+' },
    sale:       { label: 'Venda',          icon: HiOutlineArrowUp,               iconBg: 'bg-rose-500/10 border border-rose-500/20',       iconColor: 'text-rose-600 dark:text-rose-400',      qtyColor: 'text-rose-600 dark:text-rose-400',      sign: '-' },
    return_in:  { label: 'Devolução In',   icon: HiOutlineReceiptRefund,         iconBg: 'bg-blue-500/10 border border-blue-500/20',     iconColor: 'text-blue-600 dark:text-blue-400',    qtyColor: 'text-blue-600 dark:text-blue-400',    sign: '+' },
    return_out: { label: 'Devolução Out',  icon: HiOutlineReceiptRefund,         iconBg: 'bg-amber-500/10 border border-amber-500/20', iconColor: 'text-amber-600 dark:text-amber-400',qtyColor: 'text-amber-600 dark:text-amber-400',sign: '-' },
    adjustment: { label: 'Ajuste',         icon: HiOutlineAdjustmentsHorizontal, iconBg: 'bg-purple-500/10 border border-purple-500/20', iconColor: 'text-purple-600 dark:text-purple-400',qtyColor: 'text-purple-600 dark:text-purple-400',sign: '+' },
    expired:    { label: 'Expirado',       icon: HiOutlineTrash,                 iconBg: 'bg-rose-500/10 border border-rose-500/20',       iconColor: 'text-rose-600 dark:text-rose-400',      qtyColor: 'text-rose-600 dark:text-rose-400',      sign: '-' },
    transfer:   { label: 'Transferência',  icon: HiOutlineArrowsRightLeft,       iconBg: 'bg-cyan-500/10 border border-cyan-500/20',     iconColor: 'text-cyan-600 dark:text-cyan-400',    qtyColor: 'text-cyan-600 dark:text-cyan-400',    sign: '±' },
    loss:       { label: 'Perda',          icon: HiOutlineTrash,                 iconBg: 'bg-slate-500/10 border border-slate-500/20',        iconColor: 'text-slate-500 dark:text-slate-400',    qtyColor: 'text-slate-600 dark:text-slate-400',    sign: '-' },
};

export const RecentMovementsWidget = () => {
    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', 'recent-movements'],
        queryFn: () => productsAPI.getStockMovements({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
        staleTime: 60_000,
    });

    const movements: (StockMovement & { product?: { name: string } })[] =
        Array.isArray(data) ? data : (data?.data ?? []);

    return (
        <Card padding="md" className="w-full bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <HiOutlineClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Últimos Movimentos</h2>
                </div>
                <Link to="/stock-movements">
                    <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">
                        Ver todos <HiOutlineArrowRight className="w-3.5 h-3.5 ml-1 inline" />
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-dark-700 flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 bg-gray-100 dark:bg-dark-700 rounded w-2/3" />
                                <div className="h-2.5 bg-gray-100 dark:bg-dark-700 rounded w-1/2" />
                            </div>
                            <div className="h-3 bg-gray-100 dark:bg-dark-700 rounded w-12" />
                        </div>
                    ))}
                </div>
            ) : movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <HiOutlineClock className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm font-semibold">Sem movimentos registados</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100 dark:divide-dark-700">
                    {movements.map((mov) => {
                        const cfg = MOVEMENT_CONFIG[mov.movementType] ?? MOVEMENT_CONFIG.adjustment;
                        const Icon = cfg.icon;
                        const productName = mov.product?.name ?? mov.reason ?? '—';
                        return (
                            <div key={mov.id} className="flex items-center gap-3 py-3 group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 -mx-4 px-4 transition-colors duration-150 first:pt-0 last:pb-0">
                                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', cfg.iconBg)}>
                                    <Icon className={cn('w-4 h-4', cfg.iconColor)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{productName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-white/5">
                                            {cfg.label}
                                        </span>
                                        {mov.warehouse?.name && (
                                            <span className="text-[10px] text-slate-400 font-bold tracking-wide truncate">{mov.warehouse.name}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                                    <span className={cn('text-sm font-black tabular-nums', cfg.qtyColor)}>
                                        {cfg.sign}{Math.abs(mov.quantity)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{formatRelativeTime(mov.createdAt)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
};
