import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class AIActionService {
    /**
     * Mapa de ações disponíveis para o agente
     */
    async executeAction(action: string, params: any, companyId: string): Promise<any> {
        logger.info(`AI Agent executing action: ${action} for company: ${companyId}`);

        try {
            switch (action) {
                case 'get_sales_summary':
                    return await this.getSalesSummary(companyId, params.period || 'today');
                case 'get_stock_alerts':
                    return await this.getStockAlerts(companyId);
                case 'get_financial_status':
                    return await this.getFinancialStatus(companyId);
                case 'get_hotel_occupancy':
                    return await this.getHotelOccupancy(companyId);
                case 'get_pharmacy_alerts':
                    return await this.getPharmacyAlerts(companyId);
                default:
                    throw new Error(`Ação '${action}' não reconhecida.`);
            }
        } catch (error: any) {
            logger.error(`Error executing AI action ${action}:`, error);
            return { error: error.message };
        }
    }

    private async getSalesSummary(companyId: string, period: string) {
        const timeframe = this.getTimeframe(period);
        const sales = await prisma.sale.findMany({
            where: {
                companyId,
                createdAt: { gte: timeframe.start, lte: timeframe.end }
            },
            select: { total: true }
        });

        const total = sales.reduce((sum, s) => sum + Number(s.total), 0);
        return {
            period,
            total_sales_mzn: total,
            transaction_count: sales.length,
            average_ticket: sales.length > 0 ? total / sales.length : 0
        };
    }

    private async getStockAlerts(companyId: string) {
        const lowStock = await prisma.product.count({
            where: {
                companyId,
                currentStock: { lte: prisma.product.fields.minStock }
            }
        });

        const outOfStock = await prisma.product.count({
            where: { companyId, currentStock: 0 }
        });

        return {
            low_stock_count: lowStock,
            out_of_stock_count: outOfStock,
            status: lowStock > 0 ? 'attention_required' : 'healthy'
        };
    }

    private async getFinancialStatus(companyId: string) {
        // Exemplo simplificado: Fluxo de hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const income = await prisma.sale.aggregate({
            where: { companyId, createdAt: { gte: today } },
            _sum: { total: true }
        });

        // Podemos adicionar despesas aqui se houver Tabela de Transações/Despesas
        return {
            daily_revenue: Number(income._sum.total || 0),
            currency: 'MZN'
        };
    }

    private async getHotelOccupancy(companyId: string) {
        const rooms = await prisma.hospitalityRoom.findMany({
            where: { companyId },
            select: { status: true }
        });

        const total = rooms.length;
        const occupied = rooms.filter(r => r.status === 'occupied').length;

        return {
            total_rooms: total,
            occupied_rooms: occupied,
            occupancy_rate: total > 0 ? (occupied / total) * 100 : 0
        };
    }

    private async getPharmacyAlerts(companyId: string) {
        const expiringCount = await prisma.medicationBatch.count({
            where: {
                companyId,
                expiryDate: {
                    lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
                }
            }
        });

        return {
            expiring_soon_count: expiringCount,
            critical_stock: await prisma.product.count({
                where: { companyId, category: 'Pharmacy', currentStock: { lte: 5 } }
            })
        };
    }

    private getTimeframe(period: string) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        if (period === 'yesterday') {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else if (period === 'week') {
            start.setDate(start.getDate() - 7);
        }

        return { start, end };
    }
}

export const aiActionService = new AIActionService();
