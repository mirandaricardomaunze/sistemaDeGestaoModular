/**
 * Hotel Reservations (Reservas)
 * 
 * Reservations calendar and management
 */

import ReservationCalendar from '../../components/hospitality/ReservationCalendar';
import { useHospitality } from '../../hooks/useData';

export default function HotelReservations() {
    const { refetch } = useHospitality();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Reservas
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Calendário e gestão de reservas
                </p>
            </div>

            <ReservationCalendar onRefresh={() => refetch()} />
        </div>
    );
}
