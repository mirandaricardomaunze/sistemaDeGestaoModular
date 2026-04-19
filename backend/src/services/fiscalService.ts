import { PrismaClient } from '@prisma/client';
import { prisma, ExtendedPrismaClient } from '../lib/prisma';

export class FiscalService {
    constructor(private prisma: ExtendedPrismaClient) { }

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

        const activeIva = await this.prisma.ivaRate.findFirst({
            where: { companyId, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        const ivaRate = activeIva ? Number(activeIva.rate) / 100 : 0.16;

        return {
            income,
            expenses,
            profit: income - expenses,
            maintenanceCosts,
            estimatedTax: income * ivaRate,
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

export const fiscalService = new FiscalService(prisma);
