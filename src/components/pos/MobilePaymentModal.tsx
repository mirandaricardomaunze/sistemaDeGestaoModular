import { useState, useEffect } from 'react';
import { HiOutlineDeviceMobile } from 'react-icons/hi';
import { Button, Input, Modal } from '../ui';
import { formatCurrency, cn } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface MobilePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    provider: 'mpesa' | 'emola';
    onConfirm: (phoneNumber: string) => void;
}

export default function MobilePaymentModal({
    isOpen,
    onClose,
    amount,
    provider,
    onConfirm,
}: MobilePaymentModalProps) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPhoneNumber('');
            setStatus('idle');
            setError('');
        }
    }, [isOpen]);

    const validatePhone = (phone: string) => {
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

        const validationError = validatePhone(phoneNumber);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError('');
        setStatus('processing');

        // Simulate API processing time
        setTimeout(() => {
            setStatus('success');
            toast.success(`Pagamento ${provider === 'mpesa' ? 'M-Pesa' : 'e-Mola'} confirmado!`);

            // Wait a bit to show success state before closing
            setTimeout(() => {
                onConfirm(phoneNumber);
            }, 1500);
        }, 3000);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (status !== 'processing') onClose();
            }}
            title={`Pagamento via ${provider === 'mpesa' ? 'M-Pesa' : 'e-Mola'}`}
            size="sm"
        >
            <div className="space-y-6">
                <div className="flex flex-col items-center justify-center py-4">
                    <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500",
                        provider === 'mpesa' ? "bg-red-100" : "bg-orange-100",
                        status === 'processing' && "animate-pulse scale-110"
                    )}>
                        {status === 'processing' ? (
                            <div className={cn(
                                "w-10 h-10 border-4 border-t-transparent rounded-full animate-spin",
                                provider === 'mpesa' ? "border-red-600" : "border-orange-600"
                            )} />
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
                    <p className="text-sm text-gray-500">
                        {status === 'idle' && "Insira o número para iniciar"}
                        {status === 'processing' && "Aguarde a confirmação no telemóvel..."}
                        {status === 'success' && "Pagamento confirmado com sucesso!"}
                    </p>
                </div>

                {status === 'idle' && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Input
                                label="Número de Telefone"
                                value={phoneNumber}
                                onChange={(e) => {
                                    setPhoneNumber(e.target.value);
                                    setError('');
                                }}
                                placeholder={provider === 'mpesa' ? "84 000 0000" : "86 000 0000"}
                                error={error}
                                maxLength={9}
                                autoFocus
                            />
                            <p className="text-xs text-gray-500 mt-1 ml-1">
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
                            >
                                Pagar
                            </Button>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full text-xs"
                            onClick={() => onConfirm(phoneNumber || 'Manual')}
                        >
                            Confirmar s/ Simulação (Manual)
                        </Button>
                    </form>
                )}

                {status === 'success' && (
                    <div className="text-center pb-4 animate-bounce">
                        <div className="inline-flex items-center justify-center p-2 bg-green-100 text-green-700 rounded-full mb-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-green-600 font-medium">Transação Concluída</p>
                    </div>
                )}
            </div>
        </Modal>
    );
}
