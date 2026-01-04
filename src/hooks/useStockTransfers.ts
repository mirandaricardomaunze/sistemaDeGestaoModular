import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { warehousesAPI } from '../services/api';

interface UseTransfersParams {
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    status?: string;
}

export function useStockTransfers(params?: UseTransfersParams) {
    const [transfers, setTransfers] = useState<Array<{
        id: string;
        number: string;
        sourceWarehouseId: string;
        targetWarehouseId: string;
        status: 'pending' | 'completed' | 'cancelled';
        responsible: string;
        reason?: string;
        date: string;
        items: Array<{ productId: string; quantity: number }>;
    }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTransfers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await warehousesAPI.getTransfers(params);
            setTransfers(result);
        } catch (err) {
            setError('Erro ao carregar transferências');
            console.error('Error fetching transfers:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.sourceWarehouseId, params?.targetWarehouseId, params?.status]);

    useEffect(() => {
        fetchTransfers();
    }, [fetchTransfers]);

    const createTransfer = async (data: Parameters<typeof warehousesAPI.createTransfer>[0]) => {
        try {
            const newTransfer = await warehousesAPI.createTransfer(data);
            setTransfers((prev) => [...prev, newTransfer]);
            toast.success('Transferência criada com sucesso!');
            return newTransfer;
        } catch (err) {
            console.error('Error creating transfer:', err);
            throw err;
        }
    };

    const completeTransfer = async (id: string) => {
        try {
            const updated = await warehousesAPI.completeTransfer(id);
            setTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
            toast.success('Transferência completada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error completing transfer:', err);
            throw err;
        }
    };

    const cancelTransfer = async (id: string) => {
        try {
            const updated = await warehousesAPI.cancelTransfer(id);
            setTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
            toast.success('Transferência cancelada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error canceling transfer:', err);
            throw err;
        }
    };

    return {
        transfers,
        isLoading,
        error,
        refetch: fetchTransfers,
        createTransfer,
        completeTransfer,
        cancelTransfer,
    };
}
