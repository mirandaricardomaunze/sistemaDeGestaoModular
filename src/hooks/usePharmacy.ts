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

interface UsePharmacyParams {
    search?: string;
    requiresPrescription?: boolean;
    isControlled?: boolean;
    lowStock?: boolean;
    expiringDays?: number;
    page?: number;
    limit?: number;
}

export function usePharmacy(params?: UsePharmacyParams) {
    const [medications, setMedications] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [metrics, setMetrics] = useState({
        totalMedications: 0,
        lowStockItems: 0,
        expiringSoon: 0,
        controlledItems: 0
    });

    const fetchMedications = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await pharmacyAPI.getMedications(params);

            let data: any[] = [];
            if (response.data && response.pagination) {
                data = response.data;
                setPagination(response.pagination);

                if (params?.page === 1 || !params?.page) {
                    setMetrics(prev => ({
                        ...prev,
                        totalMedications: response.pagination.total
                    }));
                }
            } else {
                data = Array.isArray(response) ? response : (response.data || []);
                setPagination({
                    page: params?.page || 1,
                    limit: params?.limit || data.length,
                    total: data.length,
                    totalPages: 1,
                    hasMore: false
                });

                setMetrics({
                    totalMedications: data.length,
                    lowStockItems: data.filter((m: any) => m.isLowStock).length,
                    expiringSoon: data.filter((m: any) => m.daysToExpiry && m.daysToExpiry <= 90).length,
                    controlledItems: data.filter((m: any) => m.isControlled).length
                });
            }

            setMedications(data);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar medicamentos');
            console.error('Error fetching medications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.search,
        params?.requiresPrescription,
        params?.isControlled,
        params?.lowStock,
        params?.expiringDays,
        params?.page,
        params?.limit
    ]);

    const fetchBatches = useCallback(async () => {
        try {
            const data = await pharmacyAPI.getBatches();
            setBatches(Array.isArray(data) ? data : (data.data || []));
        } catch (err) {
            console.error('Error fetching batches:', err);
        }
    }, []);

    useEffect(() => {
        fetchMedications();
        fetchBatches();
    }, [fetchMedications, fetchBatches]);

    const addMedication = async (data: any) => {
        try {
            const newMed = await pharmacyAPI.createMedication(data);
            toast.success('Medicamento adicionado com sucesso!');
            fetchMedications();
            return newMed;
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao adicionar medicamento');
            throw err;
        }
    };

    const updateMedication = async (id: string, data: any) => {
        try {
            const updated = await pharmacyAPI.updateMedication(id, data);
            toast.success('Medicamento actualizado com sucesso!');
            fetchMedications();
            return updated;
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao actualizar medicamento');
            throw err;
        }
    };

    const deleteMedication = async (id: string) => {
        try {
            await pharmacyAPI.deleteMedication(id);
            toast.success('Medicamento removido com sucesso!');
            fetchMedications();
            return true;
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao remover medicamento');
            throw err;
        }
    };

    const addBatch = async (data: any) => {
        try {
            const newBatch = await pharmacyAPI.createBatch(data);
            toast.success('Lote registrado com sucesso!');
            fetchMedications();
            fetchBatches();
            return newBatch;
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao registrar lote');
            throw err;
        }
    };

    return {
        medications,
        batches,
        pagination,
        metrics,
        isLoading,
        error,
        refetch: () => { fetchMedications(); fetchBatches(); },
        addMedication,
        updateMedication,
        deleteMedication,
        addBatch
    };
}
