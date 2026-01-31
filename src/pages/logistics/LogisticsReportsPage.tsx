/**
 * Logistics Reports Page
 * Analytics dashboard for deliveries, drivers, routes, and revenue
 */

import { useState, useMemo } from 'react';
import { Card, Button, Badge, Select, LoadingSpinner } from '../../components/ui';
import {
    HiOutlineDocumentChartBar,
    HiOutlineTruck,
    HiOutlineUsers,
    HiOutlineMap,
    HiOutlineCurrencyDollar,
    HiOutlineCheckCircle,
    HiOutlineArrowDownTray,
    HiOutlineArrowPath,
    HiOutlineCalendarDays,
    HiOutlineChartBar
} from 'react-icons/hi2';
import { useDeliveries, useDrivers, useDeliveryRoutes, useLogisticsDashboard } from '../../hooks/useLogistics';
import { exportAPI } from '../../services/api';
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
import { format, subDays, startOfMonth, parseISO } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);
};



export default function LogisticsReportsPage() {
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
    const { data: deliveriesData, isLoading: loadingDeliveries } = useDeliveries({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 1000
    });
    const { data: drivers } = useDrivers();
    const { data: routes } = useDeliveryRoutes();

    const isLoading = loadingDashboard || loadingDeliveries;

    // Calculate delivery statistics
    const deliveryStats = useMemo(() => {
        if (!deliveriesData?.deliveries) return null;

        const deliveries = deliveriesData.deliveries;
        const total = deliveries.length;
        const delivered = deliveries.filter(d => d.status === 'delivered').length;
        const failed = deliveries.filter(d => d.status === 'failed').length;
        const pending = deliveries.filter(d => d.status === 'pending').length;
        const inTransit = deliveries.filter(d => d.status === 'in_transit').length;

        const totalRevenue = deliveries
            .filter(d => d.isPaid)
            .reduce((sum, d) => sum + Number(d.shippingCost || 0), 0);

        const avgDeliveryTime = deliveries
            .filter(d => d.status === 'delivered' && d.deliveredDate && d.createdAt)
            .map(d => {
                const created = new Date(d.createdAt);
                const delivered = new Date(d.deliveredDate!);
                return (delivered.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
            });

        const avgHours = avgDeliveryTime.length > 0
            ? avgDeliveryTime.reduce((a, b) => a + b, 0) / avgDeliveryTime.length
            : 0;

        return {
            total,
            delivered,
            failed,
            pending,
            inTransit,
            successRate: total > 0 ? (delivered / total) * 100 : 0,
            totalRevenue,
            avgDeliveryHours: avgHours
        };
    }, [deliveriesData]);

    // Status distribution for pie chart
    const statusDistribution = useMemo(() => {
        if (!deliveriesData?.deliveries) return [];

        const counts: Record<string, number> = {};
        deliveriesData.deliveries.forEach(d => {
            counts[d.status] = (counts[d.status] || 0) + 1;
        });

        const statusLabels: Record<string, string> = {
            pending: 'Pendente',
            scheduled: 'Agendada',
            in_transit: 'Em Trânsito',
            out_for_delivery: 'Saiu para Entrega',
            delivered: 'Entregue',
            failed: 'Falhou',
            returned: 'Devolvida',
            cancelled: 'Cancelada'
        };

        return Object.entries(counts).map(([status, count]) => ({
            name: statusLabels[status] || status,
            value: count
        }));
    }, [deliveriesData]);

    // Driver performance
    const driverPerformance = useMemo(() => {
        if (!deliveriesData?.deliveries || !drivers) return [];

        const driverStats: Record<string, { name: string; total: number; delivered: number; failed: number }> = {};

        deliveriesData.deliveries
            .filter(d => d.driverId && d.driver)
            .forEach(d => {
                const driverId = d.driverId!;
                if (!driverStats[driverId]) {
                    driverStats[driverId] = {
                        name: d.driver!.name,
                        total: 0,
                        delivered: 0,
                        failed: 0
                    };
                }
                driverStats[driverId].total++;
                if (d.status === 'delivered') driverStats[driverId].delivered++;
                if (d.status === 'failed') driverStats[driverId].failed++;
            });

        return Object.values(driverStats)
            .map(ds => ({
                ...ds,
                successRate: ds.total > 0 ? (ds.delivered / ds.total) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [deliveriesData, drivers]);

    // Route usage
    const routeUsage = useMemo(() => {
        if (!deliveriesData?.deliveries || !routes) return [];

        const routeStats: Record<string, { name: string; count: number; revenue: number }> = {};

        deliveriesData.deliveries
            .filter(d => d.routeId && d.route)
            .forEach(d => {
                const routeId = d.routeId!;
                if (!routeStats[routeId]) {
                    routeStats[routeId] = {
                        name: d.route!.name,
                        count: 0,
                        revenue: 0
                    };
                }
                routeStats[routeId].count++;
                if (d.isPaid) {
                    routeStats[routeId].revenue += Number(d.shippingCost || 0);
                }
            });

        return Object.values(routeStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [deliveriesData, routes]);

    // Province distribution
    const provinceData = useMemo(() => {
        if (!dashboard?.stats.deliveriesByProvince) return [];
        return dashboard.stats.deliveriesByProvince
            .filter(p => p.province)
            .sort((a, b) => b.count - a.count);
    }, [dashboard]);

    // Unified Export Handler
    const handleExport = async (type: 'pdf' | 'excel') => {
        if (!deliveriesData?.deliveries) return;

        const periodLabel = period === 'month' ? 'Este Mês' : `Últimos ${period} dias`;

        const columns = [
            { header: 'Número', key: 'number', width: 100 },
            { header: 'Destinatário', key: 'recipient', width: 150 },
            { header: 'Endereço', key: 'address', width: 200 },
            { header: 'Motorista', key: 'driver', width: 120 },
            { header: 'Status', key: 'status', width: 100 },
            { header: 'Data', key: 'date', width: 100 },
            { header: 'Valor', key: 'value', width: 80 }
        ];

        const data = deliveriesData.deliveries.map(d => ({
            number: d.number,
            recipient: d.recipientName || '-',
            address: d.deliveryAddress,
            driver: d.driver?.name || '-',
            status: d.status,
            date: format(parseISO(d.createdAt), 'dd/MM/yyyy'),
            value: formatCurrency(Number(d.shippingCost || 0))
        }));

        await exportAPI.export({
            type,
            title: 'LOGÍSTICA: Relatório de Entregas',
            subtitle: `Período: ${periodLabel} | Suceso: ${deliveryStats?.successRate.toFixed(1)}%`,
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios de Logística</h1>
                    <p className="text-gray-500 dark:text-gray-400">Análise de desempenho e métricas</p>
                </div>
                <div className="flex gap-2">
                    <Select
                        options={[
                            { value: '7', label: 'Últimos 7 dias' },
                            { value: '30', label: 'Últimos 30 dias' },
                            { value: '90', label: 'Últimos 90 dias' },
                            { value: 'month', label: 'Este mês' }
                        ]}
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="w-40 h-[42px]"
                    />
                    <Button variant="outline" className="h-[42px]" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetchDashboard()}>
                        Actualizar
                    </Button>
                    <Button variant="outline" className="h-[42px]" leftIcon={<HiOutlineArrowDownTray className="w-5 h-5" />} onClick={() => handleExport('excel')}>
                        Gerar XLSX
                    </Button>
                    <Button className="h-[42px]" leftIcon={<HiOutlineDocumentChartBar className="w-5 h-5" />} onClick={() => handleExport('pdf')}>
                        Exportar PDF Profissional
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary-100 dark:bg-primary-900/30">
                            <HiOutlineTruck className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{deliveryStats?.total || 0}</p>
                            <p className="text-xs text-gray-500">Total Entregas</p>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success-100 dark:bg-success-900/30">
                            <HiOutlineCheckCircle className="w-6 h-6 text-success-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{deliveryStats?.successRate.toFixed(1) || 0}%</p>
                            <p className="text-xs text-gray-500">Taxa de Sucesso</p>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-warning-100 dark:bg-warning-900/30">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-warning-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{formatCurrency(deliveryStats?.totalRevenue || 0)}</p>
                            <p className="text-xs text-gray-500">Receita Total</p>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-info-100 dark:bg-info-900/30">
                            <HiOutlineCalendarDays className="w-6 h-6 text-info-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{deliveryStats?.avgDeliveryHours.toFixed(1) || 0}h</p>
                            <p className="text-xs text-gray-500">Tempo Médio</p>
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
                        Distribuição por Status
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
                        Entregas por Província
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
                    Desempenho por Motorista
                </h3>
                {driverPerformance.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-dark-700 text-gray-500 text-sm">
                                    <th className="py-3 px-4">Motorista</th>
                                    <th className="py-3 px-4 text-center">Total</th>
                                    <th className="py-3 px-4 text-center">Entregues</th>
                                    <th className="py-3 px-4 text-center">Falhas</th>
                                    <th className="py-3 px-4 text-center">Taxa de Sucesso</th>
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
                        Sem dados de motoristas para exibir
                    </div>
                )}
            </Card>

            {/* Route Usage Table */}
            <Card variant="glass" className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <HiOutlineMap className="w-5 h-5 text-primary-500" />
                    Rotas Mais Utilizadas
                </h3>
                {routeUsage.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-dark-700 text-gray-500 text-sm">
                                    <th className="py-3 px-4">Rota</th>
                                    <th className="py-3 px-4 text-center">Entregas</th>
                                    <th className="py-3 px-4 text-right">Receita</th>
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
                        Sem dados de rotas para exibir
                    </div>
                )}
            </Card>

            {/* Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card variant="glass" className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiOutlineCurrencyDollar className="w-5 h-5 text-success-500" />
                        Resumo de Receitas
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Receita de Entregas</span>
                            <span className="font-bold text-lg">{formatCurrency(dashboard?.stats.deliveryRevenue || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Receita de Levantamentos</span>
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
                        Resumo de Recursos
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Veículos Disponíveis</span>
                            <span className="font-bold text-lg text-success-600">{dashboard?.stats.availableVehicles || 0} / {dashboard?.totals.vehicles || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Motoristas Disponíveis</span>
                            <span className="font-bold text-lg text-success-600">{dashboard?.stats.availableDrivers || 0} / {dashboard?.totals.drivers || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Encomendas Pendentes</span>
                            <span className="font-bold text-lg text-warning-600">{dashboard?.stats.pendingParcels || 0}</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
