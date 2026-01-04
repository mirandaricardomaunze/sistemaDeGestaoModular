import { cn } from '../../utils/helpers';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    animation?: 'pulse' | 'wave';
    width?: string | number;
    height?: string | number;
}

export function Skeleton({
    className,
    variant = 'rectangular',
    animation = 'pulse',
    width,
    height,
}: SkeletonProps) {
    const baseClasses = 'bg-gray-200 dark:bg-dark-700';

    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-dark-700 dark:via-dark-600 dark:to-dark-700 bg-[length:200%_100%]',
    };

    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;

    return (
        <div
            className={cn(
                baseClasses,
                variantClasses[variant],
                animationClasses[animation],
                className
            )}
            style={style}
        />
    );
}

// Skeleton pré-configurados para casos comuns
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="text"
                    height={16}
                    className={i === lines - 1 ? 'w-3/4' : 'w-full'}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={cn('p-6 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700', className)}>
            <div className="flex items-center gap-4 mb-4">
                <Skeleton variant="circular" width={48} height={48} />
                <div className="flex-1 space-y-2">
                    <Skeleton variant="text" height={20} className="w-1/2" />
                    <Skeleton variant="text" height={16} className="w-3/4" />
                </div>
            </div>
            <SkeletonText lines={3} />
        </div>
    );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} variant="text" height={20} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton key={colIndex} variant="text" height={16} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
    return <Skeleton variant="circular" width={size} height={size} />;
}

export function SkeletonButton({ className }: { className?: string }) {
    return <Skeleton variant="rectangular" height={40} className={cn('w-32', className)} />;
}
