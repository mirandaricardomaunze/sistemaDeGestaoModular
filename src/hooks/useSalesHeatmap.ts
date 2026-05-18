import { useState, useEffect, useMemo, useCallback } from 'react';
import { salesAPI } from '../services/api/sales.api';
import { logger } from '../utils/logger';
import type { Sale } from '../types';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8:00 to 22:00

export function useSalesHeatmap(days: number = 30, warehouseId?: string, originModule = 'commercial') {
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSales = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);

            // Fetch a representative sample of sales
            const response = await salesAPI.getAll({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                warehouseId,
                originModule,
                limit: 2000 // High limit to get a good heatmap
            });

            setSales(response.data || []);
        } catch (err) {
            logger.error('Error fetching heatmap sales:', err);
            setError('Erro ao carregar dados do mapa de calor');
        } finally {
            setIsLoading(false);
        }
    }, [days, warehouseId, originModule]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    const heatmapData = useMemo(() => {
        const data: Record<string, Record<number, number>> = {};
        
        // Initialize
        ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].forEach(day => {
            data[day] = {};
            HOURS.forEach(hour => {
                data[day][hour] = 0;
            });
        });

        if (sales.length === 0) return data;

        // Populate with real totals
        sales.forEach(sale => {
            const date = new Date(sale.createdAt);
            const dayIndex = date.getDay(); // 0 is Sunday
            // Convert to our DAYS array format (Seg, Ter...)
            const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayIndex];
            const hour = date.getHours();

            if (data[dayName] && hour in data[dayName]) {
                data[dayName][hour] += sale.total || 0;
            }
        });

        // Normalize to 0-100 percentage for intensity colors
        let maxVal = 0;
        Object.values(data).forEach(dayObj => {
            Object.values(dayObj).forEach(val => {
                if (val > maxVal) maxVal = val;
            });
        });

        if (maxVal > 0) {
            Object.keys(data).forEach(day => {
                HOURS.forEach(hour => {
                    const val = data[day][hour];
                    if (val > 0) {
                        // Ensure at least 25% intensity if there's any sale, 
                        // so it's visible even with sparse data
                        data[day][hour] = 25 + (val / maxVal) * 75;
                    }
                });
            });
        }

        return data;
    }, [sales]);

    return { heatmapData, isLoading, error, refetch: fetchSales };
}
