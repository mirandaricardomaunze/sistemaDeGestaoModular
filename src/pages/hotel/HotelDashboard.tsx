import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
} from 'recharts';
import {
    HiOutlineCurrencyDollar,
    HiOutlineHome,
    HiOutlineUsers,
    HiOutlineCalendar,
    HiOutlineArrowRight,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineChartBar,
    HiOutlineExclamationCircle,
    HiOutlineBuildingOffice2
} from 'react-icons/hi2';
import { Card, Button, Badge, Skeleton } from '../../components/ui';
import type { BadgeVariant } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useHotelDashboardSummary, useRecentBookings } from '../../hooks/useHospitality';
import { MetricCard, CHART_COLORS } from '../../components/common/ModuleMetricCard';
import { ModulePeriodFilter } from '../../components/common/ModulePeriodFilter';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import type { TimePeriod } from '../../components/common/ModulePeriodFilter';


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

export default function HotelDashboard() {
    const { t } = useTranslation();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const { data: summary, isLoading, refetch: refetchDashboard } = useHotelDashboardSummary();
    const { data: recentBookingsData } = useRecentBookings(5);

    // Warm the offline cache for rooms so the hotel surface degrades gracefully.
    useEffect(() => {
        void import('../../services/offline/catalogPrefetch')
            .then(({ prefetchHospitality }) => prefetchHospitality())
            .catch(() => {});
    }, []);
    
    // Calculate metrics
    const recentBookings = recentBookingsData || [];
    const revenueChart = summary?.revenueChart || [];
    const weeklyChart = summary?.weeklyChart || [];
    const roomTypeData = summary?.roomTypeData || [];

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!summary) return null;
        return {
            totalRooms: summary.totalRooms || 0,
            occupiedRooms: summary.occupiedRooms || 0,
            availableRooms: summary.availableRooms || 0,
            occupancyRate: summary.occupancyRate || 0,
            todayRevenue: summary.todayRevenue || 0,
            monthRevenue: summary.monthRevenue || 0,
            todayCheckIns: summary.todayCheckIns || 0,
            todayCheckOuts: summary.todayCheckOuts || 0,
            pendingCheckouts: summary.pendingCheckouts || 0,
            monthlyGrowth: summary.monthlyGrowth || 0,
        };
    }, [summary]);

    // Status Badge Component
    const StatusBadge = ({ status }: { status: string }) => {
        const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
            'confirmed': { label: 'Confirmada', variant: 'info' },
            'checked_in': { label: 'Check-in', variant: 'success' },
            'checked_out': { label: 'Check-out', variant: 'gray' },
            'canceled': { label: 'Cancelada', variant: 'danger' },
            'pending': { label: 'Pendente', variant: 'warning' },
        };

        const { label, variant } = statusMap[status] || { label: status, variant: 'gray' as BadgeVariant };
        return <Badge variant={variant}>{label}</Badge>;
    };

    if (isLoading || !metrics) {
        return (
            <div className="space-y-6 animate-pulse p-4">
                <div className="space-y-2">
                    <Skeleton height={32} className="w-64" />
                    <Skeleton height={20} className="w-96" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i} className="h-32">
                            <Skeleton className="h-full w-full" />
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 h-96">
                        <Skeleton className="h-full w-full" />
                    </Card>
                    <Card className="h-96">
                        <Skeleton className="h-full w-full" />
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-primary-100 dark:bg-primary-500/15 border border-primary-200 dark:border-primary-500/25 flex items-center justify-center">
                            <HiOutlineBuildingOffice2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </span>
                        {t('hotel_module.dashboard.title')}
                    </h1>
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 ml-1">
                        {t('hotel_module.dashboard.subtitle')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white/40 dark:bg-dark-900/40 p-2 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
                    <div className="flex items-center bg-slate-100 dark:bg-dark-800 rounded-xl p-1 border border-slate-200 dark:border-white/5 shadow-inner">
                        <ModulePeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetchDashboard()}
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                    >
                        {t('common.refresh')}
                    </Button>

                    <Link to="/hospitality/rooms">
                        <Button 
                            size="sm" 
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            {t('hotel_module.reservations.checkIn')}
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineCurrencyDollar className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                    color="primary"
                    value={formatCurrency(metrics.monthRevenue)}
                    label={t('hotel_module.dashboard.metrics.monthlyRevenue')}
                    growth={metrics.monthlyGrowth}
                />
                <MetricCard
                    icon={<HiOutlineChartBar className="w-6 h-6 text-teal-600 dark:text-teal-400" />}
                    color="teal"
                    value={`${metrics.occupancyRate}%`}
                    label={t('hotel_module.dashboard.metrics.occupancyRate')}
                    badge={<Badge variant="success">Rate</Badge>}
                />
                <MetricCard
                    icon={<HiOutlineUsers className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
                    color="blue"
                    value={`${metrics.occupiedRooms}/${metrics.totalRooms}`}
                    label={t('hotel_module.dashboard.metrics.occupiedRooms')}
                    badge={<Badge variant="info">Live</Badge>}
                />
                <MetricCard
                    icon={<HiOutlineCalendar className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />}
                    color="yellow"
                    value={metrics.pendingCheckouts}
                    label={t('hotel_module.dashboard.metrics.pendingCheckouts')}
                    badge={<Badge variant={metrics.pendingCheckouts > 0 ? 'warning' : 'success'}>Pending</Badge>}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <Card padding="md" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            {t('hotel_module.dashboard.charts.revenueByPeriod')}
                        </h2>
                        <Link to="/hospitality/reports">
                            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">
                                {t('common.viewMore')}
                                <HiOutlineArrowRight className="w-3.5 h-3.5 ml-1.5 inline" />
                            </Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height={288}>
                            <AreaChart data={revenueChart} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200/50 dark:stroke-white/5" />
                                <XAxis tickLine={false} axisLine={false} dataKey="name" className="text-[10px] font-black uppercase tracking-wider" stroke="#94a3b8" />
                                <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" tickFormatter={(v) => formatCurrency(v).replace(',00', '')} />
                                <Tooltip content={<GlassmorphicTooltip formatter={formatCurrency} />} />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fill="url(#colorRevenue)"
                                    name={t('dashboard.revenue')}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Room Types */}
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
                        {t('hotel_module.dashboard.charts.roomTypes')}
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height={256}>
                            <PieChart>
                                <Pie
                                    data={roomTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={62}
                                    outerRadius={82}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {roomTypeData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="rgba(255,255,255,0.05)" />
                                    ))}
                                </Pie>
                                <Tooltip content={<GlassmorphicTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {roomTypeData.map((item, index) => (
                            <div key={item.type} className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-700/30 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: CHART_COLORS[index] }}
                                    />
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">
                                        {item.type}
                                    </span>
                                </div>
                                <span className="text-xs font-black text-slate-900 dark:text-white flex-shrink-0">
                                    {item.count}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Revenue */}
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
                        {t('hotel_module.dashboard.charts.weeklyRevenue')}
                    </h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height={192}>
                            <BarChart data={weeklyChart}>
                                <defs>
                                    <linearGradient id="hotelBarGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.85} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200/50 dark:stroke-white/5" />
                                <XAxis tickLine={false} axisLine={false} dataKey="name" stroke="#94a3b8" fontSize={10} />
                                <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `${v / 1000}k`} />
                                <Tooltip content={<GlassmorphicTooltip formatter={formatCurrency} />} />
                                <Bar dataKey="value" fill="url(#hotelBarGrad)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Alerts */}
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            {t('hotel_module.dashboard.alerts')}
                        </h2>
                        <Badge variant="warning">{metrics.pendingCheckouts}</Badge>
                    </div>
                    <div className="space-y-3">
                        {metrics.pendingCheckouts > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-sm">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    <HiOutlineExclamationCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight">Check-outs Pendentes</p>
                                    <p className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/60 uppercase mt-0.5">{metrics.pendingCheckouts} hóspedes para check-out hoje</p>
                                </div>
                            </div>
                        )}
                        {metrics.pendingCheckouts === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                                <HiOutlineExclamationCircle className="w-8 h-8 opacity-40 mb-1.5" />
                                <p className="text-sm font-semibold uppercase tracking-wide">{t('hotel_module.dashboard.noAlerts')}</p>
                            </div>
                        )}
                    </div>
                    <Link
                        to="/hospitality/rooms"
                        className="block mt-4 text-center text-xs font-black uppercase tracking-wider text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                    >
                        {t('common.viewAll')}
                    </Link>
                </Card>

                {/* Quick Stats */}
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
                        {t('dashboard.quickActions')}
                    </h2>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                                    <HiOutlineHome className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                                    {t('hotel_module.dashboard.metrics.availableRooms')}
                                </span>
                            </div>
                            <span className="text-2xl font-black text-emerald-600">
                                {metrics.availableRooms}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                                    <HiOutlineUsers className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-tight">
                                    {t('hotel_module.dashboard.metrics.todayCheckIns')}
                                </span>
                            </div>
                            <span className="text-2xl font-black text-blue-600">
                                {metrics.todayCheckIns}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-purple-500/5 dark:bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                                    <HiOutlineCurrencyDollar className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase tracking-tight">
                                    {t('hotel_module.dashboard.metrics.todayRevenue')}
                                </span>
                            </div>
                            <span className="text-lg font-black text-purple-600">
                                {formatCurrency(metrics.todayRevenue)}
                            </span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Recent Bookings Row */}
            <Card padding="none" className="overflow-hidden bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100/80 dark:border-white/5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                        {t('hotel_module.dashboard.recentBookings')}
                    </h2>
                    <Link to="/hospitality/reservations">
                        <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">
                            {t('common.viewAll')}
                            <HiOutlineArrowRight className="w-3.5 h-3.5 ml-1.5 inline" />
                        </Button>
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50">
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('hotel_module.reservations.guest')}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('hotel_module.rooms.number')}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('hotel_module.reservations.checkIn')}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('hotel_module.reservations.checkOut')}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('common.total')}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('common.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {recentBookings.length > 0 ? (
                                recentBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-medium text-xs">
                                                    {(booking.customerName || booking.guestName)?.charAt(0) || '?'}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {booking.customerName || booking.guestName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 dark:text-white">
                                                Quarto {booking.roomNumber}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {booking.roomType}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            {formatDate(booking.checkIn)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            {booking.checkOut ? formatDate(booking.checkOut) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(booking.totalPrice ?? booking.totalAmount)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={booking.status} />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        {t('common.noData')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Quick Actions */}
            <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
                    {t('hotel_module.dashboard.quickActions')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickActionCard
                        icon={HiOutlinePlus}
                        label={t('hotel_module.reservations.checkIn')}
                        description="Registo de entrada"
                        path="/hospitality/rooms"
                        color="primary"
                    />
                    <QuickActionCard
                        icon={HiOutlineCalendar}
                        label={t('hotel_module.reservations.calendar')}
                        description="Mapa de reservas"
                        path="/hospitality/reservations"
                        color="emerald"
                    />
                    <QuickActionCard
                        icon={HiOutlineUsers}
                        label={t('hotel_module.guests.title')}
                        description="Base de dados de hóspedes"
                        path="/hospitality/customers"
                        color="indigo"
                    />
                    <QuickActionCard
                        icon={HiOutlineChartBar}
                        label={t('nav.reports')}
                        description="Análise de ocupação"
                        path="/hospitality/reports"
                        color="purple"
                    />
                </div>
            </Card>
        </div>
    );
}
