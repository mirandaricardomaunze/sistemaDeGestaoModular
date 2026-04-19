/**
 * CRM Types
 * Tipos para o sistema de CRM, funil de vendas e campanhas
 */

// ============================================================================
// Sales Funnel Types
// ============================================================================

// Funnel Stages
export type FunnelStageType =
    | 'lead'           // Lead - Potencial cliente
    | 'contact'        // Contato - Em contacto
    | 'proposal'       // Proposta - Proposta enviada
    | 'negotiation'    // Negociação - Em negociação
    | 'closed_won'     // Fechado Ganho
    | 'closed_lost';   // Fechado Perdido

export interface FunnelStage {
    id: string;
    type: FunnelStageType;
    name: string;
    description?: string;
    color: string;
    order: number;
    isActive: boolean;
    isClosedStage: boolean;
    isWonStage?: boolean;
    autoMoveOnInvoice?: boolean; // Auto move to closed_won when invoice issued
}

// Customer in Funnel (Opportunity)
export interface FunnelOpportunity {
    id: string;
    customerId: string;
    customerName: string;
    stageId: string;
    stageType: FunnelStageType;
    title: string;
    value: number; // Expected value
    probability: number; // 0-100%
    expectedCloseDate?: string;

    // Tracking
    createdAt: string;
    updatedAt: string;
    stageChangedAt: string;
    closedAt?: string;
    closedReason?: string;

    // History
    interactions: FunnelInteraction[];
    stageHistory: StageHistoryEntry[];

    // Owner/Assignment
    ownerId?: string;
    ownerName?: string;

    // Related
    invoiceId?: string;
    orderId?: string;

    // Tags and notes
    tags: string[];
    notes?: string;

    // Source
    source?: 'direct' | 'referral' | 'campaign' | 'website' | 'phone' | 'other';
    sourceDetails?: string;
}

export interface FunnelInteraction {
    id: string;
    opportunityId: string;
    type: 'call' | 'email' | 'meeting' | 'note' | 'proposal' | 'follow_up' | 'other';
    title: string;
    description?: string;
    date: string;
    duration?: number; // in minutes
    outcome?: 'positive' | 'neutral' | 'negative';
    nextAction?: string;
    nextActionDate?: string;
    createdBy: string;
    createdAt: string;
}

export interface StageHistoryEntry {
    id: string;
    fromStageId: string;
    fromStageName: string;
    toStageId: string;
    toStageName: string;
    changedAt: string;
    changedBy: string;
    reason?: string;
    timeInPreviousStage: number; // in days
}

// Funnel Metrics
export interface FunnelMetrics {
    totalOpportunities: number;
    totalValue: number;
    weightedValue: number; // value * probability
    byStage: {
        stageId: string;
        stageName: string;
        count: number;
        value: number;
        avgTimeInStage: number; // days
    }[];
    conversionRates: {
        fromStage: string;
        toStage: string;
        rate: number; // percentage
    }[];
    avgTimeToClose: number; // days
    winRate: number; // percentage
    lossReasons: { reason: string; count: number }[];
}

// ============================================================================
// Campaign Types
// ============================================================================

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'cancelled';
export type DiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';

export interface Campaign {
    id: string;
    name: string;
    description?: string;
    code?: string; // Optional promo code

    // Status and Dates
    status: CampaignStatus;
    startDate: string;
    endDate: string;

    // Discount Configuration
    discountType: DiscountType;
    discountValue: number; // Percentage or fixed amount
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;

    // For buy_x_get_y
    buyQuantity?: number;
    getQuantity?: number;
    getProductIds?: string[];

    // Target Audience (Segmentation)
    targetAudience: CampaignSegmentation;

    // Usage Limits
    maxTotalUses?: number;
    maxUsesPerCustomer?: number;
    currentUses: number;

    // Applicable Products
    applyToAllProducts: boolean;
    productIds?: string[];
    categoryIds?: string[];
    excludeProductIds?: string[];

    // Tracking
    createdAt: string;
    updatedAt: string;
    createdBy: string;

    // Results
    metrics: CampaignMetrics;
}

export interface CampaignSegmentation {
    allCustomers: boolean;

    // Customer Categories
    customerCategories?: string[];

    // Purchase History
    minTotalPurchases?: number;
    maxTotalPurchases?: number;
    minPurchaseCount?: number;
    maxPurchaseCount?: number;
    lastPurchaseWithinDays?: number;
    noPurchaseSinceDays?: number;

    // Location
    cities?: string[];
    provinces?: string[];

    // Credit
    minCreditLimit?: number;
    maxCreditLimit?: number;

    // Specific Customers
    includeCustomerIds?: string[];
    excludeCustomerIds?: string[];

    // Funnel Stage
    funnelStages?: FunnelStageType[];

    // Tags
    customerTags?: string[];
}

export interface CampaignMetrics {
    customersTargeted: number;
    customersReached: number;
    totalSales: number;
    totalDiscount: number;
    ordersGenerated: number;
    avgOrderValue: number;
    responseRate: number; // percentage
    roi: number; // Return on investment
}

export interface CampaignUsage {
    id: string;
    campaignId: string;
    customerId: string;
    customerName: string;
    orderId?: string;
    invoiceId?: string;
    orderAmount: number;
    discountApplied: number;
    usedAt: string;
}

// ============================================================================
// Customer Extensions for CRM
// ============================================================================

export type CustomerCategory = 'regular' | 'vip' | 'wholesale' | 'retail' | 'corporate' | 'prospect';

export interface CustomerCRMData {
    customerId: string;

    // Category
    category: CustomerCategory;

    // Credit
    creditLimit: number;
    currentCredit: number;
    creditTermsDays: number;

    // Location
    city?: string;
    province?: string;

    // Tags
    tags: string[];

    // Purchase History Summary
    totalPurchases: number;
    totalPurchaseCount: number;
    lastPurchaseDate?: string;
    avgOrderValue: number;

    // Funnel
    currentOpportunityId?: string;

    // Campaigns
    activeCampaignIds: string[];
    campaignHistory: string[];
}

// ============================================================================
// Default Stages
// ============================================================================

export const DEFAULT_FUNNEL_STAGES: FunnelStage[] = [
    {
        id: 'stage-lead',
        type: 'lead',
        name: 'Lead',
        description: 'Potencial cliente identificado',
        color: '#6B7280',
        order: 1,
        isActive: true,
        isClosedStage: false,
    },
    {
        id: 'stage-contact',
        type: 'contact',
        name: 'Contacto',
        description: 'Em processo de contacto',
        color: '#3B82F6',
        order: 2,
        isActive: true,
        isClosedStage: false,
    },
    {
        id: 'stage-proposal',
        type: 'proposal',
        name: 'Proposta',
        description: 'Proposta enviada ao cliente',
        color: '#8B5CF6',
        order: 3,
        isActive: true,
        isClosedStage: false,
    },
    {
        id: 'stage-negotiation',
        type: 'negotiation',
        name: 'Negociação',
        description: 'Em negociação de termos',
        color: '#F59E0B',
        order: 4,
        isActive: true,
        isClosedStage: false,
    },
    {
        id: 'stage-closed-won',
        type: 'closed_won',
        name: 'Fechado Ganho',
        description: 'Negócio concluído com sucesso',
        color: '#10B981',
        order: 5,
        isActive: true,
        isClosedStage: true,
        isWonStage: true,
        autoMoveOnInvoice: true,
    },
    {
        id: 'stage-closed-lost',
        type: 'closed_lost',
        name: 'Fechado Perdido',
        description: 'Negócio não concretizado',
        color: '#EF4444',
        order: 6,
        isActive: true,
        isClosedStage: true,
        isWonStage: false,
    },
];

// ============================================================================
// Labels and Config
// ============================================================================

export const STAGE_LABELS: Record<FunnelStageType, string> = {
    lead: 'Lead',
    contact: 'Contacto',
    proposal: 'Proposta',
    negotiation: 'Negociação',
    closed_won: 'Fechado Ganho',
    closed_lost: 'Fechado Perdido',
};

export const INTERACTION_TYPE_LABELS: Record<FunnelInteraction['type'], string> = {
    call: 'Chamada',
    email: 'Email',
    meeting: 'Reunião',
    note: 'Nota',
    proposal: 'Proposta',
    follow_up: 'Follow-up',
    other: 'Outro',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
    draft: 'Rascunho',
    scheduled: 'Agendada',
    active: 'Ativa',
    paused: 'Pausada',
    ended: 'Terminada',
    cancelled: 'Cancelada',
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
    percentage: 'Percentagem',
    fixed: 'Valor Fixo',
    free_shipping: 'Frete Grátis',
    buy_x_get_y: 'Compre X Leve Y',
};

export const CUSTOMER_CATEGORY_LABELS: Record<CustomerCategory, string> = {
    regular: 'Regular',
    vip: 'VIP',
    wholesale: 'Grossista',
    retail: 'Retalho',
    corporate: 'Corporativo',
    prospect: 'Prospecto',
};

export const SOURCE_LABELS: Record<NonNullable<FunnelOpportunity['source']>, string> = {
    direct: 'Directo',
    referral: 'Indicação',
    campaign: 'Campanha',
    website: 'Website',
    phone: 'Telefone',
    other: 'Outro',
};
