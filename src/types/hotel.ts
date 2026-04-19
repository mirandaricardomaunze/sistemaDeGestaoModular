/**
 * Hotel (Hospitality) Module Type Definitions
 */

export interface HotelRoom {
    id: string;
    number: string | number;
    type: string;
    status: 'available' | 'occupied' | 'dirty' | 'maintenance' | 'reserved';
    price: number;
    floor?: number;
    description?: string;
    amenities?: string[];
    maxOccupancy?: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'checked_out' | 'cancelled' | 'no_show';

export interface HotelBooking {
    id: string;
    roomId: string;
    room?: HotelRoom;
    guestName: string;
    guestEmail?: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    status: BookingStatus;
    totalAmount: number;
    paidAmount: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface HousekeepingTask {
    id: string;
    roomId: string;
    room?: HotelRoom;
    type: 'cleaning' | 'maintenance' | 'inspection' | 'laundry';
    priority: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    assignedTo?: string;
    notes?: string;
    scheduledAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface HotelDashboardMetrics {
    available: number;
    occupied: number;
    dirty: number;
    maintenance: number;
    total: number;
    occupancyRate: number;
    revPAR: number; // Revenue Per Available Room
}

export interface HotelDashboard {
    metrics: HotelDashboardMetrics;
    todayCheckouts: HotelBooking[];
    todayCheckins: HotelBooking[];
    recentBookings: HotelBooking[];
    roomStatusDistribution: Array<{ status: string; count: number }>;
}
