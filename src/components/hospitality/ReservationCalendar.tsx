import { logger } from '../../utils/logger';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Modal, Input, Select, TableContainer } from '../ui';
import { hospitalityAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
    HiOutlineCalendar,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineHome,
    HiOutlineUser,
    HiOutlineGlobeAmericas
} from 'react-icons/hi2';
import { COUNTRIES, getCountryByCode } from '../../config/countries';

interface Room {
    id: string;
    number: string;
    type: string;
    status: string;
    price: number;
}

interface Booking {
    id: string;
    roomId: string;
    customerName: string;
    checkIn: string;
    expectedCheckout: string | null;
    status: string;
    room: {
        number: string;
        type: string;
    };
}

interface ReservationCalendarProps {
    onRefresh?: () => void;
}

export default function ReservationCalendar({ onRefresh }: ReservationCalendarProps) {
    const { t } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ roomId: string; date: string } | null>(null);

    // Reservation form state with international guest support
    const [reservationForm, setReservationForm] = useState({
        roomId: '',
        customerName: '',
        guestEmail: '',
        guestCount: '1',
        guestCountry: 'MZ',
        guestPhone: '',
        checkIn: '',
        expectedCheckout: '',
        mealPlan: 'none',
        notes: ''
    });

    // Get current country for phone dial code
    const selectedCountry = useMemo(() =>
        getCountryByCode(reservationForm.guestCountry) || COUNTRIES[0],
        [reservationForm.guestCountry]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get days in current month view
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days: Date[] = [];
        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }
        return days;
    }, [currentDate]);

    const fetchCalendarData = async () => {
        setIsLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 0).toISOString();

            const data = await hospitalityAPI.getCalendarData({ startDate, endDate });
            setRooms(data.rooms);
            setBookings(data.bookings);
        } catch (error) {
            logger.error('Failed to fetch calendar data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCalendarData();
    }, [currentDate]);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const goToday = () => {
        setCurrentDate(new Date());
    };

    const isDateOccupied = (roomId: string, date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return bookings.some(b => {
            if (b.roomId !== roomId) return false;
            const checkIn = new Date(b.checkIn).toISOString().split('T')[0];
            const checkOut = b.expectedCheckout
                ? new Date(b.expectedCheckout).toISOString().split('T')[0]
                : checkIn;
            return dateStr >= checkIn && dateStr <= checkOut;
        });
    };

    const getBookingForDate = (roomId: string, date: Date): Booking | undefined => {
        const dateStr = date.toISOString().split('T')[0];
        return bookings.find(b => {
            if (b.roomId !== roomId) return false;
            const checkIn = new Date(b.checkIn).toISOString().split('T')[0];
            const checkOut = b.expectedCheckout
                ? new Date(b.expectedCheckout).toISOString().split('T')[0]
                : checkIn;
            return dateStr >= checkIn && dateStr <= checkOut;
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const handleCellClick = (roomId: string, date: Date) => {
        if (isDateOccupied(roomId, date)) return;

        const room = rooms.find(r => r.id === roomId);
        if (!room) return;

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        setSelectedSlot({ roomId, date: date.toISOString().split('T')[0] });
        setReservationForm({
            roomId,
            customerName: '',
            guestEmail: '',
            guestCount: '1',
            guestCountry: 'MZ',
            guestPhone: '',
            checkIn: date.toISOString().split('T')[0],
            expectedCheckout: nextDay.toISOString().split('T')[0],
            mealPlan: 'none',
            notes: ''
        });
        setIsReservationModalOpen(true);
    };

    const handleReservationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Format phone with country dial code
            const formattedPhone = reservationForm.guestPhone
                ? `${selectedCountry.dialCode} ${reservationForm.guestPhone.replace(/^\+?\d{1,4}\s*/, '')}`
                : undefined;

            await hospitalityAPI.createReservation({
                roomId: reservationForm.roomId,
                customerName: reservationForm.customerName,
                guestNationality: reservationForm.guestCountry,
                guestCount: parseInt(reservationForm.guestCount),
                guestPhone: formattedPhone,
                checkIn: reservationForm.checkIn,
                expectedCheckout: reservationForm.expectedCheckout,
                mealPlan: reservationForm.mealPlan,
                notes: reservationForm.notes || undefined
            });

            toast.success(t('messages.saveSuccess'));
            setIsReservationModalOpen(false);
            fetchCalendarData();
            onRefresh?.();
        } catch (error: any) {
            toast.error(error.message || t('messages.errorOccurred'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const monthYear = currentDate.toLocaleDateString(t('common.locale') === 'pt' ? 'pt-PT' : 'en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                        <HiOutlineCalendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            {t('hotel_module.reservations.calendar')}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium">
                            {rooms.length} {t('hotel_module.rooms.title')} • {bookings.length} {t('hotel_module.reservations.title')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={prevMonth}>
                        <HiOutlineChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="px-4 py-2 font-bold text-gray-900 dark:text-white capitalize min-w-[150px] text-center">
                        {monthYear}
                    </span>
                    <Button variant="outline" size="sm" onClick={nextMonth}>
                        <HiOutlineChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={goToday}>
                        {t('common.today')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchCalendarData} leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}>
                        {t('common.refresh')}
                    </Button>
                </div>
            </div>

            {/* Calendar Grid */}
            <TableContainer isLoading={isLoading} minHeight="600px">
                <Card className="p-4 overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Header Row - Days */}
                        <div className="grid" style={{ gridTemplateColumns: `120px repeat(${calendarDays.length}, minmax(40px, 1fr))` }}>
                            <div className="p-2 font-bold text-xs text-gray-500 uppercase border-b border-r dark:border-dark-700">
                                {t('hotel_module.rooms.number')}
                            </div>
                            {calendarDays.map((day, i) => (
                                <div
                                    key={i}
                                    className={`p-1 text-center text-xs font-bold border-b dark:border-dark-700 ${isToday(day)
                                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                                        : 'text-gray-500'
                                        }`}
                                >
                                    <div>{day.getDate()}</div>
                                    <div className="text-[9px] uppercase">
                                        {day.toLocaleDateString(t('common.locale') === 'pt' ? 'pt-PT' : 'en-US', { weekday: 'short' }).replace('.', '')}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Room Rows */}
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                className="grid"
                                style={{ gridTemplateColumns: `120px repeat(${calendarDays.length}, minmax(40px, 1fr))` }}
                            >
                                {/* Room Info */}
                                <div className="p-2 border-b border-r dark:border-dark-700 flex items-center gap-2">
                                    <HiOutlineHome className="w-4 h-4 text-gray-400" />
                                    <div>
                                        <span className="font-bold text-gray-900 dark:text-white">Q-{room.number}</span>
                                        <span className="text-xs text-gray-500 ml-1 capitalize">({t(`hotel_module.rooms.types.${room.type}`) || room.type})</span>
                                    </div>
                                </div>

                                {/* Day Cells */}
                                {calendarDays.map((day, i) => {
                                    const booking = getBookingForDate(room.id, day);
                                    const occupied = !!booking;
                                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                                    const isCheckInDay = booking && new Date(booking.checkIn).toDateString() === day.toDateString();

                                    return (
                                        <div
                                            key={i}
                                            className={`p-1 min-h-[40px] border-b dark:border-dark-700 cursor-pointer transition-all ${occupied
                                                ? booking.status === 'checked_in'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                                    : 'bg-amber-100 dark:bg-amber-900/30'
                                                : isPast
                                                    ? 'bg-gray-50 dark:bg-dark-800'
                                                    : 'hover:bg-green-50 dark:hover:bg-green-900/20'
                                                } ${isToday(day) ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
                                            onClick={() => !isPast && handleCellClick(room.id, day)}
                                            title={
                                                occupied
                                                    ? `${booking.customerName} (${booking.status === 'checked_in' ? t('hotel_module.rooms.statuses.occupied') : t('hotel_module.rooms.statuses.reserved')})`
                                                    : isPast
                                                        ? 'Data passada'
                                                        : 'Clique para reservar'
                                            }
                                        >
                                            {isCheckInDay && booking && (
                                                <div className="text-[9px] font-bold text-gray-700 dark:text-gray-300 truncate flex items-center gap-0.5">
                                                    <HiOutlineUser className="w-2.5 h-2.5" />
                                                    {booking.customerName.split(' ')[0]}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t dark:border-dark-700">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 rounded"></div>
                            <span>{t('hotel_module.rooms.statuses.occupied')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 rounded"></div>
                            <span>{t('hotel_module.rooms.statuses.reserved')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-4 h-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800"></div>
                            <span>{t('hotel_module.rooms.statuses.available')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-4 h-4 ring-2 ring-primary-500 rounded"></div>
                            <span>{t('common.today')}</span>
                        </div>
                    </div>
                </Card>
            </TableContainer>

            {/* New Reservation Modal */}
            <Modal
                isOpen={isReservationModalOpen}
                onClose={() => setIsReservationModalOpen(false)}
                title={t('hotel_module.reservations.new')}
                size="md"
            >
                <form onSubmit={handleReservationSubmit} className="space-y-4">
                    {/* Selected Room Display */}
                    {selectedSlot && (
                        <Card className="p-3 bg-gray-50 dark:bg-dark-800">
                            <div className="flex items-center gap-3">
                                <HiOutlineHome className="w-5 h-5 text-primary-600" />
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {t('hotel_module.rooms.number')} {rooms.find(r => r.id === selectedSlot.roomId)?.number}
                                    </p>
                                    <p className="text-xs text-gray-500 capitalize">
                                        {t(`hotel_module.rooms.types.${rooms.find(r => r.id === selectedSlot.roomId)?.type}`)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Guest Name */}
                    <Input
                        label={t('hotel_module.reservations.guest')}
                        value={reservationForm.customerName}
                        onChange={(e) => setReservationForm({ ...reservationForm, customerName: e.target.value })}
                        required
                        placeholder={t('auth.fullName')}
                    />

                    {/* Email */}
                    <Input
                        label="Email"
                        type="email"
                        value={reservationForm.guestEmail}
                        onChange={(e) => setReservationForm({ ...reservationForm, guestEmail: e.target.value })}
                        placeholder="email@example.com"
                    />

                    {/* Country and Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                <HiOutlineGlobeAmericas className="w-4 h-4 inline mr-1" />
                                {t('hotel_module.guests.nationality')}
                            </label>
                            <select
                                value={reservationForm.guestCountry}
                                onChange={(e) => setReservationForm({ ...reservationForm, guestCountry: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                {COUNTRIES.map(country => (
                                    <option key={country.code} value={country.code}>
                                        {country.flag} {country.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('auth.phone')}
                            </label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 dark:bg-dark-600 border border-r-0 border-gray-300 dark:border-dark-600 rounded-l-lg">
                                    {selectedCountry.flag} {selectedCountry.dialCode}
                                </span>
                                <input
                                    type="tel"
                                    value={reservationForm.guestPhone}
                                    onChange={(e) => setReservationForm({ ...reservationForm, guestPhone: e.target.value })}
                                    placeholder="84 123 4567"
                                    className="flex-1 px-3 py-2 rounded-r-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Guest Count and Dates */}
                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label={t('hotel_module.reservations.nights')}
                            type="number"
                            min="1"
                            value={reservationForm.guestCount}
                            onChange={(e) => setReservationForm({ ...reservationForm, guestCount: e.target.value })}
                        />
                        <Input
                            label={t('hotel_module.reservations.checkIn')}
                            type="date"
                            value={reservationForm.checkIn}
                            onChange={(e) => setReservationForm({ ...reservationForm, checkIn: e.target.value })}
                            required
                        />
                        <Input
                            label={t('hotel_module.reservations.checkOut')}
                            type="date"
                            value={reservationForm.expectedCheckout}
                            onChange={(e) => setReservationForm({ ...reservationForm, expectedCheckout: e.target.value })}
                            required
                            min={reservationForm.checkIn}
                        />
                    </div>

                    <Select
                        label={t('hotel_module.finance.services')}
                        options={[
                            { value: 'none', label: t('hotel_module.finance.consumption') },
                            { value: 'breakfast', label: 'Breakfast (BB)' },
                            { value: 'half_board', label: 'Half Board (HB)' },
                            { value: 'full_board', label: 'Full Board (FB)' }
                        ]}
                        value={reservationForm.mealPlan}
                        onChange={(e) => setReservationForm({ ...reservationForm, mealPlan: e.target.value })}
                    />

                    <Input
                        label={t('common.notes')}
                        value={reservationForm.notes}
                        onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })}
                        placeholder="..."
                    />


                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t dark:border-dark-700">
                        <Button
                            variant="outline"
                            onClick={() => setIsReservationModalOpen(false)}
                            className="flex-1"
                            type="button"
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={isSubmitting}
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            {isSubmitting ? t('common.saving') : t('common.save')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
