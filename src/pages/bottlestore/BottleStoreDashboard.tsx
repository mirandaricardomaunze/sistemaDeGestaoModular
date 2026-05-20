import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Skeleton, Badge, PageHeader } from '../../components/ui';
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
    Cell
} from 'recharts';
import {
    HiOutlineArrowTrendingUp,
    HiOutlineShoppingCart,
    HiOutlineBanknotes,
    HiOutlineChartBar,
    HiOutlineCube,
    HiOutlineArrowPath,
    HiOutlinePlus,
    HiOutlineDocumentChartBar,
    HiOutlineArrowRight,
    HiOutlineCurrencyDollar,
    HiOutlineExclamationCircle,
    HiOutlineClock,
    HiOutlineLightBulb
} from 'react-icons/hi2';
import { useSocket } from '../../contexts/SocketContext';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { useBottleStoreDashboard, useExpiringBatches } from '../../hooks/useBottleStore';
import type {
    BottleStoreBatch,
    BottleStoreDashboardCategory,
    BottleStoreRecentMovement,
    BottleStoreRecentSale,
} from '../../types/bottlestore';
import toast from 'react-hot-toast';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { MetricCard, StatCard, CHART_COLORS } from '../../components/common/ModuleMetricCard';
import { ModulePeriodFilter } from '../../components/common/ModulePeriodFilter';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import { formatCurrency, cn } from '../../utils';

type TimeRange = '1M' | '2M' | '3M' | '6M' | '1Y';

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

export default function BottleStoreDashboard() {
    const [range, setRange] = useState<TimeRange>('1M');
    const { data, isLoading: loading, refetch: refetchStats } = useBottleStoreDashboard(range);
    const { data: expiryAlerts } = useExpiringBatches(60);
    const { insights } = useSmartInsights();
    const { socket } = useSocket();

    // Real-time low stock alerts
    useEffect(() => {
        if (!socket) return;
        const handleLowStock = (payload: { productName: string; currentStock: number; status: string }) => {
            const isOut = payload.status === 'out_of_stock';
            const msg = `${isOut ? 'Stock Esgotado' : '⚠️ï¸ Stock Baixo'}: ${payload.productName} • ${payload.currentStock} un. restantes`;
            if (isOut) {
                toast.error(msg, { duration: 8000, id: `low-stock-${payload.productName}` });
            } else {
                toast(msg, { duration: 6000, id: `low-stock-${payload.productName}`, icon: '⚠️ï¸' });
            }
            // Refresh dashboard so the low-stock card updates instantly
            refetchStats();
        };
        socket.on('stock:low_stock_alert', handleLowStock);
        return () => { socket.off('stock:low_stock_alert', handleLowStock); };
    }, [socket, refetchStats]);

    const stats = data?.summary || { totalSales: 0, totalTx: 0, avgTicket: 0, totalProfit: 0, stockValueCost: 0, stockValueSale: 0, lowStockCount: 0, totalProducts: 0 };
    const chartData = data?.chartData || [];

    type CategoryEntry = BottleStoreDashboardCategory & { color: string };
    const categoryData = useMemo<CategoryEntry[]>(() => {
        return (data?.categoryData || []).map((entry, index) => ({
            ...entry,
            name: entry.name === 'beverages' ? 'Bebidas' :
                entry.name === 'food' ? 'Alimentação' :
                    entry.name === 'other' ? 'Outros' :
                        entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
            value: entry.value,
            color: CHART_COLORS[index % CHART_COLORS.length],
        }));
    }, [data]);


    if (loading && !data) {
        return (
            <div className="space-y-6 animate-pulse p-4">
                {/* Header Skeleton */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton height={32} className="w-48" />
                        <Skeleton height={20} className="w-64" />
                    </div>
                </div>
                {/* Metrics Grid Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} padding="md">
                            <Skeleton height={60} />
                        </Card>
                    ))}
                </div>
                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2" padding="md">
                        <Skeleton height={288} />
                    </Card>
                    <Card padding="md">
                        <Skeleton height={288} />
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2">
            {/* Page Header */}
            <PageHeader
                title="Painel Garrafeira"
                subtitle="Visão geral de desempenho e vendas"
                icon={<HiOutlineShoppingCart className="text-secondary-600 dark:text-secondary-400" />}
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => refetchStats()}
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                        >
                            Atualizar
                        </Button>

                        <ModulePeriodFilter<TimeRange>
                            value={range}
                            onChange={(v) => setRange(v)}
                            options={[
                                { value: '1M', label: '1M' },
                                { value: '2M', label: '2M' },
                                { value: '3M', label: '3M' },
                                { value: '6M', label: '6M' },
                                { value: '1Y', label: '1A' },
                            ]}
                        />

                        <Link to="/bottle-store/reports">
                            <Button variant="outline" leftIcon={<HiOutlineDocumentChartBar className="w-5 h-5" />}>
                                Relatórios
                            </Button>
                        </Link>
                        <Link to="/bottle-store/pos">
                            <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                                Nova Venda
                            </Button>
                        </Link>
                    </div>
                }
            />

            {/* Smart Insights / Intelligent Advisor */}
            {insights.length > 0 && (
                <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conselheiro Inteligente</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tendências de vendas e devoluções</p>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                        {insights.map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />
                        ))}
                    </div>
                </div>
            )}

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineBanknotes className="w-6 h-6" />}
                    color="blue"
                    value={formatCurrency(stats.totalSales)}
                    label="Vendas do Período"
                    growth={12}
                />
                <MetricCard
                    icon={<HiOutlineShoppingCart className="w-6 h-6" />}
                    color="purple"
                    value={stats.totalTx}
                    label="Total de Pedidos"
                />
                <MetricCard
                    icon={<HiOutlineCube className="w-6 h-6" />}
                    color="yellow"
                    value={`${stats.lowStockCount ?? 0}/${stats.totalProducts ?? 0}`}
                    label="Produtos com Baixo Stock"
                    badge={stats.lowStockCount > 0 ? <Badge variant="danger">Atenção</Badge> : undefined}
                />
                <MetricCard
                    icon={<HiOutlineChartBar className="w-6 h-6" />}
                    color="primary"
                    value={formatCurrency(stats.avgTicket)}
                    label="Ticket Médio"
                />
            </div>

            {/* Profit Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
                    color="green"
                    value={formatCurrency(stats.totalProfit)}
                    label="Lucro Bruto"
                    sublabel={`Margem: ${stats.totalSales ? ((stats.totalProfit / stats.totalSales) * 100).toFixed(1) : 0}%`}
                />
                <StatCard
                    icon={<HiOutlineCube className="w-6 h-6" />}
                    color="blue"
                    value={formatCurrency(stats.stockValueCost)}
                    label="Valor em Stock (Custo)"
                    sublabel="Valor de Aquisição"
                />
                <StatCard
                    icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                    color="purple"
                    value={formatCurrency((stats.stockValueSale ?? 0) - (stats.stockValueCost ?? 0))}
                    label="Lucro Potencial"
                    sublabel="Venda de todo o stock"
                />
            </div>

            {/* Expiry Alerts */}
            {expiryAlerts && (expiryAlerts.counts.expired > 0 || expiryAlerts.counts.expiringSoon > 0) && (
                <div className="space-y-3">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                        <HiOutlineExclamationCircle className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                        Alertas de Validade
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {expiryAlerts.expired.slice(0, 4).map((b: BottleStoreBatch) => (
                            <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 shadow-sm">
                                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    <HiOutlineExclamationCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-rose-700 dark:text-rose-400 truncate tracking-tight uppercase">
                                        {b.product?.name}
                                    </p>
                                    <p className="text-[10px] text-rose-600/80 font-bold uppercase mt-0.5">
                                        Lote {b.batchNumber} • {b.quantity} un. EXPIRADO
                                    </p>
                                </div>
                                <span className="text-[10px] font-black text-rose-700 whitespace-nowrap bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                    {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('pt-MZ') : ''}
                                </span>
                            </div>
                        ))}
                        {expiryAlerts.expiringSoon.slice(0, 4).map((b: BottleStoreBatch) => (
                            <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 shadow-sm">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    <HiOutlineClock className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-amber-700 dark:text-amber-400 truncate tracking-tight uppercase">{b.product?.name}</p>
                                    <p className="text-[10px] text-amber-600/80 font-bold uppercase mt-0.5">Lote {b.batchNumber} • {b.quantity} un.</p>
                                </div>
                                <span className="text-[10px] font-black text-amber-700 whitespace-nowrap bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    {b.daysToExpiry}d restantes
                                </span>
                            </div>
                        ))}
                    </div>
                    {(expiryAlerts.counts.expired + expiryAlerts.counts.expiringSoon) > 8 && (
                        <p className="text-xs text-gray-500 italic">
                            + {(expiryAlerts.counts.expired + expiryAlerts.counts.expiringSoon) - 8} lotes adicionais - ver inventário
                        </p>
                    )}
                </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <Card padding="md" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            Evolução de Vendas
                        </h2>
                        <Link to="/bottle-store/reports">
                            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-bold">
                                Ver mais <HiOutlineArrowRight className="w-3.5 h-3.5 ml-1.5 inline" />
                            </Button>
                        </Link>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height={288}>
                            <AreaChart data={chartData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200/50 dark:stroke-white/5" vertical={false} />
                                <XAxis dataKey="date" className="text-[10px]" stroke="#94a3b8" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis className="text-[10px]" stroke="#94a3b8" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value).replace(',00', '')} />
                                <Tooltip content={<GlassmorphicTooltip formatter={formatCurrency} />} />
                                <Area type="monotone" dataKey="amount" name="Vendas" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Mix Chart */}
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
                        Mix de Vendas (Categorias)
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height={256}>
                            <PieChart>
                                <Pie data={categoryData as unknown as Parameters<typeof Pie>[0]['data']} cx="50%" cy="50%" innerRadius={62} outerRadius={82} paddingAngle={4} dataKey="value">
                                    {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.05)" />)}
                                </Pie>
                                <Tooltip content={<GlassmorphicTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {categoryData.map((item) => (
                            <div key={item.name} className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-700/30 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="text-xs font-black text-slate-900 dark:text-white flex-shrink-0">
                                    {item.value ? ((item.value / (stats.totalSales || 1)) * 100).toFixed(0) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <Card padding="md" className="lg:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            Atividade Recente
                        </h2>
                        <div className="flex gap-2">
                            <Link to="/bottle-store/stock">
                                <Button variant="ghost" size="sm">Ver Tudo</Button>
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {(!data?.recentActivity?.sales?.length && !data?.recentActivity?.movements?.length) ? (
                            <div className="text-center py-8 text-gray-500">
                                Sem atividade recente registada.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-dark-700">
                                {(() => {
                                    type ActivityItem =
                                        | (BottleStoreRecentSale & { type: 'sale' })
                                        | (BottleStoreRecentMovement & { type: 'movement' });
                                    const items: ActivityItem[] = [
                                        ...(data?.recentActivity?.sales || []).map((s) => ({ ...s, type: 'sale' as const })),
                                        ...(data?.recentActivity?.movements || []).map((m) => ({ ...m, type: 'movement' as const })),
                                    ];
                                    return items
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .slice(0, 5)
                                        .map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-transparent shadow-sm transition-all duration-300",
                                                    item.type === 'sale'
                                                        ? "bg-green-100 text-green-600 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                                                        : "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30"
                                                )}>
                                                    {item.type === 'sale' ? <HiOutlineShoppingCart className="w-5 h-5" /> : <HiOutlineCube className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {item.type === 'sale'
                                                            ? `Venda ${item.saleNumber || '#' + item.id.slice(-4)}`
                                                            : `${item.movementType === 'purchase' ? 'Entrada' : 'Saída'} de Stock: ${item.product?.name}`}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {item.type === 'sale'
                                                            ? (item.customer?.name || 'Cliente Balcão')
                                                            : `${item.quantity} unidades • ${item.performedBy}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {item.type === 'sale' ? formatCurrency(item.total) : `${item.quantity > 0 ? '+' : ''}${item.quantity} un`}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
                        Ações Rápidas
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                        <QuickActionCard
                            icon={HiOutlineShoppingCart}
                            label="Nova Venda"
                            description="Iniciar nova transação no POS"
                            path="/bottle-store/pos"
                            color="primary"
                        />
                        <QuickActionCard
                            icon={HiOutlineCube}
                            label="Gestão de Inventário"
                            description="Ver e editar produtos e stocks"
                            path="/bottle-store/inventory"
                            color="blue"
                        />
                        <QuickActionCard
                            icon={HiOutlineArrowPath}
                            label="Movimentos"
                            description="Registar entradas e saídas"
                            path="/bottle-store/stock"
                            color="amber"
                        />
                        <QuickActionCard
                            icon={HiOutlineDocumentChartBar}
                            label="Relatórios"
                            description="Análise completa de desempenho"
                            path="/bottle-store/reports"
                            color="purple"
                        />
                    </div>
                </Card>
            </div>

        </div>
    );
}
