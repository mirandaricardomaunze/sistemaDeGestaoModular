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
import type {
    Pagination,
    PharmacyMedicationsParams,
    PharmacyBatchesParams,
    PharmacySalesParams,
    PharmacyPrescriptionsParams,
} from '../services/api/pharmacy.api';
import toast from 'react-hot-toast';

type ApiError = { response?: { data?: { message?: string; error?: string } } };

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

export function useMedications(params?: PharmacyMedicationsParams) {
    return useQuery<{ data: Medication[]; pagination: Pagination }>({
        queryKey: ['pharmacy', 'medications', params],
        queryFn: () => pharmacyAPI.getMedications(params),
    });
}

export function useCreateMedication() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<Medication>) => pharmacyAPI.createMedication(data),
        onSuccess: () => {
            invalidate([['pharmacy', 'medications'], ['pharmacy', 'dashboard']]);
            toast.success('Medicamento registado com sucesso');
        },
        onError: (error: ApiError) => toast.error(error.response?.data?.error || 'Erro ao registar medicamento'),
    }));
}

export function useUpdateMedication() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Medication> }) => pharmacyAPI.updateMedication(id, data),
        onSuccess: () => {
            invalidate([['pharmacy', 'medications'], ['pharmacy', 'dashboard']]);
            toast.success('Medicamento actualizado com sucesso');
        },
        onError: (error: ApiError) => toast.error(error.response?.data?.error || 'Erro ao actualizar medicamento'),
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
        onError: (error: ApiError) => toast.error(error.response?.data?.error || 'Erro ao remover medicamento'),
    }));
}

// ============================================================================
// BATCHES
// ============================================================================

export function usePharmacyBatches(params?: PharmacyBatchesParams) {
    return useQuery<{ data: PharmacyBatch[]; pagination: Pagination }>({
        queryKey: ['pharmacy', 'batches', params],
        queryFn: () => pharmacyAPI.getBatches(params),
    });
}

export function useCreatePharmacyBatch() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: Partial<PharmacyBatch>) => pharmacyAPI.createBatch(data),
        onSuccess: () => {
            invalidate([['pharmacy', 'batches'], ['pharmacy', 'medications'], ['pharmacy', 'dashboard']]);
            toast.success('Lote registado com sucesso');
        },
        onError: (error: ApiError) => toast.error(error.response?.data?.error || 'Erro ao registar lote'),
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

export type SalesChartPeriod = '7days' | '30days' | '90days' | '180days' | '365days';

export interface PharmacySalesChartPoint {
    date: string;
    total?: number;
    amount?: number;
    count?: number;
}

export function usePharmacySalesChart(period: SalesChartPeriod) {
    return useQuery<PharmacySalesChartPoint[]>({
        queryKey: ['pharmacy', 'sales-chart', period],
        queryFn: () => pharmacyAPI.getSalesChart(period),
    });
}

// ============================================================================
// SALES & POS
// ============================================================================

export function usePharmacySales(params?: PharmacySalesParams) {
    return useQuery<{ data: PharmacySale[]; pagination: Pagination }>({
        queryKey: ['pharmacy', 'sales', params],
        queryFn: () => pharmacyAPI.getSales(params),
    });
}

export interface CreatePharmacySalePayload {
    customerId?: string;
    customerName?: string;
    items: Array<{
        batchId: string;
        quantity: number;
        discount?: number;
        posologyLabel?: string;
    }>;
    discount?: number;
    partnerId?: string;
    insuranceAmount?: number;
    prescriptionNumber?: string;
    paymentMethod?: string;
}

export function useCreatePharmacySale() {
    const invalidate = useInvalidate();
    return withIsLoading(useMutation({
        mutationFn: (data: CreatePharmacySalePayload) => pharmacyAPI.createSale(data as unknown as Partial<PharmacySale>),
        onSuccess: () => {
            invalidate([['pharmacy', 'sales'], ['pharmacy', 'batches'], ['pharmacy', 'dashboard']]);
            toast.success('Venda concluída com sucesso');
        },
        onError: (error: ApiError) => toast.error(error.response?.data?.error || 'Erro ao processar venda'),
    }));
}

// ============================================================================
// PATIENTS & PRESCRIPTIONS
// ============================================================================

export function usePrescriptions(params?: PharmacyPrescriptionsParams) {
    return useQuery<{ data: Prescription[]; pagination: Pagination }>({
        queryKey: ['pharmacy', 'prescriptions', params],
        queryFn: () => pharmacyAPI.getPrescriptions(params),
    });
}

export interface PatientProfile {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    document?: string;
    dateOfBirth?: string;
    address?: string;
    medicalNotes?: string;
    allergies?: string[];
    chronicConditions?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface PatientControlledHistoryItem {
    id: string;
    medicationName: string;
    quantity: number;
    saleDate: string;
    prescriptionNumber?: string;
}

export function usePatientProfile(id: string | null) {
    return useQuery<PatientProfile>({
        queryKey: ['pharmacy', 'patient-profile', id],
        queryFn: () => pharmacyAPI.getPatientProfile(id!) as Promise<PatientProfile>,
        enabled: !!id,
    });
}

export function usePatientControlledHistory(id: string | null) {
    return useQuery<PatientControlledHistoryItem[]>({
        queryKey: ['pharmacy', 'patient-controlled-history', id],
        queryFn: () => pharmacyAPI.getPatientControlledHistory(id!) as Promise<PatientControlledHistoryItem[]>,
        enabled: !!id,
    });
}

// ============================================================================
// COMPATIBILITY HOOK (GRADUAL MIGRATION)
// ============================================================================

export function usePharmacy(params?: PharmacyMedicationsParams) {
    const medsQuery = useMedications(params);
    const batchesQuery = usePharmacyBatches();
    const dashboardQuery = usePharmacyDashboard();

    const createMed = useCreateMedication();
    const updateMed = useUpdateMedication();
    const deleteMed = useDeleteMedication();
    const createBatch = useCreatePharmacyBatch();

    return {
        medications: medsQuery.data?.data || [],
        batches: batchesQuery.data?.data || [],
        pagination: medsQuery.data?.pagination || null,
        metrics: {
            totalMedications: dashboardQuery.data?.salesCount || 0,
            lowStockItems: dashboardQuery.data?.lowStockItems || 0,
            expiringSoon: dashboardQuery.data?.expiringSoonBatches || 0,
            controlledItems: 0
        },
        isLoading: medsQuery.isLoading || batchesQuery.isLoading || dashboardQuery.isLoading,
        error: medsQuery.error || batchesQuery.error || dashboardQuery.error,
        refetch: () => {
            medsQuery.refetch();
            batchesQuery.refetch();
            dashboardQuery.refetch();
        },
        addMedication: createMed.mutateAsync,
        updateMedication: (id: string, data: Partial<Medication>) => updateMed.mutateAsync({ id, data }),
        deleteMedication: deleteMed.mutateAsync,
        addBatch: createBatch.mutateAsync
    };
}
