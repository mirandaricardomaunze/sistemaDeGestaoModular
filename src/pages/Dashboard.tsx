import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import {
    HiOutlineArrowPath as HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineLightBulb
} from 'react-icons/hi2';
import { Link } from 'react-router-dom';

import { Button, Skeleton } from '../components/ui';
import { cn, formatRelativeTime } from '../utils/helpers';
import {
    useDashboard,
    useProducts,
    useAlerts,
    useEmployees,
    useCategories,
    useWarehouses
} from '../hooks/useData';
import { useSmartInsights } from '../hooks/useSmartInsights';
import { SmartInsightCard } from '../components/common/SmartInsightCard';

// New Widget Components
import {
    StatsWidget,
    RevenueChartWidget,
    CategoryPieWidget,
    RecentAlertsWidget,
    RecentActivityWidget,
    QuickActionsWidget,
    WeeklySalesWidget,
    RecentMovementsWidget
} from '../components/dashboard/DashboardWidgets';
import { DraggableWidget } from '../components/dashboard/DraggableWidget';

type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

const dayNames: Record<string, string> = {
    '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sab'
};

const DEFAULT_WIDGET_ORDER = ['stats', 'insights', 'revenue', 'categories', 'alerts', 'movements', 'activity', 'actions'];

export default function Dashboard() {
    const { t } = useTranslation();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('dashboard-widget-order');
        return saved ? JSON.parse(saved) : DEFAULT_WIDGET_ORDER;
    });

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Fetch data
    const { stats, salesChart, weeklyChart, recentActivity, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useDashboard(selectedWarehouseId);
    const { products, isLoading: isLoadingProducts } = useProducts(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined);
    const { alerts, isLoading: isLoadingAlerts } = useAlerts();
    const { employees, isLoading: isLoadingEmployees } = useEmployees();
    const { categories, isLoading: isLoadingCategories } = useCategories();
    const { insights, isLoading: isLoadingInsights } = useSmartInsights();
    const { warehouses } = useWarehouses();

    const isLoading = isLoadingDashboard || isLoadingProducts || isLoadingAlerts || isLoadingEmployees || isLoadingCategories || isLoadingInsights;

    // Transform data
    const salesData = useMemo(() => {
        return (salesChart || []).map(item => ({
            name: item.date.slice(-5),
            vendas: item.value,
            meta: 0
        }));
    }, [salesChart]);

    const weeklyData = useMemo(() => {
        return (weeklyChart || []).map(item => {
            const date = new Date(item.date);
            const dayName = dayNames[date.getDay().toString()] || item.date;
            return { name: dayName, valor: item.value };
        });
    }, [weeklyChart]);

    const metrics = useMemo(() => {
        const lowStockCount = products.filter((p) => p.currentStock <= (p.minStock || 0)).length;
        const activeEmployees = employees.filter((e) => e.isActive).length;
        const pendingAlerts = alerts.filter((a) => !a.isResolved).length;

        const stockSaleValue = products.reduce((sum, p) => sum + p.price * p.currentStock, 0);
        const stockCostValue = products.reduce((sum, p) => sum + (p.costPrice || 0) * p.currentStock, 0);

        return {
            salesGrowth: stats?.monthlyGrowth || 0,
            lowStock: lowStockCount,
            totalProducts: products.length,
            employees: activeEmployees,
            pendingAlerts,
            grossProfit: stats?.totalProfit || 0,
            profitMargin: stats?.totalRevenue ? (stats.totalProfit / stats.totalRevenue * 100) : 0,
            stockCostValue,
            stockSaleValue,
            potentialProfit: stockSaleValue - stockCostValue,
        };
    }, [products, alerts, employees, stats]);

    const categoryData = useMemo(() => {
        if (!categories || categories.length === 0) return [];
        return categories
            .filter(c => (c.productCount || 0) > 0)
            .map(c => ({ name: c.name, value: c.productCount || 0 }))
            .sort((a, b) => b.value - a.value);
    }, [categories]);

    const recentActivities = useMemo(() => {
        if (!recentActivity || !Array.isArray(recentActivity)) return [];
        
        return recentActivity.map((item: any) => ({
            id: item.id,
            action: item.title,
            detail: item.description,
            time: formatRelativeTime(item.timestamp),
            icon: item.type === 'sale' ? '💰' : '🔔'
        })).slice(0, 5);
    }, [recentActivity]);

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over) return;
        if (active.id !== over.id) {
            setWidgetOrder((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('dashboard-widget-order', JSON.stringify(newOrder));
                return newOrder;
            });
        }
    };

    if (isLoading) return <DashboardSkeleton />;

    const renderWidget = (id: string) => {
        switch (id) {
            case 'stats': return <StatsWidget metrics={metrics} stats={stats} />;
            case 'insights': return insights && insights.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <HiOutlineLightBulb className="w-5 h-5 text-amber-500" />
                        <h2 className="text-lg font-bold">Conselheiro Inteligente</h2>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {insights.map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px]" />
                        ))}
                    </div>
                </div>
            ) : null;
            case 'revenue': return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2"><RevenueChartWidget salesData={salesData} /></div>
                    <CategoryPieWidget categoryData={categoryData} />
                </div>
            );
            case 'categories': return <WeeklySalesWidget weeklyData={weeklyData} />;
            case 'alerts': return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <RecentAlertsWidget alerts={alerts} metrics={metrics} />
                    <RecentActivityWidget recentActivities={recentActivities} />
                    <QuickActionsWidget />
                </div>
            );
            case 'movements': return <RecentMovementsWidget />;
            case 'activity': return null;
            case 'actions': return null;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
                    <p className="text-gray-500">{t('dashboard.overview')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="w-56">
                        <select
                            value={selectedWarehouseId}
                            onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        >
                            <option value="">Todos os Armazéns</option>
                            {warehouses?.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                    <Button variant="ghost" onClick={() => refetchDashboard()} leftIcon={<HiOutlineRefresh />}>
                        {t('common.refresh')}
                    </Button>
                    <div className="flex bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        {periodOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setSelectedPeriod(opt.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-sm font-medium',
                                    selectedPeriod === opt.value ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm' : 'text-gray-500'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <Link to="/pos"><Button leftIcon={<HiOutlinePlus />}>{t('dashboard.newSale')}</Button></Link>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
            >
                <SortableContext items={widgetOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-6">
                        {widgetOrder.map(id => (
                            <DraggableWidget key={id} id={id}>
                                {renderWidget(id)}
                            </DraggableWidget>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex justify-between">
                <div className="space-y-2"><Skeleton height={32} width={200} /><Skeleton height={20} width={300} /></div>
                <div className="flex gap-2"><Skeleton height={40} width={100} /><Skeleton height={40} width={100} /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} height={120} />)}
            </div>
            <div className="grid grid-cols-3 gap-6">
                <Skeleton height={300} className="col-span-2" />
                <Skeleton height={300} />
            </div>
        </div>
    );
}
