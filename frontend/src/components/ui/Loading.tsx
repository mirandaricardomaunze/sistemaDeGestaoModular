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
                @keyframes mc-sweep {
                    0%   { transform: translateX(-120%); }
                    100% { transform: translateX(380%);  }
                }
                @keyframes mc-shimmer {
                    0%   { transform: translateX(350%);  }
                    100% { transform: translateX(-120%); }
                }
            `}</style>

            <div
                className={cn(
                    'flex flex-col items-center justify-center gap-4 z-50',
                    fullScreen
                        ? 'fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm'
                        : 'absolute inset-0 rounded-xl bg-black/40 backdrop-blur-sm'
                )}
                role="status"
                aria-live="polite"
            >
                {/* Scanner-beam progress bar */}
                <div className={cn(
                    'relative overflow-hidden rounded-full bg-white/10',
                    fullScreen ? 'w-52 h-[3px]' : 'w-32 h-[2px]'
                )}>
                    {/* Primary beam with glow */}
                    <div
                        className="absolute inset-y-0 w-2/5 rounded-full"
                        style={{
                            background: 'linear-gradient(90deg, transparent 0%, #818cf8 40%, #ffffff 65%, #34d399 85%, transparent 100%)',
                            boxShadow: '0 0 10px 3px rgba(99,102,241,0.55), 0 0 4px 1px rgba(52,211,153,0.35)',
                            animation: 'mc-sweep 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite',
                        }}
                    />
                    {/* Counter shimmer adds depth */}
                    <div
                        className="absolute inset-y-0 w-1/4 rounded-full opacity-20"
                        style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
                            animation: 'mc-shimmer 2.4s ease-in-out infinite',
                        }}
                    />
                </div>

                {/* Status label */}
                <p className={cn(
                    'select-none font-medium text-white/60 tracking-widest uppercase',
                    fullScreen ? 'text-[11px]' : 'text-[10px]'
                )}>
                    {displayMessage}
                </p>
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
