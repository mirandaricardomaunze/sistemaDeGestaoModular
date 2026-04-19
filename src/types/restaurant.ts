/**
 * Restaurant Module Type Definitions
 */

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

export interface RestaurantDashboard {
    summary: {
        totalRevenue: number;
        activeTables: number;
        pendingOrders: number;
        avgPrepTime: number;
        estimatedRevenue: number;
    };
    stats: {
        ordersOverTime: Array<{ date: string; count: number; amount: number }>;
        categoryDistribution: Array<{ category: string; count: number }>;
        mostPopularItems: Array<{ name: string; count: number }>;
    };
}
