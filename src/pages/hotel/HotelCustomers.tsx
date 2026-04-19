import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, TableContainer, Card, Badge, Button, Input } from '../../components/ui';
import { GuestProfileModal } from '../../components/hospitality';
import { hospitalityAPI } from '../../services/api';
import { logger } from '../../utils/logger';
import { HiOutlineUsers, HiOutlineMagnifyingGlass, HiOutlineEye, HiOutlineArrowPath } from 'react-icons/hi2';

export default function HotelCustomers() {
    const { t } = useTranslation();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const loadGuests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await hospitalityAPI.getBookings({ limit: 50 });
            if (res?.data) {
                setBookings(res.data);
            }
        } catch (err) {
            logger.error('Error loading guests:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGuests();
    }, [loadGuests]);

    const filteredGuests = bookings.filter(b => 
        b.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.guestPhone?.includes(searchTerm) ||
        b.room?.number?.includes(searchTerm)
    );

    const openProfile = (id: string) => {
        setSelectedBookingId(id);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('hotel_module.guests.title')}
                subtitle={t('hotel_module.guests.profile')}
                icon={<HiOutlineUsers />}
                actions={
                    <Button
                        variant="outline"
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                        onClick={loadGuests}
                    >
                        {t('common.refresh')}
                    </Button>
                }
            />

            <Card className="p-4">
                <div className="max-w-md">
                    <Input
                        placeholder={t('hotel_module.reservations.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4" />}
                    />
                </div>
            </Card>

            <TableContainer
                isLoading={loading}
                isEmpty={filteredGuests.length === 0}
                emptyTitle={t('common.noData')}
            >
                <Card padding="none" className="overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('hotel_module.guests.title')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('hotel_module.rooms.title')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {filteredGuests.map((booking) => (
                                <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{booking.customerName}</p>
                                            <p className="text-xs text-gray-500">{booking.guestPhone || ''}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="info">
                                            Q-{booking.room?.number}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={booking.status === 'checked_in' ? 'info' : 'success'}>
                                            {booking.status === 'checked_in' ? t('hotel_module.rooms.statuses.occupied') : t('common.finished')}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            leftIcon={<HiOutlineEye className="w-4 h-4" />}
                                            onClick={() => openProfile(booking.id)}
                                        >
                                            {t('common.view')}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            </TableContainer>

            <GuestProfileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                bookingId={selectedBookingId}
            />
        </div>
    );
}
