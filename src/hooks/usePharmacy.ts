/**
 * Pharmacy Module Hooks
 * Uses @tanstack/react-query v5 for production-grade data fetching and state management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyAPI } from '../services/api';
import type {
    Medication,
    PharmacyBatch,
    PharmacyDashboardSummary,
    Prescription,
    PharmacySale
} from '../types/pharmacy';
import toast from 'react-hot-toast';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Wraps a React Query mutation to expose `isLoading` for backward compatibility.
 */
function withIsLoading<T extends object & { isPending: boolean }>(m: T) {
    return Object.assign(m, { isLoading: m.isPending });
}

/** Invalidate specific pharmacy query keys */
function useInvalidate() {
    const qc = useQueryClient();
    return (keys: string[][]) => {
        keys.forEach(key => qc.invalidateQueries({ queryKey: key }));
    };
}

// ============================================================================
// MEDICATIONS
// ============================================================================

export function useMedications(params?: any) {
    return useQuery<{ data: Medication[], pagination: any }>({
        queryKey: ['pharmacy', 'medications', params],
        queryFn: () => pharmacyAPI.getMedications(params),
    });
}

export function useCreateMedication() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: any) => pharmacyAPI.createMedication(data),
        onSuccess: () => {
            invalidate([['pharmacy', 'medications'], ['pharmacy', 'dashboard']]);
            toast.success('Medicamento registado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao registar medicamento'),
    }));
}

export function useUpdateMedication() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => pharmacyAPI.updateMedication(id, data),
        onSuccess: () => {
            invalidate([['pharmacy', 'medications'], ['pharmacy', 'dashboard']]);
            toast.success('Medicamento actualizado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao actualizar medicamento'),
    }));
}

export function useDeleteMedication() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (id: string) => pharmacyAPI.deleteMedication(id),
        onSuccess: () => {
            invalidate([['pharmacy', 'medications'], ['pharmacy', 'dashboard']]);
            toast.success('Medicamento removido com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao remover medicamento'),
    }));
}

// ============================================================================
// BATCHES
// ============================================================================

export function usePharmacyBatches(params?: any) {
    return useQuery<PharmacyBatch[]>({
        queryKey: ['pharmacy', 'batches', params],
        queryFn: () => pharmacyAPI.getBatches(params),
    });
}

export function useCreatePharmacyBatch() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: any) => pharmacyAPI.createBatch(data),
        onSuccess: () => {
            invalidate([['pharmacy', 'batches'], ['pharmacy', 'medications'], ['pharmacy', 'dashboard']]);
            toast.success('Lote registado com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao registar lote'),
    }));
}

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export function usePharmacyDashboard() {
    return useQuery<PharmacyDashboardSummary>({
        queryKey: ['pharmacy', 'dashboard'],
        queryFn: () => pharmacyAPI.getDashboardSummary(),
    });
}

export function usePharmacySalesChart(period: any) {
    return useQuery<any[]>({
        queryKey: ['pharmacy', 'sales-chart', period],
        queryFn: () => pharmacyAPI.getSalesChart(period),
    });
}

// ============================================================================
// SALES & POS
// ============================================================================

export function usePharmacySales(params?: any) {
    return useQuery<PharmacySale[]>({
        queryKey: ['pharmacy', 'sales', params],
        queryFn: () => pharmacyAPI.getSales(params),
    });
}

export function useCreatePharmacySale() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: any) => pharmacyAPI.createSale(data),
        onSuccess: () => {
            invalidate([['pharmacy', 'sales'], ['pharmacy', 'batches'], ['pharmacy', 'dashboard']]);
            toast.success('Venda concluída com sucesso');
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao processar venda'),
    }));
}

// ============================================================================
// PATIENTS & PRESCRIPTIONS
// ============================================================================

export function usePrescriptions(params?: any) {
    return useQuery<Prescription[]>({
        queryKey: ['pharmacy', 'prescriptions', params],
        queryFn: () => pharmacyAPI.getPrescriptions(params),
    });
}

export function usePatientProfile(id: string | null) {
    return useQuery<any>({
        queryKey: ['pharmacy', 'patient-profile', id],
        queryFn: () => pharmacyAPI.getPatientProfile(id!),
        enabled: !!id,
    });
}

export function usePatientControlledHistory(id: string | null) {
    return useQuery<any[]>({
        queryKey: ['pharmacy', 'patient-controlled-history', id],
        queryFn: () => pharmacyAPI.getPatientControlledHistory(id!),
        enabled: !!id,
    });
}

// ============================================================================
// COMPATIBILITY HOOK (GRADUAL MIGRATION)
// ============================================================================

export function usePharmacy(params?: any) {
    const medsQuery = useMedications(params);
    const batchesQuery = usePharmacyBatches();
    const dashboardQuery = usePharmacyDashboard();
    
    const createMed = useCreateMedication();
    const updateMed = useUpdateMedication();
    const deleteMed = useDeleteMedication();
    const createBatch = useCreatePharmacyBatch();

    return {
        medications: medsQuery.data?.data || [],
        batches: batchesQuery.data || [],
        pagination: medsQuery.data?.pagination || null,
        metrics: {
            totalMedications: dashboardQuery.data?.salesCount || 0, // Placeholder mapping
            lowStockItems: dashboardQuery.data?.lowStockItems || 0,
            expiringSoon: dashboardQuery.data?.expiringSoonBatches || 0,
            controlledItems: 0 // Need specific metric if required
        },
        isLoading: medsQuery.isLoading || batchesQuery.isLoading || dashboardQuery.isLoading,
        error: medsQuery.error || batchesQuery.error || dashboardQuery.error,
        refetch: () => {
            medsQuery.refetch();
            batchesQuery.refetch();
            dashboardQuery.refetch();
        },
        addMedication: createMed.mutateAsync,
        updateMedication: (id: string, data: any) => updateMed.mutateAsync({ id, data }),
        deleteMedication: deleteMed.mutateAsync,
        addBatch: createBatch.mutateAsync
    };
}
