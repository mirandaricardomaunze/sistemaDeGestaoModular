import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ordersAPI } from '../services/api';

interface CustomerOrderItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
}

interface OrderTransition {
    id: string;
    status: string;
    responsibleName?: string;
    notes?: string;
    timestamp: string;
}

export interface CustomerOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress?: string;
    total: number;
    status: 'created' | 'printed' | 'separated' | 'completed' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    paymentMethod?: string;
    deliveryDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    items: CustomerOrderItem[];
    transitions: OrderTransition[];
}

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseOrdersParams {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export function useOrders(params?: UseOrdersParams) {
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await ordersAPI.getAll(params);

            let ordersData: CustomerOrder[] = [];
            if (response.data && response.pagination) {
                ordersData = response.data;
                setPagination(response.pagination);
            } else {
                ordersData = (response && response.data && Array.isArray(response.data))
                    ? response.data
                    : (Array.isArray(response) ? response : []);

                setPagination({
                    page: params?.page || 1,
                    limit: params?.limit || ordersData.length,
                    total: ordersData.length,
                    totalPages: 1,
                    hasMore: false
                });
            }

            setOrders(ordersData);
        } catch (err) {
            setError('Erro ao carregar encomendas');
            console.error('Error fetching orders:', err);
            setOrders([]);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.status,
        params?.priority,
        params?.search,
        params?.page,
        params?.limit,
        params?.sortBy,
        params?.sortOrder
    ]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const addOrder = async (data: Parameters<typeof ordersAPI.create>[0]) => {
        try {
            const newOrder = await ordersAPI.create(data);
            setOrders((prev) => [newOrder, ...prev]);
            toast.success('Encomenda criada com sucesso!');
            return newOrder;
        } catch (err) {
            console.error('Error creating order:', err);
            throw err;
        }
    };

    const updateOrder = async (id: string, data: Parameters<typeof ordersAPI.update>[1]) => {
        try {
            const updated = await ordersAPI.update(id, data);
            setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
            toast.success('Encomenda actualizada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating order:', err);
            throw err;
        }
    };

    const updateOrderStatus = async (id: string, data: Parameters<typeof ordersAPI.updateStatus>[1]) => {
        try {
            const updated = await ordersAPI.updateStatus(id, data);
            setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
            toast.success('Status actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating order status:', err);
            throw err;
        }
    };

    const deleteOrder = async (id: string) => {
        try {
            await ordersAPI.delete(id);
            setOrders((prev) => prev.filter((o) => o.id !== id));
            toast.success('Encomenda eliminada com sucesso!');
        } catch (err) {
            console.error('Error deleting order:', err);
            throw err;
        }
    };

    return {
        orders,
        pagination,
        isLoading,
        error,
        refetch: fetchOrders,
        addOrder,
        updateOrder,
        updateOrderStatus,
        deleteOrder,
    };
}
