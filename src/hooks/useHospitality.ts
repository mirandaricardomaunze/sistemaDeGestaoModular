import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { hospitalityAPI } from '../services/api';

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
    const [rooms, setRooms] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [metrics, setMetrics] = useState({
        available: 0,
        occupied: 0,
        dirty: 0,
        maintenance: 0,
        total: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await hospitalityAPI.getRooms(params);

            let roomsData: any[] = [];
            if (response.data && response.pagination) {
                roomsData = response.data;
                setPagination(response.pagination);
                if (response.metrics) {
                    setMetrics(response.metrics);
                }
            } else {
                roomsData = Array.isArray(response) ? response : (response.data || []);
            }

            setRooms(roomsData);
        } catch (err: unknown) {
            setError(err.message || 'Erro ao carregar quartos');
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.status,
        params?.type,
        params?.search,
        params?.page,
        params?.limit,
        params?.sortBy,
        params?.sortOrder
    ]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const fetchBookings = useCallback(async (bookingParams?: { page?: number; limit?: number; status?: string }) => {
        try {
            const response = await hospitalityAPI.getBookings(bookingParams);
            if (response.data && response.pagination) {
                setBookings(response.data);
                return response;
            }
            const bookingsData = Array.isArray(response) ? response : (response.data || []);
            setBookings(bookingsData);
            return { data: bookingsData };
        } catch (err) {
            console.error('Error fetching bookings:', err);
            throw err;
        }
    }, []);

    const seedRooms = async () => {
        try {
            await hospitalityAPI.seedRooms();
            await fetchRooms();
            toast.success('Quartos inicializados com sucesso!');
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao inicializar quartos');
        }
    };

    const createBooking = async (data: any) => {
        try {
            await hospitalityAPI.createBooking(data);
            await fetchRooms();
            toast.success('Check-in realizado com sucesso!');
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao realizar check-in');
            throw err;
        }
    };

    const checkout = async (bookingId: string) => {
        try {
            await hospitalityAPI.checkout(bookingId);
            await fetchRooms();
            toast.success('Check-out realizado com sucesso!');
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao realizar check-out');
            throw err;
        }
    };

    const addRoom = async (data: any) => {
        try {
            await hospitalityAPI.createRoom(data);
            await fetchRooms();
            toast.success('Quarto adicionado com sucesso!');
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao adicionar quarto');
            throw err;
        }
    };

    const updateRoom = async (id: string, data: any) => {
        try {
            await hospitalityAPI.updateRoom(id, data);
            await fetchRooms();
            toast.success('Quarto actualizado com sucesso!');
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao actualizar quarto');
            throw err;
        }
    };

    const deleteRoom = async (id: string) => {
        try {
            await hospitalityAPI.deleteRoom(id);
            await fetchRooms();
            toast.success('Quarto removido com sucesso!');
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao remover quarto');
            throw err;
        }
    };

    const addConsumption = async (bookingId: string, data: { productId: string; quantity: number }) => {
        try {
            await hospitalityAPI.addConsumption(bookingId, data);
            await fetchRooms();
            toast.success('Consumo registrado com sucesso!');
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao registrar consumo');
            throw err;
        }
    };

    return {
        rooms,
        bookings,
        pagination,
        metrics,
        isLoading,
        error,
        refetch: fetchRooms,
        fetchBookings,
        seedRooms,
        createBooking,
        checkout,
        addRoom,
        updateRoom,
        deleteRoom,
        addConsumption,
    };
}
