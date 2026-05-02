import { Skeleton, Card } from '../../ui';
import { cn } from '../../../utils/helpers';

interface SalesHeatmapProps {
    data: Record<string, Record<number, number>>;
    isLoading?: boolean;
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8:00 to 22:00

export function SalesHeatmap({ data, isLoading }: SalesHeatmapProps) {
    if (isLoading) {
        return <Skeleton className="h-96 w-full rounded-xl" />;
    }

    const heatmapData = data;

    const getColorClass = (intensity: number) => {
        if (intensity < 20) return 'bg-slate-100 dark:bg-dark-900/40';
        if (intensity < 40) return 'bg-primary-200 dark:bg-primary-900/30';
        if (intensity < 60) return 'bg-primary-400 dark:bg-primary-700/50';
        if (intensity < 80) return 'bg-primary-600 dark:bg-primary-500/70';
        return 'bg-primary-700 dark:bg-primary-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]';
    };

    return (
        <Card padding="lg" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter text-sm flex items-center gap-2">
                        <span className="w-2 h-6 bg-primary-500 rounded-full" />
                        Mapa de Calor de Vendas
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">Concentração por dia e hora</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Intensidade</span>
                    <div className="flex gap-1">
                        {[20, 40, 60, 80, 100].map(i => (
                            <div key={i} className={cn("w-3 h-3 rounded-sm", getColorClass(i))} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto scroller-hidden">
                <div className="min-w-[600px]">
                    {/* Hours Header */}
                    <div className="grid grid-cols-[60px_1fr] mb-2">
                        <div />
                        <div className="grid grid-cols-15 gap-1.5">
                            {HOURS.map(hour => (
                                <div key={hour} className="text-[9px] font-black text-gray-400 dark:text-gray-500 text-center uppercase">
                                    {hour}h
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Heatmap Grid */}
                    <div className="space-y-1.5">
                        {DAYS.map(day => (
                            <div key={day} className="grid grid-cols-[60px_1fr] items-center">
                                <div className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest italic">
                                    {day}
                                </div>
                                <div className="grid grid-cols-15 gap-1.5">
                                    {HOURS.map(hour => {
                                        const intensity = heatmapData[day][hour];
                                        return (
                                            <div
                                                key={hour}
                                                className={cn(
                                                    "h-8 rounded-md transition-all duration-500 hover:scale-110 hover:z-10 cursor-pointer relative group",
                                                    getColorClass(intensity)
                                                )}
                                            >
                                                {/* Tooltip on hover */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-900 text-white text-[8px] font-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none uppercase tracking-tighter">
                                                    {day} · {hour}h:00
                                                    <br />
                                                    Nível: {Math.round(intensity)}%
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-4">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic">Picos de Faturação</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-dark-600" />
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic">Baixa Actividade</span>
                    </div>
                </div>
                <p className="text-[9px] text-gray-400 italic">Dados baseados nos últimos 30 dias de operação comercial</p>
            </div>
        </Card>
    );
}
