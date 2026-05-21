export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COST_OF_GOODS';
export type AccountNature = 'DEBIT' | 'CREDIT';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface Account {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    nature: AccountNature;
    parentId?: string | null;
    level: number;
    allowsEntries: boolean;
    isActive: boolean;
}

export interface JournalLine {
    id?: string;
    debitAccountId?: string | null;
    creditAccountId?: string | null;
    amount: number;
    description?: string | null;
    debitAccount?: Account | null;
    creditAccount?: Account | null;
}

export interface JournalEntry {
    id: string;
    number: string;
    date: string;
    description: string;
    reference?: string | null;
    status: JournalEntryStatus;
    lines: JournalLine[];
}

export interface TrialBalanceRow {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    nature: AccountNature;
    totalDebit: number;
    totalCredit: number;
    balance: number;
}
