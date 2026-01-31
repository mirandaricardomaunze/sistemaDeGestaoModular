/**
 * Logistics Module Hooks 
 * Re-implemented without dependency on @tanstack/react-query to match project architecture.
 */

import { useState, useEffect, useCallback } from 'react';
import { logisticsAPI } from '../services/api/logistics.api';
import type { Vehicle, Driver, DeliveryRoute, Delivery, Parcel, VehicleMaintenance, LogisticsDashboard, PaginationInfo } from '../services/api/logistics.api';
import toast from 'react-hot-toast';

// ============================================================================
// HELPERS
// ============================================================================

// Simple event bus for cache invalidation
const cacheEvents = new EventTarget();
export const invalidateQueries = (keys: string[]) => {
    keys.forEach(key => {
        cacheEvents.dispatchEvent(new CustomEvent('invalidate', { detail: key }));
    });
};

function useQueryManual<T>(queryFn: () => Promise<T>, queryKey: string[], deps: any[] = [], enabled: boolean = true) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const [error, setError] = useState<any>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await queryFn();
            setData(result);
        } catch (err: unknown) {
            setError(err);
            console.error('Query error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [queryFn]);

    useEffect(() => {
        if (enabled) {
            fetchData();
        }
    }, [enabled, ...deps]);

    // Handle invalidation
    useEffect(() => {
        const handleInvalidate = (e: any) => {
            const invalidatedKey = e.detail;
            if (queryKey.includes(invalidatedKey)) {
                fetchData();
            }
        };
        cacheEvents.addEventListener('invalidate', handleInvalidate);
        return () => cacheEvents.removeEventListener('invalidate', handleInvalidate);
    }, [queryKey, fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

function useMutationManual<T, V>(
    mutationFn: (variables: V) => Promise<T>,
    options?: { onSuccess?: (data: T) => void; onError?: (err: any) => void; invalidateKeys?: string[] }
) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<any>(null);

    const mutate = async (variables: V) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await mutationFn(variables);
            if (options?.invalidateKeys) {
                invalidateQueries(options.invalidateKeys);
            }
            options?.onSuccess?.(result);
            return result;
        } catch (err: unknown) {
            setError(err);
            options?.onError?.(err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { mutate, mutateAsync: mutate, isLoading, error };
}

// ============================================================================
// DASHBOARD
// ============================================================================

export function useLogisticsDashboard() {
    return useQueryManual<LogisticsDashboard>(() => logisticsAPI.getDashboard(), ['logistics', 'dashboard']);
}

// ============================================================================
// VEHICLES
// ============================================================================

export function useVehicles(params?: { status?: string; type?: string; search?: string; page?: number; limit?: number }) {
    return useQueryManual<{ data: Vehicle[]; pagination: PaginationInfo }>(
        () => logisticsAPI.getVehicles(params),
        ['logistics', 'vehicles'],
        [params?.status, params?.type, params?.search, params?.page, params?.limit]
    );
}

export function useVehicle(id: string) {
    return useQueryManual<Vehicle>(() => logisticsAPI.getVehicle(id), ['logistics', 'vehicle', id], [id], !!id);
}

export function useCreateVehicle() {
    return useMutationManual(
        (data: Partial<Vehicle>) => logisticsAPI.createVehicle(data),
        {
            invalidateKeys: ['logistics', 'vehicles', 'dashboard'],
            onSuccess: () => toast.success('Veículo criado com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar veículo')
        }
    );
}

export function useUpdateVehicle() {
    return useMutationManual(
        ({ id, data }: { id: string; data: Partial<Vehicle> }) => logisticsAPI.updateVehicle(id, data),
        {
            invalidateKeys: ['logistics', 'vehicles'],
            onSuccess: () => toast.success('Veículo actualizado com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar veículo')
        }
    );
}

export function useDeleteVehicle() {
    return useMutationManual(
        (id: string) => logisticsAPI.deleteVehicle(id),
        {
            invalidateKeys: ['logistics', 'vehicles', 'dashboard'],
            onSuccess: () => toast.success('Veículo eliminado com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar veículo')
        }
    );
}

// ============================================================================
// DRIVERS
// ============================================================================

export function useDrivers(params?: { status?: string; search?: string; page?: number; limit?: number }) {
    return useQueryManual<{ data: Driver[]; pagination: PaginationInfo }>(
        () => logisticsAPI.getDrivers(params),
        ['logistics', 'drivers'],
        [params?.status, params?.search, params?.page, params?.limit]
    );
}

export function useDriver(id: string) {
    return useQueryManual<Driver>(() => logisticsAPI.getDriver(id), ['logistics', 'driver', id], [id], !!id);
}

export function useCreateDriver() {
    return useMutationManual(
        (data: Partial<Driver>) => logisticsAPI.createDriver(data),
        {
            invalidateKeys: ['logistics', 'drivers', 'dashboard'],
            onSuccess: () => toast.success('Motorista criado com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar motorista')
        }
    );
}

export function useUpdateDriver() {
    return useMutationManual(
        ({ id, data }: { id: string; data: Partial<Driver> }) => logisticsAPI.updateDriver(id, data),
        {
            invalidateKeys: ['logistics', 'drivers'],
            onSuccess: () => toast.success('Motorista actualizado com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar motorista')
        }
    );
}

export function useDeleteDriver() {
    return useMutationManual(
        (id: string) => logisticsAPI.deleteDriver(id),
        {
            invalidateKeys: ['logistics', 'drivers', 'dashboard'],
            onSuccess: () => toast.success('Motorista eliminado com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar motorista')
        }
    );
}

// ============================================================================
// ROUTES
// ============================================================================

export function useDeliveryRoutes(params?: { active?: boolean; search?: string; page?: number; limit?: number }) {
    return useQueryManual<{ data: DeliveryRoute[]; pagination: PaginationInfo }>(
        () => logisticsAPI.getRoutes(params),
        ['logistics', 'routes'],
        [params?.active, params?.search, params?.page, params?.limit]
    );
}

export function useDeliveryRoute(id: string) {
    return useQueryManual<DeliveryRoute>(() => logisticsAPI.getRoute(id), ['logistics', 'route', id], [id], !!id);
}

export function useCreateRoute() {
    return useMutationManual(
        (data: Partial<DeliveryRoute>) => logisticsAPI.createRoute(data),
        {
            invalidateKeys: ['logistics', 'routes', 'dashboard'],
            onSuccess: () => toast.success('Rota criada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar rota')
        }
    );
}

export function useUpdateRoute() {
    return useMutationManual(
        ({ id, data }: { id: string; data: Partial<DeliveryRoute> }) => logisticsAPI.updateRoute(id, data),
        {
            invalidateKeys: ['logistics', 'routes'],
            onSuccess: () => toast.success('Rota actualizada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar rota')
        }
    );
}

export function useDeleteRoute() {
    return useMutationManual(
        (id: string) => logisticsAPI.deleteRoute(id),
        {
            invalidateKeys: ['logistics', 'routes', 'dashboard'],
            onSuccess: () => toast.success('Rota eliminada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar rota')
        }
    );
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
    return useQueryManual(
        () => logisticsAPI.getDeliveries(params),
        ['logistics', 'deliveries'],
        [
            params?.status, params?.priority, params?.driverId, params?.vehicleId,
            params?.search, params?.startDate, params?.endDate, params?.page, params?.limit
        ]
    );
}

export function useDelivery(id: string) {
    return useQueryManual<Delivery>(() => logisticsAPI.getDelivery(id), ['logistics', 'delivery', id], [id], !!id);
}

export function useCreateDelivery() {
    return useMutationManual(
        (data: Partial<Delivery> & { items?: Array<{ productId?: string; description: string; quantity: number; weight?: number }> }) =>
            logisticsAPI.createDelivery(data),
        {
            invalidateKeys: ['logistics', 'deliveries', 'dashboard'],
            onSuccess: () => toast.success('Entrega criada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar entrega')
        }
    );
}

export function useUpdateDelivery() {
    return useMutationManual(
        ({ id, data }: { id: string; data: Partial<Delivery> }) => logisticsAPI.updateDelivery(id, data),
        {
            invalidateKeys: ['logistics', 'deliveries'],
            onSuccess: () => toast.success('Entrega actualizada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar entrega')
        }
    );
}

export function useUpdateDeliveryStatus() {
    return useMutationManual(
        ({ id, ...data }: { id: string; status: string; failureReason?: string; recipientSign?: string; proofOfDelivery?: string }) =>
            logisticsAPI.updateDeliveryStatus(id, data),
        {
            invalidateKeys: ['logistics', 'deliveries', 'dashboard', 'drivers', 'vehicles'],
            onSuccess: () => toast.success('Estado da entrega actualizado'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar estado')
        }
    );
}

export function usePayDelivery() {
    return useMutationManual(
        ({ id, ...data }: { id: string; paymentMethod: string; amount?: number }) =>
            logisticsAPI.payDelivery(id, data),
        {
            invalidateKeys: ['logistics', 'deliveries', 'dashboard'],
            onSuccess: () => toast.success('Pagamento de entrega registado'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao processar pagamento')
        }
    );
}

export function useDeleteDelivery() {
    return useMutationManual(
        (id: string) => logisticsAPI.deleteDelivery(id),
        {
            invalidateKeys: ['logistics', 'deliveries', 'dashboard'],
            onSuccess: () => toast.success('Entrega eliminada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar entrega')
        }
    );
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
    return useQueryManual(
        () => logisticsAPI.getParcels(params),
        ['logistics', 'parcels'],
        [
            params?.status, params?.warehouseId, params?.search, params?.page, params?.limit
        ]
    );
}

export function useParcel(id: string) {
    return useQueryManual<Parcel>(() => logisticsAPI.getParcel(id), ['logistics', 'parcel', id], [id], !!id);
}

export function useTrackParcel(trackingNumber: string) {
    return useQueryManual<Parcel>(
        () => logisticsAPI.trackParcel(trackingNumber),
        ['logistics', 'parcel_track', trackingNumber],
        [trackingNumber],
        !!trackingNumber && trackingNumber.length >= 6
    );
}

export function useCreateParcel() {
    return useMutationManual(
        (data: Partial<Parcel>) => logisticsAPI.createParcel(data),
        {
            invalidateKeys: ['logistics', 'parcels', 'dashboard'],
            onSuccess: () => toast.success('Encomenda registada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar encomenda')
        }
    );
}

export function useUpdateParcel() {
    return useMutationManual(
        ({ id, data }: { id: string; data: Partial<Parcel> }) => logisticsAPI.updateParcel(id, data),
        {
            invalidateKeys: ['logistics', 'parcels'],
            onSuccess: () => toast.success('Encomenda actualizada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar encomenda')
        }
    );
}

export function useRegisterParcelPickup() {
    return useMutationManual(
        ({ id, ...data }: { id: string; pickedUpBy: string; pickedUpDocument?: string; receiverRelationship?: string; pickupSignature?: string; paymentMethod?: string; isPaid?: boolean; paidAmount?: number }) =>
            logisticsAPI.registerParcelPickup(id, data),
        {
            invalidateKeys: ['logistics', 'parcels', 'dashboard'],
            onSuccess: () => toast.success('Levantamento registado com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao registar levantamento')
        }
    );
}

export function useSendParcelNotification() {
    return useMutationManual(
        ({ id, ...data }: { id: string; type?: string; recipient?: string; message: string }) =>
            logisticsAPI.sendParcelNotification(id, data),
        {
            invalidateKeys: ['logistics', 'parcels'],
            onSuccess: () => toast.success('Notificação enviada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao enviar notificação')
        }
    );
}

export function useDeleteParcel() {
    return useMutationManual(
        (id: string) => logisticsAPI.deleteParcel(id),
        {
            invalidateKeys: ['logistics', 'parcels', 'dashboard'],
            onSuccess: () => toast.success('Encomenda eliminada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar encomenda')
        }
    );
}

// ============================================================================
// VEHICLE MAINTENANCE
// ============================================================================

export function useVehicleMaintenances(params?: { vehicleId?: string; status?: string; page?: number; limit?: number }) {
    return useQueryManual<{ data: VehicleMaintenance[]; pagination: PaginationInfo }>(
        () => logisticsAPI.getMaintenances(params),
        ['logistics', 'maintenances'],
        [params?.vehicleId, params?.status, params?.page, params?.limit]
    );
}

export function useCreateMaintenance() {
    return useMutationManual(
        (data: Partial<VehicleMaintenance>) => logisticsAPI.createMaintenance(data),
        {
            invalidateKeys: ['logistics', 'maintenances', 'vehicles'],
            onSuccess: () => toast.success('Manutenção registada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar manutenção')
        }
    );
}

export function useUpdateMaintenance() {
    return useMutationManual(
        ({ id, data }: { id: string; data: Partial<VehicleMaintenance> }) => logisticsAPI.updateMaintenance(id, data),
        {
            invalidateKeys: ['logistics', 'maintenances', 'vehicles'],
            onSuccess: () => toast.success('Manutenção actualizada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar manutenção')
        }
    );
}

export function useDeleteMaintenance() {
    return useMutationManual(
        (id: string) => logisticsAPI.deleteMaintenance(id),
        {
            invalidateKeys: ['logistics', 'maintenances', 'vehicles'],
            onSuccess: () => toast.success('Manutenção eliminada com sucesso'),
            onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao eliminar manutenção')
        }
    );
}
