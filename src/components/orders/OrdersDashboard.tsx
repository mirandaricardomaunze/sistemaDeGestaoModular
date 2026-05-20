import { useState, useMemo } from 'react';
import {
    HiOutlineClipboardDocumentList as HiOutlineClipboardDocumentList,
    HiOutlineClock,
    HiOutlineExclamationTriangle as HiOutlineExclamationTriangle,
    HiOutlineCheck,
    HiOutlineEye,
    HiOutlinePrinter,
    HiOutlineFunnel as HiOutlineFilter,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineCube,
    HiOutlineDocumentText,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
} from 'react-icons/hi2';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from 'recharts';
import { format, isToday, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, Button, Badge, Input, Select, Pagination, TableContainer, PageHeader } from '../ui';
import { MetricCard } from '../common/ModuleMetricCard';
import { formatCurrency, cn } from '../../utils/helpers';
import type { OrderStatus } from './OrderStatusTracker';

interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    items: OrderItem[];
    total: number;
    status: OrderStatus;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdAt: string;
    deliveryDate: string;
    assignedTo?: string;
}

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface OrdersDashboardProps {
    orders: Order[];
    pagination: PaginationMeta | null;
    page: number;
    pageSize: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    onNewOrder: () => void;
    onViewOrder: (order: Order) => void;
    onPrintOrder: (order: Order) => void;
    onSeparateOrder: (order: Order) => void;
    onCompleteOrder: (order: Order) => void;
    onGenerateInvoice: (order: Order) => void;
    onCancelOrder: (order: Order) => void;
    onApproveCancellation?: (order: Order) => void;
    onRejectCancellation?: (order: Order) => void;
    isLoading?: boolean;
    isAdmin?: boolean;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
    created: { label: 'Criada', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    printed: { label: 'Impressa', color: 'text-purple-600', bgColor: 'bg-purple-100' },
    separated: { label: 'Separada', color: 'text-orange-600', bgColor: 'bg-orange-100' },
    completed: { label: 'Completa', color: 'text-green-600', bgColor: 'bg-green-100' },
    cancellation_requested: { label: 'Cancelamento Solicitado', color: 'text-amber-700', bgColor: 'bg-amber-100' },
    cancellation_rejected: { label: 'Cancelamento Rejeitado', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    cancelled: { label: 'Cancelada', color: 'text-red-600', bgColor: 'bg-red-100' },
};

const priorityConfig = {
    low: { label: 'Baixa', color: 'gray' as const },
    normal: { label: 'Normal', color: 'info' as const },
    high: { label: 'Alta', color: 'warning' as const },
    urgent: { label: 'Urgente', color: 'danger' as const },
};

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#22c55e', '#ef4444'];

// Time period options
type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 MÃªs' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

export default function OrdersDashboard({
    orders,
    pagination,
    page,
    pageSize,
    setPage,
    setPageSize,
    statusFilter,
    setStatusFilter,
    onNewOrder,
    onViewOrder,
    onPrintOrder,
    onSeparateOrder,
    onCompleteOrder,
    onGenerateInvoice,
    onCancelOrder,
    onApproveCancellation,
    onRejectCancellation,
    isLoading,
    isAdmin,
}: OrdersDashboardProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');

    // Get date range based on period
    const periodStartDate = useMemo(() => {
        const now = new Date();
        switch (selectedPeriod) {
            case '1m': return subDays(now, 30);
            case '3m': return subDays(now, 90);
            case '6m': return subDays(now, 180);
            case '1y': return subDays(now, 365);
        }
    }, [selectedPeriod]);

    // Filter orders by selected period
    const periodOrders = useMemo(() => {
        return orders.filter((o) => parseISO(o.createdAt) >= periodStartDate);
    }, [orders, periodStartDate]);

    // Calculate metrics
    const metrics = useMemo(() => {
        const todayOrders = periodOrders.filter((o) => isToday(parseISO(o.createdAt)));
        const pending = periodOrders.filter((o) => o.status === 'created' || o.status === 'printed');
        const urgent = periodOrders.filter((o) => o.priority === 'urgent' && o.status !== 'completed');
        const completed = periodOrders.filter((o) => o.status === 'completed');

        return {
            today: todayOrders.length,
            pending: pending.length,
            urgent: urgent.length,
            completed: completed.length,
            totalValue: periodOrders.reduce((sum, o) => sum + o.total, 0),
        };
    }, [periodOrders]);

    // Status distribution for pie chart
    const statusDistribution = useMemo(() => {
        const distribution: Record<string, number> = {};
        periodOrders.forEach((order) => {
            distribution[order.status] = (distribution[order.status] || 0) + 1;
        });
        return Object.entries(distribution).map(([status, count]) => ({
            name: statusConfig[status as OrderStatus]?.label || status,
            value: count,
        }));
    }, [periodOrders]);

    // Last 7 days data for bar chart
    const weeklyData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const dayOrders = periodOrders.filter((o) =>
                format(parseISO(o.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
            );
            data.push({
                day: format(date, 'EEE', { locale: ptBR }),
                total: dayOrders.length,
                completed: dayOrders.filter((o) => o.status === 'completed').length,
            });
        }
        return data;
    }, [periodOrders]);

    // Filtered orders for table display (mostly for search/date which might not be handled by backend yet or to refine current view)
    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (
                    !order.orderNumber.toLowerCase().includes(search) &&
                    !order.customerName.toLowerCase().includes(search)
                ) {
                    return false;
                }
            }

            // Date filter
            if (dateFilter !== 'all') {
                const orderDate = parseISO(order.createdAt);
                if (dateFilter === 'today' && !isToday(orderDate)) {
                    return false;
                }
                if (dateFilter === 'week') {
                    const weekAgo = subDays(new Date(), 7);
                    if (orderDate < weekAgo) return false;
                }
            }

            return true;
        });
    }, [orders, searchTerm, dateFilter]);

    const statusOptions = [
        { value: 'all', label: 'Todos os Status' },
        { value: 'created', label: 'Criada' },
        { value: 'printed', label: 'Impressa' },
        { value: 'separated', label: 'Separada' },
        { value: 'completed', label: 'Completa' },
        { value: 'cancellation_requested', label: 'Cancelamento Solicitado' },
        { value: 'cancellation_rejected', label: 'Cancelamento Rejeitado' },
        { value: 'cancelled', label: 'Cancelada' },
    ];

    const dateOptions = [
        { value: 'all', label: 'Todas as Datas' },
        { value: 'today', label: 'Hoje' },
        { value: 'week', label: 'Ãšltimos 7 dias' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Dashboard de Encomendas"
                subtitle="VisÃ£o geral e gerenciamento de pedidos"
                icon={<HiOutlineClipboardDocumentList className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Period Filter */}
                        <div className="flex items-center h-10 bg-white dark:bg-dark-800 rounded-lg p-1 border border-gray-200 dark:border-dark-700 shadow-sm">
                            {periodOptions.map((option) => (
                                <Button variant="ghost"
                                    key={option.value}
                                    onClick={() => setSelectedPeriod(option.value)}
                                    className={cn(
                                        'px-3 h-full rounded-md text-[10px] font-black uppercase tracking-widest transition-all',
                                        selectedPeriod === option.value
                                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400'
                                    )}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                        <Button 
                            size="sm" 
                            className="h-10 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20"
                            onClick={onNewOrder}
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            Nova Encomenda
                        </Button>
                    </div>
                }
            />

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Hoje"
                    value={metrics.today}
                    color="primary"
                    icon={<HiOutlineClipboardDocumentList className="w-5 h-5" />}
                />
                <MetricCard
                    label="Pendentes"
                    value={metrics.pending}
                    color="yellow"
                    icon={<HiOutlineClock className="w-5 h-5" />}
                />
                <MetricCard
                    label="Urgentes"
                    value={metrics.urgent}
                    color="red"
                    icon={<HiOutlineExclamationTriangle className="w-5 h-5" />}
                    badge={metrics.urgent > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-red-500 dark:text-red-400 uppercase tracking-tighter animate-pulse">CrÃ­tico</span>
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        </div>
                    ) : undefined}
                />
                <MetricCard
                    label="Completas"
                    value={metrics.completed}
                    color="success"
                    icon={<HiOutlineCheck className="w-5 h-5" />}
                    badge={<span className="text-[9px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-tight">Finalizadas</span>}
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <Card padding="md">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        DistribuiÃ§Ã£o por Status
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height={256}>
                            <PieChart>
                                <Pie
                                    data={statusDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {statusDistribution.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Weekly Orders */}
                <Card padding="md">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Encomendas na Semana
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height={256}>
                            <BarChart data={weeklyData}>
                                <XAxis dataKey="day" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="completed" name="Completas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Filters and Table */}
            <Card padding="md">
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por nÃºmero ou cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                leftIcon={<HiOutlineFilter className="w-5 h-5" />}
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <Select
                                options={statusOptions}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <Select
                                options={dateOptions}
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <TableContainer
                        isLoading={isLoading}
                        isEmpty={filteredOrders.length === 0}
                        minHeight="450px"
                        emptyTitle="Nenhuma encomenda encontrada"
                        emptyDescription="Tente ajustar sua busca ou crie uma nova encomenda."
                        onEmptyAction={onNewOrder}
                        emptyActionLabel="Nova Encomenda"
                    >
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-dark-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                        NÃºmero
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Cliente
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Prioridade
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Entrega
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Valor
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                        AÃ§Ãµes
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-dark-600">
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-medium text-gray-900 dark:text-white">
                                                #{order.orderNumber}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {order.customerName}
                                            </p>
                                            <p className="text-sm text-gray-500">{order.customerPhone}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                                statusConfig[order.status].bgColor,
                                                statusConfig[order.status].color
                                            )}>
                                                {statusConfig[order.status].label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={priorityConfig[order.priority].color}>
                                                {priorityConfig[order.priority].label}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                            {format(parseISO(order.deliveryDate), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(order.total)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center gap-1">
                                                <Button variant="ghost"
                                                    onClick={() => onViewOrder(order)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                                                    title="Ver detalhes"
                                                >
                                                    <HiOutlineEye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                                </Button>
                                                {order.status === 'created' && (
                                                    <Button variant="ghost"
                                                        onClick={() => onPrintOrder(order)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                                                        title="Imprimir"
                                                    >
                                                        <HiOutlinePrinter className="w-5 h-5 text-purple-600" />
                                                    </Button>
                                                )}
                                                {order.status === 'printed' && (
                                                    <Button variant="ghost"
                                                        onClick={() => onSeparateOrder(order)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                                                        title="Marcar como Separada"
                                                    >
                                                        <HiOutlineCube className="w-5 h-5 text-orange-600" />
                                                    </Button>
                                                )}
                                                {order.status === 'separated' && (
                                                    <Button variant="ghost"
                                                        onClick={() => onCompleteOrder(order)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                                                        title="Finalizar Encomenda"
                                                    >
                                                        <HiOutlineCheck className="w-5 h-5 text-green-600" />
                                                    </Button>
                                                )}
                                                {order.status === 'completed' && (
                                                    <Button variant="ghost"
                                                        onClick={() => onGenerateInvoice(order)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                                                        title="Gerar Fatura"
                                                    >
                                                        <HiOutlineDocumentText className="w-5 h-5 text-blue-600" />
                                                    </Button>
                                                )}
                                                {/* Reprint button - admin only, for orders already printed */}
                                                {isAdmin && order.status !== 'created' && order.status !== 'cancelled' && (
                                                    <Button variant="ghost"
                                                        onClick={() => onPrintOrder(order)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                                                        title="Reimprimir (Admin)"
                                                    >
                                                        <HiOutlinePrinter className="w-5 h-5 text-purple-400" />
                                                    </Button>
                                                )}
                                                {isAdmin && order.status === 'cancellation_requested' && (
                                                    <>
                                                        <Button variant="ghost"
                                                            onClick={() => onApproveCancellation?.(order)}
                                                            className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                            title="Aprovar Cancelamento"
                                                        >
                                                            <HiOutlineCheckCircle className="w-5 h-5 text-green-600" />
                                                        </Button>
                                                        <Button variant="ghost"
                                                            onClick={() => onRejectCancellation?.(order)}
                                                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                                                            title="Rejeitar Cancelamento"
                                                        >
                                                            <HiOutlineXCircle className="w-5 h-5 text-gray-600" />
                                                        </Button>
                                                    </>
                                                )}
                                                {order.status !== 'cancelled' && order.status !== 'cancellation_requested' && (
                                                    <Button variant="ghost"
                                                        onClick={() => onCancelOrder(order)}
                                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg group transition-colors"
                                                        title="Cancelar Encomenda"
                                                    >
                                                        <HiOutlineTrash className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableContainer>

                    {/* Pagination */}
                    <div className="px-4 py-4">
                        <Pagination
                            currentPage={page}
                            totalItems={pagination?.total || 0}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                            itemsPerPageOptions={[10, 20, 50]}
                        />
                    </div>
                </div>
            </Card>
        </div>
    );
}
