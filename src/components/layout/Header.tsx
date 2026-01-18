import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { useAuthStore, roleLabels } from '../../stores/useAuthStore';
import {
    HiOutlineMenu,
    HiOutlineSearch,
    HiOutlineMoon,
    HiOutlineSun,
    HiOutlineLogout,
    HiOutlineUser,
    HiOutlineCog,
    HiRefresh,
    HiOutlineTruck,
    HiOutlineTag,
    HiChevronRight,
} from 'react-icons/hi';
import LanguageSelector from '../common/LanguageSelector';
import { NotificationBadge } from '../notifications';
import {
    productsAPI,
    customersAPI,
    employeesAPI,
    ordersAPI,
    suppliersAPI,
    settingsAPI,
    pharmacyAPI,
    hospitalityAPI,
    crmAPI,
    invoicesAPI,
    salesAPI
} from '../../services/api';
import { HiCube, HiUserGroup, HiShoppingBag, HiCloud } from 'react-icons/hi2';
import { MdCloudOff, MdMedicalServices, MdHotel, MdReceiptLong, MdShowChart } from 'react-icons/md';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useTenant } from '../../contexts/TenantContext';

export default function Header() {
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, toggleTheme, toggleSidebar, companySettings } = useStore();
    const { user, logout } = useAuthStore();
    const { isOnline, isSyncing, pendingCount, syncSales } = useOfflineSync();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const { hasModule } = useTenant();
    const { t } = useTranslation();

    // Clear search on route change
    useEffect(() => {
        setSearchQuery('');
        setShowSearchResults(false);
    }, [location.pathname, location.search]);


    // Get user initials
    const getUserInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const handleLogout = () => {
        setShowUserMenu(false);
        logout();
        navigate('/login');
    };

    // Search functionality
    const [searchResults, setSearchResults] = useState<{
        products: any[];
        customers: any[];
        orders: any[];
        employees: any[];
        suppliers: any[];
        categories: any[];
        medications: any[];
        rooms: any[];
        bookings: any[];
        opportunities: any[];
        invoices: any[];
        sales: any[];
    }>({
        products: [],
        customers: [],
        orders: [],
        employees: [],
        suppliers: [],
        categories: [],
        medications: [],
        rooms: [],
        bookings: [],
        opportunities: [],
        invoices: [],
        sales: []
    });
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim().length === 0) {
                setSearchResults({
                    products: [],
                    customers: [],
                    orders: [],
                    employees: [],
                    suppliers: [],
                    categories: [],
                    medications: [],
                    rooms: [],
                    bookings: [],
                    opportunities: [],
                    invoices: [],
                    sales: []
                });
                return;
            }

            setIsSearching(true);
            try {
                // Execute searches in parallel
                const [
                    productsRes,
                    customersRes,
                    employeesRes,
                    ordersRes,
                    suppliersRes,
                    categoriesRes,
                    medicationsRes,
                    roomsRes,
                    bookingsRes,
                    opportunitiesRes,
                    invoicesRes,
                    salesRes
                ] = await Promise.all([
                    // Core/Inventory
                    hasModule('inventory') ? productsAPI.getAll({ search: searchQuery }).catch(() => []) : Promise.resolve([]),
                    hasModule('crm') || hasModule('inventory') ? customersAPI.getAll({ search: searchQuery }).catch(() => []) : Promise.resolve([]),
                    hasModule('hr') ? employeesAPI.getAll({ search: searchQuery }).catch(() => []) : Promise.resolve([]),
                    hasModule('inventory') && (ordersAPI as any).getAll ? (ordersAPI as any).getAll().then((res: any) => {
                        const allOrders = Array.isArray(res) ? res : (res.data || []);
                        return allOrders.filter((o: any) =>
                            o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    }).catch(() => []) : Promise.resolve([]),
                    hasModule('inventory') ? suppliersAPI.getAll({ search: searchQuery }).catch(() => []) : Promise.resolve([]),
                    hasModule('inventory') ? settingsAPI.getCategories().then((res: any) => {
                        const allCats = Array.isArray(res) ? res : (res.data || []);
                        return allCats.filter((c: any) =>
                            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.code?.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    }).catch(() => []) : Promise.resolve([]),

                    // Specialized Modules
                    hasModule('pharmacy') && (pharmacyAPI as any).getMedications ? (pharmacyAPI as any).getMedications({ search: searchQuery }).catch(() => []) : Promise.resolve([]),
                    hasModule('hospitality') && (hospitalityAPI as any).getRooms ? (hospitalityAPI as any).getRooms({ search: searchQuery }).catch(() => []) : Promise.resolve([]),
                    hasModule('hospitality') && (hospitalityAPI as any).getBookings ? (hospitalityAPI as any).getBookings().then((res: any) => {
                        const items = Array.isArray(res) ? res : (res.data || []);
                        return items.filter((b: any) =>
                            b.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            b.room?.number?.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    }).catch(() => []) : Promise.resolve([]),
                    hasModule('crm') && (crmAPI as any).getOpportunities ? (crmAPI as any).getOpportunities().then((res: any) => {
                        const items = Array.isArray(res) ? res : (res.data || []);
                        return items.filter((o: any) =>
                            o.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    }).catch(() => []) : Promise.resolve([]),
                    hasModule('invoices') && (invoicesAPI as any).getAll ? (invoicesAPI as any).getAll().then((res: any) => {
                        const items = Array.isArray(res) ? res : (res.data || []);
                        return items.filter((i: any) =>
                            i.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            i.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    }).catch(() => []) : Promise.resolve([]),
                    hasModule('pos') && (salesAPI as any).getAll ? (salesAPI as any).getAll().then((res: any) => {
                        const items = Array.isArray(res) ? res : (res.data || []);
                        return items.filter((s: any) =>
                            s.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    }).catch(() => []) : Promise.resolve([])
                ]);

                // Normalize results
                const getItems = (res: any) => {
                    const items = Array.isArray(res) ? res : (res.data || []);
                    return items.slice(0, 5);
                };

                setSearchResults({
                    products: getItems(productsRes),
                    customers: getItems(customersRes),
                    employees: getItems(employeesRes),
                    orders: getItems(ordersRes),
                    suppliers: getItems(suppliersRes),
                    categories: getItems(categoriesRes),
                    medications: getItems(medicationsRes),
                    rooms: getItems(roomsRes),
                    bookings: getItems(bookingsRes),
                    opportunities: getItems(opportunitiesRes),
                    invoices: getItems(invoicesRes),
                    sales: getItems(salesRes)
                });
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const hasResults = Object.values(searchResults).some(arr => arr.length > 0);

    const handleSearchItemClick = () => {
        setSearchQuery('');
        setShowSearchResults(false);
    };

    return (
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-dark-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300"
                    >
                        <HiOutlineMenu className="w-6 h-6" />
                    </button>

                    {/* Search Bar */}
                    <div className="hidden md:flex items-center relative">
                        <HiOutlineSearch className={`absolute left-3 w-5 h-5 ${isSearching ? 'text-primary-500 animate-pulse' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            placeholder={t('common.search') + '...'}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSearchResults(true);
                            }}
                            onFocus={() => setShowSearchResults(searchQuery.trim().length > 0)}
                            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                            className="w-80 pl-10 pr-4 py-2 rounded-xl bg-gray-100 dark:bg-dark-700 border-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500"
                        />

                        {/* Search Results Dropdown */}
                        {showSearchResults && searchQuery.trim().length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-200 dark:border-dark-700 overflow-hidden max-h-96 overflow-y-auto animate-slide-up">
                                {isSearching ? (
                                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        Pesquisando...
                                    </div>
                                ) : !hasResults ? (
                                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                        {t('messages.noResults')}
                                    </div>
                                ) : (
                                    <div className="py-2">
                                        {/* Products */}
                                        {searchResults.products.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <HiCube className="w-3.5 h-3.5" />
                                                    {t('products.title')}
                                                </div>
                                                {searchResults.products.map((product) => (
                                                    <Link
                                                        key={product.id}
                                                        to={`/inventory?search=${product.code}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-dark-700 text-gray-500 uppercase tracking-tight">PRODUTO</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {product.name}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {product.code} • {product.currentStock} em stock
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Medications (Pharmacy) */}
                                        {hasModule('pharmacy') && searchResults.medications.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <MdMedicalServices className="w-3.5 h-3.5" />
                                                    Farmácia
                                                </div>
                                                {searchResults.medications.map((med) => (
                                                    <Link
                                                        key={med.id}
                                                        to={`/pharmacy?search=${med.name}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 uppercase tracking-tight">MEDICAMENTO</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {med.name}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {med.concentration} • {med.dosageForm}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Hospitality (Rooms & Bookings) */}
                                        {hasModule('hospitality') && (searchResults.rooms.length > 0 || searchResults.bookings.length > 0) && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <MdHotel className="w-3.5 h-3.5" />
                                                    Hospitalidade
                                                </div>
                                                {searchResults.rooms.map((room) => (
                                                    <Link
                                                        key={room.id}
                                                        to={`/hotel/rooms?number=${room.number}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">QUARTO</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    Quarto {room.number}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {room.type} • {room.status}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                                {searchResults.bookings.map((booking) => (
                                                    <Link
                                                        key={booking.id}
                                                        to={`/hotel/reservations?search=${booking.customerName}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">RESERVA</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {booking.customerName}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                Quarto {booking.room?.number} • {booking.status}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Invoices & Sales */}
                                        {(hasModule('invoices') || hasModule('pos')) && (searchResults.invoices.length > 0 || searchResults.sales.length > 0) && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <MdReceiptLong className="w-3.5 h-3.5" />
                                                    Vendas & Facturas
                                                </div>
                                                {hasModule('invoices') && searchResults.invoices.map((inv) => (
                                                    <Link
                                                        key={inv.id}
                                                        to={`/invoices?search=${inv.invoiceNumber}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">FACTURA</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {inv.invoiceNumber}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {inv.customerName} • {inv.status}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                                {hasModule('pos') && searchResults.sales.map((sale) => (
                                                    <Link
                                                        key={sale.id}
                                                        to={`/financial?search=${sale.receiptNumber}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">VENDA</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {sale.receiptNumber}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {sale.customerName} • {sale.total} MT
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* CRM Opportunities */}
                                        {hasModule('crm') && searchResults.opportunities.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <MdShowChart className="w-3.5 h-3.5" />
                                                    Oportunidades (CRM)
                                                </div>
                                                {searchResults.opportunities.map((opp) => (
                                                    <Link
                                                        key={opp.id}
                                                        to={`/crm?search=${opp.title}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 uppercase tracking-tight">OPORTUNIDADE</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {opp.title}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {opp.customer?.name} • {opp.status}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Customers */}
                                        {searchResults.customers.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <HiUserGroup className="w-3.5 h-3.5" />
                                                    {t('customers.title')}
                                                </div>
                                                {searchResults.customers.map((customer) => (
                                                    <Link
                                                        key={customer.id}
                                                        to={`/customers?search=${customer.name}`}
                                                        onMouseDown={handleSearchItemClick}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 uppercase tracking-tight">CLIENTE</span>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {customer.name}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {customer.phone} • {customer.email || 'Sem email'}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Suppliers */}
                                        {searchResults.suppliers.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <HiOutlineTruck className="w-3.5 h-3.5" />
                                                    Fornecedores
                                                </div>
                                                {searchResults.suppliers.map((supplier) => (
                                                    <Link
                                                        key={supplier.id}
                                                        to="/suppliers"
                                                        onMouseDown={handleSearchItemClick}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {supplier.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {supplier.contactPerson} • {supplier.phone}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Categories */}
                                        {searchResults.categories.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <HiOutlineTag className="w-3.5 h-3.5" />
                                                    Categorias
                                                </div>
                                                {searchResults.categories.map((category) => (
                                                    <Link
                                                        key={category.id}
                                                        to="/categories"
                                                        onMouseDown={handleSearchItemClick}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {category.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {category.code}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Employees */}
                                        {searchResults.employees.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <HiOutlineUser className="w-3.5 h-3.5" />
                                                    Funcionários
                                                </div>
                                                {searchResults.employees.map((employee) => (
                                                    <Link
                                                        key={employee.id}
                                                        to="/employees"
                                                        onMouseDown={handleSearchItemClick}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {employee.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {employee.role}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}

                                        {/* Orders */}
                                        {searchResults.orders.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <HiShoppingBag className="w-3.5 h-3.5" />
                                                    {t('orders.title')}
                                                </div>
                                                {searchResults.orders.map((order) => (
                                                    <Link
                                                        key={order.id}
                                                        to="/orders"
                                                        onMouseDown={handleSearchItemClick}
                                                        className="w-full px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-primary-500"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {order.orderNumber}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {order.customerName}
                                                            </p>
                                                        </div>
                                                        <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-2">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300 transition-colors"
                        title={theme === 'light' ? t('settings.darkMode') : t('settings.lightMode')}
                    >
                        {theme === 'light' ? (
                            <HiOutlineMoon className="w-5 h-5" />
                        ) : (
                            <HiOutlineSun className="w-5 h-5" />
                        )}
                    </button>

                    {/* Language Selector */}
                    <LanguageSelector />

                    {/* Offline Sync Status */}
                    <div className="flex items-center">
                        {pendingCount > 0 ? (
                            <button
                                onClick={() => syncSales()}
                                disabled={!isOnline || isSyncing}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isOnline
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-dark-700'
                                    }`}
                                title={isOnline ? 'Sincronizar dados pendentes' : 'A aguardar ligação para sincronizar'}
                            >
                                <HiRefresh className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{pendingCount} Pendentes</span>
                            </button>
                        ) : (
                            <div
                                className={`p-2 rounded-xl transition-colors ${isOnline
                                    ? 'text-emerald-500'
                                    : 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                    }`}
                                title={isOnline ? 'Sistema Online' : 'Sistema Offline - Vendas serão guardadas localmente'}
                            >
                                {isOnline ? (
                                    <HiCloud className="w-5 h-5" />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <MdCloudOff className="w-5 h-5" />
                                        <span className="text-[10px] font-bold uppercase hidden sm:inline">Offline</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Notifications - Using new modular NotificationCenter */}
                    <NotificationBadge />


                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                    {user ? getUserInitials(user.name) : 'U'}
                                </span>
                            </div>
                            <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200">
                                {user?.name.split(' ')[0] || 'Utilizador'}
                            </span>
                        </button>

                        {/* User Dropdown */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-200 dark:border-dark-700 overflow-hidden animate-slide-up z-50">
                                <div className="p-3 border-b border-gray-200 dark:border-dark-700">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {user?.name || 'Utilizador'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {user?.email || ''}
                                    </p>
                                    {user?.role && (
                                        <span className="inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                                            {roleLabels[user.role]}
                                        </span>
                                    )}
                                </div>
                                <div className="p-1">
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                                    >
                                        <HiOutlineUser className="w-4 h-4" />
                                        {t('auth.myProfile')}
                                    </Link>
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                                    >
                                        <HiOutlineCog className="w-4 h-4" />
                                        {t('nav.settings')}
                                    </Link>
                                    <hr className="my-1 border-gray-200 dark:border-dark-700" />
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                    >
                                        <HiOutlineLogout className="w-4 h-4" />
                                        {t('auth.logout')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Click outside to close dropdowns */}
            {showUserMenu && (
                <div
                    className="fixed inset-0"
                    style={{ zIndex: 40 }}
                    onClick={() => setShowUserMenu(false)}
                />
            )}
        </header>
    );
}
