import { create } from 'zustand';

export interface Alert {
    id: string;
    type: 'low_stock' | 'expired_product' | 'payment_due' | 'order_delayed' | 'system' | 'employee' | 'sales';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    message: string;
    isRead: boolean;
    isResolved: boolean;
    relatedId?: string;
    relatedType?: string;
    createdAt: string;
    resolvedAt?: string;
}

interface AlertsState {
    items: Alert[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;
}

interface AlertsActions {
    setAlerts: (alerts: Alert[]) => void;
    addAlert: (alert: Alert) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    resolveAlert: (id: string) => void;
    removeAlert: (id: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

const initialState: AlertsState = {
    items: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
};

export const useAlertsStore = create<AlertsState & AlertsActions>((set) => ({
    ...initialState,

    setAlerts: (alerts) => set({
        items: alerts,
        unreadCount: alerts.filter((a) => !a.isRead).length,
    }),

    addAlert: (alert) => set((state) => ({
        items: [alert, ...state.items],
        unreadCount: !alert.isRead ? state.unreadCount + 1 : state.unreadCount,
    })),

    markAsRead: (id) => set((state) => {
        const alert = state.items.find((a) => a.id === id);
        if (!alert || alert.isRead) return state;

        return {
            items: state.items.map((a) =>
                a.id === id ? { ...a, isRead: true } : a
            ),
            unreadCount: state.unreadCount - 1,
        };
    }),

    markAllAsRead: () => set((state) => ({
        items: state.items.map((a) => ({ ...a, isRead: true })),
        unreadCount: 0,
    })),

    resolveAlert: (id) => set((state) => ({
        items: state.items.map((a) =>
            a.id === id
                ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() }
                : a
        ),
    })),

    removeAlert: (id) => set((state) => {
        const alertToRemove = state.items.find((a) => a.id === id);
        return {
            items: state.items.filter((a) => a.id !== id),
            unreadCount: alertToRemove && !alertToRemove.isRead
                ? state.unreadCount - 1
                : state.unreadCount,
        };
    }),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    reset: () => set(initialState),
}));
