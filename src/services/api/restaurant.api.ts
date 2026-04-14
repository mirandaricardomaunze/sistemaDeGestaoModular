/**
 * Restaurant API Service
 * Types and methods for: Tables, Menu, Orders/Kitchen, Reservations, Reports
 */

import client from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface RestaurantTable {
    id: string;
    number: number;
    name?: string;
    capacity: number;
    status: 'available' | 'occupied' | 'reserved' | 'maintenance';
    section?: string;
    notes?: string;
    companyId: string;
    createdAt: string;
    updatedAt: string;
    sales?: any[];
}

export interface RestaurantMenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    imageUrl?: string;
    /** Minutes to prepare */
    prepTime?: number;
    isAvailable: boolean;
    allergens?: string;
    calories?: number;
    companyId: string;
    createdAt: string;
    updatedAt: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface RestaurantOrderItem {
    id: string;
    menuItemId?: string;
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
}

export interface RestaurantOrder {
    id: string;
    orderNumber: string;
    tableId?: string;
    table?: Pick<RestaurantTable, 'id' | 'number' | 'name'>;
    status: OrderStatus;
    items: RestaurantOrderItem[];
    notes?: string;
    /** ISO timestamp when order was placed */
    createdAt: string;
    updatedAt: string;
    /** ISO timestamp when status changed to 'ready' */
    readyAt?: string;
    /** ISO timestamp when status changed to 'served' */
    servedAt?: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'seated';

export interface RestaurantReservation {
    id: string;
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    partySize: number;
    tableId?: string;
    table?: Pick<RestaurantTable, 'id' | 'number' | 'name'>;
    status: ReservationStatus;
    /** ISO datetime string */
    scheduledAt: string;
    notes?: string;
    companyId: string;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// API METHODS
// ============================================================================

export const restaurantAPI = {
    // ── Dashboard ─────────────────────────────────────────────────────────────
    getDashboard: async (range: string = '1M') => {
        const res = await client.get(`/restaurant/dashboard?range=${range}`);
        return res.data;
    },

    // ── Tables ────────────────────────────────────────────────────────────────
    getTables: async (params?: { status?: string; section?: string; page?: number; limit?: number }) => {
        const res = await client.get('/restaurant/tables', { params });
        return res.data;
    },

    getTableById: async (id: string) => {
        const res = await client.get(`/restaurant/tables/${id}`);
        return res.data;
    },

    createTable: async (data: { number: number; name?: string; capacity?: number; section?: string; notes?: string }) => {
        const res = await client.post('/restaurant/tables', data);
        return res.data;
    },

    updateTable: async (id: string, data: Partial<RestaurantTable>) => {
        const res = await client.put(`/restaurant/tables/${id}`, data);
        return res.data;
    },

    updateTableStatus: async (id: string, status: string) => {
        const res = await client.patch(`/restaurant/tables/${id}/status`, { status });
        return res.data;
    },

    deleteTable: async (id: string) => {
        const res = await client.delete(`/restaurant/tables/${id}`);
        return res.data;
    },

    // ── Menu Items ────────────────────────────────────────────────────────────
    getMenuItems: async (params?: { category?: string; isAvailable?: boolean; search?: string; page?: number; limit?: number }): Promise<{ data: RestaurantMenuItem[]; pagination: any }> => {
        const res = await client.get('/restaurant/menu', { params });
        return res.data;
    },

    createMenuItem: async (data: Omit<RestaurantMenuItem, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<RestaurantMenuItem> => {
        const res = await client.post('/restaurant/menu', data);
        return res.data;
    },

    updateMenuItem: async (id: string, data: Partial<RestaurantMenuItem>): Promise<RestaurantMenuItem> => {
        const res = await client.put(`/restaurant/menu/${id}`, data);
        return res.data;
    },

    deleteMenuItem: async (id: string): Promise<void> => {
        await client.delete(`/restaurant/menu/${id}`);
    },

    toggleMenuItemAvailability: async (id: string, isAvailable: boolean): Promise<RestaurantMenuItem> => {
        const res = await client.patch(`/restaurant/menu/${id}/availability`, { isAvailable });
        return res.data;
    },

    // ── Kitchen Orders ────────────────────────────────────────────────────────
    getKitchenOrders: async (params?: { status?: OrderStatus; limit?: number }): Promise<RestaurantOrder[]> => {
        const res = await client.get('/restaurant/orders', { params });
        return res.data;
    },

    updateOrderStatus: async (id: string, status: OrderStatus, notes?: string): Promise<RestaurantOrder> => {
        const res = await client.patch(`/restaurant/orders/${id}/status`, { status, notes });
        return res.data;
    },

    // ── Reservations ──────────────────────────────────────────────────────────
    getReservations: async (params?: {
        date?: string;
        status?: ReservationStatus;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ data: RestaurantReservation[]; pagination: any }> => {
        const res = await client.get('/restaurant/reservations', { params });
        return res.data;
    },

    createReservation: async (data: Omit<RestaurantReservation, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'table'>): Promise<RestaurantReservation> => {
        const res = await client.post('/restaurant/reservations', data);
        return res.data;
    },

    updateReservation: async (id: string, data: Partial<RestaurantReservation>): Promise<RestaurantReservation> => {
        const res = await client.put(`/restaurant/reservations/${id}`, data);
        return res.data;
    },

    deleteReservation: async (id: string): Promise<void> => {
        await client.delete(`/restaurant/reservations/${id}`);
    },

    updateReservationStatus: async (id: string, status: ReservationStatus): Promise<RestaurantReservation> => {
        const res = await client.patch(`/restaurant/reservations/${id}/status`, { status });
        return res.data;
    },

    // ── Reports ───────────────────────────────────────────────────────────────
    getReports: async (params: { startDate?: string; endDate?: string; page?: number; limit?: number }) => {
        const res = await client.get('/restaurant/reports', { params });
        return res.data;
    },
};
