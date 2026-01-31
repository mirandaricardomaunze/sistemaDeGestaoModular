import { useState, useEffect, useCallback } from 'react';
import {
    productsAPI,
    hospitalityAPI,
    pharmacyAPI,
    invoicesAPI
} from '../services/api';
import logisticsAPI from '../services/api/logistics.api';
import { useTenant } from '../contexts/TenantContext';

export interface SmartInsight {
    id: string;
    module: 'commercial' | 'hospitality' | 'pharmacy' | 'logistics' | 'hr' | 'financial';
    type: 'warning' | 'info' | 'success' | 'opportunity';
    title: string;
    description: string;
    value?: string | number;
    trend?: 'up' | 'down' | 'stable';
    actionText?: string;
    actionPath?: string;
    priority: number; // 1-10
}

export function useSmartInsights() {
    const { hasModule } = useTenant();
    const [insights, setInsights] = useState<SmartInsight[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const generateInsights = useCallback(async () => {
        setIsLoading(true);
        const newInsights: SmartInsight[] = [];

        try {
            const promises = [];

            // 1. Commercial - Stock Depletion
            if (hasModule('commercial')) {
                promises.push(productsAPI.getLowStock({ limit: 5 }).then(data => {
                    const lowStockItems = data?.data || [];
                    if (lowStockItems.length > 0) {
                        newInsights.push({
                            id: 'comm-stock-low',
                            module: 'commercial',
                            type: 'warning',
                            title: 'Risco de Rutura de Stock',
                            description: `${lowStockItems.length} produtos estão abaixo do stock mínimo e podem esgotar brevemente.`,
                            priority: 9,
                            actionText: 'Repor Stock',
                            actionPath: '/inventory'
                        });
                    }
                }));
            }

            // 2. Pharmacy - Expiry Alerts
            if (hasModule('pharmacy')) {
                promises.push(pharmacyAPI.getMedications({ expiringDays: 30 }).then(data => {
                    const expiringItems = data?.medications || [];
                    if (expiringItems.length > 0) {
                        newInsights.push({
                            id: 'pharma-expiry',
                            module: 'pharmacy',
                            type: 'warning',
                            title: 'Fim de Validade Próximo',
                            description: `${expiringItems.length} medicamentos expiram em 30 dias. Recomendado escoamento.`,
                            priority: 10,
                            actionText: 'Ver Lotes',
                            actionPath: '/pharmacy/manage'
                        });
                    }
                }));
            }

            // 3. Hospitality - Occupancy Demand
            if (hasModule('hospitality')) {
                promises.push(hospitalityAPI.getDashboardSummary().then(data => {
                    const occupancy = data?.occupancyRate || 0;
                    if (occupancy > 80) {
                        newInsights.push({
                            id: 'hotel-demand-high',
                            module: 'hospitality',
                            type: 'opportunity',
                            title: 'Alta Ocupação Detetada',
                            description: 'A ocupação está acima de 80%. Considere ajustar tarifas dinâmicas.',
                            priority: 7,
                            actionText: 'Gerir Reservas',
                            actionPath: '/hospitality/ops'
                        });
                    }
                }));
            }

            // 4. Logistics - Delivery Volume
            if (hasModule('logistics')) {
                promises.push(logisticsAPI.getDashboard().then(data => {
                    const pending = data?.stats?.pendingDeliveries || 0;
                    if (pending > 10) {
                        newInsights.push({
                            id: 'log-consolidation',
                            module: 'logistics',
                            type: 'info',
                            title: 'Otimização de Entregas',
                            description: `Existem ${pending} entregas pendentes. Oportunidade de consolidação de rotas.`,
                            priority: 6,
                            actionText: 'Ver Entregas',
                            actionPath: '/logistics/deliveries'
                        });
                    }
                }));
            }

            // 5. Financial - Overdue Invoices
            promises.push(invoicesAPI.getAll({ status: 'overdue' }).then((data: any) => {
                const count = data?.pagination?.total || 0;
                if (count > 0) {
                    newInsights.push({
                        id: 'fin-liquidity',
                        module: 'financial',
                        type: 'warning',
                        title: 'Atenção à Liquidez',
                        description: `Existem ${count} faturas vencidas. O fluxo de caixa pode ser impactado.`,
                        priority: 8,
                        actionText: 'Cobranças',
                        actionPath: '/invoices'
                    });
                }
            }));

            await Promise.all(promises);
            setInsights(newInsights.sort((a, b) => b.priority - a.priority));
        } catch (error) {
            console.error('Error generating smart insights:', error);
        } finally {
            setIsLoading(false);
        }
    }, [hasModule]);

    useEffect(() => {
        generateInsights();
    }, [generateInsights]);

    return { insights, isLoading, refetch: generateInsights };
}
