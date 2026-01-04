import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { productsAPI } from '../services/api';
import { db } from '../db/offlineDB';
import type { Product } from '../types';

interface UseProductsParams {
    search?: string;
    category?: string;
    status?: string;
}

export function useProducts(params?: UseProductsParams) {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (navigator.onLine) {
                const response = await productsAPI.getAll(params);
                const productsData = Array.isArray(response) ? response : (response.data || []);

                setProducts(productsData);

                try {
                    await db.products.clear();
                    if (productsData.length > 0) {
                        await db.products.bulkPut(productsData);
                    }
                } catch (dexieError) {
                    console.error('Dexie error in useProducts:', dexieError);
                }
            } else {
                const cached = await db.products.toArray();
                setProducts(cached);
                toast('A usar catálogo de produtos offline', { icon: '📦' });
            }
        } catch (err) {
            setError('Erro ao carregar produtos');
            console.error('Error fetching products:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.search, params?.category, params?.status]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const addProduct = async (data: Parameters<typeof productsAPI.create>[0]) => {
        try {
            const newProduct = await productsAPI.create(data);
            setProducts((prev) => [...prev, newProduct]);
            toast.success('Produto criado com sucesso!');
            return newProduct;
        } catch (err) {
            console.error('Error creating product:', err);
            throw err;
        }
    };

    const updateProduct = async (id: string, data: Parameters<typeof productsAPI.update>[1]) => {
        try {
            const updated = await productsAPI.update(id, data);
            setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
            toast.success('Produto actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating product:', err);
            throw err;
        }
    };

    const deleteProduct = async (id: string) => {
        try {
            await productsAPI.delete(id);
            setProducts((prev) => prev.filter((p) => p.id !== id));
            toast.success('Produto removido com sucesso!');
        } catch (err) {
            console.error('Error deleting product:', err);
            throw err;
        }
    };

    const updateStock = async (
        id: string,
        quantity: number,
        operation: 'add' | 'subtract' | 'set',
        warehouseId?: string
    ) => {
        try {
            const updated = await productsAPI.updateStock(id, { quantity, operation, warehouseId });
            setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
            toast.success('Stock actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating stock:', err);
            throw err;
        }
    };

    return {
        products,
        isLoading,
        error,
        refetch: fetchProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        updateStock,
    };
}
