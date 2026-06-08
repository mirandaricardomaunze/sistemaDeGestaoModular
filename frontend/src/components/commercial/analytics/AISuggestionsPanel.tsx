import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiSparkles, HiOutlineArrowPath, HiOutlineBolt } from 'react-icons/hi2';
import { Card, Badge, Button, Skeleton } from '../../ui';
import { cn } from '../../../utils/helpers';
import { useAIDecisionSuggestions } from '../../../hooks/useCommercial';
import { useSocket } from '../../../contexts/SocketContext';
import type { AIDecisionSuggestion } from '../../../services/api';

const PANEL_SURFACE = 'bg-white dark:bg-dark-800 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]';

const SUGGESTION_STYLES: Record<AIDecisionSuggestion['priority'], { badge: 'danger' | 'warning' | 'info' | 'success'; accent: string; dot: string }> = {
    critical: { badge: 'danger', accent: 'border-l-red-500', dot: 'bg-red-500' },
    high: { badge: 'warning', accent: 'border-l-amber-500', dot: 'bg-amber-500' },
    medium: { badge: 'info', accent: 'border-l-blue-500', dot: 'bg-blue-500' },
    low: { badge: 'success', accent: 'border-l-emerald-500', dot: 'bg-emerald-500' },
};

const CATEGORY_LABELS: Record<AIDecisionSuggestion['category'], string> = {
    stock: 'Stock',
    sales: 'Vendas',
    finance: 'Finanças',
    operations: 'Operação',
    customers: 'Clientes',
    suppliers: 'Fornecedores',
};

interface AISuggestionsPanelProps {
    warehouseId?: string;
    maxItems?: number;
    description?: string;
}

export function AISuggestionsPanel({
    warehouseId,
    maxItems = 6,
    description = 'Recomendações automáticas com base em vendas, stock, caixa, facturas e previsão de procura.',
}: AISuggestionsPanelProps) {
    const navigate = useNavigate();
    const { isConnected } = useSocket();
    const {
        data: aiSuggestions,
        isLoading: aiSuggestionsLoading,
        isFetching: aiSuggestionsFetching,
        error: aiSuggestionsError,
        refetch: refetchAISuggestions,
        lastEventAt,
    } = useAIDecisionSuggestions(warehouseId);

    // Flash visual de 2s sempre que um evento dispara um refetch — dá ao
    // utilizador sinal de que o painel está a reagir em tempo real.
    const [eventFlash, setEventFlash] = useState(false);
    useEffect(() => {
        if (!lastEventAt) return;
        setEventFlash(true);
        const t = setTimeout(() => setEventFlash(false), 2000);
        return () => clearTimeout(t);
    }, [lastEventAt]);

    return (
        <Card
            padding="lg"
            className={cn(
                PANEL_SURFACE,
                'border-l-4 border-l-primary-500 transition-shadow duration-500',
                eventFlash && 'ring-2 ring-primary-400/60 dark:ring-primary-400/40 shadow-[0_0_0_4px_rgba(59,84,255,0.08)]'
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div className="flex items-start gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 flex items-center justify-center">
                        <HiSparkles className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                        {eventFlash && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary-500 ring-2 ring-white dark:ring-dark-800 animate-ping" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-widest">
                            Painel de Sugestões IA
                        </h3>
                        <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {description}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Indicador live: liga-se quando o socket está activo */}
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border',
                            isConnected
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-dark-600'
                        )}
                        title={isConnected ? 'A reagir a eventos em tempo real' : 'Sem ligação em tempo real — apenas polling periódico'}
                    >
                        <span className="relative flex h-1.5 w-1.5">
                            {isConnected && (
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            )}
                            <span className={cn(
                                'relative inline-flex rounded-full h-1.5 w-1.5',
                                isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                            )} />
                        </span>
                        {isConnected ? 'Live' : 'Offline'}
                    </span>
                    {eventFlash && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-500/20">
                            <HiOutlineBolt className="w-3 h-3" />
                            Novo evento
                        </span>
                    )}
                    <Badge variant={aiSuggestions.some(item => item.source === 'ai') ? 'success' : 'info'} size="sm">
                        {aiSuggestions.some(item => item.source === 'ai') ? 'IA activa' : 'Regras + fallback'}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => refetchAISuggestions()}
                        leftIcon={<HiOutlineArrowPath className={cn('w-3.5 h-3.5', (aiSuggestionsLoading || aiSuggestionsFetching) && 'animate-spin')} />}
                    >
                        Actualizar IA
                    </Button>
                </div>
            </div>

            {aiSuggestionsError && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    {aiSuggestionsError}. O painel continua a usar sinais automáticos locais.
                </div>
            )}

            {aiSuggestionsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[1, 2, 3].map(item => <Skeleton key={item} className="h-36 rounded-xl" />)}
                </div>
            ) : aiSuggestions.length === 0 ? (
                <div className="px-4 py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Sem sugestões neste momento
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Os sinais aparecem assim que houver movimento suficiente em vendas, stock ou tesouraria.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {aiSuggestions.slice(0, maxItems).map((suggestion) => {
                        const style = SUGGESTION_STYLES[suggestion.priority];
                        return (
                            <div
                                key={suggestion.id}
                                className={cn(
                                    'rounded-xl border border-slate-200/90 dark:border-white/10 border-l-4 bg-slate-50/70 dark:bg-dark-900/60 p-4 flex flex-col min-h-[168px]',
                                    style.accent
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={cn('w-2 h-2 rounded-full', style.dot)} />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                                {CATEGORY_LABELS[suggestion.category]}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-black text-slate-950 dark:text-white leading-snug">
                                            {suggestion.title}
                                        </h4>
                                    </div>
                                    <Badge variant={style.badge} size="sm">
                                        {suggestion.id === 'steady-state'
                                            ? 'Sem alertas'
                                            : `${(suggestion.confidence * 100).toFixed(0)}%`}
                                    </Badge>
                                </div>
                                <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {suggestion.summary}
                                </p>
                                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                    {suggestion.reasoning}
                                </p>
                                <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-300 truncate">
                                        {suggestion.impact}
                                    </span>
                                    <Button
                                        size="xs"
                                        variant="primary"
                                        onClick={() => navigate(suggestion.actionUrl)}
                                        className="shrink-0"
                                    >
                                        {suggestion.actionLabel}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}

export default AISuggestionsPanel;
