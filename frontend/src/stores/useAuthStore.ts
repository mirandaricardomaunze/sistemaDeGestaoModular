import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuditStore } from './useAuditStore';
import { useStore } from './useStore';
import { useFiscalStore } from './useFiscalStore';

// ============================================================================
// Auth Store Interface
// ============================================================================

interface AuthStore {
    // State
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>;
    checkAuth: () => Promise<void>;
    setLoading: (loading: boolean) => void;
    updatePreferences: (preferences: Record<string, unknown>) => Promise<void>;
}

interface RegisterData {
    name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    companyName: string;
    companyTradeName?: string;
    companyNuit: string;
    companyPhone?: string;
    companyEmail?: string;
    companyAddress?: string;
    moduleCode: string;
}

// ============================================================================
// Role Labels
// ============================================================================

export const roleLabels: Record<UserRole, string> = {
    super_admin: 'Super Administrador',
    admin: 'Administrador',
    manager: 'Gerente',
    operator: 'Operador',
    cashier: 'Caixa',
    stock_keeper: 'Gestor de Stock',
};

// ============================================================================
// Auth Store Implementation
// ============================================================================

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            // Initial State
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: true,

            // Set loading state
            setLoading: (loading: boolean) => set({ isLoading: loading }),

            // Login with API
            login: async (email: string, password: string) => {
                set({ isLoading: true });

                try {
                    const response = await authAPI.login(email, password);
                    const { user, token, activeModules, activeLayers, permissions } = response;

                    // Merge modules and permissions into the user object for convenience
                    const enrichedUser = {
                        ...user,
                        activeModules,
                        activeLayers,
                        permissions
                    };

                    // Store token in localStorage for axios interceptor
                    localStorage.setItem('auth_token', token);
                    // Store user data for TenantContext and persistence
                    localStorage.setItem('auth_user', JSON.stringify(enrichedUser));

                    set({
                        user: enrichedUser,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Audit log successful login
                    const addAuditLog = useAuditStore.getState().addLog;
                    addAuditLog({
                        userId: user.id,
                        userName: user.name,
                        userRole: user.role,
                        module: 'auth',
                        action: 'login',
                        severity: 'info',
                        entityType: 'User',
                        entityId: user.id,
                        entityName: user.name,
                        description: `Login bem-sucedido: ${user.email}`,
                        success: true,
                    });

                    toast.success(`Bem-vindo, ${user.name}!`);

                    // Trigger fiscal data sync after successful login
                    useFiscalStore.getState().loadFiscalDataFromDatabase();

                    return true;
                } catch (error) {
                    set({ isLoading: false });

                    // Note: failed-login audit log is created server-side by the
                    // /api/auth/login route. Don't POST /api/audit here — the user
                    // is not authenticated yet and the call would 401.
                    const axiosError = error as {
                        response?: { status?: number; data?: { message?: string } };
                        request?: unknown;
                        code?: string;
                    };

                    if (!axiosError.response) {
                        toast.error('Sem ligação ao servidor. Verifique a sua ligação à internet e tente novamente.', { duration: 6000, icon: '📡' });
                    } else if (axiosError.response.status === 401 || axiosError.response.status === 403) {
                        toast.error('Email ou senha incorretos. Verifique as suas credenciais e tente novamente.', { duration: 5000 });
                    } else {
                        toast.error(axiosError.response.data?.message || 'Erro no servidor. Tente mais tarde ou contacte o suporte.', { duration: 6000 });
                    }

                    return false;
                }
            },

            // Logout
            logout: () => {
                const { user } = get();
                if (user) {
                    const addAuditLog = useAuditStore.getState().addLog;
                    addAuditLog({
                        userId: user.id,
                        userName: user.name,
                        userRole: user.role,
                        module: 'auth',
                        action: 'logout',
                        severity: 'info',
                        entityType: 'User',
                        entityId: user.id,
                        entityName: user.name,
                        description: `Logout: ${user.email}`,
                        success: true,
                    });
                }

                // Clear token from localStorage
                localStorage.removeItem('auth_token');

                // Reset other stores to prevent multi-company data leakage
                useStore.getState().reset();
                useFiscalStore.getState().reset();

                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                });

                toast.success('Sessão encerrada.');
            },

            // Register new user
            register: async (userData: RegisterData) => {
                set({ isLoading: true });

                try {
                    await authAPI.register(userData);
                    set({ isLoading: false });
                    toast.success('Conta criada com sucesso! Faça login para continuar.');
                    return { success: true };
                } catch (error) {
                    set({ isLoading: false });
                    const responseData = (error as {
                        response?: {
                            data?: {
                                message?: string;
                                errors?: Array<{ label?: string; message?: string; field?: string }>;
                            };
                        };
                    })?.response?.data;
                    const firstDetail = responseData?.errors?.[0];
                    const errorMessage =
                        responseData?.message ||
                        (firstDetail?.label && firstDetail?.message ? `${firstDetail.label}: ${firstDetail.message}` : firstDetail?.message) ||
                        'Erro ao criar conta.';
                    toast.error(errorMessage);
                    return { success: false, error: errorMessage };
                }
            },

            // Update user preferences
            updatePreferences: async (preferences: Record<string, unknown>) => {
                const { user } = get();
                if (!user) return;

                try {
                    const updatedUser = await authAPI.updatePreferences(preferences);
                    
                    const enrichedUser = {
                        ...user,
                        ...updatedUser,
                        preferences: updatedUser.preferences || {},
                    };

                    localStorage.setItem('auth_user', JSON.stringify(enrichedUser));

                    set({
                        user: enrichedUser,
                    });
                } catch (error) {
                    console.error('Failed to update preferences:', error);
                    toast.error('Erro ao guardar as preferências. Tente novamente.');
                }
            },

            // Check auth on app load
            checkAuth: async () => {
                const token = localStorage.getItem('auth_token');

                if (!token) {
                    set({ isLoading: false, isAuthenticated: false });
                    return;
                }

                try {
                    const response = await authAPI.getMe();
                    // /me returns a flat object with user fields + activeModules, permissions, etc.
                    const user = response;

                    // Update auth_user in localStorage to keep it in sync
                    localStorage.setItem('auth_user', JSON.stringify(user));

                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Trigger fiscal data sync after successful auth check (reload)
                    useFiscalStore.getState().loadFiscalDataFromDatabase();
                } catch (error) {
                    // Token is invalid or expired
                    localStorage.removeItem('auth_token');
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },
        }),
        {
            name: 'auth-store',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Check auth status after rehydration
                    state.checkAuth();
                }
            },
        }
    )
);

// ============================================================================
// Selectors
// ============================================================================

export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAuthLoading = () => useAuthStore((state) => state.isLoading);
