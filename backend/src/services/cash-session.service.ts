import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export class CashSessionService {
    async getCurrentSession(companyId: string) {
        return prisma.cashSession.findFirst({
            where: { companyId, status: 'open' }
        });
    }

    async openSession(companyId: string, openedBy: string, openingBalance: number) {
        const existing = await this.getCurrentSession(companyId);
        if (existing) throw ApiError.badRequest('Já existe uma sessão de caixa aberta');

        return prisma.cashSession.create({
            data: { companyId, openedBy, openingBalance: Number(openingBalance) }
        });
    }

    async closeSession(companyId: string, closedBy: string, data: { actualBalance: number; notes?: string }) {
        const session = await this.getCurrentSession(companyId);
        if (!session) throw ApiError.notFound('Não há sessão de caixa aberta');

        const sales = await prisma.sale.findMany({
            where: { companyId, createdAt: { gte: session.openedAt } },
            select: { paymentMethod: true, total: true, isCredit: true }
        });

        const cashSales = sales.filter(s => s.paymentMethod === 'cash' && !s.isCredit).reduce((sum, s) => sum + Number(s.total), 0);
        const mpesaSales = sales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + Number(s.total), 0);
        const emolaSales = sales.filter(s => s.paymentMethod === 'emola').reduce((sum, s) => sum + Number(s.total), 0);
        const cardSales = sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + Number(s.total), 0);
        const creditSales = sales.filter(s => s.isCredit).reduce((sum, s) => sum + Number(s.total), 0);
        const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);

        const expectedBalance = Number(session.openingBalance) + cashSales - Number(session.withdrawals) + Number(session.deposits);
        const difference = data.actualBalance - expectedBalance;

        return prisma.cashSession.update({
            where: { id: session.id },
            data: {
                closedBy, closedAt: new Date(), closingBalance: data.actualBalance, expectedBalance, difference,
                cashSales, mpesaSales, emolaSales, cardSales, creditSales, totalSales, notes: data.notes, status: 'closed'
            }
        });
    }

    async registerWithdrawal(companyId: string, amount: number) {
        const session = await this.getCurrentSession(companyId);
        if (!session) throw ApiError.notFound('Não há sessão de caixa aberta');
        return prisma.cashSession.update({ where: { id: session.id }, data: { withdrawals: { increment: amount } } });
    }

    async registerDeposit(companyId: string, amount: number) {
        const session = await this.getCurrentSession(companyId);
        if (!session) throw ApiError.notFound('Não há sessão de caixa aberta');
        return prisma.cashSession.update({ where: { id: session.id }, data: { deposits: { increment: amount } } });
    }

    async getHistory(companyId: string, query: any) {
        const { page = 1, limit = 20, startDate, endDate } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = { companyId, status: 'closed' };
        if (startDate && endDate) where.closedAt = { gte: new Date(startDate), lte: new Date(endDate) };

        const [sessions, total] = await Promise.all([
            prisma.cashSession.findMany({ where, orderBy: { closedAt: 'desc' }, skip, take: Number(limit) }),
            prisma.cashSession.count({ where })
        ]);
        return { data: sessions, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
    }

    async getDailySummary(companyId: string) {
        const session = await this.getCurrentSession(companyId);
        if (!session) return null;

        const sales = await prisma.sale.findMany({
            where: { companyId, createdAt: { gte: session.openedAt } },
            include: { items: { include: { product: true } }, customer: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return {
            session,
            salesCount: sales.length,
            totalSales: sales.reduce((sum, s) => sum + Number(s.total), 0),
            byPaymentMethod: {
                cash: sales.filter(s => s.paymentMethod === 'cash' && !s.isCredit).reduce((sum, s) => sum + Number(s.total), 0),
                mpesa: sales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + Number(s.total), 0),
                emola: sales.filter(s => s.paymentMethod === 'emola').reduce((sum, s) => sum + Number(s.total), 0),
                card: sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + Number(s.total), 0),
                credit: sales.filter(s => s.isCredit).reduce((sum, s) => sum + Number(s.total), 0)
            },
            recentSales: sales.slice(0, 10)
        };
    }
}

export const cashSessionService = new CashSessionService();
