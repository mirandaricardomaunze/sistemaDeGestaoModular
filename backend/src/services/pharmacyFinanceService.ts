import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export class PharmacyFinanceService {
    async getDashboard(companyId: string, period: string) {
        const now = new Date();
        const startDate = new Date();
        switch (period) {
            case '1m': startDate.setMonth(now.getMonth() - 1); break;
            case '3m': startDate.setMonth(now.getMonth() - 3); break;
            case '6m': startDate.setMonth(now.getMonth() - 6); break;
            case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
            default: startDate.setMonth(now.getMonth() - 1);
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                companyId,
                module: 'pharmacy',
                date: { gte: startDate, lte: now }
            }
        });

        const revenues = transactions.filter(t => t.type === 'income');
        const expenses = transactions.filter(t => t.type === 'expense');

        const totalRevenue = revenues.reduce((sum, t) => sum + Number(t.amount), 0);
        const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        const revenueByCategory = revenues.reduce((acc: any, t) => {
            acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
            return acc;
        }, {});

        const expensesByCategory = expenses.reduce((acc: any, t) => {
            acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
            return acc;
        }, {});

        // Monthly trend for the last 6 months
        const monthlyData = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date();
            monthStart.setMonth(now.getMonth() - i);
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);

            const monthTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= monthStart && tDate < monthEnd;
            });

            const monthRevenue = monthTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + Number(t.amount), 0);

            const monthExpense = monthTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + Number(t.amount), 0);

            monthlyData.push({
                month: monthStart.toISOString().slice(0, 7),
                revenue: monthRevenue,
                expense: monthExpense,
                profit: monthRevenue - monthExpense
            });
        }

        return {
            summary: { 
                totalRevenue, 
                totalExpenses, 
                netProfit, 
                profitMargin, 
                transactionCount: transactions.length 
            },
            revenueByCategory,
            expensesByCategory,
            monthlyTrend: monthlyData
        };
    }

    async getTransactions(companyId: string, query: any) {
        const { page = 1, limit = 20, startDate, endDate, category, type, status, search } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = { companyId, module: 'pharmacy' };

        if (type) where.type = type;
        if (status) where.status = status;
        if (category) where.category = category;
        if (startDate && endDate) {
            where.date = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
        }
        if (search) {
            where.OR = [
                { description: { contains: search, mode: 'insensitive' } },
                { reference: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [data, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.transaction.count({ where })
        ]);

        return {
            data,
            pagination: { 
                page: Number(page), 
                limit: Number(limit), 
                total, 
                totalPages: Math.ceil(total / Number(limit)) 
            }
        };
    }

    async createTransaction(companyId: string, data: any) {
        const { amount, date, dueDate, ...rest } = data;
        return prisma.transaction.create({
            data: {
                ...rest,
                amount: Number(amount),
                date: date ? new Date(date) : new Date(),
                dueDate: dueDate ? new Date(dueDate) : null,
                companyId,
                module: 'pharmacy'
            }
        });
    }

    async updateTransaction(id: string, companyId: string, data: any) {
        const { amount, date, dueDate, ...rest } = data;
        
        // Use findFirst to ensure it belongs to the company and module
        const existing = await prisma.transaction.findFirst({
            where: { id, companyId, module: 'pharmacy' }
        });
        
        if (!existing) throw ApiError.notFound('Transação não encontrada');

        return prisma.transaction.update({
            where: { id },
            data: {
                ...rest,
                amount: amount !== undefined ? Number(amount) : undefined,
                date: date ? new Date(date) : undefined,
                dueDate: dueDate === null ? null : (dueDate ? new Date(dueDate) : undefined),
            }
        });
    }

    async deleteTransaction(id: string, companyId: string) {
        const existing = await prisma.transaction.findFirst({
            where: { id, companyId, module: 'pharmacy' }
        });
        
        if (!existing) throw ApiError.notFound('Transação não encontrada');

        await prisma.transaction.delete({
            where: { id }
        });
        
        return { id };
    }
}

export const pharmacyFinanceService = new PharmacyFinanceService();
