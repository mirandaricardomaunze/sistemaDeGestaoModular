import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountingAPI } from '../services/api/accounting.api';

export function useAccounts() {
    return useQuery({
        queryKey: ['accounting-accounts'],
        queryFn: accountingAPI.listAccounts,
    });
}

export function useSeedDefaultChartOfAccounts() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: accountingAPI.seedDefaultChart,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] });
            toast.success('Plano de contas padrao criado.');
        },
    });
}

export function useCreateJournalEntry() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: accountingAPI.createEntry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
            queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
            toast.success('Lancamento contabilistico registado.');
        },
    });
}

export function useJournalEntries(params?: { startDate?: string; endDate?: string }) {
    return useQuery({
        queryKey: ['journal-entries', params],
        queryFn: () => accountingAPI.listEntries(params),
    });
}

export function useTrialBalance(params: { startDate: string; endDate: string }) {
    return useQuery({
        queryKey: ['trial-balance', params],
        queryFn: () => accountingAPI.trialBalance(params),
        enabled: Boolean(params.startDate && params.endDate),
    });
}

export function useIncomeStatement(params: { startDate: string; endDate: string }) {
    return useQuery({
        queryKey: ['income-statement', params],
        queryFn: () => accountingAPI.incomeStatement(params),
        enabled: Boolean(params.startDate && params.endDate),
    });
}

export function useBalanceSheet(params: { asOfDate: string }) {
    return useQuery({
        queryKey: ['balance-sheet', params],
        queryFn: () => accountingAPI.balanceSheet(params),
        enabled: Boolean(params.asOfDate),
    });
}
