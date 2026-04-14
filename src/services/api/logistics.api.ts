/**
 * Logistics API Service
 * Frontend API methods for vehicles, drivers, routes, deliveries, and parcels
 */

import api from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

export interface Vehicle {
    id: string;
    plate: string;
    brand: string;
    model: string;
    year?: number;
    type: 'truck' | 'van' | 'motorcycle' | 'car' | 'bicycle' | 'other';
    capacity?: number;
    capacityUnit?: string;
    fuelType?: string;
    status: 'available' | 'in_use' | 'maintenance' | 'inactive';
    lastMaintenance?: string;
    nextMaintenance?: string;
    mileage: number;
    insuranceExpiry?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    maintenances?: VehicleMaintenance[];
    _count?: { deliveries: number };
}

export type StaffCategory = 'driver' | 'mechanic' | 'warehouse' | 'manager' | 'admin' | 'other';

export interface Driver {
    id: string;
    code: string;
    name: string;
    phone: string;
    email?: string;
    category: StaffCategory;
    licenseNumber?: string;
    licenseType?: string;
    licenseExpiry?: string;
    medicalExamExpiry?: string;
    safetyTrainingDate?: string;
    status: 'available' | 'on_delivery' | 'off_duty' | 'inactive';
    hireDate?: string;
    baseSalary: number;
    subsidyTransport?: number;
    subsidyFood?: number;
    commissionRate?: number;
    address?: string;
    emergencyContact?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankNib?: string;
    socialSecurityNumber?: string;
    nuit?: string;
    birthDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    _count?: { deliveries: number; maintenanceTasks?: number };
}

export interface StaffAttendance {
    id: string;
    staffId: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    status: 'present' | 'absent' | 'late' | 'leave';
    notes?: string;
    staff?: Driver;
}

export interface StaffPayroll {
    id: string;
    staffId: string;
    month: number;
    year: number;
    baseSalary: number;
    commissions: number;
    bonuses: number;
    totalEarnings: number;
    deductions: number;
    netSalary: number;
    status: 'draft' | 'processed' | 'paid';
    paidAt?: string;
    staff?: Driver;
}

export interface DeliveryRoute {
    id: string;
    code: string;
    name: string;
    origin: string;
    destination: string;
    distance?: number;
    estimatedTime?: number;
    tollCost?: number;
    fuelEstimate?: number;
    isActive: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    _count?: { deliveries: number };
}

export interface DeliveryItem {
    id: string;
    deliveryId: string;
    productId?: string;
    description: string;
    quantity: number;
    weight?: number;
    notes?: string;
    product?: { id: string; name: string; code: string };
}

export interface Delivery {
    id: string;
    number: string;
    orderId?: string;
    customerId?: string;
    routeId?: string;
    vehicleId?: string;
    driverId?: string;
    status: 'pending' | 'scheduled' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    scheduledDate?: string;
    departureDate?: string;
    deliveredDate?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientSign?: string;
    deliveryAddress: string;
    latitude?: number;
    longitude?: number;
    country?: string;
    province?: string;
    city?: string;
    shippingCost?: number;
    isPaid: boolean;
    transactionId?: string;
    notes?: string;
    proofOfDelivery?: string;
    failureReason?: string;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    driver?: Driver;
    vehicle?: Vehicle;
    route?: DeliveryRoute;
    items: DeliveryItem[];
}

export interface ParcelNotification {
    id: string;
    parcelId: string;
    type: 'email' | 'sms' | 'whatsapp' | 'push';
    recipient: string;
    message: string;
    sentAt: string;
    status: string;
    errorMsg?: string;
}

export interface Parcel {
    id: string;
    trackingNumber: string;
    senderName: string;
    senderPhone: string;
    senderEmail?: string;
    senderAddress?: string;
    recipientName: string;
    recipientPhone: string;
    recipientEmail?: string;
    recipientAddress?: string;
    recipientDocument?: string;
    description?: string;
    weight?: number;
    dimensions?: string;
    status: 'received' | 'awaiting_pickup' | 'picked_up' | 'overdue' | 'returned_to_sender' | 'lost';
    receivedAt: string;
    expectedPickup?: string;
    pickedUpAt?: string;
    pickedUpBy?: string;
    pickedUpDocument?: string;
    pickupSignature?: string;
    storageLocation?: string;
    warehouseId?: string;
    fees: number;
    isPaid: boolean;
    paymentMethod?: string;
    receiverRelationship?: string;
    transactionId?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    warehouse?: { id: string; name: string; location?: string };
    notifications?: ParcelNotification[];
}

export interface VehicleMaintenance {
    id: string;
    vehicleId: string;
    type: 'preventive' | 'corrective' | 'inspection' | 'emergency';
    description: string;
    cost: number;
    date: string;
    nextDate?: string;
    mileageAt?: number;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    provider?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    vehicle?: Vehicle;
}

export interface FuelSupply {
    id: string;
    vehicleId: string;
    date: string;
    liters: number;
    pricePerLiter?: number;
    amount: number;
    mileage: number;
    provider?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    vehicle?: Vehicle;
}

export interface VehicleIncident {
    id: string;
    vehicleId: string;
    driverId?: string;
    date: string;
    type: 'accident' | 'fine' | 'breakdown' | 'theft' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    cost?: number;
    location?: string;
    status: 'open' | 'resolved' | 'closed';
    createdAt: string;
    updatedAt: string;
    vehicle?: Vehicle;
    driver?: Driver;
}

export interface LogisticsDashboard {
    totals: {
        vehicles: number;
        drivers: number;
        routes: number;
        deliveries: number;
        parcels: number;
    };
    stats: {
        pendingDeliveries: number;
        inTransitDeliveries: number;
        deliveredToday: number;
        availableVehicles: number;
        availableDrivers: number;
        pendingParcels: number;
        pickupRevenue: number;
        deliveryRevenue: number;
        deliveriesByProvince: Array<{ province: string; count: number }>;
    };
    recentDeliveries: Delivery[];
}

/**
 * Represents a single status transition event in a delivery's lifecycle.
 * Built from delivery data to reconstruct the status progression timeline.
 */
export interface DeliveryStatusEvent {
    status: Delivery['status'];
    label: string;
    timestamp: string | null;
    isCompleted: boolean;
    isCurrent: boolean;
    notes?: string;
}

/**
 * Represents an expiry alert for a compliance document.
 * Severity is derived from daysUntilExpiry:
 *   expired  -> daysUntilExpiry <= 0
 *   critical -> 1..14 days
 *   warning  -> 15..30 days
 */
export type ExpiryAlertSeverity = 'expired' | 'critical' | 'warning';

export interface ExpiryAlert {
    /** Unique key for React rendering (entityId + documentType) */
    id: string;
    entityType: 'vehicle' | 'driver';
    entityId: string;
    /** Human-readable label, e.g. "Toyota Hilux (ABC-123-DE)" */
    entityLabel: string;
    /** Document type label, e.g. "Seguro" or "Carta de Condução" */
    documentType: string;
    expiryDate: string;
    daysUntilExpiry: number;
    severity: ExpiryAlertSeverity;
}



// ============================================================================
// API METHODS
// ============================================================================

export const logisticsAPI = {
    // Dashboard
    getDashboard: async (): Promise<LogisticsDashboard> => {
        const response = await api.get('/logistics/dashboard');
        return response.data;
    },

    // Vehicles
    getVehicles: async (params?: { status?: string; type?: string; search?: string; page?: number; limit?: number }): Promise<{ data: Vehicle[]; pagination: PaginationInfo }> => {
        const response = await api.get('/logistics/vehicles', { params });
        return response.data;
    },

    getVehicle: async (id: string): Promise<Vehicle> => {
        const response = await api.get(`/logistics/vehicles/${id}`);
        return response.data;
    },

    createVehicle: async (data: Partial<Vehicle>): Promise<Vehicle> => {
        const response = await api.post('/logistics/vehicles', data);
        return response.data;
    },

    updateVehicle: async (id: string, data: Partial<Vehicle>): Promise<Vehicle> => {
        const response = await api.put(`/logistics/vehicles/${id}`, data);
        return response.data;
    },

    deleteVehicle: async (id: string): Promise<void> => {
        await api.delete(`/logistics/vehicles/${id}`);
    },

    // Drivers / Staff
    getDrivers: async (params?: { status?: string; category?: string; search?: string; page?: number; limit?: number }): Promise<{ data: Driver[]; pagination: PaginationInfo }> => {
        const response = await api.get('/logistics/drivers', { params });
        return response.data;
    },

    getDriver: async (id: string): Promise<Driver> => {
        const response = await api.get(`/logistics/drivers/${id}`);
        return response.data;
    },

    createDriver: async (data: Partial<Driver>): Promise<Driver> => {
        const response = await api.post('/logistics/drivers', data);
        return response.data;
    },

    updateDriver: async (id: string, data: Partial<Driver>): Promise<Driver> => {
        const response = await api.put(`/logistics/drivers/${id}`, data);
        return response.data;
    },

    deleteDriver: async (id: string): Promise<void> => {
        await api.delete(`/logistics/drivers/${id}`);
    },

    // Routes
    getRoutes: async (params?: { active?: boolean; search?: string; page?: number; limit?: number }): Promise<{ data: DeliveryRoute[]; pagination: PaginationInfo }> => {
        const response = await api.get('/logistics/routes', { params });
        return response.data;
    },

    getRoute: async (id: string): Promise<DeliveryRoute> => {
        const response = await api.get(`/logistics/routes/${id}`);
        return response.data;
    },

    createRoute: async (data: Partial<DeliveryRoute>): Promise<DeliveryRoute> => {
        const response = await api.post('/logistics/routes', data);
        return response.data;
    },

    updateRoute: async (id: string, data: Partial<DeliveryRoute>): Promise<DeliveryRoute> => {
        const response = await api.put(`/logistics/routes/${id}`, data);
        return response.data;
    },

    deleteRoute: async (id: string): Promise<void> => {
        await api.delete(`/logistics/routes/${id}`);
    },

    // Deliveries
    getDeliveries: async (params?: {
        status?: string;
        priority?: string;
        driverId?: string;
        vehicleId?: string;
        search?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{ deliveries: Delivery[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> => {
        const response = await api.get('/logistics/deliveries', { params });
        return response.data;
    },

    getDelivery: async (id: string): Promise<Delivery> => {
        const response = await api.get(`/logistics/deliveries/${id}`);
        return response.data;
    },

    createDelivery: async (data: Partial<Delivery> & { items?: Array<{ productId?: string; description: string; quantity: number; weight?: number }> }): Promise<Delivery> => {
        const response = await api.post('/logistics/deliveries', data);
        return response.data;
    },

    updateDelivery: async (id: string, data: Partial<Delivery>): Promise<Delivery> => {
        const response = await api.put(`/logistics/deliveries/${id}`, data);
        return response.data;
    },

    updateDeliveryStatus: async (id: string, data: { status: string; failureReason?: string; recipientSign?: string; proofOfDelivery?: string }): Promise<Delivery> => {
        const response = await api.put(`/logistics/deliveries/${id}/status`, data);
        return response.data;
    },

    deleteDelivery: async (id: string): Promise<void> => {
        await api.delete(`/logistics/deliveries/${id}`);
    },

    payDelivery: async (id: string, data: { paymentMethod: string; amount?: number }): Promise<Delivery> => {
        const response = await api.post(`/logistics/deliveries/${id}/pay`, data);
        return response.data;
    },

    downloadDeliveryPDF: async (id: string): Promise<Blob> => {
        const response = await api.get(`/logistics/deliveries/${id}/pdf`, { responseType: 'blob' });
        return response.data;
    },

    // Parcels
    getParcels: async (params?: {
        status?: string;
        warehouseId?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ parcels: Parcel[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> => {
        const response = await api.get('/logistics/parcels', { params });
        return response.data;
    },

    trackParcel: async (trackingNumber: string): Promise<Parcel> => {
        const response = await api.get(`/logistics/parcels/track/${trackingNumber}`);
        return response.data;
    },

    getParcel: async (id: string): Promise<Parcel> => {
        const response = await api.get(`/logistics/parcels/${id}`);
        return response.data;
    },

    createParcel: async (data: Partial<Parcel>): Promise<Parcel> => {
        const response = await api.post('/logistics/parcels', data);
        return response.data;
    },

    updateParcel: async (id: string, data: Partial<Parcel>): Promise<Parcel> => {
        const response = await api.put(`/logistics/parcels/${id}`, data);
        return response.data;
    },

    registerParcelPickup: async (id: string, data: { pickedUpBy: string; pickedUpDocument?: string; pickupSignature?: string; paymentMethod?: string; isPaid?: boolean }): Promise<Parcel> => {
        const response = await api.post(`/logistics/parcels/${id}/pickup`, data);
        return response.data;
    },

    updateParcelStatus: async (id: string, status: string): Promise<Parcel> => {
        const response = await api.put(`/logistics/parcels/${id}/status`, { status });
        return response.data;
    },

    sendParcelNotification: async (id: string, data: { type?: string; recipient?: string; message: string }): Promise<ParcelNotification> => {
        const response = await api.post(`/logistics/parcels/${id}/notify`, data);
        return response.data;
    },

    deleteParcel: async (id: string): Promise<void> => {
        await api.delete(`/logistics/parcels/${id}`);
    },

    // Vehicle Maintenance
    getMaintenances: async (params?: { vehicleId?: string; status?: string; page?: number; limit?: number }): Promise<{ data: VehicleMaintenance[]; pagination: PaginationInfo }> => {
        const response = await api.get('/logistics/maintenances', { params });
        return response.data;
    },

    createMaintenance: async (data: Partial<VehicleMaintenance>): Promise<VehicleMaintenance> => {
        const response = await api.post('/logistics/maintenances', data);
        return response.data;
    },

    updateMaintenance: async (id: string, data: Partial<VehicleMaintenance>): Promise<VehicleMaintenance> => {
        const response = await api.put(`/logistics/maintenances/${id}`, data);
        return response.data;
    },

    deleteMaintenance: async (id: string): Promise<void> => {
        await api.delete(`/logistics/maintenances/${id}`);
    },

    // Fuel
    getFuelSupplies: async (params?: { vehicleId?: string; startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<{ data: FuelSupply[]; pagination: PaginationInfo }> => {
        const response = await api.get('/logistics/fuel', { params });
        return response.data;
    },

    createFuelSupply: async (data: Partial<FuelSupply>): Promise<FuelSupply> => {
        const response = await api.post('/logistics/fuel', data);
        return response.data;
    },

    deleteFuelSupply: async (id: string): Promise<void> => {
        await api.delete(`/logistics/fuel/${id}`);
    },

    // Incidents
    getIncidents: async (params?: { vehicleId?: string; driverId?: string; type?: string; page?: number; limit?: number }): Promise<{ data: VehicleIncident[]; pagination: PaginationInfo }> => {
        const response = await api.get('/logistics/incidents', { params });
        return response.data;
    },

    createIncident: async (data: Partial<VehicleIncident>): Promise<VehicleIncident> => {
        const response = await api.post('/logistics/incidents', data);
        return response.data;
    },

    updateIncident: async (id: string, data: Partial<VehicleIncident>): Promise<VehicleIncident> => {
        const response = await api.put(`/logistics/incidents/${id}`, data);
        return response.data;
    },

    deleteIncident: async (id: string): Promise<void> => {
        await api.delete(`/logistics/incidents/${id}`);
    },

    // Staff HR Extensions
    getStaffAttendance: async (params?: { staffId?: string; startDate?: string; endDate?: string }): Promise<StaffAttendance[]> => {
        const response = await api.get('/logistics/hr/attendance', { params });
        return response.data;
    },

    recordStaffTime: async (data: { staffId: string; type: 'checkIn' | 'checkOut'; timestamp?: string; notes?: string }): Promise<StaffAttendance> => {
        const response = await api.post('/logistics/hr/attendance', data);
        return response.data;
    },

    getStaffPayroll: async (params?: { staffId?: string; month?: number; year?: number; status?: string }): Promise<StaffPayroll[]> => {
        const response = await api.get('/logistics/hr/payroll', { params });
        return response.data;
    },

    createStaffPayroll: async (data: { staffId: string; month: number; year: number }): Promise<StaffPayroll> => {
        const response = await api.post('/logistics/hr/payroll', data);
        return response.data;
    },

    updateStaffPayrollStatus: async (id: string, status: 'processed' | 'paid'): Promise<StaffPayroll> => {
        const response = await api.patch(`/logistics/hr/payroll/${id}/status`, { status });
        return response.data;
    }
};

export default logisticsAPI;
