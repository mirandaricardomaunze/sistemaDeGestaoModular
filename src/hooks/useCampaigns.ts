import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { campaignsAPI } from '../services/api';

export function useCampaigns(params?: { status?: string }) {
    const [campaigns, setCampaigns] = useState<Array<{
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
    }>>([]);
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
