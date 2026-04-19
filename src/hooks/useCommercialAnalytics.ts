import { useMemo } from 'react';
import { useMarginAnalysis, useSalesReport } from './useCommercial';
import { useProducts, useCustomers } from './useData';
import type { Product, Customer } from '../types';

export interface ABCClassification {
    productId: string;
    name: string;
    revenue: number;
    cumulativePercentage: number;
    classification: 'A' | 'B' | 'C';
}

export interface AtRiskCustomer extends Customer {
    daysSinceLastPurchase: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReorderSuggestion extends Product {
    suggestedQty: number;
    reason: string;
}

export function useCommercialAnalytics(abcPeriod: number = 90) {
    const { products, isLoading: productsLoading } = useProducts();
    const { customers, isLoading: customersLoading } = useCustomers();
    const { data: marginData, isLoading: marginsLoading } = useMarginAnalysis(abcPeriod);
    const { isLoading: salesLoading } = useSalesReport(30);

    const isLoading = productsLoading || customersLoading || marginsLoading || salesLoading;

    // ── ABC Classification ───────────────────────────────────────────────────
    const abcData = useMemo(() => {
        if (!marginData?.byProduct) return [];

        const sorted = [...marginData.byProduct].sort((a, b) => b.revenue - a.revenue);
        const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);
        
        let cumulative = 0;
        return sorted.map(p => {
            cumulative += p.revenue;
            const cumulativePercentage = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
            
            let classification: 'A' | 'B' | 'C' = 'C';
            if (cumulativePercentage <= 80) classification = 'A';
            else if (cumulativePercentage <= 95) classification = 'B';

            return {
                productId: p.id,
                name: p.name,
                revenue: p.revenue,
                cumulativePercentage,
                classification
            };
        });
    }, [marginData]);

    // ── At Risk Customers ────────────────────────────────────────────────────
    const atRiskCustomers = useMemo(() => {
        if (!customers) return [];

        const today = new Date();
        return customers
            .filter(c => c.isActive)
            .map(c => {
                const lastDate = c.lastPurchaseDate ? new Date(c.lastPurchaseDate) : new Date(c.createdAt);
                const diffTime = Math.abs(today.getTime() - lastDate.getTime());
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let riskLevel: AtRiskCustomer['riskLevel'] = 'low';
                if (days > 90) riskLevel = 'critical';
                else if (days > 60) riskLevel = 'high';
                else if (days > 30) riskLevel = 'medium';

                return { ...c, daysSinceLastPurchase: days, riskLevel };
            })
            .filter(c => c.riskLevel !== 'low')
            .sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);
    }, [customers]);

    // ── Smart Reorder Suggestions ────────────────────────────────────────────
    const reorderSuggestions = useMemo(() => {
        if (!products) return [];

        return (products
            .map(p => {
                const leadTime = p.leadTime || 5;
                const weeklySales = p.avgWeeklySales || 0;
                const dailySales = weeklySales / 7;
                const reorderPoint = (dailySales * leadTime) + p.minStock;
                if (p.currentStock <= reorderPoint && p.isActive && !p.isService) {
                    const targetStock = p.maxStock || (p.minStock + (weeklySales * 2));
                    const suggestedQty = Math.max(0, targetStock - p.currentStock);
                    return {
                        ...p,
                        suggestedQty: Math.ceil(suggestedQty),
                        reason: p.currentStock <= p.minStock ? 'Stock Crítico' : 'Reposição Preventiva'
                    };
                }
                return null;
            })
            .filter((p) => p !== null) as ReorderSuggestion[]
        ).sort((a, b) => (a.currentStock / Math.max(1, a.minStock)) - (b.currentStock / Math.max(1, b.minStock)));
    }, [products]);

    // ── Expiry Watch ─────────────────────────────────────────────────────────
    const nearExpiry = useMemo(() => {
        if (!products) return [];
        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));

        return products
            .filter(p => p.expiryDate && new Date(p.expiryDate) <= thirtyDaysFromNow)
            .map(p => {
                const expiry = new Date(p.expiryDate!);
                const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return { ...p, daysRemaining };
            })
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [products]);

    return {
        abcData,
        atRiskCustomers,
        reorderSuggestions,
        nearExpiry,
        isLoading
    };
}
