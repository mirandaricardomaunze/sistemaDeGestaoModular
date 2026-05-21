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

export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

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
    // Optional augmented fields included by some backend responses (recent bookings list)
    customerName?: string;
    roomNumber?: string;
    roomType?: string;
    totalPrice?: number;
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
    metrics?: HotelDashboardMetrics;
    todayCheckouts?: HotelBooking[];
    todayCheckins?: HotelBooking[];
    recentBookings?: HotelBooking[];
    roomStatusDistribution?: Array<{ status: string; count: number }>;
    // Flat-shape fields returned by /hospitality/dashboard/summary
    totalRooms?: number;
    occupiedRooms?: number;
    availableRooms?: number;
    occupancyRate?: number;
    todayRevenue?: number;
    monthRevenue?: number;
    todayCheckIns?: number;
    todayCheckOuts?: number;
    pendingCheckouts?: number;
    monthlyGrowth?: number;
    revenueChart?: Array<{ date: string; revenue: number }>;
    weeklyChart?: Array<{ day: string; revenue: number; bookings?: number }>;
    roomTypeData?: Array<{ type: string; count: number; percentage?: number }>;
}
