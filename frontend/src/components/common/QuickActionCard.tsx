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
        primary: 'hover:border-primary-500/70 hover:bg-primary-50 dark:hover:bg-primary-500/5 text-primary-700 dark:text-primary-400',
        emerald: 'hover:border-emerald-500/70 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
        amber: 'hover:border-amber-500/70 hover:bg-amber-50 dark:hover:bg-amber-500/5 text-amber-700 dark:text-amber-400',
        rose: 'hover:border-rose-500/70 hover:bg-rose-50 dark:hover:bg-rose-500/5 text-rose-700 dark:text-rose-400',
        indigo: 'hover:border-indigo-500/70 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 text-indigo-700 dark:text-indigo-400',
        cyan: 'hover:border-cyan-500/70 hover:bg-cyan-50 dark:hover:bg-cyan-500/5 text-cyan-700 dark:text-cyan-400',
        teal: 'hover:border-teal-500/70 hover:bg-teal-50 dark:hover:bg-teal-500/5 text-teal-700 dark:text-teal-400',
        purple: 'hover:border-purple-500/70 hover:bg-purple-50 dark:hover:bg-purple-500/5 text-purple-700 dark:text-purple-400',
        orange: 'hover:border-orange-500/70 hover:bg-orange-50 dark:hover:bg-orange-500/5 text-orange-700 dark:text-orange-400',
        blue: 'hover:border-blue-500/70 hover:bg-blue-50 dark:hover:bg-blue-500/5 text-blue-700 dark:text-blue-400',
        red: 'hover:border-red-500/70 hover:bg-red-50 dark:hover:bg-red-500/5 text-red-700 dark:text-red-400',
        yellow: 'hover:border-yellow-500/70 hover:bg-yellow-50 dark:hover:bg-yellow-500/5 text-yellow-700 dark:text-yellow-400',
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
                "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border group w-full",
                "bg-white dark:bg-dark-800/50 border-slate-200/90 dark:border-white/5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.75)]",
                "hover:shadow-[0_14px_30px_-18px_rgba(15,23,42,0.9)] hover:-translate-y-0.5",
                colors[color],
                className
            )}
        >
            <div className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all duration-300",
                "bg-white dark:bg-dark-900 border-slate-200 dark:border-white/10 shadow-sm group-hover:shadow-md"
            )}>
                <Icon className="w-5 h-5 transition-colors" />
            </div>
            <div className="text-left min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-gray-300 group-hover:text-inherit transition-colors">
                    {label}
                </p>
                {description && (
                    <p className="text-[9px] font-bold opacity-60 truncate uppercase tracking-tight mt-0.5">{description}</p>
                )}
            </div>
        </Button>
    );
};
