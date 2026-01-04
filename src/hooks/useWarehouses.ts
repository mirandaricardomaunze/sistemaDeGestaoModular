import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { warehousesAPI } from '../services/api';

export function useWarehouses() {
    const [warehouses, setWarehouses] = useState<Array<{
        id: string;
        code: string;
        name: string;
        location?: string;
        responsible?: string;
        isActive: boolean;
        isDefault: boolean;
    }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWarehouses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await warehousesAPI.getAll();
            setWarehouses(result);
        } catch (err) {
            setError('Erro ao carregar armazéns');
            console.error('Error fetching warehouses:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWarehouses();
    }, [fetchWarehouses]);

    const addWarehouse = async (data: Parameters<typeof warehousesAPI.create>[0]) => {
        try {
            const newWarehouse = await warehousesAPI.create(data);
            setWarehouses((prev) => [...prev, newWarehouse]);
            toast.success('Armazém criado com sucesso!');
            return newWarehouse;
        } catch (err) {
            console.error('Error creating warehouse:', err);
            throw err;
        }
    };

    const updateWarehouse = async (id: string, data: Parameters<typeof warehousesAPI.update>[1]) => {
        try {
            const updated = await warehousesAPI.update(id, data);
            setWarehouses((prev) => prev.map((w) => (w.id === id ? updated : w)));
            toast.success('Armazém actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating warehouse:', err);
            throw err;
        }
    };

    return {
        warehouses,
        isLoading,
        error,
        refetch: fetchWarehouses,
        addWarehouse,
        updateWarehouse,
    };
}
