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
        if (intensity < 20) return 'bg-slate-200/70 dark:bg-dark-900/40';
        if (intensity < 40) return 'bg-primary-200 dark:bg-primary-900/30';
        if (intensity < 60) return 'bg-primary-400 dark:bg-primary-700/50';
        if (intensity < 80) return 'bg-primary-600 dark:bg-primary-500/70';
        return 'bg-primary-700 dark:bg-primary-400 shadow-[0_0_18px_rgba(59,84,255,0.45)]';
    };

    return (
        <Card padding="lg" className="bg-white dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.7)]">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter text-sm flex items-center gap-2">
                        <span className="w-2 h-6 bg-primary-500 rounded-full" />
                        Mapa de Calor de Vendas
                    </h3>
                    <p className="text-[10px] text-slate-600 dark:text-gray-300 uppercase font-black tracking-widest mt-1">Concentração por dia e hora</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-600 dark:text-gray-300 uppercase tracking-widest">Intensidade</span>
                    <div className="flex gap-1">
                        {[20, 40, 60, 80, 100].map(i => (
                            <div key={i} className={cn("w-3 h-3 rounded-sm", getColorClass(i))} />
                        ))}
                    </div>
                </div>
            </div>

            {/* overflow-visible nos contentores internos garante que os tooltips nunca são cortados */}
            <div className="overflow-x-auto scroller-hidden" style={{ overflowY: 'visible', overflowX: 'hidden' }}>
                <div className="min-w-[600px]" style={{ overflow: 'visible' }}>
                    {/* Hours Header */}
                    <div className="grid grid-cols-[60px_1fr] mb-2">
                        <div />
                        <div className="grid grid-cols-15 gap-1.5">
                            {HOURS.map(hour => (
                                <div key={hour} className="text-[9px] font-black text-slate-600 dark:text-gray-300 text-center uppercase">
                                    {hour}h
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Heatmap Grid */}
                    <div className="space-y-1.5" style={{ overflow: 'visible' }}>
                        {DAYS.map((day, dayIndex) => {
                            // Nas 2 primeiras linhas (Seg, Ter) o tooltip aparece ABAIXO da célula
                            // para não ser cortado pelo topo do card
                            const tooltipBelow = dayIndex < 2;

                            return (
                                <div key={day} className="grid grid-cols-[60px_1fr] items-center" style={{ overflow: 'visible' }}>
                                    <div className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest italic">
                                        {day}
                                    </div>
                                    <div className="grid grid-cols-15 gap-1.5" style={{ overflow: 'visible' }}>
                                        {HOURS.map((hour, hourIndex) => {
                                            const intensity = heatmapData[day]?.[hour] ?? 0;

                                            // Ajuste horizontal: nas primeiras 2 colunas ancora à esquerda,
                                            // nas últimas 3 ancora à direita, no centro caso contrário
                                            const tooltipXClass =
                                                hourIndex < 2
                                                    ? 'left-0'
                                                    : hourIndex >= HOURS.length - 2
                                                        ? 'right-0'
                                                        : 'left-1/2 -translate-x-1/2';

                                            const tooltipVertClass = tooltipBelow
                                                ? 'top-full mt-2'
                                                : 'bottom-full mb-2';

                                            const arrowClass = tooltipBelow
                                                ? 'bottom-full border-b-[5px] border-b-gray-900 dark:border-b-slate-800 border-x-[5px] border-x-transparent'
                                                : 'top-full border-t-[5px] border-t-gray-900 dark:border-t-slate-800 border-x-[5px] border-x-transparent';

                                            // Posição da seta: centrada se o tooltip estiver no centro,
                                            // caso contrário alinhada ao lado oposto da âncora
                                            const arrowXClass =
                                                hourIndex < 2
                                                    ? 'left-3'
                                                    : hourIndex >= HOURS.length - 2
                                                        ? 'right-3'
                                                        : 'left-1/2 -translate-x-1/2';

                                            return (
                                                // Outer div: área de hover com tamanho FIXO — nunca cresce, nunca treme
                                                <div
                                                    key={hour}
                                                    className="h-8 rounded-md cursor-pointer relative group hover:z-[100]"
                                                    style={{ overflow: 'visible' }}
                                                >
                                                    {/* Inner div: efeito visual sem mover pixels (brightness + ring) */}
                                                    <div className={cn(
                                                        "absolute inset-0 rounded-md transition-all duration-200 ease-out",
                                                        "group-hover:brightness-125 group-hover:ring-2 group-hover:ring-white/40 group-hover:ring-inset",
                                                        getColorClass(intensity)
                                                    )} />
                                                    {/* Tooltip — posição totalmente adaptativa */}
                                                    <div
                                                        className={cn(
                                                            "absolute px-2.5 py-1.5 rounded-lg whitespace-nowrap pointer-events-none",
                                                            "bg-gray-900 dark:bg-slate-800 text-white text-[9px] font-semibold",
                                                            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                                                            "shadow-2xl ring-1 ring-white/10",
                                                            "z-[200]",
                                                            tooltipVertClass,
                                                            tooltipXClass
                                                        )}
                                                    >
                                                        {/* Seta do tooltip */}
                                                        <span
                                                            className={cn(
                                                                "absolute w-0 h-0",
                                                                arrowClass,
                                                                arrowXClass
                                                            )}
                                                        />

                                                        {/* Conteúdo */}
                                                        <div className="flex items-center gap-1 mb-0.5">
                                                            <span className="text-primary-400 font-black">{day}</span>
                                                            <span className="text-white/30">·</span>
                                                            <span className="text-white font-bold">{hour}h00</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-white/50">Intensidade</span>
                                                            <span className={cn(
                                                                "font-black",
                                                                intensity >= 80 ? "text-primary-300" :
                                                                intensity >= 60 ? "text-primary-400" :
                                                                intensity >= 40 ? "text-yellow-400" :
                                                                "text-white/50"
                                                            )}>
                                                                {Math.round(intensity)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-4">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                        <span className="text-[9px] font-black text-slate-700 dark:text-gray-300 uppercase tracking-widest italic">Picos de Faturação</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-dark-600" />
                        <span className="text-[9px] font-black text-slate-700 dark:text-gray-300 uppercase tracking-widest italic">Baixa Actividade</span>
                    </div>
                </div>
                <p className="text-[9px] text-slate-600 dark:text-gray-300 italic">Dados baseados nos últimos 30 dias de operação comercial</p>
            </div>
        </Card>
    );
}
