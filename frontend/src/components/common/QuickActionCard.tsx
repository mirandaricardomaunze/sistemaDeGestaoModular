import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils';
import { Button } from '../ui/Button';

interface QuickActionCardProps {
    icon: React.ElementType;
    label: string;
    description?: string;
    path: string;
    color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan' | 'teal' | 'purple' | 'orange' | 'blue' | 'red' | 'yellow';
    variant?: 'default' | 'dashed';
    className?: string;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
    icon: Icon,
    label,
    description,
    path,
    color = 'primary',
    variant = 'default',
    className
}) => {
    const navigate = useNavigate();

    const colors: Record<string, string> = {
        primary: 'border-primary-200 hover:border-primary-500/70 hover:bg-primary-50 dark:hover:bg-primary-500/5 text-primary-700 dark:text-primary-400',
        emerald: 'border-emerald-200 hover:border-emerald-500/70 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
        amber: 'border-amber-200 hover:border-amber-500/70 hover:bg-amber-50 dark:hover:bg-amber-500/5 text-amber-700 dark:text-amber-400',
        rose: 'border-rose-200 hover:border-rose-500/70 hover:bg-rose-50 dark:hover:bg-rose-500/5 text-rose-700 dark:text-rose-400',
        indigo: 'border-indigo-200 hover:border-indigo-500/70 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 text-indigo-700 dark:text-indigo-400',
        cyan: 'border-cyan-200 hover:border-cyan-500/70 hover:bg-cyan-50 dark:hover:bg-cyan-500/5 text-cyan-700 dark:text-cyan-400',
        teal: 'border-teal-200 hover:border-teal-500/70 hover:bg-teal-50 dark:hover:bg-teal-500/5 text-teal-700 dark:text-teal-400',
        purple: 'border-purple-200 hover:border-purple-500/70 hover:bg-purple-50 dark:hover:bg-purple-500/5 text-purple-700 dark:text-purple-400',
        orange: 'border-orange-200 hover:border-orange-500/70 hover:bg-orange-50 dark:hover:bg-orange-500/5 text-orange-700 dark:text-orange-400',
        blue: 'border-blue-200 hover:border-blue-500/70 hover:bg-blue-50 dark:hover:bg-blue-500/5 text-blue-700 dark:text-blue-400',
        red: 'border-red-200 hover:border-red-500/70 hover:bg-red-50 dark:hover:bg-red-500/5 text-red-700 dark:text-red-400',
        yellow: 'border-yellow-200 hover:border-yellow-500/70 hover:bg-yellow-50 dark:hover:bg-yellow-500/5 text-yellow-700 dark:text-yellow-400',
    };

    const iconBgColors: Record<string, string> = {
        primary: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 border-primary-100 dark:border-primary-800/50',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-800/50',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border-rose-100 dark:border-rose-800/50',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50',
        cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400 border-cyan-100 dark:border-cyan-800/50',
        teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400 border-teal-100 dark:border-teal-800/50',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-800/50',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 border-orange-100 dark:border-orange-800/50',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-800/50',
        red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-800/50',
        yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-100 dark:border-yellow-800/50',
    };

    if (variant === 'dashed') {
        return (
            <Button variant="ghost"
                onClick={() => navigate(path)}
                className={cn(
                    "w-full p-4 rounded-2xl border-2 border-dashed transition-all duration-300 text-center",
                    "border-slate-200 dark:border-dark-700 bg-white/50 dark:bg-dark-800/50",
                    "hover:border-primary-500/50 hover:bg-primary-50/10 dark:hover:bg-primary-500/5",
                    className
                )}
            >
                <div className={cn(
                    "w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
                    "bg-white dark:bg-dark-800 text-slate-400 border border-slate-200 dark:border-dark-700",
                    "group-hover:shadow-md group-hover:border-primary-500/30",
                )}>
                    <Icon className="w-6 h-6" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-gray-300">
                    {label}
                </p>
            </Button>
        );
    }

    return (
        <Button variant="ghost"
            onClick={() => navigate(path)}
            className={cn(
                "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl transition-all duration-300 border-2 group w-full min-h-[64px]",
                "bg-white dark:bg-dark-800/50 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.75)]",
                "hover:shadow-[0_14px_30px_-18px_rgba(15,23,42,0.9)] hover:-translate-y-0.5 active:scale-[0.98]",
                colors[color],
                className
            )}
        >
            <div className={cn(
                "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all duration-300 shadow-sm group-hover:shadow-md",
                iconBgColors[color]
            )}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="text-left min-w-0 flex-1">
                <p className="text-[11px] sm:text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-gray-200 group-hover:text-inherit transition-colors truncate">
                    {label}
                </p>
                {description && (
                    <p className="text-[9px] font-bold opacity-60 truncate uppercase tracking-tight mt-0.5">{description}</p>
                )}
            </div>
        </Button>
    );
};
