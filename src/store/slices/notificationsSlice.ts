import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    timestamp: number;
    autoClose?: boolean;
    duration?: number;
}

interface NotificationsState {
    items: Notification[];
}

const initialState: NotificationsState = {
    items: [],
};

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp'>>) => {
            const notification: Notification = {
                ...action.payload,
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                autoClose: action.payload.autoClose ?? true,
                duration: action.payload.duration ?? 5000,
            };
            state.items.push(notification);
        },
        removeNotification: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter((n: Notification) => n.id !== action.payload);
        },
        clearAllNotifications: (state) => {
            state.items = [];
        },
    },
});

export const {
    addNotification,
    removeNotification,
    clearAllNotifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
