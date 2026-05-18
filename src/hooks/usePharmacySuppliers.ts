import { useState, useCallback, useEffect } from 'react';
import { suppliersAPI } from '../services/api';
import type { Supplier } from '../types';
import toast from 'react-hot-toast';

interface SupplierPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const usePharmacySuppliers = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState<SupplierPagination | null>(null);

    const fetchSuppliers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await suppliersAPI.getAll({ search: search || undefined });
            const list = Array.isArray(data) ? data : ((data as { data?: Supplier[] }).data || []);
            setSuppliers(list as Supplier[]);
            const paginationData = (data as { pagination?: SupplierPagination }).pagination;
            if (paginationData) setPagination(paginationData);
        } catch {
            toast.error('Erro ao carregar fornecedores.');
        } finally {
            setIsLoading(false);
        }
    }, [search, page]);

    useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

    const addSupplier = async (data: Partial<Supplier>) => {
        const result = await suppliersAPI.create(data as Parameters<typeof suppliersAPI.create>[0]);
        fetchSuppliers();
        toast.success('Fornecedor adicionado.');
        return result;
    };

    const updateSupplier = async (id: string, data: Partial<Supplier>) => {
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
