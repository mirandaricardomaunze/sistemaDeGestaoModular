/**
 * ModuleMetricCard — componentes reutilizáveis para dashboards de módulos.
 *
 * Elimina duplicação dos cartões de métricas que apareciam identicamente
 * em Farmácia, Hotel, Logística e Bottle Store.
 */

import type { ReactNode } from 'react';
import { HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown } from 'react-icons/hi2';
import { Card, Badge } from '../ui';
import { cn } from '../../utils/helpers';

// Cores de gráficos partilhadas — importar daqui em vez de definir localmente
export const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// ============================================================================
// MetricCard — cartão principal com círculo decorativo + ícone + valor + label
// ============================================================================

interface MetricCardProps {
    icon: ReactNode;
    /** Cor base do ícone/fundo, ex: 'primary' | 'secondary' | 'yellow' | 'red' | 'green' | 'purple' | 'cyan' | 'blue' */
    color?: string;
    value: ReactNode;
    label: string;
    /** Percentagem de crescimento: positivo = verde, negativo = vermelho */
    growth?: number;
    /** Badge a mostrar no canto superior direito */
    badge?: ReactNode;
    className?: string;
}

export function MetricCard({ icon, color = 'primary', value, label, growth, badge, className }: MetricCardProps) {
    return (
        <Card variant="premium" padding="md" className={cn('relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300', className)}>
            <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8 pointer-events-none`}>
                <div className={`w-full h-full rounded-full bg-${color}-500/10 blur-2xl`} />
            </div>
            <div className="relative">
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
                        <div className={`text-${color}-600 dark:text-${color}-400`}>
                            {icon}
                        </div>
                    </div>

                    {growth !== undefined ? (
                        <div className={cn(
                            'flex items-center gap-1 text-xs font-black uppercase tracking-widest',
                            growth >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                            {growth >= 0
                                ? <HiOutlineArrowTrendingUp className="w-3.5 h-3.5" />
                                : <HiOutlineArrowTrendingDown className="w-3.5 h-3.5" />}
                            {Math.abs(growth)}%
                        </div>
                    ) : badge ? (
                        <div className="scale-90 origin-right">
                            {badge}
                        </div>
                    ) : null}
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{value}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mt-0.5">{label}</p>
            </div>
        </Card>
    );
}

// ============================================================================
// StatCard — cartão com borda esquerda colorida + ícone + valor + label + sublabel
// ============================================================================

interface StatCardProps {
    icon: ReactNode;
    color?: string;
    value: ReactNode;
    label: string;
    sublabel?: string;
    className?: string;
}

export function StatCard({ icon, color = 'green', value, label, sublabel, className }: StatCardProps) {
    return (
        <Card variant="premium" padding="md" className={cn(`border-l-4 border-l-${color}-500 group`, className)}>
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-${color}-100 dark:bg-${color}-900/40 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                    <div className={`text-${color}-600 dark:text-${color}-400`}>{icon}</div>
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-[0.15em] font-black">{label}</p>
                    <p className={`text-2xl font-black text-${color}-600 tracking-tighter`}>{value}</p>
                    {sublabel && <p className="text-[10px] text-gray-400 font-bold italic mt-0.5">{sublabel}</p>}
                </div>
            </div>
        </Card>
    );
}
