import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { customersAPI } from '../services/api';
import { db } from '../db/offlineDB';
import type { Customer } from '../types';

interface UseCustomersParams {
    search?: string;
    type?: string;
}

export function useCustomers(params?: UseCustomersParams) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCustomers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (navigator.onLine) {
                const response = await customersAPI.getAll(params);
                const customersData = Array.isArray(response) ? response : (response.data || []);

                setCustomers(customersData);

                try {
                    await db.customers.clear();
                    if (customersData.length > 0) {
                        await db.customers.bulkPut(customersData);
                    }
                } catch (dexieError) {
                    console.error('Dexie error in useCustomers:', dexieError);
                }
            } else {
                const cached = await db.customers.toArray();
                setCustomers(cached);
                toast('A usar lista de clientes offline', { icon: '👥' });
            }
        } catch (err) {
            setError('Erro ao carregar clientes');
            console.error('Error fetching customers:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.search, params?.type]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const addCustomer = async (data: Parameters<typeof customersAPI.create>[0]) => {
        try {
            const newCustomer = await customersAPI.create(data);
            setCustomers((prev) => [...prev, newCustomer]);
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
        isLoading,
        error,
        refetch: fetchCustomers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
    };
}
