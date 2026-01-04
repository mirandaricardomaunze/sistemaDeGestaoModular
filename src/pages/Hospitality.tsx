import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, Button, LoadingSpinner, EmptyState, Modal, Input, Select, Badge, Stepper, useStepper, ConfirmationModal } from '../components/ui';
import Pagination, { usePagination } from '../components/ui/Pagination';
import { HospitalityDashboard, HospitalityReports } from '../components/hospitality';
import CheckoutNotifications from '../components/hospitality/CheckoutNotifications';
import GuestProfileModal from '../components/hospitality/GuestProfileModal';
import ExtendStayModal from '../components/hospitality/ExtendStayModal';
import HousekeepingPanel from '../components/hospitality/HousekeepingPanel';
import ReservationCalendar from '../components/hospitality/ReservationCalendar';
import { useHospitality, useProducts } from '../hooks/useData';
import { useStore } from '../stores/useStore';
import { useDebounce } from '../hooks/useDebounce';
import {
    HiOutlineHome,
    HiOutlineUserAdd,
    HiOutlineRefresh,
    HiOutlineSearch,
    HiOutlineUsers,
    HiOutlinePrinter,
    HiOutlineCog,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineShoppingCart,
    HiOutlineCash,
    HiOutlineClipboardList,
    HiOutlineCheck,
    HiOutlineCalendar,
    HiOutlineViewGrid,
    HiOutlinePlus,
    HiOutlineSave,
    HiOutlineChartBar,
    HiOutlineDocumentReport,
    HiOutlineSparkles,
    HiOutlineClock
} from 'react-icons/hi';
import { generateBookingReceipt } from '../utils/documentGenerator';
import { hospitalityAPI } from '../services/api';


type MainTab = 'rooms' | 'history' | 'management' | 'dashboard' | 'reports' | 'housekeeping' | 'calendar';

export default function Hospitality() {
    const { companySettings } = useStore();
    const [searchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as MainTab) || 'rooms';
    const [activeMainTab, setActiveMainTab] = useState<MainTab>(initialTab);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'dirty' | 'maintenance'>('all');

    const {
        rooms,
        isLoading,
        error,
        refetch,
        createBooking,
        checkout,
        addRoom,
        updateRoom,
        deleteRoom,
        addConsumption
    } = useHospitality();

    const { products } = useProducts();

    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
    const [isGuestProfileModalOpen, setIsGuestProfileModalOpen] = useState(false);
    const [isExtendStayModalOpen, setIsExtendStayModalOpen] = useState(false);
    const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
    const [deleteRoomConfirmOpen, setDeleteRoomConfirmOpen] = useState(false);
    const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<string | null>(null);
    const [selectedRoomForDelete, setSelectedRoomForDelete] = useState<string | null>(null);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [bookingHistory, setBookingHistory] = useState<any[]>([]);
    const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [historyLoading, setHistoryLoading] = useState(false);
    const hasInitialData = useRef(false);

    if (rooms.length > 0 && !hasInitialData.current) {
        hasInitialData.current = true;
    }

    // Room pagination using usePagination hook
    const roomPagination = usePagination(rooms, 10);

    // Check-in multi-step state
    const checkInStepper = useStepper(2);
    const checkInSteps = [
        { id: 'form', label: 'Dados do Hóspede', icon: <HiOutlineClipboardList className="w-4 h-4" /> },
        { id: 'confirm', label: 'Confirmação', icon: <HiOutlineCheck className="w-4 h-4" /> }
    ];

    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [editingRoom, setEditingRoom] = useState<any>(null);

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

    const filteredRooms = useMemo(() => {
        return rooms.filter(room => {
            const matchesStatus = filter === 'all' || room.status === filter;
            const matchesSearch = !debouncedSearch ||
                room.number.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                room.type.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                (room.bookings?.[0]?.customerName?.toLowerCase().includes(debouncedSearch.toLowerCase()));

            return matchesStatus && matchesSearch;
        });
    }, [rooms, filter, debouncedSearch]);

    const fetchHistory = async (page = 1) => {
        setHistoryLoading(true);
        try {
            const response = await hospitalityAPI.getBookings({ page, limit: historyPagination.limit });
            setBookingHistory(response.data || []);
            if (response.pagination) {
                setHistoryPagination(response.pagination);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

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
        setCheckoutConfirmOpen(true);
    };

    const performCheckout = async () => {
        if (!selectedBookingForCheckout) return;
        try {
            await checkout(selectedBookingForCheckout);
            refetch();
            setCheckoutConfirmOpen(false);
            setSelectedBookingForCheckout(null);
        } catch (err) { }
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

    const occupancyRate = rooms.length > 0
        ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100)
        : 0;

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'available': return 'LIVRE';
            case 'occupied': return 'OCUPADO';
            case 'dirty': return 'LIMPEZA';
            case 'maintenance': return 'MANUTENÇÃO';
            default: return status.toUpperCase();
        }
    };

    // Layout constants
    const showInitialLoader = isLoading && !hasInitialData.current;

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
                        {activeMainTab === 'rooms' && (
                            <Button size="sm" leftIcon={<HiOutlineUserAdd className="w-5 h-5" />} onClick={() => { setSelectedRoom(null); setIsCheckInModalOpen(true); }}>Novo Check-in</Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700 pb-0 overflow-x-auto scrollbar-hide">
                <Button
                    variant={activeMainTab === 'dashboard' ? 'primary' : 'ghost'}
                    onClick={() => setActiveMainTab('dashboard')}
                    leftIcon={<HiOutlineChartBar className="w-4 h-4" />}
                    size="sm"
                    className="px-4 py-2 rounded-b-none"
                >
                    Dashboard
                </Button>
                <Button
                    variant={activeMainTab === 'rooms' ? 'primary' : 'ghost'}
                    onClick={() => setActiveMainTab('rooms')}
                    leftIcon={<HiOutlineViewGrid className="w-4 h-4" />}
                    size="sm"
                    className="px-4 py-2 rounded-b-none"
                >
                    Quartos
                </Button>
                <Button
                    variant={activeMainTab === 'history' ? 'primary' : 'ghost'}
                    onClick={() => { setActiveMainTab('history'); fetchHistory(); }}
                    leftIcon={<HiOutlineClock className="w-4 h-4" />}
                    size="sm"
                    className="px-4 py-2 rounded-b-none"
                >
                    Histórico
                </Button>
                <Button
                    variant={activeMainTab === 'housekeeping' ? 'primary' : 'ghost'}
                    onClick={() => setActiveMainTab('housekeeping')}
                    leftIcon={<HiOutlineSparkles className="w-4 h-4" />}
                    size="sm"
                    className="px-4 py-2 rounded-b-none"
                >
                    Limpeza
                </Button>
                <Button
                    variant={activeMainTab === 'calendar' ? 'primary' : 'ghost'}
                    onClick={() => setActiveMainTab('calendar')}
                    leftIcon={<HiOutlineCalendar className="w-4 h-4" />}
                    size="sm"
                    className="px-4 py-2 rounded-b-none"
                >
                    Reservas
                </Button>
                <Button
                    variant={activeMainTab === 'management' ? 'primary' : 'ghost'}
                    onClick={() => setActiveMainTab('management')}
                    leftIcon={<HiOutlineCog className="w-4 h-4" />}
                    size="sm"
                    className="px-4 py-2 rounded-b-none"
                >
                    Gestão
                </Button>
                <Button
                    variant={activeMainTab === 'reports' ? 'primary' : 'ghost'}
                    onClick={() => setActiveMainTab('reports')}
                    leftIcon={<HiOutlineDocumentReport className="w-4 h-4" />}
                    size="sm"
                    className="px-4 py-2 rounded-b-none"
                >
                    Relatórios
                </Button>
            </div>

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
                            <HospitalityDashboard />
                        )}

                        {/* Tab Content: Reports */}
                        {activeMainTab === 'reports' && (
                            <HospitalityReports />
                        )}

                        {/* Tab Content: Housekeeping */}
                        {activeMainTab === 'housekeeping' && (
                            <HousekeepingPanel onRoomCleaned={() => refetch()} />
                        )}

                        {/* Tab Content: Calendar */}
                        {activeMainTab === 'calendar' && (
                            <ReservationCalendar onRefresh={() => refetch()} />
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

                                {/* Quick Stats */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                    <Card className="p-5 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg border-none">
                                        <div className="flex items-center gap-2 mb-2 opacity-80">
                                            <HiOutlineHome className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Livre</span>
                                        </div>
                                        <p className="text-2xl font-black">{rooms.filter(r => r.status === 'available').length}</p>
                                    </Card>

                                    <Card className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-none">
                                        <div className="flex items-center gap-2 mb-2 opacity-80">
                                            <HiOutlineUsers className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Ocupado</span>
                                        </div>
                                        <p className="text-2xl font-black">{rooms.filter(r => r.status === 'occupied').length}</p>
                                    </Card>

                                    <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg border-none">
                                        <div className="flex items-center gap-2 mb-2 opacity-80">
                                            <HiOutlineRefresh className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Limpeza</span>
                                        </div>
                                        <p className="text-2xl font-black">{rooms.filter(r => r.status === 'dirty').length}</p>
                                    </Card>

                                    <Card className="p-5 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg border-none">
                                        <div className="flex items-center gap-2 mb-2 opacity-80">
                                            <HiOutlineCog className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Manutenção</span>
                                        </div>
                                        <p className="text-2xl font-black">{rooms.filter(r => r.status === 'maintenance').length}</p>
                                    </Card>

                                    <Card className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg border-none">
                                        <div className="flex items-center gap-2 mb-2 opacity-80">
                                            <HiOutlineChartBar className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Ocupação</span>
                                        </div>
                                        <p className="text-2xl font-black">{occupancyRate}%</p>
                                    </Card>
                                </div>

                                {/* Toolbar */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                                    <div className="flex gap-2 overflow-visible">
                                        <Button variant={filter === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setFilter('all')}>Todos</Button>
                                        <Button variant={filter === 'available' ? 'primary' : 'ghost'} size="sm" onClick={() => setFilter('available')}>Disponíveis</Button>
                                        <Button variant={filter === 'occupied' ? 'primary' : 'ghost'} size="sm" onClick={() => setFilter('occupied')}>Ocupados</Button>
                                        <Button variant={filter === 'dirty' ? 'primary' : 'ghost'} size="sm" onClick={() => setFilter('dirty')}>Limpeza</Button>
                                    </div>
                                    <div className="relative w-full md:w-64">
                                        <Input
                                            placeholder="Buscar quarto..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                        />
                                        {isLoading && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <LoadingSpinner size="sm" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {error ? (
                                    <EmptyState title="Erro ao carregar dados" description={error} action={<Button onClick={() => refetch()}>Tentar Novamente</Button>} />
                                ) : rooms.length === 0 && !isLoading ? (
                                    <EmptyState
                                        title="Nenhum quarto encontrado"
                                        description="Adicione quartos para começar a utilizar o sistema de hotelaria."
                                        action={
                                            <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => { setEditingRoom(null); setRoomFormData({ number: '', type: 'single', price: '', priceNoMeal: '', priceBreakfast: '', priceHalfBoard: '', priceFullBoard: '', notes: '' }); setIsRoomModalOpen(true); }}>Adicionar Quarto</Button>
                                        }
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {filteredRooms.map(room => (
                                            <Card key={room.id} className="group overflow-hidden border-gray-200 dark:border-dark-700 hover:shadow-xl hover:border-primary-400 transition-all duration-300">
                                                {/* Card Header with Status Badge */}
                                                <div className={`h-2 w-full ${room.status === 'available' ? 'bg-green-500' :
                                                    room.status === 'occupied' ? 'bg-blue-500' :
                                                        room.status === 'dirty' ? 'bg-amber-500' :
                                                            'bg-red-500'}`} />

                                                <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-xl ${room.status === 'available' ? 'bg-green-50 text-green-600' :
                                                            room.status === 'occupied' ? 'bg-blue-50 text-blue-600' :
                                                                room.status === 'dirty' ? 'bg-amber-50 text-amber-600' :
                                                                    'bg-red-50 text-red-600'}`}>
                                                            <HiOutlineHome className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Q-{room.number}</h3>
                                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{room.type}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${room.status === 'available' ? 'bg-green-100 text-green-700' :
                                                        room.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                                                            room.status === 'dirty' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-red-100 text-red-700'}`}>
                                                        {getStatusLabel(room.status)}
                                                    </div>
                                                </div>

                                                <div className="p-4 space-y-4">
                                                    {/* Content Area */}
                                                    <div className="min-h-[60px]">
                                                        {room.status === 'occupied' && room.bookings?.[0] ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <HiOutlineUsers className="w-4 h-4 text-primary-500" />
                                                                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                                        {room.bookings[0].customerName}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-gray-50 dark:bg-dark-800 p-2 rounded-lg border border-gray-100 dark:border-dark-700">
                                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Consumos</span>
                                                                    <span className="text-xs font-black text-primary-600">
                                                                        {room.bookings[0].consumptions?.reduce((acc: number, c: any) => acc + Number(c.total), 0).toLocaleString()} MT
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-500 italic flex items-center gap-2 pt-2">
                                                                <HiOutlineChartBar className="w-4 h-4 opacity-30" />
                                                                {room.status === 'available' ? 'Disponível para nova entrada' :
                                                                    room.status === 'dirty' ? 'Aguardando serviço de limpeza' :
                                                                        room.status === 'maintenance' ? 'Em manutenção técnica' : '—'}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Financial / Type Info */}
                                                    <div className="flex justify-between items-center text-xs border-t border-gray-100 dark:border-dark-700 pt-3">
                                                        <span className="text-gray-400 font-medium">Preço p/ Noite</span>
                                                        <span className="font-bold text-gray-900 dark:text-white">{room.price?.toLocaleString()} MT</span>
                                                    </div>

                                                    {/* Action Area */}
                                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                                        {room.status === 'available' ? (
                                                            <Button fullWidth size="sm" onClick={() => { setSelectedRoom(room); setIsCheckInModalOpen(true); }} className="shadow-sm">Realizar Check-in</Button>
                                                        ) : room.status === 'occupied' ? (
                                                            <div className="space-y-2">
                                                                <div className="flex gap-2">
                                                                    <Button fullWidth variant="danger" size="sm" onClick={() => room.bookings?.[0] && handleCheckout(room.bookings[0].id)}>Check-out</Button>
                                                                    <Button variant="outline" size="sm" className="px-3" onClick={() => room.bookings?.[0] && generateBookingReceipt(room.bookings[0], companySettings)} title="Imprimir Recibo">
                                                                        <HiOutlinePrinter className="w-5 h-5" />
                                                                    </Button>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    fullWidth
                                                                    leftIcon={<HiOutlineShoppingCart className="w-4 h-4" />}
                                                                    onClick={() => { setSelectedRoom(room); setIsConsumptionModalOpen(true); }}
                                                                    className="text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                                                                >
                                                                    Registrar Consumo
                                                                </Button>
                                                            </div>
                                                        ) : room.status === 'dirty' ? (
                                                            <Button fullWidth variant="outline" size="sm" onClick={() => updateRoom(room.id, { status: 'available' })} leftIcon={<HiOutlineCheck className="w-4 h-4" />}>Marcar como Limpo</Button>
                                                        ) : (
                                                            <Button fullWidth variant="outline" size="sm" onClick={() => updateRoom(room.id, { status: 'available' })}>Concluir Manutenção</Button>
                                                        )}

                                                        {/* Quick State Toggle for management */}
                                                        {room.status !== 'occupied' && (
                                                            <div className="flex justify-center gap-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => updateRoom(room.id, { status: 'dirty' })} className="text-[10px] text-amber-600 hover:underline font-bold">Set Sujo</button>
                                                                <button onClick={() => updateRoom(room.id, { status: 'maintenance' })} className="text-[10px] text-red-600 hover:underline font-bold">Set Manut.</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab Content: History */}
                        {activeMainTab === 'history' && (
                            <div className="space-y-6">
                                {/* Toolbar */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                                            <HiOutlineCalendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Histórico de Reservas</h3>
                                            <p className="text-[10px] text-gray-500 font-medium">Registos de Check-in e Check-out</p>
                                        </div>
                                    </div>

                                    <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-4 h-4" />} onClick={() => fetchHistory()}>
                                        Actualizar
                                    </Button>
                                </div>

                                <Card className="p-0 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100 dark:bg-dark-700 text-xs uppercase text-gray-500">
                                                <tr>
                                                    <th className="px-4 py-3">Data Check-in</th>
                                                    <th className="px-4 py-3">Quarto</th>
                                                    <th className="px-4 py-3">Cliente</th>
                                                    <th className="px-4 py-3">Hóspedes</th>
                                                    <th className="px-4 py-3">Preço Total</th>
                                                    <th className="px-4 py-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-dark-600">
                                                {historyLoading ? (
                                                    <tr><td colSpan={6} className="text-center py-8"><LoadingSpinner /></td></tr>
                                                ) : bookingHistory.length === 0 ? (
                                                    <tr><td colSpan={6} className="text-center py-8 text-gray-500 italic">Sem registros de ocupação</td></tr>
                                                ) : (
                                                    bookingHistory.map(booking => (
                                                        <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                                            <td className="px-4 py-3">{booking.checkIn ? new Date(booking.checkIn).toLocaleDateString('pt-PT') : 'N/A'}</td>
                                                            <td className="px-4 py-3 font-medium">Q-{booking.room?.number || '??'}</td>
                                                            <td className="px-4 py-3">{booking.customerName}</td>
                                                            <td className="px-4 py-3 text-center">{booking.guestCount}</td>
                                                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                                                                {(Number(booking.totalPrice) + (booking.consumptions?.reduce((acc: number, c: any) => acc + Number(c.total), 0) || 0)).toLocaleString()} MT
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Badge variant={booking.status === 'checked_in' ? 'info' : booking.status === 'checked_out' ? 'success' : 'warning'}>
                                                                    {booking.status === 'checked_in' ? 'OCUPADO' : booking.status === 'checked_out' ? 'CHECK-OUT' : booking.status?.toUpperCase()}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination Component */}
                                    <Pagination
                                        currentPage={historyPagination.page}
                                        totalItems={historyPagination.total}
                                        itemsPerPage={historyPagination.limit}
                                        onPageChange={(page) => fetchHistory(page)}
                                        showItemsPerPage={false}
                                    />
                                </Card>
                            </div>
                        )
                        }

                        {/* Tab Content: Management */}
                        {
                            activeMainTab === 'management' && (
                                <div className="space-y-6">
                                    {/* Toolbar */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                                                <HiOutlineCog className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Gestão de Quartos</h3>
                                                <p className="text-[10px] text-gray-500 font-medium">Configuração de tipos e preços</p>
                                            </div>
                                        </div>

                                        <Button size="sm" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => { setEditingRoom(null); setRoomFormData({ number: '', type: 'single', price: '', priceNoMeal: '', priceBreakfast: '', priceHalfBoard: '', priceFullBoard: '', notes: '' }); setIsRoomModalOpen(true); }}>
                                            Adicionar Quarto
                                        </Button>
                                    </div>

                                    <Card className="p-0 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-100 dark:bg-dark-700 text-xs uppercase text-gray-500">
                                                    <tr>
                                                        <th className="px-4 py-3">Número</th>
                                                        <th className="px-4 py-3">Tipo</th>
                                                        <th className="px-4 py-3">Preço/Dia</th>
                                                        <th className="px-4 py-3">Status</th>
                                                        <th className="px-4 py-3">Notas</th>
                                                        <th className="px-4 py-3">Acções</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-dark-600">
                                                    {roomPagination.paginatedItems.length === 0 ? (
                                                        <tr><td colSpan={6} className="text-center py-8 text-gray-500 italic">Nenhum quarto registado</td></tr>
                                                    ) : (
                                                        roomPagination.paginatedItems.map(room => (
                                                            <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                                                <td className="px-4 py-3 font-bold">Q-{room.number}</td>
                                                                <td className="px-4 py-3 capitalize">{room.type}</td>
                                                                <td className="px-4 py-3 font-medium">{room.price?.toLocaleString()} MT</td>
                                                                <td className="px-4 py-3">
                                                                    <Badge variant={room.status === 'available' ? 'success' : room.status === 'occupied' ? 'info' : 'warning'}>
                                                                        {getStatusLabel(room.status)}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500 truncate max-w-[150px]">{room.notes || '—'}</td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex gap-1">
                                                                        <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditingRoom(room); setRoomFormData({ number: room.number, type: room.type, price: room.price?.toString() || '', priceNoMeal: room.priceNoMeal?.toString() || '', priceBreakfast: room.priceBreakfast?.toString() || '', priceHalfBoard: room.priceHalfBoard?.toString() || '', priceFullBoard: room.priceFullBoard?.toString() || '', notes: room.notes || '' }); setIsRoomModalOpen(true); }}>
                                                                            <HiOutlinePencil className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" title="Eliminar" onClick={() => deleteRoom(room.id)}>
                                                                            <HiOutlineTrash className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Pagination Component */}
                                        <Pagination
                                            currentPage={roomPagination.currentPage}
                                            totalItems={roomPagination.totalItems}
                                            itemsPerPage={roomPagination.itemsPerPage}
                                            onPageChange={roomPagination.setCurrentPage}
                                            onItemsPerPageChange={roomPagination.setItemsPerPage}
                                            showItemsPerPage={true}
                                        />
                                    </Card>
                                </div>
                            )
                        }

                        {/* Check-In Modal with Multi-Step Form */}
                        <Modal
                            isOpen={isCheckInModalOpen}
                            onClose={() => { setIsCheckInModalOpen(false); checkInStepper.reset(); }}
                            title={selectedRoom ? `Check-in: Quarto ${selectedRoom.number}` : 'Novo Check-in'}
                            size="lg"
                        >
                            {/* Stepper Header */}
                            <Stepper steps={checkInSteps} currentStep={checkInStepper.currentStep} className="mb-6" />

                            {/* Step 1: Form */}
                            {checkInStepper.currentStep === 0 && (
                                <div className="space-y-4">
                                    {!selectedRoom && (
                                        <Select
                                            label="Escolher Quarto"
                                            options={rooms.filter(r => r.status === 'available').map(r => ({ value: r.id, label: `Quarto ${r.number} (${r.type}) - ${r.price?.toLocaleString()} MT/dia` }))}
                                            onChange={(e) => setSelectedRoom(rooms.find(r => r.id === e.target.value))}
                                            required
                                        />
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Nome do Hóspede"
                                            placeholder="Nome completo"
                                            value={checkInData.customerName}
                                            onChange={(e) => setCheckInData({ ...checkInData, customerName: e.target.value })}
                                            required
                                        />
                                        <Input
                                            label="Nacionalidade"
                                            placeholder="Ex: Moçambicana"
                                            value={checkInData.guestNationality}
                                            onChange={(e) => setCheckInData({ ...checkInData, guestNationality: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t dark:border-dark-700 pt-4">
                                        <Select
                                            label="Tipo de Documento"
                                            options={[
                                                { value: 'BI', label: 'B.I.' },
                                                { value: 'Passaporte', label: 'Passaporte' },
                                                { value: 'DIRE', label: 'D.I.R.E.' },
                                                { value: 'Outro', label: 'Outro' }
                                            ]}
                                            value={checkInData.guestDocumentType}
                                            onChange={(e) => setCheckInData({ ...checkInData, guestDocumentType: e.target.value })}
                                        />
                                        <Input
                                            label="Número do Documento"
                                            placeholder="Nº de Identificação"
                                            value={checkInData.guestDocumentNumber}
                                            onChange={(e) => setCheckInData({ ...checkInData, guestDocumentNumber: e.target.value })}
                                        />
                                        <Input
                                            label="Telefone de Contacto"
                                            placeholder="+258 ..."
                                            value={checkInData.guestPhone}
                                            onChange={(e) => setCheckInData({ ...checkInData, guestPhone: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-dark-700 pt-4">
                                        <Input
                                            label="Hóspedes"
                                            type="number"
                                            min="1"
                                            value={checkInData.guestCount}
                                            onChange={(e) => setCheckInData({ ...checkInData, guestCount: e.target.value })}
                                        />
                                        <Select
                                            label="Plano de Refeição"
                                            options={[
                                                { value: 'none', label: 'Sem Refeições' },
                                                { value: 'breakfast', label: 'Pequeno-Almoço (BB)' },
                                                { value: 'half_board', label: 'Meia Pensão (HB)' },
                                                { value: 'full_board', label: 'Pensão Completa (FB)' }
                                            ]}
                                            value={checkInData.mealPlan}
                                            onChange={(e) => setCheckInData({ ...checkInData, mealPlan: e.target.value as any })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t dark:border-dark-700 pt-4">
                                        <Input
                                            label="Check-out Previsto"
                                            type="date"
                                            value={checkInData.checkOutDate}
                                            onChange={(e) => setCheckInData({ ...checkInData, checkOutDate: e.target.value })}
                                        />
                                        <Input
                                            label="Preço Manual (MT)"
                                            type="number"
                                            placeholder={
                                                checkInData.mealPlan === 'none' ? (selectedRoom?.priceNoMeal || selectedRoom?.price)?.toString() :
                                                    checkInData.mealPlan === 'breakfast' ? (selectedRoom?.priceBreakfast || selectedRoom?.price)?.toString() :
                                                        checkInData.mealPlan === 'half_board' ? (selectedRoom?.priceHalfBoard || selectedRoom?.price)?.toString() :
                                                            checkInData.mealPlan === 'full_board' ? (selectedRoom?.priceFullBoard || selectedRoom?.price)?.toString() :
                                                                selectedRoom?.price?.toString()
                                            }
                                            value={checkInData.totalPrice}
                                            onChange={(e) => setCheckInData({ ...checkInData, totalPrice: e.target.value })}
                                        />
                                        <div className="flex items-end">
                                            <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg w-full">
                                                <p className="text-[10px] text-gray-500 font-bold uppercase">Preço Aplicado</p>
                                                <p className="text-lg font-black text-primary-600">
                                                    {(checkInData.totalPrice ? parseFloat(checkInData.totalPrice) :
                                                        checkInData.mealPlan === 'none' ? (selectedRoom?.priceNoMeal || selectedRoom?.price) :
                                                            checkInData.mealPlan === 'breakfast' ? (selectedRoom?.priceBreakfast || selectedRoom?.price) :
                                                                checkInData.mealPlan === 'half_board' ? (selectedRoom?.priceHalfBoard || selectedRoom?.price) :
                                                                    checkInData.mealPlan === 'full_board' ? (selectedRoom?.priceFullBoard || selectedRoom?.price) :
                                                                        selectedRoom?.price
                                                    )?.toLocaleString()} MT
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Input
                                        label="Observações / Notas Internas"
                                        placeholder="Alguma nota especial?"
                                        value={checkInData.notes}
                                        onChange={(e) => setCheckInData({ ...checkInData, notes: e.target.value })}
                                    />

                                    <div className="pt-4 flex gap-3">
                                        <Button variant="outline" className="flex-1" onClick={() => { setIsCheckInModalOpen(false); checkInStepper.reset(); }}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            onClick={() => checkInStepper.next()}
                                            disabled={!selectedRoom || !checkInData.customerName}
                                        >
                                            Próximo: Confirmar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Confirmation */}
                            {checkInStepper.currentStep === 1 && (
                                <div className="space-y-4">
                                    <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-5 space-y-4 border border-gray-200 dark:border-dark-700">
                                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-dark-700 pb-2">
                                            <HiOutlineCheck className="w-5 h-5 text-green-500" />
                                            Confirmação de Hospedagem
                                        </h4>

                                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-wider">Hóspede Principal</p>
                                                <p className="font-bold text-gray-900 dark:text-white">{checkInData.customerName}</p>
                                                <p className="text-xs text-gray-500">{checkInData.guestPhone || 'Sem telefone'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-wider">Identificação</p>
                                                <p className="font-bold text-gray-900 dark:text-white">
                                                    {checkInData.guestDocumentType}: {checkInData.guestDocumentNumber || 'Não informado'}
                                                </p>
                                                <p className="text-xs text-gray-500">{checkInData.guestNationality}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-wider">Estadia</p>
                                                <p className="font-bold text-gray-900 dark:text-white">Quarto {selectedRoom?.number} ({selectedRoom?.type})</p>
                                                <p className="text-xs text-gray-500">{checkInData.guestCount} Pessoa(s)</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-wider">Plano de Refeição</p>
                                                <p className="font-bold text-gray-900 dark:text-white">
                                                    {checkInData.mealPlan === 'none' ? 'Sem Refeições' :
                                                        checkInData.mealPlan === 'breakfast' ? 'Pequeno-Almoço (BB)' :
                                                            checkInData.mealPlan === 'half_board' ? 'Meia Pensão (HB)' :
                                                                'Pensão Completa (FB)'}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-wider">Financeiro</p>
                                                <p className="font-bold text-primary-600 text-lg">
                                                    {(checkInData.totalPrice ? parseFloat(checkInData.totalPrice) :
                                                        checkInData.mealPlan === 'none' ? (selectedRoom?.priceNoMeal || selectedRoom?.price) :
                                                            checkInData.mealPlan === 'breakfast' ? (selectedRoom?.priceBreakfast || selectedRoom?.price) :
                                                                checkInData.mealPlan === 'half_board' ? (selectedRoom?.priceHalfBoard || selectedRoom?.price) :
                                                                    checkInData.mealPlan === 'full_board' ? (selectedRoom?.priceFullBoard || selectedRoom?.price) :
                                                                        selectedRoom?.price
                                                    )?.toLocaleString()} MT/noite
                                                </p>
                                                <p className="text-xs text-gray-500">Check-out: {checkInData.checkOutDate ? new Date(checkInData.checkOutDate).toLocaleDateString('pt-PT') : 'Não definido'}</p>
                                            </div>
                                        </div>

                                        {checkInData.notes && (
                                            <div className="mt-4 pt-3 border-t dark:border-dark-700">
                                                <p className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-wider">Notas / Observações</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 italic">"{checkInData.notes}"</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800 rounded-lg p-3">
                                        <p className="text-xs text-primary-800 dark:text-primary-200 text-center">
                                            Ao confirmar, o sistema irá formalizar a ocupação do quarto e iniciar a contagem de tempo da estadia.
                                        </p>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <Button variant="outline" className="flex-1" onClick={() => checkInStepper.prev()}>
                                            Voltar para edição
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            onClick={(e) => handleCheckIn(e as any)}
                                        >
                                            <HiOutlineCheck className="w-5 h-5 mr-2" />
                                            Confirmar e Finalizar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Modal>

                        {/* Consumption Modal */}
                        <Modal
                            isOpen={isConsumptionModalOpen}
                            onClose={() => setIsConsumptionModalOpen(false)}
                            title={`Lançar Consumo: Quarto ${selectedRoom?.number}`}
                        >
                            <form onSubmit={handleConsumptionSubmit} className="space-y-4">
                                <Select
                                    label="Produto / Serviço"
                                    options={products.map(p => ({ value: p.id, label: `${p.name} - ${p.price.toLocaleString()} MT` }))}
                                    value={consumptionData.productId}
                                    onChange={(e) => setConsumptionData({ ...consumptionData, productId: e.target.value })}
                                    required
                                />
                                <Input
                                    label="Quantidade"
                                    type="number"
                                    min="1"
                                    value={consumptionData.quantity}
                                    onChange={(e) => setConsumptionData({ ...consumptionData, quantity: parseInt(e.target.value) })}
                                    required
                                />
                                <div className="pt-4 flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => setIsConsumptionModalOpen(false)}>Cancelar</Button>
                                    <Button type="submit" className="flex-1" leftIcon={<HiOutlineCash className="w-5 h-5" />}>Registrar Débito</Button>
                                </div>
                            </form>
                        </Modal>

                        {/* Room Management Modal */}
                        <Modal
                            isOpen={isRoomModalOpen}
                            onClose={() => { setIsRoomModalOpen(false); setEditingRoom(null); }}
                            title="Gestão de Quartos"
                            size="xl"
                        >
                            <div className="space-y-6">
                                <form onSubmit={handleRoomSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-50 dark:bg-dark-800 p-4 rounded-lg">
                                    <Input
                                        label="Número"
                                        placeholder="Ex: 101"
                                        value={roomFormData.number}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, number: e.target.value })}
                                        required
                                    />
                                    <Select
                                        label="Tipo"
                                        options={[
                                            { value: 'single', label: 'Single' },
                                            { value: 'double', label: 'Double' },
                                            { value: 'suite', label: 'Suite' },
                                            { value: 'deluxe', label: 'Deluxe' },
                                        ]}
                                        value={roomFormData.type}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, type: e.target.value })}
                                    />
                                    <Input
                                        label="Preço Base/Dia"
                                        type="number"
                                        value={roomFormData.price}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, price: e.target.value })}
                                        required
                                    />

                                    <div className="col-span-full border-t dark:border-dark-700 pt-4 mt-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Preços por Plano de Refeição</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input
                                                label="Sem Refeições"
                                                type="number"
                                                placeholder={roomFormData.price || '0'}
                                                value={roomFormData.priceNoMeal}
                                                onChange={(e) => setRoomFormData({ ...roomFormData, priceNoMeal: e.target.value })}
                                            />
                                            <Input
                                                label="Pequeno-Almoço (BB)"
                                                type="number"
                                                value={roomFormData.priceBreakfast}
                                                onChange={(e) => setRoomFormData({ ...roomFormData, priceBreakfast: e.target.value })}
                                            />
                                            <Input
                                                label="Meia Pensão (HB)"
                                                type="number"
                                                value={roomFormData.priceHalfBoard}
                                                onChange={(e) => setRoomFormData({ ...roomFormData, priceHalfBoard: e.target.value })}
                                            />
                                            <Input
                                                label="Pensão Completa (FB)"
                                                type="number"
                                                value={roomFormData.priceFullBoard}
                                                onChange={(e) => setRoomFormData({ ...roomFormData, priceFullBoard: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <Button type="submit" fullWidth leftIcon={editingRoom ? <HiOutlineSave className="w-5 h-5" /> : <HiOutlinePlus className="w-5 h-5" />} className="col-span-full mt-4">
                                        {editingRoom ? 'Actualizar' : 'Adicionar'}
                                    </Button>
                                </form>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 dark:bg-dark-700">
                                            <tr>
                                                <th className="px-4 py-2">Quarto</th>
                                                <th className="px-4 py-2">Tipo</th>
                                                <th className="px-4 py-2">Preço</th>
                                                <th className="px-4 py-2">Status</th>
                                                <th className="px-4 py-2 text-right">Acções</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-dark-600">
                                            {rooms.map(room => (
                                                <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                                    <td className="px-4 py-3 font-bold">Q-{room.number}</td>
                                                    <td className="px-4 py-3 capitalize">{room.type}</td>
                                                    <td className="px-4 py-3">{room.price?.toLocaleString()} MT</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={
                                                            room.status === 'available' ? 'success' :
                                                                room.status === 'occupied' ? 'info' :
                                                                    'warning'
                                                        }>
                                                            {getStatusLabel(room.status)}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingRoom(room);
                                                                setRoomFormData({
                                                                    number: room.number,
                                                                    type: room.type,
                                                                    price: room.price.toString(),
                                                                    priceNoMeal: room.priceNoMeal?.toString() || '',
                                                                    priceBreakfast: room.priceBreakfast?.toString() || '',
                                                                    priceHalfBoard: room.priceHalfBoard?.toString() || '',
                                                                    priceFullBoard: room.priceFullBoard?.toString() || '',
                                                                    notes: room.notes || ''
                                                                });
                                                            }}
                                                            className="text-primary-500 hover:text-primary-700"
                                                        >
                                                            <HiOutlinePencil className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRoom(room.id)}
                                                            className="text-red-500 hover:text-red-700"
                                                            disabled={room.status === 'occupied'}
                                                        >
                                                            <HiOutlineTrash className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Modal>

                        {/* Booking History Modal */}
                        <Modal
                            isOpen={isHistoryModalOpen}
                            onClose={() => setIsHistoryModalOpen(false)}
                            title="Histórico de Reservas"
                            size="xl"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 dark:bg-dark-700 text-xs uppercase text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3">Data</th>
                                            <th className="px-4 py-3">Quarto</th>
                                            <th className="px-4 py-3">Cliente</th>
                                            <th className="px-4 py-3">Preço Total</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-600">
                                        {bookingHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-8 text-gray-500 italic">Sem registros de ocupação</td>
                                            </tr>
                                        ) : (
                                            bookingHistory.map(booking => (
                                                <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                                    <td className="px-4 py-3">{booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : 'N/A'}</td>
                                                    <td className="px-4 py-3 font-medium">Q-{booking.room?.number || '??'}</td>
                                                    <td className="px-4 py-3">{booking.customerName}</td>
                                                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                                                        {(Number(booking.totalPrice) + (booking.consumptions?.reduce((acc: number, c: any) => acc + Number(c.total), 0) || 0)).toLocaleString()} MT
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={booking.status === 'checked_in' ? 'info' : 'success'}>
                                                            {booking.status === 'checked_in' ? 'OCUPADO' : 'CHECK-OUT'}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination Controls */}
                            {historyPagination.totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t dark:border-dark-600">
                                    <div className="text-sm text-gray-500">
                                        Mostrando {((historyPagination.page - 1) * historyPagination.limit) + 1} a {Math.min(historyPagination.page * historyPagination.limit, historyPagination.total)} de {historyPagination.total} registros
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => fetchHistory(historyPagination.page - 1)}
                                            disabled={historyPagination.page <= 1 || historyLoading}
                                        >
                                            Anterior
                                        </Button>
                                        <span className="px-3 py-1 text-sm font-medium">
                                            {historyPagination.page} / {historyPagination.totalPages}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => fetchHistory(historyPagination.page + 1)}
                                            disabled={historyPagination.page >= historyPagination.totalPages || historyLoading}
                                        >
                                            Próximo
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Modal>

                        {/* Guest Profile Modal */}
                        <GuestProfileModal
                            isOpen={isGuestProfileModalOpen}
                            onClose={() => {
                                setIsGuestProfileModalOpen(false);
                                setSelectedBookingId(null);
                            }}
                            bookingId={selectedBookingId}
                            onCheckout={(bookingId) => {
                                setIsGuestProfileModalOpen(false);
                                handleCheckout(bookingId);
                            }}
                            onExtendStay={(bookingId) => {
                                setSelectedBookingId(bookingId);
                                setIsExtendStayModalOpen(true);
                            }}
                            onAddConsumption={(bookingId) => {
                                const room = rooms.find(r => r.bookings?.[0]?.id === bookingId);
                                if (room) {
                                    setSelectedRoom(room);
                                    setIsConsumptionModalOpen(true);
                                }
                            }}
                        />

                        {/* Extend Stay Modal */}
                        <ExtendStayModal
                            isOpen={isExtendStayModalOpen}
                            onClose={() => {
                                setIsExtendStayModalOpen(false);
                                setSelectedBookingId(null);
                            }}
                            bookingId={selectedBookingId}
                            currentCheckout={
                                selectedBookingId
                                    ? rooms.find(r => r.bookings?.[0]?.id === selectedBookingId)?.bookings?.[0]?.expectedCheckout || null
                                    : null
                            }
                            roomPrice={
                                selectedBookingId
                                    ? Number(rooms.find(r => r.bookings?.[0]?.id === selectedBookingId)?.price || 0)
                                    : 0
                            }
                            onSuccess={() => {
                                refetch();
                                setIsExtendStayModalOpen(false);
                                setSelectedBookingId(null);
                            }}
                        />
                    </>
                )}
            </div>

            {/* Checkout Confirmation Modal */}
            <ConfirmationModal
                isOpen={checkoutConfirmOpen}
                onClose={() => {
                    setCheckoutConfirmOpen(false);
                    setSelectedBookingForCheckout(null);
                }}
                onConfirm={performCheckout}
                title="Confirmar Check-out?"
                message="Deseja confirmar o Check-out e gerar a fatura de venda (Estadia + Consumos)? Esta ação irá liberar o quarto."
                confirmText="Sim, Fazer Check-out"
                cancelText="Cancelar"
                variant="warning"
            />

            {/* Delete Room Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteRoomConfirmOpen}
                onClose={() => {
                    setDeleteRoomConfirmOpen(false);
                    setSelectedRoomForDelete(null);
                }}
                onConfirm={performDeleteRoom}
                title="Eliminar Quarto?"
                message="Tem certeza que deseja eliminar este quarto permanentemente? Esta ação não pode ser desfeita."
                confirmText="Sim, Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />
        </div>
    );
}
