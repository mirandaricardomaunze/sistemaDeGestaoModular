/**
 * useMpesaPayment Hook
 * Reusable hook for M-Pesa payment integration across modules
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { paymentsAPI, type PaymentModule, type MpesaStatus, type InitiatePaymentParams } from '../services/api';
import toast from 'react-hot-toast';

interface UseMpesaPaymentOptions {
    module: PaymentModule;
    onSuccess?: (transactionId: string) => void;
    onError?: (error: string) => void;
    pollInterval?: number; // Default 2000ms
}

interface UseMpesaPaymentReturn {
    // State
    isLoading: boolean;
    isProcessing: boolean;
    status: MpesaStatus | null;
    transactionId: string | null;
    error: string | null;
    isSimulated: boolean;

    // Actions
    initiatePayment: (params: Omit<InitiatePaymentParams, 'module'>) => Promise<boolean>;
    checkStatus: () => Promise<void>;
    cancelPayment: () => Promise<void>;
    reset: () => void;
}

export function useMpesaPayment(options: UseMpesaPaymentOptions): UseMpesaPaymentReturn {
    const { module, onSuccess, onError, pollInterval = 2000 } = options;

    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<MpesaStatus | null>(null);
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSimulated, setIsSimulated] = useState(false);

    const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (pollTimeoutRef.current) {
                clearTimeout(pollTimeoutRef.current);
            }
        };
    }, []);

    // Stop polling
    const stopPolling = useCallback(() => {
        if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
    }, []);

    // Check transaction status
    const checkStatus = useCallback(async () => {
        if (!transactionId) return;

        try {
            const result = await paymentsAPI.getTransactionStatus(transactionId);

            if (!isMountedRef.current) return;

            setStatus(result.status);

            // Handle final states
            if (result.status === 'completed') {
                stopPolling();
                setIsProcessing(false);
                toast.success('Pagamento M-Pesa confirmado!', { icon: '✅' });
                onSuccess?.(transactionId);
            } else if (result.status === 'failed') {
                stopPolling();
                setIsProcessing(false);
                const errorMsg = result.transaction.errorMessage || 'Pagamento falhou';
                setError(errorMsg);
                toast.error(errorMsg);
                onError?.(errorMsg);
            } else if (result.status === 'cancelled') {
                stopPolling();
                setIsProcessing(false);
            } else if (result.status === 'pending' || result.status === 'processing') {
                // Continue polling
                pollTimeoutRef.current = setTimeout(checkStatus, pollInterval);
            }
        } catch (err: unknown) {
            console.error('Error checking M-Pesa status:', err);
            // Don't stop polling on transient errors
            pollTimeoutRef.current = setTimeout(checkStatus, pollInterval);
        }
    }, [transactionId, pollInterval, stopPolling, onSuccess, onError]);

    // Initiate payment
    const initiatePayment = useCallback(async (
        params: Omit<InitiatePaymentParams, 'module'>
    ): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        setStatus('pending');

        try {
            const result = await paymentsAPI.initiatePayment({
                ...params,
                module,
            });

            if (!isMountedRef.current) return false;

            if (result.success) {
                setTransactionId(result.transactionId || null);
                setIsSimulated(result.simulated || false);

                if (result.simulated) {
                    // Simulated payment completes immediately
                    setStatus('completed');
                    setIsProcessing(false);
                    toast.success(result.message, { icon: '🧪' });
                    onSuccess?.(result.transactionId || '');
                    return true;
                }

                // Real payment - start polling
                setIsProcessing(true);
                setStatus('processing');
                toast.success('Aguarde confirmação no telemóvel...', { icon: '📱' });

                // Start polling for status
                pollTimeoutRef.current = setTimeout(checkStatus, pollInterval);

                return true;
            } else {
                setError(result.message);
                setStatus('failed');
                toast.error(result.message);
                onError?.(result.message);
                return false;
            }
        } catch (err: unknown) {
            const errorMsg = err.response?.data?.message || err.message || 'Erro ao iniciar pagamento';
            setError(errorMsg);
            setStatus('failed');
            toast.error(errorMsg);
            onError?.(errorMsg);
            return false;
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [module, pollInterval, checkStatus, onSuccess, onError]);

    // Cancel payment
    const cancelPayment = useCallback(async () => {
        if (!transactionId) return;

        stopPolling();

        try {
            await paymentsAPI.cancelTransaction(transactionId);
            setStatus('cancelled');
            setIsProcessing(false);
            toast('Pagamento cancelado', { icon: 'âŒ' });
        } catch (err) {
            console.error('Error cancelling payment:', err);
        }
    }, [transactionId, stopPolling]);

    // Reset state
    const reset = useCallback(() => {
        stopPolling();
        setIsLoading(false);
        setIsProcessing(false);
        setStatus(null);
        setTransactionId(null);
        setError(null);
        setIsSimulated(false);
    }, [stopPolling]);

    return {
        isLoading,
        isProcessing,
        status,
        transactionId,
        error,
        isSimulated,
        initiatePayment,
        checkStatus,
        cancelPayment,
        reset,
    };
}

export default useMpesaPayment;
