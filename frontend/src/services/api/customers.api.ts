import api from './client';

export type CustomerAccountPayment = {
    id: string;
    date: string;
    amount: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
};

export type CustomerAccount = {
    customer: {
        id: string;
        code: string;
        name: string;
        email?: string | null;
        phone: string;
        creditLimit: number | null;
        currentBalance: number;
        totalPurchases: number;
    };
    summary: {
        invoiceTotal: number;
        invoicePaid: number;
        invoiceDebt: number;
        overdueDebt: number;
        creditSalesDebt: number;
        manualBalance: number;
        totalOutstanding: number;
        openInvoiceCount: number;
        overdueInvoiceCount: number;
        creditSaleCount: number;
    };
    invoices: Array<{
        id: string;
        invoiceNumber: string;
        issueDate: string;
        dueDate: string;
        total: number;
        amountPaid: number;
        amountDue: number;
        status: string;
        isOverdue: boolean;
        payments: CustomerAccountPayment[];
        creditNotes: Array<{ id: string; number: string; total: number; status: string; issueDate: string }>;
        debitNotes: Array<{ id: string; number: string; total: number; status: string; issueDate: string }>;
    }>;
    creditSales: Array<{
        id: string;
        receiptNumber: string;
        createdAt: string;
        dueDate?: string | null;
        total: number;
        paidAmount: number;
        amountDue: number;
        paymentMethod: string;
        payments: CustomerAccountPayment[];
    }>;
    recentPayments: Array<CustomerAccountPayment & { invoice: { id: string; invoiceNumber: string } }>;
};

export type CustomerAccountPaymentRequest = {
    targetType: 'invoice' | 'credit_sale';
    targetId: string;
    amount: number;
    method: 'cash' | 'card' | 'transfer' | 'check' | 'mpesa' | 'emola' | 'other';
    reference?: string | null;
    notes?: string | null;
};

export type CustomerAccountPaymentResponse = {
    payment: CustomerAccountPayment;
    account: CustomerAccount;
};

// ============================================================================
// Customers API
// ============================================================================

export const customersAPI = {
    getAll: async (params?: {
        search?: string;
        type?: string;
        originModule?: string;
        page?: number;
        limit?: number;
    }) => {
        const response = await api.get('/customers', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/customers/${id}`);
        return response.data;
    },

    getAccount: async (id: string): Promise<CustomerAccount> => {
        const response = await api.get(`/customers/${id}/account`);
        return response.data;
    },

    registerAccountPayment: async (
        id: string,
        data: CustomerAccountPaymentRequest
    ): Promise<CustomerAccountPaymentResponse> => {
        const response = await api.post(`/customers/${id}/account/payments`, data);
        return response.data;
    },

    create: async (data: {
        code?: string;
        name: string;
        type?: 'individual' | 'company';
        email?: string;
        phone: string;
        document?: string;
        address?: string;
        city?: string;
        province?: string;
        notes?: string;
        creditLimit?: number;
    }) => {
        const response = await api.post('/customers', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        type: 'individual' | 'company';
        email: string;
        phone: string;
        document: string;
        address: string;
        city: string;
        province: string;
        notes: string;
        creditLimit: number;
    }>) => {
        const response = await api.put(`/customers/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/customers/${id}`);
        return response.data;
    },
};
