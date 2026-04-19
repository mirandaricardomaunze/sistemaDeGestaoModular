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
    HiOutlineTrendingUp,
    HiOutlineTrendingDown,
    HiOutlineArrowRight,
    HiOutlineArrowUp,
    HiOutlineArrowDown,
    HiOutlineArrowsRightLeft,
    HiOutlineAdjustmentsHorizontal,
    HiOutlineTrash,
    HiOutlineReceiptRefund,
    HiOutlineClockHistory,
} from 'react-icons/hi2';
import { HiOutlineClock } from 'react-icons/hi';
import { Card, Button, Badge, ResponsiveValue } from '../ui';
import { formatRelativeTime, cn } from '../../utils/helpers';
import { productsAPI } from '../../services/api/products.api';
import type { StockMovement, MovementType } from '../../types';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9'];

export const StatsWidget = ({ metrics, stats }: any) => {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="relative group overflow-hidden rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300">
                        <HiOutlineCurrencyDollar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className={cn('flex items-center gap-1 text-xs font-black', metrics.salesGrowth >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {metrics.salesGrowth >= 0 ? <HiOutlineTrendingUp className="w-3.5 h-3.5" /> : <HiOutlineTrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(metrics.salesGrowth)}%
                    </div>
                </div>
                <ResponsiveValue value={stats?.totalRevenue || 0} size="xl" className="mb-1 text-gray-900 dark:text-white" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Faturação Consolidada</p>
                <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 transition-all duration-500 group-hover:w-full w-8" />
            </div>

            <Card padding="md" color="slate">
                <div className="flex items-center justify-between mb-3 text-gray-900 dark:text-white">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Desempenho por Módulo</h3>
                    <Badge variant="outline" size="sm" className="text-[10px]">Mensal</Badge>
                </div>
                <div className="space-y-3">
                    {stats?.commercialRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-400"> Comercial</span>
                                <ResponsiveValue value={stats.commercialRevenue} size="sm" className="font-bold text-gray-900 dark:text-white" />
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-primary-500 h-full transition-all duration-1000" style={{ width: `${(stats.commercialRevenue / stats.totalRevenue) * 100}%` }} />
                            </div>
                        </div>
                    ) : null}
                    {stats?.hospitalityRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-400">otelaria</span>
                                <ResponsiveValue value={stats.hospitalityRevenue} size="sm" className="font-bold text-gray-900 dark:text-white" />
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${(stats.hospitalityRevenue / stats.totalRevenue) * 100}%` }} />
                            </div>
                        </div>
                    ) : null}
                    {stats?.pharmacyRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-400">armácia</span>
                                <ResponsiveValue value={stats.pharmacyRevenue} size="sm" className="font-bold text-gray-900 dark:text-white" />
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-amber-500 h-full transition-all duration-1000" style={{ width: `${(stats.pharmacyRevenue / stats.totalRevenue) * 100}%` }} />
                            </div>
                        </div>
                    ) : null}
                    {stats?.bottleStoreRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-400">ottle Store</span>
                                <ResponsiveValue value={stats.bottleStoreRevenue} size="sm" className="font-bold text-gray-900 dark:text-white" />
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-purple-500 h-full transition-all duration-1000" style={{ width: `${(stats.bottleStoreRevenue / stats.totalRevenue) * 100}%` }} />
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            <div className="relative group overflow-hidden rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300">
                        <HiOutlineCube className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <Badge variant={metrics.lowStock > 5 ? 'danger' : 'warning'}>{t('common.attention')}</Badge>
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{metrics.lowStock}/{metrics.totalProducts}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{t('dashboard.productsLow')}</p>
                <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500 transition-all duration-500 group-hover:w-full w-8" />
            </div>

            <div className="relative group overflow-hidden rounded-xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-800/40 shadow-sm hover:shadow-md transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300">
                        <HiOutlineUsers className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{metrics.employees}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{t('dashboard.activeEmployees')}</p>
                <div className="absolute bottom-0 left-0 h-0.5 bg-cyan-500 transition-all duration-500 group-hover:w-full w-8" />
            </div>
        </div>
    );
};

export const RevenueChartWidget = ({ salesData }: { salesData: any[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" className="w-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.salesVsTarget')}</h2>
                <Link to="/reports">
                    <Button variant="ghost" size="sm">
                        {t('common.viewMore')}
                        <HiOutlineArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </Link>
            </div>
            <div className="h-72">
                <ResponsiveContainer width="100%" height={288}>
                    <AreaChart data={salesData}>
                        <defs>
                            <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-dark-700" />
                        <XAxis dataKey="name" className="text-sm" stroke="#94a3b8" />
                        <YAxis className="text-sm" stroke="#94a3b8" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--tooltip-bg, #fff)',
                                border: 'none',
                                borderRadius: '12px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                            }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="vendas" stroke="#6366f1" strokeWidth={3} fill="url(#colorVendas)" name="Vendas" />
                        <Line type="monotone" dataKey="meta" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Meta" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export const CategoryPieWidget = ({ categoryData }: { categoryData: any[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" color="slate" className="w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('dashboard.productsByCategory')}</h2>
            <div className="h-64">
                <ResponsiveContainer width="100%" height={256}>
                    <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                            {categoryData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
                {categoryData.slice(0, 4).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.name}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-white flex-shrink-0">{item.value}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export const RecentAlertsWidget = ({ alerts, metrics }: any) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" color="slate" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.pendingAlerts')}</h2>
                <Link to="/alerts"><Badge variant="danger">{metrics.pendingAlerts}</Badge></Link>
            </div>
            <div className="space-y-3">
                {alerts.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('dashboard.noPendingAlerts')}</p>
                ) : (
                    alerts.slice(0, 5).map((alert: any) => (
                        <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
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

export const WeeklySalesWidget = ({ weeklyData }: { weeklyData: any[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" color="slate" className="w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('dashboard.weeklySales')}
            </h2>
            <div className="h-48">
                <ResponsiveContainer width="100%" height={192}>
                    <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-dark-700" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            }}
                        />
                        <Bar dataKey="valor" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export const RecentActivityWidget = ({ recentActivities }: { recentActivities: any[] }) => {
    const { t } = useTranslation();
    return (
        <Card padding="md" color="slate" className="w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('dashboard.recentActivity')}
            </h2>
            <div className="space-y-4">
                {recentActivities.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                        {t('dashboard.noRecentActivity')}
                    </p>
                ) : recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm">{activity.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {activity.action}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {activity.detail}
                            </p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                            {activity.time}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export const QuickActionsWidget = () => {
    const { t } = useTranslation();
    return (
        <Card padding="md" color="slate" className="w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('dashboard.quickActions')}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Link to="/pos">
                    <button className="w-full p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('sales.newSale')}
                        </p>
                    </button>
                </Link>
                <Link to="/inventory">
                    <button className="w-full p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineCube className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('dashboard.newProduct')}
                        </p>
                    </button>
                </Link>
                <Link to="/employees">
                    <button className="w-full p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineUsers className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('nav.employees')}
                        </p>
                    </button>
                </Link>
                <Link to="/reports">
                    <button className="w-full p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineCurrencyDollar className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('nav.reports')}
                        </p>
                    </button>
                </Link>
            </div>
        </Card>
    );
};

// ── Movement type config ──────────────────────────────────────────────────────
const MOVEMENT_CONFIG: Record<MovementType, {
    label: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    qtyColor: string;
    sign: '+' | '-';
}> = {
    purchase:   { label: 'Compra',        icon: HiOutlineArrowDown,             iconBg: 'bg-green-100 dark:bg-green-900/30',   iconColor: 'text-green-600 dark:text-green-400',  qtyColor: 'text-green-600 dark:text-green-400',  sign: '+' },
    sale:       { label: 'Venda',          icon: HiOutlineArrowUp,               iconBg: 'bg-red-100 dark:bg-red-900/30',       iconColor: 'text-red-600 dark:text-red-400',      qtyColor: 'text-red-600 dark:text-red-400',      sign: '-' },
    return_in:  { label: 'Devolução In',   icon: HiOutlineReceiptRefund,         iconBg: 'bg-blue-100 dark:bg-blue-900/30',     iconColor: 'text-blue-600 dark:text-blue-400',    qtyColor: 'text-blue-600 dark:text-blue-400',    sign: '+' },
    return_out: { label: 'Devolução Out',  icon: HiOutlineReceiptRefund,         iconBg: 'bg-orange-100 dark:bg-orange-900/30', iconColor: 'text-orange-600 dark:text-orange-400',qtyColor: 'text-orange-600 dark:text-orange-400',sign: '-' },
    adjustment: { label: 'Ajuste',         icon: HiOutlineAdjustmentsHorizontal, iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400',qtyColor: 'text-purple-600 dark:text-purple-400',sign: '+' },
    expired:    { label: 'Expirado',       icon: HiOutlineTrash,                 iconBg: 'bg-red-100 dark:bg-red-900/30',       iconColor: 'text-red-600 dark:text-red-400',      qtyColor: 'text-red-600 dark:text-red-400',      sign: '-' },
    transfer:   { label: 'Transferência',  icon: HiOutlineArrowsRightLeft,       iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',     iconColor: 'text-cyan-600 dark:text-cyan-400',    qtyColor: 'text-cyan-600 dark:text-cyan-400',    sign: '±' as '+' },
    loss:       { label: 'Perda',          icon: HiOutlineTrash,                 iconBg: 'bg-gray-100 dark:bg-gray-800',        iconColor: 'text-gray-500 dark:text-gray-400',    qtyColor: 'text-gray-500 dark:text-gray-400',    sign: '-' },
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
        <Card padding="md" className="w-full">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <HiOutlineClock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Últimos Movimentos</h2>
                </div>
                <Link to="/stock-movements">
                    <Button variant="ghost" size="sm" className="text-xs">
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
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <HiOutlineClock className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">Sem movimentos registados</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {movements.map((mov) => {
                        const cfg = MOVEMENT_CONFIG[mov.movementType] ?? MOVEMENT_CONFIG.adjustment;
                        const Icon = cfg.icon;
                        const productName = (mov as any).product?.name ?? mov.reason ?? '—';
                        return (
                            <div key={mov.id} className="flex items-center gap-3 py-3 group hover:bg-gray-50 dark:hover:bg-dark-700/50 -mx-4 px-4 transition-colors duration-150 first:pt-0 last:pb-0">
                                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', cfg.iconBg)}>
                                    <Icon className={cn('w-4 h-4', cfg.iconColor)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{productName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400">
                                            {cfg.label}
                                        </span>
                                        {mov.warehouse?.name && (
                                            <span className="text-[10px] text-gray-400 truncate">{mov.warehouse.name}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                                    <span className={cn('text-sm font-black tabular-nums', cfg.qtyColor)}>
                                        {cfg.sign}{Math.abs(mov.quantity)}
                                    </span>
                                    <span className="text-[10px] text-gray-400">{formatRelativeTime(mov.createdAt)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
};
