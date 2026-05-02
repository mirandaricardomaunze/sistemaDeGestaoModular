import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useStore, MODULE_TO_BUSINESS_TYPE } from '../../stores/useStore';
import { useAuthStore, roleLabels } from '../../stores/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useTenant } from '../../contexts/TenantContext';



import {
    HiOutlineHomeModern,
    HiOutlineCake,
    HiOutlineRectangleStack,
    HiOutlineFire,
    HiOutlineCube,
    HiOutlineShoppingCart,
    HiOutlineUsers,
    HiOutlineCurrencyDollar,
    HiOutlineTruck,
    HiOutlineBell,
    HiOutlineDocumentText,
    HiOutlineCog6Tooth as HiOutlineCog,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineUserGroup,
    HiOutlineTag,
    HiOutlineArrowRightOnRectangle as HiOutlineLogout,
    HiOutlineCalculator,
    HiOutlineShieldCheck,
    HiOutlineChartPie,
    HiOutlineCircleStack,
    HiOutlineChartBar,
    HiOutlineBeaker,
    HiOutlineCalendar,
    HiOutlineClipboardDocumentList as HiOutlineClipboardList,
    HiOutlinePencilSquare as HiOutlinePencilAlt,
    HiOutlineSquares2X2 as HiOutlineViewGrid,
    HiOutlineQuestionMarkCircle,
    HiOutlineArrowPath as HiOutlineRefresh,
    HiOutlineClock,
    HiOutlineExclamationCircle,
    HiOutlineUserCircle,
    HiOutlineDocumentChartBar as HiOutlineDocumentReport,
    HiOutlineBookOpen,
    HiSparkles,
} from 'react-icons/hi2';

import { cn } from '../../utils/helpers';

// Module codes from backend: pharmacy, inventory, hospitality, bottle_store, logistics

// ============================================================================
// MODULE COLOR THEMES - Each module gets a distinct sidebar accent
// ============================================================================
interface ModuleTheme {
    // Active item background + text
    activeBg: string;
    activeText: string;
    activeIconText: string;
    // Hover state
    hoverText: string;
    // Brand badge gradient
    brandGradient: string;
    brandShadow: string;
    // Submenu active
    subActiveBg: string;
    subActiveText: string;
    // Sidebar accent line/dot
    dotColor: string;
    // Subtitle label
    labelBg: string;
    labelText: string;
}

const MODULE_THEMES: Record<string, ModuleTheme> = {
    pharmacy: {
        activeBg: 'bg-teal-50 dark:bg-teal-900/20',
        activeText: 'text-teal-700 dark:text-teal-400',
        activeIconText: 'text-teal-600 dark:text-teal-400',
        hoverText: 'hover:text-teal-600 dark:hover:text-teal-400',
        brandGradient: 'from-teal-600 via-teal-500 to-emerald-500',
        brandShadow: 'shadow-teal-500/20',
        subActiveBg: 'bg-teal-100 dark:bg-teal-900/30',
        subActiveText: 'text-teal-800 dark:text-teal-300',
        dotColor: 'bg-teal-500',
        labelBg: 'bg-teal-100/50 dark:bg-teal-900/20',
        labelText: 'text-teal-700 dark:text-teal-400',
    },
    commercial: {
        activeBg: 'bg-blue-50 dark:bg-blue-900/20',
        activeText: 'text-blue-700 dark:text-blue-400',
        activeIconText: 'text-blue-600 dark:text-blue-400',
        hoverText: 'hover:text-blue-600 dark:hover:text-blue-400',
        brandGradient: 'from-blue-600 via-blue-500 to-indigo-500',
        brandShadow: 'shadow-blue-500/20',
        subActiveBg: 'bg-blue-100 dark:bg-blue-900/30',
        subActiveText: 'text-blue-800 dark:text-blue-300',
        dotColor: 'bg-blue-500',
        labelBg: 'bg-blue-100/50 dark:bg-blue-900/20',
        labelText: 'text-blue-700 dark:text-blue-400',
    },
    hospitality: {
        activeBg: 'bg-amber-50 dark:bg-amber-900/20',
        activeText: 'text-amber-700 dark:text-amber-400',
        activeIconText: 'text-amber-600 dark:text-amber-400',
        hoverText: 'hover:text-amber-600 dark:hover:text-amber-400',
        brandGradient: 'from-amber-600 via-amber-500 to-yellow-500',
        brandShadow: 'shadow-amber-500/20',
        subActiveBg: 'bg-amber-100 dark:bg-amber-900/30',
        subActiveText: 'text-amber-800 dark:text-amber-300',
        dotColor: 'bg-amber-500',
        labelBg: 'bg-amber-100/50 dark:bg-amber-900/20',
        labelText: 'text-amber-700 dark:text-amber-400',
    },
    bottle_store: {
        activeBg: 'bg-orange-50 dark:bg-orange-900/20',
        activeText: 'text-orange-700 dark:text-orange-400',
        activeIconText: 'text-orange-600 dark:text-orange-400',
        hoverText: 'hover:text-orange-600 dark:hover:text-orange-400',
        brandGradient: 'from-orange-600 via-orange-500 to-amber-500',
        brandShadow: 'shadow-orange-500/20',
        subActiveBg: 'bg-orange-100 dark:bg-orange-900/30',
        subActiveText: 'text-orange-800 dark:text-orange-300',
        dotColor: 'bg-orange-500',
        labelBg: 'bg-orange-100/50 dark:bg-orange-900/20',
        labelText: 'text-orange-700 dark:text-orange-400',
    },
    logistics: {
        activeBg: 'bg-cyan-50 dark:bg-cyan-900/20',
        activeText: 'text-cyan-700 dark:text-cyan-400',
        activeIconText: 'text-cyan-600 dark:text-cyan-400',
        hoverText: 'hover:text-cyan-600 dark:hover:text-cyan-400',
        brandGradient: 'from-cyan-600 via-cyan-500 to-sky-500',
        brandShadow: 'shadow-cyan-500/20',
        subActiveBg: 'bg-cyan-100 dark:bg-cyan-900/30',
        subActiveText: 'text-cyan-800 dark:text-teal-300',
        dotColor: 'bg-cyan-500',
        labelBg: 'bg-cyan-100/50 dark:bg-cyan-900/20',
        labelText: 'text-cyan-700 dark:text-cyan-400',
    },
    restaurant: {
        activeBg: 'bg-rose-50 dark:bg-rose-900/20',
        activeText: 'text-rose-600 dark:text-rose-400',
        activeIconText: 'text-rose-600 dark:text-rose-400',
        hoverText: 'hover:text-rose-600 dark:hover:text-rose-400',
        brandGradient: 'from-rose-600 via-rose-500 to-red-500',
        brandShadow: 'shadow-rose-500/20',
        subActiveBg: 'bg-rose-100 dark:bg-rose-900/30',
        subActiveText: 'text-rose-800 dark:text-rose-300',
        dotColor: 'bg-rose-500',
        labelBg: 'bg-rose-50 dark:bg-rose-900/20',
        labelText: 'text-rose-600 dark:text-rose-400',
    },
};

const DEFAULT_THEME: ModuleTheme = {
    activeBg: 'bg-primary-50 dark:bg-primary-900/20',
    activeText: 'text-primary-700 dark:text-primary-400',
    activeIconText: 'text-primary-600 dark:text-primary-400',
    hoverText: 'hover:text-primary-600 dark:hover:text-primary-400',
    brandGradient: 'from-primary-600 via-primary-500 to-indigo-500',
    brandShadow: 'shadow-primary-500/20',
    subActiveBg: 'bg-primary-100 dark:bg-primary-900/30',
    subActiveText: 'text-primary-800 dark:text-primary-300',
    dotColor: 'bg-emerald-500',
    labelBg: 'bg-primary-50 dark:bg-primary-900/20',
    labelText: 'text-primary-700 dark:text-primary-400',
};

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
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/dashboard' },

    // ============================================================================
    // PHARMACY Module - 7 focused items
    // ============================================================================
    { id: 'pharmacy_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/pharmacy/dashboard', module: 'pharmacy' },
    { id: 'pharmacy_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/pharmacy/pos', module: 'pharmacy' },
    { id: 'pharmacy_shifts', labelKey: 'Turnos', icon: HiOutlineCalculator, path: '/pharmacy/shifts', module: 'pharmacy' },
    { id: 'pharmacy_history', labelKey: 'Histórico', icon: HiOutlineClock, path: '/pharmacy/history', module: 'pharmacy' },
    { id: 'pharmacy_manage', labelKey: 'Medicamentos', icon: HiOutlineBeaker, path: '/pharmacy/manage', module: 'pharmacy' },
    { id: 'pharmacy_patients', labelKey: 'Pacientes', icon: HiOutlineUserCircle, path: '/pharmacy/patients', module: 'pharmacy' },
    { id: 'pharmacy_employees', labelKey: 'Recursos Humanos', icon: HiOutlineUsers, path: '/pharmacy/employees', module: 'pharmacy' },
    { id: 'pharmacy_compliance', labelKey: 'Conformidade', icon: HiOutlineClipboardList, path: '/pharmacy/compliance', module: 'pharmacy' },
    { id: 'pharmacy_partners', labelKey: 'Parceiros', icon: HiOutlineCurrencyDollar, path: '/pharmacy/partners', module: 'pharmacy' },
    { id: 'pharmacy_finance', labelKey: 'Financeiro', icon: HiOutlineCurrencyDollar, path: '/pharmacy/finance', module: 'pharmacy' },
    { id: 'pharmacy_reconciliation', labelKey: 'Reconciliação', icon: HiOutlineClipboardList, path: '/pharmacy/reconciliation', module: 'pharmacy' },
    { id: 'pharmacy_reports', labelKey: 'Relatórios', icon: HiOutlineChartBar, path: '/pharmacy/reports', module: 'pharmacy' },
    { id: 'pharmacy_alerts', labelKey: 'Alertas', icon: HiOutlineExclamationCircle, path: '/pharmacy/alerts', module: 'pharmacy' },


    // ============================================================================
    // HOSPITALITY Module - Specific pages (only for hotel businesses)
    // ============================================================================
    { id: 'hotel_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/hospitality/dashboard', module: 'hospitality' },
    { id: 'hotel_rooms', labelKey: 'hotel_module.rooms.title', icon: HiOutlineHomeModern, path: '/hospitality/rooms', module: 'hospitality' },
    { id: 'hotel_reservations', labelKey: 'hotel_module.reservations.title', icon: HiOutlineCalendar, path: '/hospitality/reservations', module: 'hospitality' },
    { id: 'hotel_housekeeping', labelKey: 'hotel_module.housekeeping.title', icon: HiSparkles, path: '/hospitality/housekeeping', module: 'hospitality' },
    { id: 'hotel_customers', labelKey: 'hotel_module.guests.title', icon: HiOutlineUsers, path: '/hospitality/customers', module: 'hospitality' },
    { id: 'hotel_finance', labelKey: 'hotel_module.finance.title', icon: HiOutlineCurrencyDollar, path: '/hospitality/finance', module: 'hospitality' },
    { id: 'hotel_employees', labelKey: 'nav.employees', icon: HiOutlineUsers, path: '/hospitality/employees', module: 'hospitality' },
    { id: 'hotel_reports', labelKey: 'nav.reports', icon: HiOutlineChartBar, path: '/hospitality/reports', module: 'hospitality' },
    { id: 'hospitality_ops', labelKey: 'Legacy (Ops)', icon: HiOutlineCog, path: '/hospitality/ops', module: 'hospitality' },

    // ============================================================================
    // COMMERCIAL Module - Complete commerce management (Premium)
    // ============================================================================
    { id: 'commercial_insights', labelKey: 'Insights & Relatórios', icon: HiOutlineChartBar, path: '/commercial/insights', module: 'commercial' },
    { id: 'commercial_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/commercial/pos', module: 'commercial' },
    { id: 'commercial_shifts', labelKey: 'nav.shifts', icon: HiOutlineCalculator, path: '/commercial/history?tab=shifts', module: 'commercial' },
    { id: 'commercial_history', labelKey: 'nav.history', icon: HiOutlineClock, path: '/commercial/history', module: 'commercial' },
    { id: 'commercial_stock', labelKey: 'nav.stock_movements', icon: HiOutlineRefresh, path: '/commercial/history?tab=stock', module: 'commercial' },
    { id: 'commercial_inventory', labelKey: 'Inventário', icon: HiOutlineCube, path: '/commercial/inventory', module: 'commercial' },
    { id: 'commercial_purchase_orders', labelKey: 'Ordens de Compra', icon: HiOutlineClipboardList, path: '/commercial/purchase-orders', module: 'commercial' },
    { id: 'commercial_quotes', labelKey: 'Cotações', icon: HiOutlinePencilAlt, path: '/commercial/quotes', module: 'commercial' },
    { id: 'commercial_finance', labelKey: 'Gestão Financeira', icon: HiOutlineCurrencyDollar, path: '/commercial/finance', module: 'commercial' },
    { id: 'commercial_orders', labelKey: 'Encomendas', icon: HiOutlineDocumentReport, path: '/commercial/orders', module: 'commercial' },
    { id: 'commercial_invoices', labelKey: 'Facturas', icon: HiOutlineDocumentText, path: '/commercial/invoices', module: 'commercial' },
    { id: 'commercial_customers', labelKey: 'Clientes', icon: HiOutlineUserGroup, path: '/commercial/customers', module: 'commercial' },
    { id: 'commercial_suppliers', labelKey: 'Fornecedores', icon: HiOutlineTruck, path: '/commercial/suppliers', module: 'commercial' },
    { id: 'commercial_categories', labelKey: 'Categorias', icon: HiOutlineTag, path: '/commercial/categories', module: 'commercial' },
    { id: 'commercial_warehouses', labelKey: 'Armazéns', icon: HiOutlineHomeModern, path: '/warehouses', module: 'commercial' },
    { id: 'commercial_transfers', labelKey: 'nav.transfers', icon: HiOutlineTruck, path: '/transfers', module: 'commercial' },
    { id: 'commercial_audit', labelKey: 'Auditoria', icon: HiOutlineShieldCheck, path: '/commercial/history?tab=audit', module: 'commercial' },
    { id: 'commercial_hr', labelKey: 'Recursos Humanos', icon: HiOutlineUsers, path: '/hr', module: 'commercial' },

    // ============================================================================
    // LOGISTICS Module - Specific pages (only for logistics businesses)
    // ============================================================================
    { id: 'logistics_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/logistics/dashboard', module: 'logistics' },
    { id: 'logistics_driver_panel', labelKey: 'Painel Motorista', icon: HiOutlineRectangleStack, path: '/logistics/driver-panel', module: 'logistics' },
    { id: 'logistics_vehicles', labelKey: 'Veículos', icon: HiOutlineTruck, path: '/logistics/vehicles', module: 'logistics' },
    { id: 'logistics_drivers', labelKey: 'Motoristas', icon: HiOutlineUsers, path: '/logistics/drivers', module: 'logistics' },
    { id: 'logistics_hr', labelKey: 'logistics_module.hr.title', icon: HiOutlineUsers, path: '/logistics/hr', module: 'logistics' },
    { id: 'logistics_routes', labelKey: 'Rotas', icon: HiOutlineChartBar, path: '/logistics/routes', module: 'logistics' },
    { id: 'logistics_deliveries', labelKey: 'Entregas', icon: HiOutlineClipboardList, path: '/logistics/deliveries', module: 'logistics' },
    { id: 'logistics_parcels', labelKey: 'Encomendas', icon: HiOutlineCube, path: '/logistics/parcels', module: 'logistics' },
    { id: 'logistics_maintenance', labelKey: 'Manutenção', icon: HiOutlineCog, path: '/logistics/maintenance', module: 'logistics' },
    { id: 'logistics_fuel', labelKey: 'logistics_module.fuel.title', icon: HiOutlineFire, path: '/logistics/fuel', module: 'logistics' },
    { id: 'logistics_incidents', labelKey: 'logistics_module.incidents.title', icon: HiOutlineExclamationCircle, path: '/logistics/incidents', module: 'logistics' },
    { id: 'logistics_reports', labelKey: 'Relatórios', icon: HiOutlineDocumentText, path: '/logistics/reports', module: 'logistics' },
    { id: 'logistics_finance', labelKey: 'Financeiro', icon: HiOutlineCurrencyDollar, path: '/logistics/finance', module: 'logistics' },

    // ============================================================================
    // BOTTLE_STORE Module - Specific page
    // ============================================================================
    { id: 'bottle_store_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/bottle-store/dashboard', module: 'bottle_store' },
    { id: 'bottle_store_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/bottle-store/pos', module: 'bottle_store' },
    { id: 'bottle_store_inventory', labelKey: 'nav.inventory', icon: HiOutlineCube, path: '/bottle-store/inventory', module: 'bottle_store' },
    { id: 'bottle_store_stock', labelKey: 'nav.stock_movements', icon: HiOutlineRefresh, path: '/bottle-store/stock', module: 'bottle_store' },
    { id: 'bottle_store_returns', labelKey: 'Vasilhames', icon: HiOutlineBeaker, path: '/bottle-store/returns', module: 'bottle_store' },
    { id: 'bottle_store_cash', labelKey: 'Caixa', icon: HiOutlineCalculator, path: '/bottle-store/cash', module: 'bottle_store' },
    { id: 'bottle_store_credit', labelKey: 'Crédito', icon: HiOutlineBookOpen, path: '/bottle-store/credit', module: 'bottle_store' },
    { id: 'bottle_store_reports', labelKey: 'Relatórios', icon: HiOutlineDocumentText, path: '/bottle-store/reports', module: 'bottle_store' },
    { id: 'bottle_store_finance', labelKey: 'Financeiro', icon: HiOutlineCurrencyDollar, path: '/bottle-store/finance', module: 'bottle_store' },
    { id: 'bottle_store_employees', labelKey: 'Recursos Humanos', icon: HiOutlineUsers, path: '/bottle-store/employees', module: 'bottle_store' },

    // ============================================================================
    // RESTAURANT Module - Specific pages
    // ============================================================================
    { id: 'restaurant_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/restaurant/dashboard', module: 'restaurant' },
    { id: 'restaurant_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/restaurant/pos', module: 'restaurant' },
    { id: 'restaurant_kitchen', labelKey: 'Cozinha (KDS)', icon: HiOutlineFire, path: '/restaurant/kitchen', module: 'restaurant' },
    { id: 'restaurant_menu', labelKey: 'Cardápio / Menu', icon: HiOutlineBookOpen, path: '/restaurant/menu', module: 'restaurant' },
    { id: 'restaurant_reservations', labelKey: 'Reservas', icon: HiOutlineCalendar, path: '/restaurant/reservations', module: 'restaurant' },
    { id: 'restaurant_tables', labelKey: 'Mesas', icon: HiOutlineCake, path: '/restaurant/tables', module: 'restaurant' },
    { id: 'restaurant_finance', labelKey: 'Financeiro', icon: HiOutlineCurrencyDollar, path: '/restaurant/finance', module: 'restaurant' },
    { id: 'restaurant_employees', labelKey: 'Recursos Humanos', icon: HiOutlineUsers, path: '/restaurant/employees', module: 'restaurant' },
    { id: 'restaurant_reports', labelKey: 'Relatórios', icon: HiOutlineChartBar, path: '/restaurant/reports', module: 'restaurant' },


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
    { id: 'calendar', labelKey: 'Calendário', icon: HiOutlineCalendar, path: '/calendar' },
    { id: 'alerts', labelKey: 'nav.alerts', icon: HiOutlineBell, path: '/alerts' },
    { id: 'fiscal', labelKey: 'nav.fiscal', icon: HiOutlineCalculator, path: '/fiscal', module: 'fiscal' },
    { id: 'reports', labelKey: 'nav.reports', icon: HiOutlineDocumentText, path: '/reports' },
    { id: 'audit', labelKey: 'nav.audit', icon: HiOutlineShieldCheck, path: '/audit' },
    { id: 'backups', labelKey: 'nav.backups', icon: HiOutlineCircleStack, path: '/backups' },
    { id: 'help', labelKey: 'Ajuda', icon: HiOutlineQuestionMarkCircle, path: '/help' },
    { id: 'settings', labelKey: 'nav.settings', icon: HiOutlineCog, path: '/settings' },

    // Super Admin Section
    { id: 'super_admin', labelKey: 'Administração do Sistema', icon: HiOutlineShieldCheck, path: '/super-admin', role: 'super_admin' },
];


import { useUnreadCount } from '../../hooks/useAlerts';

export default function Sidebar() {
    const navigate = useNavigate();
    const { sidebarOpen, toggleSidebar, setSidebarOpen, companySettings } = useStore();
    const { user, logout } = useAuthStore();
    const location = useLocation();

    // Determine current module based on URL path
    const currentModule = location.pathname.split('/')[1];
    const { canViewPage } = usePermissions();
    const { t } = useTranslation();
    const { hasModule } = useTenant();
    
    // Real-time unread alerts count from server
    const { counts } = useUnreadCount();
    const unreadAlerts = counts?.total || 0;

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

    // Close sidebar on mobile when navigating (prevents overlay from blocking page content)
    useEffect(() => {
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    }, [location.pathname]);

    // Close sidebar on first mount if screen is small
    useEffect(() => {
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    }, []);

    // Modules that each have their own dedicated sidebar section
    const SPECIALIZED_MODULES = ['pharmacy', 'commercial', 'hospitality', 'bottle_store', 'logistics', 'restaurant'];
    // Items that are always visible regardless of module (system-level)
    const ALWAYS_VISIBLE_IDS = ['calendar', 'alerts', 'fiscal', 'audit', 'backups', 'help', 'settings', 'super_admin'];

    const isSuperAdmin = user?.role === 'super_admin';
    // Determine which specialized module this user belongs to
    const userSpecializedModule = !isSuperAdmin
        ? SPECIALIZED_MODULES.find(m => hasModule(m))
        : undefined;

    // The active module for UI display and theme (current path takes priority)
    const activeModuleCode = SPECIALIZED_MODULES.includes(currentModule)
        ? currentModule
        : (userSpecializedModule || 'commercial');

    // Resolve sidebar color theme for current user's module
    const theme = MODULE_THEMES[activeModuleCode] || DEFAULT_THEME;

    const filteredMenuItems = menuItems.filter(item => {
        // Super admin exclusive items
        if (item.id === 'super_admin' && !isSuperAdmin) return false;

        // Permission check (RBAC)
        if (!canViewPage(item.path)) return false;

        // Super admin sees everything
        if (isSuperAdmin) return true;

        // System-level items always visible
        if (ALWAYS_VISIBLE_IDS.includes(item.id)) return true;

        const itemModule = item.module as string | undefined;

        if (userSpecializedModule) {
            // User has a specialized module: ONLY show items for that module
            return itemModule === userSpecializedModule;
        } else {
            // Não specialized module (edge case): show generic core items only
            return !itemModule || !SPECIALIZED_MODULES.includes(itemModule);
        }
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
            {/* Global Overlay (dim background when sidebar is open) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9989]"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Now an Overlay (Off-Canvas) */}
            <aside
                className={cn(
                    'fixed top-4 left-4 h-[calc(100vh-2rem)] bg-white/95 dark:bg-dark-800 shadow-2xl z-[9990] transition-all duration-500 ease-in-out flex flex-col w-72 rounded-lg border border-slate-300/40 dark:border-dark-700/50 backdrop-blur-md',
                    sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+2rem)] opacity-0'
                )}
            >
                {/* Logo / Brand */}
                <div className="flex items-center justify-between min-h-[90px] px-6 py-4 flex-shrink-0 bg-white/50 dark:bg-dark-800/50 backdrop-blur-xl rounded-t-2xl border-b border-gray-100 dark:border-dark-700/50 transition-all duration-500">
                    <div className="flex items-center gap-4 overflow-hidden group/brand cursor-pointer" onClick={() => navigate('/dashboard')}>
                        {companySettings.logo ? (
                            <div className="relative">
                                <div className={cn('absolute -inset-1.5 bg-gradient-to-r rounded-xl blur-sm opacity-20 group-hover/brand:opacity-40 transition duration-1000 group-hover/brand:duration-300', theme.brandGradient)}></div>
                                <img
                                    src={companySettings.logo}
                                    alt="Logo"
                                    className="relative w-11 h-11 rounded-xl object-contain bg-white shadow-lg ring-1 ring-black/5 dark:ring-white/10 shrink-0"
                                />
                            </div>
                        ) : (
                            <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-2xl shadow-primary-500/20 shrink-0 transform transition-all duration-500 group-hover/brand:scale-110 group-hover/brand:rotate-3', theme.brandGradient, theme.brandShadow)}>
                                <span className="text-white font-black text-2xl tracking-tighter drop-shadow-sm">
                                    {(companySettings.tradeName || companySettings.companyName || 'S').charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}

                        {sidebarOpen && (
                            <div className="animate-fade-in min-w-0 ml-1">
                                <h1 className="font-black text-lg tracking-tight text-gray-900 dark:text-white truncate leading-tight group-hover/brand:text-primary-600 dark:group-hover/brand:text-primary-400 transition-colors">
                                    {companySettings.tradeName || companySettings.companyName || 'MULTICORE'}
                                </h1>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className={cn('w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse', theme.dotColor)}></div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 truncate">
                                        {t(`businessType.${MODULE_TO_BUSINESS_TYPE[activeModuleCode] || companySettings.businessType || 'retail'}`)}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={toggleSidebar}
                        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 transition-all duration-300 group/btn shadow-sm hover:shadow-md ring-1 ring-gray-100 dark:ring-dark-700"
                    >
                        {sidebarOpen ? (
                            <HiOutlineChevronLeft className="w-5 h-5 transition-transform group-hover/btn:-translate-x-0.5" />
                        ) : (
                            <HiOutlineChevronRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-0.5" />
                        )}
                    </button>
                </div>

                {/* Navigation - scrollable area */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hidden">
                    {filteredMenuItems.map((item) => {
                        const hasSubmenu = item.submenu && item.submenu.length > 0;
                        const isExpanded = expandedMenus.includes(item.id);
                        const isActive = location.pathname === item.path;
                        const isSubmenuActive = hasSubmenu && item.submenu?.some(sub => location.pathname === sub.path);
                        const Icon = item.icon;
                        
                        // Smart badge logic: 
                        // - Global 'alerts' item shows total unread
                        // - Module-specific alerts show only module unread
                        const isAlertItem = item.id === 'alerts' || item.id.endsWith('_alerts');
                        const specificModule = item.module || (item.id.includes('_') ? item.id.split('_')[0] : null);
                        
                        const itemUnreadCount = isAlertItem 
                            ? (specificModule && counts?.byModule ? (counts.byModule[specificModule] || 0) : unreadAlerts)
                            : 0;
                            
                        const showBadge = itemUnreadCount > 0;

                        return (
                            <div key={item.id} className="relative">
                                {/* Main Menu Item */}
                                {hasSubmenu ? (
                                    <button
                                        onClick={() => toggleSubmenu(item.id)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group',
                                            isSubmenuActive || isExpanded
                                                ? `${theme.activeBg} ${theme.activeText} font-bold shadow-sm`
                                                : `text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-800/50 ${theme.hoverText}`
                                        )}
                                    >
                                        <div className={cn(
                                            'w-1.5 h-1.5 rounded-full absolute left-1 transition-all duration-300',
                                            (isSubmenuActive || isExpanded) ? theme.dotColor : 'bg-transparent'
                                        )} />
                                        <Icon
                                            className={cn(
                                                'w-6 h-6 flex-shrink-0 transition-transform duration-300 group-hover:scale-110',
                                                (isSubmenuActive || isExpanded) && theme.activeIconText
                                            )}
                                        />
                                        {sidebarOpen && (
                                            <>
                                                <span className="animate-fade-in truncate flex-1 text-left tracking-tight">{t(item.labelKey)}</span>
                                                <HiOutlineChevronRight
                                                    className={cn(
                                                        'w-4 h-4 transition-transform duration-300 opacity-50',
                                                        isExpanded && 'rotate-90 opacity-100'
                                                    )}
                                                />
                                            </>
                                        )}

                                        {/* Tooltip for collapsed sidebar */}
                                        {!sidebarOpen && (
                                            <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/95 dark:bg-dark-700/95 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-[10000] shadow-2xl ring-1 ring-white/10">
                                                {t(item.labelKey)}
                                            </div>
                                        )}
                                    </button>
                                ) : (
                                    <NavLink
                                        to={item.path}
                                        state={item.state}
                                        className={cn(
                                            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group',
                                            isActive
                                                ? `${theme.activeBg} ${theme.activeText} font-bold shadow-sm`
                                                : `text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-800/50 ${theme.hoverText}`
                                        )}
                                    >
                                        <div className={cn(
                                            'w-1.5 h-1.5 rounded-full absolute left-1 transition-all duration-300',
                                            isActive ? theme.dotColor : 'bg-transparent'
                                        )} />
                                        <Icon
                                            className={cn(
                                                'w-6 h-6 flex-shrink-0 transition-transform duration-300 group-hover:scale-110',
                                                isActive && theme.activeIconText
                                            )}
                                        />
                                        {sidebarOpen && (
                                            <span className="animate-fade-in truncate tracking-tight">{t(item.labelKey)}</span>
                                        )}
                                        {showBadge && (
                                            <span
                                                className={cn(
                                                    'absolute flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black text-white bg-red-500 rounded-full border-2 border-white dark:border-dark-800 shadow-lg',
                                                    sidebarOpen ? 'right-3' : 'top-1 right-1'
                                                )}
                                            >
                                                {itemUnreadCount > 9 ? '9+' : itemUnreadCount}
                                            </span>
                                        )}

                                        {/* Tooltip for collapsed sidebar */}
                                        {!sidebarOpen && (
                                            <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/95 dark:bg-dark-700/95 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-[10000] shadow-2xl ring-1 ring-white/10">
                                                {t(item.labelKey)}
                                            </div>
                                        )}
                                    </NavLink>
                                )}

                                {/* Submenu Items */}
                                {hasSubmenu && sidebarOpen && isExpanded && (
                                    <div className="mt-1 ml-6 pl-4 border-l border-gray-100 dark:border-dark-700 space-y-1 animate-fade-in">
                                        {item.submenu?.map((subItem) => {
                                            const subIsActive = location.pathname === subItem.path;
                                            const SubIcon = subItem.icon;

                                            return (
                                                <NavLink
                                                    key={subItem.id}
                                                    to={subItem.path}
                                                    className={cn(
                                                        'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium relative group/sub',
                                                        subIsActive
                                                            ? `${theme.subActiveBg} ${theme.subActiveText} font-bold`
                                                            : `text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white`
                                                    )}
                                                >
                                                    <SubIcon className={cn(
                                                        'w-4 h-4 flex-shrink-0 transition-transform group-hover/sub:scale-110',
                                                        subIsActive ? theme.activeIconText : 'opacity-50'
                                                    )} />
                                                    <span className="truncate">{t(subItem.labelKey)}</span>
                                                    {subIsActive && (
                                                        <div className={cn('absolute left-0 w-1 h-4 rounded-full', theme.dotColor)} />
                                                    )}
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
                <div className="flex-shrink-0 p-4 border-t border-gray-200/50 dark:border-dark-700/50 bg-white dark:bg-dark-800 transition-all duration-300 rounded-b-2xl">
                    {sidebarOpen ? (
                        <div className="bg-gray-50/50 dark:bg-dark-900/50 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/50 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg ring-2 ring-white dark:ring-dark-800">
                                    {user ? getUserInitials(user.name) : 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-gray-900 dark:text-white truncate tracking-tight">
                                        {user?.name || 'Utilizador'}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate uppercase tracking-widest">
                                        {user?.role ? roleLabels[user.role] : ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-xl transition-all border border-red-100 dark:border-red-900/30 group/logout"
                            >
                                <HiOutlineLogout className="w-4 h-4 transition-transform group-hover/logout:translate-x-1" />
                                {t('auth.logout')}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center p-3 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all group relative border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                            title={t('auth.logout')}
                        >
                            <HiOutlineLogout className="w-6 h-6 transition-transform group-hover:scale-110" />
                            {/* Tooltip */}
                            <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/95 dark:bg-dark-700/95 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-[10000] shadow-2xl ring-1 ring-white/10">
                                {t('auth.logout')}
                            </div>
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
}
