import { cn } from '../../utils/helpers';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'primary' | 'white' | 'gray';
    className?: string;
}

export function Spinner({ size = 'md', variant = 'primary', className }: SpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-8 h-8 border-3',
        xl: 'w-12 h-12 border-4',
    };

    const variantClasses = {
        primary: 'border-primary-200 border-t-primary-600',
        white: 'border-white/20 border-t-white',
        gray: 'border-gray-200 border-t-gray-600 dark:border-dark-600 dark:border-t-gray-400',
    };

    return (
        <div
            className={cn(
                'inline-block rounded-full animate-spin',
                sizeClasses[size],
                variantClasses[variant],
                className
            )}
            role="status"
            aria-label="Loading"
        />
    );
}

interface LoadingOverlayProps {
    message?: string;
    fullScreen?: boolean;
}

export function LoadingOverlay({ message = 'Carregando...', fullScreen = false }: LoadingOverlayProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-4 bg-white/80 dark:bg-dark-900/80 backdrop-blur-sm z-50',
                fullScreen ? 'fixed inset-0' : 'absolute inset-0'
            )}
        >
            <Spinner size="xl" />
            {message && (
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 animate-pulse">
                    {message}
                </p>
            )}
        </div>
    );
}

interface LoadingDotsProps {
    className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
    return (
        <div className={cn('flex items-center gap-1', className)}>
            <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" />
        </div>
    );
}

interface ProgressBarProps {
    progress: number; // 0-100
    variant?: 'primary' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

export function ProgressBar({
    progress,
    variant = 'primary',
    size = 'md',
    showLabel = false,
    className,
}: ProgressBarProps) {
    const sizeClasses = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };

    const variantClasses = {
        primary: 'bg-primary-600',
        success: 'bg-green-600',
        warning: 'bg-yellow-600',
        danger: 'bg-red-600',
    };

    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className={cn('w-full', className)}>
            <div className={cn('w-full bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden', sizeClasses[size])}>
                <div
                    className={cn(
                        'h-full transition-all duration-300 ease-out rounded-full',
                        variantClasses[variant]
                    )}
                    style={{ width: `${clampedProgress}%` }}
                    role="progressbar"
                    aria-valuenow={clampedProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            </div>
            {showLabel && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {clampedProgress}%
                </p>
            )}
        </div>
    );
}
