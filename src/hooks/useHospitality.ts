import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { hospitalityAPI } from '../services/api/hospitality.api';
import type {
    HotelBooking,
    HousekeepingTask,
} from '../types/hotel';

// ============================================================================
// HELPERS
// ============================================================================

function withIsLoading<T extends object & { isPending: boolean }>(m: T) {
    return Object.assign(m, { isLoading: m.isPending });
}

// ============================================================================
// QUERIES
// ============================================================================

export function useHotelRooms(params?: any) {
    return useQuery({
        queryKey: ['hospitality', 'rooms', params],
        queryFn: () => hospitalityAPI.getRooms(params),
    });
}

export function useHotelDashboardSummary() {
    return useQuery<any>({
        queryKey: ['hospitality', 'dashboard', 'summary'],
        queryFn: () => hospitalityAPI.getDashboardSummary(),
    });
}

export function useRecentBookings(limit: number = 5) {
    return useQuery<HotelBooking[]>({
        queryKey: ['hospitality', 'bookings', 'recent', limit],
        queryFn: () => hospitalityAPI.getRecentBookings(limit),
    });
}

export function useHotelBookings(params?: any) {
    return useQuery({
        queryKey: ['hospitality', 'bookings', params],
        queryFn: () => hospitalityAPI.getBookings(params),
    });
}

export function useTodayCheckouts() {
    return useQuery<HotelBooking[]>({
        queryKey: ['hospitality', 'bookings', 'today-checkouts'],
        queryFn: () => hospitalityAPI.getTodayCheckouts(),
    });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useCreateBooking() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: any) => hospitalityAPI.createBooking(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hospitality'] });
            toast.success('Check-in realizado com sucesso!');
        },
        onError: (err: any) => toast.error(err.message || 'Erro ao realizar check-in'),
    }));
}

export function useCheckout() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data?: any }) => hospitalityAPI.checkout(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hospitality'] });
            toast.success('Check-out realizado com sucesso!');
        },
    }));
}

export function useUpdateRoomStatus() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => hospitalityAPI.updateRoom(id, { status }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hospitality', 'rooms'] });
        },
    }));
}

// ============================================================================
// HOUSEKEEPING
// ============================================================================

export function useHousekeepingTasks(params?: any) {
    return useQuery<HousekeepingTask[]>({
        queryKey: ['hospitality', 'housekeeping', params],
        queryFn: () => hospitalityAPI.getHousekeepingTasks(params),
    });
}

export function useUpdateHousekeepingTask() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => hospitalityAPI.updateHousekeepingTask(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hospitality', 'housekeeping'] });
            toast.success('Tarefa de limpeza atualizada');
        },
    }));
}

// ============================================================================
// COMPOSITE HOOK (backward compat)
// ============================================================================

export function useHospitality(_params?: { search?: string; status?: string; page?: number; limit?: number }) {
    const qc = useQueryClient();
    const roomsQuery = useQuery({
        queryKey: ['hospitality', 'rooms'],
        queryFn: () => hospitalityAPI.getRooms(),
    });

    const addRoomMutation = useMutation({
        mutationFn: (data: any) => hospitalityAPI.createRoom(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitality', 'rooms'] }),
    });

    const updateRoomMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => hospitalityAPI.updateRoom(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitality', 'rooms'] }),
    });

    const deleteRoomMutation = useMutation({
        mutationFn: (id: string) => hospitalityAPI.deleteRoom(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitality', 'rooms'] }),
    });

    return {
        rooms: (roomsQuery.data as any[]) || [],
        isLoading: roomsQuery.isLoading,
        refetch: roomsQuery.refetch,
        addRoom: (data: any) => addRoomMutation.mutateAsync(data),
        updateRoom: (id: string, data: any) => updateRoomMutation.mutateAsync({ id, data }),
        deleteRoom: (id: string) => deleteRoomMutation.mutateAsync(id),
        pagination: { total: 0, page: 1, pageSize: 20 },
        metrics: null as any,
        fetchBookings: (params?: { page?: number; limit?: number; status?: string }) => hospitalityAPI.getBookings(params),
        createBooking: (_data: any) => hospitalityAPI.createBooking(_data),
        addConsumption: (_id: string, _data?: any) => hospitalityAPI.addConsumption(_id, _data),
    };
}
