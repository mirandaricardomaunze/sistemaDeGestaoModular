import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { hospitalityAPI } from '../services/api/hospitality.api';
import type {
    HotelRoom,
    HotelBooking,
    HotelDashboard,
    HousekeepingTask,
} from '../types/hotel';

type ApiError = Error & { response?: { data?: { message?: string; error?: string } } };

interface RoomsParams { status?: string; type?: string; search?: string }
interface BookingsParams { page?: number; limit?: number; status?: string; search?: string }
interface HousekeepingParams { status?: string; date?: string }

// ============================================================================
// HELPERS
// ============================================================================

function withIsLoading<T extends object & { isPending: boolean }>(m: T) {
    return Object.assign(m, { isLoading: m.isPending });
}

// ============================================================================
// QUERIES
// ============================================================================

export function useHotelRooms(params?: RoomsParams) {
    return useQuery<HotelRoom[]>({
        queryKey: ['hospitality', 'rooms', params],
        queryFn: () => hospitalityAPI.getRooms(params),
    });
}

export function useHotelDashboardSummary() {
    return useQuery<HotelDashboard>({
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

export function useHotelBookings(params?: BookingsParams) {
    return useQuery<{ data: HotelBooking[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>({
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
        mutationFn: (data: Partial<HotelBooking>) => hospitalityAPI.createBooking(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hospitality'] });
            toast.success('Check-in realizado com sucesso!');
        },
        onError: (err: ApiError) => toast.error(err.message || 'Erro ao realizar check-in'),
    }));
}

export function useCheckout() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data?: Partial<HotelBooking> }) => hospitalityAPI.checkout(id, data),
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

export function useHousekeepingTasks(params?: HousekeepingParams) {
    return useQuery<HousekeepingTask[]>({
        queryKey: ['hospitality', 'housekeeping', params],
        queryFn: () => hospitalityAPI.getHousekeepingTasks(params),
    });
}

export function useUpdateHousekeepingTask() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: { status?: string; assignedTo?: string; notes?: string; priority?: number } }) => hospitalityAPI.updateHousekeepingTask(id, data),
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
        mutationFn: (data: Partial<HotelRoom>) => hospitalityAPI.createRoom(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitality', 'rooms'] }),
    });

    const updateRoomMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<HotelRoom> }) => hospitalityAPI.updateRoom(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitality', 'rooms'] }),
    });

    const deleteRoomMutation = useMutation({
        mutationFn: (id: string) => hospitalityAPI.deleteRoom(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitality', 'rooms'] }),
    });

    const rawData = roomsQuery.data;
    const rooms: HotelRoom[] = Array.isArray(rawData) ? rawData : ((rawData as { data?: HotelRoom[] } | undefined)?.data || []);
    const pagination = (rawData as { pagination?: { total: number; page: number; pageSize?: number } } | undefined)?.pagination
        || { total: rooms.length, page: 1, pageSize: rooms.length };

    const metrics = useMemo(() => ({
        available: rooms.filter((r) => r.status === 'available').length,
        occupied: rooms.filter((r) => r.status === 'occupied').length,
        dirty: rooms.filter((r) => r.status === 'dirty').length,
        maintenance: rooms.filter((r) => r.status === 'maintenance').length,
    }), [rooms]);

    const handleAddRoom = useCallback((data: Partial<HotelRoom>) => addRoomMutation.mutateAsync(data), [addRoomMutation]);
    const handleUpdateRoom = useCallback((id: string, data: Partial<HotelRoom>) => updateRoomMutation.mutateAsync({ id, data }), [updateRoomMutation]);
    const handleDeleteRoom = useCallback((id: string) => deleteRoomMutation.mutateAsync(id), [deleteRoomMutation]);
    const fetchBookings = useCallback((params?: BookingsParams) => hospitalityAPI.getBookings(params), []);
    const handleCreateBooking = useCallback((_data: Partial<HotelBooking>) => hospitalityAPI.createBooking(_data), []);
    const handleAddConsumption = useCallback((_id: string, _data: { productId: string; quantity: number }) => hospitalityAPI.addConsumption(_id, _data), []);

    return {
        rooms,
        isLoading: roomsQuery.isLoading,
        refetch: roomsQuery.refetch,
        addRoom: handleAddRoom,
        updateRoom: handleUpdateRoom,
        deleteRoom: handleDeleteRoom,
        pagination,
        metrics,
        fetchBookings,
        createBooking: handleCreateBooking,
        addConsumption: handleAddConsumption,
    };
}
