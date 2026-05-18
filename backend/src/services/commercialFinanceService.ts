import { Prisma, type Transaction } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import type {
    CommercialFinancePeriod,
    CommercialTransactionInput,
    CommercialTransactionsQuery,
    UpdateCommercialTransactionInput,
} from '../validation/commercialFinance';

type CategoryTotals = Record<string, number>;
const FINANCE_TRANSACTION_OPTIONS = { timeout: 20000, maxWait: 10000 };

export interface CommercialTransactionDTO {
    id: string;
    type: Transaction['type'];
    category: string;
    description: string;
    amount: number;
    date: Date;
    dueDate: Date | null;
    status: Transaction['status'];
    paymentMethod: Transaction['paymentMethod'] | null;
    reference: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    companyId: string | null;
    module: string | null;
}

export class CommercialFinanceService {
    async getDashboard(companyId: string, period: CommercialFinancePeriod) {
        const now = new Date();
        const startDate = this.resolvePeriodStartDate(period, now);

        const transactions = await prisma.transaction.findMany({
            where: {
                companyId,
                module: 'commercial',
                date: { gte: startDate, lte: now }
            }
        });

        const revenues = transactions.filter(t => t.type === 'income');
        const expenses = transactions.filter(t => t.type === 'expense');

        const totalRevenue = this.sumAmounts(revenues);
        const totalExpenses = this.sumAmounts(expenses);
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        return {
            summary: { totalRevenue, totalExpenses, netProfit, profitMargin, transactionCount: transactions.length },
            revenueByCategory: this.groupAmountByCategory(revenues),
            expensesByCategory: this.groupAmountByCategory(expenses),
            monthlyTrend: this.buildMonthlyTrend(transactions, now)
        };
    }

    async getTransactions(companyId: string, query: CommercialTransactionsQuery) {
        const skip = (query.page - 1) * query.limit;
        const where = this.buildTransactionsWhere(companyId, query);

        const [data, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: query.limit
            }),
            prisma.transaction.count({ where })
        ]);

        return {
            data: data.map(transaction => this.toTransactionDTO(transaction)),
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit)
            }
        };
    }

    async createTransaction(
        companyId: string,
        data: CommercialTransactionInput,
        userId?: string,
        userName?: string
    ): Promise<CommercialTransactionDTO> {
        const transaction = await prisma.$transaction(async tx => {
            const created = await tx.transaction.create({
                data: {
                    type: data.type,
                    category: data.category,
                    description: data.description,
                    amount: data.amount,
                    date: data.date ? new Date(data.date) : new Date(),
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                    paymentMethod: this.normalizePaymentMethod(data.paymentMethod),
                    reference: data.reference ?? null,
                    notes: data.notes ?? null,
                    companyId,
                    module: 'commercial'
                }
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    userName,
                    action: 'CREATE_COMMERCIAL_TRANSACTION',
                    entity: 'Transaction',
                    entityId: created.id,
                    newData: this.toAuditPayload(created),
                    companyId
                }
            });

            return created;
        }, FINANCE_TRANSACTION_OPTIONS);

        return this.toTransactionDTO(transaction);
    }

    async updateTransaction(
        id: string,
        companyId: string,
        data: UpdateCommercialTransactionInput,
        userId?: string,
        userName?: string
    ): Promise<CommercialTransactionDTO> {
        const existing = await this.findCommercialTransaction(id, companyId);
        const transaction = await prisma.$transaction(async tx => {
            const updated = await tx.transaction.update({
                where: { id },
                data: {
                    type: data.type,
                    category: data.category,
                    description: data.description,
                    amount: data.amount,
                    date: data.date ? new Date(data.date) : undefined,
                    dueDate: data.dueDate === null ? null : (data.dueDate ? new Date(data.dueDate) : undefined),
                    paymentMethod: data.paymentMethod === null ? null : this.normalizePaymentMethod(data.paymentMethod),
                    reference: data.reference,
                    notes: data.notes,
                }
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    userName,
                    action: 'UPDATE_COMMERCIAL_TRANSACTION',
                    entity: 'Transaction',
                    entityId: id,
                    oldData: this.toAuditPayload(existing),
                    newData: this.toAuditPayload(updated),
                    companyId
                }
            });

            return updated;
        }, FINANCE_TRANSACTION_OPTIONS);

        return this.toTransactionDTO(transaction);
    }

    async deleteTransaction(
        id: string,
        companyId: string,
        userId?: string,
        userName?: string
    ): Promise<{ id: string }> {
        const existing = await this.findCommercialTransaction(id, companyId);

        await prisma.$transaction(async tx => {
            await tx.transaction.delete({ where: { id } });
            await tx.auditLog.create({
                data: {
                    userId,
                    userName,
                    action: 'DELETE_COMMERCIAL_TRANSACTION',
                    entity: 'Transaction',
                    entityId: id,
                    oldData: this.toAuditPayload(existing),
                    companyId
                }
            });
        }, FINANCE_TRANSACTION_OPTIONS);

        return { id };
    }

    private resolvePeriodStartDate(period: CommercialFinancePeriod, now: Date): Date {
        const startDate = new Date(now);
        switch (period) {
            case '3m':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case '6m':
                startDate.setMonth(now.getMonth() - 6);
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            case '1m':
            default:
                startDate.setMonth(now.getMonth() - 1);
                break;
        }
        return startDate;
    }

    private buildTransactionsWhere(
        companyId: string,
        query: CommercialTransactionsQuery
    ): Prisma.TransactionWhereInput {
        const where: Prisma.TransactionWhereInput = { companyId, module: 'commercial' };

        if (query.type) where.type = query.type;
        if (query.category) where.category = query.category;
        if (query.startDate && query.endDate) {
            where.date = { gte: new Date(query.startDate), lte: new Date(query.endDate) };
        }
        if (query.search) {
            where.OR = [
                { description: { contains: query.search, mode: 'insensitive' } },
                { reference: { contains: query.search, mode: 'insensitive' } }
            ];
        }

        return where;
    }

    private buildMonthlyTrend(transactions: Transaction[], now: Date) {
        return Array.from({ length: 6 }, (_, index) => {
            const monthStart = new Date(now);
            monthStart.setMonth(now.getMonth() - (5 - index));
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);

            const monthTransactions = transactions.filter(transaction => {
                const transactionDate = new Date(transaction.date);
                return transactionDate >= monthStart && transactionDate < monthEnd;
            });

            const revenue = this.sumAmounts(monthTransactions.filter(t => t.type === 'income'));
            const expense = this.sumAmounts(monthTransactions.filter(t => t.type === 'expense'));

            return {
                month: monthStart.toISOString().slice(0, 7),
                revenue,
                expense,
                profit: revenue - expense
            };
        });
    }

    private groupAmountByCategory(transactions: Transaction[]): CategoryTotals {
        return transactions.reduce<CategoryTotals>((totals, transaction) => {
            totals[transaction.category] = (totals[transaction.category] ?? 0) + Number(transaction.amount);
            return totals;
        }, {});
    }

    private sumAmounts(transactions: Transaction[]): number {
        return transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    }

    private async findCommercialTransaction(id: string, companyId: string): Promise<Transaction> {
        const transaction = await prisma.transaction.findFirst({
            where: { id, companyId, module: 'commercial' }
        });
        if (!transaction) throw ApiError.notFound('Transacao nao encontrada');
        return transaction;
    }

    private normalizePaymentMethod(
        paymentMethod: CommercialTransactionInput['paymentMethod']
    ): Transaction['paymentMethod'] | null | undefined {
        if (paymentMethod === undefined) return undefined;
        if (paymentMethod === null) return null;
        return paymentMethod === 'bank_transfer' ? 'transfer' : paymentMethod;
    }

    private toTransactionDTO(transaction: Transaction): CommercialTransactionDTO {
        return {
            id: transaction.id,
            type: transaction.type,
            category: transaction.category,
            description: transaction.description,
            amount: Number(transaction.amount),
            date: transaction.date,
            dueDate: transaction.dueDate,
            status: transaction.status,
            paymentMethod: transaction.paymentMethod,
            reference: transaction.reference,
            notes: transaction.notes,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
            companyId: transaction.companyId,
            module: transaction.module,
        };
    }

    private toAuditPayload(transaction: Transaction): Prisma.JsonObject {
        return {
            id: transaction.id,
            type: transaction.type,
            category: transaction.category,
            description: transaction.description,
            amount: Number(transaction.amount),
            date: transaction.date.toISOString(),
            dueDate: transaction.dueDate?.toISOString() ?? null,
            status: transaction.status,
            paymentMethod: transaction.paymentMethod,
            reference: transaction.reference,
            notes: transaction.notes,
            module: transaction.module,
        };
    }
}

export const commercialFinanceService = new CommercialFinanceService();
