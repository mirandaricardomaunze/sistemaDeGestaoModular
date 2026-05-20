import type { ReactNode } from 'react';
import { HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown } from 'react-icons/hi2';
import { cn } from '../../utils/helpers';
import { Button } from '../ui/Button';

export const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9'];

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE: Record<string, {
    cardBg: string; cardBorder: string;
    iconBg: string; iconColor: string;
    accent: string;
}> = {
    primary:   { cardBg: 'bg-gradient-to-br from-white to-indigo-50/50 dark:from-indigo-950/30 dark:to-indigo-950/20',   cardBorder: 'border border-indigo-300/80 dark:border-indigo-500/20',   iconBg: 'bg-indigo-600 dark:bg-indigo-500/15 border border-indigo-600 dark:border-indigo-500/25',   iconColor: 'text-white dark:text-indigo-300',   accent: 'bg-indigo-600' },
    indigo:    { cardBg: 'bg-gradient-to-br from-white to-indigo-50/50 dark:from-indigo-950/30 dark:to-indigo-950/20',   cardBorder: 'border border-indigo-300/80 dark:border-indigo-500/20',   iconBg: 'bg-indigo-600 dark:bg-indigo-500/15 border border-indigo-600 dark:border-indigo-500/25',   iconColor: 'text-white dark:text-indigo-300',   accent: 'bg-indigo-600' },
    success:   { cardBg: 'bg-gradient-to-br from-white to-emerald-50/50 dark:from-emerald-950/30 dark:to-emerald-950/20',  cardBorder: 'border border-emerald-300/80 dark:border-emerald-500/20',  iconBg: 'bg-emerald-600 dark:bg-emerald-500/15 border border-emerald-600 dark:border-emerald-500/25',  iconColor: 'text-white dark:text-emerald-300',  accent: 'bg-emerald-600' },
    green:     { cardBg: 'bg-gradient-to-br from-white to-emerald-50/50 dark:from-emerald-950/30 dark:to-emerald-950/20',  cardBorder: 'border border-emerald-300/80 dark:border-emerald-500/20',  iconBg: 'bg-emerald-600 dark:bg-emerald-500/15 border border-emerald-600 dark:border-emerald-500/25',  iconColor: 'text-white dark:text-emerald-300',  accent: 'bg-emerald-600' },
    emerald:   { cardBg: 'bg-gradient-to-br from-white to-emerald-50/50 dark:from-emerald-950/30 dark:to-emerald-950/20',  cardBorder: 'border border-emerald-300/80 dark:border-emerald-500/20',  iconBg: 'bg-emerald-600 dark:bg-emerald-500/15 border border-emerald-600 dark:border-emerald-500/25',  iconColor: 'text-white dark:text-emerald-300',  accent: 'bg-emerald-600' },
    warning:   { cardBg: 'bg-gradient-to-br from-white to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/20',    cardBorder: 'border border-amber-300/80 dark:border-amber-500/20',      iconBg: 'bg-amber-500 dark:bg-amber-500/15 border border-amber-500 dark:border-amber-500/25',        iconColor: 'text-white dark:text-amber-300',      accent: 'bg-amber-500' },
    amber:     { cardBg: 'bg-gradient-to-br from-white to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/20',    cardBorder: 'border border-amber-300/80 dark:border-amber-500/20',      iconBg: 'bg-amber-500 dark:bg-amber-500/15 border border-amber-500 dark:border-amber-500/25',        iconColor: 'text-white dark:text-amber-300',      accent: 'bg-amber-500' },
    yellow:    { cardBg: 'bg-gradient-to-br from-white to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/20',    cardBorder: 'border border-amber-300/80 dark:border-amber-500/20',      iconBg: 'bg-amber-500 dark:bg-amber-500/15 border border-amber-500 dark:border-amber-500/25',        iconColor: 'text-white dark:text-amber-300',      accent: 'bg-amber-500' },
    danger:    { cardBg: 'bg-gradient-to-br from-white to-red-50/50 dark:from-red-950/30 dark:to-red-950/20',      cardBorder: 'border border-red-300/80 dark:border-red-500/20',          iconBg: 'bg-red-600 dark:bg-red-500/15 border border-red-600 dark:border-red-500/25',                iconColor: 'text-white dark:text-red-300',          accent: 'bg-red-600' },
    red:       { cardBg: 'bg-gradient-to-br from-white to-red-50/50 dark:from-red-950/30 dark:to-red-950/20',      cardBorder: 'border border-red-300/80 dark:border-red-500/20',          iconBg: 'bg-red-600 dark:bg-red-500/15 border border-red-600 dark:border-red-500/25',                iconColor: 'text-white dark:text-red-300',          accent: 'bg-red-600' },
    info:      { cardBg: 'bg-gradient-to-br from-white to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/20',     cardBorder: 'border border-blue-300/80 dark:border-blue-500/20',        iconBg: 'bg-blue-600 dark:bg-blue-500/15 border border-blue-600 dark:border-blue-500/25',            iconColor: 'text-white dark:text-blue-300',        accent: 'bg-blue-600' },
    blue:      { cardBg: 'bg-gradient-to-br from-white to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/20',     cardBorder: 'border border-blue-300/80 dark:border-blue-500/20',        iconBg: 'bg-blue-600 dark:bg-blue-500/15 border border-blue-600 dark:border-blue-500/25',            iconColor: 'text-white dark:text-blue-300',        accent: 'bg-blue-600' },
    cyan:      { cardBg: 'bg-gradient-to-br from-white to-cyan-50/50 dark:from-cyan-950/30 dark:to-cyan-950/20',     cardBorder: 'border border-cyan-300/80 dark:border-cyan-500/20',        iconBg: 'bg-cyan-600 dark:bg-cyan-500/15 border border-cyan-600 dark:border-cyan-500/25',            iconColor: 'text-white dark:text-cyan-300',        accent: 'bg-cyan-600' },
    purple:    { cardBg: 'bg-gradient-to-br from-white to-purple-50/50 dark:from-purple-950/30 dark:to-purple-950/20',   cardBorder: 'border border-purple-300/80 dark:border-purple-500/20',    iconBg: 'bg-purple-600 dark:bg-purple-500/15 border border-purple-600 dark:border-purple-500/25',    iconColor: 'text-white dark:text-purple-300',    accent: 'bg-purple-600' },
    violet:    { cardBg: 'bg-gradient-to-br from-white to-violet-50/50 dark:from-violet-950/30 dark:to-violet-950/20',   cardBorder: 'border border-violet-300/80 dark:border-violet-500/20',    iconBg: 'bg-violet-600 dark:bg-violet-500/15 border border-violet-600 dark:border-violet-500/25',    iconColor: 'text-white dark:text-violet-300',    accent: 'bg-violet-600' },
    teal:      { cardBg: 'bg-gradient-to-br from-white to-teal-50/50 dark:from-teal-950/30 dark:to-teal-950/20',     cardBorder: 'border border-teal-300/80 dark:border-teal-500/20',        iconBg: 'bg-teal-600 dark:bg-teal-500/15 border border-teal-600 dark:border-teal-500/25',            iconColor: 'text-white dark:text-teal-300',        accent: 'bg-teal-600' },
    orange:    { cardBg: 'bg-gradient-to-br from-white to-orange-50/50 dark:from-orange-950/30 dark:to-orange-950/20',   cardBorder: 'border border-orange-300/80 dark:border-orange-500/20',    iconBg: 'bg-orange-600 dark:bg-orange-500/15 border border-orange-600 dark:border-orange-500/25',    iconColor: 'text-white dark:text-orange-300',    accent: 'bg-orange-600' },
    slate:     { cardBg: 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-900/40 dark:to-slate-900/20',    cardBorder: 'border border-slate-300 dark:border-slate-600/35',      iconBg: 'bg-slate-700 dark:bg-slate-500/15 border border-slate-700 dark:border-slate-500/25',        iconColor: 'text-white dark:text-slate-300',      accent: 'bg-slate-700' },
};


function getPalette(color: string) {
    return PALETTE[color] ?? PALETTE.primary;
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
    icon: ReactNode;
    color?: string;
    value: string | number | ReactNode;
    label: string;
    growth?: number;
    badge?: ReactNode;
    className?: string;
    isCurrency?: boolean;
    isLoading?: boolean;
}

export function MetricCard({ 
    icon, 
    color = 'primary', 
    value, 
    label, 
    growth, 
    badge, 
    className,
    isCurrency = false,
    isLoading = false
}: MetricCardProps) {
    const p = getPalette(color);

    const formattedValue = isLoading 
        ? '...' 
        : isCurrency 
            ? new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(Number(value) || 0)
            : value;

    return (
        <div className={cn(
            'relative group overflow-hidden rounded-2xl transition-all duration-300 ease-out',
            'shadow-[0_4px_20px_-4px_rgba(148,163,184,0.12)] hover:shadow-[0_12px_30px_-6px_rgba(148,163,184,0.25)]',
            'dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_12px_35px_-6px_rgba(0,0,0,0.7)]',
            'hover:-translate-y-1 active:scale-[0.99]',
            p.cardBg, p.cardBorder, className
        )}>
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/55 via-transparent to-transparent dark:from-white/5 pointer-events-none" />
            <div className={cn('absolute left-0 top-0 h-full w-1 opacity-90', p.accent)} />
            
            <div className="p-5 relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <div className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110',
                        p.iconBg, p.iconColor
                    )}>
                        {icon}
                    </div>
                    {growth !== undefined ? (
                        <div className={cn(
                            'px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1',
                            growth >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        )}>
                            {growth >= 0
                                ? <HiOutlineArrowTrendingUp className="w-3.5 h-3.5" />
                                : <HiOutlineArrowTrendingDown className="w-3.5 h-3.5" />}
                            {Math.abs(growth)}%
                        </div>
                    ) : badge ? (
                        <div className="scale-90 origin-right">{badge}</div>
                    ) : null}
                </div>
                
                <div className="space-y-1">
                    <p className="text-2xl font-black text-slate-950 dark:text-white tracking-normal tabular-nums">
                        {formattedValue}
                    </p>
                    <p className="text-[10px] text-slate-600 dark:text-gray-400 uppercase tracking-widest font-black">
                        {label}
                    </p>
                </div>
            </div>
            
            {/* Elegant accent line */}
            <div className={cn(
                'absolute bottom-0 left-0 h-1 transition-all duration-700 ease-out w-12 group-hover:w-full opacity-90',
                p.accent
            )} />
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
            'relative group overflow-hidden rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 active:scale-[0.99]',
            p.cardBg, p.cardBorder, className
        )}>
            <div className="p-5 flex items-center gap-4">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-300', p.iconBg, p.iconColor)}>
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] font-black">{label}</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-normal">{value}</p>
                    {sublabel && <p className="text-[10px] text-gray-400 font-bold italic mt-0.5">{sublabel}</p>}
                </div>
            </div>
            <div className={cn('absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-8', p.accent)} />
        </div>
    );
}

// ─── FilterCard ───────────────────────────────────────────────────────────────

export interface FilterCardProps {
    label: string;
    value: string | number;
    sublabel?: string;
    color?: string;
    isActive?: boolean;
    onClick?: () => void;
    className?: string;
}

export function FilterCard({
    label,
    value,
    sublabel,
    color = 'primary',
    isActive = false,
    onClick,
    className
}: FilterCardProps) {
    const p = getPalette(color);
    
    // Extract base color name from accent (e.g., 'bg-emerald-600' -> 'emerald-600')
    const colorName = p.accent.replace('bg-', '');
    const textColor = `text-${colorName} dark:text-${colorName.replace('600', '400').replace('500', '300')}`;
    const labelColor = `text-${colorName} opacity-70 dark:text-${colorName.replace('600', '400').replace('500', '300')} dark:opacity-60`;

    return (
        <Button variant="ghost"
            onClick={onClick}
            type="button"
            className={cn(
                'group relative flex min-h-[8rem] flex-col gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left shadow-card transition-all duration-300',
                'hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98]',
                p.cardBg, p.cardBorder,
                isActive ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-900' : '',
                className
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 pointer-events-none" />

            <div className="flex items-center justify-between w-full relative z-10">
                <p className={cn("text-[10px] font-black uppercase tracking-widest leading-tight", labelColor)}>
                    {label}
                </p>
                {isActive && (
                    <span className="h-2 w-2 rounded-full bg-primary-600 shadow-[0_0_10px_rgba(59,84,255,0.5)] animate-pulse flex-none" />
                )}
            </div>

            <div className="flex flex-col gap-0.5 relative z-10">
                <p className={cn("text-3xl font-black tracking-tighter leading-none", textColor)}>
                    {value}
                </p>
                {sublabel && (
                    <p className={cn("text-[10px] uppercase font-black opacity-60", textColor)}>
                        {sublabel}
                    </p>
                )}
            </div>

            <div className={cn(
                'absolute bottom-0 left-0 h-1 transition-all duration-700 ease-out opacity-90',
                isActive ? 'w-full' : 'w-0 group-hover:w-8',
                p.accent
            )} />
        </Button>
    );
}
