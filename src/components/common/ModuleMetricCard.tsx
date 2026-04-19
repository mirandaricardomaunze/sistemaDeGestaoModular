import type { ReactNode } from 'react';
import { HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown } from 'react-icons/hi2';
import { cn } from '../../utils/helpers';

export const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9'];

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE: Record<string, {
    cardBg: string; cardBorder: string;
    iconBg: string; iconColor: string;
    accent: string;
}> = {
    primary:   { cardBg: 'bg-indigo-50/60 dark:bg-indigo-950/30',  cardBorder: 'border border-indigo-200/70 dark:border-indigo-800/40',  iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',  iconColor: 'text-indigo-600 dark:text-indigo-400',  accent: 'bg-indigo-500' },
    indigo:    { cardBg: 'bg-indigo-50/60 dark:bg-indigo-950/30',  cardBorder: 'border border-indigo-200/70 dark:border-indigo-800/40',  iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',  iconColor: 'text-indigo-600 dark:text-indigo-400',  accent: 'bg-indigo-500' },
    success:   { cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/30', cardBorder: 'border border-emerald-200/70 dark:border-emerald-800/40', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
    green:     { cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/30', cardBorder: 'border border-emerald-200/70 dark:border-emerald-800/40', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
    emerald:   { cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/30', cardBorder: 'border border-emerald-200/70 dark:border-emerald-800/40', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
    warning:   { cardBg: 'bg-amber-50/60 dark:bg-amber-950/30',    cardBorder: 'border border-amber-200/70 dark:border-amber-800/40',    iconBg: 'bg-amber-100 dark:bg-amber-900/40',    iconColor: 'text-amber-600 dark:text-amber-400',    accent: 'bg-amber-500' },
    amber:     { cardBg: 'bg-amber-50/60 dark:bg-amber-950/30',    cardBorder: 'border border-amber-200/70 dark:border-amber-800/40',    iconBg: 'bg-amber-100 dark:bg-amber-900/40',    iconColor: 'text-amber-600 dark:text-amber-400',    accent: 'bg-amber-500' },
    yellow:    { cardBg: 'bg-amber-50/60 dark:bg-amber-950/30',    cardBorder: 'border border-amber-200/70 dark:border-amber-800/40',    iconBg: 'bg-amber-100 dark:bg-amber-900/40',    iconColor: 'text-amber-600 dark:text-amber-400',    accent: 'bg-amber-500' },
    danger:    { cardBg: 'bg-red-50/60 dark:bg-red-950/30',        cardBorder: 'border border-red-200/70 dark:border-red-800/40',        iconBg: 'bg-red-100 dark:bg-red-900/40',        iconColor: 'text-red-600 dark:text-red-400',        accent: 'bg-red-500' },
    red:       { cardBg: 'bg-red-50/60 dark:bg-red-950/30',        cardBorder: 'border border-red-200/70 dark:border-red-800/40',        iconBg: 'bg-red-100 dark:bg-red-900/40',        iconColor: 'text-red-600 dark:text-red-400',        accent: 'bg-red-500' },
    info:      { cardBg: 'bg-blue-50/60 dark:bg-blue-950/30',      cardBorder: 'border border-blue-200/70 dark:border-blue-800/40',      iconBg: 'bg-blue-100 dark:bg-blue-900/40',      iconColor: 'text-blue-600 dark:text-blue-400',      accent: 'bg-blue-500' },
    blue:      { cardBg: 'bg-blue-50/60 dark:bg-blue-950/30',      cardBorder: 'border border-blue-200/70 dark:border-blue-800/40',      iconBg: 'bg-blue-100 dark:bg-blue-900/40',      iconColor: 'text-blue-600 dark:text-blue-400',      accent: 'bg-blue-500' },
    cyan:      { cardBg: 'bg-cyan-50/60 dark:bg-cyan-950/30',      cardBorder: 'border border-cyan-200/70 dark:border-cyan-800/40',      iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',      iconColor: 'text-cyan-600 dark:text-cyan-400',      accent: 'bg-cyan-500' },
    purple:    { cardBg: 'bg-purple-50/60 dark:bg-purple-950/30',  cardBorder: 'border border-purple-200/70 dark:border-purple-800/40',  iconBg: 'bg-purple-100 dark:bg-purple-900/40',  iconColor: 'text-purple-600 dark:text-purple-400',  accent: 'bg-purple-500' },
    violet:    { cardBg: 'bg-violet-50/60 dark:bg-violet-950/30',  cardBorder: 'border border-violet-200/70 dark:border-violet-800/40',  iconBg: 'bg-violet-100 dark:bg-violet-900/40',  iconColor: 'text-violet-600 dark:text-violet-400',  accent: 'bg-violet-500' },
    teal:      { cardBg: 'bg-teal-50/60 dark:bg-teal-950/30',      cardBorder: 'border border-teal-200/70 dark:border-teal-800/40',      iconBg: 'bg-teal-100 dark:bg-teal-900/40',      iconColor: 'text-teal-600 dark:text-teal-400',      accent: 'bg-teal-500' },
    orange:    { cardBg: 'bg-orange-50/60 dark:bg-orange-950/30',  cardBorder: 'border border-orange-200/70 dark:border-orange-800/40',  iconBg: 'bg-orange-100 dark:bg-orange-900/40',  iconColor: 'text-orange-600 dark:text-orange-400',  accent: 'bg-orange-500' },
    slate:     { cardBg: 'bg-slate-50/60 dark:bg-slate-900/30',    cardBorder: 'border border-slate-200/70 dark:border-slate-700/40',    iconBg: 'bg-slate-100 dark:bg-slate-800/60',    iconColor: 'text-slate-600 dark:text-slate-400',    accent: 'bg-slate-500' },
};

function getPalette(color: string) {
    return PALETTE[color] ?? PALETTE.primary;
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
    icon: ReactNode;
    color?: string;
    value: ReactNode;
    label: string;
    growth?: number;
    badge?: ReactNode;
    className?: string;
}

export function MetricCard({ icon, color = 'primary', value, label, growth, badge, className }: MetricCardProps) {
    const p = getPalette(color);

    return (
        <div className={cn(
            'relative group overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300',
            p.cardBg, p.cardBorder, className
        )}>
            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300', p.iconBg, p.iconColor)}>
                        {icon}
                    </div>
                    {growth !== undefined ? (
                        <div className={cn('flex items-center gap-1 text-xs font-black uppercase tracking-widest', growth >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {growth >= 0
                                ? <HiOutlineArrowTrendingUp className="w-3.5 h-3.5" />
                                : <HiOutlineArrowTrendingDown className="w-3.5 h-3.5" />}
                            {Math.abs(growth)}%
                        </div>
                    ) : badge ? (
                        <div className="scale-90 origin-right">{badge}</div>
                    ) : null}
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{value}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mt-0.5">{label}</p>
            </div>
            <div className={cn('absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-8', p.accent)} />
        </div>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
    icon: ReactNode;
    color?: string;
    value: ReactNode;
    label: string;
    sublabel?: string;
    className?: string;
}

export function StatCard({ icon, color = 'success', value, label, sublabel, className }: StatCardProps) {
    const p = getPalette(color);

    return (
        <div className={cn(
            'relative group overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300',
            p.cardBg, p.cardBorder, className
        )}>
            <div className="p-5 flex items-center gap-4">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 duration-300', p.iconBg, p.iconColor)}>
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] font-black">{label}</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{value}</p>
                    {sublabel && <p className="text-[10px] text-gray-400 font-bold italic mt-0.5">{sublabel}</p>}
                </div>
            </div>
            <div className={cn('absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-8', p.accent)} />
        </div>
    );
}
