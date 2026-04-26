import React from 'react';
import { cn } from '../../utils/helpers';

// ============================================================================
// Button Component - Re-exported from separate file
// ============================================================================

export { Button } from './Button';
export { ResponsiveValue } from './ResponsiveValue';

// ============================================================================
// ConfirmationModal Component - Re-exported from separate file
// ============================================================================

export { ConfirmationModal } from './ConfirmationModal';

// ============================================================================
// Card Component
// ============================================================================

interface CardProps {
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
        default: 'bg-white/95 dark:bg-dark-800 rounded-lg shadow-card-strong border border-slate-200/80 dark:border-dark-700/50 transition-all duration-300 hover:shadow-card-hover hover:border-primary-500/30',
        glass: 'bg-white/70 dark:bg-dark-800/80 backdrop-blur-xl rounded-lg shadow-glass border border-white dark:border-dark-700/30',
        premium: 'bg-white dark:bg-dark-900 rounded-lg border border-slate-200/50 dark:border-dark-700 shadow-premium relative overflow-hidden',
    };

    const colorClasses: Record<string, string> = {
        primary: 'bg-primary-500 text-white border-none shadow-lg shadow-primary-500/20',
        success: 'bg-green-600 text-white border-none shadow-lg shadow-green-500/20',
        warning: 'bg-amber-500 text-white border-none shadow-lg shadow-amber-500/20',
        danger: 'bg-red-600 text-white border-none shadow-lg shadow-red-500/20',
        info: 'bg-blue-600 text-white border-none shadow-lg shadow-blue-500/20',
        purple: 'bg-purple-600 text-white border-none shadow-lg shadow-purple-500/20',
        amber: 'bg-amber-600 text-white border-none shadow-lg shadow-amber-500/20',
        emerald: 'bg-green-600 text-white border-none shadow-lg shadow-green-500/20',
        cyan: 'bg-cyan-600 text-white border-none shadow-lg shadow-cyan-500/20',
        indigo: 'bg-indigo-600 text-white border-none shadow-lg shadow-indigo-500/20',
        slate: 'bg-slate-700 text-white border-none shadow-lg shadow-slate-500/20',
        rose: 'bg-rose-500 text-white border-none shadow-lg shadow-rose-500/20',
        pink: 'bg-pink-500 text-white border-none shadow-lg shadow-pink-500/20',
    };

    return (
        <div
            className={cn(
                variantClasses[variant],
                color && colorClasses[color],
                paddingClasses[padding],
                'transition-all duration-200 relative',
                !className?.includes('overflow-') && 'overflow-hidden',
                onClick && 'cursor-pointer hover:shadow-lg',
                className
            )}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

// ============================================================================
// PageHeader Component
// ============================================================================

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    tabs?: React.ReactNode;
    className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, tabs, className }: PageHeaderProps) {
    return (
        <Card variant="default" padding="md" className={cn("mb-6 border-none shadow-sm", className)}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                    {icon && (
                        <div className="w-12 h-12 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                            {React.cloneElement(icon as React.ReactElement, { 
                                className: cn('w-6 h-6 text-primary-600', (icon as any).props?.className) 
                            } as any)}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 italic">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
                {actions && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
            {tabs && (
                <div className="mt-6 -mb-6 border-t border-gray-100 dark:border-dark-700 relative z-10">
                    {tabs}
                </div>
            )}
        </Card>
    );
}

// ============================================================================
// Input Component
// ============================================================================

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, leftIcon, rightIcon, className, size, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={cn(
                            'w-full rounded-lg border bg-white dark:bg-dark-800 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 transition-all duration-300 shadow-sm',
                            size === 'xs' ? 'px-2 py-1 text-[10px]' :
                                size === 'sm' ? 'px-3 py-1.5 text-sm' :
                                    size === 'lg' ? 'px-6 py-3 text-lg' :
                                        'px-4 py-2',
                            error
                                ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-dark-600 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 focus:shadow-md',
                            leftIcon ? 'pl-11' : '',
                            rightIcon ? 'pr-11' : '',
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
                {helperText && !error && (
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';

// ============================================================================
// Textarea Component
// ============================================================================

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, helperText, className, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    className={cn(
                        'w-full px-4 py-2 rounded-lg border bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 resize-none shadow-sm',
                        error
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                            : 'border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500',
                        className
                    )}
                    {...props}
                />
                {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
                {helperText && !error && (
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
                )}
            </div>
        );
    }
);
Textarea.displayName = 'Textarea';

// ============================================================================
// Select Component
// ============================================================================

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'size'> {
    label?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    leftIcon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, placeholder, className, size, leftIcon, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            {leftIcon}
                        </div>
                    )}
                    <select
                        ref={ref}
                        className={cn(
                            'w-full rounded-lg border bg-white dark:bg-dark-800 text-slate-900 dark:text-gray-100 transition-all duration-300 appearance-none cursor-pointer shadow-sm',
                            size === 'xs' ? 'px-2 py-1 text-[10px]' :
                                size === 'sm' ? 'px-3 py-1.5 text-sm' :
                                    size === 'lg' ? 'px-6 py-3 text-lg' :
                                        'px-4 py-2',
                            error
                                ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-dark-600 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 focus:shadow-md',
                            leftIcon ? 'pl-10' : '',
                            className
                        )}
                        {...props}
                    >
                        {placeholder && (
                            <option value="" disabled>
                                {placeholder}
                            </option>
                        )}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
            </div>
        );
    }
);
Select.displayName = 'Select';

// ============================================================================
// Modal Component
// ============================================================================

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    className?: string;
    isLight?: boolean;
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
    className,
    isLight = false,
}: ModalProps) {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[95vw]',
    };

    return (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className={cn(
                        'relative w-full rounded-lg shadow-premium animate-slide-up border border-white/50 dark:border-dark-700/50',
                        isLight ? 'bg-white text-slate-900' : 'bg-white dark:bg-dark-800',
                        sizeClasses[size],
                        className
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className={cn(
                            "flex items-center justify-between p-6 border-b",
                            isLight ? "border-gray-100" : "border-gray-200 dark:border-dark-700"
                        )}>
                            {title && (
                                <h2 className={cn(
                                    "text-xl font-semibold",
                                    isLight ? "text-slate-900" : "text-gray-900 dark:text-white"
                                )}>
                                    {title}
                                </h2>
                            )}
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        isLight 
                                            ? "hover:bg-gray-100 text-gray-400" 
                                            : "hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 dark:text-gray-400"
                                    )}
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-6">{children}</div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Badge Component
// ============================================================================

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'outline';

interface BadgeProps {
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

// ============================================================================
// Skeleton Component
// ============================================================================

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
    const variantClasses = {
        text: 'h-4 rounded-lg',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };

    return (
        <div
            className={cn(
                'animate-pulse bg-gray-200 dark:bg-dark-700',
                variantClasses[variant],
                className
            )}
            style={{ width, height }}
        />
    );
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            {icon && (
                <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}

// ============================================================================
// Loading Spinner Component
// ============================================================================

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
    };

    return (
        <div className={cn('flex items-center justify-center', className)}>
            <svg
                className={cn('animate-spin text-primary-600', sizeClasses[size])}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        </div>
    );
}

// ============================================================================
// Re-export Pagination Component
// ============================================================================

export { default as Pagination, usePagination } from './Pagination';

// ============================================================================
// Re-export Loading Components
// ============================================================================

export { Spinner, LoadingOverlay, LoadingDots, ProgressBar } from './Loading';

// ============================================================================
// Re-export Skeleton Components
// ============================================================================

export { SkeletonText, SkeletonCard, SkeletonTable, SkeletonAvatar, SkeletonButton } from './Skeleton';

// ============================================================================
// Re-export EmptyState Components
// ============================================================================

export { NoDataFound, NoResultsFound, ErrorState, ComingSoon, NoItems } from './EmptyState';
export { DataTable, TableContainer } from './DataTable';
export { Tabs, TabPanel, TabContent, Stepper, useTabs, useStepper } from './Tabs';

