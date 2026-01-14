import { prisma } from '../lib/prisma';

export class HospitalityFinanceService {
    static async getDashboard(companyId: string, period: string) {
        const now = new Date();
        const startDate = new Date();
        switch (period) {
            case '1m':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case '3m':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case '6m':
                startDate.setMonth(now.getMonth() - 6);
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                companyId,
                module: 'hospitality',
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

    static async getRevenues(companyId: string, query: any) {
        const {
            page = 1,
            limit = 20,
            startDate,
            endDate,
            category
        } = query;

        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {
            companyId,
            module: 'hospitality',
            type: 'income'
        };

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string)
            };
        }

        if (category) {
            where.category = category;
        }

        const [revenues, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                include: {
                    booking: {
                        include: { room: true }
                    },
                    room: true
                },
                orderBy: { date: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.transaction.count({ where })
        ]);

        return {
            data: revenues,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };
    }

    static async getExpenses(companyId: string, query: any) {
        const {
            page = 1,
            limit = 20,
            startDate,
            endDate,
            category,
            status
        } = query;

        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {
            companyId,
            module: 'hospitality',
            type: 'expense'
        };

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string)
            };
        }

        if (category) {
            where.category = category;
        }

        if (status) {
            where.status = status;
        }

        const [expenses, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.transaction.count({ where })
        ]);

        return {
            data: expenses,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };
    }

    static async createExpense(companyId: string, data: any) {
        const { amount, date, dueDate, ...rest } = data;

        return await prisma.transaction.create({
            data: {
                ...rest,
                type: 'expense',
                amount: Number(amount),
                date: date ? new Date(date) : new Date(),
                dueDate: dueDate ? new Date(dueDate) : null,
                companyId,
                module: 'hospitality'
            }
        });
    }

    static async updateExpense(id: string, companyId: string, data: any) {
        const { amount, date, dueDate, ...rest } = data;

        const result = await prisma.transaction.updateMany({
            where: { id, companyId },
            data: {
                ...rest,
                amount: amount !== undefined ? Number(amount) : undefined,
                date: date ? new Date(date) : undefined,
                dueDate: dueDate === null ? null : (dueDate ? new Date(dueDate) : undefined),
            }
        });

        if (result.count === 0) {
            throw new Error('Transação não encontrada ou não pertence a esta empresa');
        }

        return await prisma.transaction.findUnique({ where: { id } });
    }

    static async deleteExpense(id: string, companyId: string) {
        const result = await prisma.transaction.deleteMany({
            where: { id, companyId }
        });

        if (result.count === 0) {
            throw new Error('Transação não encontrada ou não pertence a esta empresa');
        }

        return { id };
    }

    static async getProfitLoss(companyId: string, startDate: string, endDate: string) {
        const transactions = await prisma.transaction.findMany({
            where: {
                companyId,
                module: 'hospitality',
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            },
            orderBy: { date: 'asc' }
        });

        const revenues = transactions.filter(t => t.type === 'income');
        const expenses = transactions.filter(t => t.type === 'expense');

        const revenueByCategory: any = {};
        revenues.forEach(t => {
            if (!revenueByCategory[t.category]) {
                revenueByCategory[t.category] = { total: 0, count: 0 };
            }
            revenueByCategory[t.category].total += Number(t.amount);
            revenueByCategory[t.category].count += 1;
        });

        const expensesByCategory: any = {};
        expenses.forEach(t => {
            if (!expensesByCategory[t.category]) {
                expensesByCategory[t.category] = { total: 0, count: 0 };
            }
            expensesByCategory[t.category].total += Number(t.amount);
            expensesByCategory[t.category].count += 1;
        });

        const totalRevenue = revenues.reduce((sum, t) => sum + Number(t.amount), 0);
        const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
        const netProfit = totalRevenue - totalExpenses;

        return {
            period: { startDate, endDate },
            summary: {
                totalRevenue,
                totalExpenses,
                netProfit,
                profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
            },
            revenues: {
                total: totalRevenue,
                byCategory: revenueByCategory
            },
            expenses: {
                total: totalExpenses,
                byCategory: expensesByCategory
            }
        };
    }

    static async getByRoom(companyId: string, startDate?: string, endDate?: string) {
        const where: any = {
            companyId,
            module: 'hospitality',
            type: 'income'
        };

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const revenues = await prisma.transaction.findMany({
            where,
            include: {
                room: true,
                booking: true
            }
        });

        const byRoom: any = {};
        revenues.forEach(t => {
            if (t.roomId && t.room) {
                if (!byRoom[t.roomId]) {
                    byRoom[t.roomId] = {
                        roomNumber: t.room.number,
                        roomType: t.room.type,
                        total: 0,
                        count: 0,
                        transactions: []
                    };
                }
                byRoom[t.roomId].total += Number(t.amount);
                byRoom[t.roomId].count += 1;
                // No transações limitadas por performance em sistemas maiores, mas aqui ok
                byRoom[t.roomId].transactions.push(t);
            }
        });

        const roomData = Object.values(byRoom).sort((a: any, b: any) => b.total - a.total);

        return {
            period: startDate && endDate ? { startDate, endDate } : null,
            rooms: roomData,
            summary: {
                totalRooms: roomData.length,
                totalRevenue: revenues.reduce((sum, t) => sum + Number(t.amount), 0)
            }
        };
    }
}
