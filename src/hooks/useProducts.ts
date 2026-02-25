import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsAPI } from '../services/api';
import { db } from '../db/offlineDB';
import type { Product } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseProductsParams {
    search?: string;
    category?: string;
    status?: string;
    warehouseId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    origin_module?: string;
}

export function useProducts(params?: UseProductsParams) {
    const queryClient = useQueryClient();

    // Query for fetching products
    const {
        data,
        isLoading,
        error,
        refetch,
        isPlaceholderData
    } = useQuery({
        queryKey: ['products', params],
        queryFn: async () => {
            if (navigator.onLine) {
                const response = await productsAPI.getAll(params);

                let productsData: Product[] = [];
                let pagination: PaginationMeta;

                if (response.data && response.pagination) {
                    productsData = response.data;
                    pagination = response.pagination;
                } else {
                    productsData = Array.isArray(response) ? response : (response.data || []);
                    pagination = {
                        page: params?.page || 1,
                        limit: params?.limit || productsData.length,
                        total: productsData.length,
                        totalPages: 1,
                        hasMore: false
                    };
                }

                // Normalization
                const finalProducts = productsData.map(p => ({
                    ...p,
                    stocks: p.warehouseStocks?.reduce((acc: any, ws: any) => ({
                        ...acc,
                        [ws.warehouseId]: ws.quantity
                    }), {})
                }));

                // Offline caching - only cache when on first page or no pagination
                if (!params?.page || params.page === 1) {
                    try {
                        await db.products.clear();
                        if (productsData.length > 0) {
                            await db.products.bulkPut(productsData);
                        }
                    } catch (dexieError) {
                        console.error('Dexie error in useProducts:', dexieError);
                    }
                }

                return { products: finalProducts, pagination };
            } else {
                // Offline fallback
                const cached = await db.products.toArray();
                const normalizedCached = cached.map(p => ({
                    ...p,
                    stocks: p.warehouseStocks?.reduce((acc: any, ws: any) => ({
                        ...acc,
                        [ws.warehouseId]: ws.quantity
                    }), {})
                }));

                toast('A usar catálogo de produtos offline', { icon: '📦' });

                return {
                    products: normalizedCached,
                    pagination: {
                        page: 1,
                        limit: cached.length,
                        total: cached.length,
                        totalPages: 1,
                        hasMore: false
                    }
                };
            }
        },
        placeholderData: (previousData) => previousData, // Maintain UI during pagination
    });

    // Mutations
    const addMutation = useMutation({
        mutationFn: async (newData: Parameters<typeof productsAPI.create>[0]) => {
            if (!navigator.onLine) {
                await db.pendingOperations.add({
                    module: 'inventory',
                    endpoint: '/products',
                    method: 'POST',
                    data: newData,
                    timestamp: Date.now(),
                    synced: false as any
                });
                toast('Produto guardado localmente (Offline)', { icon: '💾' });
                return { ...newData, id: `offline-${Date.now()}` } as any;
            }
            return productsAPI.create(newData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Produto criado com sucesso!');
        },
        onError: (err) => {
            console.error('Error creating product:', err);
            toast.error('Erro ao criar produto');
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Parameters<typeof productsAPI.update>[1] }) => {
            if (!navigator.onLine) {
                await db.pendingOperations.add({
                    module: 'inventory',
                    endpoint: `/products/${id}`,
                    method: 'PUT',
                    data,
                    timestamp: Date.now(),
                    synced: false as any
                });
                toast('Actualização guardada localmente (Offline)', { icon: '💾' });
                return { ...data, id } as any;
            }
            return productsAPI.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Produto actualizado com sucesso!');
        },
        onError: (err) => {
            console.error('Error updating product:', err);
            toast.error('Erro ao actualizar produto');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => productsAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Produto removido com sucesso!');
        },
        onError: (err) => {
            console.error('Error deleting product:', err);
            toast.error('Erro ao remover produto');
        }
    });

    const updateStockMutation = useMutation({
        mutationFn: async ({ id, quantity, operation, warehouseId }: {
            id: string,
            quantity: number,
            operation: 'add' | 'subtract' | 'set',
            warehouseId?: string
        }) => {
            if (!navigator.onLine) {
                await db.pendingOperations.add({
                    module: 'inventory',
                    endpoint: `/products/${id}/stock`,
                    method: 'PUT',
                    data: { quantity, operation, warehouseId },
                    timestamp: Date.now(),
                    synced: false as any
                });
                toast('Ajuste de stock guardado (Offline)', { icon: '💾' });
                return;
            }
            return productsAPI.updateStock(id, { quantity, operation, warehouseId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Stock actualizado com sucesso!');
        },
        onError: (err) => {
            console.error('Error updating stock:', err);
            toast.error('Erro ao actualizar stock');
        }
    });

    return {
        products: data?.products || [],
        pagination: data?.pagination || null,
        isLoading,
        error: error ? 'Erro ao carregar produtos' : null,
        refetch,
        isPlaceholderData,
        addProduct: addMutation.mutateAsync,
        updateProduct: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
        deleteProduct: deleteMutation.mutateAsync,
        updateStock: (id: string, quantity: number, operation: any, warehouseId?: string) =>
            updateStockMutation.mutateAsync({ id, quantity, operation, warehouseId }),
        getProductByBarcode: (barcode: string) => productsAPI.getByBarcode(barcode),
    };
}
