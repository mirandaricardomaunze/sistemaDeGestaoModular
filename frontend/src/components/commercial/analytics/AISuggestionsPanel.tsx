import { useNavigate } from 'react-router-dom';
import { HiSparkles, HiOutlineArrowPath } from 'react-icons/hi2';
import { Card, Badge, Button, Skeleton } from '../../ui';
import { cn } from '../../../utils/helpers';
import { useAIDecisionSuggestions } from '../../../hooks/useCommercial';
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
    const {
        data: aiSuggestions,
        isLoading: aiSuggestionsLoading,
        error: aiSuggestionsError,
        refetch: refetchAISuggestions,
    } = useAIDecisionSuggestions(warehouseId);

    return (
        <Card padding="lg" className={cn(PANEL_SURFACE, 'border-l-4 border-l-primary-500')}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 flex items-center justify-center">
                        <HiSparkles className="w-5 h-5 text-primary-600 dark:text-primary-300" />
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
                <div className="flex items-center gap-2">
                    <Badge variant={aiSuggestions.some(item => item.source === 'ai') ? 'success' : 'info'} size="sm">
                        {aiSuggestions.some(item => item.source === 'ai') ? 'IA activa' : 'Regras + fallback'}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => refetchAISuggestions()}
                        leftIcon={<HiOutlineArrowPath className={cn('w-3.5 h-3.5', aiSuggestionsLoading && 'animate-spin')} />}
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
                                        {(suggestion.confidence * 100).toFixed(0)}%
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
