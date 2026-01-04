import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { settingsAPI } from '../services/api';
import type { Category } from '../types';

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await settingsAPI.getCategories();
            setCategories(result);
        } catch (err) {
            setError('Erro ao carregar categorias');
            console.error('Error fetching categories:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const addCategory = async (data: Parameters<typeof settingsAPI.createCategory>[0]) => {
        try {
            const newCategory = await settingsAPI.createCategory(data);
            setCategories((prev) => [...prev, newCategory]);
            toast.success('Categoria criada com sucesso!');
            return newCategory;
        } catch (err) {
            console.error('Error creating category:', err);
            throw err;
        }
    };

    const updateCategory = async (id: string, data: Parameters<typeof settingsAPI.updateCategory>[1]) => {
        try {
            const updated = await settingsAPI.updateCategory(id, data);
            setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
            toast.success('Categoria actualizada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating category:', err);
            throw err;
        }
    };

    const deleteCategory = async (id: string) => {
        try {
            await settingsAPI.deleteCategory(id);
            setCategories((prev) => prev.filter((c) => c.id !== id));
            toast.success('Categoria removida com sucesso!');
        } catch (err) {
            console.error('Error deleting category:', err);
            throw err;
        }
    };

    return {
        categories,
        isLoading,
        error,
        refetch: fetchCategories,
        addCategory,
        updateCategory,
        deleteCategory,
    };
}
