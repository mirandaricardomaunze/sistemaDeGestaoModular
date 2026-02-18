import { prisma } from '../lib/prisma';
import { aiService } from './aiService';
import { ApiError } from '../middleware/error.middleware';

export class ChatService {
    async processMessage(message: string, userId: string, companyId: string) {
        const intent = await this.detectIntent(message);
        const [data, company] = await Promise.all([
            this.fetchRelevantData(intent, companyId),
            prisma.company.findUnique({ where: { id: companyId }, select: { name: true, businessType: true } })
        ]);

        const aiResponse = await aiService.generateResponse(message, companyId, { ...data, companyInfo: company });
        return { message: aiResponse, data };
    }

    private async detectIntent(message: string) {
        const lower = message.toLowerCase();
        if (lower.includes('venda')) return { type: 'sales' };
        if (lower.includes('stock')) return { type: 'inventory' };
        return { type: 'general' };
    }

    private async fetchRelevantData(intent: any, companyId: string) {
        if (intent.type === 'sales') {
            const total = await prisma.sale.aggregate({ where: { companyId }, _sum: { total: true } });
            return { total: total._sum.total || 0 };
        }
        return {};
    }
}

export const chatService = new ChatService();
