import React from 'react';
import { cn } from '../../utils/helpers';

// ============================================================================
// Button Component
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning' | 'premium';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'action';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function Button({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText = 'Processando...',
    fullWidth = false,
    leftIcon,
    rightIcon,
    children,
    className,
    disabled,
    ...props
}: ButtonProps & { loadingText?: string }) {
    const hasSimpleChildren = typeof children === 'string' || typeof children === 'number';

    const variants = {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-md shadow-primary-500/20',
        secondary: 'bg-slate-800 text-white hover:bg-slate-900 focus:ring-slate-500 shadow-sm',
        outline: 'bg-white dark:bg-transparent border border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-dark-800 hover:border-primary-500/60 focus:ring-primary-500 shadow-sm',
        ghost: 'text-slate-700 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-dark-800 hover:text-primary-600 dark:hover:text-primary-400',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-500/20',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-lg shadow-emerald-500/20',
        warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500 shadow-lg shadow-amber-500/20',
        premium: 'bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-black hover:to-slate-900 shadow-xl shadow-black/10 border border-white/5',
    };

    const sizes = {
        xs: 'min-h-10 sm:min-h-8 px-2 py-2 sm:py-0 text-[10px] font-bold uppercase tracking-wider gap-1 rounded-md',
        sm: 'min-h-11 sm:min-h-10 px-3 py-2 sm:py-0 text-[10px] font-black uppercase tracking-widest gap-1.5 rounded-xl',
        action: 'min-h-11 sm:min-h-9 px-4 py-2 sm:py-0 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl',
        md: 'min-h-11 sm:min-h-12 px-4 sm:px-5 py-2 sm:py-0 text-sm font-bold gap-2 rounded-xl',
        lg: 'min-h-14 px-5 sm:px-8 py-3 sm:py-0 text-base font-bold gap-3 rounded-2xl',
    };

    return (
        <button
            className={cn(
                'inline-flex max-w-full min-w-0 items-center justify-center overflow-hidden text-center transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0 active:scale-[0.98] touch-manipulation',
                fullWidth && 'w-full',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin h-[1.2em] w-[1.2em] flex-shrink-0" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {loadingText && <span className="min-w-0 truncate">{loadingText}</span>}
                </>
            ) : (
                <>
                    {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                    {children && (
                        hasSimpleChildren ? (
                            <span className="min-w-0 truncate">{children}</span>
                        ) : (
                            children
                        )
                    )}
                    {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
                </>
            )}
        </button>
    );
}
