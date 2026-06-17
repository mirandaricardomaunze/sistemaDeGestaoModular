import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { pharmacyAPI } from '../services/api';
import type { Prescription } from '../types/pharmacy';
import type { PharmacyPrescriptionsParams } from '../services/api/pharmacy.api';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

type ApiError = Error & { response?: { data?: { message?: string; error?: string } } };

export function usePrescriptions(params?: PharmacyPrescriptionsParams) {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPrescriptions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await pharmacyAPI.getPrescriptions({
                status: params?.status,
                search: params?.search,
                page: params?.page,
                limit: params?.limit,
            });

            if (response.data && response.pagination) {
                setPrescriptions(response.data);
                setPagination({
                    ...response.pagination,
                    hasMore: response.pagination.page < response.pagination.totalPages,
                });
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
        } catch (err) {
            const message = (err as ApiError).message || 'Erro ao carregar receitas';
            setError(message);
            logger.error('Error fetching prescriptions:', err);
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

    const addPrescription = async (data: Partial<Prescription>) => {
        try {
            const newPrescription = await pharmacyAPI.createPrescription(data);
            toast.success('Receita registrada com sucesso!');
            fetchPrescriptions();
            return newPrescription;
        } catch (err) {
            const apiErr = err as ApiError;
            toast.error(apiErr.response?.data?.message || 'Erro ao registrar receita');
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
