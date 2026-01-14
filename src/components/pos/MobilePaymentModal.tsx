/**
 * Mobile Payment Modal Component
 * Supports M-Pesa and e-Mola payments with real API integration
 */

import { useState, useEffect } from 'react';
import { HiOutlineDeviceMobile, HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi';
import { Button, Input, Modal } from '../ui';
import { formatCurrency, cn } from '../../utils/helpers';
import { useMpesaPayment } from '../../hooks/useMpesaPayment';
import type { PaymentModule } from '../../services/api';

interface MobilePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    provider: 'mpesa' | 'emola';
    onConfirm: (phoneNumber: string) => void;
    // Optional: for tracking payments to specific module/reference
    module?: PaymentModule;
    moduleReferenceId?: string;
    reference?: string;
}

export default function MobilePaymentModal({
    isOpen,
    onClose,
    amount,
    provider,
    onConfirm,
    module = 'pos',
    moduleReferenceId,
    reference,
}: MobilePaymentModalProps) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [validationError, setValidationError] = useState('');

    // Use M-Pesa hook for M-Pesa payments
    const mpesa = useMpesaPayment({
        module,
        onSuccess: () => {
            // Wait a bit to show success state before closing
            setTimeout(() => {
                onConfirm(phoneNumber);
            }, 1500);
        },
    });

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setPhoneNumber('');
            setValidationError('');
            mpesa.reset();
        }
    }, [isOpen]);

    // Determine current status for UI
    const getStatus = (): 'idle' | 'processing' | 'success' | 'error' => {
        if (mpesa.status === 'completed') return 'success';
        if (mpesa.status === 'failed') return 'error';
        if (mpesa.isLoading || mpesa.isProcessing) return 'processing';
        return 'idle';
    };

    const status = getStatus();

    const validatePhone = (phone: string): string | null => {
        const cleanPhone = phone.replace(/\D/g, '');

        if (cleanPhone.length !== 9) {
            return 'O número deve ter 9 dígitos';
        }

        const prefix = cleanPhone.substring(0, 2);

        if (provider === 'mpesa') {
            if (!['84', '85'].includes(prefix)) {
                return 'Para M-Pesa, use um número Vodacom (84/85)';
            }
        } else if (provider === 'emola') {
            if (!['86', '87'].includes(prefix)) {
                return 'Para e-Mola, use um número Movitel (86/87)';
            }
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const error = validatePhone(phoneNumber);
        if (error) {
            setValidationError(error);
            return;
        }

        setValidationError('');

        if (provider === 'mpesa') {
            // Use real M-Pesa API
            await mpesa.initiatePayment({
                phone: phoneNumber,
                amount,
                reference: reference || `POS-${Date.now()}`,
                moduleReferenceId,
            });
        } else {
            // e-Mola: simulate for now (can be extended later)
            setTimeout(() => {
                onConfirm(phoneNumber);
            }, 2000);
        }
    };

    const handleCancel = () => {
        if (mpesa.isProcessing) {
            mpesa.cancelPayment();
        }
        onClose();
    };

    const handleManualConfirm = () => {
        onConfirm(phoneNumber || 'Manual');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (status !== 'processing') handleCancel();
            }}
            title={`Pagamento via ${provider === 'mpesa' ? 'M-Pesa' : 'e-Mola'}`}
            size="sm"
        >
            <div className="space-y-6">
                {/* Header with Icon and Amount */}
                <div className="flex flex-col items-center justify-center py-4">
                    <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500",
                        provider === 'mpesa' ? "bg-red-100 dark:bg-red-900/30" : "bg-orange-100 dark:bg-orange-900/30",
                        status === 'processing' && "animate-pulse scale-110"
                    )}>
                        {status === 'processing' ? (
                            <div className={cn(
                                "w-10 h-10 border-4 border-t-transparent rounded-full animate-spin",
                                provider === 'mpesa' ? "border-red-600" : "border-orange-600"
                            )} />
                        ) : status === 'success' ? (
                            <HiOutlineCheckCircle className="w-12 h-12 text-green-600" />
                        ) : status === 'error' ? (
                            <HiOutlineXCircle className="w-12 h-12 text-red-600" />
                        ) : (
                            <HiOutlineDeviceMobile className={cn(
                                "w-10 h-10",
                                provider === 'mpesa' ? "text-red-600" : "text-orange-600"
                            )} />
                        )}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(amount)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {status === 'idle' && "Insira o número para iniciar"}
                        {status === 'processing' && "Aguarde a confirmação no telemóvel..."}
                        {status === 'success' && "Pagamento confirmado com sucesso!"}
                        {status === 'error' && (mpesa.error || "Erro no pagamento")}
                    </p>

                    {/* Simulated mode badge */}
                    {mpesa.isSimulated && status === 'success' && (
                        <span className="mt-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                            🧪 Modo Sandbox
                        </span>
                    )}
                </div>

                {/* Form - only show when idle */}
                {status === 'idle' && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Input
                                label="Número de Telefone"
                                value={phoneNumber}
                                onChange={(e) => {
                                    setPhoneNumber(e.target.value);
                                    setValidationError('');
                                }}
                                placeholder={provider === 'mpesa' ? "84 000 0000" : "86 000 0000"}
                                error={validationError}
                                maxLength={9}
                                autoFocus
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1">
                                {provider === 'mpesa' ? "Rede Vodacom (84/85)" : "Rede Movitel (86/87)"}
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="flex-1"
                                onClick={onClose}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                className={cn(
                                    "flex-1 text-white",
                                    provider === 'mpesa'
                                        ? "bg-red-600 hover:bg-red-700"
                                        : "bg-orange-500 hover:bg-orange-600"
                                )}
                                disabled={mpesa.isLoading}
                            >
                                {mpesa.isLoading ? 'Iniciando...' : 'Pagar'}
                            </Button>
                        </div>

                        {/* Manual confirm for testing */}
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full text-xs"
                            onClick={handleManualConfirm}
                        >
                            Confirmar Manual (Bypass)
                        </Button>
                    </form>
                )}

                {/* Processing state */}
                {status === 'processing' && (
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Foi enviado um pedido para o número <strong>{phoneNumber}</strong>
                        </p>
                        <Button
                            variant="ghost"
                            onClick={handleCancel}
                            className="text-sm"
                        >
                            Cancelar
                        </Button>
                    </div>
                )}

                {/* Success state */}
                {status === 'success' && (
                    <div className="text-center pb-4">
                        <div className="inline-flex items-center justify-center p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full mb-3 animate-bounce">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-green-600 dark:text-green-400 font-medium text-lg">
                            Transação Concluída
                        </p>
                    </div>
                )}

                {/* Error state */}
                {status === 'error' && (
                    <div className="text-center pb-4">
                        <Button
                            onClick={() => mpesa.reset()}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Tentar Novamente
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
