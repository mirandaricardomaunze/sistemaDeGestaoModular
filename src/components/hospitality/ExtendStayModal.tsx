/**
 * ExtendStayModal Component
 * Allows extending a guest's stay by updating the checkout date
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Input, Card } from '../ui';
import { hospitalityAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
    HiOutlineCalendar,
    HiOutlineCash,
    HiOutlineCheck
} from 'react-icons/hi';

interface ExtendStayModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string | null;
    currentCheckout: string | null;
    roomPrice: number;
    onSuccess?: () => void;
}

export default function ExtendStayModal({
    isOpen,
    onClose,
    bookingId,
    currentCheckout,
    roomPrice,
    onSuccess
}: ExtendStayModalProps) {
    const [newCheckoutDate, setNewCheckoutDate] = useState('');
    const [adjustPrice, setAdjustPrice] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate additional nights and cost
    const currentDate = currentCheckout ? new Date(currentCheckout) : new Date();
    const newDate = newCheckoutDate ? new Date(newCheckoutDate) : null;

    const additionalNights = newDate && currentDate
        ? Math.ceil((newDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const additionalCost = additionalNights > 0 ? additionalNights * roomPrice : 0;

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            // Set minimum date to current checkout or today
            const minDate = currentCheckout
                ? new Date(currentCheckout)
                : new Date();
            minDate.setDate(minDate.getDate() + 1);
            setNewCheckoutDate(minDate.toISOString().split('T')[0]);
            setAdjustPrice(null);
        }
    }, [isOpen, currentCheckout]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!bookingId || !newCheckoutDate) return;

        if (additionalNights <= 0) {
            toast.error('A nova data deve ser posterior à data atual de check-out');
            return;
        }

        setIsSubmitting(true);
        try {
            await hospitalityAPI.extendStay(bookingId, {
                newCheckoutDate,
                adjustPrice: adjustPrice !== null ? adjustPrice : undefined
            });

            toast.success(`Estadia estendida por ${additionalNights} noite${additionalNights > 1 ? 's' : ''}`);
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao estender estadia');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 0 }).format(value) + ' MT';
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Não definido';
        return new Date(dateStr).toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Estender Estadia"
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Current Checkout Info */}
                <Card className="p-4 bg-gray-50 dark:bg-dark-800">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Check-out Actual</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineCalendar className="w-5 h-5 text-gray-400" />
                        {formatDate(currentCheckout)}
                    </p>
                </Card>

                {/* New Checkout Date */}
                <Input
                    label="Nova Data de Check-out"
                    type="date"
                    value={newCheckoutDate}
                    onChange={(e) => setNewCheckoutDate(e.target.value)}
                    min={currentCheckout
                        ? new Date(new Date(currentCheckout).getTime() + 86400000).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]
                    }
                    required
                />

                {/* Preview */}
                {additionalNights > 0 && (
                    <Card className="p-4 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Noites adicionais</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                                +{additionalNights} noite{additionalNights > 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Preço por noite</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {formatCurrency(roomPrice)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-primary-200 dark:border-primary-700">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">Custo adicional</span>
                            <span className="text-lg font-black text-primary-600">
                                +{formatCurrency(additionalCost)}
                            </span>
                        </div>
                    </Card>
                )}

                {/* Optional Price Adjustment */}
                <div>
                    <Input
                        label="Ajustar Preço Total (Opcional)"
                        type="number"
                        placeholder={`Preço calculado: ${formatCurrency(additionalCost)}`}
                        value={adjustPrice !== null ? adjustPrice : ''}
                        onChange={(e) => setAdjustPrice(e.target.value ? parseFloat(e.target.value) : null)}
                        leftIcon={<HiOutlineCash className="w-5 h-5 text-gray-400" />}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Deixe em branco para usar o preço calculado automaticamente
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                        type="button"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        className="flex-1"
                        disabled={isSubmitting || additionalNights <= 0}
                        leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                    >
                        {isSubmitting ? 'Processando...' : 'Confirmar Extensão'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
