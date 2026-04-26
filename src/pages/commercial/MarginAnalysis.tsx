import { useState } from 'react';
import { Card, Badge, Button, Input, Modal, Select } from '../../components/ui';
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

const PERIOD_OPTIONS = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
    { label: '180 dias', value: 180 },
];

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
    const [activeTab, setActiveTab] = useState<'category' | 'product' | 'trend' | 'turnover'>('category');
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                        <HiOutlineChartBar className="text-primary-500 w-7 h-7" />
                        Análise de Margens
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">Rentabilidade por categoria, produto e tendência temporal</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBulkModal(true)}
                        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-bold text-[10px] uppercase tracking-wider"
                    >
                        <HiOutlineAdjustmentsHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">Ajuste em Massa</span>
                    </Button>
                    <div className="flex bg-gray-100 dark:bg-dark-800/80 backdrop-blur-sm rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700 shadow-sm">
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setPeriod(opt.value)}
                                className={cn(
                                    'px-3 py-1 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest',
                                    period === opt.value
                                        ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-white shadow-md'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={refetch} className="p-2 text-gray-400 hover:text-primary-500 transition-colors">
                        <HiOutlineArrowPath className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Receita Total',
                        value: formatCurrency(totalRevenue),
                        icon: HiOutlineArrowTrendingUp,
                        color: 'border-l-primary-500 text-primary-500',
                    },
                    {
                        label: 'COGS (Custo Vendas)',
                        value: formatCurrency(totalCogs),
                        icon: HiOutlineCube,
                        color: 'border-l-orange-500 text-orange-500',
                    },
                    {
                        label: 'Lucro Bruto',
                        value: formatCurrency(totalProfit),
                        icon: totalProfit >= 0 ? HiOutlineArrowTrendingUp : HiOutlineArrowTrendingDown,
                        color: totalProfit >= 0 ? 'border-l-green-500 text-green-500' : 'border-l-red-500 text-red-500',
                    },
                    {
                        label: 'Margem Global',
                        value: `${overallMargin.toFixed(1)}%`,
                        icon: HiOutlineChartBar,
                        color: `border-l-blue-500 ${getMarginColor(overallMargin)}`,
                    },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} padding="md" className={cn(
                            'relative overflow-hidden border-l-4 bg-white dark:bg-dark-900/40 backdrop-blur-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group',
                            kpi.color.split(' ')[0]
                        )}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">{kpi.label}</p>
                                <Icon className={cn('w-4 h-4 group-hover:scale-110 transition-transform', kpi.color.split(' ')[1])} />
                            </div>
                            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{kpi.value}</p>
                        </Card>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-dark-800/80 backdrop-blur-sm rounded-lg p-1.5 border border-gray-200 dark:border-dark-700 shadow-inner">
                {[
                    { key: 'category', label: 'Por Categoria', icon: HiOutlineTag },
                    { key: 'product', label: 'Por Produto', icon: HiOutlineCube },
                    { key: 'trend', label: 'Tendência Mensal', icon: HiOutlineArrowTrendingUp },
                    { key: 'turnover', label: 'Rotatividade', icon: HiOutlineArrowPath },
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest',
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-white shadow-lg shadow-black/5'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
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
                                        onChange={e => setProductSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/30">
                                            <th className="text-left px-4 py-3 font-medium">#</th>
                                            <th className="text-left py-3 font-medium">Produto</th>
                                            <th className="text-left py-3 font-medium hidden md:table-cell">Categoria</th>
                                            <th className="text-right py-3 font-medium">Receita</th>
                                            <th className="text-right py-3 font-medium hidden sm:table-cell">COGS</th>
                                            <th className="text-right py-3 font-medium">Lucro</th>
                                            <th className="text-right py-3 font-medium">Margem</th>
                                            <th className="py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-dark-800/50">
                                        {filteredProducts.slice(0, 30).map((p, i) => (
                                            <tr key={p.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                                <td className="px-4 py-3 text-xs text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{i + 1}</td>
                                                <td className="py-2">
                                                    <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                                                    <span className="ml-1 text-xs text-gray-400">{p.code}</span>
                                                </td>
                                                <td className="py-2 hidden md:table-cell">
                                                    <span className="text-xs text-gray-500 capitalize">{p.category}</span>
                                                </td>
                                                <td className="py-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(p.revenue)}</td>
                                                <td className="py-2 text-right text-orange-500 text-xs hidden sm:table-cell">-{formatCurrency(p.cogs)}</td>
                                                <td className="py-2 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(p.profit)}</td>
                                                <td className="py-2 text-right">
                                                    <Badge variant={getMarginBadge(p.margin)} size="sm">{p.margin.toFixed(1)}%</Badge>
                                                </td>
                                                <td className="py-2 pl-2">
                                                    <div className="w-20">
                                                        <MarginBar value={p.profit} max={maxProdProfit} color={p.margin >= 20 ? 'bg-green-400' : p.margin >= 0 ? 'bg-yellow-400' : 'bg-red-400'} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredProducts.length === 0 && (
                                    <p className="text-center text-gray-500 py-8 text-sm">Sem produtos no período seleccionado</p>
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
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                                    <th className="text-left py-2 font-medium">Mês</th>
                                                    <th className="text-right py-2 font-medium">Receita</th>
                                                    <th className="text-right py-2 font-medium">COGS</th>
                                                    <th className="text-right py-2 font-medium">Lucro</th>
                                                    <th className="text-right py-2 font-medium">Margem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.monthlyTrend.map((m, i) => {
                                                    const profit = m.revenue - m.cogs;
                                                    const prevMargin = i > 0 ? data.monthlyTrend[i - 1].margin : null;
                                                    const trend = prevMargin !== null ? m.margin - prevMargin : null;

                                                    return (
                                                        <tr key={i} className="border-b border-gray-50 dark:border-dark-700/50">
                                                            <td className="py-2 font-medium text-gray-700 dark:text-gray-300">{m.month}</td>
                                                            <td className="py-2 text-right">{formatCurrency(m.revenue)}</td>
                                                            <td className="py-2 text-right text-orange-500">-{formatCurrency(m.cogs)}</td>
                                                            <td className="py-2 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(profit)}</td>
                                                            <td className="py-2 text-right">
                                                                <span className={cn('font-bold', getMarginColor(m.margin))}>
                                                                    {m.margin.toFixed(1)}%
                                                                </span>
                                                                {trend !== null && (
                                                                    <span className={cn('ml-1 text-[10px]', trend >= 0 ? 'text-green-500' : 'text-red-500')}>
                                                                        {trend >= 0 ? <HiOutlineArrowSmallUp className="w-3 h-3 text-green-500 inline" /> : <HiOutlineArrowSmallDown className="w-3 h-3 text-red-500 inline" />}{Math.abs(trend).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
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
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                                <th className="text-left py-2 font-medium">Categoria</th>
                                                <th className="text-right py-2 font-medium">COGS (período)</th>
                                                <th className="text-right py-2 font-medium">Valor Stock</th>
                                                <th className="text-right py-2 font-medium">Rotatividade</th>
                                                <th className="text-right py-2 font-medium">Dias em Stock</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {turnoverData.map(row => (
                                                <tr key={row.category} className="border-b border-gray-50 dark:border-dark-700/50 hover:bg-gray-50 dark:hover:bg-dark-700/30">
                                                    <td className="py-3 font-medium text-gray-900 dark:text-white capitalize">{row.category}</td>
                                                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(row.cogs)}</td>
                                                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(row.inventoryValue)}</td>
                                                    <td className="py-3 text-right">
                                                        <Badge
                                                            variant={row.turnover >= 6 ? 'success' : row.turnover >= 3 ? 'info' : row.turnover >= 1 ? 'warning' : 'danger'}
                                                            size="sm"
                                                        >
                                                            {row.turnover.toFixed(1)}x/ano
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                                                        {row.daysOnHand > 0 ? `${row.daysOnHand} dias` : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
    const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
    const [adjustmentValue, setAdjustmentValue] = useState(0);
    const [operation, setOperation] = useState<'increase' | 'decrease'>('increase');
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
                origin_module: 'commercial'
            });
            toast.success('Preços actualizados com sucesso!');
            onSuccess();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao atualizar preços');
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
                            onChange={e => setOperation(e.target.value as any)}
                            options={[
                                { value: 'increase', label: 'Aumentar' },
                                { value: 'decrease', label: 'Diminuir' }
                            ]}
                        />
                        <Select
                            label="Tipo de Ajuste"
                            value={adjustmentType}
                            onChange={e => setAdjustmentType(e.target.value as any)}
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
