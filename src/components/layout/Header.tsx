import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { useAuthStore, roleLabels } from '../../stores/useAuthStore';
import {
    HiOutlineMenu,
    HiOutlineBell,
    HiOutlineSearch,
    HiOutlineMoon,
    HiOutlineSun,
    HiOutlineLogout,
    HiOutlineUser,
    HiOutlineCog,
    HiRefresh,
    HiOutlineTruck,
    HiOutlineTag,
} from 'react-icons/hi';
import { formatRelativeTime } from '../../utils/helpers';
import LanguageSelector from '../common/LanguageSelector';

import { useAlerts } from '../../hooks/useData';
import {
    productsAPI,
    customersAPI,
    employeesAPI,
    ordersAPI,
    suppliersAPI,
    settingsAPI
} from '../../services/api';
import { HiCube, HiUserGroup, HiShoppingBag, HiCloud } from 'react-icons/hi2';
import { MdCloudOff } from 'react-icons/md';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export default function Header() {
    const navigate = useNavigate();
    const { theme, toggleTheme, toggleSidebar } = useStore();
    const { user, logout } = useAuthStore();
    const { alerts, unreadCount, markAsRead, markAllAsRead } = useAlerts();
    const { isOnline, isSyncing, pendingCount, syncSales } = useOfflineSync();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const { t } = useTranslation();


    const recentAlerts = alerts.slice(0, 5);

    const priorityColors = {
        critical: 'bg-red-500',
        high: 'bg-orange-500',
        medium: 'bg-yellow-500',
        low: 'bg-blue-500',
    };

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
    }>({ products: [], customers: [], orders: [], employees: [], suppliers: [], categories: [] });
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim().length === 0) {
                setSearchResults({ products: [], customers: [], orders: [], employees: [], suppliers: [], categories: [] });
                return;
            }

            setIsSearching(true);
            try {
                // Execute searches in parallel
                const [productsRes, customersRes, employeesRes, ordersRes, suppliersRes, categoriesRes] = await Promise.all([
                    // Search Products
                    productsAPI.getAll({ search: searchQuery }).catch(() => []),
                    // Search Customers
                    customersAPI.getAll({ search: searchQuery }).catch(() => []),
                    // Search Employees
                    employeesAPI.getAll({ search: searchQuery }).catch(() => []),
                    // Search Orders
                    ordersAPI.getAll ? ordersAPI.getAll().then(res => {
                        const allOrders = Array.isArray(res) ? res : (res.data || []);
                        return allOrders.filter((o: any) =>
                            o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).slice(0, 5);
                    }).catch(() => []) : Promise.resolve([]),
                    // Search Suppliers
                    suppliersAPI.getAll({ search: searchQuery }).catch(() => []),
                    // Search Categories (fetch all and filter)
                    settingsAPI.getCategories().then(res => {
                        const allCats = Array.isArray(res) ? res : (res.data || []);
                        return allCats.filter((c: any) =>
                            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.code?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).slice(0, 5);
                    }).catch(() => [])
                ]);

                // Normalize results (handle pagination wrapper if present)
                const getItems = (res: any) => {
                    const items = Array.isArray(res) ? res : (res.data || []);
                    return items.slice(0, 5); // Limit to 5 items per category
                };

                setSearchResults({
                    products: getItems(productsRes),
                    customers: getItems(customersRes),
                    employees: getItems(employeesRes),
                    orders: ordersRes,  // Already filtered and sliced
                    suppliers: getItems(suppliersRes),
                    categories: categoriesRes // Already filtered and sliced
                });
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const hasResults = searchResults.products.length > 0 ||
        searchResults.customers.length > 0 ||
        searchResults.orders.length > 0 ||
        searchResults.employees.length > 0 ||
        searchResults.suppliers.length > 0 ||
        searchResults.categories.length > 0;

    const handleSearchItemClick = (path: string) => {
        navigate(path);
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
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    {t('products.title')}
                                                </div>
                                                {searchResults.products.map((product) => (
                                                    <button
                                                        key={product.id}
                                                        onMouseDown={() => handleSearchItemClick('/inventory')}
                                                        className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3 text-left transition-colors"
                                                    >
                                                        <HiCube className="w-5 h-5 text-primary-500" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {product.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {product.code} • {product.currentStock} em stock
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Customers */}
                                        {searchResults.customers.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    {t('customers.title')}
                                                </div>
                                                {searchResults.customers.map((customer) => (
                                                    <button
                                                        key={customer.id}
                                                        onMouseDown={() => handleSearchItemClick('/customers')}
                                                        className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3 text-left transition-colors"
                                                    >
                                                        <HiUserGroup className="w-5 h-5 text-secondary-500" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {customer.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {customer.phone} • {customer.email || 'Sem email'}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Suppliers */}
                                        {searchResults.suppliers.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Fornecedores
                                                </div>
                                                {searchResults.suppliers.map((supplier) => (
                                                    <button
                                                        key={supplier.id}
                                                        onMouseDown={() => handleSearchItemClick('/suppliers')}
                                                        className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3 text-left transition-colors"
                                                    >
                                                        <HiOutlineTruck className="w-5 h-5 text-indigo-500" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {supplier.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {supplier.contactPerson} • {supplier.phone}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Categories */}
                                        {searchResults.categories.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Categorias
                                                </div>
                                                {searchResults.categories.map((category) => (
                                                    <button
                                                        key={category.id}
                                                        onMouseDown={() => handleSearchItemClick('/categories')}
                                                        className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3 text-left transition-colors"
                                                    >
                                                        <HiOutlineTag className="w-5 h-5 text-pink-500" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {category.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {category.code}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Employees */}
                                        {searchResults.employees.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Funcionários
                                                </div>
                                                {searchResults.employees.map((employee) => (
                                                    <button
                                                        key={employee.id}
                                                        onMouseDown={() => handleSearchItemClick('/employees')}
                                                        className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3 text-left transition-colors"
                                                    >
                                                        <HiOutlineUser className="w-5 h-5 text-purple-500" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {employee.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {employee.role}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Orders */}
                                        {searchResults.orders.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    {t('orders.title')}
                                                </div>
                                                {searchResults.orders.map((order) => (
                                                    <button
                                                        key={order.id}
                                                        onMouseDown={() => handleSearchItemClick('/orders')}
                                                        className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3 text-left transition-colors"
                                                    >
                                                        <HiShoppingBag className="w-5 h-5 text-accent-500" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {order.orderNumber}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {order.customerName}
                                                            </p>
                                                        </div>
                                                    </button>
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

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowNotifications(!showNotifications);
                                setShowUserMenu(false);
                            }}
                            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300 transition-colors relative"
                        >
                            <HiOutlineBell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-dark-700 overflow-hidden animate-slide-up">
                                <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            {t('nav.alerts')}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={() => markAllAsRead()}
                                                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                                >
                                                    {t('alerts.markAsRead')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                                    {recentAlerts.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                            {t('messages.noResults')}
                                        </div>
                                    ) : (
                                        recentAlerts.map((alert) => (
                                            <div
                                                key={alert.id}
                                                onClick={() => {
                                                    if (!alert.isRead) markAsRead(alert.id);
                                                }}
                                                className={`p-4 border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors cursor-pointer ${!alert.isRead ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${priorityColors[alert.priority]
                                                            }`}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {alert.title}
                                                            </p>
                                                            {!alert.isRead && (
                                                                <span className="w-2 h-2 rounded-full bg-primary-600"></span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                            {alert.message}
                                                        </p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                            {formatRelativeTime(alert.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <Link
                                    to="/alerts"
                                    onClick={() => setShowNotifications(false)}
                                    className="block p-3 text-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                                >
                                    {t('alerts.title')}
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowUserMenu(!showUserMenu);
                                setShowNotifications(false);
                            }}
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
            {(showNotifications || showUserMenu) && (
                <div
                    className="fixed inset-0"
                    style={{ zIndex: 40 }}
                    onClick={() => {
                        setShowNotifications(false);
                        setShowUserMenu(false);
                    }}
                />
            )}
        </header>
    );
}
