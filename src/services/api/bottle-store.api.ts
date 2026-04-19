import client from './client';

export const bottleStoreAPI = {
    // Dashboard
    getDashboard: async (range: string = '1M') => {
        const response = await client.get(`/bottle-store/dashboard?range=${range}`);
        return response.data;
    },

    // Reports
    getReports: async (params: any) => {
        const response = await client.get('/bottle-store/reports', { params });
        return response.data;
    },

    // Stock Movements
    getMovements: async (params: any) => {
        const response = await client.get('/bottle-store/movements', { params });
        return response.data;
    },

    recordMovement: async (data: any) => {
        const response = await client.post('/bottle-store/movements', data);
        return response.data;
    },

    // ========================================================================
    // BOTTLE RETURNS (Vasilhames)
    // ========================================================================
    getBottleReturns: async (params: any) => {
        const response = await client.get('/bottle-store/bottle-returns', { params });
        return response.data;
    },

    getCustomerBottleBalance: async (customerId: string) => {
        const response = await client.get(`/bottle-store/bottle-returns/customer/${customerId}`);
        return response.data;
    },

    getBottleReturnsSummary: async () => {
        const response = await client.get('/bottle-store/bottle-returns/summary');
        return response.data;
    },

    recordBottleDeposit: async (data: any) => {
        const response = await client.post('/bottle-store/bottle-returns/deposit', data);
        return response.data;
    },

    recordBottleReturn: async (data: any) => {
        const response = await client.post('/bottle-store/bottle-returns/return', data);
        return response.data;
    },

    // ========================================================================
    // CASH SESSIONS (Caixa)
    // ========================================================================
    getCurrentCashSession: async () => {
        const response = await client.get('/bottle-store/cash-session');
        return response.data;
    },

    getCashSessionSummary: async () => {
        const response = await client.get('/bottle-store/cash-session/summary');
        return response.data;
    },

    getCashSessionHistory: async (params: any) => {
        const response = await client.get('/bottle-store/cash-session/history', { params });
        return response.data;
    },

    openCashSession: async (openingBalance: number) => {
        const response = await client.post('/bottle-store/cash-session/open', { openingBalance });
        return response.data;
    },

    closeCashSession: async (data: { actualBalance: number; notes?: string }) => {
        const response = await client.post('/bottle-store/cash-session/close', data);
        return response.data;
    },

    registerCashWithdrawal: async (amount: number) => {
        const response = await client.post('/bottle-store/cash-session/withdrawal', { amount });
        return response.data;
    },

    registerCashDeposit: async (amount: number) => {
        const response = await client.post('/bottle-store/cash-session/deposit', { amount });
        return response.data;
    },

    // ========================================================================
    // CREDIT SALES (Vendas a Crédito)
    // ========================================================================
    getCreditSales: async (params: any) => {
        const response = await client.get('/bottle-store/credit-sales', { params });
        return response.data;
    },

    getDebtorsReport: async () => {
        const response = await client.get('/bottle-store/credit-sales/debtors');
        return response.data;
    },

    getCustomerCreditSummary: async (customerId: string) => {
        const response = await client.get(`/bottle-store/credit-sales/customer/${customerId}`);
        return response.data;
    },

    getCreditPaymentHistory: async (saleId: string) => {
        const response = await client.get(`/bottle-store/credit-sales/${saleId}/payments`);
        return response.data;
    },

    registerCreditPayment: async (data: {
        saleId: string;
        amount: number;
        paymentMethod: string;
        reference?: string;
        notes?: string;
    }) => {
        const response = await client.post('/bottle-store/credit-sales/pay', data);
        return response.data;
    },

    // ========================================================================
    // BATCHES -- lotes e validades
    // ========================================================================
    getBatches: async (params?: { productId?: string; status?: string; page?: number; limit?: number }) => {
        const response = await client.get('/bottle-store/batches', { params });
        return response.data;
    },

    getExpiringBatches: async (days = 30) => {
        const response = await client.get('/bottle-store/batches/expiring', { params: { days } });
        return response.data;
    },

    createBatch: async (data: {
        productId: string;
        batchNumber: string;
        quantity: number;
        expiryDate?: string;
        manufactureDate?: string;
        receivedDate?: string;
        costPrice?: number;
        supplierId?: string;
        notes?: string;
    }) => {
        const response = await client.post('/bottle-store/batches', data);
        return response.data;
    },

    // ========================================================================
    // PRICE TIERS -- descontos por volume
    // ========================================================================
    getPriceTiers: async (productId?: string) => {
        const response = await client.get('/bottle-store/price-tiers', { params: productId ? { productId } : {} });
        return response.data;
    },

    createPriceTier: async (data: { productId: string; minQty: number; price: number; label?: string }) => {
        const response = await client.post('/bottle-store/price-tiers', data);
        return response.data;
    },

    deletePriceTier: async (id: string) => {
        await client.delete(`/bottle-store/price-tiers/${id}`);
    },

    // ========================================================================
    // Z REPORT
    // ========================================================================
    getZReport: async () => {
        const response = await client.get('/bottle-store/cash-session/z-report');
        return response.data;
    },

    // Finance
    getFinanceDashboard: async (period?: string) => {
        const response = await client.get('/bottle-store/finance/dashboard', { params: { period } });
        return response.data;
    },

    getTransactions: async (params?: any) => {
        const response = await client.get('/bottle-store/finance/transactions', { params });
        return response.data;
    },

    createTransaction: async (data: any) => {
        const response = await client.post('/bottle-store/finance/transactions', data);
        return response.data;
    },

    updateTransaction: async (id: string, data: any) => {
        const response = await client.put(`/bottle-store/finance/transactions/${id}`, data);
        return response.data;
    },

    deleteTransaction: async (id: string) => {
        const response = await client.delete(`/bottle-store/finance/transactions/${id}`);
        return response.data;
    }
};
