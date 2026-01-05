import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { customersAPI } from '../services/api';
import { db } from '../db/offlineDB';
import type { Customer } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseCustomersParams {
    search?: string;
    type?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export function useCustomers(params?: UseCustomersParams) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCustomers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (navigator.onLine) {
                const response = await customersAPI.getAll(params);

                let customersData: Customer[] = [];
                if (response.data && response.pagination) {
                    customersData = response.data;
                    setPagination(response.pagination);
                } else {
                    customersData = Array.isArray(response) ? response : (response.data || []);
                    setPagination({
                        page: params?.page || 1,
                        limit: params?.limit || customersData.length,
                        total: customersData.length,
                        totalPages: 1,
                        hasMore: false
                    });
                }

                setCustomers(customersData);

                // Offline caching - only cache when on first page
                if (!params?.page || params.page === 1) {
                    try {
                        await db.customers.clear();
                        if (customersData.length > 0) {
                            await db.customers.bulkPut(customersData);
                        }
                    } catch (dexieError) {
                        console.error('Dexie error in useCustomers:', dexieError);
                    }
                }
            } else {
                const cached = await db.customers.toArray();
                setCustomers(cached);
                setPagination({
                    page: 1,
                    limit: cached.length,
                    total: cached.length,
                    totalPages: 1,
                    hasMore: false
                });
                toast('A usar lista de clientes offline', { icon: '👥' });
            }
        } catch (err) {
            setError('Erro ao carregar clientes');
            console.error('Error fetching customers:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.search,
        params?.type,
        params?.page,
        params?.limit,
        params?.sortBy,
        params?.sortOrder
    ]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const addCustomer = async (data: Parameters<typeof customersAPI.create>[0]) => {
        try {
            const newCustomer = await customersAPI.create(data);
            setCustomers((prev) => [newCustomer, ...prev]);
            toast.success('Cliente criado com sucesso!');
            return newCustomer;
        } catch (err) {
            console.error('Error creating customer:', err);
            throw err;
        }
    };

    const updateCustomer = async (id: string, data: Parameters<typeof customersAPI.update>[1]) => {
        try {
            const updated = await customersAPI.update(id, data);
            setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
            toast.success('Cliente actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating customer:', err);
            throw err;
        }
    };

    const deleteCustomer = async (id: string) => {
        try {
            await customersAPI.delete(id);
            setCustomers((prev) => prev.filter((c) => c.id !== id));
            toast.success('Cliente removido com sucesso!');
        } catch (err) {
            console.error('Error deleting customer:', err);
            throw err;
        }
    };

    return {
        customers,
        pagination,
        isLoading,
        error,
        refetch: fetchCustomers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
    };
}
