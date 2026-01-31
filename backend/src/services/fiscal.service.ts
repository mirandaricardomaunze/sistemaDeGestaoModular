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
        // Detailed aggregation for specific modules
        const transactions = await this.prisma.transaction.findMany({
            where: { companyId, module, status: 'completed' },
            select: { amount: true, type: true, category: true }
        });

        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        // Logistics-specific category breakdown if applicable
        const maintenanceCosts = transactions
            .filter(t => t.category === 'maintenance')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        return {
            income,
            expenses,
            profit: income - expenses,
            maintenanceCosts,
            estimatedTax: income * 0.16, // Simplified 16% IVA calculation
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
