import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
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
        activeText: 'text-teal-600 dark:text-teal-400',
        activeIconText: 'text-teal-600 dark:text-teal-400',
        hoverText: 'hover:text-teal-600 dark:hover:text-teal-400',
        brandGradient: 'from-teal-600 via-teal-500 to-emerald-500',
        brandShadow: 'shadow-teal-500/20',
        subActiveBg: 'bg-teal-100 dark:bg-teal-900/30',
        subActiveText: 'text-teal-700 dark:text-teal-300',
        dotColor: 'bg-teal-500',
        labelBg: 'bg-teal-50 dark:bg-teal-900/20',
        labelText: 'text-teal-600 dark:text-teal-400',
    },
    commercial: {
        activeBg: 'bg-blue-50 dark:bg-blue-900/20',
        activeText: 'text-blue-600 dark:text-blue-400',
        activeIconText: 'text-blue-600 dark:text-blue-400',
        hoverText: 'hover:text-blue-600 dark:hover:text-blue-400',
        brandGradient: 'from-blue-600 via-blue-500 to-indigo-500',
        brandShadow: 'shadow-blue-500/20',
        subActiveBg: 'bg-blue-100 dark:bg-blue-900/30',
        subActiveText: 'text-blue-700 dark:text-blue-300',
        dotColor: 'bg-blue-500',
        labelBg: 'bg-blue-50 dark:bg-blue-900/20',
        labelText: 'text-blue-600 dark:text-blue-400',
    },
    hospitality: {
        activeBg: 'bg-amber-50 dark:bg-amber-900/20',
        activeText: 'text-amber-600 dark:text-amber-400',
        activeIconText: 'text-amber-600 dark:text-amber-400',
        hoverText: 'hover:text-amber-600 dark:hover:text-amber-400',
        brandGradient: 'from-amber-600 via-amber-500 to-yellow-500',
        brandShadow: 'shadow-amber-500/20',
        subActiveBg: 'bg-amber-100 dark:bg-amber-900/30',
        subActiveText: 'text-amber-700 dark:text-amber-300',
        dotColor: 'bg-amber-500',
        labelBg: 'bg-amber-50 dark:bg-amber-900/20',
        labelText: 'text-amber-600 dark:text-amber-400',
    },
    bottle_store: {
        activeBg: 'bg-orange-50 dark:bg-orange-900/20',
        activeText: 'text-orange-600 dark:text-orange-400',
        activeIconText: 'text-orange-600 dark:text-orange-400',
        hoverText: 'hover:text-orange-600 dark:hover:text-orange-400',
        brandGradient: 'from-orange-600 via-orange-500 to-amber-500',
        brandShadow: 'shadow-orange-500/20',
        subActiveBg: 'bg-orange-100 dark:bg-orange-900/30',
        subActiveText: 'text-orange-700 dark:text-orange-300',
        dotColor: 'bg-orange-500',
        labelBg: 'bg-orange-50 dark:bg-orange-900/20',
        labelText: 'text-orange-600 dark:text-orange-400',
    },
    logistics: {
        activeBg: 'bg-cyan-50 dark:bg-cyan-900/20',
        activeText: 'text-cyan-600 dark:text-cyan-400',
        activeIconText: 'text-cyan-600 dark:text-cyan-400',
        hoverText: 'hover:text-cyan-600 dark:hover:text-cyan-400',
        brandGradient: 'from-cyan-600 via-cyan-500 to-sky-500',
        brandShadow: 'shadow-cyan-500/20',
        subActiveBg: 'bg-cyan-100 dark:bg-cyan-900/30',
        subActiveText: 'text-cyan-700 dark:text-cyan-300',
        dotColor: 'bg-cyan-500',
        labelBg: 'bg-cyan-50 dark:bg-cyan-900/20',
        labelText: 'text-cyan-600 dark:text-cyan-400',
    },
    restaurant: {
        activeBg: 'bg-rose-50 dark:bg-rose-900/20',
        activeText: 'text-rose-600 dark:text-rose-400',
        activeIconText: 'text-rose-600 dark:text-rose-400',
        hoverText: 'hover:text-rose-600 dark:hover:text-rose-400',
        brandGradient: 'from-rose-600 via-rose-500 to-red-500',
        brandShadow: 'shadow-rose-500/20',
        subActiveBg: 'bg-rose-100 dark:bg-rose-900/30',
        subActiveText: 'text-rose-700 dark:text-rose-300',
        dotColor: 'bg-rose-500',
        labelBg: 'bg-rose-50 dark:bg-rose-900/20',
        labelText: 'text-rose-600 dark:text-rose-400',
    },
};

// Default theme (generic primary) for unrecognized modules or system pages
const DEFAULT_THEME: ModuleTheme = {
    activeBg: 'bg-primary-50 dark:bg-primary-900/20',
    activeText: 'text-primary-600 dark:text-primary-400',
    activeIconText: 'text-primary-600 dark:text-primary-400',
    hoverText: 'hover:text-primary-600 dark:hover:text-primary-400',
    brandGradient: 'from-primary-600 via-primary-500 to-accent-500',
    brandShadow: 'shadow-primary-500/20',
    subActiveBg: 'bg-primary-100 dark:bg-primary-900/30',
    subActiveText: 'text-primary-700 dark:text-primary-300',
    dotColor: 'bg-emerald-500',
    labelBg: 'bg-primary-50 dark:bg-primary-900/20',
    labelText: 'text-primary-600 dark:text-primary-400',
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
    { id: 'commercial_dashboard', labelKey: 'nav.dashboard', icon: HiOutlineViewGrid, path: '/commercial/dashboard', module: 'commercial' },
    { id: 'commercial_pos', labelKey: 'Ponto de Venda', icon: HiOutlineShoppingCart, path: '/commercial/pos', module: 'commercial' },
    { id: 'commercial_shifts', labelKey: 'nav.shifts', icon: HiOutlineCalculator, path: '/commercial/shifts', module: 'commercial' },
    { id: 'commercial_history', labelKey: 'nav.history', icon: HiOutlineClock, path: '/commercial/history', module: 'commercial' },
    { id: 'commercial_stock', labelKey: 'nav.stock_movements', icon: HiOutlineRefresh, path: '/commercial/stock', module: 'commercial' },
    { id: 'commercial_inventory', labelKey: 'Inventário', icon: HiOutlineCube, path: '/commercial/inventory', module: 'commercial' },
    { id: 'commercial_purchase_orders', labelKey: 'Ordens de Compra', icon: HiOutlineClipboardList, path: '/commercial/purchase-orders', module: 'commercial' },
    { id: 'commercial_quotes', labelKey: 'Cotações', icon: HiOutlinePencilAlt, path: '/commercial/quotes', module: 'commercial' },
    { id: 'commercial_accounts_receivable', labelKey: 'Contas a Receber', icon: HiOutlineCurrencyDollar, path: '/commercial/accounts-receivable', module: 'commercial' },
    { id: 'commercial_orders', labelKey: 'Encomendas', icon: HiOutlineDocumentReport, path: '/commercial/orders', module: 'commercial' },
    { id: 'commercial_invoices', labelKey: 'Facturas', icon: HiOutlineDocumentText, path: '/commercial/invoices', module: 'commercial' },
    { id: 'commercial_customers', labelKey: 'Clientes', icon: HiOutlineUserGroup, path: '/commercial/customers', module: 'commercial' },
    { id: 'commercial_suppliers', labelKey: 'Fornecedores', icon: HiOutlineTruck, path: '/commercial/suppliers', module: 'commercial' },
    { id: 'commercial_categories', labelKey: 'Categorias', icon: HiOutlineTag, path: '/commercial/categories', module: 'commercial' },
    { id: 'commercial_warehouses', labelKey: 'Armazéns', icon: HiOutlineHomeModern, path: '/warehouses', module: 'commercial' },
    { id: 'commercial_transfers', labelKey: 'nav.transfers', icon: HiOutlineTruck, path: '/transfers', module: 'commercial' },
    { id: 'commercial_margins', labelKey: 'Análise de Margens', icon: HiOutlineChartBar, path: '/commercial/margins', module: 'commercial' },
    { id: 'commercial_audit', labelKey: 'Auditoria', icon: HiOutlineShieldCheck, path: '/commercial/audit', module: 'commercial' },
    { id: 'commercial_reports', labelKey: 'Relatórios', icon: HiOutlineDocumentReport, path: '/commercial/reports', module: 'commercial' },
    { id: 'commercial_finance', labelKey: 'Financeiro', icon: HiOutlineCurrencyDollar, path: '/commercial/finance', module: 'commercial' },
    { id: 'commercial_employees', labelKey: 'Recursos Humanos', icon: HiOutlineUsers, path: '/commercial/employees', module: 'commercial' },

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


export default function Sidebar() {
    const navigate = useNavigate();
    const { sidebarOpen, toggleSidebar, setSidebarOpen, alerts, companySettings } = useStore();
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
    const ALWAYS_VISIBLE_IDS = ['alerts', 'fiscal', 'audit', 'backups', 'help', 'settings', 'super_admin'];

    const isSuperAdmin = user?.role === 'super_admin';
    // Determine which specialized module this user belongs to
    const userSpecializedModule = !isSuperAdmin
        ? SPECIALIZED_MODULES.find(m => hasModule(m))
        : undefined;

    // Resolve sidebar color theme for current user's module
    const theme = userSpecializedModule ? (MODULE_THEMES[userSpecializedModule] || DEFAULT_THEME) : DEFAULT_THEME;

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
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Now an Overlay (Off-Canvas) */}
            <aside
                className={cn(
                    'fixed top-4 left-4 h-[calc(100vh-2rem)] bg-white/95 dark:bg-dark-800 shadow-2xl z-50 transition-all duration-500 ease-in-out flex flex-col w-72 rounded-lg border border-slate-200/50 dark:border-dark-700/50 backdrop-blur-md',
                    sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+2rem)] opacity-0'
                )}
            >
                {/* Logo / Brand */}
                <div className="flex items-center justify-between h-18 px-4 border-b border-gray-100 dark:border-dark-700/50 flex-shrink-0 bg-white/50 dark:bg-dark-800/50 backdrop-blur-md">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {companySettings.logo ? (
                            <div className="relative group">
                                <div className={cn('absolute -inset-1 bg-gradient-to-r rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200', theme.brandGradient)}></div>
                                <img
                                    src={companySettings.logo}
                                    alt="Logo"
                                    className="relative w-10 h-10 rounded-lg object-contain bg-white shadow-sm shrink-0"
                                />
                            </div>
                        ) : (
                            <div className={cn('w-11 h-11 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0 transform transition-transform hover:scale-105', theme.brandGradient, theme.brandShadow)}>
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
                                    <div className={cn('w-2 h-2 rounded-full animate-pulse', theme.dotColor)}></div>
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
                                            'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group',
                                            isSubmenuActive || isExpanded
                                                ? `${theme.activeBg} ${theme.activeText} font-medium shadow-sm`
                                                : `text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 ${theme.hoverText}`
                                        )}
                                    >
                                        <Icon
                                            className={cn(
                                                'w-6 h-6 flex-shrink-0',
                                                (isSubmenuActive || isExpanded) && theme.activeIconText
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
                                            'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group',
                                            isActive
                                                ? `${theme.activeBg} ${theme.activeText} font-medium shadow-sm`
                                                : `text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 ${theme.hoverText}`
                                        )}
                                    >
                                        <Icon
                                            className={cn(
                                                'w-6 h-6 flex-shrink-0',
                                                isActive && theme.activeIconText
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
                                                            ? `${theme.subActiveBg} ${theme.subActiveText} font-medium`
                                                            : `text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700/50 ${theme.hoverText}`
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
