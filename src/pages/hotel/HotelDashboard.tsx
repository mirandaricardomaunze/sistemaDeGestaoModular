import { useMemo, useState } from 'react';
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
import { Card, Button, Badge, Skeleton, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useHotelDashboardSummary, useRecentBookings } from '../../hooks/useHospitality';
import { MetricCard, CHART_COLORS } from '../../components/common/ModuleMetricCard';
import { ModulePeriodFilter } from '../../components/common/ModulePeriodFilter';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import type { TimePeriod } from '../../components/common/ModulePeriodFilter';


export default function HotelDashboard() {
    const { t } = useTranslation();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const { data: summary, isLoading, refetch: refetchDashboard } = useHotelDashboardSummary();
    const { data: recentBookingsData } = useRecentBookings(5);
    
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
        const statusMap: Record<string, { label: string; variant: any }> = {
            'confirmed': { label: 'Confirmada', variant: 'info' },
            'checked_in': { label: 'Check-in', variant: 'success' },
            'checked_out': { label: 'Check-out', variant: 'default' },
            'canceled': { label: 'Cancelada', variant: 'danger' },
            'pending': { label: 'Pendente', variant: 'warning' },
        };

        const { label, variant } = statusMap[status] || { label: status, variant: 'default' };
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
        <div className="space-y-6">
            <PageHeader
                title={t('hotel_module.dashboard.title')}
                subtitle={t('hotel_module.dashboard.subtitle')}
                icon={<HiOutlineBuildingOffice2 className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <>
                        <Button
                            variant="ghost"
                            onClick={() => refetchDashboard()}
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                        >
                            {t('common.refresh')}
                        </Button>
                        <ModulePeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
                        <Link to="/hospitality/reports">
                            <Button variant="outline">
                                {t('nav.reports')}
                            </Button>
                        </Link>
                        <Link to="/hospitality/rooms">
                            <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                                {t('hotel_module.reservations.checkIn')}
                            </Button>
                        </Link>
                    </>
                }
            />

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
                    icon={<HiOutlineChartBar className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />}
                    color="secondary"
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
                <Card padding="md" color="slate" className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('hotel_module.dashboard.charts.revenueByPeriod')}
                        </h2>
                        <Link to="/hospitality/reports">
                            <Button variant="ghost" size="sm">
                                {t('common.viewMore')}
                                <HiOutlineArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height={288}>
                            <AreaChart data={revenueChart}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                <Card padding="md" color="slate">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        {t('hotel_module.dashboard.charts.roomTypes')}
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height={256}>
                            <PieChart>
                                <Pie
                                    data={roomTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {roomTypeData.map((_: any, index: any) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {roomTypeData.map((item: any, index: any) => (
                            <div key={item.name} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: CHART_COLORS[index] }}
                                    />
                                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="text-xs font-medium text-gray-900 dark:text-white flex-shrink-0">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Revenue */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        {t('hotel_module.dashboard.charts.weeklyRevenue')}
                    </h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height={192}>
                            <BarChart data={weeklyChart}>
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
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Alerts */}
                <Card padding="md">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('hotel_module.dashboard.alerts')}
                        </h2>
                        <Badge variant="warning">{metrics.pendingCheckouts}</Badge>
                    </div>
                    <div className="space-y-3">
                        {metrics.pendingCheckouts > 0 && (
                            <div className="flex items-start gap-4 p-4 bg-amber-100/40 dark:bg-amber-500/10 rounded-xl border border-amber-200/50 dark:border-amber-500/20 transition-all hover:scale-[1.01]">
                                <div className="w-12 h-12 rounded-xl bg-amber-200/60 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                                    <HiOutlineExclamationCircle className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-amber-900 dark:text-amber-400 uppercase tracking-tight">Check-outs Pendentes</p>
                                    <p className="text-xs font-bold text-amber-800/70 dark:text-amber-400/60 uppercase mt-0.5">{metrics.pendingCheckouts} hóspedes para check-out hoje</p>
                                </div>
                            </div>
                        )}
                        {metrics.pendingCheckouts === 0 && (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                {t('hotel_module.dashboard.noAlerts')}
                            </p>
                        )}
                    </div>
                    <Link
                        to="/hospitality/rooms"
                        className="block mt-4 text-center text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        {t('common.viewAll')}
                    </Link>
                </Card>

                {/* Quick Stats */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {t('dashboard.quickActions')}
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-emerald-100/40 dark:bg-emerald-500/10 rounded-xl border border-emerald-200/50 dark:border-emerald-500/20">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-200/60 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center justify-center shadow-inner">
                                    <HiOutlineHome className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-black text-emerald-900 dark:text-emerald-400 uppercase tracking-tight">
                                    {t('hotel_module.dashboard.metrics.availableRooms')}
                                </span>
                            </div>
                            <span className="text-2xl font-black text-emerald-600">
                                {metrics.availableRooms}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-blue-100/40 dark:bg-blue-500/10 rounded-xl border border-blue-200/50 dark:border-blue-500/20">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-200/60 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center shadow-inner">
                                    <HiOutlineUsers className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-black text-blue-900 dark:text-blue-400 uppercase tracking-tight">
                                    {t('hotel_module.dashboard.metrics.todayCheckIns')}
                                </span>
                            </div>
                            <span className="text-2xl font-black text-blue-600">
                                {metrics.todayCheckIns}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-purple-100/40 dark:bg-purple-500/10 rounded-xl border border-purple-200/50 dark:border-purple-500/20">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-200/60 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 flex items-center justify-center shadow-inner">
                                    <HiOutlineCurrencyDollar className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-black text-purple-900 dark:text-purple-400 uppercase tracking-tight">
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
            <Card padding="none" className="overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('hotel_module.dashboard.recentBookings')}
                    </h2>
                    <Link to="/hospitality/reservations">
                        <Button variant="ghost" size="sm">
                            {t('common.viewAll')}
                            <HiOutlineArrowRight className="w-4 h-4 ml-2" />
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
                                recentBookings.map((booking) => {
                                    const b = booking as any;
                                    return (
                                    <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-medium text-xs">
                                                    {b.customerName?.charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {b.customerName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 dark:text-white">
                                                Quarto {b.roomNumber}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {b.roomType}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            {formatDate(booking.checkIn)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            {booking.checkOut ? formatDate(booking.checkOut) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(b.totalPrice)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={booking.status} />
                                        </td>
                                    </tr>
                                    );
                                })
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
            <Card padding="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
