import api from './client';

// ============================================================================
// Employees API
// ============================================================================

export const employeesAPI = {
    getAll: async (params?: { search?: string; department?: string; role?: string }) => {
        const response = await api.get('/employees', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/employees/${id}`);
        return response.data;
    },

    create: async (data: {
        code: string;
        name: string;
        email: string;
        phone: string;
        role?: string;
        department?: string;
        hireDate: string;
        baseSalary: number;
        subsidyTransport?: number;
        subsidyFood?: number;
        address?: string;
        documentNumber?: string;
        socialSecurityNumber?: string;
        nuit?: string;
        bankName?: string;
        bankAccountNumber?: string;
        bankNib?: string;
        birthDate?: string;
        contractType?: string;
        contractExpiry?: string;
    }) => {
        const response = await api.post('/employees', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        email: string;
        phone: string;
        role: string;
        department: string;
        baseSalary: number;
        subsidyTransport: number;
        subsidyFood: number;
        address: string;
        documentNumber: string;
        socialSecurityNumber: string;
        nuit: string;
        bankName: string;
        bankAccountNumber: string;
        bankNib: string;
        isActive: boolean;
        hireDate: string;
        birthDate: string;
        contractType: string;
        contractExpiry: string;
    }>) => {
        const response = await api.put(`/employees/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/employees/${id}`);
        return response.data;
    },

    // Attendance
    getAttendance: async (params?: {
        employeeId?: string;
        startDate?: string;
        endDate?: string;
    }) => {
        const response = await api.get('/employees/attendance', { params });
        return response.data;
    },

    recordAttendance: async (data: {
        employeeId: string;
        date: string;
        checkIn?: string;
        checkOut?: string;
        status?: string;
        notes?: string;
    }) => {
        const response = await api.post('/employees/attendance', data);
        return response.data;
    },

    // Payroll
    getPayroll: async (params?: {
        employeeId?: string;
        month?: number;
        year?: number;
        status?: string;
    }) => {
        const response = await api.get('/employees/payroll', { params });
        return response.data;
    },

    createPayroll: async (data: {
        employeeId: string;
        month: number;
        year: number;
        baseSalary: number;
        otHours?: number;
        otAmount?: number;
        bonus?: number;
        allowances?: number;
        inssDeduction?: number;
        irtDeduction?: number;
        advances?: number;
    }) => {
        const response = await api.post('/employees/payroll', data);
        return response.data;
    },

    updatePayroll: async (id: string, data: Partial<{
        status: string;
        otHours: number;
        otAmount: number;
        bonus: number;
        allowances: number;
        advances: number;
    }>) => {
        const response = await api.put(`/employees/payroll/${id}`, data);
        return response.data;
    },

    processPayroll: async (id: string) => {
        const response = await api.post(`/employees/payroll/${id}/process`);
        return response.data;
    },

    markPayrollAsPaid: async (id: string, data: { paidBy: string; notes?: string }) => {
        const response = await api.post(`/employees/payroll/${id}/mark-paid`, data);
        return response.data;
    },

    addPayrollAudit: async (id: string, data: { action: string; userId: string; userName: string; details?: string }) => {
        const response = await api.post(`/employees/payroll/${id}/audit`, data);
        return response.data;
    },

    getPayrollHistory: async (employeeId: string) => {
        const response = await api.get(`/employees/${employeeId}/payroll-history`);
        return response.data;
    },

    // Vacations
    getVacations: async (params?: {
        employeeId?: string;
        status?: string;
    }) => {
        const response = await api.get('/employees/vacations', { params });
        return response.data;
    },

    requestVacation: async (data: {
        employeeId: string;
        startDate: string;
        endDate: string;
        notes?: string;
    }) => {
        const response = await api.post('/employees/vacations', data);
        return response.data;
    },

    updateVacation: async (
        id: string,
        data: { status: 'approved' | 'rejected'; approvedBy?: string; notes?: string }
    ) => {
        const response = await api.put(`/employees/vacations/${id}`, data);
        return response.data;
    },

    // Attendance Roster
    getRoster: async () => {
        const response = await api.get('/employees/roster');
        return response.data;
    },

    addToRoster: async (data: { employeeIds?: string[]; department?: string }) => {
        const response = await api.patch('/employees/roster/add', data);
        return response.data;
    },

    removeFromRoster: async (id: string) => {
        const response = await api.delete(`/employees/roster/remove/${id}`);
        return response.data;
    },

    recordRosterTime: async (id: string, data: { type: 'checkIn' | 'checkOut'; timestamp?: string }) => {
        const response = await api.post(`/employees/roster/record/${id}`, data);
        return response.data;
    },
};
