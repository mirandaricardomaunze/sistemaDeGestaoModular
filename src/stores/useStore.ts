import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingsAPI } from '../services/api';
import type {
    Product,
    CartItem,
    Alert,
    BusinessType,
    Sale,
    AlertConfig,
} from '../types';
import toast from 'react-hot-toast';

// Mapping from Backend Module Codes to Frontend BusinessType
export const MODULE_TO_BUSINESS_TYPE: Record<string, BusinessType> = {
    'COMMERCIAL': 'retail',
    'PHARMACY': 'pharmacy',
    'SUPERMARKET': 'supermarket',
    'BOTTLE_STORE': 'bottlestore',
    'HOTEL': 'hotel',
    'RESTAURANT': 'retail', // Fallback to retail for restaurant for now
    'LOGISTICS': 'logistics',
};

// ============================================================================
// Company Settings Interface
// ============================================================================

export interface CompanySettings {
    companyName: string;
    tradeName: string;
    businessType: BusinessType;
    taxId: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    province: string;
    logo?: string;
    ivaRate: number;
    currency: string;
    printerType: 'thermal' | 'a4';
    thermalPaperWidth: '80mm' | '58mm';
    autoPrintReceipt: boolean;
}

// Default company settings
const defaultCompanySettings: CompanySettings = {
    companyName: 'Minha Empresa Lda',
    tradeName: 'Minha Empresa',
    businessType: 'retail',
    taxId: '400123456',  // NUIT format
    phone: '+258 84 123 4567',
    email: 'geral@minhaempresa.co.mz',
    address: 'Av. Principal, 123',
    city: 'Maputo',
    state: 'Maputo Cidade',
    province: 'Maputo',
    zipCode: '',
    ivaRate: 16,
    currency: 'MZN',
    printerType: 'thermal',
    thermalPaperWidth: '80mm',
    autoPrintReceipt: false,
};

// ============================================================================
// Store Interface
// ============================================================================

interface AppState {
    // Theme
    theme: 'light' | 'dark';
    toggleTheme: () => void;

    // Sidebar
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;

    // Business Type (for customizing the app)
    businessType: BusinessType;
    setBusinessType: (type: BusinessType) => void;

    // Cart (POS) - Local State
    cart: CartItem[];
    addToCart: (product: Product, quantity?: number) => void;
    removeFromCart: (productId: string) => void;
    updateCartQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;

    // Sales - Local cache for POS
    sales: Sale[];
    addSale: (sale: Sale) => void;
    setSales: (sales: Sale[]) => void;

    // Local alerts cache
    alerts: Alert[];
    setAlerts: (alerts: Alert[]) => void;
    addAlert: (alert: Alert) => void;
    markAlertAsRead: (id: string) => void;
    markAlertAsResolved: (id: string) => void;
    deleteAlert: (id: string) => void;

    // Alert Configuration
    alertConfig: AlertConfig;
    updateAlertConfig: (config: Partial<AlertConfig>) => Promise<void>;
    loadAlertConfig: () => Promise<void>;
    isLoadingAlertConfig: boolean;

    // Company Settings
    companySettings: CompanySettings;
    updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
    loadCompanySettings: () => Promise<void>;
    isLoadingSettings: boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Theme
            theme: 'light',
            toggleTheme: () =>
                set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

            // Sidebar
            sidebarOpen: true,
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setSidebarOpen: (open) => set({ sidebarOpen: open }),

            // Business Type
            businessType: 'retail',
            setBusinessType: (type) => set((state) => ({
                businessType: type,
                companySettings: { ...state.companySettings, businessType: type }
            })),

            // Cart
            cart: [],
            addToCart: (product, quantity = 1) =>
                set((state) => {
                    // Check stock availability
                    const cartItem = state.cart.find((item) => item.productId === product.id);
                    const currentQty = cartItem ? cartItem.quantity : 0;
                    const newQty = currentQty + quantity;

                    if (newQty > product.currentStock) {
                        toast.error(`Estoque insuficiente. Disponível: ${product.currentStock}`);
                        return state;
                    }

                    const existingItem = state.cart.find((item) => item.productId === product.id);

                    if (existingItem) {
                        return {
                            cart: state.cart.map((item) =>
                                item.productId === product.id
                                    ? {
                                        ...item,
                                        quantity: item.quantity + quantity,
                                        total: (item.quantity + quantity) * item.unitPrice - item.discount,
                                    }
                                    : item
                            ),
                        };
                    }

                    const newItem: CartItem = {
                        productId: product.id,
                        product,
                        quantity,
                        unitPrice: product.price,
                        discount: 0,
                        total: product.price * quantity,
                    };

                    return { cart: [...state.cart, newItem] };
                }),

            removeFromCart: (productId) =>
                set((state) => ({ cart: state.cart.filter((item) => item.productId !== productId) })),

            updateCartQuantity: (productId, quantity) =>
                set((state) => ({
                    cart: state.cart.map((item) =>
                        item.productId === productId
                            ? {
                                ...item,
                                quantity,
                                total: quantity * item.unitPrice - item.discount,
                            }
                            : item
                    ),
                })),

            clearCart: () => set({ cart: [] }),

            // Sales
            sales: [],
            addSale: (sale) => set((state) => ({ sales: [sale, ...state.sales] })),
            setSales: (sales) => set({ sales }),

            // Alerts
            alerts: [],
            setAlerts: (alerts) => set({ alerts }),
            addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),

            markAlertAsRead: (id) =>
                set((state) => ({
                    alerts: state.alerts.map((a) =>
                        a.id === id ? { ...a, isRead: true } : a
                    ),
                })),

            markAlertAsResolved: (id) =>
                set((state) => ({
                    alerts: state.alerts.map((a) =>
                        a.id === id ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() } : a
                    ),
                })),

            deleteAlert: (id) =>
                set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

            // Alert Config
            alertConfig: {
                lowStockThreshold: 10,
                expiryWarningDays: 30,
                paymentDueDays: 7,
                enableEmailAlerts: true,
                enablePushNotifications: true,
            },
            isLoadingAlertConfig: false,

            loadAlertConfig: async () => {
                set({ isLoadingAlertConfig: true });
                try {
                    const data = await settingsAPI.getAlertConfig();
                    if (data) {
                        set({
                            alertConfig: {
                                lowStockThreshold: data.lowStockThreshold,
                                expiryWarningDays: data.expiryWarningDays,
                                paymentDueDays: data.paymentDueDays,
                                enableEmailAlerts: data.enableEmailAlerts,
                                enablePushNotifications: data.enablePushNotifications,
                            }
                        });
                    }
                } catch (error) {
                    console.error('Failed to load alert config from database:', error);
                } finally {
                    set({ isLoadingAlertConfig: false });
                }
            },

            updateAlertConfig: async (config) => {
                // Update local state immediately
                set((state) => ({ alertConfig: { ...state.alertConfig, ...config } }));

                // Sync to database
                try {
                    await settingsAPI.updateAlertConfig(config);
                } catch (error) {
                    console.error('Failed to sync alert config to database:', error);
                }
            },

            // Company Settings
            companySettings: defaultCompanySettings,
            isLoadingSettings: false,

            loadCompanySettings: async () => {
                set({ isLoadingSettings: true });
                try {
                    const data = await settingsAPI.getCompany();
                    if (data) {
                        set({
                            companySettings: {
                                companyName: data.companyName,
                                tradeName: data.tradeName || '',
                                businessType: data.businessType as BusinessType || 'retail',
                                taxId: data.nuit || '',
                                phone: data.phone || '',
                                email: data.email || '',
                                address: data.address || '',
                                city: data.city || '',
                                state: data.state || '',
                                province: data.province || '',
                                zipCode: '',
                                logo: data.logo,
                                ivaRate: Number(data.ivaRate) || 16,
                                currency: data.currency || 'MZN',
                                printerType: data.printerType || 'thermal',
                                thermalPaperWidth: data.thermalPaperWidth || '80mm',
                                autoPrintReceipt: data.autoPrintReceipt ?? false,
                            },
                            // Only update businessType if specified and not already set by context
                            businessType: data.businessType as BusinessType || get().businessType || 'retail'
                        });
                    }
                } catch (error) {
                    console.error('Failed to load company settings from database:', error);
                    // Keep default/cached settings on error
                } finally {
                    set({ isLoadingSettings: false });
                }
            },

            updateCompanySettings: async (settings) => {
                // Update local state immediately for responsive UI
                set((state) => ({
                    companySettings: { ...state.companySettings, ...settings },
                }));

                // Sync to database
                try {
                    await settingsAPI.updateCompany({
                        companyName: settings.companyName,
                        tradeName: settings.tradeName,
                        businessType: settings.businessType,
                        nuit: settings.taxId,
                        phone: settings.phone,
                        email: settings.email,
                        address: settings.address,
                        city: settings.city,
                        province: settings.province,
                        logo: settings.logo,
                        ivaRate: settings.ivaRate,
                        currency: settings.currency,
                        printerType: settings.printerType,
                        thermalPaperWidth: settings.thermalPaperWidth,
                        autoPrintReceipt: settings.autoPrintReceipt,
                    });
                } catch (error) {
                    console.error('Failed to sync company settings to database:', error);
                    // TODO: Add to sync queue for retry
                }
            },
        }),
        {
            name: 'app-store',
            partialize: (state) => ({
                theme: state.theme,
                sidebarOpen: state.sidebarOpen,
                businessType: state.businessType,
                alertConfig: state.alertConfig,
                companySettings: state.companySettings,
                cart: state.cart,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Only load from database if user is authenticated (has valid token)
                    const token = localStorage.getItem('auth_token');
                    if (token) {
                        setTimeout(() => {
                            state.loadCompanySettings();
                            state.loadAlertConfig();
                        }, 500);
                    }
                }
            },
        }
    )
);

// ============================================================================
// Selectors
// ============================================================================

export const useTheme = () => useStore((state) => state.theme);
export const useSidebarOpen = () => useStore((state) => state.sidebarOpen);
export const useCart = () => useStore((state) => state.cart);
export const useCartTotal = () =>
    useStore((state) =>
        state.cart.reduce((total, item) => total + item.total, 0)
    );
export const useCartItemCount = () =>
    useStore((state) =>
        state.cart.reduce((count, item) => count + item.quantity, 0)
    );
export const useCompanySettings = () => useStore((state) => state.companySettings);
export const useAlerts = () => useStore((state) => state.alerts);
export const useUnreadAlerts = () =>
    useStore((state) => state.alerts.filter((a) => !a.isRead));
