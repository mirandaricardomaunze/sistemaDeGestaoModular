import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export class AIActionService {
    async executeAction(action: string, params: any, companyId: string): Promise<{ success: boolean; [key: string]: any }> {
        switch (action) {
            case 'get_sales_summary': return await this.getSalesSummary(companyId, params.period || 'today');
            case 'get_stock_alerts': return await this.getStockAlerts(companyId);
            default: throw ApiError.badRequest(`Ação '${action}' não reconhecida.`);
        }
    }

    private async getSalesSummary(companyId: string, period: string) {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const sales = await prisma.sale.findMany({ where: { companyId, createdAt: { gte: start } }, select: { total: true } });
        const total = sales.reduce((sum, s) => sum + Number(s.total), 0);
        return { success: true, total_sales_mzn: total, count: sales.length };
    }

    private async getStockAlerts(companyId: string) {
        const lowStock = await prisma.product.count({ where: { companyId, currentStock: { lte: 10 } } });
        return { success: true, low_stock_count: lowStock };
    }
}

export const aiActionService = new AIActionService();
