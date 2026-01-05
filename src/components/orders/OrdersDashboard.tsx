import { useState, useMemo } from 'react';
import {
    HiOutlineClipboardList,
    HiOutlineClock,
    HiOutlineExclamation,
    HiOutlineCheck,
    HiOutlineEye,
    HiOutlinePrinter,
    HiOutlineFilter,
    HiOutlinePlus,
    HiOutlineTrash,
} from 'react-icons/hi';
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
import { Card, Button, Badge, Input, Select, Pagination, usePagination } from '../ui';
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
    onCompleteOrder: (order: Order) => void;
    onCancelOrder: (order: Order) => void;
    isLoading?: boolean;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
    created: { label: 'Criada', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    printed: { label: 'Impressa', color: 'text-purple-600', bgColor: 'bg-purple-100' },
    separated: { label: 'Separada', color: 'text-orange-600', bgColor: 'bg-orange-100' },
    completed: { label: 'Completa', color: 'text-green-600', bgColor: 'bg-green-100' },
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
    { value: '1m', label: '1 Mês' },
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
    onCompleteOrder,
    onCancelOrder,
    isLoading
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
    ];

    const dateOptions = [
        { value: 'all', label: 'Todas as Datas' },
        { value: 'today', label: 'Hoje' },
        { value: 'week', label: 'Últimos 7 dias' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Dashboard de Encomendas
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Visão geral e gerenciamento de pedidos
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
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
                    <Button onClick={onNewOrder}>
                        <HiOutlinePlus className="w-5 h-5 mr-2" />
                        Nova Encomenda
                    </Button>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <Card padding="md" className="border-l-4 border-l-blue-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Hoje</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                {metrics.today}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-yellow-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Pendentes</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                {metrics.pending}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineClock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-red-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Urgentes</p>
                            <p className="text-2xl sm:text-3xl font-bold text-red-600">
                                {metrics.urgent}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineExclamation className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-green-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Completas</p>
                            <p className="text-2xl sm:text-3xl font-bold text-green-600">
                                {metrics.completed}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <Card padding="md">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Distribuição por Status
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
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
                        <ResponsiveContainer width="100%" height="100%">
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
                                placeholder="Buscar por número ou cliente..."
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
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-dark-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Número
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
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-dark-600">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                            {isLoading ? 'Carregando encomendas...' : 'Nenhuma encomenda encontrada'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
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
                                                    <button
                                                        onClick={() => onViewOrder(order)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg"
                                                        title="Ver detalhes"
                                                    >
                                                        <HiOutlineEye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                                    </button>
                                                    {order.status === 'created' && (
                                                        <button
                                                            onClick={() => onPrintOrder(order)}
                                                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg"
                                                            title="Imprimir"
                                                        >
                                                            <HiOutlinePrinter className="w-5 h-5 text-purple-600" />
                                                        </button>
                                                    )}
                                                    {(order.status === 'printed' || order.status === 'separated') && (
                                                        <button
                                                            onClick={() => onCompleteOrder(order)}
                                                            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg"
                                                            title="Finalizar"
                                                        >
                                                            <HiOutlineCheck className="w-5 h-5 text-green-600" />
                                                        </button>
                                                    )}
                                                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                                                        <button
                                                            onClick={() => onCancelOrder(order)}
                                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg group"
                                                            title="Cancelar Encomenda"
                                                        >
                                                            <HiOutlineTrash className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

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
