import api from './client';

// ============================================================================
// Commercial Analytics API
// ============================================================================

export interface CommercialAnalytics {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    marginTrend: number;
    inventoryValue: number;
    inventoryTurnover: number;
    reorderNeeded: number;
    pendingPOs: number;
    overduePOs: number;
    poSpend: number;
    lastMonthMargin: number;
}

export interface MarginByCategory {
    category: string;
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
    qty: number;
}

export interface MarginByProduct {
    id: string;
    name: string;
    code: string;
    category: string;
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
    qty: number;
}

export interface MonthlyMarginTrend {
    month: string;
    revenue: number;
    cogs: number;
    margin: number;
}

export interface MarginAnalysis {
    byCategory: MarginByCategory[];
    byProduct: MarginByProduct[];
    monthlyTrend: MonthlyMarginTrend[];
}

export interface StockAgingProduct {
    id: string;
    name: string;
    code: string;
    category: string;
    currentStock: number;
    stockValue: number;
    potentialRevenue: number;
    daysSinceLastSale: number;
    lastSaleDate: string | null;
    agingBucket: 'fresh' | 'slow' | 'aging' | 'critical';
}

export interface StockAgingReport {
    products: StockAgingProduct[];
    summary: {
        fresh: number;
        slow: number;
        aging: number;
        critical: number;
        totalStockValue: number;
        criticalValue: number;
    };
}

export interface SupplierPerformance {
    id: string;
    name: string;
    code: string;
    contactPerson: string | null;
    phone: string;
    email: string | null;
    totalOrders: number;
    totalSpend: number;
    avgOrderValue: number;
    onTimeRate: number | null;
    pendingOrders: number;
    overdueOrders: number;
    productCount: number;
    lastOrderDate: string | null;
}

export interface PurchaseOrder {
    id: string;
    orderNumber: string;
    supplierId: string;
    total: number;
    status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
    expectedDeliveryDate: string | null;
    receivedDate: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    supplier: { id: string; name: string; code: string; phone: string };
    items: Array<{
        id: string;
        productId: string;
        quantity: number;
        receivedQty: number;
        unitCost: number;
        total: number;
        product: { id: string; name: string; code: string; unit: string };
    }>;
}

export interface InventoryTurnoverItem {
    category: string;
    cogs: number;
    inventoryValue: number;
    turnover: number;
    daysOnHand: number;
}

export interface SalesReport {
    dailySales: Array<{ date: string; revenue: number; count: number }>;
    topProducts: Array<{ product: { id: string; name: string; code: string; category: string } | undefined; revenue: number; qty: number }>;
    paymentMethods: Array<{ method: string; total: number; count: number }>;
}

// ── Accounts Receivable ───────────────────────────────────────────────────────

export interface ReceivableInvoice {
    id: string;
    number: string;
    customer?: { id: string; name: string; phone: string; code: string } | null;
    // flattened fields (fallback)
    customerName?: string;
    customerPhone?: string;
    createdAt: string;
    dueDate: string | null;
    total: number;
    amountPaid: number;
    amountDue: number;
    status: 'sent' | 'partial' | 'overdue';
    daysOverdue: number;
    isOverdue: boolean;
}

export interface AccountsReceivableSummary {
    totalReceivable: number;
    overdueAmount: number;
    invoiceCount: number;
    overdueCount: number;
}

export interface AccountsReceivableResult {
    data: ReceivableInvoice[];
    summary: AccountsReceivableSummary;
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ── Quotations ────────────────────────────────────────────────────────────────

export interface QuotationItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
}

export interface Quotation {
    id: string;
    orderNumber: string;
    customerId: string | null;
    customerName: string;
    customerPhone: string;
    status: string;
    total: number;
    notes: string | null;
    deliveryDate: string | null;
    createdAt: string;
    items: QuotationItem[];
}

export interface CreateQuotationPayload {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    validUntil?: string;
    notes?: string;
    items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        price: number;
    }>;
}

export const commercialAPI = {
    // Analytics & KPIs
    getAnalytics: async (): Promise<CommercialAnalytics> => {
        const res = await api.get('/commercial/analytics');
        return res.data;
    },

    getMargins: async (period: number = 30): Promise<MarginAnalysis> => {
        const res = await api.get('/commercial/margins', { params: { period } });
        return res.data;
    },

    getStockAging: async (): Promise<StockAgingReport> => {
        const res = await api.get('/commercial/stock-aging');
        return res.data;
    },

    getSupplierPerformance: async (): Promise<SupplierPerformance[]> => {
        const res = await api.get('/commercial/supplier-performance');
        return res.data;
    },

    getInventoryTurnover: async (period: number = 90): Promise<InventoryTurnoverItem[]> => {
        const res = await api.get('/commercial/inventory-turnover', { params: { period } });
        return res.data;
    },

    getSalesReport: async (period: number = 30): Promise<SalesReport> => {
        const res = await api.get('/commercial/sales-report', { params: { period } });
        return res.data;
    },

    // Purchase Orders
    listPurchaseOrders: async (params?: {
        status?: string;
        supplierId?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => {
        const res = await api.get('/commercial/purchase-orders', { params });
        return res.data;
    },

    getPurchaseOrderById: async (id: string): Promise<PurchaseOrder> => {
        const res = await api.get(`/commercial/purchase-orders/${id}`);
        return res.data;
    },

    updatePurchaseOrderStatus: async (id: string, status: string): Promise<PurchaseOrder> => {
        const res = await api.patch(`/commercial/purchase-orders/${id}/status`, { status });
        return res.data;
    },

    deletePurchaseOrder: async (id: string) => {
        const res = await api.delete(`/commercial/purchase-orders/${id}`);
        return res.data;
    },

    // Accounts Receivable
    getAccountsReceivable: async (params?: {
        filter?: 'all' | 'overdue' | 'pending';
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<AccountsReceivableResult> => {
        const { filter, ...rest } = params ?? {};
        const res = await api.get('/commercial/accounts-receivable', {
            params: { ...rest, status: filter !== 'all' ? filter : undefined },
        });
        return res.data;
    },

    // Quotations
    listQuotations: async (params?: {
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => {
        const res = await api.get('/commercial/quotations', { params });
        return res.data;
    },

    createQuotation: async (payload: CreateQuotationPayload): Promise<Quotation> => {
        const res = await api.post('/commercial/quotations', payload);
        return res.data;
    },
};

// ── Shift (Turno de Caixa) API ────────────────────────────────────────────────

export interface ShiftSession {
    id: string;
    openedById: string;
    closedById?: string;
    openedAt: string;
    closedAt?: string;
    openingBalance: number;
    closingBalance?: number;
    expectedBalance?: number;
    difference?: number;
    cashSales: number;
    mpesaSales: number;
    emolaSales: number;
    cardSales: number;
    creditSales: number;
    totalSales: number;
    withdrawals: number;
    deposits: number;
    notes?: string;
    status: 'open' | 'closed' | 'suspended';
    companyId?: string;
    terminalId?: string;
    openedBy?: { id: string; name: string };
    closedBy?: { id: string; name: string };
    _count?: { sales: number };
}

export const shiftAPI = {
    getCurrent: async (): Promise<ShiftSession | null> => {
        const res = await api.get('/commercial/shift');
        return res.data;
    },

    getSummary: async (): Promise<ShiftSummary | null> => {
        const res = await api.get('/commercial/shift/summary');
        return res.data;
    },

    open: async (openingBalance: number, terminalId?: string): Promise<ShiftSession> => {
        const res = await api.post('/commercial/shift/open', { openingBalance, terminalId });
        return res.data;
    },

    close: async (closingBalance: number, notes?: string): Promise<ShiftSession> => {
        const res = await api.post('/commercial/shift/close', { closingBalance, notes });
        return res.data;
    },

    getHistory: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; openedById?: string }) => {
        const res = await api.get('/commercial/shift/history', { params });
        return res.data;
    },

    addMovement: async (data: { amount: number; type: 'sangria' | 'suprimento'; reason: string }) => {
        const res = await api.post('/commercial/shift/movement', data);
        return res.data;
    },

    getDetails: async (id: string) => {
        const res = await api.get(`/commercial/shift/${id}`);
        return res.data;
    }
};
