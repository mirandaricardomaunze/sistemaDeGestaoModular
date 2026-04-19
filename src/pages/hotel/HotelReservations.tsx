import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Button } from '../../components/ui';
import { ReservationCalendar, HospitalityHistory } from '../../components/hospitality';
import { useHospitality } from '../../hooks/useData';
import { logger } from '../../utils/logger';
import { HiOutlineCalendar, HiOutlineListBullet, HiOutlineArrowPath } from 'react-icons/hi2';

type ReservationView = 'calendar' | 'list';

export default function HotelReservations() {
    const { t } = useTranslation();
    const [view, setView] = useState<ReservationView>('calendar');
    
    // History State (for List View)
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize] = useState(10);
    const [bookingHistory, setBookingHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const { refetch, fetchBookings } = useHospitality();

    const loadHistory = useCallback(async () => {
        if (view !== 'list') return;
        setHistoryLoading(true);
        try {
            const res = await fetchBookings({ page: historyPage, limit: historyPageSize });
            if (res?.data) setBookingHistory(res.data);
        } catch (err) {
            logger.error('Error fetching history:', err);
        } finally {
            setHistoryLoading(false);
        }
    }, [view, historyPage, historyPageSize, fetchBookings]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('hotel_module.reservations.title')}
                subtitle={t('hotel_module.reservations.calendar')}
                icon={<HiOutlineCalendar />}
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant={view === 'calendar' ? 'primary' : 'ghost'}
                            leftIcon={<HiOutlineCalendar className="w-4 h-4" />}
                            onClick={() => setView('calendar')}
                        >
                            {t('hotel_module.reservations.calendar')}
                        </Button>
                        <Button
                            variant={view === 'list' ? 'primary' : 'ghost'}
                            leftIcon={<HiOutlineListBullet className="w-4 h-4" />}
                            onClick={() => setView('list')}
                        >
                            Lista
                        </Button>
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                            onClick={() => { refetch(); loadHistory(); }}
                        />
                    </div>
                }
            />

            {view === 'calendar' ? (
                <ReservationCalendar onRefresh={refetch} />
            ) : (
                <HospitalityHistory 
                    history={bookingHistory} 
                    isLoading={historyLoading} 
                />
            )}
        </div>
    );
}
