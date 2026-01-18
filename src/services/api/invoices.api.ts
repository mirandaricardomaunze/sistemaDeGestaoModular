import api from './client';

// ============================================================================
// Invoices API
// ============================================================================

export const invoicesAPI = {
    getAll: async (params?: {
        status?: string;
        customerId?: string;
        startDate?: string;
        endDate?: string;
    }) => {
        const response = await api.get('/invoices', { params });
        return response.data;
    },

    getAvailableSources: async () => {
        const response = await api.get('/invoices/available-sources');
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/invoices/${id}`);
        return response.data;
    },

    create: async (data: {
        customerId?: string;
        customerName: string;
        customerEmail?: string;
        customerPhone?: string;
        customerAddress?: string;
        customerDocument?: string;
        items: Array<{
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            discount?: number;
        }>;
        discount?: number;
        tax?: number;
        dueDate: string;
        notes?: string;
        terms?: string;
        orderId?: string;
        orderNumber?: string;
    }) => {
        const response = await api.post('/invoices', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        status: string;
        dueDate: string;
        notes: string;
        terms: string;
    }>) => {
        const response = await api.put(`/invoices/${id}`, data);
        return response.data;
    },

    addPayment: async (
        id: string,
        data: {
            amount: number;
            method: string;
            reference?: string;
            notes?: string;
        }
    ) => {
        const response = await api.post(`/invoices/${id}/payments`, data);
        return response.data;
    },

    cancel: async (id: string) => {
        const response = await api.put(`/invoices/${id}/cancel`);
        return response.data;
    },

    createCreditNote: async (data: {
        originalInvoiceId: string;
        customerId?: string;
        customerName: string;
        items: Array<{
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            originalInvoiceItemId?: string;
        }>;
        reason: string;
        notes?: string;
    }) => {
        const response = await api.post('/invoices/credit-notes', data);
        return response.data;
    },

    getCreditNotes: async (params?: { invoiceId?: string }) => {
        const response = await api.get('/invoices/credit-notes', { params });
        return response.data.data || response.data; // Handle both paginated and direct array responses
    },
};
