import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { Card } from '../../ui';
import { formatCurrency } from '../../../utils/helpers';
import type { ABCClassification } from '../../../hooks/useCommercialAnalytics';

interface ABCClassificationChartProps {
    data: ABCClassification[];
    maxItems?: number;
}

const CLASSIFICATION_COLORS = {
    A: '#6366f1', // Indigo Premium
    B: '#ca8a04', // Dark Gold
    C: '#94a3b8', // Slate (Secondary)
};

export function ABCClassificationChart({ data, maxItems = 30 }: ABCClassificationChartProps) {
    const displayData = data.slice(0, maxItems);

    return (
        <Card padding="lg" className="h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Análise ABC (Pareto)</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Classificação por Receita Acumulada</p>
                </div>
                <div className="flex gap-2">
                    {Object.entries(CLASSIFICATION_COLORS).map(([label, color]) => (
                        <div key={label} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[10px] font-black">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={displayData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fill: '#9ca3af' }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis 
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fill: '#9ca3af' }}
                            tickFormatter={(val) => formatCurrency(val).split(',')[0]}
                        />
                        <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fill: '#3b82f6' }}
                            domain={[0, 100]}
                            tickFormatter={(val) => `${val}%`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '11px',
                            }}
                            formatter={(value: any, name?: string) => [
                                name === 'cumulativePercentage' ? `${Number(value).toFixed(1)}%` : formatCurrency(value),
                                name === 'cumulativePercentage' ? 'Acumulado' : 'Receita'
                            ]}
                        />
                        <Bar 
                            yAxisId="left" 
                            dataKey="revenue" 
                            radius={[8, 8, 0, 0]}
                            barSize={32}
                            fillOpacity={0.8}
                        >
                            {displayData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CLASSIFICATION_COLORS[entry.classification]} />
                            ))}
                        </Bar>
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="cumulativePercentage"
                            stroke="#6366f1"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
                    <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">Classe A</p>
                    <p className="text-xs font-black text-slate-800 dark:text-white mt-1">ESTRATÉGICO</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">~80% Receita</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 transition-all hover:shadow-lg hover:shadow-amber-500/5">
                    <p className="text-[8px] font-black uppercase text-amber-600 tracking-widest">Classe B</p>
                    <p className="text-xs font-black text-slate-800 dark:text-white mt-1">RELEVANTE</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">~15% Receita</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-500/5 border border-slate-100 dark:border-slate-500/10 transition-all hover:shadow-lg hover:shadow-slate-500/5">
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Classe C</p>
                    <p className="text-xs font-black text-slate-800 dark:text-white mt-1">ROTINA</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">~5% Receita</p>
                </div>
            </div>
        </Card>
    );
}
