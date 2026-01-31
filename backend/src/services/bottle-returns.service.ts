import { prisma } from '../lib/prisma';

export class BottleReturnsService {
    /**
     * Get bottle balance for a customer
     */
    static async getCustomerBalance(companyId: string, customerId: string) {
        const deposits = await prisma.bottleReturn.findMany({
            where: {
                companyId,
                customerId,
                type: 'deposit'
            },
            select: { quantity: true, depositPaid: true }
        });

        const returns = await prisma.bottleReturn.findMany({
            where: {
                companyId,
                customerId,
                type: 'return'
            },
            select: { quantity: true, depositRefunded: true }
        });

        const totalDeposited = deposits.reduce((sum, d) => sum + d.quantity, 0);
        const totalReturned = returns.reduce((sum, r) => sum + r.quantity, 0);
        const totalPaid = deposits.reduce((sum, d) => sum + Number(d.depositPaid), 0);
        const totalRefunded = returns.reduce((sum, r) => sum + Number(r.depositRefunded), 0);

        return {
            totalDeposited,
            totalReturned,
            bottlesOwed: totalDeposited - totalReturned,
            depositBalance: totalPaid - totalRefunded
        };
    }

    /**
     * Get all bottle movements for a company
     */
    static async getMovements(companyId: string, query: any) {
        const { page = 1, limit = 20, customerId, type, startDate, endDate } = query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { companyId };
        if (customerId) where.customerId = customerId;
        if (type) where.type = type;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const [movements, total] = await Promise.all([
            prisma.bottleReturn.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true } },
                    product: { select: { id: true, name: true, code: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.bottleReturn.count({ where })
        ]);

        return {
            data: movements,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        };
    }

    /**
     * Record a bottle deposit (when customer buys)
     */
    static async recordDeposit(companyId: string, performedBy: string, data: {
        customerId?: string;
        productId: string;
        quantity: number;
        depositAmount: number;
        saleId?: string;
        notes?: string;
    }) {
        return prisma.bottleReturn.create({
            data: {
                companyId,
                customerId: data.customerId,
                productId: data.productId,
                quantity: data.quantity,
                depositPaid: data.depositAmount,
                type: 'deposit',
                saleId: data.saleId,
                performedBy,
                notes: data.notes
            }
        });
    }

    /**
     * Record a bottle return (when customer brings back)
     */
    static async recordReturn(companyId: string, performedBy: string, data: {
        customerId?: string;
        productId: string;
        quantity: number;
        refundAmount: number;
        notes?: string;
    }) {
        return prisma.bottleReturn.create({
            data: {
                companyId,
                customerId: data.customerId,
                productId: data.productId,
                quantity: data.quantity,
                depositRefunded: data.refundAmount,
                type: 'return',
                performedBy,
                notes: data.notes
            }
        });
    }

    /**
     * Get summary by product
     */
    static async getSummaryByProduct(companyId: string) {
        const products = await prisma.product.findMany({
            where: {
                companyId,
                isReturnable: true
            },
            select: {
                id: true,
                name: true,
                code: true,
                returnPrice: true,
                bottleReturns: {
                    select: { type: true, quantity: true }
                }
            }
        });

        return products.map(product => {
            const deposited = product.bottleReturns
                .filter(b => b.type === 'deposit')
                .reduce((sum, b) => sum + b.quantity, 0);
            const returned = product.bottleReturns
                .filter(b => b.type === 'return')
                .reduce((sum, b) => sum + b.quantity, 0);

            return {
                id: product.id,
                name: product.name,
                code: product.code,
                returnPrice: product.returnPrice,
                deposited,
                returned,
                inCirculation: deposited - returned
            };
        });
    }
}
