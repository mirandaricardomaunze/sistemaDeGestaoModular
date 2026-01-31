import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { employeesAPI } from '../services/api';
import type { VacationRequest } from '../types';

interface UseVacationsParams {
    employeeId?: string;
    status?: string;
}

export function useVacations(params?: UseVacationsParams) {
    const [vacations, setVacations] = useState<VacationRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVacations = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await employeesAPI.getVacations(params);
            setVacations(result);
        } catch (err) {
            setError('Erro ao carregar férias');
            console.error('Error fetching vacations:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.employeeId, params?.status]);

    useEffect(() => {
        fetchVacations();
    }, [fetchVacations]);

    const requestVacation = async (data: Parameters<typeof employeesAPI.requestVacation>[0]) => {
        try {
            const vacation = await employeesAPI.requestVacation(data);
            setVacations((prev) => [...prev, vacation]);
            toast.success('Pedido de férias submetido com sucesso!');
            return vacation;
        } catch (err) {
            console.error('Error requesting vacation:', err);
            throw err;
        }
    };

    const updateVacation = async (
        id: string,
        data: Parameters<typeof employeesAPI.updateVacation>[1]
    ) => {
        try {
            const updated = await employeesAPI.updateVacation(id, data);
            setVacations((prev) => prev.map((v) => (v.id === id ? updated : v)));
            toast.success('Pedido de férias actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating vacation:', err);
            throw err;
        }
    };

    return {
        vacations,
        isLoading,
        error,
        refetch: fetchVacations,
        requestVacation,
        updateVacation,
    };
}
