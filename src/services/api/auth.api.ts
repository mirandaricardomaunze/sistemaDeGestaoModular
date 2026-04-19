import api from './client';

// ============================================================================
// Auth API
// ============================================================================

export const authAPI = {
    login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },

    register: async (userData: {
        email: string;
        password: string;
        name: string;
        role?: string;
        phone?: string;
        companyName: string;
        companyTradeName?: string;
        companyNuit: string;
        companyPhone?: string;
        companyEmail?: string;
        companyAddress?: string;
        moduleCode: string;
    }) => {
        const response = await api.post('/auth/register', userData);
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    updateProfile: async (data: {
        name: string;
        email: string;
        phone?: string;
    }) => {
        const response = await api.put('/auth/profile', data);
        return response.data;
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
        const response = await api.put('/auth/change-password', {
            currentPassword,
            newPassword,
        });
        return response.data;
    },

    getUsers: async () => {
        const response = await api.get('/auth/users');
        return response.data;
    },

    updateUserData: async (id: string, data: { name: string; email: string; role: string; phone?: string }) => {
        const response = await api.put(`/auth/users/${id}`, data);
        return response.data;
    },

    toggleUserStatus: async (id: string, isActive: boolean) => {
        const response = await api.patch(`/auth/users/${id}/status`, { isActive });
        return response.data;
    },

    deleteUser: async (id: string) => {
        const response = await api.delete(`/auth/users/${id}`);
        return response.data;
    },

    forgotPassword: async (email: string) => {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    verifyOTP: async (email: string, otp: string) => {
        const response = await api.post('/auth/verify-otp', { email, otp });
        return response.data;
    },

    resetPassword: async (data: { email: string; otp: string; newPassword: string }) => {
        const response = await api.post('/auth/reset-password', data);
        return response.data;
    },
};
