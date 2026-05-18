import { AccountNature, AccountType, JournalEntryStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../seed/defaultChartOfAccounts';
import type { AccountInput, JournalEntryInput } from '../validation/accounting.validation';

type TrialBalanceRow = {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    nature: AccountNature;
    totalDebit: number;
    totalCredit: number;
    balance: number;
};

export class AccountingService {
    async listAccounts(companyId: string) {
        return prisma.account.findMany({
            where: { companyId },
            orderBy: { code: 'asc' }
        });
    }

    async createAccount(companyId: string, data: AccountInput) {
        if (data.parentId) {
            const parent = await prisma.account.findFirst({ where: { id: data.parentId, companyId } });
            if (!parent) throw ApiError.badRequest('Conta mae invalida');
        }
        return prisma.account.create({ data: { companyId, ...data } });
    }

    async seedDefaultChart(companyId: string) {
        return prisma.$transaction(async (tx) => {
            const byCode = new Map<string, string>();
            const created = [];

            for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
                const parentId = 'parentCode' in account && account.parentCode ? byCode.get(account.parentCode) : undefined;
                const saved = await tx.account.upsert({
                    where: { companyId_code: { companyId, code: account.code } },
                    update: {
                        name: account.name,
                        type: account.type,
                        nature: account.nature,
                        level: account.level,
                        allowsEntries: account.allowsEntries ?? true,
                        parentId
                    },
                    create: {
                        companyId,
                        code: account.code,
                        name: account.name,
                        type: account.type,
                        nature: account.nature,
                        level: account.level,
                        allowsEntries: account.allowsEntries ?? true,
                        parentId
                    }
                });
                byCode.set(account.code, saved.id);
                created.push(saved);
            }

            return created;
        });
    }

    async createEntry(companyId: string, userId: string, data: JournalEntryInput) {
        this.validateDoubleEntry(data);
        await this.assertAccountsArePostable(companyId, data);
        const number = await this.generateEntryNumber(companyId);

        return prisma.journalEntry.create({
            data: {
                companyId,
                number,
                date: data.date,
                description: data.description,
                reference: data.reference || null,
                status: data.status ?? JournalEntryStatus.POSTED,
                createdBy: userId,
                lines: {
                    create: data.lines.map((line) => ({
                        debitAccountId: line.debitAccountId || null,
                        creditAccountId: line.creditAccountId || null,
                        amount: new Prisma.Decimal(line.amount),
                        description: line.description || null
                    }))
                }
            },
            include: {
                lines: {
                    include: {
                        debitAccount: true,
                        creditAccount: true
                    }
                }
            }
        });
    }

    async listEntries(companyId: string, filters: { startDate?: Date; endDate?: Date } = {}) {
        return prisma.journalEntry.findMany({
            where: {
                companyId,
                ...(filters.startDate || filters.endDate ? {
                    date: {
                        ...(filters.startDate ? { gte: filters.startDate } : {}),
                        ...(filters.endDate ? { lte: filters.endDate } : {})
                    }
                } : {})
            },
            include: {
                lines: { include: { debitAccount: true, creditAccount: true } }
            },
            orderBy: [{ date: 'desc' }, { number: 'desc' }]
        });
    }

    async getTrialBalance(companyId: string, startDate: Date, endDate: Date): Promise<TrialBalanceRow[]> {
        const accounts = await prisma.account.findMany({
            where: { companyId, allowsEntries: true, isActive: true },
            include: {
                debitLines: {
                    where: { journalEntry: { companyId, status: JournalEntryStatus.POSTED, date: { gte: startDate, lte: endDate } } }
                },
                creditLines: {
                    where: { journalEntry: { companyId, status: JournalEntryStatus.POSTED, date: { gte: startDate, lte: endDate } } }
                }
            },
            orderBy: { code: 'asc' }
        });

        return accounts.map((account) => {
            const totalDebit = account.debitLines.reduce((sum, line) => sum + Number(line.amount), 0);
            const totalCredit = account.creditLines.reduce((sum, line) => sum + Number(line.amount), 0);
            const balance = account.nature === AccountNature.DEBIT
                ? totalDebit - totalCredit
                : totalCredit - totalDebit;

            return {
                id: account.id,
                code: account.code,
                name: account.name,
                type: account.type,
                nature: account.nature,
                totalDebit,
                totalCredit,
                balance
            };
        });
    }

    async getIncomeStatement(companyId: string, startDate: Date, endDate: Date) {
        const trialBalance = await this.getTrialBalance(companyId, startDate, endDate);
        const revenues = this.sumByType(trialBalance, AccountType.REVENUE);
        const costOfGoods = this.sumByType(trialBalance, AccountType.COST_OF_GOODS);
        const expenses = this.sumByType(trialBalance, AccountType.EXPENSE);
        const grossProfit = revenues - costOfGoods;
        const netProfit = grossProfit - expenses;

        const statementTypes: AccountType[] = [AccountType.REVENUE, AccountType.COST_OF_GOODS, AccountType.EXPENSE];
        return {
            revenues,
            costOfGoods,
            expenses,
            grossProfit,
            netProfit,
            detail: trialBalance.filter((row) => statementTypes.includes(row.type))
        };
    }

    async getBalanceSheet(companyId: string, asOfDate: Date) {
        const trialBalance = await this.getTrialBalance(companyId, new Date('2000-01-01T00:00:00.000Z'), asOfDate);
        const totalAssets = this.sumByType(trialBalance, AccountType.ASSET);
        const totalLiabilities = this.sumByType(trialBalance, AccountType.LIABILITY);
        const totalEquity = this.sumByType(trialBalance, AccountType.EQUITY);
        const difference = totalAssets - totalLiabilities - totalEquity;

        const balanceTypes: AccountType[] = [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY];
        return {
            totalAssets,
            totalLiabilities,
            totalEquity,
            isBalanced: Math.abs(difference) < 0.01,
            difference,
            detail: trialBalance.filter((row) => balanceTypes.includes(row.type))
        };
    }

    private validateDoubleEntry(data: JournalEntryInput) {
        const totalDebit = data.lines
            .filter((line) => line.debitAccountId)
            .reduce((sum, line) => sum + Number(line.amount), 0);
        const totalCredit = data.lines
            .filter((line) => line.creditAccountId)
            .reduce((sum, line) => sum + Number(line.amount), 0);

        if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
            throw ApiError.badRequest('Lancamento invalido: total de debito deve ser igual ao total de credito');
        }
    }

    private async assertAccountsArePostable(companyId: string, data: JournalEntryInput) {
        const ids = [...new Set(data.lines.flatMap((line) => [line.debitAccountId, line.creditAccountId]).filter(Boolean))] as string[];
        const accounts = await prisma.account.findMany({
            where: { id: { in: ids }, companyId, isActive: true, allowsEntries: true },
            select: { id: true }
        });
        if (accounts.length !== ids.length) {
            throw ApiError.badRequest('Uma ou mais contas nao existem, estao inactivas ou nao aceitam lancamentos');
        }
    }

    private async generateEntryNumber(companyId: string): Promise<string> {
        const year = new Date().getFullYear();
        const count = await prisma.journalEntry.count({
            where: { companyId, number: { startsWith: `LC-${year}-` } }
        });
        return `LC-${year}-${String(count + 1).padStart(6, '0')}`;
    }

    private sumByType(rows: TrialBalanceRow[], type: AccountType): number {
        return rows.filter((row) => row.type === type).reduce((sum, row) => sum + row.balance, 0);
    }
}

export const accountingService = new AccountingService();
