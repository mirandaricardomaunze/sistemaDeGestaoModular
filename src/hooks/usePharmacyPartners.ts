import { useState, useCallback, useEffect } from 'react';
import { pharmacyAPI } from '../services/api';
import { toast } from 'react-hot-toast';

export interface Partner {
    id: string;
    name: string;
    category: string;
    coveragePercentage: number;
    email?: string;
    phone?: string;
    address?: string;
    nuit?: string;
    isActive: boolean;
}

export const usePharmacyPartners = () => {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchPartners = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await pharmacyAPI.getPartners();
            setPartners(data);
        } catch (error) {
            console.error('Error fetching partners:', error);
            toast.error('Erro ao carregar parceiros.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPartners();
    }, [fetchPartners]);

    const addPartner = useCallback(async (data: Omit<Partner, 'id' | 'isActive'>) => {
        setIsLoading(true);
        try {
            const newPartner = await pharmacyAPI.createPartner(data);
            setPartners(prev => [...prev, newPartner]);
            toast.success('Parceiro adicionado com sucesso.');
            return newPartner;
        } catch (error) {
            console.error('Error adding partner:', error);
            toast.error('Erro ao adicionar parceiro.');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updatePartner = useCallback(async (id: string, data: Partial<Partner>) => {
        setIsLoading(true);
        try {
            const updated = await pharmacyAPI.updatePartner(id, data);
            setPartners(prev => prev.map(p => p.id === id ? updated : p));
            toast.success('Parceiro atualizado com sucesso.');
            return updated;
        } catch (error) {
            console.error('Error updating partner:', error);
            toast.error('Erro ao atualizar parceiro.');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deletePartner = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            await pharmacyAPI.deletePartner(id);
            setPartners(prev => prev.filter(p => p.id !== id));
            toast.success('Parceiro removido com sucesso.');
        } catch (error) {
            console.error('Error deleting partner:', error);
            toast.error('Erro ao remover parceiro.');
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        partners,
        isLoading,
        addPartner,
        updatePartner,
        deletePartner,
        refresh: fetchPartners
    };
};
