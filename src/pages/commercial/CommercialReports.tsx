import { useState, useMemo } from 'react';
import {
    HiOutlineDocumentReport,
    HiOutlineChartBar,
    HiOutlineTrendingUp,
    HiOutlineCube,
    HiOutlineTruck,
    HiOutlineClock,
    HiOutlineRefresh,
    HiOutlineExclamation,
    HiOutlineCheckCircle,
} from 'react-icons/hi';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import { Card, Badge, Button } from '../../components/ui';
import { formatCurrency, cn } from '../../utils/helpers';
import { useStockAging, useSupplierPerformance, useSalesReport } from '../../hooks/useCommercial';
import { useCategories } from '../../hooks/useData';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const PERIOD_OPTIONS = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
];

const AGING_CONFIG = {
    fresh: { label: 'Fresco', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', bar: 'bg-green-400', badgeVariant: 'success' as const },
    slow: { label: 'Lento (31-60d)', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', bar: 'bg-yellow-400', badgeVariant: 'warning' as const },
    aging: { label: 'A Envelhecer (61-90d)', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', bar: 'bg-orange-400', badgeVariant: 'warning' as const },
    critical: { label: 'Crítico (>90d)', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', bar: 'bg-red-400', badgeVariant: 'danger' as const },
};

type ReportTab = 'sales' | 'aging' | 'suppliers';

export default function CommercialReports() {
    const [activeTab, setActiveTab] = useState<ReportTab>('sales');
    const [period, setPeriod] = useState(30);
    const [agingFilter, setAgingFilter] = useState<string>('');

    const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useSalesReport(period);
    const { data: agingData, isLoading: agingLoading, refetch: refetchAging } = useStockAging();
    const { data: supplierData, isLoading: supplierLoading, refetch: refetchSuppliers } = useSupplierPerformance();
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
        else refetchSuppliers();
    };

    const filteredAgingProducts = agingData?.products.filter(p =>
        !agingFilter || p.agingBucket === agingFilter
    ) || [];

    const maxDailySales = Math.max(...(salesData?.dailySales.map(d => d.revenue) || [1]));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineDocumentReport className="text-primary-500" />
                        Relatórios Comerciais
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Análise detalhada de vendas, stock envelhecido e fornecedores</p>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'sales' && (
                        <div className="flex bg-gray-100 dark:bg-dark-700 rounded-lg p-1 gap-1">
                            {PERIOD_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setPeriod(opt.value)}
                                    className={cn(
                                        'px-3 py-1 text-xs font-medium rounded-md transition-all',
                                        period === opt.value
                                            ? 'bg-white dark:bg-dark-600 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <button onClick={handleRefetch} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <HiOutlineRefresh className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-xl p-1">
                {[
                    { key: 'sales', label: 'Vendas & Produtos', icon: HiOutlineChartBar },
                    { key: 'aging', label: 'Stock Envelhecido', icon: HiOutlineClock },
                    { key: 'suppliers', label: 'Fornecedores', icon: HiOutlineTruck },
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as ReportTab)}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all',
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-dark-600 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Sales Report ────────────────────────────────────────────── */}
            {activeTab === 'sales' && (
                salesLoading ? (
                    <div className="space-y-4">
                        <div className="h-64 bg-gray-100 dark:bg-dark-700 rounded-xl animate-pulse" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-48 bg-gray-100 dark:bg-dark-700 rounded-xl animate-pulse" />
                            <div className="h-48 bg-gray-100 dark:bg-dark-700 rounded-xl animate-pulse" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Daily chart */}
                        <Card padding="lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <HiOutlineTrendingUp className="text-primary-500" />
                                Vendas Diárias — Últimos {period} dias
                            </h3>
                            <div className="h-48 flex items-end gap-1 pt-4 overflow-x-auto">
                                {(salesData?.dailySales || []).map((day, i) => (
                                    <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1 group" style={{ minWidth: '20px' }}>
                                        <div
                                            className="w-full bg-primary-100 dark:bg-primary-900/20 group-hover:bg-primary-500 transition-colors rounded-t relative"
                                            style={{ height: `${Math.max(6, (day.revenue / maxDailySales) * 160)}px` }}
                                        >
                                            <div className="absolute top-[-28px] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                                {formatCurrency(day.revenue)}
                                            </div>
                                        </div>
                                        <span className="text-[9px] text-gray-400 rotate-45 origin-left">{day.date.slice(5)}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top products */}
                            <Card padding="lg">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineCube className="text-primary-500" />
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
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                                            {tp.product?.name || 'Produto'}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white ml-2">{formatCurrency(tp.revenue)}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary-400 rounded-full"
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

                            {/* Payment methods */}
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
                                                        <span className="text-xs text-gray-400">{pm.count} transacções</span>
                                                        <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(pm.total)}</span>
                                                    </div>
                                                </div>
                                                <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${colors[i % colors.length]} rounded-full`}
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

                        {/* Category distribution */}
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
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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

            {/* ── Stock Aging ─────────────────────────────────────────────── */}
            {activeTab === 'aging' && (
                agingLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-dark-700 rounded-xl animate-pulse" />)}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary cards */}
                        {agingData?.summary && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(AGING_CONFIG).map(([key, cfg]) => {
                                    const count = agingData.summary[key as keyof typeof agingData.summary] as number;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setAgingFilter(agingFilter === key ? '' : key)}
                                            className={cn(
                                                'text-left p-4 rounded-xl border-2 transition-all',
                                                agingFilter === key
                                                    ? 'border-primary-500 shadow-md'
                                                    : 'border-transparent',
                                                cfg.color
                                            )}
                                        >
                                            <p className="text-xs font-medium opacity-80">{cfg.label}</p>
                                            <p className="text-2xl font-bold mt-1">{count}</p>
                                            <p className="text-xs opacity-70">produtos</p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Value at risk */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card padding="md" className="border-l-4 border-l-gray-400">
                                <p className="text-xs text-gray-500">Valor Total em Stock</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                    {formatCurrency(agingData?.summary.totalStockValue || 0)}
                                </p>
                            </Card>
                            <Card padding="md" className="border-l-4 border-l-red-500">
                                <p className="text-xs text-gray-500">Valor em Stock Crítico (&gt;90 dias)</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                                    {formatCurrency(agingData?.summary.criticalValue || 0)}
                                </p>
                            </Card>
                        </div>

                        {/* Products table */}
                        <Card padding="lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-gray-900 dark:text-white">
                                    Produtos por Envelhecimento
                                    {agingFilter && (
                                        <span className="ml-2 text-sm text-primary-500">
                                            — {AGING_CONFIG[agingFilter as keyof typeof AGING_CONFIG]?.label}
                                        </span>
                                    )}
                                </h3>
                                {agingFilter && (
                                    <Button size="sm" variant="ghost" onClick={() => setAgingFilter('')}>
                                        Limpar filtro
                                    </Button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                            <th className="text-left py-2 font-medium">Produto</th>
                                            <th className="text-left py-2 font-medium hidden md:table-cell">Categoria</th>
                                            <th className="text-right py-2 font-medium">Stock</th>
                                            <th className="text-right py-2 font-medium">Valor</th>
                                            <th className="text-right py-2 font-medium">Dias sem venda</th>
                                            <th className="text-center py-2 font-medium">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAgingProducts.slice(0, 50).map(p => {
                                            const cfg = AGING_CONFIG[p.agingBucket];
                                            return (
                                                <tr key={p.id} className="border-b border-gray-50 dark:border-dark-700/50 hover:bg-gray-50 dark:hover:bg-dark-700/30">
                                                    <td className="py-2.5">
                                                        <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                                                        <span className="ml-1 text-xs text-gray-400">{p.code}</span>
                                                    </td>
                                                    <td className="py-2.5 hidden md:table-cell text-gray-500 capitalize text-xs">{p.category}</td>
                                                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{p.currentStock}</td>
                                                    <td className="py-2.5 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(p.stockValue)}</td>
                                                    <td className="py-2.5 text-right">
                                                        <span className={cn(
                                                            'font-bold',
                                                            p.agingBucket === 'critical' ? 'text-red-500' :
                                                            p.agingBucket === 'aging' ? 'text-orange-500' :
                                                            p.agingBucket === 'slow' ? 'text-yellow-500' : 'text-green-500'
                                                        )}>
                                                            {p.daysSinceLastSale}d
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 text-center">
                                                        <Badge variant={cfg.badgeVariant} size="sm">{cfg.label}</Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredAgingProducts.length === 0 && (
                                    <div className="text-center py-12">
                                        <HiOutlineCheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                                        <p className="text-gray-500">Nenhum produto nesta categoria de envelhecimento</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                )
            )}

            {/* ── Supplier Performance ────────────────────────────────────── */}
            {activeTab === 'suppliers' && (
                supplierLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-dark-700 rounded-xl animate-pulse" />)}
                    </div>
                ) : supplierData.length === 0 ? (
                    <Card padding="lg" className="text-center py-16">
                        <HiOutlineTruck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
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
                                                <HiOutlineExclamation className="w-2.5 h-2.5" /> {s.overdueOrders} atraso
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
                        <Card padding="lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Todos os Fornecedores</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                            <th className="text-left py-2 font-medium">Fornecedor</th>
                                            <th className="text-right py-2 font-medium">Ordens</th>
                                            <th className="text-right py-2 font-medium">Gasto Total</th>
                                            <th className="text-right py-2 font-medium">Média/Ordem</th>
                                            <th className="text-right py-2 font-medium">Pontualidade</th>
                                            <th className="text-right py-2 font-medium">Pendentes</th>
                                            <th className="text-right py-2 font-medium hidden md:table-cell">Produtos</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supplierData.map(s => (
                                            <tr key={s.id} className="border-b border-gray-50 dark:border-dark-700/50 hover:bg-gray-50 dark:hover:bg-dark-700/30">
                                                <td className="py-2.5">
                                                    <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                                                    {s.contactPerson && <p className="text-xs text-gray-400">{s.contactPerson}</p>}
                                                </td>
                                                <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{s.totalOrders}</td>
                                                <td className="py-2.5 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(s.totalSpend)}</td>
                                                <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">{formatCurrency(s.avgOrderValue)}</td>
                                                <td className="py-2.5 text-right">
                                                    {s.onTimeRate !== null ? (
                                                        <Badge
                                                            variant={s.onTimeRate >= 80 ? 'success' : s.onTimeRate >= 50 ? 'warning' : 'danger'}
                                                            size="sm"
                                                        >
                                                            {s.onTimeRate.toFixed(0)}%
                                                        </Badge>
                                                    ) : <span className="text-gray-400 text-xs">—</span>}
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    {s.pendingOrders > 0 ? (
                                                        <span className={cn(
                                                            'font-medium',
                                                            s.overdueOrders > 0 ? 'text-red-500' : 'text-yellow-500'
                                                        )}>
                                                            {s.pendingOrders}
                                                            {s.overdueOrders > 0 && ` (${s.overdueOrders} atr.)`}
                                                        </span>
                                                    ) : <span className="text-gray-400">0</span>}
                                                </td>
                                                <td className="py-2.5 text-right hidden md:table-cell text-gray-600 dark:text-gray-400">{s.productCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )
            )}
        </div>
    );
}
