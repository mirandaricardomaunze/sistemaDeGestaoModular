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
        gray: 'border-slate-200 border-t-slate-600 dark:border-dark-600 dark:border-t-gray-400',
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
    subtext?: string;
    fullScreen?: boolean;
}

export function LoadingOverlay({ message, fullScreen = true }: LoadingOverlayProps) {
    const displayMessage = message || 'A carregar...';

    return (
        <>
            <style>{`
                @keyframes mc-spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes mc-bar {
                    0%   { transform: translateX(-100%); }
                    50%  { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
                @keyframes mc-fade-in {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes mc-card-in {
                    from { opacity: 0; transform: translateY(4px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0)   scale(1);    }
                }
            `}</style>

            <div
                className={cn(
                    'flex items-center justify-center',
                    fullScreen
                        ? 'fixed inset-0 z-[99999] bg-slate-900/55 dark:bg-black/65 backdrop-blur-md'
                        : 'absolute inset-0 z-50 rounded-xl bg-white/70 dark:bg-dark-900/70 backdrop-blur-sm'
                )}
                style={{ animation: 'mc-fade-in 180ms ease-out' }}
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                <div
                    className={cn(
                        'flex flex-col items-center',
                        fullScreen
                            ? 'gap-5 rounded-2xl px-10 py-8 min-w-[240px] bg-white/95 dark:bg-dark-800/95 shadow-2xl ring-1 ring-slate-200/70 dark:ring-dark-600/60'
                            : 'gap-3'
                    )}
                    style={fullScreen ? { animation: 'mc-card-in 220ms ease-out' } : undefined}
                >
                    {/* Dual-ring spinner */}
                    <div className={cn('relative', fullScreen ? 'w-11 h-11' : 'w-8 h-8')}>
                        <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-dark-600" />
                        <div
                            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary-600 border-r-primary-600"
                            style={{ animation: 'mc-spin 0.9s linear infinite' }}
                        />
                    </div>

                    {/* Status label */}
                    <p
                        className={cn(
                            'select-none font-medium text-center tracking-tight',
                            fullScreen
                                ? 'text-sm text-slate-700 dark:text-gray-200'
                                : 'text-xs text-slate-600 dark:text-gray-300'
                        )}
                    >
                        {displayMessage}
                    </p>

                    {/* Indeterminate progress bar */}
                    <div
                        className={cn(
                            'relative overflow-hidden rounded-full bg-slate-200/80 dark:bg-dark-700',
                            fullScreen ? 'w-44 h-[3px] mt-1' : 'w-28 h-[2px]'
                        )}
                    >
                        <div
                            className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary-600 to-transparent"
                            style={{ animation: 'mc-bar 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                        />
                    </div>
                </div>
            </div>
        </>
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
    progress: number;
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
            <div className={cn('w-full bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden', sizeClasses[size])}>
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
                <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 text-right">
                    {clampedProgress}%
                </p>
            )}
        </div>
    );
}
