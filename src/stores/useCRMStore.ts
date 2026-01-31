/**
 * CRM Store
 * Gerencia funil de vendas, oportunidades e campanhas
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import { campaignsAPI, crmAPI } from '../services/api';
import type {
    FunnelStage,
    FunnelOpportunity,
    FunnelInteraction,
    FunnelMetrics,
    Campaign,
    CampaignUsage,
    CampaignMetrics,
    CustomerCRMData,
} from '../types/crm';
import { DEFAULT_FUNNEL_STAGES } from '../types/crm';

// ============================================================================
// Store Interface
// ============================================================================

interface CRMState {
    // Funnel Stages
    stages: FunnelStage[];
    addStage: (stage: Omit<FunnelStage, 'id' | 'order'>) => Promise<void>;
    updateStage: (id: string, updates: Partial<FunnelStage>) => Promise<void>;
    deleteStage: (id: string) => Promise<void>;
    reorderStages: (stageIds: string[]) => Promise<void>;

    // Opportunities
    opportunities: FunnelOpportunity[];
    addOpportunity: (opportunity: Omit<FunnelOpportunity, 'id' | 'createdAt' | 'updatedAt' | 'stageChangedAt' | 'interactions' | 'stageHistory'>) => Promise<FunnelOpportunity>;
    updateOpportunity: (id: string, updates: Partial<FunnelOpportunity>) => Promise<void>;
    deleteOpportunity: (id: string) => Promise<void>;
    moveOpportunityToStage: (opportunityId: string, newStageId: string, reason?: string, userId?: string) => Promise<void>;
    closeOpportunity: (opportunityId: string, won: boolean, reason: string, invoiceId?: string) => Promise<void>;

    // Interactions
    addInteraction: (opportunityId: string, interaction: Omit<FunnelInteraction, 'id' | 'opportunityId' | 'createdAt'>) => Promise<void>;

    // Automation
    autoMoveOnInvoice: (customerId: string, invoiceId: string) => void;

    // Metrics
    getFunnelMetrics: (dateRange?: { start: string; end: string }) => FunnelMetrics;
    getOpportunitiesByStage: (stageId: string) => FunnelOpportunity[];

    // Campaigns
    campaigns: Campaign[];
    addCampaign: (campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'currentUses' | 'metrics'>) => Campaign;
    updateCampaign: (id: string, updates: Partial<Campaign>) => void;
    deleteCampaign: (id: string) => void;
    activateCampaign: (id: string) => void;
    pauseCampaign: (id: string) => void;
    endCampaign: (id: string) => void;

    // Campaign Usage
    campaignUsages: CampaignUsage[];
    recordCampaignUsage: (usage: Omit<CampaignUsage, 'id' | 'usedAt'>) => void;

    // Campaign Queries
    getActiveCampaignsForCustomer: (customerId: string, customerData?: Partial<CustomerCRMData>) => Campaign[];
    getCampaignDiscount: (campaignId: string, orderAmount: number) => number;
    getCampaignMetrics: (campaignId: string) => CampaignMetrics;

    // Database Sync
    loadCampaignsFromDatabase: () => Promise<void>;
    loadFunnelFromDatabase: () => Promise<void>;
    isSyncingCampaigns: boolean;
    isSyncingFunnel: boolean;

    // Customer CRM Data
    customerCRMData: CustomerCRMData[];
    updateCustomerCRMData: (customerId: string, data: Partial<CustomerCRMData>) => void;
    getCustomerCRMData: (customerId: string) => CustomerCRMData | undefined;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useCRMStore = create<CRMState>()(
    persist(
        (set, get) => ({
            // ============================================================
            // Database Sync
            // ============================================================
            isSyncingFunnel: false,

            loadFunnelFromDatabase: async () => {
                set({ isSyncingFunnel: true });
                try {
                    // Load Stages
                    const stagesData = await crmAPI.getStages();
                    if (stagesData && Array.isArray(stagesData)) {
                        set({ stages: stagesData });
                    } else if (!stagesData || stagesData.length === 0) {
                        // If no stages in DB, initialize with defaults
                        for (const stage of DEFAULT_FUNNEL_STAGES) {
                            await crmAPI.createStage(stage);
                        }
                        const reloadedStages = await crmAPI.getStages();
                        set({ stages: reloadedStages });
                    }

                    // Load Opportunities
                    const oppsData = await crmAPI.getOpportunities();
                    if (oppsData && Array.isArray(oppsData)) {
                        // Transform Decimals and dates
                        const opportunities: FunnelOpportunity[] = oppsData.map((o: any) => ({
                            id: o.id,
                            title: o.title,
                            description: o.description,
                            value: Number(o.value),
                            probability: o.probability,
                            customerId: o.customerId,
                            customerName: o.customer?.name || 'Cliente Desconhecido',
                            stageId: o.stageId,
                            stageType: o.stageType as any,
                            expectedCloseDate: o.expectedCloseDate,
                            closedAt: o.closedAt,
                            closedReason: o.closedReason,
                            invoiceId: o.invoiceId,
                            userId: o.userId,
                            notes: o.notes,
                            tags: o.tags,
                            createdAt: o.createdAt,
                            updatedAt: o.updatedAt,
                            stageChangedAt: o.stageChangedAt,
                            interactions: o.interactions || [],
                            stageHistory: o.stageHistory || [],
                        }));
                        set({ opportunities });
                    }
                } catch (error) {
                    console.error('Failed to load funnel from database:', error);
                } finally {
                    set({ isSyncingFunnel: false });
                }
            },

            // ============================================================
            // Funnel Stages
            // ============================================================
            stages: DEFAULT_FUNNEL_STAGES,

            addStage: async (stageData) => {
                const stages = get().stages;
                const newStage: FunnelStage = {
                    ...stageData,
                    id: generateId(),
                    order: stages.length + 1,
                };

                // Local update
                set({ stages: [...stages, newStage] });

                // Sync
                try {
                    await crmAPI.createStage(newStage);
                } catch (error) {
                    console.error('Failed to sync stage to database:', error);
                }
            },

            updateStage: async (id, updates) => {
                // Local update
                set((state) => ({
                    stages: state.stages.map((s) =>
                        s.id === id ? { ...s, ...updates } : s
                    ),
                }));

                // Sync
                try {
                    await crmAPI.updateStage(id, updates);
                } catch (error) {
                    console.error('Failed to update stage in database:', error);
                }
            },

            deleteStage: async (id) => {
                // Local update
                set((state) => ({
                    stages: state.stages.filter((s) => s.id !== id),
                }));

                // Sync
                try {
                    await crmAPI.deleteStage(id);
                } catch (error) {
                    console.error('Failed to delete stage from database:', error);
                }
            },

            reorderStages: async (stageIds) => {
                const updatedStages = stageIds.map((id, index) => {
                    const stage = get().stages.find((s) => s.id === id);
                    return stage ? { ...stage, order: index + 1 } : null;
                }).filter(Boolean) as FunnelStage[];

                // Local update
                set({ stages: updatedStages });

                // Sync each stage order
                try {
                    const promises = updatedStages.map(s => crmAPI.updateStage(s.id, { order: s.order }));
                    await Promise.all(promises);
                } catch (error) {
                    console.error('Failed to sync stage reordering:', error);
                }
            },

            // ============================================================
            // Opportunities
            // ============================================================
            opportunities: [],

            addOpportunity: async (data) => {
                const now = new Date().toISOString();
                const newOpportunity: FunnelOpportunity = {
                    ...data,
                    id: generateId(),
                    createdAt: now,
                    updatedAt: now,
                    stageChangedAt: now,
                    interactions: [],
                    stageHistory: [],
                };

                // Local update
                set((state) => ({
                    opportunities: [...state.opportunities, newOpportunity],
                }));

                // Sync
                try {
                    await crmAPI.createOpportunity(newOpportunity);
                } catch (error) {
                    console.error('Failed to sync opportunity to database:', error);
                }

                return newOpportunity;
            },

            updateOpportunity: async (id, updates) => {
                // Local update
                set((state) => ({
                    opportunities: state.opportunities.map((o) =>
                        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
                    ),
                }));

                // Sync
                try {
                    await crmAPI.updateOpportunity(id, updates);
                } catch (error) {
                    console.error('Failed to update opportunity in database:', error);
                }
            },

            deleteOpportunity: async (id) => {
                // Local update
                set((state) => ({
                    opportunities: state.opportunities.filter((o) => o.id !== id),
                }));

                // Sync
                try {
                    await crmAPI.deleteOpportunity(id);
                } catch (error) {
                    console.error('Failed to delete opportunity from database:', error);
                }
            },

            moveOpportunityToStage: async (opportunityId, newStageId, reason, userId = 'system') => {
                const { stages, opportunities } = get();
                const opportunity = opportunities.find((o) => o.id === opportunityId);
                const newStage = stages.find((s) => s.id === newStageId);
                const oldStage = stages.find((s) => s.id === opportunity?.stageId);

                if (!opportunity || !newStage) return;

                const now = new Date().toISOString();
                const timeInPreviousStage = Math.ceil(
                    (new Date().getTime() - new Date(opportunity.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
                );

                const historyEntry = {
                    id: generateId(),
                    fromStageId: opportunity.stageId,
                    fromStageName: oldStage?.name || 'Desconhecido',
                    toStageId: newStageId,
                    toStageName: newStage.name,
                    changedAt: now,
                    changedBy: userId,
                    reason,
                    timeInPreviousStage,
                };

                // Local update
                set((state) => ({
                    opportunities: state.opportunities.map((o) =>
                        o.id === opportunityId
                            ? {
                                ...o,
                                stageId: newStageId,
                                stageType: newStage.type,
                                stageChangedAt: now,
                                updatedAt: now,
                                closedAt: newStage.isClosedStage ? now : undefined,
                                stageHistory: [...o.stageHistory, historyEntry],
                            }
                            : o
                    ),
                }));

                // Sync
                try {
                    await crmAPI.moveOpportunity(opportunityId, newStageId, reason);
                } catch (error) {
                    console.error('Failed to sync opportunity move to database:', error);
                }
            },

            closeOpportunity: async (opportunityId, won, reason, invoiceId) => {
                const { stages } = get();
                const targetStage = stages.find((s) =>
                    s.isClosedStage && s.isWonStage === won
                );

                if (!targetStage) return;

                await get().moveOpportunityToStage(opportunityId, targetStage.id, reason);

                if (invoiceId) {
                    await get().updateOpportunity(opportunityId, {
                        invoiceId,
                        closedReason: reason,
                    });
                }
            },

            // ============================================================
            // Interactions
            // ============================================================
            addInteraction: async (opportunityId, interactionData) => {
                const now = new Date().toISOString();
                const newInteraction: FunnelInteraction = {
                    ...interactionData,
                    id: generateId(),
                    opportunityId,
                    createdAt: now,
                };

                // Local update
                set((state) => ({
                    opportunities: state.opportunities.map((o) =>
                        o.id === opportunityId
                            ? {
                                ...o,
                                interactions: [...o.interactions, newInteraction],
                                updatedAt: now,
                            }
                            : o
                    ),
                }));

                // Sync
                try {
                    await crmAPI.addInteraction(opportunityId, interactionData);
                } catch (error) {
                    console.error('Failed to sync interaction to database:', error);
                }
            },

            // ============================================================
            // Automation
            // ============================================================
            autoMoveOnInvoice: (customerId, invoiceId) => {
                const { opportunities, stages } = get();
                const wonStage = stages.find((s) => s.autoMoveOnInvoice && s.isWonStage);

                if (!wonStage) return;

                // Find active opportunity for customer
                const activeOpportunity = opportunities.find(
                    (o) => o.customerId === customerId && !stages.find((s) => s.id === o.stageId)?.isClosedStage
                );

                if (activeOpportunity) {
                    get().closeOpportunity(
                        activeOpportunity.id,
                        true,
                        'Fechado automaticamente - Fatura emitida',
                        invoiceId
                    );
                }
            },

            // ============================================================
            // Metrics
            // ============================================================
            getFunnelMetrics: (dateRange) => {
                const { opportunities, stages } = get();

                let filteredOpps = opportunities;
                if (dateRange) {
                    filteredOpps = opportunities.filter(
                        (o) => o.createdAt >= dateRange.start && o.createdAt <= dateRange.end
                    );
                }

                const totalOpportunities = filteredOpps.length;
                const totalValue = filteredOpps.reduce((sum, o) => sum + o.value, 0);
                const weightedValue = filteredOpps.reduce((sum, o) => sum + (o.value * o.probability / 100), 0);

                // By Stage
                const byStage = stages.map((stage) => {
                    const stageOpps = filteredOpps.filter((o) => o.stageId === stage.id);
                    const avgTime = stageOpps.length > 0
                        ? stageOpps.reduce((sum, o) => {
                            const history = o.stageHistory.find((h) => h.fromStageId === stage.id);
                            return sum + (history?.timeInPreviousStage || 0);
                        }, 0) / stageOpps.length
                        : 0;

                    return {
                        stageId: stage.id,
                        stageName: stage.name,
                        count: stageOpps.length,
                        value: stageOpps.reduce((sum, o) => sum + o.value, 0),
                        avgTimeInStage: Math.round(avgTime * 10) / 10,
                    };
                });

                // Win Rate
                const closedOpps = filteredOpps.filter((o) =>
                    stages.find((s) => s.id === o.stageId)?.isClosedStage
                );
                const wonOpps = closedOpps.filter((o) =>
                    stages.find((s) => s.id === o.stageId)?.isWonStage
                );
                const winRate = closedOpps.length > 0
                    ? (wonOpps.length / closedOpps.length) * 100
                    : 0;

                // Avg Time to Close
                const closedWithHistory = closedOpps.filter((o) => o.closedAt);
                const avgTimeToClose = closedWithHistory.length > 0
                    ? closedWithHistory.reduce((sum, o) => {
                        const days = Math.ceil(
                            (new Date(o.closedAt!).getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return sum + days;
                    }, 0) / closedWithHistory.length
                    : 0;

                // Loss Reasons
                const lostOpps = closedOpps.filter((o) =>
                    !stages.find((s) => s.id === o.stageId)?.isWonStage
                );
                const reasonCounts: Record<string, number> = {};
                lostOpps.forEach((o) => {
                    const reason = o.closedReason || 'Não especificado';
                    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                });
                const lossReasons = Object.entries(reasonCounts).map(([reason, count]) => ({
                    reason,
                    count,
                }));

                return {
                    totalOpportunities,
                    totalValue,
                    weightedValue,
                    byStage,
                    conversionRates: [], // TODO: Calculate stage-to-stage conversion
                    avgTimeToClose: Math.round(avgTimeToClose * 10) / 10,
                    winRate: Math.round(winRate * 10) / 10,
                    lossReasons,
                };
            },

            getOpportunitiesByStage: (stageId) => {
                return get().opportunities.filter((o) => o.stageId === stageId);
            },

            // ============================================================
            // Campaigns - WITH DATABASE INTEGRATION
            // ============================================================
            campaigns: [],
            isSyncingCampaigns: false,

            loadCampaignsFromDatabase: async () => {
                set({ isSyncingCampaigns: true });
                try {
                    const data = await campaignsAPI.getAll();
                    if (data && Array.isArray(data)) {
                        // Transform backend data to store format
                        const campaigns: Campaign[] = data.map((c: any) => ({
                            id: c.id,
                            name: c.name,
                            description: c.description,
                            code: c.code,
                            status: c.status as any,
                            startDate: c.startDate,
                            endDate: c.endDate,
                            discountType: c.discountType as any,
                            discountValue: Number(c.discountValue),
                            minPurchaseAmount: c.minPurchaseAmount ? Number(c.minPurchaseAmount) : undefined,
                            maxDiscountAmount: c.maxDiscountAmount ? Number(c.maxDiscountAmount) : undefined,
                            maxTotalUses: c.maxTotalUses,
                            currentUses: c.currentUses || 0,
                            applyToAllProducts: c.applyToAllProducts ?? true,
                            targetAudience: c.targetAudience || { allCustomers: true },
                            createdAt: c.createdAt,
                            updatedAt: c.updatedAt,
                            createdBy: c.createdBy,
                            metrics: {
                                customersTargeted: 0,
                                customersReached: 0,
                                totalSales: 0,
                                totalDiscount: 0,
                                ordersGenerated: 0,
                                avgOrderValue: 0,
                                responseRate: 0,
                                roi: 0,
                            },
                        }));
                        set({ campaigns });
                    }
                } catch (error) {
                    console.error('Failed to load campaigns from database:', error);
                } finally {
                    set({ isSyncingCampaigns: false });
                }
            },

            addCampaign: (data) => {
                const now = new Date().toISOString();
                const newCampaign: Campaign = {
                    ...data,
                    id: generateId(),
                    createdAt: now,
                    updatedAt: now,
                    currentUses: 0,
                    metrics: {
                        customersTargeted: 0,
                        customersReached: 0,
                        totalSales: 0,
                        totalDiscount: 0,
                        ordersGenerated: 0,
                        avgOrderValue: 0,
                        responseRate: 0,
                        roi: 0,
                    },
                };

                // Add to local state
                set((state) => ({
                    campaigns: [...state.campaigns, newCampaign],
                }));

                // Sync to database
                campaignsAPI.create({
                    name: data.name,
                    description: data.description,
                    code: data.code,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    discountType: data.discountType,
                    discountValue: data.discountValue,
                    minPurchaseAmount: data.minPurchaseAmount,
                    maxDiscountAmount: data.maxDiscountAmount,
                    maxTotalUses: data.maxTotalUses,
                }).catch(error => {
                    console.error('Failed to sync campaign to database:', error);
                });

                return newCampaign;
            },

            updateCampaign: (id, updates) => {
                set((state) => ({
                    campaigns: state.campaigns.map((c) =>
                        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
                    ),
                }));

                // Sync to database
                campaignsAPI.update(id, updates as any).catch(error => {
                    console.error('Failed to sync campaign update to database:', error);
                });
            },

            deleteCampaign: (id) => {
                set((state) => ({
                    campaigns: state.campaigns.filter((c) => c.id !== id),
                }));

                // Sync to database
                campaignsAPI.delete(id).catch(error => {
                    console.error('Failed to delete campaign from database:', error);
                });
            },

            activateCampaign: (id) => {
                get().updateCampaign(id, { status: 'active' });
            },

            pauseCampaign: (id) => {
                get().updateCampaign(id, { status: 'paused' });
            },

            endCampaign: (id) => {
                get().updateCampaign(id, { status: 'ended' });
            },

            // ============================================================
            // Campaign Usage
            // ============================================================
            campaignUsages: [],

            recordCampaignUsage: (usageData) => {
                const now = new Date().toISOString();
                const usage: CampaignUsage = {
                    ...usageData,
                    id: generateId(),
                    usedAt: now,
                };

                set((state) => ({
                    campaignUsages: [...state.campaignUsages, usage],
                    campaigns: state.campaigns.map((c) =>
                        c.id === usageData.campaignId
                            ? {
                                ...c,
                                currentUses: c.currentUses + 1,
                                metrics: {
                                    ...c.metrics,
                                    customersReached: c.metrics.customersReached + 1,
                                    totalSales: c.metrics.totalSales + usageData.orderAmount,
                                    totalDiscount: c.metrics.totalDiscount + usageData.discountApplied,
                                    ordersGenerated: c.metrics.ordersGenerated + 1,
                                },
                            }
                            : c
                    ),
                }));
            },

            // ============================================================
            // Campaign Queries
            // ============================================================
            getActiveCampaignsForCustomer: (customerId, customerData) => {
                const { campaigns } = get();
                const now = new Date().toISOString();

                return campaigns.filter((campaign) => {
                    // Check status
                    if (campaign.status !== 'active') return false;

                    // Check dates
                    if (campaign.startDate > now || campaign.endDate < now) return false;

                    // Check usage limits
                    if (campaign.maxTotalUses && campaign.currentUses >= campaign.maxTotalUses) return false;

                    // Check segmentation
                    const seg = campaign.targetAudience;
                    if (seg.allCustomers) return true;

                    // Check specific includes/excludes
                    if (seg.excludeCustomerIds?.includes(customerId)) return false;
                    if (seg.includeCustomerIds?.length && !seg.includeCustomerIds.includes(customerId)) return false;

                    // If we have customer data, check other criteria
                    if (customerData) {
                        if (seg.customerCategories?.length &&
                            !seg.customerCategories.includes(customerData.category!)) return false;

                        if (seg.minCreditLimit && (customerData.creditLimit || 0) < seg.minCreditLimit) return false;
                        if (seg.maxCreditLimit && (customerData.creditLimit || 0) > seg.maxCreditLimit) return false;

                        if (seg.minTotalPurchases && (customerData.totalPurchases || 0) < seg.minTotalPurchases) return false;

                        if (seg.cities?.length && !seg.cities.includes(customerData.city || '')) return false;
                        if (seg.provinces?.length && !seg.provinces.includes(customerData.province || '')) return false;

                        if (seg.customerTags?.length) {
                            const hasMatchingTag = seg.customerTags.some((tag) =>
                                customerData.tags?.includes(tag)
                            );
                            if (!hasMatchingTag) return false;
                        }
                    }

                    return true;
                });
            },

            getCampaignDiscount: (campaignId, orderAmount) => {
                const campaign = get().campaigns.find((c) => c.id === campaignId);
                if (!campaign) return 0;

                // Check minimum purchase
                if (campaign.minPurchaseAmount && orderAmount < campaign.minPurchaseAmount) return 0;

                let discount = 0;

                switch (campaign.discountType) {
                    case 'percentage':
                        discount = orderAmount * (campaign.discountValue / 100);
                        break;
                    case 'fixed':
                        discount = campaign.discountValue;
                        break;
                    case 'free_shipping':
                        // This would be handled differently in checkout
                        discount = 0;
                        break;
                    case 'buy_x_get_y':
                        // This would need product-level logic
                        discount = 0;
                        break;
                }

                // Apply max discount cap
                if (campaign.maxDiscountAmount && discount > campaign.maxDiscountAmount) {
                    discount = campaign.maxDiscountAmount;
                }

                return Math.round(discount * 100) / 100;
            },

            getCampaignMetrics: (campaignId) => {
                const campaign = get().campaigns.find((c) => c.id === campaignId);
                if (!campaign) {
                    return {
                        customersTargeted: 0,
                        customersReached: 0,
                        totalSales: 0,
                        totalDiscount: 0,
                        ordersGenerated: 0,
                        avgOrderValue: 0,
                        responseRate: 0,
                        roi: 0,
                    };
                }

                const usages = get().campaignUsages.filter((u) => u.campaignId === campaignId);
                const totalSales = usages.reduce((sum, u) => sum + u.orderAmount, 0);
                const totalDiscount = usages.reduce((sum, u) => sum + u.discountApplied, 0);

                return {
                    ...campaign.metrics,
                    totalSales,
                    totalDiscount,
                    ordersGenerated: usages.length,
                    avgOrderValue: usages.length > 0 ? totalSales / usages.length : 0,
                    responseRate: campaign.metrics.customersTargeted > 0
                        ? (usages.length / campaign.metrics.customersTargeted) * 100
                        : 0,
                    roi: totalDiscount > 0 ? ((totalSales - totalDiscount) / totalDiscount) * 100 : 0,
                };
            },

            // ============================================================
            // Customer CRM Data
            // ============================================================
            customerCRMData: [],

            updateCustomerCRMData: (customerId, data) => {
                set((state) => {
                    const existing = state.customerCRMData.find((c) => c.customerId === customerId);
                    if (existing) {
                        return {
                            customerCRMData: state.customerCRMData.map((c) =>
                                c.customerId === customerId ? { ...c, ...data } : c
                            ),
                        };
                    } else {
                        const newData: CustomerCRMData = {
                            customerId,
                            category: 'regular',
                            creditLimit: 0,
                            currentCredit: 0,
                            creditTermsDays: 30,
                            tags: [],
                            totalPurchases: 0,
                            totalPurchaseCount: 0,
                            avgOrderValue: 0,
                            activeCampaignIds: [],
                            campaignHistory: [],
                            ...data,
                        };
                        return {
                            customerCRMData: [...state.customerCRMData, newData],
                        };
                    }
                });
            },

            getCustomerCRMData: (customerId) => {
                return get().customerCRMData.find((c) => c.customerId === customerId);
            },
        }),
        {
            name: 'crm-storage',
            version: 2,
            migrate: (persistedState: unknown) => {
                const state = persistedState as CRMState;
                return state;
            },
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Load data from database after rehydration
                    setTimeout(() => {
                        state.loadCampaignsFromDatabase();
                        state.loadFunnelFromDatabase();
                    }, 800);
                }
            },
        }
    )
);

