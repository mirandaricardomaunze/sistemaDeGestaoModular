import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { useAuthStore, roleLabels } from '../../stores/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useTenant } from '../../contexts/TenantContext';

import {
    HiOutlineHomeModern,
    HiOutlineCake
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
    HiOutlineClipboardList,
    HiOutlineViewGrid,
    HiOutlineQuestionMarkCircle,
    HiOutlineRefresh,
} from 'react-icons/hi';
import { cn } from '../../utils/helpers';

// Module codes from backend: pharmacy, inventory, hospitality, bottle_store, logistics

interface MenuItem {
    id: string;
    labelKey: string;
    icon: any;
    path: string;
    state?: any;
    module?: string;
    role?: string;
    submenu?: MenuItem[];
}

const menuItems: MenuItem[] = [
    // ============================================================================
    // PHARMACY Module - Specific pages (only for pharmacy businesses)
    // ============================================================================
    { id: 'pharmacy_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/pharmacy/dashboard', module: 'pharmacy' },
    { id: 'pharmacy_manage', labelKey: 'Gestão de Farmácia', icon: HiOutlineBeaker, path: '/pharmacy/manage', module: 'pharmacy' },
    { id: 'pharmacy_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/pharmacy/pos', module: 'pharmacy' },
    { id: 'pharmacy_employees', labelKey: 'Funcionários', icon: HiOutlineUsers, path: '/pharmacy/employees', module: 'pharmacy' },
    { id: 'pharmacy_categories', labelKey: 'Categorias', icon: HiOutlineTag, path: '/pharmacy/categories', module: 'pharmacy' },
    { id: 'pharmacy_suppliers', labelKey: 'Fornecedores', icon: HiOutlineTruck, path: '/pharmacy/suppliers', module: 'pharmacy' },
    { id: 'pharmacy_reports', labelKey: 'Relatórios', icon: HiOutlineChartBar, path: '/pharmacy/reports', module: 'pharmacy' },


    // ============================================================================
    // HOSPITALITY Module - Specific pages (only for hotel businesses)
    // ============================================================================
    { id: 'hotel_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/hospitality/dashboard', module: 'hospitality' },
    { id: 'hospitality_ops', labelKey: 'Gestão de Quartos', icon: HiOutlineHomeModern, path: '/hospitality/ops', module: 'hospitality' },
    { id: 'hotel_finance', labelKey: 'Finanças', icon: HiOutlineCurrencyDollar, path: '/hospitality/finance', module: 'hospitality' },
    { id: 'hotel_rooms', labelKey: 'Quartos', icon: HiOutlineHomeModern, path: '/hospitality/rooms', module: 'hospitality' },
    { id: 'hotel_reservations', labelKey: 'Reservas', icon: HiOutlineCalendar, path: '/hospitality/reservations', module: 'hospitality' },
    { id: 'hotel_employees', labelKey: 'Funcionários', icon: HiOutlineUsers, path: '/hospitality/employees', module: 'hospitality' },
    { id: 'hotel_customers', labelKey: 'Clientes / Hóspedes', icon: HiOutlineUsers, path: '/hospitality/customers', module: 'hospitality' },
    { id: 'hotel_suppliers', labelKey: 'Fornecedores', icon: HiOutlineTruck, path: '/hospitality/suppliers', module: 'hospitality' },
    { id: 'hotel_categories', labelKey: 'Categorias', icon: HiOutlineTag, path: '/hospitality/categories', module: 'hospitality' },
    { id: 'hotel_reports', labelKey: 'Relatórios', icon: HiOutlineChartBar, path: '/hospitality/reports', module: 'hospitality' },

    // ============================================================================
    // COMMERCIAL Module - Complete commerce management
    // ============================================================================
    { id: 'commercial_dashboard', labelKey: 'Dashboard', icon: HiOutlineViewGrid, path: '/commercial/dashboard', module: 'commercial' },
    { id: 'inventory', labelKey: 'nav.inventory', icon: HiOutlineCube, path: '/inventory', module: 'commercial' },
    { id: 'orders', labelKey: 'nav.orders', icon: HiOutlineClipboardList, path: '/orders', module: 'commercial' },
    { id: 'commercial_categories', labelKey: 'Categorias', icon: HiOutlineTag, path: '/commercial/categories', module: 'commercial' },
    { id: 'commercial_suppliers', labelKey: 'Fornecedores', icon: HiOutlineTruck, path: '/commercial/suppliers', module: 'commercial' },

    // ============================================================================
    // LOGISTICS Module - Specific pages (only for logistics businesses)
    // ============================================================================
    { id: 'logistics_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/logistics/dashboard', module: 'logistics' },
    { id: 'logistics_vehicles', labelKey: 'Veículos', icon: HiOutlineTruck, path: '/logistics/vehicles', module: 'logistics' },
    { id: 'logistics_drivers', labelKey: 'Motoristas', icon: HiOutlineUsers, path: '/logistics/drivers', module: 'logistics' },
    { id: 'logistics_routes', labelKey: 'Rotas', icon: HiOutlineChartBar, path: '/logistics/routes', module: 'logistics' },
    { id: 'logistics_deliveries', labelKey: 'Entregas', icon: HiOutlineClipboardList, path: '/logistics/deliveries', module: 'logistics' },
    { id: 'logistics_parcels', labelKey: 'Encomendas', icon: HiOutlineCube, path: '/logistics/parcels', module: 'logistics' },
    { id: 'logistics_maintenance', labelKey: 'Manutenção', icon: HiOutlineCog, path: '/logistics/maintenance', module: 'logistics' },
    { id: 'logistics_reports', labelKey: 'Relatórios', icon: HiOutlineDocumentText, path: '/logistics/reports', module: 'logistics' },

    // ============================================================================
    // BOTTLE_STORE Module - Specific page
    // ============================================================================
    { id: 'bottle_store_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/bottle-store/dashboard', module: 'bottle_store' },
    { id: 'bottle_store_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/bottle-store/pos', module: 'bottle_store' },
    { id: 'bottle_store_inventory', labelKey: 'Inventário', icon: HiOutlineCube, path: '/bottle-store/inventory', module: 'bottle_store' },
    { id: 'bottle_store_stock', labelKey: 'Movimentos de Stock', icon: HiOutlineRefresh, path: '/bottle-store/stock', module: 'bottle_store' },
    { id: 'bottle_store_reports', labelKey: 'Relatórios', icon: HiOutlineDocumentText, path: '/bottle-store/reports', module: 'bottle_store' },

    // ============================================================================
    // RESTAURANT Module - Specific pages
    // ============================================================================
    { id: 'restaurant_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineCake, path: '/restaurant/dashboard', module: 'restaurant' },
    { id: 'restaurant_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/restaurant/pos', module: 'restaurant' },
    { id: 'restaurant_tables', labelKey: 'Mesas', icon: HiOutlineCake, path: '/restaurant/tables', module: 'restaurant' },
    { id: 'restaurant_reports', labelKey: 'Relatórios', icon: HiOutlineDocumentText, path: '/restaurant/reports', module: 'restaurant' },


    // ============================================================================
    // CORE MODULES - Always available for all businesses (POS, CRM, HR, Invoices, Fiscal)
    // These are included with every company registration
    // ============================================================================
    { id: 'pos', labelKey: 'nav.pos', icon: HiOutlineShoppingCart, path: '/pos', module: 'pos' },
    { id: 'customers', labelKey: 'nav.customers', icon: HiOutlineUserGroup, path: '/customers', module: 'crm' },
    { id: 'crm', labelKey: 'nav.crm', icon: HiOutlineChartPie, path: '/crm', module: 'crm' },
    { id: 'employees', labelKey: 'nav.employees', icon: HiOutlineUsers, path: '/employees', module: 'hr' },
    { id: 'financial', labelKey: 'nav.financial', icon: HiOutlineCurrencyDollar, path: '/financial', module: 'financial' },
    { id: 'invoices', labelKey: 'nav.invoices', icon: HiOutlineDocumentText, path: '/invoices', module: 'invoices' },

    // ============================================================================
    // Common items - System features (always visible)
    // ============================================================================
    { id: 'alerts', labelKey: 'nav.alerts', icon: HiOutlineBell, path: '/alerts' },
    { id: 'fiscal', labelKey: 'nav.fiscal', icon: HiOutlineCalculator, path: '/fiscal', module: 'fiscal' },
    { id: 'reports', labelKey: 'nav.reports', icon: HiOutlineDocumentText, path: '/reports' },
    { id: 'audit', labelKey: 'nav.audit', icon: HiOutlineShieldCheck, path: '/audit' },
    { id: 'backups', labelKey: 'nav.backups', icon: HiOutlineDatabase, path: '/backups' },
    { id: 'help', labelKey: 'Ajuda', icon: HiOutlineQuestionMarkCircle, path: '/help' },
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
        // 1. Check permissions (RBAC)
        if (!canViewPage(item.path)) return false;

        // 2. Check active modules for this tenant
        const coreModules = ['pos', 'crm', 'hr', 'fiscal', 'invoices', 'financial', 'audit', 'alerts', 'settings', 'reports', 'backups', 'help'];
        const itemModule = (item as any).module;

        if (itemModule && !coreModules.includes(itemModule)) {
            const moduleActive = hasModule(itemModule);
            if (!moduleActive) return false;
        }

        const isPharmacyActive = hasModule('pharmacy');
        const isHospitalityActive = hasModule('hospitality');
        const isBottleStoreActive = hasModule('bottle_store');

        // 3. Special Case: POS - Hide generic POS if specialized POS is active (unless super_admin)
        if (user?.role !== 'super_admin' && item.id === 'pos' && (isPharmacyActive || isHospitalityActive || isBottleStoreActive)) {
            return false;
        }

        // 4. Special Case: Inventory/Commercial - Hide if specialized module is active (unless super_admin)
        if (user?.role !== 'super_admin' && item.module === 'commercial' && (isPharmacyActive || isHospitalityActive)) {
            return false;
        }

        // 5. Special Case: Super Admin - ONLY super_admin role
        if (item.id === 'super_admin' && user?.role !== 'super_admin') {
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
                <div className="flex items-center justify-between h-18 px-4 border-b border-gray-100 dark:border-dark-700/50 flex-shrink-0 bg-white/50 dark:bg-dark-800/50 backdrop-blur-md">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {companySettings.logo ? (
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                <img
                                    src={companySettings.logo}
                                    alt="Logo"
                                    className="relative w-10 h-10 rounded-xl object-contain bg-white shadow-sm shrink-0"
                                />
                            </div>
                        ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0 transform transition-transform hover:scale-105">
                                <span className="text-white font-black text-xl tracking-tighter">
                                    {(companySettings.tradeName || companySettings.companyName || 'S').charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}

                        {sidebarOpen && (
                            <div className="animate-fade-in min-w-0 ml-1">
                                <h1 className="font-extrabold text-base tracking-tight text-gray-900 dark:text-white truncate leading-none mb-1">
                                    {companySettings.tradeName || companySettings.companyName || 'MULTICORE'}
                                </h1>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 truncate">
                                        {companySettings.businessType ? t(`businessType.${companySettings.businessType}`) : 'Modular ERP'}
                                    </p>
                                </div>
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
                                        state={item.state}
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
