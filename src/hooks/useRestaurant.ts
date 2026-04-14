import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { restaurantAPI, type RestaurantTable } from '../services/api';

// ============================================================================
// MINI QUERY / MUTATION PRIMITIVES (same pattern as useLogistics.ts)
// ============================================================================

const cacheEvents = new EventTarget();
const invalidate = (keys: string[]) =>
    keys.forEach(k => cacheEvents.dispatchEvent(new CustomEvent('invalidate', { detail: k })));

function useQuery<T>(queryFn: () => Promise<T>, key: string, deps: any[] = [], enabled = true) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const [error, setError] = useState<any>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await queryFn());
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }, [key, ...deps]);

    useEffect(() => { if (enabled) fetch(); }, [enabled, key, ...deps]);

    useEffect(() => {
        const handler = (e: any) => { if (e.detail === key) fetch(); };
        cacheEvents.addEventListener('invalidate', handler);
        return () => cacheEvents.removeEventListener('invalidate', handler);
    }, [key, fetch]);

    return { data, isLoading, error, refetch: fetch };
}

function useMutation<T, V>(
    fn: (v: V) => Promise<T>,
    opts?: { onSuccess?: (d: T) => void; onError?: (e: any) => void; invalidates?: string[] }
) {
    const [isLoading, setIsLoading] = useState(false);

    const mutate = async (variables: V) => {
        setIsLoading(true);
        try {
            const result = await fn(variables);
            if (opts?.invalidates) invalidate(opts.invalidates);
            opts?.onSuccess?.(result);
            return result;
        } catch (e) {
            opts?.onError?.(e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    };

    return { mutate, mutateAsync: mutate, isLoading };
}

// ============================================================================
// DASHBOARD
// ============================================================================

export function useRestaurantDashboard(range: string = '1M') {
    return useQuery(() => restaurantAPI.getDashboard(range), 'restaurant-dashboard', [range]);
}

// ============================================================================
// TABLES
// ============================================================================

export function useRestaurantTables(params?: { status?: string; section?: string; page?: number; limit?: number }) {
    return useQuery(
        () => restaurantAPI.getTables(params),
        'restaurant-tables',
        [params?.status, params?.section, params?.page]
    );
}

export function useRestaurantTable(id: string) {
    return useQuery(() => restaurantAPI.getTableById(id), 'restaurant-table', [id], !!id);
}

export function useCreateRestaurantTable() {
    return useMutation(
        (data: { number: number; name?: string; capacity?: number; section?: string; notes?: string }) =>
            restaurantAPI.createTable(data),
        {
            invalidates: ['restaurant-tables', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Mesa criada com sucesso'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao criar mesa'),
        }
    );
}

export function useUpdateRestaurantTable() {
    return useMutation(
        ({ id, data }: { id: string; data: Partial<RestaurantTable> }) =>
            restaurantAPI.updateTable(id, data),
        {
            invalidates: ['restaurant-tables'],
            onSuccess: () => toast.success('Mesa actualizada'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao actualizar mesa'),
        }
    );
}

export function useUpdateTableStatus() {
    return useMutation(
        ({ id, status }: { id: string; status: string }) =>
            restaurantAPI.updateTableStatus(id, status),
        {
            invalidates: ['restaurant-tables', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Estado da mesa actualizado'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao actualizar estado'),
        }
    );
}

export function useDeleteRestaurantTable() {
    return useMutation(
        (id: string) => restaurantAPI.deleteTable(id),
        {
            invalidates: ['restaurant-tables', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Mesa eliminada'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao eliminar mesa'),
        }
    );
}

// ============================================================================
// REPORTS
// ============================================================================

export function useRestaurantReports(params: { startDate?: string; endDate?: string; page?: number; limit?: number }) {
    return useQuery(
        () => restaurantAPI.getReports(params),
        'restaurant-reports',
        [params.startDate, params.endDate, params.page]
    );
}

// ============================================================================
// MENU ITEMS
// ============================================================================

export function useRestaurantMenu(params?: { category?: string; isAvailable?: boolean; search?: string; page?: number; limit?: number }) {
    return useQuery(
        () => restaurantAPI.getMenuItems(params),
        'restaurant-menu',
        [params?.category, params?.isAvailable, params?.search, params?.page]
    );
}

export function useCreateMenuItem() {
    return useMutation(
        (data: any) => restaurantAPI.createMenuItem(data),
        {
            invalidates: ['restaurant-menu', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Item criado com sucesso'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao criar item'),
        }
    );
}

export function useUpdateMenuItem() {
    return useMutation(
        ({ id, data }: { id: string; data: any }) => restaurantAPI.updateMenuItem(id, data),
        {
            invalidates: ['restaurant-menu'],
            onSuccess: () => toast.success('Item actualizado'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao actualizar item'),
        }
    );
}

export function useDeleteMenuItem() {
    return useMutation(
        (id: string) => restaurantAPI.deleteMenuItem(id),
        {
            invalidates: ['restaurant-menu', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Item removido'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao remover item'),
        }
    );
}

export function useToggleMenuItemAvailability() {
    return useMutation(
        ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
            restaurantAPI.toggleMenuItemAvailability(id, isAvailable),
        {
            invalidates: ['restaurant-menu'],
            onSuccess: () => toast.success('Disponibilidade actualizada'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao actualizar disponibilidade'),
        }
    );
}

// ============================================================================
// KITCHEN ORDERS
// ============================================================================

export function useKitchenOrders(params?: { status?: any; limit?: number }) {
    const query = useQuery(
        () => restaurantAPI.getKitchenOrders(params),
        'kitchen-orders',
        [params?.status]
    );

    // Auto-refresh for kitchen every 30s
    useEffect(() => {
        const interval = setInterval(() => query.refetch(), 30000);
        return () => clearInterval(interval);
    }, [query.refetch]);

    return query;
}

export function useUpdateOrderStatus() {
    return useMutation(
        ({ id, status, notes }: { id: string; status: any; notes?: string }) =>
            restaurantAPI.updateOrderStatus(id, status, notes),
        {
            invalidates: ['kitchen-orders', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Estado do pedido actualizado'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao actualizar pedido'),
        }
    );
}

// ============================================================================
// RESERVATIONS
// ============================================================================

export function useRestaurantReservations(params?: { date?: string; status?: any; search?: string; page?: number; limit?: number }) {
    return useQuery(
        () => restaurantAPI.getReservations(params),
        'restaurant-reservations',
        [params?.date, params?.status, params?.search, params?.page]
    );
}

export function useCreateReservation() {
    return useMutation(
        (data: any) => restaurantAPI.createReservation(data),
        {
            invalidates: ['restaurant-reservations', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Reserva criada com sucesso'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao criar reserva'),
        }
    );
}

export function useUpdateReservation() {
    return useMutation(
        ({ id, data }: { id: string; data: any }) => restaurantAPI.updateReservation(id, data),
        {
            invalidates: ['restaurant-reservations'],
            onSuccess: () => toast.success('Reserva actualizada'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao actualizar reserva'),
        }
    );
}

export function useDeleteReservation() {
    return useMutation(
        (id: string) => restaurantAPI.deleteReservation(id),
        {
            invalidates: ['restaurant-reservations', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Reserva removida'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao remover reserva'),
        }
    );
}

export function useUpdateReservationStatus() {
    return useMutation(
        ({ id, status }: { id: string; status: any }) =>
            restaurantAPI.updateReservationStatus(id, status),
        {
            invalidates: ['restaurant-reservations', 'restaurant-dashboard'],
            onSuccess: () => toast.success('Estado da reserva actualizado'),
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao actualizar estado'),
        }
    );
}
