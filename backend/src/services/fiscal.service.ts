import { PrismaClient } from '@prisma/client';

export class FiscalService {
    constructor(private prisma: PrismaClient) { }

    async getTaxConfigs(companyId: string) {
        return this.prisma.taxConfig.findMany({
            where: { isActive: true, companyId },
            orderBy: { type: 'asc' }
        });
    }

    async getModuleFiscalMetrics(companyId: string, module: string) {
        // Shared logic to aggregate taxes for a specific module
        // This is a placeholder for the senior implementation of complex fiscal logic
        const transactions = await this.prisma.transaction.findMany({
            where: { companyId, module, status: 'completed' },
            select: { amount: true, category: true }
        });

        // Simplified aggregation
        const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const estimatedTax = totalAmount * 0.16; // 16% IVA example

        return {
            totalAmount,
            estimatedTax,
            count: transactions.length
        };
    }

    async getRetentions(companyId: string, period?: string, type?: string) {
        return this.prisma.taxRetention.findMany({
            where: {
                companyId,
                ...(period && { period: String(period) }),
                ...(type && { type: String(type) })
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
