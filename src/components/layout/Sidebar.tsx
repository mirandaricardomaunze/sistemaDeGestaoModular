import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { useAuthStore, roleLabels } from '../../stores/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useTenant } from '../../contexts/TenantContext';
import {
    HiOutlineHomeModern,
} from 'react-icons/hi2';
import {
    HiOutlineCube,
    HiOutlineShoppingCart,
    HiOutlineUsers,
    HiOutlineCurrencyDollar,
    HiOutlineTruck,
    HiOutlineBell,
    HiOutlineDocumentText,
    HiOutlineCog,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineUserGroup,
    HiOutlineTag,
    HiOutlineLogout,
    HiOutlineCalculator,
    HiOutlineShieldCheck,
    HiOutlineChartPie,
    HiOutlineDatabase,
    HiOutlineChartBar,
    HiOutlineBeaker,
    HiOutlineCalendar,
} from 'react-icons/hi';
import { cn } from '../../utils/helpers';

// Module codes from backend: PHARMACY, COMMERCIAL, BOTTLE_STORE, HOTEL, LOGISTICS

interface MenuItem {
    id: string;
    labelKey: string;
    icon: any;
    path: string;
    module?: string;
    role?: string;
    submenu?: MenuItem[];
}

const menuItems: MenuItem[] = [
    // PHARMACY Module - Direct Links (No Submenu)
    { id: 'pharmacy_dashboard', labelKey: 'Dashboard', icon: HiOutlineChartBar, path: '/pharmacy/dashboard', module: 'PHARMACY' },
    { id: 'pharmacy_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/pharmacy/pos', module: 'PHARMACY' },
    { id: 'pharmacy_mgmt', labelKey: 'Gestão Farmácia', icon: HiOutlineBeaker, path: '/pharmacy', module: 'PHARMACY' },
    { id: 'pharmacy_employees', labelKey: 'Funcionários', icon: HiOutlineUsers, path: '/pharmacy/employees', module: 'PHARMACY' },
    { id: 'pharmacy_categories', labelKey: 'Categorias', icon: HiOutlineTag, path: '/pharmacy/categories', module: 'PHARMACY' },
    { id: 'pharmacy_suppliers', labelKey: 'Fornecedores', icon: HiOutlineTruck, path: '/pharmacy/suppliers', module: 'PHARMACY' },

    // HOTEL Module - Direct Links (No Submenu)
    { id: 'hotel_dashboard', labelKey: 'Dashboard', icon: HiOutlineChartBar, path: '/hotel', module: 'HOTEL' },
    { id: 'hotel_finance', labelKey: 'Finanças', icon: HiOutlineCurrencyDollar, path: '/hotel/finance', module: 'HOTEL' },
    { id: 'hotel_rooms', labelKey: 'Quartos', icon: HiOutlineHomeModern, path: '/hotel/rooms', module: 'HOTEL' },
    { id: 'hotel_reservations', labelKey: 'Reservas', icon: HiOutlineCalendar, path: '/hotel/reservations', module: 'HOTEL' },
    { id: 'hotel_customers', labelKey: 'Hóspedes', icon: HiOutlineUserGroup, path: '/hotel/customers', module: 'HOTEL' },
    { id: 'hotel_suppliers', labelKey: 'Fornecedores', icon: HiOutlineTruck, path: '/hotel/suppliers', module: 'HOTEL' },
    { id: 'hotel_categories', labelKey: 'Categorias', icon: HiOutlineTag, path: '/hotel/categories', module: 'HOTEL' },
    { id: 'hotel_employees', labelKey: 'Funcionários', icon: HiOutlineUsers, path: '/hotel/employees', module: 'HOTEL' },

    // LOGISTICS Module
    { id: 'logistics_dash', labelKey: 'Dashboard Logística', icon: HiOutlineTruck, path: '/logistics', module: 'LOGISTICS' },
    { id: 'orders', labelKey: 'nav.orders', icon: HiOutlineTruck, path: '/orders', module: 'LOGISTICS' },

    // COMMERCIAL Module (general commerce)
    { id: 'inventory', labelKey: 'nav.inventory', icon: HiOutlineCube, path: '/inventory', module: 'COMMERCIAL' },
    { id: 'categories', labelKey: 'nav.categories', icon: HiOutlineTag, path: '/categories', module: 'COMMERCIAL' },
    { id: 'pos', labelKey: 'nav.pos', icon: HiOutlineShoppingCart, path: '/pos', module: 'COMMERCIAL' },
    { id: 'suppliers', labelKey: 'nav.suppliers', icon: HiOutlineTruck, path: '/suppliers', module: 'COMMERCIAL' },
    { id: 'customers', labelKey: 'nav.customers', icon: HiOutlineUserGroup, path: '/customers', module: 'COMMERCIAL' },
    { id: 'crm', labelKey: 'nav.crm', icon: HiOutlineChartPie, path: '/crm', module: 'COMMERCIAL' },
    { id: 'employees', labelKey: 'nav.employees', icon: HiOutlineUsers, path: '/employees', module: 'COMMERCIAL' },
    { id: 'financial', labelKey: 'nav.financial', icon: HiOutlineCurrencyDollar, path: '/financial', module: 'COMMERCIAL' },
    { id: 'fiscal', labelKey: 'nav.fiscal', icon: HiOutlineCalculator, path: '/fiscal', module: 'COMMERCIAL' },
    { id: 'invoices', labelKey: 'nav.invoices', icon: HiOutlineDocumentText, path: '/invoices', module: 'COMMERCIAL' },

    // BOTTLE_STORE Module
    { id: 'bottle_store', labelKey: 'Garrafeira', icon: HiOutlineCube, path: '/bottle-store', module: 'BOTTLE_STORE' },

    // Common items (no module restriction)
    { id: 'alerts', labelKey: 'nav.alerts', icon: HiOutlineBell, path: '/alerts' },
    { id: 'reports', labelKey: 'nav.reports', icon: HiOutlineDocumentText, path: '/reports' },
    { id: 'audit', labelKey: 'nav.audit', icon: HiOutlineShieldCheck, path: '/audit' },
    { id: 'backups', labelKey: 'nav.backups', icon: HiOutlineDatabase, path: '/backups' },
    { id: 'settings', labelKey: 'nav.settings', icon: HiOutlineCog, path: '/settings' },

    // Super Admin Section
    { id: 'super_admin', labelKey: 'Administração do Sistema', icon: HiOutlineShieldCheck, path: '/super-admin', role: 'super_admin' },
];

export default function Sidebar() {
    const navigate = useNavigate();
    const { sidebarOpen, toggleSidebar, alerts, companySettings } = useStore();
    const { user, logout } = useAuthStore();
    const { canViewPage } = usePermissions();
    const location = useLocation();
    const { t } = useTranslation();
    const { hasModule } = useTenant();
    const unreadAlerts = alerts.filter((a) => !a.isRead).length;

    // State for expanded submenus
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

    const toggleSubmenu = (menuId: string) => {
        setExpandedMenus(prev =>
            prev.includes(menuId)
                ? prev.filter(id => id !== menuId)
                : [...prev, menuId]
        );
    };

    // Auto-expand submenu if current path matches a submenu item
    useEffect(() => {
        menuItems.forEach(item => {
            if (item.submenu) {
                const hasActiveSubmenu = item.submenu.some(sub => location.pathname === sub.path);
                if (hasActiveSubmenu && !expandedMenus.includes(item.id)) {
                    setExpandedMenus(prev => [...prev, item.id]);
                }
            }
        });
    }, [location.pathname]);

    const filteredMenuItems = menuItems.filter(item => {
        // 1. Check permissions
        if (!canViewPage(item.path)) return false;

        // 2. Check active modules for this tenant
        if ((item as any).module && !hasModule((item as any).module)) {
            // Special protection for cross-company data isolation
            return false;
        }

        return true;
    });

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
        logout();
        navigate('/login');
    };

    return (
        <>
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed top-0 left-0 h-full bg-white dark:bg-dark-800 shadow-xl z-50 transition-all duration-300 flex flex-col',
                    sidebarOpen ? 'w-64' : 'w-20',
                    'transform lg:translate-x-0',
                    !sidebarOpen && 'max-lg:-translate-x-full'
                )}
            >
                {/* Logo / Brand */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-dark-700 flex-shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {companySettings.logo ? (
                            <img
                                src={companySettings.logo}
                                alt="Logo"
                                className="w-10 h-10 rounded-xl object-contain bg-white shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center shadow-lg shrink-0">
                                <span className="text-white font-bold text-lg">
                                    {(companySettings.tradeName || companySettings.companyName || 'S').charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}

                        {sidebarOpen && (
                            <div className="animate-fade-in min-w-0">
                                <h1 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                                    {companySettings.tradeName || companySettings.companyName || 'Sistema'}
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    Gestão Empresarial
                                </p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={toggleSidebar}
                        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 transition-colors"
                    >
                        {sidebarOpen ? (
                            <HiOutlineChevronLeft className="w-5 h-5" />
                        ) : (
                            <HiOutlineChevronRight className="w-5 h-5" />
                        )}
                    </button>
                </div>

                {/* Navigation - scrollable area */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hidden">
                    {filteredMenuItems.map((item) => {
                        const hasSubmenu = item.submenu && item.submenu.length > 0;
                        const isExpanded = expandedMenus.includes(item.id);
                        const isActive = location.pathname === item.path;
                        const isSubmenuActive = hasSubmenu && item.submenu?.some(sub => location.pathname === sub.path);
                        const Icon = item.icon;
                        const showBadge = item.id === 'alerts' && unreadAlerts > 0;

                        return (
                            <div key={item.id}>
                                {/* Main Menu Item */}
                                {hasSubmenu ? (
                                    <button
                                        onClick={() => toggleSubmenu(item.id)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative group',
                                            isSubmenuActive || isExpanded
                                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium shadow-sm'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-primary-600 dark:hover:text-primary-400'
                                        )}
                                    >
                                        <Icon
                                            className={cn(
                                                'w-6 h-6 flex-shrink-0',
                                                (isSubmenuActive || isExpanded) && 'text-primary-600 dark:text-primary-400'
                                            )}
                                        />
                                        {sidebarOpen && (
                                            <>
                                                <span className="animate-fade-in truncate flex-1 text-left">{t(item.labelKey)}</span>
                                                <HiOutlineChevronRight
                                                    className={cn(
                                                        'w-5 h-5 transition-transform duration-200',
                                                        isExpanded && 'rotate-90'
                                                    )}
                                                />
                                            </>
                                        )}

                                        {/* Tooltip for collapsed sidebar */}
                                        {!sidebarOpen && (
                                            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 dark:bg-dark-600 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                                                {t(item.labelKey)}
                                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-dark-600" />
                                            </div>
                                        )}
                                    </button>
                                ) : (
                                    <NavLink
                                        to={item.path}
                                        className={cn(
                                            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative group',
                                            isActive
                                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium shadow-sm'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-primary-600 dark:hover:text-primary-400'
                                        )}
                                    >
                                        <Icon
                                            className={cn(
                                                'w-6 h-6 flex-shrink-0',
                                                isActive && 'text-primary-600 dark:text-primary-400'
                                            )}
                                        />
                                        {sidebarOpen && (
                                            <span className="animate-fade-in truncate">{t(item.labelKey)}</span>
                                        )}
                                        {showBadge && (
                                            <span
                                                className={cn(
                                                    'absolute flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full',
                                                    sidebarOpen ? 'right-3' : 'top-1 right-1'
                                                )}
                                            >
                                                {unreadAlerts > 9 ? '9+' : unreadAlerts}
                                            </span>
                                        )}

                                        {/* Tooltip for collapsed sidebar */}
                                        {!sidebarOpen && (
                                            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 dark:bg-dark-600 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                                                {t(item.labelKey)}
                                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-dark-600" />
                                            </div>
                                        )}
                                    </NavLink>
                                )}

                                {/* Submenu Items */}
                                {hasSubmenu && sidebarOpen && isExpanded && (
                                    <div className="mt-1 ml-4 space-y-1 animate-fade-in">
                                        {item.submenu?.map((subItem) => {
                                            const subIsActive = location.pathname === subItem.path;
                                            const SubIcon = subItem.icon;

                                            return (
                                                <NavLink
                                                    key={subItem.id}
                                                    to={subItem.path}
                                                    className={cn(
                                                        'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm',
                                                        subIsActive
                                                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700/50 hover:text-primary-600 dark:hover:text-primary-400'
                                                    )}
                                                >
                                                    <SubIcon className="w-5 h-5 flex-shrink-0" />
                                                    <span className="truncate">{t(subItem.labelKey)}</span>
                                                </NavLink>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Footer - User Card with Logout */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800">
                    {sidebarOpen ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center">
                                    <span className="text-white font-semibold text-sm">
                                        {user ? getUserInitials(user.name) : 'U'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {user?.name || 'Utilizador'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {user?.role ? roleLabels[user.role] : ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <HiOutlineLogout className="w-4 h-4" />
                                {t('auth.logout')}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors group relative"
                            title={t('auth.logout')}
                        >
                            <HiOutlineLogout className="w-6 h-6" />
                            {/* Tooltip */}
                            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 dark:bg-dark-600 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                                {t('auth.logout')}
                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-dark-600" />
                            </div>
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
}
