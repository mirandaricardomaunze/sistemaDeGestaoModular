import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantAPI } from '../services/api/restaurant.api';
import type { 
    RestaurantTable, 
    RestaurantMenuItem, 
    RestaurantOrder, 
    RestaurantReservation,
    RestaurantDashboard,
    OrderStatus,
    ReservationStatus
} from '../types/restaurant';
import toast from 'react-hot-toast';

// ============================================================================
// HELPERS
// ============================================================================

function withIsLoading<T extends object & { isPending: boolean }>(m: T) {
    return Object.assign(m, { isLoading: m.isPending });
}

// ============================================================================
// DASHBOARD
// ============================================================================

export function useRestaurantDashboard(range: string = '1M') {
    return useQuery<RestaurantDashboard>({
        queryKey: ['restaurant', 'dashboard', range],
        queryFn: () => restaurantAPI.getDashboard(range),
    });
}

// ============================================================================
// TABLES
// ============================================================================

export function useRestaurantTables(params?: { status?: string; section?: string; page?: number; limit?: number }) {
    return useQuery({
        queryKey: ['restaurant', 'tables', params],
        queryFn: () => restaurantAPI.getTables(params),
    });
}

export function useRestaurantTable(id: string) {
    return useQuery<RestaurantTable>({
        queryKey: ['restaurant', 'table', id],
        queryFn: () => restaurantAPI.getTableById(id),
        enabled: !!id,
    });
}

export function useCreateRestaurantTable() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: { number: number; name?: string; capacity?: number; section?: string; notes?: string }) =>
            restaurantAPI.createTable(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
            toast.success('Mesa criada com sucesso');
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao criar mesa'),
    }));
}

export function useUpdateTableStatus() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            restaurantAPI.updateTableStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
            qc.invalidateQueries({ queryKey: ['restaurant', 'table'] });
        },
    }));
}

// ============================================================================
// MENU ITEMS
// ============================================================================

export function useMenuItems(params?: any) {
    return useQuery({
        queryKey: ['restaurant', 'menu', params],
        queryFn: () => restaurantAPI.getMenuItems(params),
    });
}

// ============================================================================
// KITCHEN / ORDERS
// ============================================================================

export function useKitchenOrders(status?: OrderStatus) {
    return useQuery<RestaurantOrder[]>({
        queryKey: ['restaurant', 'orders', 'kitchen', status],
        queryFn: () => restaurantAPI.getKitchenOrders({ status }),
        refetchInterval: 30000, // Auto-refresh kitchen every 30s
    });
}

export function useUpdateOrderStatus() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, status, notes }: { id: string; status: OrderStatus; notes?: string }) =>
            restaurantAPI.updateOrderStatus(id, status, notes),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'orders'] });
            toast.success('Estado do pedido atualizado');
        },
    }));
}

// ============================================================================
// RESERVATIONS
// ============================================================================

export function useRestaurantReservations(params?: any) {
    return useQuery({
        queryKey: ['restaurant', 'reservations', params],
        queryFn: () => restaurantAPI.getReservations(params),
    });
}

export function useCreateReservation() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: any) => restaurantAPI.createReservation(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] });
            toast.success('Reserva registrada com sucesso');
        },
    }));
}

export function useUpdateReservation() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<RestaurantReservation> }) =>
            restaurantAPI.updateReservation(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] });
            toast.success('Reserva atualizada com sucesso');
        },
    }));
}

export function useDeleteReservation() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => restaurantAPI.deleteReservation(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] });
            toast.success('Reserva eliminada');
        },
    }));
}

export function useUpdateReservationStatus() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
            restaurantAPI.updateReservationStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'reservations'] });
        },
    }));
}

// ============================================================================
// MENU HOOKS
// ============================================================================

export function useRestaurantMenu(params?: any) {
    return useQuery({
        queryKey: ['restaurant', 'menu', params],
        queryFn: () => restaurantAPI.getMenuItems(params),
    });
}

export function useCreateMenuItem() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: Omit<RestaurantMenuItem, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) =>
            restaurantAPI.createMenuItem(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'menu'] });
            toast.success('Item criado com sucesso');
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao criar item'),
    }));
}

export function useUpdateMenuItem() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<RestaurantMenuItem> }) =>
            restaurantAPI.updateMenuItem(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'menu'] });
            toast.success('Item atualizado');
        },
    }));
}

export function useDeleteMenuItem() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => restaurantAPI.deleteMenuItem(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'menu'] });
            toast.success('Item eliminado');
        },
    }));
}

export function useToggleMenuItemAvailability() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
            restaurantAPI.toggleMenuItemAvailability(id, isAvailable),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'menu'] });
        },
    }));
}

// ============================================================================
// REPORTS
// ============================================================================

export function useRestaurantReports(params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) {
    return useQuery({
        queryKey: ['restaurant', 'reports', params],
        queryFn: () => restaurantAPI.getReports(params || {}),
    });
}

// ============================================================================
// TABLE MUTATION HOOKS
// ============================================================================

export function useUpdateRestaurantTable() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<RestaurantTable> }) =>
            restaurantAPI.updateTable(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
            toast.success('Mesa atualizada');
        },
    }));
}

export function useDeleteRestaurantTable() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => restaurantAPI.deleteTable(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
            toast.success('Mesa eliminada');
        },
    }));
}
