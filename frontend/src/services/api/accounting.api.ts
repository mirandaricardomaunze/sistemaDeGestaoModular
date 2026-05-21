import api from './client';
import type { Account, JournalEntry, JournalLine, TrialBalanceRow } from '../../types/accounting';

export interface IncomeStatement {
    revenues: number;
    costOfGoods: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    detail: TrialBalanceRow[];
}

export interface BalanceSheet {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    isBalanced: boolean;
    difference: number;
    detail: TrialBalanceRow[];
}

export const accountingAPI = {
    async listAccounts(): Promise<Account[]> {
        const response = await api.get('/accounting/accounts');
        return response.data;
    },

    async createAccount(data: Omit<Account, 'id'>): Promise<Account> {
        const response = await api.post('/accounting/accounts', data);
        return response.data;
    },

    async seedDefaultChart(): Promise<Account[]> {
        const response = await api.post('/accounting/accounts/seed-default');
        return response.data;
    },

    async listEntries(params?: { startDate?: string; endDate?: string }): Promise<JournalEntry[]> {
        const response = await api.get('/accounting/entries', { params });
        return response.data;
    },

    async createEntry(data: {
        date: string;
        description: string;
        reference?: string | null;
        lines: JournalLine[];
    }): Promise<JournalEntry> {
        const response = await api.post('/accounting/entries', data);
        return response.data;
    },

    async trialBalance(params: { startDate: string; endDate: string }): Promise<TrialBalanceRow[]> {
        const response = await api.get('/accounting/reports/trial-balance', { params });
        return response.data;
    },

    async incomeStatement(params: { startDate: string; endDate: string }): Promise<IncomeStatement> {
        const response = await api.get('/accounting/reports/income-statement', { params });
        return response.data;
    },

    async balanceSheet(params: { asOfDate: string }): Promise<BalanceSheet> {
        const response = await api.get('/accounting/reports/balance-sheet', { params });
        return response.data;
    },
};
