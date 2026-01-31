import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { pharmacyAPI } from '../services/api';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UsePrescriptionsParams {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export function usePrescriptions(params?: UsePrescriptionsParams) {
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPrescriptions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await pharmacyAPI.getPrescriptions(params);

            if (response.data && response.pagination) {
                setPrescriptions(response.data);
                setPagination(response.pagination);
            } else {
                const data = Array.isArray(response) ? response : (response.data || []);
                setPrescriptions(data);
                setPagination({
                    page: params?.page || 1,
                    limit: params?.limit || data.length,
                    total: data.length,
                    totalPages: 1,
                    hasMore: false
                });
            }
        } catch (err: unknown) {
            setError(err.message || 'Erro ao carregar receitas');
            console.error('Error fetching prescriptions:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.status,
        params?.search,
        params?.page,
        params?.limit
    ]);

    useEffect(() => {
        fetchPrescriptions();
    }, [fetchPrescriptions]);

    const addPrescription = async (data: any) => {
        try {
            const newPrescription = await pharmacyAPI.createPrescription(data);
            toast.success('Receita registrada com sucesso!');
            fetchPrescriptions();
            return newPrescription;
        } catch (err: unknown) {
            toast.error(err.response?.data?.message || 'Erro ao registrar receita');
            throw err;
        }
    };

    return {
        prescriptions,
        pagination,
        isLoading,
        error,
        refetch: fetchPrescriptions,
        addPrescription
    };
}
