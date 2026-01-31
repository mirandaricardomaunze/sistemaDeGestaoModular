import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    Card,
    Button,
    LoadingSpinner,
    EmptyState,
    Input,
    Badge,
    useStepper,
    ConfirmationModal,
} from '../components/ui';
import Pagination from '../components/ui/Pagination';
import {
    HospitalityDashboard,
    HospitalityHistory,
    HospitalityManagement,
    GuestProfileModal,
    HousekeepingPanel,
    ReservationCalendar,
    RoomFormModal,
    ConsumptionModal,
    CheckInModal,
    CheckoutModal,
    CheckoutNotifications
} from '../components/hospitality';
import { ExportBookingsButton, ExportRoomsButton } from '../components/common/ExportButton';
import { cn } from '../utils/helpers';
import {
    HiOutlineCheck,
    HiOutlineSearch,
    HiOutlineHome,
    HiOutlineCalendar,
    HiOutlineSparkles,
    HiOutlineClipboardList,
    HiOutlineCog,
    HiOutlineChartBar,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineUsers,
    HiOutlinePlus,
    HiOutlineRefresh,
    HiOutlineUserAdd,
} from 'react-icons/hi';
import { useHospitality } from '../hooks/useData';
import { useSmartInsights } from '../hooks/useSmartInsights';
import { SmartInsightCard } from '../components/common/SmartInsightCard';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { useDebounce } from '../hooks/useDebounce';


type MainTab = 'rooms' | 'history' | 'management' | 'dashboard' | 'housekeeping' | 'calendar';

export default function Hospitality() {
    const [searchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as MainTab) || 'rooms';
    const [activeMainTab, setActiveMainTab] = useState<MainTab>(initialTab);

    // Pagination and Filter State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'dirty' | 'maintenance'>('all');

    const tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
        { id: 'rooms', label: 'Quartos', icon: <HiOutlineHome className="w-5 h-5" /> },
        { id: 'calendar', label: 'Calendário', icon: <HiOutlineCalendar className="w-5 h-5" /> },
        { id: 'housekeeping', label: 'Limpeza', icon: <HiOutlineSparkles className="w-5 h-5" /> },
        { id: 'history', label: 'Histórico', icon: <HiOutlineClipboardList className="w-5 h-5" /> },
        { id: 'management', label: 'Configuração', icon: <HiOutlineCog className="w-5 h-5" /> },
        { id: 'dashboard', label: 'Estatísticas', icon: <HiOutlineChartBar className="w-5 h-5" /> },
    ];

    useTranslation();
    const {
        rooms,
        bookings: bookingHistory,
        pagination: roomPaginationMeta,
        metrics,
        isLoading,
        refetch,
        fetchBookings,
        createBooking,
        addRoom,
        updateRoom,
        deleteRoom,
        addConsumption
    } = useHospitality({
        search: debouncedSearch,
        status: filter === 'all' ? undefined : filter,
        page,
        limit: pageSize
    });

    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
    const [isGuestProfileModalOpen, setIsGuestProfileModalOpen] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [deleteRoomConfirmOpen, setDeleteRoomConfirmOpen] = useState(false);
    const { insights } = useSmartInsights();
    const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<string | null>(null);
    const [selectedRoomForDelete, setSelectedRoomForDelete] = useState<string | null>(null);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

    // History Pagination
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);
    const [historyMeta, setHistoryMeta] = useState<any>(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [editingRoom, setEditingRoom] = useState<any>(null);

    // Check-in multi-step state
    const checkInSteps = [
        ...(!selectedRoom ? [{ id: 'room-select', label: 'Quarto', icon: <HiOutlineHome className="w-4 h-4" /> }] : []),
        { id: 'form', label: 'Hóspede', icon: <HiOutlineClipboardList className="w-4 h-4" /> },
        { id: 'confirm', label: 'Confirmação', icon: <HiOutlineCheck className="w-4 h-4" /> }
    ];

    const checkInStepper = useStepper(checkInSteps.length);

    const [checkInData, setCheckInData] = useState({
        customerName: '',
        guestCount: '1',
        guestDocumentType: 'BI',
        guestDocumentNumber: '',
        guestNationality: 'Moçambicana',
        guestPhone: '',
        checkOutDate: '',
        totalPrice: '',
        mealPlan: 'none' as 'none' | 'breakfast' | 'half_board' | 'full_board',
        notes: ''
    });

    const [roomFormData, setRoomFormData] = useState({
        number: '',
        type: 'single',
        price: '',
        priceNoMeal: '',
        priceBreakfast: '',
        priceHalfBoard: '',
        priceFullBoard: '',
        notes: ''
    });

    const [consumptionData, setConsumptionData] = useState({
        productId: '',
        quantity: 1
    });
    const fetchHistory = useCallback(async (p = historyPage) => {
        setHistoryLoading(true);
        try {
            const res = await fetchBookings({ page: p, limit: historyPageSize });
            if (res?.pagination) setHistoryMeta(res.pagination);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setHistoryLoading(false);
        }
    }, [fetchBookings, historyPageSize]);

    // Fetch history when tab or page changes
    useEffect(() => {
        if (activeMainTab === 'history') {
            fetchHistory(historyPage);
        }
    }, [activeMainTab, historyPage, fetchHistory]);

    const handleCheckIn = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedRoom || !checkInData.customerName) return;

        try {
            await createBooking({
                roomId: selectedRoom.id,
                customerId: null,
                customerName: checkInData.customerName,
                guestCount: parseInt(checkInData.guestCount),
                guestDocumentType: checkInData.guestDocumentType,
                guestDocumentNumber: checkInData.guestDocumentNumber,
                guestNationality: checkInData.guestNationality,
                guestPhone: checkInData.guestPhone,
                checkIn: new Date().toISOString(),
                checkOut: checkInData.checkOutDate ? new Date(checkInData.checkOutDate).toISOString() : null,
                totalPrice: parseFloat(checkInData.totalPrice) || null,
                mealPlan: checkInData.mealPlan,
                notes: checkInData.notes
            });
            toast.success('Check-in realizado com sucesso!');
            setIsCheckInModalOpen(false);
            checkInStepper.reset();
            setCheckInData({
                customerName: '',
                guestCount: '1',
                guestDocumentType: 'BI',
                guestDocumentNumber: '',
                guestNationality: 'Moçambicana',
                guestPhone: '',
                checkOutDate: '',
                totalPrice: '',
                mealPlan: 'none',
                notes: ''
            });
            refetch();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao realizar check-in');
        }
    };

    const handleCheckout = async (bookingId: string) => {
        setSelectedBookingForCheckout(bookingId);
        setIsCheckoutModalOpen(true);
    };

    const performCheckout = async () => {
        refetch();
        setIsCheckoutModalOpen(false);
        setSelectedBookingForCheckout(null);
    };

    const handleRoomSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                number: roomFormData.number,
                type: roomFormData.type,
                price: parseFloat(roomFormData.price),
                priceNoMeal: roomFormData.priceNoMeal ? parseFloat(roomFormData.priceNoMeal) : null,
                priceBreakfast: roomFormData.priceBreakfast ? parseFloat(roomFormData.priceBreakfast) : null,
                priceHalfBoard: roomFormData.priceHalfBoard ? parseFloat(roomFormData.priceHalfBoard) : null,
                priceFullBoard: roomFormData.priceFullBoard ? parseFloat(roomFormData.priceFullBoard) : null,
                notes: roomFormData.notes
            };
            if (editingRoom) {
                await updateRoom(editingRoom.id, data);
            } else {
                await addRoom(data);
            }
            setIsRoomModalOpen(false);
            setEditingRoom(null);
            setRoomFormData({ number: '', type: 'single', price: '', priceNoMeal: '', priceBreakfast: '', priceHalfBoard: '', priceFullBoard: '', notes: '' });
        } catch (err) { }
    };

    const handleConsumptionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeBooking = selectedRoom?.bookings?.[0];
        if (!activeBooking) return;
        try {
            await addConsumption(activeBooking.id, {
                productId: consumptionData.productId,
                quantity: consumptionData.quantity
            });
            setIsConsumptionModalOpen(false);
            setConsumptionData({ productId: '', quantity: 1 });
        } catch (err) { }
    };

    const handleDeleteRoom = async (id: string) => {
        setSelectedRoomForDelete(id);
        setDeleteRoomConfirmOpen(true);
    };

    const performDeleteRoom = async () => {
        if (!selectedRoomForDelete) return;
        try {
            await deleteRoom(selectedRoomForDelete);
            setDeleteRoomConfirmOpen(false);
            setSelectedRoomForDelete(null);
        } catch (err) { }
    };



    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'available': return 'LIVRE';
            case 'occupied': return 'OCUPADO';
            case 'dirty': return 'LIMPEZA';
            case 'maintenance': return 'MANUTENÇÃO';
            default: return status.toUpperCase();
        }
    };

    const handleCleanRoom = async (roomId: string) => {
        try {
            await updateRoom(roomId, { status: 'available' });
            refetch();
        } catch (err) { }
    };


    const handleSaveRoom = (e: React.FormEvent) => handleRoomSubmit(e);

    const filteredRooms = rooms;
    const showInitialLoader = isLoading && !rooms.length;

    // Internal RoomCard Component
    const RoomCard = ({ room, onCheckIn, onCheckout, onClean, onDelete, onViewGuest }: any) => {
        const isActive = room.status === 'occupied';
        const activeBooking = room.bookings?.[0];

        return (
            <Card padding="none" className="overflow-hidden group flex flex-col h-full border border-gray-100 dark:border-dark-700 hover:border-primary-500/50 transition-all duration-300">
                {/* Card Header */}
                <div className={cn(
                    "p-4 flex items-center justify-between",
                    room.status === 'available' ? "bg-green-50/50 dark:bg-green-900/10" :
                        room.status === 'occupied' ? "bg-blue-50/50 dark:bg-blue-900/10" :
                            room.status === 'dirty' ? "bg-amber-50/50 dark:bg-amber-900/10" :
                                "bg-red-50/50 dark:bg-red-900/10"
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                            room.status === 'available' ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                                room.status === 'occupied' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                                    room.status === 'dirty' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                                        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        )}>
                            {room.number}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{room.type}</p>
                            <Badge variant={
                                room.status === 'available' ? 'success' :
                                    room.status === 'occupied' ? 'info' :
                                        room.status === 'dirty' ? 'warning' : 'danger'
                            } size="sm">
                                {getStatusLabel(room.status)}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingRoom(room); setRoomFormData({ ...room, price: String(room.price) }); setIsRoomModalOpen(true); }} className="p-2 text-gray-400 hover:text-primary-600"><HiOutlinePencil className="w-4 h-4" /></button>
                        <button onClick={() => onDelete(room.id)} className="p-2 text-gray-400 hover:text-red-600"><HiOutlineTrash className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col gap-4">
                    {isActive && activeBooking ? (
                        <div className="space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
                                    <HiOutlineUsers className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Hóspede</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[120px] capitalize">{activeBooking.customerName}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-tight text-gray-500">
                                <div className="p-2 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                    <p>Estadia</p>
                                    <p className="text-gray-900 dark:text-white">{activeBooking.nightsStayed || 0} Noites</p>
                                </div>
                                <div className="p-2 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                    <p>Total</p>
                                    <p className="text-primary-600 text-xs">{new Intl.NumberFormat('pt-MZ').format(Number(activeBooking.grandTotal) || 0)} MT</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col justify-center items-center py-4 opacity-40">
                            <HiOutlineHome className="w-12 h-12 text-gray-300 mb-2" />
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Intl.NumberFormat('pt-MZ').format(Number(room.price) || 0)} MT / Noite</p>
                        </div>
                    )}
                </div>

                {/* Card Action */}
                <div className="p-4 pt-0">
                    {isActive && activeBooking ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" fullWidth onClick={() => onViewGuest(activeBooking.id)}>Ver Perfil</Button>
                            <Button variant="danger" size="sm" fullWidth onClick={() => onCheckout(activeBooking.id)}>Checkout</Button>
                        </div>
                    ) : room.status === 'dirty' ? (
                        <Button variant="outline" size="sm" fullWidth leftIcon={<HiOutlineSparkles />} onClick={() => onClean(room.id)} className="border-amber-500 text-amber-600 hover:bg-amber-50">Limpar Quarto</Button>
                    ) : room.status === 'maintenance' ? (
                        <Button variant="outline" size="sm" fullWidth onClick={() => onClean(room.id)}>Finalizar Manutenção</Button>
                    ) : (
                        <Button variant="primary" size="sm" fullWidth leftIcon={<HiOutlinePlus />} onClick={() => onCheckIn(room)}>Fazer Check-in</Button>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-6 px-2 pt-6 pb-6 md:px-6">
            {/* Module Header Card */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Hospedagem & Hotelaria</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Controle de Ocupação, Reservas e Consumos</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-5 h-5" />} onClick={() => refetch()}>Actualizar</Button>
                        {activeMainTab === 'history' && <ExportBookingsButton data={bookingHistory} />}
                        {activeMainTab === 'rooms' && <ExportRoomsButton data={rooms} />}
                        {activeMainTab === 'rooms' && (
                            <Button size="sm" leftIcon={<HiOutlineUserAdd className="w-5 h-5" />} onClick={() => { setSelectedRoom(null); setIsCheckInModalOpen(true); }}>Novo Check-in</Button>
                        )}
                    </div>
                </div>

                {/* Responsive Tabs Navigation */}
                <div className="mt-6 border-b border-gray-100 dark:border-dark-700">
                    <div className="flex flex-wrap -mb-px">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveMainTab(tab.id as MainTab)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-2 md:px-6 py-4 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap uppercase tracking-wider",
                                    activeMainTab === tab.id
                                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                )}
                            >
                                <span className="shrink-0">{tab.icon}</span>
                                <span className="hidden sm:inline-block">{tab.label}</span>
                                <span className="sm:hidden text-[10px]">{tab.label.substring(0, 3)}...</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions (only on rooms tab) */}
            {activeMainTab === 'rooms' && (
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={filter === 'all' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('all')}
                        >
                            Todos
                        </Button>
                        <Button
                            variant={filter === 'available' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('available')}
                        >
                            Disponíveis ({metrics.available})
                        </Button>
                        <Button
                            variant={filter === 'occupied' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('occupied')}
                        >
                            Ocupados ({metrics.occupied})
                        </Button>
                        <Button
                            variant={filter === 'dirty' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('dirty')}
                        >
                            Para Limpar ({metrics.dirty})
                        </Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder="Procurar quarto..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 w-full sm:w-64"
                            />
                        </div>
                        <Button
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            onClick={() => setIsRoomModalOpen(true)}
                        >
                            Novo Quarto
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="min-h-[400px]">
                {showInitialLoader ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                        <LoadingSpinner size="xl" />
                        <p className="mt-4 text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Iniciando sistema...</p>
                    </div>
                ) : (
                    <>
                        {/* Tab Content: Dashboard */}
                        {activeMainTab === 'dashboard' && (
                            <div className="space-y-6">
                                {/* Smart Insights / Intelligent Advisor */}
                                {insights.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                                <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conselheiro Inteligente</h2>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Previsões de demanda e ocupação hoteleira</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                                            {insights.map((insight) => (
                                                <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <HospitalityDashboard />
                            </div>
                        )}

                        {/* Tab Content: Housekeeping */}
                        {activeMainTab === 'housekeeping' && <HousekeepingPanel onRoomCleaned={() => refetch()} />}

                        {/* Tab Content: Calendar */}
                        {activeMainTab === 'calendar' && <ReservationCalendar onRefresh={() => refetch()} />}

                        {/* Tab Content: Management */}
                        {activeMainTab === 'management' && <HospitalityManagement />}

                        {/* Tab Content: History */}
                        {activeMainTab === 'history' && (
                            <div className="space-y-6">
                                <HospitalityHistory history={bookingHistory} isLoading={historyLoading} />
                                <div className="flex justify-center">
                                    <Pagination
                                        currentPage={historyPage}
                                        totalItems={historyMeta?.total || 0}
                                        itemsPerPage={historyPageSize}
                                        onPageChange={(page) => setHistoryPage(page)}
                                        onItemsPerPageChange={(size) => setHistoryPageSize(size)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Rooms */}
                        {activeMainTab === 'rooms' && (
                            <div className="space-y-6">
                                {/* Checkout Notifications */}
                                <CheckoutNotifications
                                    onViewGuest={(bookingId) => {
                                        setSelectedBookingId(bookingId);
                                        setIsGuestProfileModalOpen(true);
                                    }}
                                    onCheckout={(bookingId) => {
                                        handleCheckout(bookingId);
                                    }}
                                />

                                {/* Rooms Grid */}
                                {filteredRooms.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {filteredRooms.map((room) => (
                                            <RoomCard
                                                key={room.id}
                                                room={room}
                                                onCheckIn={() => {
                                                    setSelectedRoom(room);
                                                    setIsCheckInModalOpen(true);
                                                }}
                                                onCheckout={handleCheckout}
                                                onClean={handleCleanRoom}
                                                onDelete={handleDeleteRoom}
                                                onViewGuest={(bookingId: string) => {
                                                    setSelectedBookingId(bookingId);
                                                    setIsGuestProfileModalOpen(true);
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        title="Nenhum quarto encontrado"
                                        description="Tente ajustar seus filtros ou busca para encontrar o que procura."
                                        icon={<HiOutlineHome className="w-12 h-12" />}
                                    />
                                )}

                                <div className="flex justify-center mt-8">
                                    <Pagination
                                        currentPage={roomPaginationMeta?.page || 1}
                                        totalItems={roomPaginationMeta?.total || 0}
                                        itemsPerPage={pageSize}
                                        onPageChange={(page) => setPage(page)}
                                        onItemsPerPageChange={(size) => setPageSize(size)}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            <RoomFormModal
                isOpen={isRoomModalOpen}
                onClose={() => { setIsRoomModalOpen(false); setEditingRoom(null); }}
                onSave={handleSaveRoom}
                room={editingRoom}
                data={roomFormData}
                setData={setRoomFormData}
            />

            <CheckInModal
                isOpen={isCheckInModalOpen}
                onClose={() => {
                    setIsCheckInModalOpen(false);
                    setSelectedRoom(null);
                    checkInStepper.reset();
                }}
                onConfirm={handleCheckIn}
                room={selectedRoom}
                onRoomSelect={setSelectedRoom}
                availableRooms={rooms.filter(r => r.status === 'available')}
                data={checkInData}
                setData={setCheckInData}
                stepper={checkInStepper}
                steps={checkInSteps}
            />

            <ConsumptionModal
                isOpen={isConsumptionModalOpen}
                onClose={() => setIsConsumptionModalOpen(false)}
                onAdd={handleConsumptionSubmit}
                data={consumptionData}
                setData={setConsumptionData}
            />

            <GuestProfileModal
                isOpen={isGuestProfileModalOpen}
                onClose={() => setIsGuestProfileModalOpen(false)}
                bookingId={selectedBookingId}
                onAddConsumption={(id) => { setSelectedBookingId(id); setIsConsumptionModalOpen(true); }}
                onCheckout={(id) => handleCheckout(id)}
            />

            <CheckoutModal
                isOpen={isCheckoutModalOpen}
                onClose={() => setIsCheckoutModalOpen(false)}
                onSuccess={performCheckout}
                bookingId={selectedBookingForCheckout}
            />

            <ConfirmationModal
                isOpen={deleteRoomConfirmOpen}
                onClose={() => setDeleteRoomConfirmOpen(false)}
                onConfirm={performDeleteRoom}
                title="Excluir Quarto"
                message="Tem certeza que deseja excluir este quarto? Esta ação não pode ser desfeita."
                variant="danger"
            />
        </div>
    );
}
