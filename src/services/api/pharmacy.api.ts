import api from './client';

export const pharmacyAPI = {
    // Medications
    getMedications: async (params?: { search?: string; requiresPrescription?: boolean; isControlled?: boolean; lowStock?: boolean; expiringDays?: number; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/medications', { params });
        return response.data;
    },

    createMedication: async (data: any) => {
        const response = await api.post('/pharmacy/medications', data);
        return response.data;
    },

    updateMedication: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/medications/${id}`, data);
        return response.data;
    },
    deleteMedication: async (id: string) => {
        const response = await api.delete(`/pharmacy/medications/${id}`);
        return response.data;
    },

    // Batches
    getBatches: async (params?: { status?: string; expiringDays?: number; medicationId?: string; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/batches', { params });
        return response.data;
    },

    createBatch: async (data: any) => {
        const response = await api.post('/pharmacy/batches', data);
        return response.data;
    },

    updateBatch: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/batches/${id}`, data);
        return response.data;
    },
    deleteBatch: async (id: string) => {
        const response = await api.delete(`/pharmacy/batches/${id}`);
        return response.data;
    },

    // Sales (POS)
    getSales: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; status?: string; customerId?: string; search?: string }) => {
        const response = await api.get('/pharmacy/sales', { params });
        return response.data;
    },

    createSale: async (data: any) => {
        const response = await api.post('/pharmacy/sales', data);
        return response.data;
    },

    refundSale: async (id: string, data: { reason: string }) => {
        const response = await api.post(`/pharmacy/sales/${id}/refund`, data);
        return response.data;
    },

    // Prescriptions
    getPrescriptions: async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/prescriptions', { params });
        return response.data;
    },

    createPrescription: async (data: any) => {
        const response = await api.post('/pharmacy/prescriptions', data);
        return response.data;
    },

    lookupPrescription: async (number: string) => {
        const response = await api.get('/pharmacy/prescriptions/lookup', { params: { number } });
        return response.data;
    },

    updatePrescriptionStatus: async (id: string, status: string) => {
        const response = await api.put(`/pharmacy/prescriptions/${id}/status`, { status });
        return response.data;
    },

    getPatientControlledHistory: async (customerId: string) => {
        const response = await api.get(`/pharmacy/patients/${customerId}/controlled-history`);
        return response.data;
    },

    // Dashboard
    getDashboardSummary: async () => {
        const response = await api.get('/pharmacy/dashboard');
        return response.data;
    },

    getSalesChart: async (period: '7days' | '30days' | '90days' | '180days' | '365days') => {
        const response = await api.get('/pharmacy/sales/chart', { params: { period } });
        return response.data;
    },

    getTopProducts: async (limit?: number) => {
        const response = await api.get('/pharmacy/sales/top-products', { params: { limit } });
        return response.data;
    },

    // Reports
    getSalesReport: async (params?: { startDate?: string; endDate?: string; groupBy?: string; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/reports/sales', { params });
        return response.data;
    },
    getExpiringReport: async (params?: { days?: number; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/reports/expiring', { params });
        return response.data;
    },

    getStockReport: async (params?: { lowStock?: boolean; expiring?: boolean; expiringDays?: number; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/reports/stock', { params });
        return response.data;
    },

    getStockMovements: async (params?: { batchId?: string; movementType?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/stock-movements', { params });
        return response.data;
    },

    // Partners
    getPartners: async (params?: { search?: string; isActive?: boolean }) => {
        const response = await api.get('/pharmacy/partners', { params });
        return response.data;
    },

    createPartner: async (data: any) => {
        const response = await api.post('/pharmacy/partners', data);
        return response.data;
    },

    updatePartner: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/partners/${id}`, data);
        return response.data;
    },

    deletePartner: async (id: string) => {
        const response = await api.delete(`/pharmacy/partners/${id}`);
        return response.data;
    },

    // Patient Profile
    getPatientProfile: async (id: string) => {
        const response = await api.get(`/pharmacy/patients/${id}/profile`);
        return response.data;
    },
    updatePatientProfile: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/patients/${id}/profile`, data);
        return response.data;
    },
    getPatientMedicationHistory: async (id: string, params?: any) => {
        const response = await api.get(`/pharmacy/patients/${id}/medication-history`, { params });
        return response.data;
    },

    // Drug Interactions
    getDrugInteractions: async (params?: { medicationId?: string }) => {
        const response = await api.get('/pharmacy/interactions', { params });
        return response.data;
    },
    createDrugInteraction: async (data: any) => {
        const response = await api.post('/pharmacy/interactions', data);
        return response.data;
    },
    deleteDrugInteraction: async (id: string) => {
        const response = await api.delete(`/pharmacy/interactions/${id}`);
        return response.data;
    },
    checkCartInteractions: async (medicationIds: string[]) => {
        const response = await api.post('/pharmacy/interactions/check', { medicationIds });
        return response.data;
    },

    // Narcotic Register
    getNarcoticRegister: async (params?: any) => {
        const response = await api.get('/pharmacy/narcotic-register', { params });
        return response.data;
    },
    createNarcoticEntry: async (data: any) => {
        const response = await api.post('/pharmacy/narcotic-register', data);
        return response.data;
    },
    updateNarcoticEntry: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/narcotic-register/${id}`, data);
        return response.data;
    },

    // Batch Recalls
    getRecalls: async (params?: any) => {
        const response = await api.get('/pharmacy/recalls', { params });
        return response.data;
    },
    createRecall: async (data: any) => {
        const response = await api.post('/pharmacy/recalls', data);
        return response.data;
    },
    resolveRecall: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/recalls/${id}/resolve`, data);
        return response.data;
    },
    getRecallAffectedSales: async (id: string) => {
        const response = await api.get(`/pharmacy/recalls/${id}/affected-sales`);
        return response.data;
    },

    // Partner Invoices
    getPartnerInvoices: async (params?: any) => {
        const response = await api.get('/pharmacy/partner-invoices', { params });
        return response.data;
    },
    generatePartnerInvoice: async (data: any) => {
        const response = await api.post('/pharmacy/partner-invoices/generate', data);
        return response.data;
    },
    registerPartnerPayment: async (id: string, amount: number) => {
        const response = await api.put(`/pharmacy/partner-invoices/${id}/payment`, { amount });
        return response.data;
    },

    // Rx Label
    getSaleLabelData: async (id: string) => {
        const response = await api.get(`/pharmacy/sales/${id}/label-data`);
        return response.data;
    },

    // Stock Reconciliation
    getStockReconciliationSnapshot: async () => {
        const response = await api.get('/pharmacy/stock-reconciliation/snapshot');
        return response.data;
    },
    submitStockReconciliation: async (data: { counts: Array<{ medicationId: string; physicalCount: number; systemStock: number }>; notes?: string }) => {
        const response = await api.post('/pharmacy/stock-reconciliation', data);
        return response.data;
    },

    // Advanced Reports
    getTopCustomersReport: async (params?: { startDate?: string; endDate?: string; limit?: number }) => {
        const response = await api.get('/pharmacy/reports/top-customers', { params });
        return response.data;
    },
    getSuppliersReport: async () => {
        const response = await api.get('/pharmacy/reports/suppliers');
        return response.data;
    },

    // Price History
    getMedicationPriceHistory: async (medicationId: string) => {
        const response = await api.get(`/pharmacy/medications/${medicationId}/price-history`);
        return response.data;
    },

    // Intelligent Alerts
    getAlerts: async () => {
        const response = await api.get('/pharmacy/alerts');
        return response.data;
    },

    // Reorder Suggestions
    getReorderSuggestions: async () => {
        const response = await api.get('/pharmacy/reorder-suggestions');
        return response.data;
    },

    // Prescription image upload
    uploadPrescriptionImage: async (prescriptionId: string, file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        const response = await api.post(`/pharmacy/prescriptions/${prescriptionId}/image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    deletePrescriptionImage: async (prescriptionId: string) => {
        const response = await api.delete(`/pharmacy/prescriptions/${prescriptionId}/image`);
        return response.data;
    },

    // Finance
    getFinanceDashboard: async (period?: string) => {
        const response = await api.get('/pharmacy/finance/dashboard', { params: { period } });
        return response.data;
    },
    getTransactions: async (params?: any) => {
        const response = await api.get('/pharmacy/finance/transactions', { params });
        return response.data;
    },
    createTransaction: async (data: any) => {
        const response = await api.post('/pharmacy/finance/transactions', data);
        return response.data;
    },
    updateTransaction: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/finance/transactions/${id}`, data);
        return response.data;
    },
    deleteTransaction: async (id: string) => {
        const response = await api.delete(`/pharmacy/finance/transactions/${id}`);
        return response.data;
    }
};
