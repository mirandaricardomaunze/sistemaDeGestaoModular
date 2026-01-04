import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { suppliersAPI } from '../services/api';
import type { Supplier } from '../types';

export function useSuppliers(params?: { search?: string }) {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSuppliers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await suppliersAPI.getAll(params);
            setSuppliers(result);
        } catch (err) {
            setError('Erro ao carregar fornecedores');
            console.error('Error fetching suppliers:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.search]);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const addSupplier = async (data: Parameters<typeof suppliersAPI.create>[0]) => {
        try {
            const newSupplier = await suppliersAPI.create(data);
            setSuppliers((prev) => [...prev, newSupplier]);
            toast.success('Fornecedor criado com sucesso!');
            return newSupplier;
        } catch (err) {
            console.error('Error creating supplier:', err);
            throw err;
        }
    };

    const updateSupplier = async (id: string, data: Parameters<typeof suppliersAPI.update>[1]) => {
        try {
            const updated = await suppliersAPI.update(id, data);
            setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
            toast.success('Fornecedor actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating supplier:', err);
            throw err;
        }
    };

    const deleteSupplier = async (id: string) => {
        try {
            await suppliersAPI.delete(id);
            setSuppliers((prev) => prev.filter((s) => s.id !== id));
            toast.success('Fornecedor removido com sucesso!');
        } catch (err) {
            console.error('Error deleting supplier:', err);
            throw err;
        }
    };

    return {
        suppliers,
        isLoading,
        error,
        refetch: fetchSuppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
    };
}
