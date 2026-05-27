import React from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '../../utils/helpers';
import { Button } from './Button';

export interface ModalProps {
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
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-xl',
        lg: 'sm:max-w-3xl',
        xl: 'sm:max-w-5xl',
        full: 'sm:max-w-[95vw]',
    };

    return (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container — full-screen on mobile, centered card on >= sm */}
            <div className="flex min-h-full items-stretch sm:items-center justify-center sm:p-4">
                <div
                    className={cn(
                        'relative w-full flex flex-col overflow-hidden',
                        'min-h-screen sm:min-h-0 sm:max-h-[90vh] sm:rounded-2xl sm:shadow-card-hover sm:border sm:border-slate-300/70 sm:dark:border-dark-700/50',
                        'animate-slide-up',
                        isLight ? 'bg-white text-slate-900' : 'bg-white dark:bg-dark-800',
                        sizeClasses[size],
                        className
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header — sticky on mobile */}
                    {(title || showCloseButton) && (
                        <div className={cn(
                            "sticky top-0 z-10 flex items-center justify-between px-4 py-3 sm:p-6 border-b",
                            isLight ? "bg-white border-slate-200" : "bg-white dark:bg-dark-800 border-slate-200 dark:border-dark-700",
                            "pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-6"
                        )}>
                            {title && (
                                <h2 className={cn(
                                    "text-base sm:text-xl font-bold truncate pr-2",
                                    isLight ? "text-slate-950" : "text-slate-950 dark:text-white"
                                )}>
                                    {title}
                                </h2>
                            )}
                            {showCloseButton && (
                                <Button variant="ghost"
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Fechar"
                                    className={cn(
                                        "p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 flex-shrink-0",
                                        isLight
                                            ? "hover:bg-slate-100 text-slate-500"
                                            : "hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-500 dark:text-gray-400"
                                    )}
                                >
                                    <HiOutlineXMark className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div
                        className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar"
                        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
