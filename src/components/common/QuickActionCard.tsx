import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils';

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
        primary: 'text-primary-600 bg-primary-50/80 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/20',
        emerald: 'text-emerald-600 bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        amber: 'text-amber-600 bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
        rose: 'text-rose-600 bg-rose-50/80 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
        indigo: 'text-indigo-600 bg-indigo-50/80 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20',
        cyan: 'text-cyan-600 bg-cyan-50/80 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20',
        teal: 'text-teal-600 bg-teal-50/80 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20',
        purple: 'text-purple-600 bg-purple-50/80 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
        orange: 'text-orange-600 bg-orange-50/80 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
        blue: 'text-blue-600 bg-blue-50/80 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
        red: 'text-red-600 bg-red-50/80 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
        yellow: 'text-yellow-600 bg-yellow-50/80 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20',
    };

    if (variant === 'dashed') {
        return (
            <button
                onClick={() => navigate(path)}
                className={cn(
                    "w-full p-4 rounded-xl border-2 border-dashed transition-all group text-center",
                    "border-slate-200 dark:border-dark-600",
                    `hover:border-${color}-500 hover:bg-${color}-50 dark:hover:bg-${color}-900/10`,
                    className
                )}
            >
                <div className={cn(
                    "w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm",
                    "bg-white dark:bg-dark-800 text-slate-400 dark:text-gray-500",
                    `group-hover:bg-${color}-500 group-hover:text-white group-hover:shadow-lg group-hover:rotate-6`,
                )}>
                    <Icon className="w-6 h-6" />
                </div>
                <p className={cn(
                    "text-sm font-black uppercase tracking-widest transition-colors",
                    "text-slate-600 dark:text-gray-300",
                    `group-hover:text-${color}-600 dark:group-hover:text-${color}-400`
                )}>
                    {label}
                </p>
                {description && (
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-tight">{description}</p>
                )}
            </button>
        );
    }

    return (
        <button
            onClick={() => navigate(path)}
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all duration-300 border shadow-sm group w-full",
                "hover:scale-[1.02] hover:shadow-md",
                colors[color],
                className
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border transition-transform group-hover:rotate-6 shadow-inner",
                "bg-white/60 dark:bg-transparent"
            )}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="text-left min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest truncate">{label}</p>
                {description && (
                    <p className="text-[9px] font-bold opacity-70 truncate uppercase tracking-tighter">{description}</p>
                )}
            </div>
        </button>
    );
};
