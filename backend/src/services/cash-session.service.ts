import { prisma } from '../lib/prisma';
import { PaymentMethod } from '@prisma/client';

export class CashSessionService {
    /**
     * Get current open cash session
     */
    static async getCurrentSession(companyId: string) {
        return prisma.cashSession.findFirst({
            where: {
                companyId,
                status: 'open'
            }
        });
    }

    /**
     * Open a new cash session
     */
    static async openSession(companyId: string, openedBy: string, openingBalance: number) {
        // Check if there's already an open session
        const existing = await this.getCurrentSession(companyId);
        if (existing) {
            throw new Error('Já existe uma sessão de caixa aberta');
        }

        return prisma.cashSession.create({
            data: {
                companyId,
                openedBy,
                openingBalance
            }
        });
    }

    /**
     * Close cash session with final count
     */
    static async closeSession(companyId: string, closedBy: string, data: {
        actualBalance: number;
        notes?: string;
    }) {
        const session = await this.getCurrentSession(companyId);
        if (!session) {
            throw new Error('Não há sessão de caixa aberta');
        }

        // Get all sales during this session
        const sales = await prisma.sale.findMany({
            where: {
                companyId,
                createdAt: {
                    gte: session.openedAt
                }
            },
            select: {
                paymentMethod: true,
                total: true,
                isCredit: true
            }
        });

        // Calculate totals by payment method
        const cashSales = sales
            .filter(s => s.paymentMethod === 'cash' && !s.isCredit)
            .reduce((sum, s) => sum + Number(s.total), 0);
        const mpesaSales = sales
            .filter(s => s.paymentMethod === 'mpesa')
            .reduce((sum, s) => sum + Number(s.total), 0);
        const emolaSales = sales
            .filter(s => s.paymentMethod === 'emola')
            .reduce((sum, s) => sum + Number(s.total), 0);
        const cardSales = sales
            .filter(s => s.paymentMethod === 'card')
            .reduce((sum, s) => sum + Number(s.total), 0);
        const creditSales = sales
            .filter(s => s.isCredit)
            .reduce((sum, s) => sum + Number(s.total), 0);
        const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);

        // Expected cash balance = opening + cash sales
        const expectedBalance = Number(session.openingBalance) + cashSales - Number(session.withdrawals);
        const difference = data.actualBalance - expectedBalance;

        return prisma.cashSession.update({
            where: { id: session.id },
            data: {
                closedBy,
                closedAt: new Date(),
                closingBalance: data.actualBalance,
                expectedBalance,
                difference,
                cashSales,
                mpesaSales,
                emolaSales,
                cardSales,
                creditSales,
                totalSales,
                notes: data.notes,
                status: 'closed'
            }
        });
    }

    /**
     * Register withdrawal from cash
     */
    static async registerWithdrawal(companyId: string, amount: number) {
        const session = await this.getCurrentSession(companyId);
        if (!session) {
            throw new Error('Não há sessão de caixa aberta');
        }

        return prisma.cashSession.update({
            where: { id: session.id },
            data: {
                withdrawals: { increment: amount }
            }
        });
    }

    /**
     * Register deposit to cash
     */
    static async registerDeposit(companyId: string, amount: number) {
        const session = await this.getCurrentSession(companyId);
        if (!session) {
            throw new Error('Não há sessão de caixa aberta');
        }

        return prisma.cashSession.update({
            where: { id: session.id },
            data: {
                deposits: { increment: amount }
            }
        });
    }

    /**
     * Get session history
     */
    static async getHistory(companyId: string, query: any) {
        const { page = 1, limit = 20, startDate, endDate } = query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { companyId, status: 'closed' };
        if (startDate || endDate) {
            where.closedAt = {};
            if (startDate) where.closedAt.gte = new Date(startDate);
            if (endDate) where.closedAt.lte = new Date(endDate);
        }

        const [sessions, total] = await Promise.all([
            prisma.cashSession.findMany({
                where,
                orderBy: { closedAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.cashSession.count({ where })
        ]);

        return {
            data: sessions,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        };
    }

    /**
     * Get daily summary for current session
     */
    static async getDailySummary(companyId: string) {
        const session = await this.getCurrentSession(companyId);
        if (!session) {
            return null;
        }

        const sales = await prisma.sale.findMany({
            where: {
                companyId,
                createdAt: { gte: session.openedAt }
            },
            include: {
                items: { include: { product: true } },
                customer: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const byPaymentMethod = {
            cash: sales.filter(s => s.paymentMethod === 'cash' && !s.isCredit).reduce((sum, s) => sum + Number(s.total), 0),
            mpesa: sales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + Number(s.total), 0),
            emola: sales.filter(s => s.paymentMethod === 'emola').reduce((sum, s) => sum + Number(s.total), 0),
            card: sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + Number(s.total), 0),
            credit: sales.filter(s => s.isCredit).reduce((sum, s) => sum + Number(s.total), 0)
        };

        return {
            session,
            salesCount: sales.length,
            totalSales: sales.reduce((sum, s) => sum + Number(s.total), 0),
            byPaymentMethod,
            recentSales: sales.slice(0, 10)
        };
    }
}
