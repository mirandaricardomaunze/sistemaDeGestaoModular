import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { enqueueOperation, IDEMPOTENCY_HEADER } from '../offline/offlineQueue';
import { cryptoRandomId } from '../../db/offlineDB';
import { env } from '../../config/env';

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = env.VITE_API_URL || 'http://localhost:3001/api';

// Endpoints that must NEVER be queued offline (reads, auth, payments).
const NON_QUEUEABLE = [
    /\/auth\//,
    /\/mpesa\//,
    /\/payments\/.*\/confirm/,
];

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
        // Stamp every mutating request with an idempotency key so the
        // backend can dedupe replays from the offline queue.
        const method = (config.method || 'get').toLowerCase();
        if (method !== 'get' && config.headers && !config.headers[IDEMPOTENCY_HEADER]) {
            config.headers[IDEMPOTENCY_HEADER] = cryptoRandomId();
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
    (response) => {
        // Automatic unwrapping of Result Pattern responses
        // If the response follows { success: true, data: ... }, we return response.data.data
        if (response.data && typeof response.data === 'object' && response.data.success === true && 'data' in response.data) {
            return {
                ...response,
                data: response.data.data
            };
        }
        return response;
    },
    async (error: AxiosError<{ error?: string; message?: string }>) => {
        // Check if this request should skip automatic error toasts
        const skipErrorToast = (error.config as { skipErrorToast?: boolean } | undefined)?.skipErrorToast;
        const skipOfflineQueue = (error.config as { skipOfflineQueue?: boolean } | undefined)?.skipOfflineQueue;

        // Network failure on a mutating request → enqueue for later sync.
        const method = (error.config?.method || 'get').toUpperCase();
        const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        const url = error.config?.url || '';
        const isQueueable = !NON_QUEUEABLE.some((re) => re.test(url));

        if (
            !error.response &&        // no response → network/offline
            isMutation &&
            isQueueable &&
            !skipOfflineQueue &&
            error.config
        ) {
            try {
                const clientId =
                    (error.config.headers?.[IDEMPOTENCY_HEADER] as string) ||
                    cryptoRandomId();
                await enqueueOperation({
                    module: inferModuleFromUrl(url),
                    endpoint: url,
                    method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
                    data: parseRequestBody(error.config.data) as Record<string, unknown> | null,
                    clientId,
                });
                if (!skipErrorToast) {
                    toast(
                        'Sem ligação. Operação guardada e será sincronizada automaticamente.',
                        { icon: '📥' }
                    );
                }
                // Surface a typed error so callers can branch on it.
                return Promise.reject(
                    Object.assign(error, { isOfflineQueued: true })
                );
            } catch (e) {
                // Fall through to normal error handling if enqueue fails.
            }
        }

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

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function inferModuleFromUrl(url: string): string {
    if (url.includes('/pharmacy/')) return 'pharmacy';
    if (url.includes('/commercial/')) return 'commercial';
    if (url.includes('/logistics/')) return 'logistics';
    if (url.includes('/restaurant/')) return 'restaurant';
    if (url.includes('/hotel/')) return 'hotel';
    if (url.includes('/inventory/')) return 'inventory';
    return 'general';
}

function parseRequestBody(data: unknown): unknown {
    if (!data) return null;
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }
    return data;
}

export default api;
