/**
 * Payments API Service
 * Frontend client for M-Pesa payment integration
 */

import api from './client';

export type PaymentModule = 'pos' | 'invoice' | 'hospitality' | 'pharmacy';
export type MpesaStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface MpesaTransaction {
    id: string;
    transactionId?: string;
    conversationId?: string;
    phone: string;
    amount: number;
    reference: string;
    status: MpesaStatus;
    module: PaymentModule;
    moduleReferenceId?: string;
    errorCode?: string;
    errorMessage?: string;
    createdAt: string;
    completedAt?: string;
}

export interface InitiatePaymentParams {
    phone: string;
    amount: number;
    reference: string;
    module: PaymentModule;
    moduleReferenceId?: string;
}

export interface InitiatePaymentResponse {
    success: boolean;
    transactionId?: string;
    mpesaTransactionId?: string;
    conversationId?: string;
    message: string;
    simulated?: boolean;
}

export interface MpesaStatusResponse {
    available: boolean;
    configured: boolean;
    mode: 'production' | 'sandbox';
    message: string;
}

export const paymentsAPI = {
    /**
     * Check if M-Pesa is available and configured
     */
    getMpesaStatus: async (): Promise<MpesaStatusResponse> => {
        const { data } = await api.get('/payments/mpesa/status');
        return data;
    },

    /**
     * Initiate M-Pesa payment
     */
    initiatePayment: async (params: InitiatePaymentParams): Promise<InitiatePaymentResponse> => {
        const { data } = await api.post('/payments/mpesa/initiate', params);
        return data;
    },

    /**
     * Get transaction status
     */
    getTransactionStatus: async (transactionId: string): Promise<{
        status: MpesaStatus;
        transaction: MpesaTransaction;
    }> => {
        const { data } = await api.get(`/payments/mpesa/transaction/${transactionId}`);
        return data;
    },

    /**
     * Get transactions for a module reference
     */
    getModuleTransactions: async (
        module: PaymentModule,
        referenceId: string
    ): Promise<MpesaTransaction[]> => {
        const { data } = await api.get(`/payments/mpesa/module/${module}/${referenceId}`);
        return data;
    },

    /**
     * Cancel pending transaction
     */
    cancelTransaction: async (transactionId: string): Promise<{ success: boolean; message: string }> => {
        const { data } = await api.post(`/payments/mpesa/transaction/${transactionId}/cancel`);
        return data;
    },

    /**
     * Get payment history
     */
    getHistory: async (params?: {
        page?: number;
        limit?: number;
        status?: MpesaStatus;
        module?: PaymentModule;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        data: MpesaTransaction[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasMore: boolean;
        };
    }> => {
        const { data } = await api.get('/payments/mpesa/history', { params });
        return data;
    },
};

export default paymentsAPI;
