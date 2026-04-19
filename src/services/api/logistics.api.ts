import api from './client';
import type {
    Vehicle, Driver, DeliveryRoute, Delivery, PaginationInfo,
    LogisticsDashboard, LogisticsReportsSummary,
    VehicleMaintenance, FuelSupply, VehicleIncident,
    StaffAttendance, StaffPayroll
} from '../../types/logistics';

export type { DeliveryStatusEvent, ExpiryAlert, ExpiryAlertSeverity } from '../../types/logistics';
export type { Vehicle, Driver, DeliveryRoute, Delivery, VehicleMaintenance, FuelSupply, VehicleIncident, StaffAttendance, StaffPayroll, StaffCategory } from '../../types/logistics';

// ============================================================================
// Parcel types
// ============================================================================

export interface Parcel {
    id: string;
    trackingNumber: string;
    senderId?: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress?: string;
    warehouseId?: string;
    description?: string;
    weight?: number;
    value?: number;
    status: string;
    isPaid: boolean;
    paymentMethod?: string;
    price?: number;
    pickedUpBy?: string;
    pickedUpAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ParcelNotification {
    id: string;
    parcelId: string;
    type: string;
    recipient: string;
    message: string;
    sentAt: string;
    status: string;
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
    },

    // Reports Summary
    getReportsSummary: async (params?: { startDate?: string; endDate?: string }): Promise<LogisticsReportsSummary> => {
        const response = await api.get('/logistics/reports/summary', { params });
        return response.data;
    },

    // Finance
    getFinanceDashboard: async (period?: string) => {
        const response = await api.get('/logistics/finance/dashboard', { params: { period } });
        return response.data;
    },
    getTransactions: async (params?: any) => {
        const response = await api.get('/logistics/finance/transactions', { params });
        return response.data;
    },
    createTransaction: async (data: any) => {
        const response = await api.post('/logistics/finance/transactions', data);
        return response.data;
    },
    updateTransaction: async (id: string, data: any) => {
        const response = await api.put(`/logistics/finance/transactions/${id}`, data);
        return response.data;
    },
    deleteTransaction: async (id: string) => {
        const response = await api.delete(`/logistics/finance/transactions/${id}`);
        return response.data;
    }
};

export default logisticsAPI;
