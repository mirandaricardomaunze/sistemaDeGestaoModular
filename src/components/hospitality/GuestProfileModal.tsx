import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Badge, Card, LoadingSpinner } from '../ui';
import { useStore } from '../../stores/useStore';
import { hospitalityAPI } from '../../services/api';
import { generateBookingReceipt } from '../../utils/documentGenerator';
import {
    HiOutlineUser,
    HiOutlineHome,
    HiOutlineCalendar,
    HiOutlinePhone,
    HiOutlineIdentification,
    HiOutlineGlobeAmericas,
    HiOutlineShoppingCart,
    HiOutlineBanknotes,
    HiOutlinePrinter,
    HiOutlineClock,
    HiOutlineArrowRightOnRectangle,
    HiOutlinePlusCircle,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import { formatCurrency as formatC } from '../../utils/helpers';

interface BookingDetails {
    id: string;
    customerName: string;
    guestCount: number;
    guestDocumentType: string;
    guestDocumentNumber: string;
    guestNationality: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string | null;
    expectedCheckout: string | null;
    totalPrice: number;
    mealPlan: string;
    status: string;
    notes: string;
    nightsStayed: number;
    consumptionTotal: number;
    grandTotal: number;
    room: {
        id: string;
        number: string;
        type: string;
        price: number;
    };
    consumptions: Array<{
        id: string;
        quantity: number;
        unitPrice: number;
        total: number;
        createdAt: string;
        product: {
            id: string;
            name: string;
            code: string;
            unit: string;
        };
    }>;
}

interface GuestProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string | null;
    onCheckout?: (bookingId: string) => void;
    onExtendStay?: (bookingId: string) => void;
    onAddConsumption?: (bookingId: string) => void;
}

export default function GuestProfileModal({
    isOpen,
    onClose,
    bookingId,
    onCheckout,
    onExtendStay,
    onAddConsumption
}: GuestProfileModalProps) {
    const { t } = useTranslation();
    const [booking, setBooking] = useState<BookingDetails | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && bookingId) {
            fetchBookingDetails();
        } else {
            setBooking(null);
            setError(null);
        }
    }, [isOpen, bookingId]);

    const fetchBookingDetails = async () => {
        if (!bookingId) return;

        setIsLoading(true);
        setError(null);
        try {
            const data = await hospitalityAPI.getBookingDetails(bookingId);
            setBooking(data);
        } catch (err: any) {
            setError(err.message || t('messages.errorOccurred'));
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return formatC(value);
    };

    const getMealPlanLabel = (plan: string) => {
        switch (plan) {
            case 'none': return t('hotel_module.finance.consumption');
            case 'breakfast': return 'BB';
            case 'half_board': return 'HB';
            case 'full_board': return 'FB';
            default: return plan;
        }
    };

    const { companySettings } = useStore();
    const handlePrint = () => {
        if (booking) {
            generateBookingReceipt(booking as any, companySettings);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={booking ? `${t('hotel_module.guests.title')}: ${booking.customerName}` : t('hotel_module.guests.title')}
            size="xl"
        >
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <LoadingSpinner size="lg" />
                </div>
            ) : error ? (
                <div className="text-center py-10">
                    <p className="text-red-500">{error}</p>
                    <Button
                        onClick={fetchBookingDetails}
                        className="mt-4"
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                    >
                        {t('common.refresh')}
                    </Button>
                </div>
            ) : booking ? (
                <div className="space-y-6">
                    {/* Guest Header */}
                    <div className="flex items-start justify-between bg-gray-50 dark:bg-dark-800 rounded-lg p-5 border border-gray-200 dark:border-dark-700">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                                <HiOutlineUser className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                                    {booking.customerName}
                                </h2>
                                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    {booking.guestPhone && (
                                        <span className="flex items-center gap-1">
                                            <HiOutlinePhone className="w-4 h-4" />
                                            {booking.guestPhone}
                                        </span>
                                    )}
                                    {booking.guestNationality && (
                                        <span className="flex items-center gap-1">
                                            <HiOutlineGlobeAmericas className="w-4 h-4" />
                                            {booking.guestNationality}
                                        </span>
                                    )}
                                    {booking.guestDocumentNumber && (
                                        <span className="flex items-center gap-1">
                                            <HiOutlineIdentification className="w-4 h-4" />
                                            {booking.guestDocumentType}: {booking.guestDocumentNumber}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Badge variant={booking.status === 'checked_in' ? 'info' : 'success'} className="text-sm">
                            {booking.status === 'checked_in' ? t('hotel_module.rooms.statuses.occupied') : t('common.finished')}
                        </Badge>
                    </div>

                    {/* Stay Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 text-center bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                            <HiOutlineHome className="w-5 h-5 mx-auto text-blue-600 mb-2" />
                            <p className="text-xs text-gray-500 uppercase font-bold">{t('hotel_module.rooms.title')}</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">
                                Q-{booking.room.number}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{t(`hotel_module.rooms.types.${booking.room.type}`)}</p>
                        </Card>

                        <Card className="p-4 text-center bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                            <HiOutlineClock className="w-5 h-5 mx-auto text-green-600 mb-2" />
                            <p className="text-xs text-gray-500 uppercase font-bold">{t('hotel_module.reservations.nights')}</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">
                                {booking.nightsStayed}
                            </p>
                            <p className="text-xs text-gray-500">{booking.guestCount} {t('hotel_module.reservations.guest')}(s)</p>
                        </Card>

                        <Card className="p-4 text-center bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                            <HiOutlineCalendar className="w-5 h-5 mx-auto text-purple-600 mb-2" />
                            <p className="text-xs text-gray-500 uppercase font-bold">Check-out</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {booking.expectedCheckout
                                    ? new Date(booking.expectedCheckout).toLocaleDateString(t('common.locale') === 'pt' ? 'pt-PT' : 'en-US')
                                    : t('common.noData')}
                            </p>
                        </Card>

                        <Card className="p-4 text-center bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                            <HiOutlineBanknotes className="w-5 h-5 mx-auto text-amber-600 mb-2" />
                            <p className="text-xs text-gray-500 uppercase font-bold">Plan</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {getMealPlanLabel(booking.mealPlan)}
                            </p>
                        </Card>
                    </div>

                    {/* Financial Summary */}
                    <Card className="p-5">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                            <HiOutlineBanknotes className="w-4 h-4" />
                            {t('hotel_module.finance.revenue')}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-dark-700">
                                <span className="text-gray-600 dark:text-gray-400">{t('hotel_module.rooms.title')} ({booking.nightsStayed} {t('hotel_module.reservations.nights')})</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(booking.totalPrice))}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-dark-700">
                                <span className="text-gray-600 dark:text-gray-400">{t('hotel_module.finance.consumption')} ({booking.consumptions.length} items)</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(booking.consumptionTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-lg font-bold text-gray-900 dark:text-white">TOTAL</span>
                                <span className="text-xl font-black text-primary-600">{formatCurrency(booking.grandTotal)}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Consumptions List */}
                    {booking.consumptions.length > 0 && (
                        <Card className="p-5">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                                <HiOutlineShoppingCart className="w-4 h-4" />
                                {t('hotel_module.finance.consumption')}
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-dark-800 text-xs uppercase text-gray-500">
                                        <tr>
                                            <th className="px-3 py-2 text-left">{t('common.date')}</th>
                                            <th className="px-3 py-2 text-left">{t('inventory.stock.product')}</th>
                                            <th className="px-3 py-2 text-center">Qtd</th>
                                            <th className="px-3 py-2 text-right">Unit</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {booking.consumptions.map((c) => (
                                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                                <td className="px-3 py-2 text-gray-500">
                                                    {new Date(c.createdAt).toLocaleDateString(t('common.locale') === 'pt' ? 'pt-PT' : 'en-US', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                                                    {c.product.name}
                                                </td>
                                                <td className="px-3 py-2 text-center">{c.quantity}</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(Number(c.unitPrice))}</td>
                                                <td className="px-3 py-2 text-right font-bold">{formatCurrency(Number(c.total))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Notes */}
                    {booking.notes && (
                        <Card className="p-4 bg-gray-50 dark:bg-dark-800">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">{t('common.notes')}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{booking.notes}"</p>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button
                            variant="outline"
                            onClick={handlePrint}
                            leftIcon={<HiOutlinePrinter className="w-4 h-4" />}
                        >
                            {t('commercial.sales.receipt')}
                        </Button>
                        {booking.status === 'checked_in' && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => onAddConsumption?.(booking.id)}
                                    leftIcon={<HiOutlinePlusCircle className="w-4 h-4" />}
                                >
                                    {t('hotel_module.finance.consumption')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => onExtendStay?.(booking.id)}
                                    leftIcon={<HiOutlineCalendar className="w-4 h-4" />}
                                >
                                    {t('hotel_module.reservations.checkIn')}
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => onCheckout?.(booking.id)}
                                    leftIcon={<HiOutlineArrowRightOnRectangle className="w-4 h-4" />}
                                    className="ml-auto"
                                >
                                    {t('hotel_module.reservations.checkOut')}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500">
                    {t('common.noData')}
                </div>
            )}
        </Modal>
    );
}

