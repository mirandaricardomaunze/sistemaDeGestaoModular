/**
 * Logistics Reports Page
 * Analytics dashboard for deliveries, drivers, routes, and revenue
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge, Select, LoadingSpinner } from '../../components/ui';
import {
    HiOutlineDocumentChartBar,
    HiOutlineTruck,
    HiOutlineUsers,
    HiOutlineMap,
    HiOutlineCurrencyDollar,
    HiOutlineCheckCircle,
    HiOutlineArrowPath,
    HiOutlineCalendarDays,
    HiOutlineChartBar,
    HiOutlinePrinter,
    HiOutlineTableCells
} from 'react-icons/hi2';
import { useLogisticsReportsSummary, useLogisticsDashboard } from '../../hooks/useLogistics';
import { PageHeader } from '../../components/ui';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { format, subDays, startOfMonth } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);
};



export default function LogisticsReportsPage() {
    const { t } = useTranslation();
    const [period, setPeriod] = useState('30');

    // Calculate date range based on period
    const dateRange = useMemo(() => {
        const end = new Date();
        const start = period === 'month'
            ? startOfMonth(end)
            : subDays(end, parseInt(period) || 30);
        return {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd')
        };
    }, [period]);

    const { data: dashboard, isLoading: loadingDashboard, refetch: refetchDashboard } = useLogisticsDashboard();
    const { data: reportData, isLoading: loadingReport } = useLogisticsReportsSummary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
    });

    const isLoading = loadingDashboard || loadingReport;

    const deliveryStats = reportData?.summary ?? null;

    // Status distribution labels
    const statusDistribution = useMemo(() => {
        if (!reportData?.statusDistribution) return [];
        const statusLabels: Record<string, string> = {
            pending: t('logistics_module.deliveries.status.pending'),
            scheduled: t('logistics_module.deliveries.status.scheduled'),
            in_transit: t('logistics_module.deliveries.status.in_transit'),
            out_for_delivery: t('logistics_module.deliveries.status.out_for_delivery'),
            delivered: t('logistics_module.deliveries.status.delivered'),
            failed: t('logistics_module.deliveries.status.failed'),
            returned: t('logistics_module.deliveries.status.returned'),
            cancelled: t('logistics_module.deliveries.status.cancelled')
        };
        return reportData.statusDistribution.map(({ status, count }) => ({
            name: statusLabels[status] || status,
            value: count
        }));
    }, [reportData, t]);

    const driverPerformance = reportData?.driverPerformance ?? [];
    const routeUsage = reportData?.routeUsage ?? [];

    // Province distribution
    const provinceData = useMemo(() => {
        if (!dashboard?.stats.deliveriesByProvince) return [];
        return dashboard.stats.deliveriesByProvince
            .filter(p => p.province)
            .sort((a, b) => b.count - a.count);
    }, [dashboard]);

    // Export handler using summary data
    const handleExport = async (type: 'pdf' | 'excel') => {
        if (!reportData) return;
        const { exportAPI } = await import('../../services/api');
        const periodLabel = period === 'month' ? t('logistics_module.dashboard.periods.month') : `${period} dias`;
        const columns = [
            { header: t('logistics_module.deliveries.driver'), key: 'driver', width: 150 },
            { header: t('common.total'), key: 'total', width: 80 },
            { header: t('logistics_module.deliveries.status.delivered'), key: 'delivered', width: 80 },
            { header: t('logistics_module.deliveries.status.failed'), key: 'failed', width: 80 },
            { header: t('logistics_module.dashboard.kpis.conversion'), key: 'rate', width: 80 }
        ];
        const data = driverPerformance.map(d => ({
            driver: d.name,
            total: d.total,
            delivered: d.delivered,
            failed: d.failed,
            rate: `${d.successRate.toFixed(1)}%`
        }));
        await exportAPI.export({
            type,
            title: `${t('businessType.logistics').toUpperCase()}: ${t('logistics_module.dashboard.reports.logisticsReport')}`,
            subtitle: `${t('common.report')}: ${periodLabel} | ${t('logistics_module.dashboard.kpis.conversion')}: ${deliveryStats?.successRate.toFixed(1) ?? 0}%`,
            columns,
            data,
            filename: `Relatorio_Logistica_${new Date().getTime()}`
        });
    };

    if (isLoading) {
        return <LoadingSpinner size="xl" className="h-96" />;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('logistics_module.dashboard.reports.logisticsReport')}
                subtitle={t('nav.reports')}
                icon={<HiOutlineDocumentChartBar />}
                actions={
                    <div className="flex gap-2 items-center">
                        <Select
                            key="period-select"
                            options={[
                                { value: '7', label: t('logistics_module.dashboard.periods.today') }, // Should really be "Last 7 days"
                                { value: '30', label: t('logistics_module.dashboard.periods.month') },
                                { value: '90', label: t('logistics_module.dashboard.periods.3months') },
                                { value: 'month', label: t('logistics_module.dashboard.periods.month') }
                            ]}
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="w-40 min-h-[42px]"
                        />
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                            onClick={() => refetchDashboard()}
                        >
                            {t('common.update')}
                        </Button>
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineTableCells className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                            onClick={() => handleExport('excel')}
                        >
                            Excel
                        </Button>
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlinePrinter className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                            onClick={() => handleExport('pdf')}
                        >
                            PDF
                        </Button>
                    </div>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-primary-100/40 dark:bg-primary-900/20 border border-primary-200/50 dark:border-primary-800/30 shadow-card-strong transition-all hover:scale-[1.02] p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary-200/60 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-inner">
                            <HiOutlineTruck className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-primary-900 dark:text-white tracking-tighter">{deliveryStats?.total || 0}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-600/70 dark:text-primary-400/60">{t('logistics_module.dashboard.kpis.totalShipments')}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-green-100/40 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30 shadow-card-strong transition-all hover:scale-[1.02] p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-200/60 dark:bg-green-900/40 text-green-700 dark:text-green-300 shadow-inner">
                            <HiOutlineCheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-green-900 dark:text-white tracking-tighter">{deliveryStats?.successRate.toFixed(1) || 0}%</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-green-600/70 dark:text-green-400/60">{t('logistics_module.dashboard.kpis.conversion')}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-amber-100/40 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 shadow-card-strong transition-all hover:scale-[1.02] p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-200/60 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shadow-inner">
                            <HiOutlineCurrencyDollar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-amber-900 dark:text-white tracking-tighter">{formatCurrency(deliveryStats?.totalRevenue || 0)}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/70 dark:text-amber-400/60">{t('logistics_module.dashboard.kpis.deliveryRevenue')}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-blue-100/40 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 shadow-card-strong transition-all hover:scale-[1.02] p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-200/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-inner">
                            <HiOutlineCalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-blue-900 dark:text-white tracking-tighter">{deliveryStats?.avgDeliveryHours.toFixed(1) || 0}h</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 dark:text-blue-400/60">{t('logistics_module.routes.estimatedTime')}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution Pie Chart */}
                <Card variant="glass" className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiOutlineChartBar className="w-5 h-5 text-primary-500" />
                        {t('logistics_module.dashboard.charts.distribution')}
                    </h3>
                    {statusDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={statusDistribution}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {statusDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                            Sem dados para exibir
                        </div>
                    )}
                </Card>

                {/* Province Distribution Bar Chart */}
                <Card variant="glass" className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiOutlineMap className="w-5 h-5 text-primary-500" />
                        {t('logistics_module.dashboard.kpis.regions')}
                    </h3>
                    {provinceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={provinceData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="province" width={120} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                            Sem dados para exibir
                        </div>
                    )}
                </Card>
            </div>

            {/* Driver Performance Table */}
            <Card variant="glass" className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <HiOutlineUsers className="w-5 h-5 text-primary-500" />
                    {t('logistics_module.drivers.title')}
                </h3>
                {driverPerformance.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-dark-700 text-gray-500 text-sm">
                                    <th className="py-3 px-4">{t('logistics_module.deliveries.driver')}</th>
                                    <th className="py-3 px-4 text-center">{t('common.total')}</th>
                                    <th className="py-3 px-4 text-center">{t('logistics_module.deliveries.status.delivered')}</th>
                                    <th className="py-3 px-4 text-center">{t('logistics_module.deliveries.status.failed')}</th>
                                    <th className="py-3 px-4 text-center">{t('logistics_module.dashboard.kpis.conversion')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {driverPerformance.map((driver, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                        <td className="py-3 px-4 font-medium">{driver.name}</td>
                                        <td className="py-3 px-4 text-center">{driver.total}</td>
                                        <td className="py-3 px-4 text-center text-success-600">{driver.delivered}</td>
                                        <td className="py-3 px-4 text-center text-danger-600">{driver.failed}</td>
                                        <td className="py-3 px-4 text-center">
                                            <Badge variant={driver.successRate >= 90 ? 'success' : driver.successRate >= 70 ? 'warning' : 'danger'}>
                                                {driver.successRate.toFixed(1)}%
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-12 text-center text-gray-500">
                        {t('common.noData')}
                    </div>
                )}
            </Card>

            {/* Route Usage Table */}
            <Card variant="glass" className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <HiOutlineMap className="w-5 h-5 text-primary-500" />
                    {t('logistics_module.routes.title')}
                </h3>
                {routeUsage.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-dark-700 text-gray-500 text-sm">
                                    <th className="py-3 px-4">{t('logistics_module.deliveries.route')}</th>
                                    <th className="py-3 px-4 text-center">{t('logistics_module.deliveries.title')}</th>
                                    <th className="py-3 px-4 text-right">{t('dashboard.revenue')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {routeUsage.map((route, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                        <td className="py-3 px-4 font-medium">{route.name}</td>
                                        <td className="py-3 px-4 text-center">{route.count}</td>
                                        <td className="py-3 px-4 text-right font-medium text-success-600">{formatCurrency(route.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-12 text-center text-gray-500">
                        {t('common.noData')}
                    </div>
                )}
            </Card>

            {/* Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card variant="glass" className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiOutlineCurrencyDollar className="w-5 h-5 text-success-500" />
                        {t('financial.revenue')}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">{t('logistics_module.dashboard.kpis.deliveryRevenue')}</span>
                            <span className="font-bold text-lg">{formatCurrency(dashboard?.stats.deliveryRevenue || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">{t('logistics_module.dashboard.kpis.pickupRevenue')}</span>
                            <span className="font-bold text-lg">{formatCurrency(dashboard?.stats.pickupRevenue || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                            <span className="text-primary-700 dark:text-primary-300 font-medium">Receita Total</span>
                            <span className="font-bold text-xl text-primary-600">
                                {formatCurrency((dashboard?.stats.deliveryRevenue || 0) + (dashboard?.stats.pickupRevenue || 0))}
                            </span>
                        </div>
                    </div>
                </Card>

                <Card variant="glass" className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiOutlineTruck className="w-5 h-5 text-primary-500" />
                        {t('logistics_module.dashboard.stockOccupation')}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">{t('logistics_module.vehicles.statuses.available')}</span>
                            <span className="font-bold text-lg text-success-600">{dashboard?.stats.availableVehicles || 0} / {dashboard?.totals.vehicles || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">{t('logistics_module.drivers.statuses.available')}</span>
                            <span className="font-bold text-lg text-success-600">{dashboard?.stats.availableDrivers || 0} / {dashboard?.totals.drivers || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">{t('logistics_module.parcels.status.awaiting_pickup')}</span>
                            <span className="font-bold text-lg text-warning-600">{dashboard?.stats.pendingParcels || 0}</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
