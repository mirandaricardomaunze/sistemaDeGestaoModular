import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ============================================================================
// Request Interceptor - Add auth token to requests
// ============================================================================

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('auth_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ============================================================================
// Response Interceptor - Handle errors globally
// ============================================================================

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ error?: string; message?: string }>) => {
        // Check if this request should skip automatic error toasts
        const skipErrorToast = (error.config as any)?.skipErrorToast;

        // Handle specific error codes
        if (error.response?.status === 401) {
            // valid login attempts also return 401, don't reload page for them
            if (error.config?.url?.includes('/auth/login')) {
                return Promise.reject(error);
            }

            // Token expired or invalid
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            // Only redirect if we are not already on the login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
                if (!skipErrorToast) {
                    toast.error('Sessão expirada. Faça login novamente.');
                }
            }
        } else if (error.response?.status === 403) {
            // Don't show toast for 403 if skipErrorToast is true
            if (!skipErrorToast) {
                toast.error('Sem permissão para esta acção.');
            }
        } else if (error.response?.status === 404) {
            // Let the calling code handle 404s
        } else if (error.response?.status === 500) {
            if (!skipErrorToast) {
                toast.error('Erro interno do servidor. Tente novamente.');
            }
        } else if (!error.response) {
            if (!skipErrorToast) {
                toast.error('Erro de conexão. Verifique sua internet.');
            }
        }

        return Promise.reject(error);
    }
);

export default api;
