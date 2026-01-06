/**
 * ReservationCalendar Component
 * Visual calendar showing room occupancy and future reservations
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Modal, Input, Select, TableContainer } from '../ui';
import { hospitalityAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
    HiOutlineCalendar,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlinePlus,
    HiOutlineRefresh,
    HiOutlineHome,
    HiOutlineUser
} from 'react-icons/hi';

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
    const [currentDate, setCurrentDate] = useState(new Date());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ roomId: string; date: string } | null>(null);

    // Reservation form state
    const [reservationForm, setReservationForm] = useState({
        roomId: '',
        customerName: '',
        guestCount: '1',
        guestPhone: '',
        checkIn: '',
        expectedCheckout: '',
        mealPlan: 'none',
        notes: ''
    });
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
            console.error('Failed to fetch calendar data:', error);
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
            guestCount: '1',
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
            await hospitalityAPI.createReservation({
                roomId: reservationForm.roomId,
                customerName: reservationForm.customerName,
                guestCount: parseInt(reservationForm.guestCount),
                guestPhone: reservationForm.guestPhone || undefined,
                checkIn: reservationForm.checkIn,
                expectedCheckout: reservationForm.expectedCheckout,
                mealPlan: reservationForm.mealPlan,
                notes: reservationForm.notes || undefined
            });

            toast.success('Reserva criada com sucesso!');
            setIsReservationModalOpen(false);
            fetchCalendarData();
            onRefresh?.();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao criar reserva');
        } finally {
            setIsSubmitting(false);
        }
    };

    const monthYear = currentDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                        <HiOutlineCalendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            Calendário de Reservas
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium">
                            {rooms.length} quartos • {bookings.length} reservas este mês
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
                        Hoje
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchCalendarData} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
                        Actualizar
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
                                Quarto
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
                                        {day.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')}
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
                                        <span className="text-xs text-gray-500 ml-1 capitalize">({room.type})</span>
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
                                                    ? `${booking.customerName} (${booking.status === 'checked_in' ? 'Ocupado' : 'Reservado'})`
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
                            <span>Ocupado (Check-in)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 rounded"></div>
                            <span>Reservado</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-4 h-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800"></div>
                            <span>Disponível</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-4 h-4 ring-2 ring-primary-500 rounded"></div>
                            <span>Hoje</span>
                        </div>
                    </div>
                </Card>
            </TableContainer>

            {/* New Reservation Modal */}
            <Modal
                isOpen={isReservationModalOpen}
                onClose={() => setIsReservationModalOpen(false)}
                title="Nova Reserva"
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
                                        Quarto {rooms.find(r => r.id === selectedSlot.roomId)?.number}
                                    </p>
                                    <p className="text-xs text-gray-500 capitalize">
                                        {rooms.find(r => r.id === selectedSlot.roomId)?.type}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Guest Name */}
                    <Input
                        label="Nome do Hóspede"
                        value={reservationForm.customerName}
                        onChange={(e) => setReservationForm({ ...reservationForm, customerName: e.target.value })}
                        required
                        placeholder="Nome completo"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Telefone"
                            value={reservationForm.guestPhone}
                            onChange={(e) => setReservationForm({ ...reservationForm, guestPhone: e.target.value })}
                            placeholder="+258..."
                        />
                        <Input
                            label="Hóspedes"
                            type="number"
                            min="1"
                            value={reservationForm.guestCount}
                            onChange={(e) => setReservationForm({ ...reservationForm, guestCount: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Check-in"
                            type="date"
                            value={reservationForm.checkIn}
                            onChange={(e) => setReservationForm({ ...reservationForm, checkIn: e.target.value })}
                            required
                        />
                        <Input
                            label="Check-out"
                            type="date"
                            value={reservationForm.expectedCheckout}
                            onChange={(e) => setReservationForm({ ...reservationForm, expectedCheckout: e.target.value })}
                            required
                            min={reservationForm.checkIn}
                        />
                    </div>

                    <Select
                        label="Plano de Refeição"
                        options={[
                            { value: 'none', label: 'Sem Refeições' },
                            { value: 'breakfast', label: 'Pequeno-Almoço (BB)' },
                            { value: 'half_board', label: 'Meia Pensão (HB)' },
                            { value: 'full_board', label: 'Pensão Completa (FB)' }
                        ]}
                        value={reservationForm.mealPlan}
                        onChange={(e) => setReservationForm({ ...reservationForm, mealPlan: e.target.value })}
                    />

                    <Input
                        label="Notas / Observações"
                        value={reservationForm.notes}
                        onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })}
                        placeholder="Observações especiais..."
                    />

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t dark:border-dark-700">
                        <Button
                            variant="outline"
                            onClick={() => setIsReservationModalOpen(false)}
                            className="flex-1"
                            type="button"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={isSubmitting}
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            {isSubmitting ? 'Criando...' : 'Criar Reserva'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
