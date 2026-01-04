import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

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

const initialState: AlertsState = {
    items: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
};

const alertsSlice = createSlice({
    name: 'alerts',
    initialState,
    reducers: {
        setAlerts: (state, action: PayloadAction<Alert[]>) => {
            state.items = action.payload;
            state.unreadCount = action.payload.filter((a: Alert) => !a.isRead).length;
        },
        addAlert: (state, action: PayloadAction<Alert>) => {
            state.items.unshift(action.payload);
            if (!action.payload.isRead) {
                state.unreadCount += 1;
            }
        },
        markAsRead: (state, action: PayloadAction<string>) => {
            const alert = state.items.find((a: Alert) => a.id === action.payload);
            if (alert && !alert.isRead) {
                alert.isRead = true;
                state.unreadCount -= 1;
            }
        },
        markAllAsRead: (state) => {
            state.items.forEach((alert: Alert) => {
                alert.isRead = true;
            });
            state.unreadCount = 0;
        },
        resolveAlert: (state, action: PayloadAction<string>) => {
            const alert = state.items.find((a: Alert) => a.id === action.payload);
            if (alert) {
                alert.isResolved = true;
                alert.resolvedAt = new Date().toISOString();
            }
        },
        removeAlert: (state, action: PayloadAction<string>) => {
            const index = state.items.findIndex((a: Alert) => a.id === action.payload);
            if (index !== -1) {
                if (!state.items[index].isRead) {
                    state.unreadCount -= 1;
                }
                state.items.splice(index, 1);
            }
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
    },
});

export const {
    setAlerts,
    addAlert,
    markAsRead,
    markAllAsRead,
    resolveAlert,
    removeAlert,
    setLoading,
    setError,
} = alertsSlice.actions;

export default alertsSlice.reducer;
