import React from 'react';
import { cn } from '../../utils/helpers';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'outline';

export interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    className?: string;
}

export function Badge({ children, variant = 'primary', size = 'md', className }: BadgeProps) {
    const variants = {
        primary: 'bg-primary-600 text-white shadow-sm shadow-primary-500/20',
        success: 'bg-green-600 text-white shadow-sm shadow-green-500/20',
        warning: 'bg-amber-500 text-white shadow-sm shadow-amber-500/20',
        danger: 'bg-red-600 text-white shadow-sm shadow-red-500/20',
        info: 'bg-blue-600 text-white shadow-sm shadow-blue-500/20',
        gray: 'bg-slate-500 text-white shadow-sm shadow-slate-500/20',
        outline: 'bg-transparent border-2 border-primary-500 text-primary-600 dark:text-primary-400',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-lg font-bold uppercase tracking-widest',
                variants[variant],
                sizes[size],
                className
            )}
        >
            {children}
        </span>
    );
}
