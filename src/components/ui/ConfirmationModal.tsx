import React, { useEffect } from 'react';
import { cn } from '../../utils/helpers';
import { HiOutlineExclamation, HiOutlineInformationCircle, HiOutlineTrash, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import { Button } from './Button';

type ConfirmationVariant = 'danger' | 'warning' | 'info';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmationVariant;
    isLoading?: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    isLoading = false,
}: ConfirmationModalProps) {
    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isLoading) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, isLoading, onClose]);

    if (!isOpen) return null;

    const variantConfig = {
        danger: {
            icon: HiOutlineTrash,
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            confirmVariant: 'danger' as const,
        },
        warning: {
            icon: HiOutlineExclamation,
            iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            confirmVariant: 'primary' as const,
        },
        info: {
            icon: HiOutlineInformationCircle,
            iconBg: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
            confirmVariant: 'primary' as const,
        },
    };

    const config = variantConfig[variant];
    const Icon = config.icon;

    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={!isLoading ? onClose : undefined}
            />

            {/* Modal Container */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-2xl shadow-xl animate-slide-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Content */}
                    <div className="p-6">
                        {/* Icon */}
                        <div className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4',
                            config.iconBg
                        )}>
                            <Icon className={cn('w-6 h-6', config.iconColor)} />
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                            {title}
                        </h3>

                        {/* Message */}
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                            {message}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                fullWidth
                                onClick={onClose}
                                disabled={isLoading}
                                leftIcon={<HiOutlineX className="w-4 h-4" />}
                            >
                                {cancelText}
                            </Button>
                            <Button
                                variant={config.confirmVariant}
                                fullWidth
                                onClick={handleConfirm}
                                isLoading={isLoading}
                                disabled={isLoading}
                                leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                            >
                                {confirmText}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
