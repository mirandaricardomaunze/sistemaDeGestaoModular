import { create } from 'zustand';

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

interface NotificationsActions {
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
    removeNotification: (id: string) => void;
    clearAllNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsState & NotificationsActions>((set) => ({
    items: [],

    addNotification: (notification) => set((state) => ({
        items: [
            ...state.items,
            {
                ...notification,
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                autoClose: notification.autoClose ?? true,
                duration: notification.duration ?? 5000,
            },
        ],
    })),

    removeNotification: (id) => set((state) => ({
        items: state.items.filter((n) => n.id !== id),
    })),

    clearAllNotifications: () => set({ items: [] }),
}));
