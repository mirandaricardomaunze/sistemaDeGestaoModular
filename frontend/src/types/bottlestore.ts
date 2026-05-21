/**
 * Bottle Store Module Type Definitions
 */

export interface BottleStoreDashboardSummary {
    totalSales: number;
    totalTx: number;
    avgTicket: number;
    totalProfit: number;
    stockValueCost: number;
    stockValueSale: number;
    lowStockCount: number;
    totalProducts: number;
}

export interface BottleStoreDashboardCategory {
    name: string;
    value: number;
}

export interface BottleStoreRecentSale {
    id: string;
    saleNumber?: string;
    receiptNumber?: string;
    total: number;
    createdAt: string;
    customer?: { name: string } | null;
}

export interface BottleStoreRecentMovement {
    id: string;
    quantity: number;
    movementType: string;
    performedBy?: string | null;
    createdAt: string;
    product?: { name: string } | null;
}

export interface BottleStoreDashboard {
    summary: BottleStoreDashboardSummary;
    chartData: Array<{ date: string; amount: number }>;
    categoryData: BottleStoreDashboardCategory[];
    recentActivity: {
        sales: BottleStoreRecentSale[];
        movements: BottleStoreRecentMovement[];
    };
}

export interface BottleReturn {
    id: string;
    customerId: string;
    productId: string;
    quantity: number;
    type: 'deposit' | 'return';
    status: 'pending' | 'completed';
    notes?: string;
    createdAt: string;
    updatedAt: string;
    customer?: { name: string };
    product?: { name: string };
}

export interface CashSession {
    id: string;
    userId: string;
    status: 'open' | 'closed';
    openingBalance: number;
    closingBalance?: number;
    actualBalance?: number;
    difference?: number;
    openedAt: string;
    closedAt?: string;
    notes?: string;
}

export interface CreditSale {
    id: string;
    saleId: string;
    customerId: string;
    totalAmount: number;
    paidAmount: number;
    status: 'pending' | 'partial' | 'paid';
    dueDate: string;
    createdAt: string;
    customer?: { name: string };
}

export interface BottleStoreBatch {
    id: string;
    productId: string;
    batchNumber: string;
    quantity: number;
    expiryDate?: string;
    manufactureDate?: string;
    receivedDate?: string;
    costPrice?: number;
    supplierId?: string;
    notes?: string;
    product?: { name: string } | null;
    daysToExpiry?: number;
}

export interface PriceTier {
    id: string;
    productId: string;
    minQty: number;
    price: number;
    label?: string;
}

export interface ExpiringBatchesResult {
    expiringSoon: BottleStoreBatch[];
    expired: BottleStoreBatch[];
    counts: {
        expiringSoon: number;
        expired: number;
    };
}
