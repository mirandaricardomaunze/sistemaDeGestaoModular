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
        if (intensity < 20) return 'bg-slate-100 dark:bg-dark-900/30';
        if (intensity < 40) return 'bg-primary-100 dark:bg-primary-950/20';
        if (intensity < 60) return 'bg-primary-300/80 dark:bg-primary-700/40';
        if (intensity < 80) return 'bg-primary-500/80 dark:bg-primary-500/60';
        return 'bg-primary-600 dark:bg-primary-400 shadow-[0_0_12px_rgba(59,84,255,0.35)]';
    };

    return (
        <Card padding="lg" className="bg-white dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-10px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
                <div className="min-w-0">
                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter text-sm flex items-center gap-2">
                        <span className="w-2 h-6 bg-primary-500 rounded-full" />
                        Mapa de Calor de Vendas
                    </h3>
                    <p className="text-[10px] text-slate-600 dark:text-gray-300 uppercase font-black tracking-widest mt-1">Concentração por dia e hora</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black text-slate-600 dark:text-gray-300 uppercase tracking-widest">Intensidade</span>
                    <div className="flex gap-1">
                        {[20, 40, 60, 80, 100].map(i => (
                            <div key={i} className={cn("w-3 h-3 rounded-sm", getColorClass(i))} />
                        ))}
                    </div>
                </div>
            </div>

            {/* overflow-visible nos contentores internos garante que os tooltips nunca são cortados */}
            <div className="max-w-full overflow-x-auto overscroll-x-contain scrollbar-thin" style={{ overflowY: 'visible' }}>
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
                                    <div className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest italic font-sans">
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
                                                ? 'bottom-full border-b-[5px] border-b-white dark:border-b-dark-900 border-x-[5px] border-x-transparent shadow-sm'
                                                : 'top-full border-t-[5px] border-t-white dark:border-t-dark-900 border-x-[5px] border-x-transparent shadow-sm';

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
                                                        "group-hover:brightness-105 group-hover:ring-2 group-hover:ring-primary-500/20 dark:group-hover:ring-white/10 group-hover:ring-inset",
                                                        getColorClass(intensity)
                                                    )} />
                                                    {/* Tooltip — posição totalmente adaptativa */}
                                                    <div
                                                        className={cn(
                                                            "absolute px-2.5 py-1.5 rounded-xl whitespace-nowrap pointer-events-none",
                                                            "bg-white/95 dark:bg-dark-900/95 text-slate-900 dark:text-white text-[9px]",
                                                            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                                                            "shadow-[0_8px_30px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-slate-200/90 dark:border-white/10",
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
                                                            <span className="text-primary-600 dark:text-primary-400 font-black">{day}</span>
                                                            <span className="text-slate-300 dark:text-white/20">·</span>
                                                            <span className="text-slate-950 dark:text-white font-black">{hour}h00</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[8px]">
                                                            <span className="text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Intensidade:</span>
                                                            <span className={cn(
                                                                "font-black",
                                                                intensity >= 80 ? "text-primary-600 dark:text-primary-400" :
                                                                intensity >= 60 ? "text-primary-500 dark:text-primary-500" :
                                                                intensity >= 40 ? "text-amber-500 dark:text-amber-400" :
                                                                "text-slate-500 dark:text-gray-500"
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
