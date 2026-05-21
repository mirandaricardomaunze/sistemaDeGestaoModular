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
        sm: 'max-w-sm',
        md: 'max-w-xl',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl',
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
                        'relative w-full rounded-2xl shadow-card-hover animate-slide-up border border-slate-300/70 dark:border-dark-700/50 flex flex-col max-h-[90vh] overflow-hidden',
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
                            isLight ? "border-slate-200" : "border-slate-200 dark:border-dark-700"
                        )}>
                            {title && (
                                <h2 className={cn(
                                    "text-xl font-bold",
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
                                        "p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
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
                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">{children}</div>
                </div>
            </div>
        </div>
    );
}
