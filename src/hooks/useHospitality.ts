import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { hospitalityAPI } from '../services/api';
import type { Room } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseHospitalityParams {
    status?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export function useHospitality(params?: UseHospitalityParams) {
    const queryClient = useQueryClient();

    // ============================================================================
    // Queries
    // ============================================================================

    // Fetch rooms with pagination, metrics, etc.
    const { 
        data: roomsData, 
        isLoading, 
        error: queryError, 
        refetch 
    } = useQuery({
        queryKey: ['hospitality', 'rooms', params],
        queryFn: async () => {
            const response = await hospitalityAPI.getRooms(params);
            
            // Normalize shape
            let rooms: Room[] = [];
            let pagination: PaginationMeta | null = null;
            let metrics = { available: 0, occupied: 0, dirty: 0, maintenance: 0, total: 0 };
            
            if (response.data && response.pagination) {
                rooms = response.data;
                pagination = response.pagination;
                if (response.metrics) metrics = response.metrics;
            } else {
                rooms = Array.isArray(response) ? response : (response.data || []);
            }
            
            return { rooms, pagination, metrics };
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const error = queryError ? (queryError as any).message || 'Erro ao carregar quartos' : null;

    // We can also define fetchBookings directly (since it's typically called ad-hoc for a specific room or context)
    // Or wire it into useQuery if it was meant to be reactive.
    const fetchBookings = async (bookingParams?: { page?: number; limit?: number; status?: string }) => {
        try {
            const response = await hospitalityAPI.getBookings(bookingParams);
            return response.data && response.pagination 
                 ? response 
                 : { data: Array.isArray(response) ? response : (response.data || []) };
        } catch (err: any) {
            toast.error(err.message || 'Erro ao carregar reservas');
            throw err;
        }
    };

    // ============================================================================
    // Mutations
    // ============================================================================

    const handleMutationError = (err: any, fallbackMessage: string) => {
        toast.error(err?.response?.data?.message || err?.message || fallbackMessage);
        throw err;
    };

    const invalidateRooms = () => queryClient.invalidateQueries({ queryKey: ['hospitality', 'rooms'] });

    const seedRoomsMutation = useMutation({
        mutationFn: () => hospitalityAPI.seedRooms(),
        onSuccess: () => {
            toast.success('Quartos inicializados com sucesso!');
            invalidateRooms();
        },
        onError: (err) => handleMutationError(err, 'Erro ao inicializar quartos')
    });

    const createBookingMutation = useMutation({
        mutationFn: (data: any) => hospitalityAPI.createBooking(data),
        onSuccess: () => {
            toast.success('Check-in realizado com sucesso!');
            invalidateRooms();
        },
        onError: (err) => handleMutationError(err, 'Erro ao realizar check-in')
    });

    const checkoutMutation = useMutation({
        mutationFn: (bookingId: string) => hospitalityAPI.checkout(bookingId),
        onSuccess: () => {
            toast.success('Check-out realizado com sucesso!');
            invalidateRooms();
        },
        onError: (err) => handleMutationError(err, 'Erro ao realizar check-out')
    });

    const addRoomMutation = useMutation({
        mutationFn: (data: any) => hospitalityAPI.createRoom(data),
        onSuccess: () => {
            toast.success('Quarto adicionado com sucesso!');
            invalidateRooms();
        },
        onError: (err) => handleMutationError(err, 'Erro ao adicionar quarto')
    });

    const updateRoomMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => hospitalityAPI.updateRoom(id, data),
        onSuccess: () => {
            toast.success('Quarto actualizado com sucesso!');
            invalidateRooms();
        },
        onError: (err) => handleMutationError(err, 'Erro ao actualizar quarto')
    });

    const deleteRoomMutation = useMutation({
        mutationFn: (id: string) => hospitalityAPI.deleteRoom(id),
        onSuccess: () => {
            toast.success('Quarto removido com sucesso!');
            invalidateRooms();
        },
        onError: (err) => handleMutationError(err, 'Erro ao remover quarto')
    });

    const addConsumptionMutation = useMutation({
        mutationFn: ({ bookingId, data }: { bookingId: string, data: any }) => hospitalityAPI.addConsumption(bookingId, data),
        onSuccess: () => {
            toast.success('Consumo registrado com sucesso!');
            invalidateRooms();
        },
        onError: (err) => handleMutationError(err, 'Erro ao registrar consumo')
    });

    return {
        rooms: roomsData?.rooms || [],
        pagination: roomsData?.pagination || null,
        metrics: roomsData?.metrics || { available: 0, occupied: 0, dirty: 0, maintenance: 0, total: 0 },
        isLoading,
        error,
        refetch,
        
        // Functions matching exactly the previous signature
        fetchBookings,
        seedRooms: seedRoomsMutation.mutateAsync,
        createBooking: createBookingMutation.mutateAsync,
        checkout: checkoutMutation.mutateAsync,
        addRoom: addRoomMutation.mutateAsync,
        updateRoom: (id: string, data: any) => updateRoomMutation.mutateAsync({ id, data }),
        deleteRoom: deleteRoomMutation.mutateAsync,
        addConsumption: (bookingId: string, data: any) => addConsumptionMutation.mutateAsync({ bookingId, data }),
    };
}
