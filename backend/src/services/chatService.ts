import { prisma } from '../lib/prisma';
import { aiService } from './aiService';
import { pdfService } from './pdfService';
import { logger } from '../utils/logger';
import { Intent } from '../types/chat';

export class ChatService {
    /**
     * Processa mensagem do usuário
     */
    async processMessage(
        message: string,
        userId: string,
        companyId: string
    ): Promise<any> {
        try {
            // 1. Detectar intenção
            const intent = await this.detectIntent(message);

            // 2. Buscar dados relevantes
            const data = await this.fetchRelevantData(intent, companyId);

            // 3. Gerar resposta com IA
            const aiResponse = await aiService.generateResponse(message, data);

            // 4. Se for pedido de PDF, gerar
            let pdfUrl;
            if (intent.generatePDF) {
                const company = await prisma.company.findUnique({
                    where: { id: companyId }
                });
                pdfUrl = await pdfService.generateReport(data, intent.type, company);
            }

            // 5. Gerar sugestões
            const suggestions = this.generateSuggestions(intent);

            return {
                message: aiResponse,
                data,
                pdfUrl,
                suggestions
            };
        } catch (error: any) {
            logger.error('Chat processing error:', error);
            throw error;
        }
    }

    /**
     * Detecta intenção da mensagem
     */
    private async detectIntent(message: string): Promise<Intent> {
        const lowerMessage = message.toLowerCase();

        return {
            type: this.getIntentType(lowerMessage),
            generatePDF: lowerMessage.includes('pdf') ||
                lowerMessage.includes('relatório') ||
                lowerMessage.includes('relatorio'),
            reportType: this.getReportType(lowerMessage),
            timeframe: this.extractTimeframe(lowerMessage)
        };
    }

    private getIntentType(message: string): Intent['type'] {
        if (message.includes('venda') || message.includes('vendeu') || message.includes('receita')) {
            return 'sales';
        }
        if (message.includes('stock') || message.includes('estoque') || message.includes('inventário') || message.includes('inventario')) {
            return 'inventory';
        }
        if (message.includes('cliente')) {
            return 'customers';
        }
        if (message.includes('financeiro') || message.includes('lucro') || message.includes('despesa')) {
            return 'financial';
        }
        return 'general';
    }

    private getReportType(message: string): Intent['reportType'] {
        if (message.includes('mensal') || message.includes('mês') || message.includes('mes')) {
            return 'monthly';
        }
        if (message.includes('semanal') || message.includes('semana')) {
            return 'weekly';
        }
        if (message.includes('anual') || message.includes('ano')) {
            return 'yearly';
        }
        return 'daily';
    }

    private extractTimeframe(message: string): { start: Date; end: Date } {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        if (message.includes('hoje')) {
            return { start: today, end: endOfToday };
        }

        if (message.includes('ontem')) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const endOfYesterday = new Date(yesterday);
            endOfYesterday.setHours(23, 59, 59, 999);
            return { start: yesterday, end: endOfYesterday };
        }

        if (message.includes('semana')) {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return { start: weekAgo, end: endOfToday };
        }

        if (message.includes('mês') || message.includes('mes')) {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return { start: monthAgo, end: endOfToday };
        }

        if (message.includes('ano')) {
            const yearAgo = new Date(today);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return { start: yearAgo, end: endOfToday };
        }

        // Default: hoje
        return { start: today, end: endOfToday };
    }

    /**
     * Busca dados relevantes do banco
     */
    private async fetchRelevantData(intent: Intent, companyId: string): Promise<any> {
        const { type, timeframe } = intent;

        try {
            switch (type) {
                case 'sales':
                    return await this.getSalesData(companyId, timeframe);
                case 'inventory':
                    return await this.getInventoryData(companyId);
                case 'customers':
                    return await this.getCustomersData(companyId);
                case 'financial':
                    return await this.getFinancialData(companyId, timeframe);
                default:
                    return {};
            }
        } catch (error) {
            logger.error('Error fetching data:', error);
            return {};
        }
    }

    private async getSalesData(companyId: string, timeframe: { start: Date; end: Date }) {
        const sales = await prisma.sale.findMany({
            where: {
                companyId,
                createdAt: {
                    gte: timeframe.start,
                    lte: timeframe.end
                }
            },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                customer: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const total = sales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
        const count = sales.length;

        // Top produtos
        const productSales: Record<string, { name: string; quantity: number; total: number }> = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                const productId = item.productId;
                if (!productSales[productId]) {
                    productSales[productId] = {
                        name: item.product.name,
                        quantity: 0,
                        total: 0
                    };
                }
                productSales[productId].quantity += item.quantity;
                productSales[productId].total += Number(item.total);
            });
        });

        const topProducts = Object.values(productSales)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return {
            total,
            count,
            average: count > 0 ? total / count : 0,
            sales: sales.slice(0, 10),
            topProducts,
            period: {
                start: timeframe.start.toLocaleDateString('pt-MZ'),
                end: timeframe.end.toLocaleDateString('pt-MZ')
            }
        };
    }

    private async getInventoryData(companyId: string) {
        const products = await prisma.product.findMany({
            where: { companyId },
            select: {
                id: true,
                name: true,
                currentStock: true,
                minStock: true,
                price: true,
                category: true
            }
        });

        const lowStock = products.filter(p => p.currentStock <= p.minStock);
        const outOfStock = products.filter(p => p.currentStock === 0);
        const totalValue = products.reduce((sum: number, p: any) => sum + (p.currentStock * Number(p.price)), 0);

        return {
            totalProducts: products.length,
            lowStockCount: lowStock.length,
            outOfStockCount: outOfStock.length,
            totalValue,
            lowStockProducts: lowStock.slice(0, 10),
            outOfStockProducts: outOfStock.slice(0, 10)
        };
    }

    private async getCustomersData(companyId: string) {
        const customers = await prisma.customer.findMany({
            where: { companyId },
            include: {
                sales: {
                    select: {
                        total: true
                    }
                }
            },
            take: 100
        });

        const customersWithTotal = customers.map(customer => ({
            ...customer,
            totalPurchases: customer.sales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0)
        })).sort((a, b) => b.totalPurchases - a.totalPurchases);

        return {
            total: customers.length,
            active: customers.filter(c => c.isActive).length,
            customers: customersWithTotal.slice(0, 10),
            topCustomers: customersWithTotal.slice(0, 5)
        };
    }

    private async getFinancialData(companyId: string, timeframe: { start: Date; end: Date }) {
        const sales = await prisma.sale.findMany({
            where: {
                companyId,
                createdAt: {
                    gte: timeframe.start,
                    lte: timeframe.end
                }
            }
        });

        const revenue = sales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
        const transactions = sales.length;

        // Agrupar por método de pagamento
        const paymentMethods: Record<string, number> = {};
        sales.forEach(sale => {
            const method = sale.paymentMethod || 'Não especificado';
            paymentMethods[method] = (paymentMethods[method] || 0) + Number(sale.total);
        });

        return {
            revenue,
            transactions,
            averageTicket: transactions > 0 ? revenue / transactions : 0,
            paymentMethods,
            period: {
                start: timeframe.start.toLocaleDateString('pt-MZ'),
                end: timeframe.end.toLocaleDateString('pt-MZ')
            }
        };
    }

    /**
     * Gera sugestões de perguntas
     */
    private generateSuggestions(intent: Intent): string[] {
        const suggestions: Record<Intent['type'], string[]> = {
            sales: [
                'Quanto vendi esta semana?',
                'Quais os produtos mais vendidos?',
                'Gerar relatório de vendas em PDF',
                'Comparar vendas com o mês passado'
            ],
            inventory: [
                'Quais produtos têm stock baixo?',
                'Qual o valor total do inventário?',
                'Produtos sem stock',
                'Gerar relatório de inventário em PDF'
            ],
            customers: [
                'Quantos clientes tenho?',
                'Quem são os clientes VIP?',
                'Clientes inativos',
                'Gerar lista de clientes em PDF'
            ],
            financial: [
                'Resumo financeiro do mês',
                'Qual foi a receita de hoje?',
                'Métodos de pagamento mais usados',
                'Gerar relatório financeiro em PDF'
            ],
            general: [
                'Quanto vendi hoje?',
                'Mostrar produtos com stock baixo',
                'Resumo financeiro do mês',
                'Lista de clientes VIP'
            ]
        };

        return suggestions[intent.type] || suggestions.general;
    }
}

export const chatService = new ChatService();
