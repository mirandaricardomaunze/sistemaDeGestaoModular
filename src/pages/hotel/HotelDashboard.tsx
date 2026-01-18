/**
 * Hotel Dashboard
 * 
 * Professional dashboard for hotel module with:
 * - Period filters (1m, 3m, 6m, 1y)
 * - Key metrics with growth indicators
 * - Occupancy charts (area, bar, pie)
 * - Recent alerts and activities
 * - Quick actions
 * 
 * Follows the same design patterns as the pharmacy dashboard
 * for consistency across modules.
 */

import { useState, useEffect, useMemo } from 'react';
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
} from 'recharts';
import {
    HiOutlineCurrencyDollar,
    HiOutlineHome,
    HiOutlineUsers,
    HiOutlineCalendar,
    HiOutlineTrendingUp,
    HiOutlineTrendingDown,
    HiOutlineArrowRight,
    HiOutlinePlus,
    HiOutlineRefresh,
    HiOutlineChartBar,
    HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { Card, Button, Badge, LoadingSpinner } from '../../components/ui';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { hospitalityAPI } from '../../services/api';

// Chart colors
const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Time period options
type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];


interface DashboardSummary {
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyRate: number;
    todayRevenue: number;
    monthRevenue: number;
    todayCheckIns: number;
    todayCheckOuts: number;
    pendingCheckouts: number;
    monthlyGrowth?: number;
    // Chart data
    revenueChart?: Array<{ name: string; revenue: number }>;
    weeklyChart?: Array<{ name: string; value: number }>;
    roomTypeData?: Array<{ name: string; value: number }>;
}

export default function HotelDashboard() {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [revenueChart, setRevenueChart] = useState<any[]>([]);
    const [weeklyChart, setWeeklyChart] = useState<any[]>([]);
    const [roomTypeData, setRoomTypeData] = useState<any[]>([]);
    const [recentBookings, setRecentBookings] = useState<any[]>([]);

    const fetchDashboard = async () => {
        try {
            setIsLoading(true);
            const [summaryData, bookingsData] = await Promise.all([
                hospitalityAPI.getDashboardSummary(),
                hospitalityAPI.getRecentBookings(5)
            ]);

            setSummary(summaryData);

            // Use real data from API
            setRevenueChart(summaryData.revenueChart || []);
            setWeeklyChart(summaryData.weeklyChart || []);
            setRoomTypeData(summaryData.roomTypeData || []);
            setRecentBookings(bookingsData || []);
        } catch (error) {
            console.error('Error fetching dashboard:', error);
            // Set empty data on error
            setRevenueChart([]);
            setWeeklyChart([]);
            setRoomTypeData([]);
            setRecentBookings([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [selectedPeriod]);

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
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Dashboard - Hotelaria
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Visão geral de ocupação, receitas e métricas hoteleiras
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {/* Refresh Button */}
                    <Button
                        variant="ghost"
                        onClick={fetchDashboard}
                        leftIcon={<HiOutlineRefresh className="w-5 h-5" />}
                    >
                        Actualizar
                    </Button>
                    {/* Period Filter */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        {periodOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedPeriod(option.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                                    selectedPeriod === option.value
                                        ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <Link to="/hospitality/reports">
                        <Button variant="outline">
                            Relatórios
                        </Button>
                    </Link>
                    <Link to="/hospitality/rooms">
                        <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                            Novo Check-in
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Month Revenue */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-primary-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <HiOutlineCurrencyDollar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className={cn(
                                'flex items-center gap-1 text-sm font-medium',
                                metrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                                {metrics.monthlyGrowth >= 0 ? (
                                    <HiOutlineTrendingUp className="w-4 h-4" />
                                ) : (
                                    <HiOutlineTrendingDown className="w-4 h-4" />
                                )}
                                {Math.abs(metrics.monthlyGrowth)}%
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(metrics.monthRevenue)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Receita Mensal
                        </p>
                    </div>
                </Card>

                {/* Occupancy Rate */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-secondary-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
                                <HiOutlineChartBar className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                            </div>
                            <Badge variant="success">Taxa</Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.occupancyRate}%
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Taxa de Ocupação
                        </p>
                    </div>
                </Card>

                {/* Occupied Rooms */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-blue-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <HiOutlineUsers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <Badge variant="info">Hoje</Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.occupiedRooms}/{metrics.totalRooms}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Quartos Ocupados
                        </p>
                    </div>
                </Card>

                {/* Pending Checkouts */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                        <div className="w-full h-full rounded-full bg-yellow-500/10" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <HiOutlineCalendar className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <Badge variant={metrics.pendingCheckouts > 0 ? 'warning' : 'success'}>
                                Pendentes
                            </Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.pendingCheckouts}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Check-outs Hoje
                        </p>
                    </div>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <Card padding="md" className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Receita por Período
                        </h2>
                        <Link to="/hospitality/reports">
                            <Button variant="ghost" size="sm">
                                Ver Mais
                                <HiOutlineArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
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
                                    name="Receita"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Room Types */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        Tipos de Quarto
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
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
                                    {roomTypeData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {roomTypeData.map((item, index) => (
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
                        Receita Semanal
                    </h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
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
                            Alertas
                        </h2>
                        <Badge variant="warning">{metrics.pendingCheckouts}</Badge>
                    </div>
                    <div className="space-y-3">
                        {metrics.pendingCheckouts > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600">
                                    <HiOutlineExclamationCircle className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        Check-outs Pendentes
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {metrics.pendingCheckouts} hóspedes para check-out hoje
                                    </p>
                                </div>
                            </div>
                        )}
                        {metrics.pendingCheckouts === 0 && (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                Nenhum alerta pendente
                            </p>
                        )}
                    </div>
                    <Link
                        to="/hospitality/ops"
                        className="block mt-4 text-center text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        Ver Todos os Quartos
                    </Link>
                </Card>

                {/* Quick Stats */}
                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Estatísticas Rápidas
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <HiOutlineHome className="w-4 h-4 text-green-600" />
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    Quartos Disponíveis
                                </span>
                            </div>
                            <span className="text-sm font-bold text-green-600">
                                {metrics.availableRooms}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <HiOutlineUsers className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    Check-ins Hoje
                                </span>
                            </div>
                            <span className="text-sm font-bold text-blue-600">
                                {metrics.todayCheckIns}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <HiOutlineCurrencyDollar className="w-4 h-4 text-purple-600" />
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    Receita Hoje
                                </span>
                            </div>
                            <span className="text-sm font-bold text-purple-600">
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
                        Reservas Recentes
                    </h2>
                    <Link to="/hospitality/reservations">
                        <Button variant="ghost" size="sm">
                            Ver Todas
                            <HiOutlineArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50">
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hóspede</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quarto</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-in</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-out</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {recentBookings.length > 0 ? (
                                recentBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-medium text-xs">
                                                    {booking.customerName.charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {booking.customerName}
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
                                            {booking.checkOut ? formatDate(booking.checkOut) : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(booking.totalPrice)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={booking.status} />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        Nenhuma reserva encontrada
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
                    Acções Rápidas
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link to="/hospitality/rooms">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlinePlus className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Novo Check-in
                            </p>
                        </button>
                    </Link>
                    <Link to="/hospitality/reservations">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineCalendar className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Reservas
                            </p>
                        </button>
                    </Link>
                    <Link to="/hospitality/customers">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineUsers className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Hóspedes
                            </p>
                        </button>
                    </Link>
                    <Link to="/hospitality/reports">
                        <button className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                            <HiOutlineChartBar className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-600 transition-colors" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-primary-600">
                                Relatórios
                            </p>
                        </button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
