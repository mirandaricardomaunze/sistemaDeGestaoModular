import { useState, useCallback, useEffect } from 'react';
import { suppliersAPI } from '../services/api';
import toast from 'react-hot-toast';

export const usePharmacySuppliers = () => {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState<any>(null);

    const fetchSuppliers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await suppliersAPI.getAll({ search: search || undefined });
            const list = Array.isArray(data) ? data : (data.data || []);
            setSuppliers(list);
            if (data.pagination) setPagination(data.pagination);
        } catch {
            toast.error('Erro ao carregar fornecedores.');
        } finally {
            setIsLoading(false);
        }
    }, [search, page]);

    useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

    const addSupplier = async (data: any) => {
        const result = await suppliersAPI.create(data);
        fetchSuppliers();
        toast.success('Fornecedor adicionado.');
        return result;
    };

    const updateSupplier = async (id: string, data: any) => {
        const result = await suppliersAPI.update(id, data);
        fetchSuppliers();
        toast.success('Fornecedor actualizado.');
        return result;
    };

    const deleteSupplier = async (id: string) => {
        await suppliersAPI.delete(id);
        fetchSuppliers();
        toast.success('Fornecedor removido.');
    };

    return { suppliers, isLoading, page, setPage, search, setSearch, pagination, addSupplier, updateSupplier, deleteSupplier };
};
