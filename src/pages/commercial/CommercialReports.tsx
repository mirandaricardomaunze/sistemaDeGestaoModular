import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
    HiOutlineChartBar,
    HiOutlineArrowTrendingUp,
    HiOutlineCube,
    HiOutlineTruck,
    HiOutlineClock,
    HiOutlineArrowPath,
    HiOutlineExclamationTriangle,
    HiOutlineCircleStack,
} from 'react-icons/hi2';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, Badge, Button, SmartTable } from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { formatCurrency, cn } from '../../utils/helpers';
import { useStockAging, useSupplierPerformance, useSalesReport, useWarehouseDistribution } from '../../hooks/useCommercial';
import { useCategories } from '../../hooks/useData';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const PERIOD_OPTIONS = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
];

const AGING_CONFIG = {
    fresh: { label: 'Fresco', color: 'bg-green-600 text-white', bar: 'bg-green-400', badgeVariant: 'success' as const },
    slow: { label: 'Lento (31-60d)', color: 'bg-yellow-500 text-white', bar: 'bg-yellow-300', badgeVariant: 'warning' as const },
    aging: { label: 'A Envelhecer (61-90d)', color: 'bg-orange-500 text-white', bar: 'bg-orange-300', badgeVariant: 'warning' as const },
    critical: { label: 'Crítico (>90d)', color: 'bg-red-600 text-white', bar: 'bg-red-400', badgeVariant: 'danger' as const },
};

type ReportTab = 'sales' | 'aging' | 'suppliers' | 'warehouses';

export default function CommercialReports() {
    const [activeTab, setActiveTab] = useState<ReportTab>('sales');
    const [period, setPeriod] = useState(30);
    const [agingFilter, setAgingFilter] = useState<string>('');

    const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useSalesReport(period);
    const { data: agingData, isLoading: agingLoading, refetch: refetchAging } = useStockAging();
    const { data: supplierData, isLoading: supplierLoading, refetch: refetchSuppliers } = useSupplierPerformance();
    const { data: warehouseData, isLoading: warehouseLoading, refetch: refetchWarehouses } = useWarehouseDistribution();
    const { categories } = useCategories();


    const categoryProductData = useMemo(() => {
        if (!categories || categories.length === 0) return [];
        return categories
            .filter(c => (c.productCount || 0) > 0)
            .map(c => ({ name: c.name, value: c.productCount || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [categories]);

    const handleRefetch = () => {
        if (activeTab === 'sales') refetchSales();
        else if (activeTab === 'aging') refetchAging();
        else if (activeTab === 'suppliers') refetchSuppliers();
        else refetchWarehouses();
    };

    const filteredAgingProducts = agingData?.products.filter(p =>
        !agingFilter || p.agingBucket === agingFilter
    ) || [];

    const agingColumns = useMemo<ColumnDef<any, any>[]>(() => [
        {
            accessorKey: 'name',
            header: 'Produto',
            cell: (info: any) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-white">{info.getValue()}</span>
                    <span className="text-xs text-gray-400">{info.row.original.code}</span>
                </div>
            )
        },
        {
            accessorKey: 'category',
            header: 'Categoria',
            cell: (info: any) => <span className="capitalize text-xs text-gray-500">{info.getValue()}</span>
        },
        {
            accessorKey: 'currentStock',
            header: 'Stock',
            meta: { align: 'right' }
        },
        {
            accessorKey: 'stockValue',
            header: 'Valor',
            cell: (info: any) => formatCurrency(info.getValue()),
            meta: { align: 'right' }
        },
        {
            accessorKey: 'daysSinceLastSale',
            header: 'Dias sem venda',
            cell: (info: any) => {
                const p = info.row.original;
                return (
                    <span className={cn(
                        'font-bold',
                        p.agingBucket === 'critical' ? 'text-red-500' :
                        p.agingBucket === 'aging' ? 'text-orange-500' :
                        p.agingBucket === 'slow' ? 'text-yellow-500' : 'text-green-500'
                    )}>
                        {info.getValue()}d
                    </span>
                );
            },
            meta: { align: 'right' }
        },
        {
            accessorKey: 'agingBucket',
            header: 'Estado',
            cell: (info: any) => {
                const cfg = AGING_CONFIG[info.getValue() as keyof typeof AGING_CONFIG];
                return <Badge variant={cfg.badgeVariant} size="sm">{cfg.label}</Badge>;
            },
            meta: { align: 'center' }
        }
    ], []);

    const supplierColumns = useMemo<ColumnDef<any, any>[]>(() => [
        {
            accessorKey: 'name',
            header: 'Fornecedor',
            cell: (info: any) => (
                <div className="flex flex-col">
                    <p className="font-medium text-gray-900 dark:text-white">{info.getValue()}</p>
                    {info.row.original.contactPerson && <p className="text-xs text-gray-400">{info.row.original.contactPerson}</p>}
                </div>
            )
        },
        {
            accessorKey: 'totalOrders',
            header: 'Ordens',
            meta: { align: 'right' }
        },
        {
            accessorKey: 'totalSpend',
            header: 'Gasto Total',
            cell: (info: any) => formatCurrency(info.getValue()),
            meta: { align: 'right' }
        },
        {
            accessorKey: 'avgOrderValue',
            header: 'Média/Ordem',
            cell: (info: any) => formatCurrency(info.getValue()),
            meta: { align: 'right' }
        },
        {
            accessorKey: 'onTimeRate',
            header: 'Pontualidade',
            cell: (info: any) => (
                info.getValue() !== null ? (
                    <Badge
                        variant={info.getValue() >= 80 ? 'success' : info.getValue() >= 50 ? 'warning' : 'danger'}
                        size="sm"
                    >
                        {info.getValue().toFixed(0)}%
                    </Badge>
                ) : <span className="text-gray-400 text-xs">--</span>
            ),
            meta: { align: 'right' }
        },
        {
            accessorKey: 'pendingOrders',
            header: 'Pendentes',
            cell: (info: any) => {
                const s = info.row.original;
                return info.getValue() > 0 ? (
                    <span className={cn(
                        'font-medium',
                        s.overdueOrders > 0 ? 'text-red-500' : 'text-yellow-500'
                    )}>
                        {info.getValue()}
                        {s.overdueOrders > 0 && ` (${s.overdueOrders} atraso)`}
                    </span>
                ) : <span className="text-gray-400">0</span>;
            },
            meta: { align: 'right' }
        },
        {
            accessorKey: 'productCount',
            header: 'Produtos',
            meta: { align: 'right' }
        }
    ], []);

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            {/* Report Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 bg-white/50 dark:bg-dark-900/50 p-2 rounded-xl border border-gray-100 dark:border-dark-700/50">
                {activeTab === 'sales' && (
                    <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 border border-gray-200 dark:border-dark-700 shadow-sm h-10">
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setPeriod(opt.value)}
                                className={cn(
                                    'px-4 h-full text-[10px] font-black uppercase tracking-widest rounded-md transition-all duration-300',
                                    period === opt.value
                                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                        : 'text-gray-500 hover:text-primary-600 dark:hover:text-primary-400'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefetch}
                    className="p-2 h-10 w-10 flex items-center justify-center text-gray-400 hover:text-primary-600"
                >
                    <HiOutlineArrowPath className={cn("w-5 h-5", (salesLoading || agingLoading || supplierLoading || warehouseLoading) && "animate-spin")} />
                </Button>
            </div>

            <div className="flex gap-1 bg-slate-100/70 dark:bg-dark-700/50 rounded-lg p-1 shadow-inner">
                {[
                    { key: 'sales', label: 'Vendas & Produtos', icon: HiOutlineChartBar, color: 'text-blue-500' },
                    { key: 'aging', label: 'Stock Envelhecido', icon: HiOutlineClock, color: 'text-amber-500' },
                    { key: 'suppliers', label: 'Fornecedores', icon: HiOutlineTruck, color: 'text-indigo-500' },
                    { key: 'warehouses', label: 'Distribuição', icon: HiOutlineCircleStack, color: 'text-emerald-500' },
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as ReportTab)}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-black uppercase tracking-widest rounded-lg transition-all duration-300',
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            )}
                        >
                            <Icon className={cn("w-4 h-4", activeTab === tab.key ? "" : tab.color + " opacity-50")} />
                            <span className="hidden lg:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* ---- Sales Report ------------------------------------------------------------------------------------------ */}
            {activeTab === 'sales' && (
                salesLoading ? (
                    <div className="space-y-4">
                        <div className="h-64 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-48 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                            <div className="h-48 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Daily chart */}
                        <Card padding="lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <HiOutlineArrowTrendingUp className="text-primary-600 dark:text-primary-400" />
                                Vendas Diárias -- Últimos {period} dias
                            </h3>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={salesData?.dailySales || []}
                                        margin={{ top: 4, right: 4, left: 0, bottom: 20 }}
                                        barCategoryGap="20%"
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.08} />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 9, fill: '#9ca3af', fontWeight: 600 }}
                                            tickFormatter={(v: string) => v.slice(5)}
                                            angle={-40}
                                            textAnchor="end"
                                            interval={period <= 7 ? 0 : Math.floor((salesData?.dailySales?.length ?? 1) / 10)}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 9, fill: '#9ca3af' }}
                                            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                                            width={36}
                                        />
                                        <RechartsTooltip
                                            cursor={{ fill: 'rgba(59,130,246,0.06)' }}
                                            contentStyle={{
                                                backgroundColor: 'rgba(15,23,42,0.95)',
                                                backdropFilter: 'blur(12px)',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                color: '#fff',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                                padding: '10px'
                                            }}
                                            itemStyle={{ color: '#fff', fontWeight: '600' }}
                                            labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                            formatter={(value: any) => [formatCurrency(value), 'Receita']}
                                            labelFormatter={(label: string) => label}
                                        />
                                        <Bar
                                            dataKey="revenue"
                                            fill="#3b82f6"
                                            radius={[4, 4, 0, 0]}
                                            maxBarSize={24}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top products */}
                            <Card padding="lg">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineCube className="text-primary-600 dark:text-primary-400" />
                                    Top Produtos por Receita
                                </h3>
                                <div className="space-y-3">
                                    {salesData?.topProducts.slice(0, 8).map((tp, i) => {
                                        const maxRev = Math.max(...(salesData.topProducts.map(p => p.revenue)), 1);
                                        return (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className="text-xs text-gray-400 w-5 text-center">{i + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-300 truncate">
                                                            {tp.product?.name || 'Produto'}
                                                        </p>
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white ml-2">{formatCurrency(tp.revenue)}</span>
                                                    </div>
                                                    <div className="h-2 bg-primary-100 dark:bg-primary-900/30 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                            style={{ width: `${(tp.revenue / maxRev) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!salesData?.topProducts || salesData.topProducts.length === 0) && (
                                        <p className="text-center text-gray-500 text-sm py-4">Sem dados no período</p>
                                    )}
                                </div>
                            </Card>

                            <Card padding="lg">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Métodos de Pagamento</h3>
                                <div className="space-y-3">
                                    {salesData?.paymentMethods.map((pm, i) => {
                                        const totalPM = salesData.paymentMethods.reduce((s, m) => s + m.total, 0);
                                        const pct = totalPM > 0 ? (pm.total / totalPM) * 100 : 0;
                                        const colors = ['bg-primary-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400', 'bg-orange-400'];
                                        return (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-700 dark:text-gray-300 capitalize">{pm.method}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400">{pm.count} transações</span>
                                                        <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(pm.total)}</span>
                                                    </div>
                                                </div>
                                                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${colors[i % colors.length]} rounded-full shadow-sm`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!salesData?.paymentMethods || salesData.paymentMethods.length === 0) && (
                                        <p className="text-center text-gray-500 text-sm py-4">Sem dados no período</p>
                                    )}
                                </div>
                            </Card>
                        </div>

                        <Card padding="lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Produtos por Categoria</h3>
                            <div className="h-64 flex flex-col md:flex-row items-center gap-8">
                                <div className="w-full md:w-1/2 h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryProductData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                                animationDuration={1500}
                                            >
                                                {categoryProductData.map((_, index) => (
                                                    <Cell key={`cell-prod-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15,23,42,0.95)',
                                                    backdropFilter: 'blur(12px)',
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    color: '#fff',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                                    padding: '10px'
                                                }}
                                                itemStyle={{ color: '#fff', fontWeight: '600' }}
                                                labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-full md:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {categoryProductData.map((cat, i) => (
                                        <div key={cat.name} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            <span className="text-sm text-gray-600 dark:text-gray-400 capitalize truncate">{cat.name}</span>
                                            <span className="text-sm font-bold ml-auto">{cat.value}</span>
                                        </div>
                                    ))}
                                    {categoryProductData.length === 0 && (
                                        <p className="col-span-2 text-center text-gray-500 text-sm py-4">Nenhuma categoria com produtos</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                )
            )}

            {activeTab === 'aging' && (
                agingLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />)}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {agingData?.summary && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(AGING_CONFIG).map(([key, cfg]) => {
                                    const count = agingData.summary[key as keyof typeof agingData.summary] as number;
                                    const bgClass = key === 'fresh' ? 'bg-green-100/40 dark:bg-green-900/20 border-green-200/50 dark:border-green-800/30' :
                                                    key === 'slow' ? 'bg-yellow-100/40 dark:bg-yellow-900/20 border-yellow-200/50 dark:border-yellow-800/30' :
                                                    key === 'aging' ? 'bg-orange-100/40 dark:bg-orange-900/20 border-orange-200/50 dark:border-orange-800/30' :
                                                    'bg-red-100/40 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/30';
                                    
                                    const textClass = key === 'fresh' ? 'text-green-700 dark:text-green-300' :
                                                      key === 'slow' ? 'text-yellow-700 dark:text-yellow-300' :
                                                      key === 'aging' ? 'text-orange-700 dark:text-orange-300' :
                                                      'text-red-700 dark:text-red-300';

                                    const labelClass = key === 'fresh' ? 'text-green-600/70 dark:text-green-400/60' :
                                                       key === 'slow' ? 'text-yellow-600/70 dark:text-yellow-400/60' :
                                                       key === 'aging' ? 'text-orange-600/70 dark:text-orange-400/60' :
                                                       'text-red-600/70 dark:text-red-400/60';

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setAgingFilter(agingFilter === key ? '' : key)}
                                            className={cn(
                                                'text-left p-4 rounded-xl border shadow-card-strong transition-all backdrop-blur-sm group flex flex-col justify-between h-full hover:scale-[1.02]',
                                                bgClass,
                                                agingFilter === key ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-900' : ''
                                            )}
                                        >
                                            <p className={cn("text-[10px] font-black uppercase tracking-widest", labelClass)}>{cfg.label}</p>
                                            <p className={cn("text-3xl font-black mt-1 tracking-tighter", textClass)}>{count}</p>
                                            <p className={cn("text-[10px] uppercase font-black opacity-60", textClass)}>produtos</p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Value at risk */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MetricCard
                                label="Valor Total em Stock"
                                value={formatCurrency(agingData?.summary.totalStockValue || 0)}
                                color="primary"
                                icon={<HiOutlineCircleStack className="w-5 h-5" />}
                            />
                            <MetricCard
                                label="Valor em Stock Crítico (>90 dias)"
                                value={formatCurrency(agingData?.summary.criticalValue || 0)}
                                color="red"
                                icon={<HiOutlineExclamationTriangle className="w-5 h-5" />}
                            />
                        </div>

                        {/* Products table */}
                        <SmartTable
                            data={filteredAgingProducts}
                            columns={agingColumns}
                            isLoading={agingLoading}
                            onRefresh={refetchAging}
                            renderFilters={
                                agingFilter && (
                                    <div className="flex items-center gap-2">
                                        <Badge variant={AGING_CONFIG[agingFilter as keyof typeof AGING_CONFIG]?.badgeVariant} size="sm">
                                            Filtrando por: {AGING_CONFIG[agingFilter as keyof typeof AGING_CONFIG]?.label}
                                        </Badge>
                                        <Button size="xs" variant="ghost" onClick={() => setAgingFilter('')} className="h-6 px-2">Limpar</Button>
                                    </div>
                                )
                            }
                            exportConfig={{
                                filename: `stock_aging_${agingFilter || 'all'}`,
                                title: `Relatório de Envelhecimento de Stock - ${agingFilter ? AGING_CONFIG[agingFilter as keyof typeof AGING_CONFIG]?.label : 'Todos'}`,
                                columns: [
                                    { key: 'code', header: 'Código', width: 15 },
                                    { key: 'name', header: 'Produto', width: 30 },
                                    { key: 'category', header: 'Categoria', width: 20 },
                                    { key: 'currentStock', header: 'Stock', format: 'number', width: 10, align: 'right' },
                                    { key: 'stockValue', header: 'Valor', format: 'currency', width: 15, align: 'right' },
                                    { key: 'daysSinceLastSale', header: 'Dias s/ Venda', width: 12, align: 'right' },
                                    { key: 'agingBucket', header: 'Estado', width: 15 }
                                ]
                            }}
                            emptyTitle="Nenhum produto nesta categoria"
                        />
                    </div>
                )
            )}

            {/* ── Supplier Performance ───────────────────────────────────────── */}
            {activeTab === 'suppliers' && (
                supplierLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />)}
                    </div>
                ) : supplierData.length === 0 ? (
                    <Card padding="lg" className="text-center py-16">
                        <HiOutlineTruck className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-3 opacity-50" />
                        <p className="text-gray-500">Nenhum fornecedor com dados de performance</p>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {/* Top 3 cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {supplierData.slice(0, 3).map((s, i) => (
                                <Card key={s.id} padding="md" className={cn(
                                    'border-l-4',
                                    i === 0 ? 'border-l-yellow-400' : i === 1 ? 'border-l-gray-400' : 'border-l-orange-400'
                                )}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-gray-400">#{i + 1} Fornecedor</span>
                                        {s.overdueOrders > 0 && (
                                            <Badge variant="danger" size="sm" className="flex items-center gap-1">
                                                <HiOutlineExclamationTriangle className="w-2.5 h-2.5" /> {s.overdueOrders} atraso
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{s.name}</p>
                                    <p className="text-xs text-gray-500 mb-2">{s.totalOrders} ordens · {s.productCount} produtos</p>
                                    <p className="text-xl font-bold text-primary-500">{formatCurrency(s.totalSpend)}</p>
                                    <p className="text-xs text-gray-400">gasto total</p>
                                    {s.onTimeRate !== null && (
                                        <div className="mt-2">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Pontualidade</span>
                                                <span className={s.onTimeRate >= 80 ? 'text-green-500 font-bold' : s.onTimeRate >= 50 ? 'text-yellow-500' : 'text-red-500'}>
                                                    {s.onTimeRate.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${s.onTimeRate >= 80 ? 'bg-green-400' : s.onTimeRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                    style={{ width: `${s.onTimeRate}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>

                        {/* Full table */}
                        <SmartTable
                            data={supplierData}
                            columns={supplierColumns}
                            isLoading={supplierLoading}
                            onRefresh={refetchSuppliers}
                            exportConfig={{
                                filename: 'performance_fornecedores',
                                title: 'Relatório de Performance de Fornecedores',
                                columns: [
                                    { key: 'name', header: 'Fornecedor', width: 30 },
                                    { key: 'totalOrders', header: 'Ordens', width: 10, align: 'right' },
                                    { key: 'totalSpend', header: 'Gasto Total', format: 'currency', width: 20, align: 'right' },
                                    { key: 'onTimeRate', header: 'Pontualidade (%)', width: 15, align: 'right' },
                                    { key: 'pendingOrders', header: 'Ordens Pendentes', width: 15, align: 'right' },
                                    { key: 'productCount', header: 'Produtos', width: 10, align: 'right' }
                                ]
                            }}
                            emptyTitle="Nenhum fornecedor com dados"
                        />
                    </div>
                )
            )}

            {/* ── Warehouse Distribution ─────────────────────────────────── */}
            {activeTab === 'warehouses' && (
                warehouseLoading ? (
                    <div className="space-y-4">
                        <div className="h-64 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="h-48 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                            <div className="h-48 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <MetricCard
                                label="Valoração Total em Stock"
                                value={formatCurrency(warehouseData.reduce((s, w) => s + w.valuation, 0))}
                                color="primary"
                                icon={<HiOutlineCircleStack className="w-5 h-5" />}
                            />
                            <MetricCard
                                label="Volume Físico (Itens)"
                                value={warehouseData.reduce((s, w) => s + w.volume, 0).toLocaleString()}
                                color="green"
                                icon={<HiOutlineCube className="w-5 h-5" />}
                            />
                            <MetricCard
                                label="Localizaces Activas"
                                value={warehouseData.length}
                                color="blue"
                                icon={<HiOutlineTruck className="w-5 h-5" />}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Valuation Chart */}
                            <Card padding="lg">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Investimento por Armazém (Valoração)</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={warehouseData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="valuation"
                                                nameKey="name"
                                                animationDuration={1500}
                                            >
                                                {warehouseData.map((_, index) => (
                                                    <Cell key={`cell-wh-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(value: any) => [formatCurrency(value), 'Valor']}
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                    backdropFilter: 'blur(12px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    color: '#fff',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                                    padding: '10px'
                                                }}
                                                itemStyle={{ color: '#fff', fontWeight: '600' }}
                                                labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {warehouseData.map((w, i) => (
                                        <div key={w.id} className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{w.name}</span>
                                            <span className="text-xs font-bold ml-auto">{((w.valuation / warehouseData.reduce((s, x) => s + x.valuation, 0.1)) * 100).toFixed(1)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Volume Chart */}
                            <Card padding="lg">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Volume Físico por Armazém</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={warehouseData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.05} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={80} />
                                            <RechartsTooltip
                                                cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                    backdropFilter: 'blur(12px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    color: '#fff',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                                    padding: '10px'
                                                }}
                                                itemStyle={{ color: '#fff', fontWeight: '600' }}
                                                labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                            />
                                            <Bar dataKey="volume" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider font-semibold">Total de unidades em stock</p>
                            </Card>
                        </div>

                        {/* Top Products per Warehouse */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {warehouseData.map((w) => (
                                <Card key={w.id} padding="md">
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50 dark:border-dark-700">
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{w.name}</h4>
                                            <p className="text-[10px] text-gray-500">{w.productCount} tipos de produtos</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-primary-500">{formatCurrency(w.valuation)}</p>
                                            <p className="text-[10px] text-gray-400 capitalize">{w.location || 'Sem localização'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {w.topProducts.map((p) => (
                                            <div key={p.id} className="flex items-center justify-between group">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{p.name}</p>
                                                    <p className="text-[10px] text-gray-400">{p.code}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(p.value)}</p>
                                                    <p className="text-[10px] text-gray-400">{p.quantity} un.</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )
            )}

        </div>
    );
}
