import api from './client';

// ============================================================================
// Hospitality API
// ============================================================================

export const hospitalityAPI = {
    getRooms: async (params?: { status?: string; type?: string; search?: string }) => {
        const response = await api.get('/hospitality/rooms', { params });
        return response.data;
    },
    createRoom: async (data: any) => {
        const response = await api.post('/hospitality/rooms', data);
        return response.data;
    },
    updateRoom: async (id: string, data: any) => {
        const response = await api.put(`/hospitality/rooms/${id}`, data);
        return response.data;
    },
    deleteRoom: async (id: string) => {
        const response = await api.delete(`/hospitality/rooms/${id}`);
        return response.data;
    },
    getBookings: async (params?: { page?: number; limit?: number; status?: string }) => {
        const response = await api.get('/hospitality/bookings', { params });
        return response.data;
    },
    createBooking: async (data: any) => {
        const response = await api.post('/hospitality/bookings', data);
        return response.data;
    },
    checkout: async (id: string) => {
        const response = await api.put(`/hospitality/bookings/${id}/checkout`);
        return response.data;
    },
    seedRooms: async () => {
        const response = await api.post('/hospitality/rooms/seed');
        return response.data;
    },
    addConsumption: async (bookingId: string, data: { productId: string; quantity: number }) => {
        const response = await api.post(`/hospitality/bookings/${bookingId}/consumptions`, data);
        return response.data;
    },

    // Today's Checkouts (for notifications)
    getTodayCheckouts: async () => {
        const response = await api.get('/hospitality/bookings/today-checkouts');
        return response.data;
    },

    // Extend Stay
    extendStay: async (bookingId: string, data: { newCheckoutDate: string; adjustPrice?: number }) => {
        const response = await api.put(`/hospitality/bookings/${bookingId}/extend`, data);
        return response.data;
    },

    // Detailed Booking Info (Guest Profile)
    getBookingDetails: async (bookingId: string) => {
        const response = await api.get(`/hospitality/bookings/${bookingId}/details`);
        return response.data;
    },

    // Housekeeping Tasks
    getHousekeepingTasks: async (params?: { status?: string; date?: string }) => {
        const response = await api.get('/hospitality/housekeeping', { params });
        return response.data;
    },
    createHousekeepingTask: async (data: {
        roomId: string;
        type?: string;
        priority?: number;
        assignedTo?: string;
        notes?: string;
        scheduledAt?: string;
    }) => {
        const response = await api.post('/hospitality/housekeeping', data);
        return response.data;
    },
    updateHousekeepingTask: async (id: string, data: {
        status?: string;
        assignedTo?: string;
        notes?: string;
        priority?: number;
    }) => {
        const response = await api.put(`/hospitality/housekeeping/${id}`, data);
        return response.data;
    },
    deleteHousekeepingTask: async (id: string) => {
        const response = await api.delete(`/hospitality/housekeeping/${id}`);
        return response.data;
    },

    // Calendar View
    getCalendarData: async (params?: { startDate?: string; endDate?: string }) => {
        const response = await api.get('/hospitality/calendar', { params });
        return response.data;
    },

    // Future Reservations
    createReservation: async (data: {
        roomId: string;
        customerName: string;
        guestCount: number;
        guestDocumentType?: string;
        guestDocumentNumber?: string;
        guestNationality?: string;
        guestPhone?: string;
        checkIn: string;
        expectedCheckout: string;
        mealPlan?: string;
        notes?: string;
    }) => {
        const response = await api.post('/hospitality/reservations', data);
        return response.data;
    },

    // Dashboard
    getDashboardSummary: async () => {
        const response = await api.get('/hospitality/dashboard/summary');
        return response.data;
    },

    getRecentBookings: async (limit?: number) => {
        const response = await api.get('/hospitality/dashboard/recent-bookings', {
            params: { limit }
        });
        return response.data;
    },

    // Financial Management
    getFinanceDashboard: async (period?: string) => {
        const response = await api.get('/hospitality/finance/dashboard', { params: { period } });
        return response.data;
    },

    getRevenues: async (params?: any) => {
        const response = await api.get('/hospitality/finance/revenues', { params });
        return response.data;
    },

    getExpenses: async (params?: any) => {
        const response = await api.get('/hospitality/finance/expenses', { params });
        return response.data;
    },

    createExpense: async (data: any) => {
        const response = await api.post('/hospitality/finance/expenses', data);
        return response.data;
    },

    updateExpense: async (id: string, data: any) => {
        const response = await api.put(`/hospitality/finance/expenses/${id}`, data);
        return response.data;
    },

    deleteExpense: async (id: string) => {
        const response = await api.delete(`/hospitality/finance/expenses/${id}`);
        return response.data;
    },

    getProfitLossReport: async (startDate: string, endDate: string) => {
        const response = await api.get('/hospitality/finance/reports/profit-loss', {
            params: { startDate, endDate }
        });
        return response.data;
    },

    getByRoomReport: async (startDate?: string, endDate?: string) => {
        const response = await api.get('/hospitality/finance/reports/by-room', {
            params: { startDate, endDate }
        });
        return response.data;
    },
};

// =============================================================================
// Pharmacy API
// =============================================================================

export const pharmacyAPI = {
    // Medications
    getMedications: async (params?: { search?: string; requiresPrescription?: boolean; isControlled?: boolean; lowStock?: boolean; expiringDays?: number }) => {
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
    getBatches: async (params?: { status?: string; expiringDays?: number; medicationId?: string }) => {
        const response = await api.get('/pharmacy/batches', { params });
        return response.data;
    },

    createBatch: async (data: any) => {
        const response = await api.post('/pharmacy/batches', data);
        return response.data;
    },

    // Sales (POS)
    getSales: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; status?: string; customerId?: string }) => {
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

    // Dashboard
    getDashboardSummary: async () => {
        const response = await api.get('/pharmacy/dashboard/summary');
        return response.data;
    },

    getSalesChart: async (period: '7days' | '30days' | '90days' | '180days' | '365days') => {
        const response = await api.get('/pharmacy/dashboard/sales-chart', { params: { period } });
        return response.data;
    },

    getTopProducts: async (limit?: number) => {
        const response = await api.get('/pharmacy/dashboard/top-products', { params: { limit } });
        return response.data;
    },

    // Reports
    getExpiringReport: async (days?: number) => {
        const response = await api.get('/pharmacy/reports/expiring', { params: { days } });
        return response.data;
    },

    getStockReport: async () => {
        const response = await api.get('/pharmacy/reports/stock');
        return response.data;
    },

    getStockMovements: async (params?: { batchId?: string; movementType?: string; startDate?: string; endDate?: string }) => {
        const response = await api.get('/pharmacy/stock-movements', { params });
        return response.data;
    }
};

// ============================================================================
// Backups API
// ============================================================================

export const backupsAPI = {
    getList: async () => {
        const response = await api.get('/backups/list');
        return response.data;
    },

    getStats: async () => {
        const response = await api.get('/backups/stats');
        return response.data;
    },

    create: async () => {
        const response = await api.post('/backups/create');
        return response.data;
    },

    download: async (filename: string) => {
        const response = await api.get(`/backups/download/${filename}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    delete: async (filename: string) => {
        const response = await api.delete(`/backups/${filename}`);
        return response.data;
    },

    restore: async (filename: string) => {
        const response = await api.post(`/backups/restore/${filename}`);
        return response.data;
    },
};

// ============================================================================
// Google Drive API
// ============================================================================

export const gdriveAPI = {
    getStatus: async () => {
        const response = await api.get('/gdrive/status');
        return response.data;
    },

    getAuthUrl: async () => {
        const response = await api.get('/gdrive/auth-url');
        return response.data;
    },

    getBackups: async () => {
        const response = await api.get('/gdrive/backups');
        return response.data;
    },

    upload: async (filename: string) => {
        const response = await api.post(`/gdrive/upload/${filename}`);
        return response.data;
    },

    delete: async (fileId: string) => {
        const response = await api.delete(`/gdrive/${fileId}`);
        return response.data;
    },
};
