import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { HiOutlineChartPie } from 'react-icons/hi2';
import { Card } from '../../ui';
import { formatCurrency } from '../../../utils/helpers';

interface CategoryRevenueData {
    name: string;
    value: number;
    [key: string]: string | number;
}

interface CategoryRevenueChartProps {
    data: CategoryRevenueData[];
    isLoading?: boolean;
}

type ChartPayloadItem = {
    name?: string;
    value?: number | string;
    color?: string;
};

type CategoryTooltipProps = {
    active?: boolean;
    payload?: ReadonlyArray<ChartPayloadItem>;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export function CategoryRevenueChart({ data, isLoading }: CategoryRevenueChartProps) {
    const chartData = data.filter(item => item.value > 0);
    const totalRevenue = chartData.reduce((sum, item) => sum + item.value, 0);
    const hasRevenue = chartData.length > 0 && totalRevenue > 0;
    const topCategory = chartData[0];
    const isSingleCategory = chartData.length === 1;

    const CustomTooltip = ({ active, payload = [] }: CategoryTooltipProps) => {
        if (active && payload && payload.length) {
            const entry = payload[0];
            const value = Number(entry.value ?? 0);
            const share = totalRevenue > 0 ? (value / totalRevenue) * 100 : 0;

            return (
                <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-white/20 p-3 rounded-xl shadow-2xl">
                    <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1">{entry.name}</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(value)}</p>
                    <p className="text-[9px] font-bold text-primary-400 mt-1">
                        {share.toFixed(1)}% do Total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card padding="lg" className="bg-white dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.7)] h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-emerald-600 dark:bg-emerald-500/15 border border-emerald-600 dark:border-emerald-500/25 shadow-sm flex items-center justify-center flex-shrink-0">
                        <HiOutlineChartPie className="w-4 h-4 text-white dark:text-emerald-400" />
                    </span>
                    <div>
                        <h3 className="font-black text-slate-950 dark:text-white uppercase tracking-tighter">Receita por Categoria</h3>
                        <p className="text-[10px] text-slate-600 dark:text-gray-300 font-black uppercase tracking-widest mt-0.5">Distribuição de Faturação</p>
                    </div>
                </div>
            </div>

            <div className="h-64 relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                ) : hasRevenue ? (
                    <>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={54}
                                    outerRadius={92}
                                    paddingAngle={isSingleCategory ? 0 : 3}
                                    dataKey="value"
                                    animationBegin={0}
                                    animationDuration={1200}
                                >
                                    {chartData.map((_entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={COLORS[index % COLORS.length]} 
                                            stroke="transparent"
                                            className="outline-none hover:opacity-80 transition-opacity cursor-pointer"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total</p>
                                <p className="text-sm font-black text-slate-950 dark:text-white tracking-tight">{formatCurrency(totalRevenue).split(',')[0]}</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    {isSingleCategory ? '1 categoria' : `${chartData.length} categorias`}
                                </p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full rounded-xl border border-dashed border-slate-300/80 dark:border-white/10 bg-slate-50 dark:bg-dark-900/50 text-center px-5">
                        <HiOutlineChartPie className="w-12 h-12 mb-2 text-slate-400" />
                        <p className="text-[11px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-widest">Sem receita por categoria</p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">As categorias aparecem aqui quando houver faturação associada.</p>
                    </div>
                )}
            </div>

            {!isLoading && hasRevenue && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-300">
                        <span>{isSingleCategory ? 'Categoria única' : 'Top Categoria'}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                            {topCategory?.name}
                        </span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                        {chartData.slice(0, isSingleCategory ? 1 : 4).map((item, index) => {
                            const share = totalRevenue > 0 ? (item.value / totalRevenue) * 100 : 0;
                            return (
                                <div key={item.name}>
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                        <span className="min-w-0 flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                            <span className="truncate">{item.name}</span>
                                        </span>
                                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 flex-shrink-0">
                                            {formatCurrency(item.value).split(',')[0]} · {share.toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-dark-900 overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${share}%`, backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Card>
    );
}
