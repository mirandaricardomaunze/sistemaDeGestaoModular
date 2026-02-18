import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export class BottleReturnsService {
    async getCustomerBalance(companyId: string, customerId: string) {
        const [deposits, returns] = await Promise.all([
            prisma.bottleReturn.findMany({ where: { companyId, customerId, type: 'deposit' }, select: { quantity: true, depositPaid: true } }),
            prisma.bottleReturn.findMany({ where: { companyId, customerId, type: 'return' }, select: { quantity: true, depositRefunded: true } })
        ]);

        const totalDeposited = deposits.reduce((sum, d) => sum + d.quantity, 0);
        const totalReturned = returns.reduce((sum, r) => sum + r.quantity, 0);
        const totalPaid = deposits.reduce((sum, d) => sum + Number(d.depositPaid), 0);
        const totalRefunded = returns.reduce((sum, r) => sum + Number(r.depositRefunded), 0);

        return { totalDeposited, totalReturned, bottlesOwed: totalDeposited - totalReturned, depositBalance: totalPaid - totalRefunded };
    }

    async getMovements(companyId: string, query: any) {
        const { page = 1, limit = 20, customerId, type, startDate, endDate } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = { companyId };
        if (customerId) where.customerId = customerId;
        if (type) where.type = type;
        if (startDate && endDate) where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };

        const [movements, total] = await Promise.all([
            prisma.bottleReturn.findMany({
                where, include: { customer: { select: { id: true, name: true } }, product: { select: { id: true, name: true, code: true } } },
                orderBy: { createdAt: 'desc' }, skip, take: Number(limit)
            }),
            prisma.bottleReturn.count({ where })
        ]);

        return { data: movements, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
    }

    async recordDeposit(companyId: string, performedBy: string, data: any) {
        return prisma.bottleReturn.create({
            data: {
                companyId, customerId: data.customerId, productId: data.productId, quantity: data.quantity,
                depositPaid: data.depositAmount, type: 'deposit', saleId: data.saleId, performedBy, notes: data.notes
            }
        });
    }

    async recordReturn(companyId: string, performedBy: string, data: any) {
        return prisma.bottleReturn.create({
            data: {
                companyId, customerId: data.customerId, productId: data.productId, quantity: data.quantity,
                depositRefunded: data.refundAmount, type: 'return', performedBy, notes: data.notes
            }
        });
    }
}

export const bottleReturnsService = new BottleReturnsService();
