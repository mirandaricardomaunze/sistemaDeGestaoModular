import React from 'react';
import { cn } from '../../utils/helpers';

export interface CardProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'glass' | 'premium';
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'indigo' | 'slate' | 'rose' | 'pink';
    onClick?: () => void;
}

export function Card({ children, className, variant = 'default', padding = 'md', color, onClick }: CardProps) {
    const paddingClasses = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
    };

    const variantClasses = {
        default: 'bg-white dark:bg-[#12141a] rounded-2xl shadow-card border border-slate-300/70 dark:border-white/5 transition-all duration-300 hover:shadow-card-hover hover:border-primary-500/35',
        glass: 'bg-white dark:bg-dark-900/40 rounded-2xl shadow-glass border border-slate-300/70 dark:border-white/5',
        premium: 'bg-gradient-to-br from-white to-slate-50 dark:from-dark-800 dark:to-[#0f1115] rounded-2xl border border-slate-300/70 dark:border-dark-700 shadow-premium relative overflow-hidden',
    };

    const colorClasses: Record<string, string> = {
        primary: 'bg-primary-600 text-white border-none shadow-lg shadow-primary-600/20',
        success: 'bg-emerald-600 text-white border-none shadow-lg shadow-emerald-600/20',
        warning: 'bg-amber-500 text-white border-none shadow-lg shadow-amber-500/20',
        danger: 'bg-rose-600 text-white border-none shadow-lg shadow-rose-600/20',
        info: 'bg-blue-600 text-white border-none shadow-lg shadow-blue-600/20',
        purple: 'bg-purple-600 text-white border-none shadow-lg shadow-purple-600/20',
        amber: 'bg-amber-600 text-white border-none shadow-lg shadow-amber-600/20',
        emerald: 'bg-emerald-600 text-white border-none shadow-lg shadow-emerald-600/20',
        cyan: 'bg-cyan-600 text-white border-none shadow-lg shadow-cyan-600/20',
        indigo: 'bg-indigo-600 text-white border-none shadow-lg shadow-indigo-600/20',
        slate: 'bg-white dark:bg-dark-700 text-slate-950 dark:text-white border border-slate-300/70 dark:border-dark-600 shadow-card',
        rose: 'bg-rose-500 text-white border-none shadow-lg shadow-rose-500/20',
        pink: 'bg-pink-500 text-white border-none shadow-lg shadow-pink-500/20',
    };

    return (
        <div
            className={cn(
                variantClasses[variant],
                color && colorClasses[color],
                paddingClasses[padding],
                'transition-all duration-300 relative min-w-0 max-w-full break-words [overflow-wrap:anywhere]',
                !className?.includes('overflow-') && 'overflow-hidden',
                onClick && 'cursor-pointer active:scale-95',
                className
            )}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
