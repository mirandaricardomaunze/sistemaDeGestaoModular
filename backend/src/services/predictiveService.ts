import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { aiService } from './aiService';
import { logger } from '../utils/logger';

export interface ForecastResult {
    productId: string;
    productName: string;
    productCode: string;
    currentStock: number;
    minStock: number;
    history: number[]; // Last 6 months
    forecasted30d: number;
    confidence: number;
    status: 'stable' | 'low_risk' | 'high_risk' | 'critical';
    suggestedPurchase: number;
    reasoning: string;
    supplierId?: string;
    costPrice: number;
}

export class PredictiveService {
    
    async getInventoryForecast(companyId: string): Promise<ForecastResult[]> {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        // 1. Fetch all active products
        const products = await prisma.product.findMany({
            where: { companyId, isActive: true },
            select: { id: true, name: true, code: true, currentStock: true, minStock: true, costPrice: true, supplierId: true }
        });

        if (products.length === 0) return [];

        // 2. Fetch sales history for all products (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(1);

        const sales = await prisma.saleItem.findMany({
            where: {
                sale: { companyId, createdAt: { gte: sixMonthsAgo } },
                productId: { in: products.map(p => p.id) }
            },
            select: {
                productId: true,
                quantity: true,
                sale: { select: { createdAt: true } }
            }
        });

        // 3. Aggregate history by month for each product
        const historyMap: Record<string, number[]> = {};
        const months = this.getLast6MonthsKeys();

        products.forEach(p => { historyMap[p.id] = [0, 0, 0, 0, 0, 0]; });

        sales.forEach(item => {
            if (!item.productId) return;
            const monthKey = item.sale.createdAt.toISOString().slice(0, 7); // YYYY-MM
            const monthIdx = months.indexOf(monthKey);
            if (monthIdx !== -1) {
                historyMap[item.productId][monthIdx] += item.quantity;
            }
        });

        // 4. Batch analysis with AI (to avoid too many separate calls, we'll process 10 at a time or use a consolidated prompt)
        // For simplicity and quality, we'll create a single structured prompt for the top products or those near min stock
        const analysisCandidates = products.filter(p => 
            p.currentStock <= p.minStock * 2 || historyMap[p.id].some(v => v > 0)
        );

        if (analysisCandidates.length === 0) return [];

        const results: ForecastResult[] = [];
        const batchSize = 10;

        for (let i = 0; i < analysisCandidates.length; i += batchSize) {
            const batch = analysisCandidates.slice(i, i + batchSize);
            const batchHistory = batch.map(p => ({
                id: p.id,
                name: p.name,
                stock: p.currentStock,
                min: p.minStock,
                history: historyMap[p.id]
            }));

            const prompt = `Analise os seguintes produtos e preveja a procura para os próximos 30 dias.
            Dados formatados como JSON: ${JSON.stringify(batchHistory)}
            
            Retorne APENAS um array JSON de objetos com:
            {
              "id": string,
              "forecasted30d": number,
              "confidence": number (0-1),
              "status": "stable"|"low_risk"|"high_risk"|"critical",
              "suggestedPurchase": number,
              "reasoning": string (máximo 100 caracteres)
            }`;

            try {
                const aiResponse = await aiService.generateResponse(prompt, companyId, { systemInstruction: "Você é um analista de suprimentos especializado em séries temporais." });
                
                // Clean AI response to ensure it's valid JSON
                const jsonMatch = aiResponse.message.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const aiData = JSON.parse(jsonMatch[0]);
                    
                    batch.forEach(p => {
                        const aiInfo = aiData.find((item: any) => item.id === p.id);
                        results.push({
                            productId: p.id,
                            productName: p.name,
                            productCode: p.code,
                            currentStock: p.currentStock,
                            minStock: p.minStock,
                            history: historyMap[p.id],
                            forecasted30d: aiInfo?.forecasted30d || 0,
                            confidence: aiInfo?.confidence || 0.5,
                            status: aiInfo?.status || 'stable',
                            suggestedPurchase: aiInfo?.suggestedPurchase || 0,
                            reasoning: aiInfo?.reasoning || 'Análise indisponível',
                            supplierId: p.supplierId || undefined,
                            costPrice: Number(p.costPrice)
                        });
                    });
                }
            } catch (err) {
                logger.error('Error in AI forecasting batch:', err);
                // Fallback to basic linear calculation if AI fails
                batch.forEach(p => {
                    const avg = historyMap[p.id].reduce((a, b) => a + b, 0) / 6;
                    results.push({
                        productId: p.id, productName: p.name, productCode: p.code,
                        currentStock: p.currentStock, minStock: p.minStock,
                        history: historyMap[p.id], forecasted30d: Math.round(avg),
                        confidence: 0.3, status: p.currentStock < avg ? 'high_risk' : 'stable',
                        suggestedPurchase: p.currentStock < avg ? Math.round(avg * 1.5) : 0,
                        reasoning: 'Cálculo médio (IA indisponível)',
                        supplierId: p.supplierId || undefined, costPrice: Number(p.costPrice)
                    });
                });
            }
        }

        return results;
    }

    async createDraftOrdersFromSuggestions(companyId: string, suggestions: Array<{ productId: string; quantity: number }>) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        
        // 1. Fetch products with their supplier info
        const products = await prisma.product.findMany({
            where: { id: { in: suggestions.map(s => s.productId) }, companyId },
            select: { id: true, name: true, costPrice: true, supplierId: true }
        });

        // 2. Group by Supplier
        const supplierGroups: Record<string, any[]> = {};
        
        suggestions.forEach(sug => {
            const product = products.find(p => p.id === sug.productId);
            if (product && product.supplierId) {
                if (!supplierGroups[product.supplierId]) {
                    supplierGroups[product.supplierId] = [];
                }
                supplierGroups[product.supplierId].push({
                    productId: product.id,
                    quantity: sug.quantity,
                    unitCost: Number(product.costPrice)
                });
            }
        });

        const { suppliersService } = require('./suppliersService');
        const createdOrders = [];

        // 3. Create Orders for each group
        for (const [supplierId, items] of Object.entries(supplierGroups)) {
            const order = await suppliersService.createOrder(supplierId, {
                items,
                notes: 'Gerado automaticamente por IA Preditiva'
            }, companyId);
            createdOrders.push(order);
        }

        return {
            count: createdOrders.length,
            orders: createdOrders.map(o => ({ id: o.id, orderNumber: o.orderNumber }))
        };
    }

    private getLast6MonthsKeys(): string[] {
        const keys = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            keys.push(d.toISOString().slice(0, 7));
        }
        return keys;
    }
}

export const predictiveService = new PredictiveService();
