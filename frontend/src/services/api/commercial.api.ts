import api from './client';
import { commercialAnalyticsSchema, purchaseOrderSchema } from '../../lib/validation';
import { logger } from '../../utils/logger';

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

export interface WarehouseDistribution {
    id: string;
    name: string;
    location: string | null;
    valuation: number;
    volume: number;
    productCount: number;
    topProducts: Array<{
        id: string;
        name: string;
        code: string;
        quantity: number;
        value: number;
    }>;
    [key: string]: unknown;
}

export interface InventoryForecast {
    productId: string;
    productName: string;
    productCode: string;
    currentStock: number;
    minStock: number;
    history: number[];
    forecasted30d: number;
    confidence: number;
    status: 'stable' | 'low_risk' | 'high_risk' | 'critical';
    suggestedPurchase: number;
    reasoning: string;
    supplierId?: string;
    costPrice: number;
    [key: string]: unknown;
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
        barcode?: string | null;
    }>;
}

// Commercial Finance

export type CommercialTransactionType = 'income' | 'expense';
export type CommercialTransactionStatus = 'pending' | 'completed' | 'cancelled';
export type CommercialTransactionPaymentMethod =
    | 'cash'
    | 'card'
    | 'mpesa'
    | 'emola'
    | 'transfer'
    | 'bank_transfer'
    | 'credit';

export interface CommercialFinanceSummary {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    transactionCount: number;
}

export interface CommercialFinanceDashboard {
    summary: CommercialFinanceSummary;
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
    monthlyTrend: Array<{
        month: string;
        revenue: number;
        expense: number;
        profit: number;
    }>;
}

export interface PurchaseOrdersListResult {
    data: PurchaseOrder[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CommercialTransaction {
    id: string;
    type: CommercialTransactionType;
    category: string;
    description: string;
    amount: number;
    date: string;
    dueDate: string | null;
    status: CommercialTransactionStatus;
    paymentMethod: CommercialTransactionPaymentMethod | null;
    reference: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    companyId?: string | null;
    module?: string | null;
}

export interface CommercialTransactionsParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    category?: string;
    type?: CommercialTransactionType;
    search?: string;
    period?: string;
}

export interface CommercialTransactionsResult {
    data: CommercialTransaction[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateCommercialTransactionPayload {
    type: CommercialTransactionType;
    category: string;
    description: string;
    amount: number;
    date: string;
    dueDate?: string | null;
    paymentMethod?: CommercialTransactionPaymentMethod | null;
    reference?: string | null;
    notes?: string | null;
}

export type UpdateCommercialTransactionPayload = Partial<CreateCommercialTransactionPayload>;

// Supplier Invoices

export type SupplierInvoiceStatus = 'registered' | 'partial' | 'paid' | 'cancelled';

export type SupplierPaymentMethod = 'cash' | 'card' | 'pix' | 'transfer' | 'credit' | 'mpesa' | 'emola';

export interface SupplierInvoicePayment {
    id: string;
    supplierInvoiceId: string;
    amount: number;
    method: SupplierPaymentMethod;
    paymentDate: string;
    reference: string | null;
    notes: string | null;
    createdByUserId: string | null;
    createdAt: string;
}

export interface AddSupplierInvoicePaymentPayload {
    amount: number;
    method?: SupplierPaymentMethod;
    paymentDate?: string;
    reference?: string | null;
    notes?: string | null;
    approvalId?: string;
}

export interface SupplierInvoiceItem {
    id: string;
    purchaseOrderItemId: string | null;
    productId: string;
    description: string;
    quantity: number;
    unitCost: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    product?: { id: string; name: string; code: string; unit?: string } | null;
}

export interface SupplierInvoice {
    id: string;
    invoiceNumber: string;
    supplierId: string;
    purchaseOrderId: string | null;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    taxRate: number;
    status: SupplierInvoiceStatus;
    issueDate: string;
    dueDate: string | null;
    paidAt: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    supplier: { id: string; name: string; nuit?: string | null; phone?: string; email?: string | null };
    purchaseOrder: { id: string; orderNumber: string; status: string } | null;
    items: SupplierInvoiceItem[];
    payments?: SupplierInvoicePayment[];
}

export interface CreateSupplierInvoicePayload {
    invoiceNumber: string;
    issueDate?: string;
    dueDate?: string | null;
    taxRate?: number;
    status?: 'registered' | 'paid';
    notes?: string | null;
    items?: Array<{ purchaseOrderItemId: string; quantity: number }>;
}

export interface SupplierInvoicesListParams {
    page?: number;
    limit?: number;
    purchaseOrderId?: string;
    supplierId?: string;
    status?: SupplierInvoiceStatus;
    period?: string;
}

export interface SupplierInvoicesListResult {
    data: SupplierInvoice[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const commercialAPI = {
    // Helper to normalize empty warehouseId
    _normalizeWarehouseId: (id?: string) => (id === '' ? undefined : id),

    // Analytics & KPIs
    getAnalytics: async (warehouseId?: string): Promise<CommercialAnalytics> => {
        const id = commercialAPI._normalizeWarehouseId(warehouseId);
        const res = await api.get('/commercial/analytics', { params: { warehouseId: id } });
        
        // Soft Validation
        const validation = commercialAnalyticsSchema.safeParse(res.data);
        if (!validation.success) {
            logger.warn('Validation mismatch in getAnalytics', validation.error.format());
        }
        
        return res.data;
    },

    getMargins: async (period: number = 30, warehouseId?: string): Promise<MarginAnalysis> => {
        const id = commercialAPI._normalizeWarehouseId(warehouseId);
        const res = await api.get('/commercial/margins', { params: { period, warehouseId: id } });
        return res.data;
    },

    invalidateCache: async (): Promise<void> => {
        await api.post('/commercial/cache/invalidate');
    },

    getStockAging: async (warehouseId?: string): Promise<StockAgingReport> => {
        const id = commercialAPI._normalizeWarehouseId(warehouseId);
        const res = await api.get('/commercial/stock-aging', { params: { warehouseId: id } });
        return res.data;
    },

    getSupplierPerformance: async (warehouseId?: string): Promise<SupplierPerformance[]> => {
        const id = commercialAPI._normalizeWarehouseId(warehouseId);
        const res = await api.get('/commercial/supplier-performance', { params: { warehouseId: id } });
        return res.data;
    },

    getInventoryTurnover: async (period: number = 90, warehouseId?: string): Promise<InventoryTurnoverItem[]> => {
        const id = commercialAPI._normalizeWarehouseId(warehouseId);
        const res = await api.get('/commercial/inventory-turnover', { params: { period, warehouseId: id } });
        return res.data;
    },

    getSalesReport: async (period: number = 30, warehouseId?: string): Promise<SalesReport> => {
        const id = commercialAPI._normalizeWarehouseId(warehouseId);
        const res = await api.get('/commercial/sales-report', { params: { period, warehouseId: id } });
        return res.data;
    },

    getWarehouseDistribution: async (): Promise<WarehouseDistribution[]> => {
        const res = await api.get('/commercial/warehouse-distribution');
        return res.data;
    },

    getPredictiveForecast: async (): Promise<InventoryForecast[]> => {
        const res = await api.get('/commercial/predictive/forecast');
        return res.data;
    },

    generateOrdersFromForecast: async (suggestions: Array<{ productId: string; quantity: number }>) => {
        const res = await api.post('/commercial/predictive/create-orders', { suggestions });
        return res.data;
    },

    // Purchase Orders
    listPurchaseOrders: async (params?: {
        status?: string;
        supplierId?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<PurchaseOrdersListResult> => {
        const res = await api.get('/commercial/purchase-orders', { params });
        
        // Soft Validation for list
        // Note: The interceptor might have already unwrapped 'data' if it matches the pattern
        // But here we check the raw response if possible or the unwrapped data
        const validation = purchaseOrderSchema.array().safeParse(res.data);
        if (!validation.success) {
            logger.warn('Validation mismatch in listPurchaseOrders', validation.error.format());
        }
        
        return res.data;
    },

    createPurchaseOrder: async (payload: {
        supplierId: string;
        items: Array<{ productId: string; quantity: number; unitCost: number }>;
        expectedDeliveryDate?: string | null;
        notes?: string | null;
    }): Promise<PurchaseOrder> => {
        const res = await api.post('/commercial/purchase-orders', payload);
        return res.data;
    },

    getPurchaseOrderById: async (id: string): Promise<PurchaseOrder> => {
        const res = await api.get(`/commercial/purchase-orders/${id}`);
        return res.data;
    },

    updatePurchaseOrderStatus: async (id: string, status: string, options?: { warehouseId?: string; approvalId?: string }): Promise<PurchaseOrder> => {
        const res = await api.patch(`/commercial/purchase-orders/${id}/status`, { status, ...options });
        return res.data;
    },

    receivePurchaseOrder: async (
        id: string,
        items: Array<{ itemId: string; receivedQty: number; batchNumber?: string; expiryDate?: string }>,
        warehouseId?: string
    ) => {
        const res = await api.post(`/commercial/purchase-orders/${id}/receive`, { items, warehouseId });
        return res.data;
    },

    deletePurchaseOrder: async (id: string) => {
        const res = await api.delete(`/commercial/purchase-orders/${id}`);
        return res.data;
    },

    // Supplier Invoices
    listSupplierInvoices: async (params?: SupplierInvoicesListParams): Promise<SupplierInvoicesListResult> => {
        const res = await api.get('/commercial/supplier-invoices', { params });
        return res.data;
    },

    getSupplierInvoiceById: async (id: string): Promise<SupplierInvoice> => {
        const res = await api.get(`/commercial/supplier-invoices/${id}`);
        return res.data;
    },

    createSupplierInvoice: async (
        purchaseOrderId: string,
        payload: CreateSupplierInvoicePayload
    ): Promise<SupplierInvoice> => {
        const res = await api.post(`/commercial/purchase-orders/${purchaseOrderId}/supplier-invoices`, payload);
        return res.data;
    },

    updateSupplierInvoiceStatus: async (
        id: string,
        status: 'paid' | 'cancelled'
    ): Promise<SupplierInvoice> => {
        const res = await api.patch(`/commercial/supplier-invoices/${id}/status`, { status });
        return res.data;
    },

    listSupplierInvoicePayments: async (id: string): Promise<SupplierInvoicePayment[]> => {
        const res = await api.get(`/commercial/supplier-invoices/${id}/payments`);
        return res.data;
    },

    addSupplierInvoicePayment: async (
        id: string,
        payload: AddSupplierInvoicePaymentPayload
    ): Promise<SupplierInvoice> => {
        const res = await api.post(`/commercial/supplier-invoices/${id}/payments`, payload);
        return res.data;
    },

    deleteSupplierInvoicePayment: async (
        id: string,
        paymentId: string
    ): Promise<SupplierInvoice> => {
        const res = await api.delete(`/commercial/supplier-invoices/${id}/payments/${paymentId}`);
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

    convertQuotationToInvoice: async (quotationId: string, taxRate?: number) => {
        const res = await api.post(`/commercial/quotations/${quotationId}/convert-to-invoice`, { taxRate });
        return res.data;
    },

    // ── Finance ────────────────────────────────────────────────────────────────
    getFinanceDashboard: async (period?: string): Promise<CommercialFinanceDashboard> => {
        const response = await api.get('/commercial/finance/dashboard', { params: { period } });
        return response.data;
    },
    getTransactions: async (params?: CommercialTransactionsParams): Promise<CommercialTransactionsResult> => {
        const response = await api.get('/commercial/finance/transactions', { params });
        return response.data;
    },
    createTransaction: async (data: CreateCommercialTransactionPayload): Promise<CommercialTransaction> => {
        const response = await api.post('/commercial/finance/transactions', data);
        return response.data;
    },
    updateTransaction: async (id: string, data: UpdateCommercialTransactionPayload): Promise<CommercialTransaction> => {
        const response = await api.put(`/commercial/finance/transactions/${id}`, data);
        return response.data;
    },
    deleteTransaction: async (id: string) => {
        const response = await api.delete(`/commercial/finance/transactions/${id}`);
        return response.data;
    },

    // ── Real-time Stock Reservations ──────────────────────────────────────────
    reserveItem: async (productId: string, quantity: number, sessionId?: string, warehouseId?: string) => {
        const res = await api.post('/commercial/reserve', { productId, quantity, sessionId, warehouseId });
        return res.data;
    },

    releaseItem: async (reservationId: string) => {
        const res = await api.post(`/commercial/release/${reservationId}`);
        return res.data;
    }
};

// ── Shift (Turno de Caixa) API ────────────────────────────────────────────────

export interface ShiftSummary {
    totalSales: number;
    salesCount: number;
    byPaymentMethod: {
        cash: number;
        mpesa: number;
        emola: number;
        card: number;
        credit: number;
    };
}

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
    warehouseId?: string;
    openedBy?: { id: string; name: string };
    closedBy?: { id: string; name: string };
    warehouse?: { id: string; code?: string; name: string; location?: string };
    movements?: Array<{
        id: string;
        type: 'sangria' | 'suprimento' | string;
        amount: number;
        reason: string;
        createdAt: string;
        performedBy?: { id?: string; name: string };
    }>;
    sales?: Array<{
        id: string;
        createdAt: string;
        invoiceNumber?: string;
        receiptNumber?: string;
        paymentMethod?: string;
        customerName?: string;
        subtotal?: number;
        tax?: number;
        total: number;
        customer?: { name: string };
    }>;
    _count?: { sales: number };
    /** Pre-reserved fiscal block returned on shift open — used by the offline POS. */
    fiscalReservation?: {
        seriesId: string;
        series: string;
        prefix: string;
        fromNumber: number;
        toNumber: number;
        nextNumber: number;
    };
    /** Pre-reserved per-product stock buffer returned on shift open. */
    stockReservations?: Array<{ productId: string; quantity: number }>;
}

export interface ShiftZReport {
    session: ShiftSession & { openedByName?: string; closedByName?: string };
    company?: { name?: string; address?: string; phone?: string; nuit?: string };
    byMethod: ShiftSummary['byPaymentMethod'];
    paymentMethods: Array<{ key: string; label: string; amount: number }>;
    cashFlow: {
        openingBalance: number;
        cashSales: number;
        deposits: number;
        withdrawals: number;
        expectedBalance: number;
        closingBalance: number | null;
        difference: number | null;
        requiresReview: boolean;
    };
    totalSales: number;
    totalTax: number;
    totalTransactions: number;
    totalWithdrawals: number;
    totalDeposits: number;
    openingBalance: number;
    expectedBalance: number;
    closingBalance: number;
    difference: number;
    movements: NonNullable<ShiftSession['movements']>;
    topProducts: Array<{ name: string; qty: number; total: number }>;
    sales: NonNullable<ShiftSession['sales']>;
    generatedAt: string;
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

    open: async (openingBalance: number, warehouseId?: string): Promise<ShiftSession> => {
        const res = await api.post('/commercial/shift/open', { openingBalance, warehouseId });
        const session = res.data as ShiftSession;
        if (session?.id) {
            const { saveShiftReservations } = await import('../offline/shiftReservations');
            await saveShiftReservations(session.id, session.fiscalReservation, session.stockReservations).catch(() => {});
        }
        return session;
    },

    close: async (closingBalance: number, notes?: string): Promise<ShiftSession> => {
        const res = await api.post('/commercial/shift/close', { closingBalance, notes });
        const session = res.data as ShiftSession;
        if (session?.id) {
            const { clearShiftReservations } = await import('../offline/shiftReservations');
            await clearShiftReservations(session.id).catch(() => {});
        }
        return session;
    },

    getHistory: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; openedById?: string; warehouseId?: string; search?: string }) => {
        const res = await api.get('/commercial/shift/history', { params });
        return res.data;
    },

    addMovement: async (data: { amount: number; type: 'sangria' | 'suprimento'; reason: string }) => {
        const res = await api.post('/commercial/shift/movement', data);
        return res.data;
    },

    getDetails: async (id: string): Promise<ShiftSession> => {
        const res = await api.get(`/commercial/shift/${id}`);
        return res.data;
    },

    getZReport: async (id?: string): Promise<ShiftZReport> => {
        const res = await api.get(id ? `/commercial/shift/${id}/z-report` : '/commercial/shift/z-report');
        return res.data;
    }
};
