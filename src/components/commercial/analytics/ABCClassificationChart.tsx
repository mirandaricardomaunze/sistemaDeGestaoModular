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
import { HiOutlinePresentationChartBar } from 'react-icons/hi2';
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
        <Card padding="lg" className="bg-white dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.7)]">

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500/15 border border-indigo-600 dark:border-indigo-500/25 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <HiOutlinePresentationChartBar className="w-4 h-4 text-white dark:text-indigo-400" />
                    </span>
                    <div>
                        <h3 className="font-black text-slate-950 dark:text-white uppercase tracking-tighter">Análise ABC (Pareto)</h3>
                        <p className="text-[10px] text-slate-600 dark:text-gray-300 font-black uppercase tracking-widest mt-0.5">Classificação por Receita Acumulada</p>
                    </div>
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
                {displayData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={displayData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis 
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }}
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
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-white/20 p-3 rounded-xl shadow-2xl">
                                            <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Receita:</span>
                                                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(payload[0].value)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Acumulado:</span>
                                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Number(payload[1].value).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
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
                ) : (
                    <div className="h-full rounded-xl border border-dashed border-slate-300/80 dark:border-white/10 bg-slate-50 dark:bg-dark-900/50 flex flex-col items-center justify-center text-center px-5">
                        <HiOutlinePresentationChartBar className="w-10 h-10 text-indigo-400 mb-2" />
                        <p className="text-[11px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-widest">Sem ranking ABC</p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">O Pareto aparece quando existir receita por produto.</p>
                    </div>
                )}
            </div>
            
            <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200/80 dark:border-indigo-500/10 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
                    <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">Classe A</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white mt-1">ESTRATÉGICO</p>
                    <p className="text-[9px] text-slate-600 font-bold mt-1">~80% Receita</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200/80 dark:border-amber-500/10 transition-all hover:shadow-lg hover:shadow-amber-500/5">
                    <p className="text-[8px] font-black uppercase text-amber-600 tracking-widest">Classe B</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white mt-1">RELEVANTE</p>
                    <p className="text-[9px] text-slate-600 font-bold mt-1">~15% Receita</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-500/5 border border-slate-200/90 dark:border-slate-500/10 transition-all hover:shadow-lg hover:shadow-slate-500/5">
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Classe C</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white mt-1">ROTINA</p>
                    <p className="text-[9px] text-slate-600 font-bold mt-1">~5% Receita</p>
                </div>
            </div>
        </Card>
    );
}
