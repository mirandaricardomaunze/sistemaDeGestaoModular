import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/helpers';
import { HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineTrash, HiOutlineCheck, HiOutlineXMark } from 'react-icons/hi2';
import { Button } from './Button';

type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'success' | 'primary';

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
    disabled?: boolean;
    children?: React.ReactNode;
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
    disabled = false,
    children,
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
            icon: HiOutlineExclamationTriangle,
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
        success: {
            icon: HiOutlineCheck,
            iconBg: 'bg-green-100 dark:bg-green-900/30',
            iconColor: 'text-green-600 dark:text-green-400',
            confirmVariant: 'success' as const,
        },
        primary: {
            icon: HiOutlineInformationCircle,
            iconBg: 'bg-primary-100 dark:bg-primary-900/30',
            iconColor: 'text-primary-600 dark:text-primary-400',
            confirmVariant: 'primary' as const,
        },
    };

    const config = variantConfig[variant];
    const Icon = config.icon;

    const handleConfirm = async () => {
        await onConfirm();
    };

    const content = (
        <div className="fixed inset-0 z-[10100] overflow-y-auto">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={!isLoading ? onClose : undefined}
            />

            {/* Modal Container — bottom sheet on mobile, centered card on >= sm */}
            <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
                <div
                    className="relative w-full sm:max-w-md bg-white dark:bg-dark-800 rounded-t-2xl sm:rounded-2xl border border-slate-300/70 dark:border-white/10 shadow-card-hover animate-slide-up"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Content */}
                    <div className="p-5 sm:p-6">
                        {/* Icon */}
                        <div className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4',
                            config.iconBg
                        )}>
                            <Icon className={cn('w-6 h-6', config.iconColor)} />
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-slate-950 dark:text-white text-center mb-2">
                            {title}
                        </h3>

                        {/* Message */}
                        <p className="text-sm text-slate-600 dark:text-gray-400 text-center mb-6">
                            {message}
                        </p>

                        {children}

                        {/* Actions */}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
                            {cancelText && (
                                <Button
                                    variant="ghost"
                                    className="w-full sm:flex-1"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    leftIcon={<HiOutlineXMark className="w-4 h-4" />}
                                >
                                    {cancelText}
                                </Button>
                            )}
                            <Button
                                variant={config.confirmVariant}
                                className="w-full sm:flex-1"
                                onClick={handleConfirm}
                                isLoading={isLoading}
                                disabled={isLoading || disabled}
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

    return createPortal(content, document.body);
}
