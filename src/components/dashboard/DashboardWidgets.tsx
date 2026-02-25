import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
} from 'react-icons/hi';
import { Card, Button, Badge, ResponsiveValue } from '../ui';
import { formatRelativeTime, cn } from '../../utils/helpers';

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const StatsWidget = ({ metrics, stats }: any) => {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <Card padding="md" className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-indigo-700 text-white shadow-lg">
                <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-white" />
                        </div>
                        <div className={cn(
                            'flex items-center gap-1 text-sm font-medium',
                            metrics.salesGrowth >= 0 ? 'text-green-300' : 'text-red-300'
                        )}>
                            {metrics.salesGrowth >= 0 ? <HiOutlineTrendingUp className="w-4 h-4" /> : <HiOutlineTrendingDown className="w-4 h-4" />}
                            {Math.abs(metrics.salesGrowth)}%
                        </div>
                    </div>
                    <ResponsiveValue value={stats?.totalRevenue || 0} size="xl" className="mb-1" />
                    <p className="text-sm text-white/80 font-medium">Faturação Consolidada</p>
                </div>
            </Card>

            <Card padding="md" className="border-t-4 border-t-primary-500 shadow-sm">
                <div className="flex items-center justify-between mb-3 text-gray-900 dark:text-white">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Desempenho por Módulo</h3>
                    <Badge variant="outline" size="sm" className="text-[10px]">Mensal</Badge>
                </div>
                <div className="space-y-3">
                    {stats?.commercialRevenue ? (
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-400">🛍️ Comercial</span>
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
                                <span className="text-gray-600 dark:text-gray-400">🏨 Hotelaria</span>
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
                                <span className="text-gray-600 dark:text-gray-400">💊 Farmácia</span>
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
                                <span className="text-gray-600 dark:text-gray-400">🍾 Bottle Store</span>
                                <ResponsiveValue value={stats.bottleStoreRevenue} size="sm" className="font-bold text-gray-900 dark:text-white" />
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-purple-500 h-full transition-all duration-1000" style={{ width: `${(stats.bottleStoreRevenue / stats.totalRevenue) * 100}%` }} />
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            <Card padding="md" className="relative overflow-hidden shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <HiOutlineCube className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <Badge variant={metrics.lowStock > 5 ? 'danger' : 'warning'}>{t('common.attention')}</Badge>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.lowStock}/{metrics.totalProducts}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.productsLow')}</p>
            </Card>

            <Card padding="md" className="relative overflow-hidden shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                        <HiOutlineUsers className="w-6 h-6 text-accent-600 dark:text-accent-400" />
                    </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.employees}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.activeEmployees')}</p>
            </Card>
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
                <ResponsiveContainer width="100%" height="100%">
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
        <Card padding="md" className="w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('dashboard.productsByCategory')}</h2>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
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
        <Card padding="md" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.pendingAlerts')}</h2>
                <Link to="/alerts"><Badge variant="danger">{metrics.pendingAlerts}</Badge></Link>
            </div>
            <div className="space-y-3">
                {alerts.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('dashboard.noPendingAlerts')}</p>
                ) : (
                    alerts.slice(0, 5).map((alert: any) => (
                        <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
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
        <Card padding="md" className="w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('dashboard.weeklySales')}
            </h2>
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
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
        <Card padding="md" className="w-full">
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
        <Card padding="md" className="w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('dashboard.quickActions')}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Link to="/pos">
                    <button className="w-full p-3 sm:p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('sales.newSale')}
                        </p>
                    </button>
                </Link>
                <Link to="/inventory">
                    <button className="w-full p-3 sm:p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineCube className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('dashboard.newProduct')}
                        </p>
                    </button>
                </Link>
                <Link to="/employees">
                    <button className="w-full p-3 sm:p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineUsers className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('nav.employees')}
                        </p>
                    </button>
                </Link>
                <Link to="/reports">
                    <button className="w-full p-3 sm:p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                        <HiOutlineCurrencyDollar className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                        <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600 break-words line-clamp-2">
                            {t('nav.reports')}
                        </p>
                    </button>
                </Link>
            </div>
        </Card>
    );
};
