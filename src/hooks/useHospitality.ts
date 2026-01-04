import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { hospitalityAPI } from '../services/api';

export function useHospitality(params?: { status?: string; type?: string; search?: string }) {
    const [rooms, setRooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await hospitalityAPI.getRooms(params);
            setRooms(data);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar quartos');
        } finally {
            setIsLoading(false);
        }
    }, [params?.status, params?.type, params?.search]);
    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const seedRooms = async () => {
        try {
            await hospitalityAPI.seedRooms();
            await fetchRooms();
            toast.success('Quartos inicializados com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao inicializar quartos');
        }
    };

    const createBooking = async (data: any) => {
        try {
            await hospitalityAPI.createBooking(data);
            await fetchRooms();
            toast.success('Check-in realizado com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao realizar check-in');
            throw err;
        }
    };

    const checkout = async (bookingId: string) => {
        try {
            await hospitalityAPI.checkout(bookingId);
            await fetchRooms();
            toast.success('Check-out realizado com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao realizar check-out');
            throw err;
        }
    };

    const addRoom = async (data: any) => {
        try {
            await hospitalityAPI.createRoom(data);
            await fetchRooms();
            toast.success('Quarto adicionado com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao adicionar quarto');
            throw err;
        }
    };

    const updateRoom = async (id: string, data: any) => {
        try {
            await hospitalityAPI.updateRoom(id, data);
            await fetchRooms();
            toast.success('Quarto actualizado com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao actualizar quarto');
            throw err;
        }
    };

    const deleteRoom = async (id: string) => {
        try {
            await hospitalityAPI.deleteRoom(id);
            await fetchRooms();
            toast.success('Quarto removido com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao remover quarto');
            throw err;
        }
    };

    const addConsumption = async (bookingId: string, data: { productId: string; quantity: number }) => {
        try {
            await hospitalityAPI.addConsumption(bookingId, data);
            await fetchRooms();
            toast.success('Consumo registrado com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao registrar consumo');
            throw err;
        }
    };

    return {
        rooms,
        isLoading,
        error,
        refetch: fetchRooms,
        seedRooms,
        createBooking,
        checkout,
        addRoom,
        updateRoom,
        deleteRoom,
        addConsumption,
    };
}
