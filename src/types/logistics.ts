/**
 * Logistics Module Type Definitions
 */

export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

export type VehicleType = 'truck' | 'van' | 'motorcycle' | 'car' | 'bicycle' | 'other';
export type VehicleStatus = 'available' | 'in_use' | 'maintenance' | 'inactive';

export interface Vehicle {
    id: string;
    plate: string;
    brand: string;
    model: string;
    year?: number;
    type: VehicleType;
    capacity?: number;
    capacityUnit?: string;
    fuelType?: string;
    status: VehicleStatus;
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
export type DriverStatus = 'available' | 'on_delivery' | 'off_duty' | 'inactive';

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
    status: DriverStatus;
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

export type DeliveryStatus = 'pending' | 'scheduled' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned' | 'cancelled';
export type DeliveryPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Delivery {
    id: string;
    number: string;
    orderId?: string;
    customerId?: string;
    routeId?: string;
    vehicleId?: string;
    driverId?: string;
    status: DeliveryStatus;
    priority: DeliveryPriority;
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

export type ParcelStatus = 'received' | 'awaiting_pickup' | 'picked_up' | 'overdue' | 'returned_to_sender' | 'lost';

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
    status: ParcelStatus;
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

export interface DeliveryStatusEvent {
    status: DeliveryStatus;
    label: string;
    timestamp: string | null;
    isCompleted: boolean;
    isCurrent: boolean;
    notes?: string;
}

export type ExpiryAlertSeverity = 'expired' | 'critical' | 'warning';

export interface ExpiryAlert {
    id: string;
    entityType: 'vehicle' | 'driver';
    entityId: string;
    entityLabel: string;
    documentType: string;
    expiryDate: string;
    daysUntilExpiry: number;
    severity: ExpiryAlertSeverity;
}

export interface LogisticsReportsSummary {
    summary: {
        total: number;
        delivered: number;
        failed: number;
        pending: number;
        inTransit: number;
        successRate: number;
        totalRevenue: number;
        avgDeliveryHours: number;
    };
    statusDistribution: Array<{ status: string; count: number }>;
    driverPerformance: Array<{ name: string; total: number; delivered: number; failed: number; successRate: number }>;
    routeUsage: Array<{ name: string; count: number; revenue: number }>;
}
