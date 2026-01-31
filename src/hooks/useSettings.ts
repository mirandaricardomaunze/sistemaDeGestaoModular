import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { settingsAPI, campaignsAPI } from '../services/api';
import type { Category } from '../types';

// ============================================================================
// Company Settings Hook
// ============================================================================

interface CompanySettings {
    id: string;
    companyName: string;
    tradeName?: string;
    nuit?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    country: string;
    logo?: string;
    ivaRate: number;
    currency: string;
}

export function useCompanySettings() {
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await settingsAPI.getCompany();
            setSettings(result);
        } catch (err) {
            setError('Erro ao carregar configurações');
            console.error('Error fetching settings:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const updateSettings = async (data: Parameters<typeof settingsAPI.updateCompany>[0]) => {
        try {
            const updated = await settingsAPI.updateCompany(data);
            setSettings(updated);
            toast.success('Configurações actualizadas com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating settings:', err);
            throw err;
        }
    };

    return {
        settings,
        isLoading,
        error,
        refetch: fetchSettings,
        updateSettings,
    };
}

// ============================================================================
// Categories Hook
// ============================================================================

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

// ============================================================================
// Campaigns Hook
// ============================================================================

interface Campaign {
    id: string;
    name: string;
    description?: string;
    code?: string;
    status: string;
    startDate: string;
    endDate: string;
    discountType: string;
    discountValue: number;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    maxTotalUses?: number;
    currentUses: number;
}

export function useCampaigns(params?: { status?: string }) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCampaigns = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await campaignsAPI.getAll(params);
            setCampaigns(result);
        } catch (err) {
            setError('Erro ao carregar campanhas');
            console.error('Error fetching campaigns:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.status]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const addCampaign = async (data: Parameters<typeof campaignsAPI.create>[0]) => {
        try {
            const newCampaign = await campaignsAPI.create(data);
            setCampaigns((prev) => [...prev, newCampaign]);
            toast.success('Campanha criada com sucesso!');
            return newCampaign;
        } catch (err) {
            console.error('Error creating campaign:', err);
            throw err;
        }
    };

    const updateCampaign = async (id: string, data: Parameters<typeof campaignsAPI.update>[1]) => {
        try {
            const updated = await campaignsAPI.update(id, data);
            setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
            toast.success('Campanha actualizada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating campaign:', err);
            throw err;
        }
    };

    const deleteCampaign = async (id: string) => {
        try {
            await campaignsAPI.delete(id);
            setCampaigns((prev) => prev.filter((c) => c.id !== id));
            toast.success('Campanha removida com sucesso!');
        } catch (err) {
            console.error('Error deleting campaign:', err);
            throw err;
        }
    };

    const validateCode = async (code: string, purchaseAmount?: number) => {
        try {
            const result = await campaignsAPI.validateCode(code, purchaseAmount);
            return result;
        } catch (err) {
            console.error('Error validating campaign code:', err);
            throw err;
        }
    };

    return {
        campaigns,
        isLoading,
        error,
        refetch: fetchCampaigns,
        addCampaign,
        updateCampaign,
        deleteCampaign,
        validateCode,
    };
}
