import { useState, useEffect } from 'react';
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

// ─── Main Loading Overlay (Premium) ──────────────────────────────────────────

interface LoadingOverlayProps {
    message?: string;
    subtext?: string;
    fullScreen?: boolean;
}

export function LoadingOverlay({ message, subtext, fullScreen = true }: LoadingOverlayProps) {
    const [textIndex, setTextIndex] = useState(0);
    const defaultMessages = [
        'A inicializar ecossistema...',
        'Sincronizando infraestrutura...',
        'Processando inteligência de dados...',
        'A preparar interface premium...'
    ];

    useEffect(() => {
        if (message) return;
        const interval = setInterval(() => {
            setTextIndex((prev) => (prev + 1) % defaultMessages.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [message]);

    const displayMessage = message || defaultMessages[textIndex];

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center bg-white/60 dark:bg-dark-950/80 backdrop-blur-md z-50 transition-all duration-700 ease-in-out',
                fullScreen ? 'fixed inset-0 z-[99999] backdrop-blur-[24px]' : 'absolute inset-0 rounded-2xl'
            )}
        >
            {/* Elegant Background Glows - Only for full screen */}
            {fullScreen && (
                <>
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 dark:bg-primary-500/5 blur-[120px] rounded-full animate-pulse-slow" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 blur-[120px] rounded-full animate-pulse-slow [animation-delay:2s]" />
                </>
            )}

            <div className={cn(
                "relative flex flex-col items-center z-10 transition-all duration-500",
                fullScreen ? "scale-100" : "scale-75"
            )}>
                {/* Advanced SVG Spinner */}
                <div className={cn(
                    "relative mb-8 transition-all",
                    fullScreen ? "w-32 h-32 mb-12" : "w-20 h-20 mb-6"
                )}>
                    <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
                        {/* Outer Track */}
                        <circle
                            cx="50" cy="50" r="45"
                            fill="none"
                            className="stroke-gray-100 dark:stroke-dark-800"
                            strokeWidth="2"
                        />
                        {/* Primary Animated Ring */}
                        <circle
                            cx="50" cy="50" r="45"
                            fill="none"
                            className="stroke-primary-500"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray="70 200"
                            style={{
                                animation: 'spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                                transformOrigin: 'center'
                            }}
                        />
                        {/* Secondary Animated Ring */}
                        <circle
                            cx="50" cy="50" r="35"
                            fill="none"
                            className="stroke-emerald-400/60"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="40 180"
                            style={{
                                animation: 'spin 2s linear infinite reverse',
                                transformOrigin: 'center'
                            }}
                        />
                    </svg>
                    
                    {/* Inner Core Ping */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 bg-primary-600 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.6)] animate-ping" />
                    </div>
                </div>

                {/* Branding & Typography */}
                <div className="text-center space-y-4 px-6">
                    <div className="relative">
                        <h1 className={cn(
                            "font-black tracking-tighter uppercase italic select-none transition-all",
                            fullScreen ? "text-6xl" : "text-4xl"
                        )}>
                            <span className="bg-gradient-to-br from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                                Multi
                            </span>
                            <span className="bg-gradient-to-br from-primary-600 to-emerald-500 bg-clip-text text-transparent">
                                Core
                            </span>
                        </h1>
                        {/* Subtle Version/Status Tag */}
                        <div className={cn(
                            "absolute px-1.5 py-0.5 rounded bg-primary-500/10 border border-primary-500/20 transition-all",
                            fullScreen ? "-right-8 -top-2" : "-right-6 -top-1 scale-75"
                        )}>
                            <span className="text-[8px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest">
                                v4.0 PRO
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className={cn(
                            "font-bold text-gray-900 dark:text-gray-100 transition-all duration-500 animate-pulse tracking-tight",
                            fullScreen ? "text-xl" : "text-sm"
                        )}>
                            {displayMessage}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] font-black opacity-60">
                            {subtext || 'Sistemas de Gestão Modular'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Footer Quote/Status - Only for full screen */}
            {fullScreen && (
                <div className="absolute bottom-12 left-0 right-0 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-dark-900/50 border border-gray-100 dark:border-dark-800 backdrop-blur-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            Servidor de Alta Disponibilidade: Operacional
                        </span>
                    </div>
                </div>
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
