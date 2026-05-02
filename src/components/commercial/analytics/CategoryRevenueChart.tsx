import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export function CategoryRevenueChart({ data, isLoading }: CategoryRevenueChartProps) {
    // Custom Tooltip for better aesthetics
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-white/20 p-3 rounded-xl shadow-2xl">
                    <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1">{payload[0].name}</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(payload[0].value)}</p>
                    <p className="text-[9px] font-bold text-primary-400 mt-1">
                        {((payload[0].value / data.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1)}% do Total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card padding="lg" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                        <HiOutlineChartPie className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <div>
                        <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Receita por Categoria</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Distribuição de Faturação</p>
                    </div>
                </div>
            </div>

            <div className="h-64 relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                ) : data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={0}
                                outerRadius={85}
                                paddingAngle={0}
                                dataKey="value"
                                animationBegin={0}
                                animationDuration={1500}
                            >
                                {data.map((_entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={COLORS[index % COLORS.length]} 
                                        stroke="transparent"
                                        className="outline-none hover:opacity-80 transition-opacity cursor-pointer"
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                verticalAlign="bottom" 
                                align="center"
                                iconType="circle"
                                content={({ payload }: any) => (
                                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                                        {payload.map((entry: any, index: number) => (
                                            <div key={`legend-${index}`} className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                <span className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-tight">
                                                    {entry.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-40">
                        <HiOutlineChartPie className="w-12 h-12 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sem dados disponíveis</p>
                    </div>
                )}
            </div>

            {!isLoading && data.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <span>Top Categoria</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                            {data[0]?.name}
                        </span>
                    </div>
                </div>
            )}
        </Card>
    );
}
