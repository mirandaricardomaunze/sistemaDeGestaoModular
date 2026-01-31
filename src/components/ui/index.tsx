import React from 'react';
import { cn } from '../../utils/helpers';

// ============================================================================
// Button Component - Re-exported from separate file
// ============================================================================

export { Button } from './Button';

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
    variant?: 'default' | 'glass';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, variant = 'default', padding = 'md' }: CardProps) {
    const paddingClasses = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    const variantClasses = {
        default: 'bg-white dark:bg-dark-800 rounded-xl shadow-card hover:shadow-card-hover',
        glass: 'bg-white/80 dark:bg-dark-800/80 backdrop-blur-lg rounded-xl shadow-glass border border-white/20 dark:border-dark-700/50',
    };

    return (
        <div
            className={cn(
                variantClasses[variant],
                paddingClasses[padding],
                'transition-all duration-200',
                className
            )}
        >
            {children}
        </div>
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
    size?: 'sm' | 'md' | 'lg';
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
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={cn(
                            'w-full rounded-lg border bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 shadow-sm',
                            size === 'sm' ? 'px-3 py-1.5 text-sm' :
                                size === 'lg' ? 'px-6 py-3.5 text-lg' :
                                    'px-4 py-2.5',
                            error
                                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                                : 'border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500',
                            leftIcon ? 'pl-10' : '',
                            rightIcon ? 'pr-10' : '',
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                        'w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 resize-none shadow-sm',
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
    size?: 'sm' | 'md' | 'lg';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, placeholder, className, size, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    className={cn(
                        'w-full rounded-lg border bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 transition-all duration-200 appearance-none cursor-pointer shadow-sm',
                        size === 'sm' ? 'px-3 py-1.5 text-sm' :
                            size === 'lg' ? 'px-6 py-3.5 text-lg' :
                                'px-4 py-2.5',
                        error
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                            : 'border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500',
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
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className={cn(
                        'relative w-full bg-white dark:bg-dark-800 rounded-2xl shadow-xl animate-slide-up',
                        sizeClasses[size]
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
                            {title && (
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    {title}
                                </h2>
                            )}
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 dark:text-gray-400 transition-colors"
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

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'outline';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    className?: string;
}

export function Badge({ children, variant = 'primary', size = 'md', className }: BadgeProps) {
    const variants = {
        primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        outline: 'bg-transparent border border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full font-medium',
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
        text: 'h-4 rounded',
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

