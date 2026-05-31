import { useState } from 'react';
import { Card, Badge, Button, Input, Modal, Select, PageHeader, Pagination, SmartTable } from '../../components/ui';
import { usePagination } from '../../components/ui/Pagination';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { productsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
    HiOutlineAdjustmentsHorizontal, 
    HiOutlineChartBar, 
    HiOutlineArrowPath, 
    HiOutlineArrowTrendingUp, 
    HiOutlineArrowTrendingDown, 
    HiOutlineCube, 
    HiOutlineTag,
    HiOutlineArrowSmallUp,
    HiOutlineArrowSmallDown
} from 'react-icons/hi2';
import { formatCurrency, cn } from '../../utils/helpers';
import { useMarginAnalysis, useInventoryTurnover } from '../../hooks/useCommercial';
import { getApiErrorMessage } from '../../utils/apiError';
import { SegmentedControl } from '../../components/common/SegmentedControl';

const PERIOD_OPTIONS = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
    { label: '180 dias', value: 180 },
];

type MarginTab = 'category' | 'product' | 'trend' | 'turnover';
type BulkAdjustmentType = 'percentage' | 'fixed';
type BulkOperation = 'increase' | 'decrease';

const TABS: Array<{ key: MarginTab; label: string; icon: typeof HiOutlineTag }> = [
    { key: 'category', label: 'Por Categoria', icon: HiOutlineTag },
    { key: 'product', label: 'Por Produto', icon: HiOutlineCube },
    { key: 'trend', label: 'Tendencia Mensal', icon: HiOutlineArrowTrendingUp },
    { key: 'turnover', label: 'Rotatividade', icon: HiOutlineArrowPath },
];

const isBulkOperation = (value: string): value is BulkOperation => value === 'increase' || value === 'decrease';
const isBulkAdjustmentType = (value: string): value is BulkAdjustmentType => value === 'percentage' || value === 'fixed';

function MarginBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
    return (
        <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-800/50 rounded-full overflow-hidden border border-gray-200/10 active:scale-[1.02] transition-transform">
            <div 
                className={cn('h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]', color)} 
                style={{ width: `${pct}%`, backgroundColor: 'currentColor' }} 
            />
        </div>
    );
}

function getMarginColor(margin: number) {
    if (margin >= 40) return 'text-green-600 dark:text-green-400';
    if (margin >= 20) return 'text-blue-600 dark:text-blue-400';
    if (margin >= 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
}

function getMarginBadge(margin: number): 'success' | 'info' | 'warning' | 'danger' {
    if (margin >= 40) return 'success';
    if (margin >= 20) return 'info';
    if (margin >= 10) return 'warning';
    return 'danger';
}

export default function MarginAnalysis() {
    const [period, setPeriod] = useState(30);
    const [activeTab, setActiveTab] = useState<MarginTab>('category');
    const [productSearch, setProductSearch] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);

    const { data, isLoading, refetch } = useMarginAnalysis(period);
    const { data: turnoverData, isLoading: turnoverLoading } = useInventoryTurnover(period === 7 ? 30 : period);

    const totalRevenue = data?.byCategory.reduce((s, c) => s + c.revenue, 0) || 0;
    const totalCogs = data?.byCategory.reduce((s, c) => s + c.cogs, 0) || 0;
    const totalProfit = totalRevenue - totalCogs;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const maxCatRevenue = Math.max(...(data?.byCategory.map(c => c.revenue) || [1]));
    const maxProdProfit = Math.max(...(data?.byProduct.map(p => p.profit) || [1]));

    const filteredProducts = (data?.byProduct || []).filter(p =>
        !productSearch ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    const {
        currentPage,
        paginatedItems,
        setCurrentPage: setPage,
        itemsPerPage,
        setItemsPerPage
    } = usePagination(filteredProducts, 20);

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Análise de Margens" 
                subtitle="Visão detalhada de rentabilidade por produto e categoria"
                icon={<HiOutlineChartBar className="text-primary-600 dark:text-primary-400" />}
            />
            {/* Margin Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 w-full bg-white/50 dark:bg-dark-900/50 p-2 rounded-xl border border-gray-100 dark:border-dark-700/50">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBulkModal(true)}
                    className="font-black text-[10px] uppercase tracking-widest text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 w-full sm:w-auto flex items-center justify-center h-10"
                    leftIcon={<HiOutlineAdjustmentsHorizontal className="w-4 h-4" />}
                >
                    Ajuste em Massa
                </Button>
                
                <SegmentedControl
                    options={PERIOD_OPTIONS}
                    value={period}
                    onChange={setPeriod}
                    className="w-full sm:w-auto"
                />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={refetch}
                    className="p-2 h-10 w-full sm:w-10 flex items-center justify-center text-gray-400 hover:text-primary-500"
                >
                    <HiOutlineArrowPath className={cn("w-5 h-5", isLoading && "animate-spin")} />
                </Button>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Receita Total"
                    value={formatCurrency(totalRevenue)}
                    color="primary"
                    icon={<HiOutlineArrowTrendingUp className="w-5 h-5" />}
                />
                <MetricCard
                    label="COGS (Custo Vendas)"
                    value={formatCurrency(totalCogs)}
                    color="orange"
                    icon={<HiOutlineCube className="w-5 h-5" />}
                />
                <MetricCard
                    label="Lucro Bruto"
                    value={formatCurrency(totalProfit)}
                    color={totalProfit >= 0 ? "success" : "danger"}
                    icon={totalProfit >= 0 ? <HiOutlineArrowTrendingUp className="w-5 h-5" /> : <HiOutlineArrowTrendingDown className="w-5 h-5" />}
                />
                <MetricCard
                    label="Margem Global"
                    value={`${overallMargin.toFixed(1)}%`}
                    color="blue"
                    icon={<HiOutlineChartBar className="w-5 h-5" />}
                    badge={<span className={cn("text-[9px] font-bold uppercase tracking-tight", getMarginColor(overallMargin))}>Desempenho</span>}
                />
            </div>

            {/* Tabs */}
            <div className="w-full overflow-x-auto overscroll-x-contain scrollbar-none pb-1">
                <div className="flex gap-1 bg-gray-100 dark:bg-dark-800/80 backdrop-blur-sm rounded-lg p-1 border border-gray-200 dark:border-dark-700 shadow-inner w-full min-w-[340px]">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <Button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as MarginTab)}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'h-10 flex-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center justify-center gap-1.5 px-1 sm:px-3 transition-all duration-300',
                                    activeTab === tab.key
                                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-white shadow-lg shadow-black/5 scale-[1.02]'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                                )}
                            >
                                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>
                                    {tab.key === 'category' && (
                                        <>
                                            <span className="hidden md:inline">Por Categoria</span>
                                            <span className="inline md:hidden">Categorias</span>
                                        </>
                                    )}
                                    {tab.key === 'product' && (
                                        <>
                                            <span className="hidden md:inline">Por Produto</span>
                                            <span className="inline md:hidden">Produtos</span>
                                        </>
                                    )}
                                    {tab.key === 'trend' && (
                                        <>
                                            <span className="hidden md:inline">Tendência Mensal</span>
                                            <span className="inline md:hidden">Tendência</span>
                                        </>
                                    )}
                                    {tab.key === 'turnover' && (
                                        <>
                                            <span className="hidden md:inline">Rotatividade</span>
                                            <span className="inline md:hidden">Giro</span>
                                        </>
                                    )}
                                </span>
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Tab content */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : (
                <>
                    {/* By Category */}
                    {activeTab === 'category' && (
                        <Card padding="lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Margem por Categoria</h3>
                            {data?.byCategory.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Sem dados para o período seleccionado</p>
                            ) : (
                                <div className="space-y-4">
                                    {data?.byCategory.map(cat => (
                                        <div key={cat.category}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                                                        {cat.category}
                                                    </span>
                                                    <Badge variant={getMarginBadge(cat.margin)} size="sm">
                                                        {cat.margin.toFixed(1)}%
                                                    </Badge>
                                                </div>
                                                <div className="text-right text-xs text-gray-500">
                                                    <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(cat.profit)}</span>
                                                    <span className="ml-1">lucro</span>
                                                    <span className="ml-2">{cat.qty} un.</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MarginBar value={cat.revenue} max={maxCatRevenue} color="bg-primary-400" />
                                                <div className="flex gap-1 text-xs text-gray-400 w-48 justify-end">
                                                    <span>{formatCurrency(cat.revenue)}</span>
                                                    <span>·</span>
                                                    <span className="text-orange-400">-{formatCurrency(cat.cogs)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* By Product */}
                    {activeTab === 'product' && (
                        <Card padding="lg">
                            <div className="flex items-center justify-between mb-4 gap-4">
                                <h3 className="font-bold text-gray-900 dark:text-white">Top Produtos por Lucro</h3>
                                <div className="w-52">
                                    <Input
                                        size="sm"
                                        placeholder="Filtrar produto..."
                                        value={productSearch}
                                        onChange={e => { setProductSearch(e.target.value); setPage(1); }}
                                    />
                                </div>
                            </div>
                            <div className="-mx-6 -mb-6 mt-4">
                                <SmartTable
                                    data={paginatedItems}
                                    hideToolbar
                                    columns={[
                                        {
                                            key: 'index',
                                            header: '#',
                                            render: (_, i) => <span className="text-xs text-gray-400">{(currentPage - 1) * itemsPerPage + (i ?? 0) + 1}</span>
                                        },
                                        {
                                            key: 'product',
                                            header: 'Produto',
                                            render: (p) => (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{p.name}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono mt-0.5">{p.code}</span>
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'category',
                                            header: 'Categoria',
                                            render: (p) => <span className="text-xs text-gray-500 capitalize font-medium">{p.category}</span>
                                        },
                                        {
                                            key: 'revenue',
                                            header: 'Receita',
                                            align: 'right',
                                            render: (p) => <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(p.revenue)}</span>
                                        },
                                        {
                                            key: 'cogs',
                                            header: 'COGS',
                                            align: 'right',
                                            render: (p) => <span className="text-orange-500 font-medium text-xs">-{formatCurrency(p.cogs)}</span>
                                        },
                                        {
                                            key: 'profit',
                                            header: 'Lucro',
                                            align: 'right',
                                            render: (p) => <span className="font-black text-gray-900 dark:text-white">{formatCurrency(p.profit)}</span>
                                        },
                                        {
                                            key: 'margin',
                                            header: 'Margem',
                                            align: 'right',
                                            render: (p) => <Badge variant={getMarginBadge(p.margin)} size="sm" className="font-black">{p.margin.toFixed(1)}%</Badge>
                                        },
                                        {
                                            key: 'bar',
                                            header: '',
                                            render: (p) => (
                                                <div className="w-20">
                                                    <MarginBar value={p.profit} max={maxProdProfit} color={p.margin >= 20 ? 'bg-green-400' : p.margin >= 0 ? 'bg-yellow-400' : 'bg-red-400'} />
                                                </div>
                                            )
                                        }
                                    ]}
                                    mobileCardRender={(p) => (
                                        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-4">
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">{p.name}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-gray-400 font-mono bg-gray-50 dark:bg-dark-900 px-1.5 py-0.5 rounded">{p.code}</span>
                                                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">{p.category}</span>
                                                    </div>
                                                </div>
                                                <Badge variant={getMarginBadge(p.margin)} size="sm" className="shrink-0 font-black px-2">
                                                    {p.margin.toFixed(1)}%
                                                </Badge>
                                            </div>

                                            {/* Bar */}
                                            <div className="w-full">
                                                <MarginBar value={p.profit} max={maxProdProfit} color={p.margin >= 20 ? 'bg-green-400' : p.margin >= 0 ? 'bg-yellow-400' : 'bg-red-400'} />
                                            </div>

                                            {/* Footer */}
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                                <div>
                                                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Receita</span>
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{formatCurrency(p.revenue)}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">COGS</span>
                                                    <span className="text-xs font-bold text-orange-500">-{formatCurrency(p.cogs)}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-[9px] font-bold text-primary-500 uppercase tracking-widest">Lucro</span>
                                                    <span className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(p.profit)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                />
                                {filteredProducts.length > itemsPerPage && (
                                    <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/50">
                                        <Pagination
                                            currentPage={currentPage}
                                            totalItems={filteredProducts.length}
                                            itemsPerPage={itemsPerPage}
                                            onPageChange={setPage}
                                            onItemsPerPageChange={setItemsPerPage}
                                        />
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Monthly Trend */}
                    {activeTab === 'trend' && (
                        <Card padding="lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-6">Tendência de Margem - Últimos 6 Meses</h3>
                            {(!data?.monthlyTrend || data.monthlyTrend.length === 0) ? (
                                <p className="text-center text-gray-500 py-8">Sem dados suficientes</p>
                            ) : (
                                <div className="space-y-5">
                                    {/* Chart bars */}
                                    <div className="flex items-end gap-3 h-48 px-2">
                                        {data.monthlyTrend.map((m, i) => {
                                            const maxRev = Math.max(...data.monthlyTrend.map(x => x.revenue), 1);
                                            const pct = (m.revenue / maxRev) * 100;
                                            const profitPct = m.revenue > 0 ? ((m.revenue - m.cogs) / m.revenue) * 100 : 0;

                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-black tracking-widest group-hover:text-primary-500 transition-colors">
                                                        {m.margin.toFixed(0)}%
                                                    </div>
                                                    <div className="w-full relative min-h-[50px] overflow-hidden rounded-t-xl" style={{ height: `${Math.max(20, pct * 1.8)}px` }}>
                                                        <div className="absolute inset-0 bg-gray-100 dark:bg-dark-800/80 group-hover:bg-primary-50/50 dark:group-hover:bg-primary-900/10 transition-colors" />
                                                        <div
                                                            className="absolute bottom-0 left-0 right-0 bg-primary-600 group-hover:bg-primary-500 transition-all duration-700 opacity-60"
                                                            style={{ height: '100%' }}
                                                        />
                                                        <div
                                                            className="absolute bottom-0 left-0 right-0 bg-green-500 group-hover:bg-green-400 transition-all duration-700"
                                                            style={{ height: `${Math.max(5, profitPct)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{m.month.slice(5)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Data table */}
                                    <div className="-mx-6 -mb-6 mt-6">
                                        <SmartTable
                                            data={data.monthlyTrend}
                                            hideToolbar
                                            columns={[
                                                { key: 'month', header: 'Mês', render: (m: any) => <span className="font-bold text-gray-700 dark:text-gray-300 uppercase">{m.month}</span> },
                                                { key: 'revenue', header: 'Receita', align: 'right', render: (m: any) => <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(m.revenue)}</span> },
                                                { key: 'cogs', header: 'COGS', align: 'right', render: (m: any) => <span className="text-orange-500 font-medium">-{formatCurrency(m.cogs)}</span> },
                                                { key: 'profit', header: 'Lucro', align: 'right', render: (m: any) => <span className="font-black text-gray-900 dark:text-white">{formatCurrency(m.revenue - m.cogs)}</span> },
                                                {
                                                    key: 'margin',
                                                    header: 'Margem',
                                                    align: 'right',
                                                    render: (m: any, i: any) => {
                                                        const prevMargin = (i ?? 0) > 0 ? data.monthlyTrend[(i ?? 0) - 1].margin : null;
                                                        const trend = prevMargin !== null ? m.margin - prevMargin : null;
                                                        return (
                                                            <div className="flex flex-col items-end">
                                                                <Badge variant={getMarginBadge(m.margin)} size="sm" className="font-black">{m.margin.toFixed(1)}%</Badge>
                                                                {trend !== null && (
                                                                    <span className={cn('text-[10px] font-bold mt-1 flex items-center', trend >= 0 ? 'text-green-500' : 'text-red-500')}>
                                                                        {trend >= 0 ? <HiOutlineArrowSmallUp className="w-3 h-3 inline mr-0.5" /> : <HiOutlineArrowSmallDown className="w-3 h-3 inline mr-0.5" />}
                                                                        {Math.abs(trend).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                }
                                            ]}
                                            mobileCardRender={(m: any) => {
                                                const i = data.monthlyTrend.indexOf(m);
                                                const profit = m.revenue - m.cogs;
                                                const prevMargin = i > 0 ? data.monthlyTrend[i - 1].margin : null;
                                                const trend = prevMargin !== null ? m.margin - prevMargin : null;
                                                return (
                                                    <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-3">
                                                        {/* Header */}
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                                                            <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-widest">{m.month}</span>
                                                            <div className="flex items-center gap-2">
                                                                {trend !== null && (
                                                                    <span className={cn('text-[10px] font-bold flex items-center px-1.5 py-0.5 rounded', trend >= 0 ? 'bg-green-50 text-green-600 dark:bg-green-900/30' : 'bg-red-50 text-red-600 dark:bg-red-900/30')}>
                                                                        {trend >= 0 ? <HiOutlineArrowSmallUp className="w-3 h-3 inline mr-0.5" /> : <HiOutlineArrowSmallDown className="w-3 h-3 inline mr-0.5" />}
                                                                        {Math.abs(trend).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                                <Badge variant={getMarginBadge(m.margin)} size="sm" className="font-black">{m.margin.toFixed(1)}%</Badge>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Footer */}
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div>
                                                                <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Receita</span>
                                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{formatCurrency(m.revenue)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">COGS</span>
                                                                <span className="text-xs font-bold text-orange-500">-{formatCurrency(m.cogs)}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="block text-[9px] font-bold text-primary-500 uppercase tracking-widest">Lucro</span>
                                                                <span className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(profit)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Inventory Turnover */}
                    {activeTab === 'turnover' && (
                        <Card padding="lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Rotatividade de Inventário por Categoria</h3>
                            <p className="text-xs text-gray-500 mb-5">Número de vezes que o stock é vendido por ano. Maior = mais eficiente.</p>
                            {turnoverLoading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-dark-700 rounded animate-pulse" />)}
                                </div>
                            ) : turnoverData.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Sem dados suficientes</p>
                            ) : (
                                <div className="-mx-6 -mb-6 mt-4">
                                    <SmartTable
                                        data={turnoverData}
                                        hideToolbar
                                        columns={[
                                            { key: 'category', header: 'Categoria', render: (row: any) => <span className="font-bold text-gray-900 dark:text-white capitalize">{row.category}</span> },
                                            { key: 'cogs', header: 'COGS (período)', align: 'right', render: (row: any) => <span className="text-gray-600 dark:text-gray-400 font-medium">{formatCurrency(row.cogs)}</span> },
                                            { key: 'value', header: 'Valor Stock', align: 'right', render: (row: any) => <span className="text-gray-600 dark:text-gray-400 font-medium">{formatCurrency(row.inventoryValue)}</span> },
                                            { key: 'turnover', header: 'Rotatividade', align: 'right', render: (row: any) => <Badge variant={row.turnover >= 6 ? 'success' : row.turnover >= 3 ? 'info' : row.turnover >= 1 ? 'warning' : 'danger'} size="sm" className="font-black">{row.turnover.toFixed(1)}x/ano</Badge> },
                                            { key: 'days', header: 'Dias em Stock', align: 'right', render: (row: any) => <span className="font-bold text-gray-700 dark:text-gray-300">{row.daysOnHand > 0 ? `${row.daysOnHand} dias` : <span className="text-gray-300 dark:text-gray-600">—</span>}</span> },
                                        ]}
                                        mobileCardRender={(row: any) => (
                                            <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-4">
                                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                                                    <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-widest">{row.category}</span>
                                                    <Badge variant={row.turnover >= 6 ? 'success' : row.turnover >= 3 ? 'info' : row.turnover >= 1 ? 'warning' : 'danger'} size="sm" className="font-black px-2">{row.turnover.toFixed(1)}x/ano</Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">COGS (Período)</span>
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{formatCurrency(row.cogs)}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Valor em Stock</span>
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{formatCurrency(row.inventoryValue)}</span>
                                                    </div>
                                                </div>
                                                <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tempo de Escoamento</span>
                                                    <span className="font-black text-primary-600 dark:text-primary-400">{row.daysOnHand > 0 ? `${row.daysOnHand} dias` : '—'}</span>
                                                </div>
                                            </div>
                                        )}
                                    />
                                </div>
                            )}
                        </Card>
                    )}
                </>
            )}

            {/* Bulk Adjustment Modal */}
            <BulkAdjustmentModal
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                categories={data?.byCategory.map(c => c.category) || []}
                onSuccess={() => {
                    refetch();
                    setShowBulkModal(false);
                }}
            />
        </div>
    );
}

interface BulkModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: string[];
    onSuccess: () => void;
}

function BulkAdjustmentModal({ isOpen, onClose, categories, onSuccess }: BulkModalProps) {
    const [category, setCategory] = useState('all');
    const [adjustmentType, setAdjustmentType] = useState<BulkAdjustmentType>('percentage');
    const [adjustmentValue, setAdjustmentValue] = useState(0);
    const [operation, setOperation] = useState<BulkOperation>('increase');
    const [loading, setLoading] = useState(false);

    const handleApply = async () => {
        if (adjustmentValue <= 0) return toast.error('Valor deve ser superior a zero');
        
        setLoading(true);
        try {
            await productsAPI.bulkUpdatePrices({
                category: category === 'all' ? undefined : category,
                adjustmentType,
                adjustmentValue,
                operation,
                originModule: 'commercial'
            });
            toast.success('Preços actualizados com sucesso!');
            onSuccess();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao atualizar precos'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajuste de Preços em Massa" size="md">
            <div className="space-y-5">
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-900/30">
                    <p className="text-xs text-primary-700 dark:text-primary-400 leading-relaxed">
                        Esta ferramenta permite ajustar os preços de venda de múltiplos produtos simultaneamente. 
                        <strong> Use com cautela.</strong>
                    </p>
                </div>

                <div className="space-y-4">
                    <Select
                        label="Categoria"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        options={[
                            { value: 'all', label: 'Todos os produtos' },
                            ...categories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
                        ]}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Operação"
                            value={operation}
                            onChange={e => {
                                if (isBulkOperation(e.target.value)) setOperation(e.target.value);
                            }}
                            options={[
                                { value: 'increase', label: 'Aumentar' },
                                { value: 'decrease', label: 'Diminuir' }
                            ]}
                        />
                        <Select
                            label="Tipo de Ajuste"
                            value={adjustmentType}
                            onChange={e => {
                                if (isBulkAdjustmentType(e.target.value)) setAdjustmentType(e.target.value);
                            }}
                            options={[
                                { value: 'percentage', label: 'Percentagem (%)' },
                                { value: 'fixed', label: 'Valor Fixo (MTn)' }
                            ]}
                        />
                    </div>

                    <Input
                        label="Valor do Ajuste"
                        type="number"
                        min="0"
                        step="0.01"
                        value={adjustmentValue}
                        onChange={e => setAdjustmentValue(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 5.0"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={handleApply} isLoading={loading}>
                        Aplicar Ajuste
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

