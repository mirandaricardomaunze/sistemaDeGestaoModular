import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge, Modal, Select, Input, Skeleton } from '../../components/ui';
import { useWarehouses } from '../../hooks/useWarehouses';
import { useProducts } from '../../hooks/useProducts';
import {
    HiOutlineTruck,
    HiOutlineMapPin,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePrinter,
    HiOutlineCube,
    HiOutlineArrowRight,
    HiOutlineChartBar,
    HiOutlineSquares2X2,
    HiOutlineBanknotes,
    HiOutlineFlag,
    HiOutlineLightBulb,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import { 
    useLogisticsDashboard,
    useExpiryAlerts,
    useTransfers, 
    useCreateTransfer 
} from '../../hooks/useLogistics';
import type { StockTransfer } from '../../types';
import { ExpiryAlertsPanel } from '../../components/logistics/ExpiryAlertsPanel';
import LogisticsMap from '../../components/logistics/LogisticsMap';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import toast from 'react-hot-toast';
import { generateGuiaRemessa } from '../../utils/documentGenerator';
import { useStore } from '../../stores/useStore';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { subMonths, isAfter } from 'date-fns';
import { CHART_COLORS, MetricCard } from '../../components/common/ModuleMetricCard';

type TimePeriod = 30 | 90 | 180 | 365;

const PERIOD_OPTIONS = [
    { label: '1 Mês', value: 30 },
    { label: '3 Meses', value: 90 },
    { label: '6 Meses', value: 180 },
    { label: '1 Ano', value: 365 },
];

export default function LogisticsDashboard() {
    const { t } = useTranslation();
    const { companySettings } = useStore();
    const { warehouses } = useWarehouses();
    const { products } = useProducts({ page: 1, limit: 100 });
    const { data: dashboard, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useLogisticsDashboard();
    const { insights } = useSmartInsights();
    const { alerts: expiryAlerts } = useExpiryAlerts();
    
    const [selectedDays, setSelectedDays] = useState<TimePeriod>(30);
    
    const { data: allTransfers, isLoading: isLoadingTransfers } = useTransfers();
    const createTransferMutation = useCreateTransfer();

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferData, setTransferData] = useState({
        sourceWarehouseId: '',
        targetWarehouseId: '',
        responsible: '',
        reason: '',
        items: [{ productId: '', quantity: 1 }]
    });

    const filteredTransfers = useMemo(() => {
        const transfersArray = Array.isArray(allTransfers) ? allTransfers : (allTransfers as { data?: StockTransfer[] } | undefined)?.data || [];
        if (transfersArray.length === 0) return [];

        const now = new Date();
        const startDate = subMonths(now, selectedDays / 30);

        return transfersArray.filter((tr: StockTransfer) => {
            const trDate = new Date(tr.date || tr.createdAt);
            return isAfter(trDate, startDate);
        });
    }, [allTransfers, selectedDays]);

    const handleRefresh = async () => {
        const promise = refetchDashboard();
        toast.promise(promise, {
            loading: 'Actualizando dados...',
            success: 'Painel actualizado',
            error: 'Erro ao actualizar dados'
        });
    };

    const handleCreateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (transferData.sourceWarehouseId === transferData.targetWarehouseId) {
            return toast.error(t('logistics_module.dashboard.transferSameError'));
        }
        
        try {
            await createTransferMutation.mutateAsync(transferData);
            setIsTransferModalOpen(false);
            setTransferData({
                sourceWarehouseId: '',
                targetWarehouseId: '',
                responsible: '',
                reason: '',
                items: [{ productId: '', quantity: 1 }]
            });
        } catch (error) {
            // Error handling is managed by the mutation's onError
        }
    };

    const addItem = () => {
        setTransferData({
            ...transferData,
            items: [...transferData.items, { productId: '', quantity: 1 }]
        });
    };

    const removeItem = (index: number) => {
        setTransferData({
            ...transferData,
            items: transferData.items.filter((_, i) => i !== index)
        });
    };




    const totalStock = (warehouses || []).reduce((acc, w) => acc + ((w as { totalItems?: number }).totalItems || 0), 0);

    const transferStats = [
        { name: 'Seg', valor: 4 },
        { name: 'Ter', valor: 7 },
        { name: 'Qua', valor: 5 },
        { name: 'Qui', valor: 12 },
        { name: 'Sex', valor: 9 },
        { name: 'Sáb', valor: 3 },
        { name: 'Dom', valor: 1 },
    ];

    const pieData = warehouses.map(w => ({
        name: w.name,
        value: (w as { totalItems?: number }).totalItems || 50
    }));

    const COLORS = CHART_COLORS;

    const mapLocations = useMemo(() => {
        type MapLocation = { lat: number; lng: number; label: string; type: 'warehouse' | 'delivery'; status?: string; details?: Record<string, string | undefined> };
        const locations: MapLocation[] = [];

        warehouses.forEach((w) => {
            const wExt = w as { latitude?: number | string; longitude?: number | string };
            const lat = Number(wExt.latitude);
            const lng = Number(wExt.longitude);
            if (lat && lng) {
                locations.push({
                    lat,
                    lng,
                    label: w.name,
                    type: 'warehouse' as const,
                    status: w.isActive ? 'active' : 'inactive'
                });
            }
        });

        if (dashboard?.recentDeliveries) {
            dashboard.recentDeliveries.forEach((d: { latitude?: number | string; longitude?: number | string; number?: string; status?: string; recipientName?: string; deliveryAddress?: string; priority?: string }) => {
                const lat = Number(d.latitude);
                const lng = Number(d.longitude);
                if (lat && lng) {
                    locations.push({
                        lat,
                        lng,
                        label: `Entrega ${d.number}`,
                        type: 'delivery' as const,
                        status: d.status,
                        details: {
                            Destinatrio: d.recipientName || 'N/A',
                            Morada: d.deliveryAddress,
                            Prioridade: d.priority
                        }
                    });
                }
            });
        }

        return locations;
    }, [warehouses, dashboard]);

    if (isLoadingDashboard && !dashboard) {
        return (
            <div className="space-y-6 animate-pulse p-4">
                <div>
                    <Skeleton height={32} className="w-64" />
                    <Skeleton height={20} className="w-96 mt-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
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
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Compliance expiry alerts - shown whenever there are documents expiring soon */}
            {expiryAlerts.length > 0 && (
                <ExpiryAlertsPanel alerts={expiryAlerts} />
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-primary-100 dark:bg-primary-500/15 border border-primary-200 dark:border-primary-500/25 flex items-center justify-center">
                            <HiOutlineTruck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </span>
                        {t('logistics_module.dashboard.title')}
                    </h1>
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 ml-1">
                        {t('logistics_module.dashboard.subtitle')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white/40 dark:bg-dark-900/40 p-2 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
                    <SegmentedControl
                        options={PERIOD_OPTIONS}
                        value={selectedDays}
                        onChange={setSelectedDays}
                    />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4 text-primary-600" />}
                    >
                        {t('common.refresh')}
                    </Button>

                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<HiOutlinePlus className="w-4 h-4 text-white" />}
                        onClick={() => setIsTransferModalOpen(true)}
                    >
                        {t('logistics_module.dashboard.newTransfer')}
                    </Button>
                </div>
            </div>

            {/* Smart Insights / Intelligent Advisor */}
            {insights.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('common.smart_advisor')}</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('logistics_module.dashboard.insightsSubtitle')}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                        {insights.map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />
                        ))}
                    </div>
                </div>
            )}

            {/* Visual Tracking Map */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <HiOutlineMapPin className="text-primary-600 dark:text-primary-400 w-6 h-6" />
                        {t('logistics_module.dashboard.visualTracking')}
                    </h2>
                    <Badge variant="success" className="animate-pulse">Live Tracking</Badge>
                </div>
                <Card className="p-0 overflow-hidden border border-white/20 dark:border-white/10 shadow-xl backdrop-blur-xl bg-white/80 dark:bg-dark-800/80">
                    <LogisticsMap 
                        locations={mapLocations} 
                        className="h-[500px] w-full"
                    />
                </Card>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineCube className="w-5 h-5" />}
                    color="info"
                    value={totalStock.toLocaleString()}
                    label={t('logistics_module.dashboard.kpis.totalStock')}
                    badge={<span className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase">{t('logistics_module.dashboard.kpis.itemsInNetwork')}</span>}
                />
                <MetricCard
                    icon={<HiOutlineBanknotes className="w-5 h-5" />}
                    color="success"
                    value={`${(dashboard?.stats?.pickupRevenue || 0).toLocaleString()} MZN`}
                    label={t('logistics_module.dashboard.kpis.pickupRevenue')}
                    badge={<span className="text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase">{t('logistics_module.dashboard.kpis.totalPickups')}</span>}
                />
                <MetricCard
                    icon={<HiOutlineTruck className="w-5 h-5" />}
                    color="indigo"
                    value={`${(dashboard?.stats?.deliveryRevenue || 0).toLocaleString()} MZN`}
                    label={t('logistics_module.dashboard.kpis.deliveryRevenue')}
                    badge={<span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase">{t('logistics_module.dashboard.kpis.totalShipments')}</span>}
                />
                <MetricCard
                    icon={<HiOutlineFlag className="w-5 h-5" />}
                    color="amber"
                    value={dashboard?.stats?.deliveriesByProvince?.length || 0}
                    label={t('logistics_module.dashboard.kpis.regions')}
                    badge={<span className="text-[9px] font-black text-amber-500 dark:text-amber-400 uppercase">{t('common.provinces')}</span>}
                />
            </div>

            {/* Data Visualization Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card color="slate" className="p-6 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineChartBar className="text-primary-600 dark:text-primary-400 w-5 h-5" />
                            {t('logistics_module.dashboard.charts.flow')}
                        </h3>
                        <Badge variant="primary" size="sm">{t('logistics_module.dashboard.charts.transferVolume')}</Badge>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={transferStats}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="valor" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-6 h-[400px] flex flex-col bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white/20 dark:border-white/10">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineSquares2X2 className="text-indigo-600 dark:text-indigo-400 w-5 h-5" />
                            {t('logistics_module.dashboard.charts.distribution')}
                        </h3>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Warehouse Monitor */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineMapPin className="text-primary-600 dark:text-primary-400 w-6 h-6" />
                            {t('logistics_module.dashboard.warehouseNetwork')}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {warehouses.map((w, index) => (
                            <Card key={w.id} className="group hover:border-primary-500/30 transition-all cursor-pointer">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-500/15 border border-primary-200/50 dark:border-primary-500/30 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all shadow-sm backdrop-blur-sm">
                                            <HiOutlineMapPin className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tight">{w.name}</h3>
                                            <p className="text-xs text-gray-500 font-medium">{w.location || 'Local não definido'}</p>
                                        </div>
                                    </div>
                                    <Badge variant={w.isActive ? 'success' : 'danger'} className="rounded-lg px-3 py-1 font-bold">
                                        {w.isActive ? t('common.active').toUpperCase() : t('logistics_module.routes.inactive').toUpperCase()}
                                    </Badge>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                                        <span>{t('logistics_module.dashboard.stockOccupation')}</span>
                                        <span>{Math.min(95, 20 + index * 15)}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(95, 20 + index * 15)}%` }}
                                        ></div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t dark:border-dark-700">
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 font-bold mb-1">{t('common.code').toUpperCase()}</p>
                                            <span className="text-sm font-mono font-bold">{w.code}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-500 font-bold mb-1">{t('common.total_items').toUpperCase()}</p>
                                            <span className="text-sm font-extrabold text-primary-600">{(w as { totalItems?: number }).totalItems || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Side Activity Feed */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineChartBar className="text-indigo-600 dark:text-indigo-400 w-6 h-6" />
                            {t('logistics_module.dashboard.recentActivity')}
                        </h2>
                    </div>

                    <Card className="p-0 overflow-hidden border-none shadow-xl">
                        <div className="p-4 bg-indigo-50/80 dark:bg-dark-900/50 border-b border-indigo-100 dark:border-dark-700 flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{t('logistics_module.dashboard.liveTransfers')}</span>
                            <Badge variant="primary" size="sm">{filteredTransfers.length}</Badge>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto scrollbar-hidden">
                            {isLoadingTransfers ? (
                                <div className="p-4 space-y-4">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="flex gap-3">
                                            <Skeleton className="w-2 h-2 rounded-full mt-2" />
                                            <div className="flex-1 space-y-2">
                                                <div className="flex justify-between">
                                                    <Skeleton className="h-4 w-24" />
                                                    <Skeleton className="h-3 w-16" />
                                                </div>
                                                <Skeleton className="h-4 w-3/4" />
                                                <div className="flex justify-between">
                                                    <Skeleton className="h-3 w-12" />
                                                    <Skeleton className="h-8 w-8 rounded-md" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredTransfers.length > 0 ? (
                                <div className="divide-y dark:divide-dark-700">
                                    {filteredTransfers.slice(0, 8).map((tr: StockTransfer) => (
                                        <div key={tr.id} className="p-4 hover:bg-white dark:hover:bg-dark-700/50 transition-all group">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${tr.status === 'completed' ? 'bg-green-500' : 'bg-amber-400'}`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-bold text-primary-600 font-mono">{tr.number}</span>
                                                        <span className="text-[10px] font-bold text-gray-400">{new Date(tr.date || tr.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                        <span className="truncate max-w-[80px] text-gray-900 dark:text-white font-bold">{tr.sourceWarehouse?.name?.split(' ')[0]}</span>
                                                        <HiOutlineArrowRight className="w-3 h-3 text-gray-400 group-hover:translate-x-1 transition-transform" />
                                                        <span className="truncate max-w-[80px] text-gray-900 dark:text-white font-bold">{tr.targetWarehouse?.name?.split(' ')[0]}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter flex items-center gap-1">
                                                            <HiOutlineSquares2X2 className="w-3 h-3 text-primary-600 dark:text-primary-400" /> {tr.items?.length || 0} {t('common.items')}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => generateGuiaRemessa(tr, {
                                                                name: companySettings.companyName,
                                                                companyName: companySettings.companyName,
                                                                address: companySettings.address,
                                                                phone: companySettings.phone,
                                                                email: companySettings.email,
                                                                logo: companySettings.logo,
                                                                nuit: companySettings.taxId,
                                                                taxId: companySettings.taxId
                                                            })}
                                                        >
                                                            <HiOutlinePrinter className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-400 italic text-sm">Sem movimentos no período.</div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modal de Nova Guias de Remessa */}
            <Modal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                title={t('logistics_module.dashboard.newTransfer')}
                size="lg"
            >
                <form onSubmit={handleCreateTransfer} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label={t('common.origin')}
                            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                            value={transferData.sourceWarehouseId}
                            onChange={(e) => setTransferData({ ...transferData, sourceWarehouseId: e.target.value })}
                            required
                        />
                        <Select
                            label={t('common.destination')}
                            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                            value={transferData.targetWarehouseId}
                            onChange={(e) => setTransferData({ ...transferData, targetWarehouseId: e.target.value })}
                            required
                        />
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-lg space-y-4 border dark:border-dark-700 shadow-inner">
                        <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest">Itens da Transferência</label>
                        {transferData.items.map((item, index) => (
                            <div key={index} className="flex gap-2 items-center bg-white dark:bg-dark-800 p-2 rounded-lg shadow-sm">
                                <div className="flex-1">
                                    <Select
                                        options={products.map(p => ({ value: p.id, label: `${p.name} (Disp: ${p.currentStock})` }))}
                                        value={item.productId}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[index].productId = e.target.value;
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                        required
                                    />
                                </div>
                                <div className="w-24">
                                    <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[index].quantity = parseInt(e.target.value);
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                        required
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    className="p-2 text-red-500"
                                    onClick={() => removeItem(index)}
                                    disabled={transferData.items.length === 1}
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed"
                            leftIcon={<HiOutlinePlus className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                            onClick={addItem}
                        >
                            Adicionar Produto
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label={t('common.responsible')}
                            placeholder="Nome do responsável"
                            value={transferData.responsible}
                            onChange={(e) => setTransferData({ ...transferData, responsible: e.target.value })}
                            required
                        />
                        <Input
                            label={t('common.reason')}
                            placeholder="Ex: Reposição de Stock"
                            value={transferData.reason}
                            onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t dark:border-dark-700 mt-6">
                        <Button variant="outline" className="flex-1" onClick={() => setIsTransferModalOpen(false)}>{t('common.cancel')}</Button>
                        <Button type="submit" className="flex-2 bg-primary-600 hover:bg-primary-700 text-white font-bold">
                            {t('logistics_module.dashboard.registerTransfer')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
