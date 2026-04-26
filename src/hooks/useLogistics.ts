import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logisticsAPI } from '../services/api/logistics.api';
import type {
    Vehicle, Driver, DeliveryRoute, Delivery,
    LogisticsDashboard, PaginationInfo, DeliveryStatusEvent, ExpiryAlert,
    FuelSupply, VehicleIncident, StaffAttendance,
    StaffPayroll, LogisticsReportsSummary,
    VehicleMaintenance, ExpiryAlertSeverity
} from '../types/logistics';
import type { Parcel } from '../services/api/logistics.api';
import type { StockTransfer } from '../types';
import toast from 'react-hot-toast';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Wraps a React Query v5 mutation result to expose `isLoading` as an alias
 * for `isPending`, so existing components don't require updates.
 */
function withIsLoading<T extends object & { isPending: boolean }>(m: T) {
    return Object.assign(m, { isLoading: m.isPending });
}

/** Invalidate a set of logistics entity query keys */
function useInvalidate() {
    const qc = useQueryClient();
    return (keys: string[][]) => {
        keys.forEach(key => qc.invalidateQueries({ queryKey: key }));
    };
}

// ============================================================================
// DASHBOARD
// ============================================================================

export function useLogisticsDashboard() {
    return useQuery<LogisticsDashboard>({
        queryKey: ['logistics', 'dashboard'],
        queryFn: () => logisticsAPI.getDashboard(),
    });
}

// ============================================================================
// VEHICLES
// ============================================================================

export function useVehicles(params?: { status?: string; type?: string; search?: string; page?: number; limit?: number }) {
    return useQuery<{ data: Vehicle[]; pagination: PaginationInfo }>({
        queryKey: ['logistics', 'vehicles', params],
        queryFn: () => logisticsAPI.getVehicles(params),
    });
}

export function useVehicle(id: string) {
    return useQuery<Vehicle>({
        queryKey: ['logistics', 'vehicle', id],
        queryFn: () => logisticsAPI.getVehicle(id),
        enabled: !!id,
    });
}

export function useCreateVehicle() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<Vehicle>) => logisticsAPI.createVehicle(data),
        onSuccess: () => {
            invalidate([['logistics', 'vehicles'], ['logistics', 'dashboard']]);
            toast.success('Veículo criado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar veículo'),
    }));
}

export function useUpdateVehicle() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Vehicle> }) => logisticsAPI.updateVehicle(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'vehicles']]);
            toast.success('Veículo actualizado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar veículo'),
    }));
}

export function useDeleteVehicle() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteVehicle(id),
        onSuccess: () => {
            invalidate([['logistics', 'vehicles'], ['logistics', 'dashboard']]);
            toast.success('Veículo eliminado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar veículo'),
    }));
}

// ============================================================================
// DRIVERS
// ============================================================================

export function useDrivers(params?: { status?: string; category?: string; search?: string; page?: number; limit?: number }) {
    return useQuery<{ data: Driver[]; pagination: PaginationInfo }>({
        queryKey: ['logistics', 'drivers', params],
        queryFn: () => logisticsAPI.getDrivers(params),
    });
}

export function useDriver(id: string) {
    return useQuery<Driver>({
        queryKey: ['logistics', 'driver', id],
        queryFn: () => logisticsAPI.getDriver(id),
        enabled: !!id,
    });
}

export function useCreateDriver() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<Driver>) => logisticsAPI.createDriver(data),
        onSuccess: () => {
            invalidate([['logistics', 'drivers'], ['logistics', 'dashboard']]);
            toast.success('Motorista criado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar motorista'),
    }));
}

export function useUpdateDriver() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Driver> }) => logisticsAPI.updateDriver(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'drivers']]);
            toast.success('Motorista actualizado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar motorista'),
    }));
}

export function useDeleteDriver() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteDriver(id),
        onSuccess: () => {
            invalidate([['logistics', 'drivers'], ['logistics', 'dashboard']]);
            toast.success('Motorista eliminado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar motorista'),
    }));
}

// ============================================================================
// ROUTES
// ============================================================================

export function useDeliveryRoutes(params?: { active?: boolean; search?: string; page?: number; limit?: number }) {
    return useQuery<{ data: DeliveryRoute[]; pagination: PaginationInfo }>({
        queryKey: ['logistics', 'routes', params],
        queryFn: () => logisticsAPI.getRoutes(params),
    });
}

export function useDeliveryRoute(id: string) {
    return useQuery<DeliveryRoute>({
        queryKey: ['logistics', 'route', id],
        queryFn: () => logisticsAPI.getRoute(id),
        enabled: !!id,
    });
}

export function useCreateRoute() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<DeliveryRoute>) => logisticsAPI.createRoute(data),
        onSuccess: () => {
            invalidate([['logistics', 'routes'], ['logistics', 'dashboard']]);
            toast.success('Rota criada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar rota'),
    }));
}

export function useUpdateRoute() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<DeliveryRoute> }) => logisticsAPI.updateRoute(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'routes']]);
            toast.success('Rota actualizada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar rota'),
    }));
}

export function useDeleteRoute() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteRoute(id),
        onSuccess: () => {
            invalidate([['logistics', 'routes'], ['logistics', 'dashboard']]);
            toast.success('Rota eliminada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar rota'),
    }));
}

// ============================================================================
// DELIVERIES
// ============================================================================

export function useDeliveries(params?: {
    status?: string;
    priority?: string;
    driverId?: string;
    vehicleId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}) {
    return useQuery({
        queryKey: ['logistics', 'deliveries', params],
        queryFn: () => logisticsAPI.getDeliveries(params),
    });
}

export function useDelivery(id: string) {
    return useQuery<Delivery>({
        queryKey: ['logistics', 'delivery', id],
        queryFn: () => logisticsAPI.getDelivery(id),
        enabled: !!id,
    });
}

export function useCreateDelivery() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<Delivery> & { items?: Array<{ productId?: string; description: string; quantity: number; weight?: number }> }) =>
            logisticsAPI.createDelivery(data),
        onSuccess: () => {
            invalidate([['logistics', 'deliveries'], ['logistics', 'dashboard']]);
            toast.success('Entrega criada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar entrega'),
    }));
}

export function useUpdateDelivery() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Delivery> }) => logisticsAPI.updateDelivery(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'deliveries']]);
            toast.success('Entrega actualizada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar entrega'),
    }));
}

export function useUpdateDeliveryStatus() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, ...data }: { id: string; status: string; failureReason?: string; recipientSign?: string; proofOfDelivery?: string }) =>
            logisticsAPI.updateDeliveryStatus(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'deliveries'], ['logistics', 'dashboard'], ['logistics', 'drivers'], ['logistics', 'vehicles']]);
            toast.success('Estado da entrega actualizado');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar estado'),
    }));
}

export function usePayDelivery() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, ...data }: { id: string; paymentMethod: string; amount?: number }) =>
            logisticsAPI.payDelivery(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'deliveries'], ['logistics', 'dashboard']]);
            toast.success('Pagamento de entrega registado');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao processar pagamento'),
    }));
}

export function useDeleteDelivery() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteDelivery(id),
        onSuccess: () => {
            invalidate([['logistics', 'deliveries'], ['logistics', 'dashboard']]);
            toast.success('Entrega eliminada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar entrega'),
    }));
}

// ============================================================================
// PARCELS
// ============================================================================

export function useParcels(params?: {
    status?: string;
    warehouseId?: string;
    search?: string;
    page?: number;
    limit?: number;
}) {
    return useQuery({
        queryKey: ['logistics', 'parcels', params],
        queryFn: () => logisticsAPI.getParcels(params),
    });
}

export function useParcel(id: string) {
    return useQuery<Parcel>({
        queryKey: ['logistics', 'parcel', id],
        queryFn: () => logisticsAPI.getParcel(id),
        enabled: !!id,
    });
}

export function useTrackParcel(trackingNumber: string) {
    return useQuery<Parcel>({
        queryKey: ['logistics', 'parcel_track', trackingNumber],
        queryFn: () => logisticsAPI.trackParcel(trackingNumber),
        enabled: !!trackingNumber && trackingNumber.length >= 6,
    });
}

export function useCreateParcel() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<Parcel>) => logisticsAPI.createParcel(data),
        onSuccess: () => {
            invalidate([['logistics', 'parcels'], ['logistics', 'dashboard']]);
            toast.success('Encomenda registada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar encomenda'),
    }));
}

export function useUpdateParcel() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Parcel> }) => logisticsAPI.updateParcel(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'parcels']]);
            toast.success('Encomenda actualizada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar encomenda'),
    }));
}

export function useRegisterParcelPickup() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, ...data }: { id: string; pickedUpBy: string; pickedUpDocument?: string; receiverRelationship?: string; pickupSignature?: string; paymentMethod?: string; isPaid?: boolean; paidAmount?: number }) =>
            logisticsAPI.registerParcelPickup(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'parcels'], ['logistics', 'dashboard']]);
            toast.success('Levantamento registado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao registar levantamento'),
    }));
}

export function useSendParcelNotification() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, ...data }: { id: string; type?: string; recipient?: string; message: string }) =>
            logisticsAPI.sendParcelNotification(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'parcels']]);
            toast.success('Notificação enviada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao enviar notificação'),
    }));
}

export function useDeleteParcel() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteParcel(id),
        onSuccess: () => {
            invalidate([['logistics', 'parcels'], ['logistics', 'dashboard']]);
            toast.success('Encomenda eliminada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar encomenda'),
    }));
}

// ============================================================================
// VEHICLE MAINTENANCE
// ============================================================================

export function useVehicleMaintenances(params?: { vehicleId?: string; status?: string; page?: number; limit?: number }) {
    return useQuery<{ data: VehicleMaintenance[]; pagination: PaginationInfo }>({
        queryKey: ['logistics', 'maintenances', params],
        queryFn: () => logisticsAPI.getMaintenances(params),
    });
}

export function useCreateMaintenance() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<VehicleMaintenance>) => logisticsAPI.createMaintenance(data),
        onSuccess: () => {
            invalidate([['logistics', 'maintenances'], ['logistics', 'vehicles']]);
            toast.success('Manutenção registada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar manutenção'),
    }));
}

export function useUpdateMaintenance() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<VehicleMaintenance> }) => logisticsAPI.updateMaintenance(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'maintenances'], ['logistics', 'vehicles']]);
            toast.success('Manutenção actualizada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar manutenção'),
    }));
}

export function useDeleteMaintenance() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteMaintenance(id),
        onSuccess: () => {
            invalidate([['logistics', 'maintenances'], ['logistics', 'vehicles']]);
            toast.success('Manutenção eliminada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar manutenção'),
    }));
}

// ============================================================================
// DELIVERY STATUS TIMELINE
// ============================================================================

/**
 * Ordered list of all possible delivery statuses.
 * The position in this array defines the progression order.
 */
const DELIVERY_STATUS_SEQUENCE: Array<{ status: Delivery['status']; label: string }> = [
    { status: 'pending',           label: 'Pendente' },
    { status: 'scheduled',         label: 'Agendada' },
    { status: 'in_transit',        label: 'Em Trânsito' },
    { status: 'out_for_delivery',  label: 'Saiu para Entrega' },
    { status: 'delivered',         label: 'Entregue' },
];

/** Terminal/off-path statuses that break the normal sequence. */
const TERMINAL_FAILURE_STATUSES: Delivery['status'][] = ['failed', 'returned', 'cancelled'];

/**
 * Pure function: derives the status timeline events from a delivery object.
 * No API call needed -- uses data already present in the delivery.
 */
function buildStatusTimeline(delivery: Delivery): DeliveryStatusEvent[] {
    const currentStatusIndex = DELIVERY_STATUS_SEQUENCE.findIndex(
        (step) => step.status === delivery.status
    );

    const isTerminalFailure = TERMINAL_FAILURE_STATUSES.includes(delivery.status);

    const sequenceEvents: DeliveryStatusEvent[] = DELIVERY_STATUS_SEQUENCE.map((step, index) => {
        const isCompleted = !isTerminalFailure && index < currentStatusIndex;
        const isCurrent = !isTerminalFailure && index === currentStatusIndex;

        // Infer timestamps from available delivery fields
        let timestamp: string | null = null;
        if (step.status === 'pending') timestamp = delivery.createdAt;
        if (step.status === 'scheduled') timestamp = delivery.scheduledDate ?? null;
        if (step.status === 'in_transit') timestamp = delivery.departureDate ?? null;
        if (step.status === 'delivered') timestamp = delivery.deliveredDate ?? null;

        return { ...step, timestamp, isCompleted, isCurrent };
    });

    // Append a terminal failure event if delivery ended badly
    if (isTerminalFailure) {
        const terminalLabels: Record<string, string> = {
            failed: 'Entrega Falhada',
            returned: 'Devolvida',
            cancelled: 'Cancelada',
        };
        sequenceEvents.push({
            status: delivery.status,
            label: terminalLabels[delivery.status] ?? delivery.status,
            timestamp: delivery.updatedAt,
            isCompleted: false,
            isCurrent: true,
            notes: delivery.failureReason,
        });
    }

    return sequenceEvents;
}

/**
 * Hook: provides the status timeline for a single delivery.
 * Responsible ONLY for data derivation -- no side effects.
 */
export function useDeliveryStatusTimeline(delivery: Delivery | null): DeliveryStatusEvent[] {
    if (!delivery) return [];
    return buildStatusTimeline(delivery);
}

// ============================================================================
// EXPIRY ALERTS
// ============================================================================

const EXPIRY_CRITICAL_DAYS = 14;
const EXPIRY_WARNING_DAYS = 30;

/** Pure function: computes severity from days remaining. */
function computeExpirySeverity(daysUntilExpiry: number): ExpiryAlertSeverity {
    if (daysUntilExpiry <= 0) return 'expired';
    if (daysUntilExpiry <= EXPIRY_CRITICAL_DAYS) return 'critical';
    return 'warning';
}

/** Pure function: computes days between today and an ISO date string. */
function getDaysUntilExpiry(isoDate: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(isoDate);
    return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Pure function: derives expiry alerts from a vehicle's compliance data. */
function buildVehicleAlerts(vehicle: Vehicle): ExpiryAlert[] {
    const alerts: ExpiryAlert[] = [];
    const entityLabel = `${vehicle.brand} ${vehicle.model} (${vehicle.plate})`;

    if (!vehicle.insuranceExpiry) return alerts;

    const daysUntilExpiry = getDaysUntilExpiry(vehicle.insuranceExpiry);
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
        alerts.push({
            id: `${vehicle.id}-insurance`,
            entityType: 'vehicle',
            entityId: vehicle.id,
            entityLabel,
            documentType: 'Seguro',
            expiryDate: vehicle.insuranceExpiry,
            daysUntilExpiry,
            severity: computeExpirySeverity(daysUntilExpiry),
        });
    }

    return alerts;
}

/** Pure function: derives expiry alerts from a driver's compliance data. */
function buildDriverAlerts(driver: Driver): ExpiryAlert[] {
    const alerts: ExpiryAlert[] = [];

    if (!driver.licenseExpiry) return alerts;

    const daysUntilExpiry = getDaysUntilExpiry(driver.licenseExpiry);
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
        alerts.push({
            id: `${driver.id}-license`,
            entityType: 'driver',
            entityId: driver.id,
            entityLabel: `${driver.name} (${driver.code})`,
            documentType: 'Carta de Condução',
            expiryDate: driver.licenseExpiry,
            daysUntilExpiry,
            severity: computeExpirySeverity(daysUntilExpiry),
        });
    }

    return alerts;
}

/**
 * Hook: aggregates all expiry alerts across vehicles and drivers.
 * Fetches its own data -- no props needed -- and exposes a clean `alerts` array.
 * Components remain dumb: they just render what this hook provides.
 */
export function useExpiryAlerts(): { alerts: ExpiryAlert[]; isLoading: boolean } {
    const { data: vehiclesData, isLoading: loadingVehicles } = useVehicles({ limit: 200 } as any);
    const { data: driversData, isLoading: loadingDrivers } = useDrivers({ limit: 200 } as any);

    const isLoading = loadingVehicles || loadingDrivers;

    if (isLoading || !vehiclesData || !driversData) {
        return { alerts: [], isLoading };
    }

    const vehicleAlerts = vehiclesData.data.flatMap(buildVehicleAlerts);
    const driverAlerts = driversData.data.flatMap(buildDriverAlerts);

    // Sort by severity (expired first) then by days ascending
    const severityOrder: Record<ExpiryAlertSeverity, number> = { expired: 0, critical: 1, warning: 2 };
    const alerts = [...vehicleAlerts, ...driverAlerts].sort(
        (a, b) =>
            severityOrder[a.severity] - severityOrder[b.severity] ||
            a.daysUntilExpiry - b.daysUntilExpiry
    );

    return { alerts, isLoading: false };
}

// ============================================================================
// FUEL MANAGEMENT
// ============================================================================

export function useFuelSupplies(params?: { vehicleId?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) {
    return useQuery<{ data: FuelSupply[]; pagination: PaginationInfo }>({
        queryKey: ['logistics', 'fuel', params],
        queryFn: () => logisticsAPI.getFuelSupplies(params),
    });
}

export function useCreateFuelSupply() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<FuelSupply>) => logisticsAPI.createFuelSupply(data),
        onSuccess: () => {
            invalidate([['logistics', 'fuel'], ['logistics', 'dashboard'], ['logistics', 'vehicles']]);
            toast.success('Abastecimento registado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao registar abastecimento'),
    }));
}

export function useDeleteFuelSupply() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteFuelSupply(id),
        onSuccess: () => {
            invalidate([['logistics', 'fuel'], ['logistics', 'dashboard'], ['logistics', 'vehicles']]);
            toast.success('Abastecimento eliminado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar registo'),
    }));
}

// ============================================================================
// INCIDENTS
// ============================================================================

export function useVehicleIncidents(params?: { vehicleId?: string; driverId?: string; type?: string; page?: number; limit?: number }) {
    return useQuery<{ data: VehicleIncident[]; pagination: PaginationInfo }>({
        queryKey: ['logistics', 'incidents', params],
        queryFn: () => logisticsAPI.getIncidents(params),
    });
}

export function useCreateIncident() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<VehicleIncident>) => logisticsAPI.createIncident(data),
        onSuccess: () => {
            invalidate([['logistics', 'incidents'], ['logistics', 'dashboard'], ['logistics', 'vehicles'], ['logistics', 'drivers']]);
            toast.success('Incidente reportado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao reportar incidente'),
    }));
}

export function useUpdateIncident() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<VehicleIncident> }) => logisticsAPI.updateIncident(id, data),
        onSuccess: () => {
            invalidate([['logistics', 'incidents']]);
            toast.success('Incidente actualizado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar incidente'),
    }));
}

export function useDeleteIncident() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => logisticsAPI.deleteIncident(id),
        onSuccess: () => {
            invalidate([['logistics', 'incidents'], ['logistics', 'dashboard'], ['logistics', 'vehicles'], ['logistics', 'drivers']]);
            toast.success('Incidente eliminado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar incidente'),
    }));
}

// ============================================================================
// STAFF HR (Ponto e Salários)
// ============================================================================

export function useStaffAttendance(params?: { staffId?: string; startDate?: string; endDate?: string }) {
    return useQuery<StaffAttendance[]>({
        queryKey: ['logistics', 'hr', 'attendance', params],
        queryFn: () => logisticsAPI.getStaffAttendance(params),
    });
}

export function useRecordStaffTime() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: { staffId: string; type: 'checkIn' | 'checkOut'; timestamp?: string; notes?: string }) =>
            logisticsAPI.recordStaffTime(data),
        onSuccess: (data) => {
            invalidate([['logistics', 'hr', 'attendance'], ['logistics', 'drivers']]);
            toast.success(data.status === 'present' ? 'Entrada registada' : 'Saída registada');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao registar ponto'),
    }));
}

export function useStaffPayroll(params?: { staffId?: string; month?: number; year?: number; status?: string }) {
    return useQuery<StaffPayroll[]>({
        queryKey: ['logistics', 'hr', 'payroll', params],
        queryFn: () => logisticsAPI.getStaffPayroll(params),
    });
}

export function useCreateStaffPayroll() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: { staffId: string; month: number; year: number }) =>
            logisticsAPI.createStaffPayroll(data),
        onSuccess: () => {
            invalidate([['logistics', 'hr', 'payroll']]);
            toast.success('Folha de salário gerada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao gerar folha'),
    }));
}

export function useUpdateStaffPayrollStatus() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'processed' | 'paid' }) =>
            logisticsAPI.updateStaffPayrollStatus(id, status),
        onSuccess: () => {
            invalidate([['logistics', 'hr', 'payroll']]);
            toast.success('Estado do salário actualizado');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar estado'),
    }));
}

// ============================================================================
// REPORTS SUMMARY
// ============================================================================

export function useLogisticsReportsSummary(params?: { startDate?: string; endDate?: string }) {
    return useQuery<LogisticsReportsSummary>({
        queryKey: ['logistics', 'reports', 'summary', params],
        queryFn: () => logisticsAPI.getReportsSummary(params),
    });
}

// ============================================================================
// STOCK TRANSFERS
// ============================================================================

import { warehousesAPI } from '../services/api/warehouses.api';

export function useTransfers(params?: { sourceWarehouseId?: string; targetWarehouseId?: string; status?: string }) {
    return useQuery<StockTransfer[]>({
        queryKey: ['logistics', 'transfers', params],
        queryFn: () => warehousesAPI.getTransfers(params),
    });
}

export function useCreateTransfer() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Parameters<typeof warehousesAPI.createTransfer>[0]) => warehousesAPI.createTransfer(data),
        onSuccess: () => {
            invalidate([['logistics', 'transfers'], ['logistics', 'dashboard']]);
            toast.success('Transferência registada com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao registar transferência'),
    }));
}
