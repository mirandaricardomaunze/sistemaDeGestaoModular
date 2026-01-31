import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { settingsAPI } from '../services/api';

export function useCompanySettings() {
    const [settings, setSettings] = useState<{
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
        // Print settings
        printerType?: 'thermal' | 'a4';
        thermalPaperWidth?: '80mm' | '58mm';
        autoPrintReceipt?: boolean;
    } | null>(null);
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
