import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { commercialAPI } from '../services/api/commercial.api';
import type { InventoryForecast } from '../services/api/commercial.api';
import { logger } from '../utils/logger';

export function usePredictiveForecast() {
    const [data, setData] = useState<InventoryForecast[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getPredictiveForecast());
        } catch (err) {
            logger.error('Error fetching predictive forecast:', err);
            setError('Erro ao carregar análise preditiva');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const createOrders = async (suggestions: Array<{ productId: string; quantity: number }>) => {
        if (suggestions.length === 0) return;
        setIsCreating(true);
        try {
            const res = await commercialAPI.generateOrdersFromForecast(suggestions);
            toast.success(`${res.count} rascunhos de Ordens de Compra criados com sucesso!`);
            return res;
        } catch (err) {
            logger.error('Error creating orders from forecast:', err);
            toast.error('Erro ao gerar ordens de compra');
            throw err;
        } finally {
            setIsCreating(false);
        }
    };

    return { data, isLoading, isCreating, error, refetch: fetch, createOrders };
}
