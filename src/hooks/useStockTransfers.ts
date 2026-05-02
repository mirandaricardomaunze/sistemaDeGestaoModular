import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { warehousesAPI } from '../services/api';
import type { StockTransfer } from '../types';

interface UseTransfersParams {
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    status?: string;
}

export function useStockTransfers(params?: UseTransfersParams) {
    const [transfers, setTransfers] = useState<StockTransfer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTransfers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await warehousesAPI.getTransfers(params);
            setTransfers(response.data || response);
        } catch (err) {
            setError('Erro ao carregar transferências');
            logger.error('Error fetching transfers:', err);
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
            setTransfers((prev) => [newTransfer, ...prev]);
            toast.success('Rascunho de transferência criado!');
            return newTransfer;
        } catch (err) {
            logger.error('Error creating transfer:', err);
            throw err;
        }
    };

    const submitTransfer = async (id: string) => {
        try {
            const updated = await warehousesAPI.submitTransfer(id);
            setTransfers((prev) => prev.map(t => t.id === id ? updated : t));
            toast.success('Transferência submetida para aprovação!');
            return updated;
        } catch (err) {
            logger.error('Error submitting transfer:', err);
            throw err;
        }
    };

    const approveTransfer = async (id: string) => {
        try {
            const updated = await warehousesAPI.approveTransfer(id);
            setTransfers((prev) => prev.map(t => t.id === id ? updated : t));
            toast.success('Transferência aprovada!');
            return updated;
        } catch (err) {
            logger.error('Error approving transfer:', err);
            throw err;
        }
    };

    const rejectTransfer = async (id: string, reason: string) => {
        try {
            const updated = await warehousesAPI.rejectTransfer(id, reason);
            setTransfers((prev) => prev.map(t => t.id === id ? updated : t));
            toast.error('Transferência rejeitada.');
            return updated;
        } catch (err) {
            logger.error('Error rejecting transfer:', err);
            throw err;
        }
    };

    const dispatchTransfer = async (id: string) => {
        try {
            const updated = await warehousesAPI.dispatchTransfer(id);
            setTransfers((prev) => prev.map(t => t.id === id ? updated : t));
            toast.success('Mercadoria despachada!');
            return updated;
        } catch (err) {
            logger.error('Error dispatching transfer:', err);
            throw err;
        }
    };

    const receiveTransfer = async (id: string, items?: any[]) => {
        try {
            const updated = await warehousesAPI.receiveTransfer(id, items);
            setTransfers((prev) => prev.map(t => t.id === id ? updated : t));
            toast.success('Mercadoria recebida com sucesso!');
            return updated;
        } catch (err) {
            logger.error('Error receiving transfer:', err);
            throw err;
        }
    };

    const completeTransfer = async (id: string) => {
        try {
            const updated = await warehousesAPI.completeTransfer(id);
            setTransfers((prev) => prev.map(t => t.id === id ? updated : t));
            toast.success('Transferência concluída!');
            return updated;
        } catch (err) {
            logger.error('Error completing transfer:', err);
            throw err;
        }
    };

    const cancelTransfer = async (id: string) => {
        try {
            const updated = await warehousesAPI.cancelTransfer(id);
            setTransfers((prev) => prev.map(t => t.id === id ? updated : t));
            toast.success('Transferência cancelada.');
            return updated;
        } catch (err) {
            logger.error('Error cancelling transfer:', err);
            throw err;
        }
    };

    return {
        transfers,
        isLoading,
        error,
        createTransfer,
        submitTransfer,
        approveTransfer,
        rejectTransfer,
        dispatchTransfer,
        receiveTransfer,
        completeTransfer,
        cancelTransfer,
        refetch: fetchTransfers,
    };
}
