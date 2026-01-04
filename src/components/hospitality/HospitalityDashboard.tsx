/**
 * HospitalityDashboard Component
 * Main dashboard for hotel analytics with KPIs, interactive charts, and period filtering
 */

import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';
import { Card, Button, SkeletonCard } from '../ui';
import {
    HiOutlineHome,
    HiOutlineCurrencyDollar,
    HiOutlineUsers,
    HiOutlineCalendar,
    HiOutlineRefresh,
    HiOutlineChartBar,
    HiOutlineChartPie,
} from 'react-icons/hi';
import type { DashboardPeriod } from '../../hooks/useHospitalityDashboard';
import useHospitalityDashboard from '../../hooks/useHospitalityDashboard';

// ============================================================================
// Custom Tooltip for Charts
// ============================================================================
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 p-3 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-sm text-gray-600 dark:text-gray-300">{entry.name}:</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatter ? formatter(entry.value) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

// ============================================================================
// Chart Colors
// ============================================================================
const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// ============================================================================
// Props Interface
// ============================================================================
interface HospitalityDashboardProps {
    className?: string;
}

// ============================================================================
// Main Component
// ============================================================================
export default function HospitalityDashboard({ className }: HospitalityDashboardProps) {
    const {
        period,
        setPeriod,
        isLoading,
        error,
        metrics,
        revenueChart,
        occupancyChart,
        roomTypesChart,
        consumptionChart,
        refetch,
        periodOptions
    } = useHospitalityDashboard('1m');

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 0 }).format(value) + ' MT';
    };

    // Calculate insights
    const insights = useMemo(() => {
        if (!metrics || revenueChart.length === 0) return null;

        const totalDays = revenueChart.length;
        const avgDailyRevenue = totalDays > 0 ? metrics.totalRevenue / totalDays : 0;
        const bestDay = revenueChart.reduce((best, day) =>
            day.total > (best?.total || 0) ? day : best, revenueChart[0]);

        return {
            avgDailyRevenue: Math.round(avgDailyRevenue),
            bestDay: bestDay?.date || '—',
            bestDayRevenue: bestDay?.total || 0,
            consumptionPercent: metrics.totalRevenue > 0
                ? Math.round((metrics.consumptionRevenue / metrics.totalRevenue) * 100)
                : 0
        };
    }, [metrics, revenueChart]);

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} className="h-24" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SkeletonCard className="h-80" />
                    <SkeletonCard className="h-80" />
                    <SkeletonCard className="h-80" />
                    <SkeletonCard className="h-80" />
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <Card className="p-8 text-center border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HiOutlineRefresh className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Erro ao carregar dados</h3>
                <p className="text-red-600 dark:text-red-400 mb-6 max-w-md mx-auto">{error}</p>
                <Button onClick={refetch} variant="primary">Tentar Novamente</Button>
            </Card>
        );
    }

    // Empty state
    if (!metrics || (revenueChart.length === 0 && occupancyChart.length === 0)) {
        return (
            <div className={`space-y-6 ${className}`}>
                {/* Header with Period Selector */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <HiOutlineChartBar className="w-6 h-6 text-primary-600" />
                            Dashboard de Hotelaria
                        </h2>
                        <p className="text-sm text-gray-500">Análise de performance e receitas</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex gap-1 bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
                            {periodOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setPeriod(opt.value as DashboardPeriod)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${period === opt.value
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={refetch} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
                            Actualizar
                        </Button>
                    </div>
                </div>

                <Card className="p-20 text-center flex flex-col items-center justify-center border-dashed border-2">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center mb-6 text-gray-400">
                        <HiOutlineChartBar className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sem dados para este período</h3>
                    <p className="text-gray-500 max-w-sm mb-8">
                        Não foram encontradas reservas ou facturação no período seleccionado para gerar as visualizações.
                    </p>
                    <Button onClick={() => setPeriod('1m')} variant="primary">Ver Último Mês</Button>
                </Card>
            </div>
        );
    }


    return (
        <div className={`space-y-8 ${className}`}>
            {/* Toolbar: Actions & Period Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                        <HiOutlineChartBar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Análise de Performance</h3>
                        <p className="text-[10px] text-gray-500 font-medium">Controle de receitas e ocupação</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 bg-gray-100 dark:bg-dark-900 rounded-lg p-1">
                        {periodOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setPeriod(opt.value as DashboardPeriod)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${period === opt.value
                                    ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm border border-gray-200 dark:border-dark-600'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={refetch} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {/* Total Revenue */}
                <Card className="p-5 bg-white dark:bg-dark-800 shadow-sm border border-gray-100 dark:border-dark-700 hover:border-primary-500 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                            <HiOutlineCurrencyDollar className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Receita Total</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(metrics?.totalRevenue || 0)}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">Acumulado período</p>
                </Card>

                {/* Today Revenue */}
                <Card className="p-5 bg-white dark:bg-dark-800 shadow-sm border border-gray-100 dark:border-dark-700 hover:border-primary-500 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-lg">
                            <HiOutlineCalendar className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Receita Hoje</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(metrics?.todayRevenue || 0)}</p>
                    <p className="text-[10px] text-green-500 mt-1 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Live
                    </p>
                </Card>

                {/* Occupancy Rate */}
                <Card className="p-5 bg-white dark:bg-dark-800 shadow-sm border border-gray-100 dark:border-dark-700 hover:border-primary-500 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                            <HiOutlineHome className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ocupação</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics?.occupancyRate || 0}%</p>
                    <div className="mt-2 h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: `${Math.min(metrics?.occupancyRate || 0, 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-1.5 font-bold uppercase tracking-tighter">
                        {metrics?.occupiedRooms} de {metrics?.totalRooms} quartos
                    </p>
                </Card>

                {/* Total Bookings */}
                <Card className="p-5 bg-white dark:bg-dark-800 shadow-sm border border-gray-100 dark:border-dark-700 hover:border-primary-500 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                            <HiOutlineUsers className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reservas</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics?.totalBookings || 0}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">
                        <span className="text-amber-500">+{metrics?.todayBookings || 0}</span> novas hoje
                    </p>
                </Card>

                {/* Avg Daily Rate */}
                <Card className="p-5 bg-white dark:bg-dark-800 shadow-sm border border-gray-100 dark:border-dark-700 hover:border-primary-500 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                            <HiOutlineChartPie className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Média/Res.</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(metrics?.avgDailyRate || 0)}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">Ticket médio ADR</p>
                </Card>

                {/* Active Guests */}
                <Card className="p-5 bg-white dark:bg-dark-800 shadow-sm border border-gray-100 dark:border-dark-700 hover:border-primary-500 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-lg">
                            <HiOutlineUsers className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hóspedes</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics?.activeGuests || 0}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold italic">Em estadia</p>
                </Card>
            </div>

            {/* Insights Bar */}
            {insights && (
                <div className="bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl p-4">
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-primary-600 dark:text-primary-400 font-semibold">Média Diária:</span>
                            <span className="text-gray-700 dark:text-gray-300">{formatCurrency(insights.avgDailyRevenue)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-primary-600 dark:text-primary-400 font-semibold">Melhor Dia:</span>
                            <span className="text-gray-700 dark:text-gray-300">{insights.bestDay} ({formatCurrency(insights.bestDayRevenue)})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-primary-600 dark:text-primary-400 font-semibold">Mix Consumos:</span>
                            <span className="text-gray-700 dark:text-gray-300">{insights.consumptionPercent}% da receita total</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Area Chart */}
                <Card className="p-6 border-none shadow-sm dark:bg-dark-800">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Fluxo de Receita</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueChart}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-dark-700" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Area type="monotone" dataKey="revenue" name="Alojamento" stackId="1" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                                <Area type="monotone" dataKey="consumption" name="Consumos" stackId="1" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorCons)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Occupancy Line Chart */}
                <Card className="p-6 border-none shadow-sm dark:bg-dark-800">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Ocupação Histórica (%)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={occupancyChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-dark-700" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} dy={10} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip formatter={(v: number) => `${v}%`} />} />
                                <Line type="monotone" dataKey="rate" name="Taxa de Ocupação" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Room Types Pie Chart */}
                <Card className="p-6 border-none shadow-sm dark:bg-dark-800">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Mix de Categorias</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={roomTypesChart as any[]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    nameKey="name"
                                    stroke="none"
                                >
                                    {roomTypesChart.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Top Consumptions Bar Chart */}
                <Card className="p-6 border-none shadow-sm dark:bg-dark-800">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Ranking de Consumos</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={consumptionChart} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-gray-100 dark:stroke-dark-700" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                                <Bar dataKey="revenue" name="Faturação" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}
