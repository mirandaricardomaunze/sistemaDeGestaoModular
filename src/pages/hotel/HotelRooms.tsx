import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    Card,
    Button,
    EmptyState,
    Input,
    Badge,
    PageHeader,
    Skeleton,
    type BadgeVariant
} from '../../components/ui';
import Pagination from '../../components/ui/Pagination';
import { 
    HospitalityManagement,
    ConsumptionModal,
    CheckInModal,
    CheckoutModal
} from '../../components/hospitality';
import type { Room, Booking } from '../../types';
import { useStore } from '../../stores/useStore';
import { cn } from '../../utils/helpers';
import {
    HiOutlineHome,
    HiOutlineMagnifyingGlass,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineBuildingOffice2,
    HiOutlineUsers,
    HiOutlineSparkles,
    HiOutlineBanknotes,
    HiOutlineCalendar
} from 'react-icons/hi2';
import { useHospitality } from '../../hooks/useData';
import { useDebounce } from '../../hooks/useDebounce';

type RoomView = 'operational' | 'management';

export default function HotelRooms() {
    const { t } = useTranslation();
    const { } = useStore();
    const [activeView, setActiveView] = useState<RoomView>('operational');
    
    // Filters & Search
    const [page, setPage] = useState(1);
    const [pageSize] = useState(12);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'dirty' | 'maintenance'>('all');

    const {
        rooms,
        pagination: roomPaginationMeta,
        isLoading,
        refetch,
        createBooking,
        updateRoom,
        addConsumption
    } = useHospitality({
        search: debouncedSearch,
        status: filter === 'all' ? undefined : filter,
        page,
        limit: pageSize
    });

    // Modals
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<string | null>(null);

    // Handlers
    const handleCheckIn = async (data: Partial<Booking>) => {
        if (!selectedRoom) return;
        try {
            await createBooking({
                roomId: selectedRoom.id,
                ...data,
                checkIn: new Date().toISOString()
            });
            toast.success(t('messages.saveSuccess'));
            setIsCheckInModalOpen(false);
            refetch();
        } catch (err: any) {
            toast.error(err.message || t('messages.errorOccurred'));
        }
    };

    const handleCheckout = (bookingId: string) => {
        setSelectedBookingForCheckout(bookingId);
        setIsCheckoutModalOpen(true);
    };

    const handleCleanRoom = async (roomId: string) => {
        try {
            await updateRoom(roomId, { status: 'available' });
            refetch();
            toast.success(t('hotel_module.housekeeping.inspect'));
        } catch (err) {}
    };

    // Small Components
    const StatusBadge = ({ status }: { status: Room['status'] }) => {
        const variants: Record<Room['status'], BadgeVariant> = {
            available: 'success',
            occupied: 'info',
            dirty: 'warning',
            maintenance: 'danger'
        };
        const label = t(`hotel_module.rooms.statuses.${status}`);
        return <Badge variant={variants[status] || 'default'}>{label}</Badge>;
    };

    const RoomCard = ({ room }: { room: Room }) => {
        const isActive = room.status === 'occupied';
        const activeBooking = room.bookings?.[0];

        return (
            <Card padding="none" className="overflow-hidden group flex flex-col h-full border border-gray-100 dark:border-dark-700 hover:border-primary-500/50 transition-all duration-300">
                {/* Header */}
                <div className={cn(
                    "p-4 flex items-center justify-between",
                    room.status === 'available' ? "bg-green-50/50 dark:bg-green-900/10" :
                        room.status === 'occupied' ? "bg-blue-50/50 dark:bg-blue-900/10" :
                            room.status === 'dirty' ? "bg-amber-50/50 dark:bg-amber-900/10" :
                                "bg-red-50/50 dark:bg-red-900/10"
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                            room.status === 'available' ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                                room.status === 'occupied' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                                    room.status === 'dirty' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                                        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        )}>
                            {room.number}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t(`hotel_module.rooms.types.${room.type}`)}</p>
                            <StatusBadge status={room.status} />
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col gap-4">
                    {isActive && activeBooking ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
                                    <HiOutlineUsers className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-medium uppercase">{t('hotel_module.reservations.guest')}</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[140px]">{activeBooking.customerName}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">{t('hotel_module.reservations.nights')}:</span>
                                <span className="font-bold text-gray-900 dark:text-white">{activeBooking.nightsStayed || 0}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-4 border-2 border-dashed border-gray-100 dark:border-dark-700 rounded-lg opacity-60">
                            <HiOutlineHome className="w-8 h-8 text-gray-300 mb-2" />
                            <p className="text-xs font-medium text-gray-400">{room.status === 'available' ? t('hotel_module.rooms.statuses.available') : t('hotel_module.rooms.statuses.dirty')}</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-gray-50 dark:bg-dark-700/50 border-t border-gray-100 dark:border-dark-700 flex gap-2">
                    {room.status === 'available' && (
                        <Button
                            variant="primary"
                            size="sm"
                            fullWidth
                            leftIcon={<HiOutlinePlus className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                            onClick={() => { setSelectedRoom(room); setIsCheckInModalOpen(true); }}
                        >
                            {t('hotel_module.reservations.checkIn')}
                        </Button>
                    )}
                    {room.status === 'occupied' && activeBooking && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                fullWidth
                                onClick={() => { setSelectedRoom(room); setIsConsumptionModalOpen(true); }}
                            >
                                <HiOutlineSparkles className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                fullWidth
                                leftIcon={<HiOutlineBanknotes className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                                onClick={() => handleCheckout(activeBooking.id)}
                            >
                                {t('hotel_module.reservations.checkOut')}
                            </Button>
                        </>
                    )}
                    {room.status === 'dirty' && (
                        <Button
                            variant="warning"
                            size="sm"
                            fullWidth
                            leftIcon={<HiOutlineSparkles className="w-4 h-4" />}
                            onClick={() => handleCleanRoom(room.id)}
                        >
                            {t('hotel_module.housekeeping.clean')}
                        </Button>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('hotel_module.rooms.title')}
                subtitle={t('hotel_module.rooms.subtitle')}
                icon={<HiOutlineBuildingOffice2 className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <div className="flex gap-3">
                        <Button
                            variant={activeView === 'operational' ? 'primary' : 'ghost'}
                            onClick={() => setActiveView('operational')}
                        >
                            Operacional
                        </Button>
                        <Button
                            variant={activeView === 'management' ? 'primary' : 'ghost'}
                            onClick={() => setActiveView('management')}
                        >
                            Gestão
                        </Button>
                        <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-4 h-4 text-primary-600 dark:text-primary-400" />} onClick={() => refetch()} />
                    </div>
                }
            />

            {activeView === 'operational' ? (
                <>
                    {/* Filters Toolbar */}
                    <Card padding="md" className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'available', 'occupied', 'dirty', 'maintenance'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setFilter(s)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                        filter === s
                                            ? "bg-primary-600 text-white shadow-lg shadow-primary-200 dark:shadow-none"
                                            : "bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600"
                                    )}
                                >
                                    {s === 'all' ? t('common.all') : t(`hotel_module.rooms.statuses.${s}`)}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full md:w-72">
                            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder={t('hotel_module.rooms.searchPlaceholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </Card>

                    {/* Room Grid */}
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <Card key={i} className="h-64 flex flex-col p-0 overflow-hidden border border-gray-100 dark:border-dark-700">
                                    <div className="h-16 bg-gray-50 dark:bg-dark-800 p-4 flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <Skeleton className="w-10 h-10 rounded-lg" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-3 w-16" />
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 space-y-4">
                                        <div className="flex gap-3">
                                            <Skeleton className="w-8 h-8 rounded-full" />
                                            <div className="flex-1 space-y-1">
                                                <Skeleton className="h-2 w-12" />
                                                <Skeleton className="h-4 w-3/4" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-3 w-8" />
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-dark-800/50">
                                        <Skeleton className="h-9 w-full rounded-md" />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : rooms.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {rooms.map((room: Room) => (
                                <RoomCard key={room.id} room={room} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title={t('common.noData')}
                            description={t('hotel_module.rooms.searchPlaceholder')}
                            icon={<HiOutlineCalendar className="w-16 h-16 text-primary-600 dark:text-primary-400" />}
                        />
                    )}

                    {/* Pagination */}
                    {roomPaginationMeta && (
                        <div className="mt-8 flex justify-center">
                            <Pagination
                                currentPage={page}
                                totalItems={roomPaginationMeta.total}
                                itemsPerPage={pageSize}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </>
            ) : (
                <HospitalityManagement />
            )}

            {/* Modals */}
            <CheckInModal
                isOpen={isCheckInModalOpen}
                onClose={() => setIsCheckInModalOpen(false)}
                onCheckIn={handleCheckIn}
                room={selectedRoom}
            />

            <CheckoutModal
                isOpen={isCheckoutModalOpen}
                onClose={() => setIsCheckoutModalOpen(false)}
                bookingId={selectedBookingForCheckout || ''}
                onSuccess={() => { refetch(); setIsCheckoutModalOpen(false); }}
            />

            <ConsumptionModal
                isOpen={isConsumptionModalOpen}
                onClose={() => setIsConsumptionModalOpen(false)}
                onConfirm={async (data) => {
                    const activeBooking = selectedRoom?.bookings?.[0];
                    if (activeBooking) {
                        await addConsumption(activeBooking.id, data);
                        setIsConsumptionModalOpen(false);
                        refetch();
                    }
                }}
            />
        </div>
    );
}
