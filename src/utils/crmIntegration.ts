/**
 * POS-CRM Integration Utilities
 * Funções para integrar campanhas e descontos automáticos no POS
 */

import { useCRMStore } from '../stores/useCRMStore';
import type { Customer } from '../types';
import type { CustomerCRMData, CustomerCategory } from '../types/crm';

// ============================================================================
// Auto-Discount Hook for POS
// ============================================================================

export interface AppliedCampaign {
    campaignId: string;
    campaignName: string;
    code?: string;
    discountType: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
    discountValue: number;
    calculatedDiscount: number;
}

export interface POSDiscountResult {
    subtotal: number;
    totalDiscount: number;
    discountedSubtotal: number;
    appliedCampaigns: AppliedCampaign[];
    customerCategory?: CustomerCategory;
}

/**
 * Calculate discounts for a customer's cart
 */
export function calculatePOSDiscounts(
    customerId: string | null,
    cartSubtotal: number,
    customers: Customer[]
): POSDiscountResult {
    const { getActiveCampaignsForCustomer, getCampaignDiscount, getCustomerCRMData, campaigns } = useCRMStore.getState();

    const result: POSDiscountResult = {
        subtotal: cartSubtotal,
        totalDiscount: 0,
        discountedSubtotal: cartSubtotal,
        appliedCampaigns: [],
    };

    if (!customerId) {
        // Check for general campaigns (all customers)
        const generalCampaigns = campaigns.filter(c =>
            c.status === 'active' &&
            c.targetAudience.allCustomers &&
            new Date(c.startDate) <= new Date() &&
            new Date(c.endDate) >= new Date()
        );

        for (const campaign of generalCampaigns) {
            const discount = getCampaignDiscount(campaign.id, cartSubtotal);
            if (discount > 0) {
                result.appliedCampaigns.push({
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    code: campaign.code,
                    discountType: campaign.discountType,
                    discountValue: campaign.discountValue,
                    calculatedDiscount: discount,
                });
                result.totalDiscount += discount;
            }
        }
    } else {
        // Get customer data
        const customer = customers.find(c => c.id === customerId);
        const crmData = getCustomerCRMData(customerId);

        // Build customer data for segmentation check
        const customerData: Partial<CustomerCRMData> = {
            customerId,
            category: crmData?.category || 'regular',
            creditLimit: customer?.creditLimit || 0,
            totalPurchases: customer?.totalPurchases || 0,
            city: customer?.city,
            province: customer?.province,
            tags: crmData?.tags || [],
        };

        result.customerCategory = customerData.category;

        // Get active campaigns for this customer
        const activeCampaigns = getActiveCampaignsForCustomer(customerId, customerData);

        for (const campaign of activeCampaigns) {
            const discount = getCampaignDiscount(campaign.id, cartSubtotal);
            if (discount > 0) {
                result.appliedCampaigns.push({
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    code: campaign.code,
                    discountType: campaign.discountType,
                    discountValue: campaign.discountValue,
                    calculatedDiscount: discount,
                });
                result.totalDiscount += discount;
            }
        }
    }

    // Calculate final discounted subtotal
    result.discountedSubtotal = Math.max(0, cartSubtotal - result.totalDiscount);

    return result;
}

/**
 * Record campaign usage after a sale
 */
export function recordCampaignUsages(
    customerId: string,
    customerName: string,
    orderAmount: number,
    appliedCampaigns: AppliedCampaign[],
    orderId?: string,
    invoiceId?: string
): void {
    const { recordCampaignUsage } = useCRMStore.getState();

    for (const campaign of appliedCampaigns) {
        recordCampaignUsage({
            campaignId: campaign.campaignId,
            customerId,
            customerName,
            orderId,
            invoiceId,
            orderAmount,
            discountApplied: campaign.calculatedDiscount,
        });
    }
}

/**
 * Apply a promo code manually (for walk-in customers without registration)
 */
export interface PromoCodeResult {
    success: boolean;
    message: string;
    campaign?: AppliedCampaign;
}

export function applyPromoCode(
    code: string,
    cartSubtotal: number
): PromoCodeResult {
    const { campaigns, getCampaignDiscount } = useCRMStore.getState();

    if (!code.trim()) {
        return { success: false, message: 'Digite um código promocional' };
    }

    // Find campaign by code (case-insensitive)
    const campaign = campaigns.find(c =>
        c.code?.toLowerCase() === code.trim().toLowerCase() &&
        c.status === 'active' &&
        new Date(c.startDate) <= new Date() &&
        new Date(c.endDate) >= new Date()
    );

    if (!campaign) {
        return { success: false, message: 'Código promocional inválido ou expirado' };
    }

    // Check minimum purchase requirement
    if (campaign.minPurchaseAmount && cartSubtotal < campaign.minPurchaseAmount) {
        return {
            success: false,
            message: `Compra mínima de ${campaign.minPurchaseAmount.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })} necessária`
        };
    }

    // Check usage limits
    if (campaign.maxTotalUses) {
        if (campaign.currentUses >= campaign.maxTotalUses) {
            return { success: false, message: 'Este código já atingiu o limite de utilizações' };
        }
    }

    // Calculate discount
    const discount = getCampaignDiscount(campaign.id, cartSubtotal);

    if (discount <= 0) {
        return { success: false, message: 'Este código não oferece desconto para este valor' };
    }

    return {
        success: true,
        message: `Código "${campaign.code}" aplicado! Desconto de ${discount.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}`,
        campaign: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            code: campaign.code,
            discountType: campaign.discountType,
            discountValue: campaign.discountValue,
            calculatedDiscount: discount,
        }
    };
}

// ============================================================================
// Customer Selection for POS
// ============================================================================

export interface CustomerSearchResult {
    id: string;
    code: string;
    name: string;
    phone: string;
    type: string;
    totalPurchases: number;
    category?: CustomerCategory;
    activeCampaigns: number;
}

/**
 * Search customers with CRM data included
 */
export function searchCustomersForPOS(
    query: string,
    customers: Customer[]
): CustomerSearchResult[] {
    const { getCustomerCRMData, getActiveCampaignsForCustomer } = useCRMStore.getState();

    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    const matchedCustomers = customers
        .filter(c =>
            c.isActive &&
            (c.name.toLowerCase().includes(lowerQuery) ||
                c.code.toLowerCase().includes(lowerQuery) ||
                c.phone.includes(query) ||
                c.email?.toLowerCase().includes(lowerQuery))
        )
        .slice(0, 10);

    return matchedCustomers.map(customer => {
        const crmData = getCustomerCRMData(customer.id);
        const activeCampaigns = getActiveCampaignsForCustomer(customer.id, {
            customerId: customer.id,
            category: crmData?.category || 'regular',
            creditLimit: customer.creditLimit || 0,
            totalPurchases: customer.totalPurchases,
            city: customer.city,
            province: customer.province,
            tags: crmData?.tags || [],
        });

        return {
            id: customer.id,
            code: customer.code,
            name: customer.name,
            phone: customer.phone,
            type: customer.type,
            totalPurchases: customer.totalPurchases,
            category: crmData?.category,
            activeCampaigns: activeCampaigns.length,
        };
    });
}

// ============================================================================
// Follow-up Notifications
// ============================================================================

export interface FollowUpAlert {
    id: string;
    opportunityId: string;
    opportunityTitle: string;
    customerName: string;
    nextAction: string;
    nextActionDate: string;
    daysOverdue: number;
    severity: 'info' | 'warning' | 'danger';
}

/**
 * Get follow-up alerts for opportunities
 */
export function getFollowUpAlerts(): FollowUpAlert[] {
    const { opportunities, stages } = useCRMStore.getState();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts: FollowUpAlert[] = [];

    for (const opp of opportunities) {
        // Skip closed opportunities
        const stage = stages.find(s => s.id === opp.stageId);
        if (stage?.isClosedStage) continue;

        // Check interactions for pending follow-ups
        for (const interaction of opp.interactions) {
            if (interaction.nextAction && interaction.nextActionDate) {
                const actionDate = new Date(interaction.nextActionDate);
                actionDate.setHours(0, 0, 0, 0);

                const diffDays = Math.ceil(
                    (today.getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                // Include if it's today, overdue, or coming up in next 3 days
                if (diffDays >= -3) {
                    let severity: FollowUpAlert['severity'] = 'info';
                    if (diffDays > 3) severity = 'danger';
                    else if (diffDays > 0) severity = 'warning';

                    alerts.push({
                        id: `${opp.id}-${interaction.id}`,
                        opportunityId: opp.id,
                        opportunityTitle: opp.title,
                        customerName: opp.customerName,
                        nextAction: interaction.nextAction,
                        nextActionDate: interaction.nextActionDate,
                        daysOverdue: diffDays,
                        severity,
                    });
                }
            }
        }
    }

    // Sort by severity and date
    return alerts.sort((a, b) => {
        const severityOrder = { danger: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.daysOverdue - a.daysOverdue;
    });
}

// ============================================================================
// Funnel Dashboard Metrics
// ============================================================================

export interface FunnelDashboardData {
    // Pipeline Value
    pipelineTotal: number;
    pipelineCount: number;
    weightedPipeline: number;

    // Conversion
    winRate: number;
    avgDealSize: number;
    avgTimeToClose: number;

    // By Stage
    stageData: {
        id: string;
        name: string;
        color: string;
        count: number;
        value: number;
        percentage: number;
    }[];

    // Trends (last 30 days)
    wonLast30Days: number;
    lostLast30Days: number;
    newLast30Days: number;

    // Top Opportunities
    topOpportunities: {
        id: string;
        title: string;
        customerName: string;
        value: number;
        probability: number;
        stageName: string;
    }[];
}

/**
 * Get dashboard data for CRM funnel
 */
export function getFunnelDashboardData(): FunnelDashboardData {
    const { opportunities, stages, getFunnelMetrics } = useCRMStore.getState();
    const metrics = getFunnelMetrics();
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter active opportunities
    const activeOpps = opportunities.filter(o => {
        const stage = stages.find(s => s.id === o.stageId);
        return !stage?.isClosedStage;
    });

    // Stage data with percentages
    const totalActive = activeOpps.length || 1;
    const stageData = stages
        .filter(s => !s.isClosedStage)
        .sort((a, b) => a.order - b.order)
        .map(stage => {
            const stageOpps = activeOpps.filter(o => o.stageId === stage.id);
            return {
                id: stage.id,
                name: stage.name,
                color: stage.color,
                count: stageOpps.length,
                value: stageOpps.reduce((sum, o) => sum + o.value, 0),
                percentage: (stageOpps.length / totalActive) * 100,
            };
        });

    // Trends
    const recentOpps = opportunities.filter(o =>
        new Date(o.createdAt) >= thirtyDaysAgo
    );
    const wonLast30Days = opportunities.filter(o => {
        const stage = stages.find(s => s.id === o.stageId);
        return stage?.isWonStage && o.closedAt && new Date(o.closedAt) >= thirtyDaysAgo;
    }).length;
    const lostLast30Days = opportunities.filter(o => {
        const stage = stages.find(s => s.id === o.stageId);
        return stage?.isClosedStage && !stage?.isWonStage && o.closedAt && new Date(o.closedAt) >= thirtyDaysAgo;
    }).length;

    // Top opportunities by weighted value
    const topOpportunities = activeOpps
        .map(o => ({
            id: o.id,
            title: o.title,
            customerName: o.customerName,
            value: o.value,
            probability: o.probability,
            stageName: stages.find(s => s.id === o.stageId)?.name || 'Desconhecido',
        }))
        .sort((a, b) => (b.value * b.probability / 100) - (a.value * a.probability / 100))
        .slice(0, 5);

    // Average deal size
    const closedWon = opportunities.filter(o =>
        stages.find(s => s.id === o.stageId)?.isWonStage
    );
    const avgDealSize = closedWon.length > 0
        ? closedWon.reduce((sum, o) => sum + o.value, 0) / closedWon.length
        : 0;

    return {
        pipelineTotal: metrics.totalValue,
        pipelineCount: activeOpps.length,
        weightedPipeline: metrics.weightedValue,
        winRate: metrics.winRate,
        avgDealSize,
        avgTimeToClose: metrics.avgTimeToClose,
        stageData,
        wonLast30Days,
        lostLast30Days,
        newLast30Days: recentOpps.length,
        topOpportunities,
    };
}
