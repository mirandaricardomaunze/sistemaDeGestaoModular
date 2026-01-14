/**
 * CheckoutModal Component
 * Handles guest checkout with payment method selection (Cash, Card, M-Pesa, etc.)
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Select, LoadingSpinner, Card } from '../ui';
import { hospitalityAPI } from '../../services/api';
import { formatCurrency, cn } from '../../utils/helpers';
import { HiOutlineCash, HiOutlineCheckCircle } from 'react-icons/hi';
import MobilePaymentModal from '../pos/MobilePaymentModal';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string | null;
    onSuccess: () => void;
}

interface BookingTotal {
    id: string;
    customerName: string;
    grandTotal: number;
    room: {
        number: string;
    };
}

export default function CheckoutModal({
    isOpen,
    onClose,
    bookingId,
    onSuccess
}: CheckoutModalProps) {
    const [booking, setBooking] = useState<BookingTotal | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [showMpesaModal, setShowMpesaModal] = useState(false);

    useEffect(() => {
        if (isOpen && bookingId) {
            fetchBookingSummary();
        } else {
            setBooking(null);
            setPaymentMethod('cash');
        }
    }, [isOpen, bookingId]);

    const fetchBookingSummary = async () => {
        if (!bookingId) return;
        setIsLoading(true);
        try {
            const data = await hospitalityAPI.getBookingDetails(bookingId);
            setBooking(data);
        } catch (err) {
            console.error('Error fetching booking summary:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckout = async () => {
        if (!bookingId) return;

        if (paymentMethod === 'mpesa') {
            setShowMpesaModal(true);
            return;
        }

        setIsSubmitting(true);
        try {
            await hospitalityAPI.checkout(bookingId, {
                paymentMethod,
                amount: booking?.grandTotal || 0,
            });
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error during checkout:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const paymentMethods = [
        { value: 'cash', label: 'Dinheiro' },
        { value: 'card', label: 'Cartão de Débito/Crédito' },
        { value: 'transfer', label: 'Transferência Bancária' },
        { value: 'mpesa', label: 'M-Pesa' },
        { value: 'emola', label: 'e-Mola' },
    ];

    return (
        <>
            <Modal
                isOpen={isOpen && !showMpesaModal}
                onClose={onClose}
                title="Finalizar Estadia (Checkout)"
                size="md"
            >
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : booking ? (
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Hóspede</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">{booking.customerName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Quarto</p>
                                    <p className="text-lg font-bold text-primary-600">Q-{booking.room.number}</p>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-gray-200 dark:border-dark-700 flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total a Pagar</span>
                                <span className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(booking.grandTotal)}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Select
                                label="Método de Pagamento"
                                options={paymentMethods}
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            />

                            <Card className="p-4 bg-primary-50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-800">
                                <p className="text-xs text-primary-700 dark:text-primary-300 flex items-center gap-2">
                                    <HiOutlineCheckCircle className="w-4 h-4" />
                                    Ao confirmar, o quarto será marcado como "Para Limpeza" e a estadia será encerrada.
                                </p>
                            </Card>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                            <Button variant="ghost" fullWidth onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={handleCheckout}
                                isLoading={isSubmitting}
                                leftIcon={<HiOutlineCash className="w-5 h-5" />}
                            >
                                Confirmar e Pagar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        Erro ao carregar dados do booking.
                    </div>
                )}
            </Modal>

            {/* M-Pesa Modal integration */}
            {booking && (
                <MobilePaymentModal
                    isOpen={showMpesaModal}
                    onClose={() => setShowMpesaModal(false)}
                    amount={booking.grandTotal}
                    provider="mpesa"
                    module="hospitality"
                    moduleReferenceId={booking.id}
                    reference={`CHK-${booking.room.number}-${Date.now()}`}
                    onConfirm={(phone) => {
                        onSuccess();
                        onClose();
                        setShowMpesaModal(false);
                    }}
                />
            )}
        </>
    );
}
