import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { aiService } from '../aiService';
import { predictiveService } from '../predictiveService';

type SuggestionPriority = 'critical' | 'high' | 'medium' | 'low';
type SuggestionCategory = 'stock' | 'sales' | 'finance' | 'operations' | 'customers' | 'suppliers';

export interface DecisionSuggestion {
    id: string;
    title: string;
    summary: string;
    reasoning: string;
    priority: SuggestionPriority;
    category: SuggestionCategory;
    impact: string;
    confidence: number;
    actionLabel: string;
    actionUrl: string;
    source: 'ai' | 'rules';
}

interface CandidateSuggestion extends Omit<DecisionSuggestion, 'source'> {
    evidence: Record<string, unknown>;
}

const COMMERCIAL_ORIGIN_FILTER: Prisma.SaleWhereInput[] = [
    { originModule: { in: ['commercial', 'COMMERCIAL'] } },
];

const PRIORITY_SCORE: Record<SuggestionPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

function startOfDay() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function daysAgo(days: number) {
    return new Date(Date.now() - days * 86400000);
}

function inDays(days: number) {
    return new Date(Date.now() + days * 86400000);
}

function money(value: unknown) {
    return `${Math.round(Number(value || 0)).toLocaleString('pt-MZ')} MT`;
}

function clampConfidence(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.72;
    return Math.max(0.35, Math.min(0.98, n));
}

function sanitizePriority(value: unknown): SuggestionPriority {
    if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
    return 'medium';
}

function sanitizeCategory(value: unknown): SuggestionCategory {
    if (value === 'stock' || value === 'sales' || value === 'finance' || value === 'operations' || value === 'customers' || value === 'suppliers') return value;
    return 'operations';
}

export class CommercialDecisionSuggestionsService {
    async getSuggestions(companyId: string, warehouseId?: string): Promise<DecisionSuggestion[]> {
        const context = await this.buildContext(companyId, warehouseId);
        const candidates = this.buildRuleCandidates(context);

        if (candidates.length === 0) {
            return [{
                id: 'steady-state',
                title: 'Operação estável',
                summary: 'Não encontrei riscos urgentes nos dados comerciais actuais.',
                reasoning: 'Stock crítico, cobranças vencidas, turnos abertos e compras atrasadas não geraram sinais relevantes.',
                priority: 'low',
                category: 'operations',
                impact: 'Manter monitoria diária',
                confidence: 0.74,
                actionLabel: 'Ver relatórios',
                actionUrl: '/commercial/reports',
                source: 'rules',
            }];
        }

        const aiSuggestions = await this.tryGenerateWithAI(context, candidates);
        return (aiSuggestions.length > 0 ? aiSuggestions : candidates.map(c => ({ ...c, source: 'rules' as const })))
            .sort((a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority] || b.confidence - a.confidence)
            .slice(0, 6);
    }

    private async buildContext(companyId: string, warehouseId?: string) {
        const today = startOfDay();
        const thirtyDaysAgo = daysAgo(30);
        const expiryLimit = inDays(30);

        const saleWhere: Prisma.SaleWhereInput = {
            companyId,
            OR: COMMERCIAL_ORIGIN_FILTER,
            ...(warehouseId ? { warehouseId } : {}),
        };

        const [
            todaySales,
            monthSales,
            overdueInvoices,
            pendingReceivables,
            overdueSupplierInvoices,
            dueSoonSupplierInvoices,
            overduePOs,
            openLongShifts,
            expiringBatches,
            forecast,
        ] = await Promise.all([
            prisma.sale.aggregate({
                where: { ...saleWhere, createdAt: { gte: today } },
                _sum: { total: true },
                _count: true,
            }),
            prisma.sale.aggregate({
                where: { ...saleWhere, createdAt: { gte: thirtyDaysAgo } },
                _sum: { total: true },
                _count: true,
            }),
            prisma.invoice.aggregate({
                where: { companyId, status: { in: ['sent', 'partial'] }, dueDate: { lt: new Date() }, amountDue: { gt: 0 } },
                _sum: { amountDue: true },
                _count: true,
            }),
            prisma.invoice.aggregate({
                where: { companyId, status: { in: ['draft', 'sent', 'partial'] }, amountDue: { gt: 0 } },
                _sum: { amountDue: true },
                _count: true,
            }),
            prisma.supplierInvoice.aggregate({
                where: { companyId, status: { in: ['registered', 'partial'] }, dueDate: { lt: new Date() }, amountDue: { gt: 0 } },
                _sum: { amountDue: true },
                _count: true,
            }),
            prisma.supplierInvoice.aggregate({
                where: { companyId, status: { in: ['registered', 'partial'] }, dueDate: { gte: new Date(), lte: inDays(7) }, amountDue: { gt: 0 } },
                _sum: { amountDue: true },
                _count: true,
            }),
            prisma.purchaseOrder.count({
                where: { companyId, status: { in: ['draft', 'ordered', 'partial'] }, expectedDeliveryDate: { lt: new Date() }, deletedAt: null },
            }),
            prisma.cashSession.findMany({
                where: {
                    companyId,
                    status: 'open',
                    openedAt: { lt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
                    ...(warehouseId ? { warehouseId } : {}),
                },
                select: { id: true, openedAt: true, totalSales: true, openedBy: { select: { name: true } } },
                orderBy: { openedAt: 'asc' },
                take: 5,
            }),
            prisma.productBatch.findMany({
                where: {
                    companyId,
                    quantity: { gt: 0 },
                    expiryDate: { gte: new Date(), lte: expiryLimit },
                    product: { isActive: true, originModule: { in: ['commercial', 'COMMERCIAL', 'inventory'] } },
                    ...(warehouseId ? { warehouseId } : {}),
                },
                select: {
                    id: true,
                    batchNumber: true,
                    quantity: true,
                    expiryDate: true,
                    product: { select: { id: true, name: true, code: true } },
                },
                orderBy: { expiryDate: 'asc' },
                take: 8,
            }),
            predictiveService.getInventoryForecast(companyId).catch((error) => {
                logger.warn('Decision suggestions forecast unavailable', { companyId, error: (error as Error).message });
                return [];
            }),
        ]);

        const forecastAtRisk = forecast
            .filter(item => item.status === 'critical' || item.status === 'high_risk' || item.suggestedPurchase > 0)
            .sort((a, b) => b.suggestedPurchase - a.suggestedPurchase)
            .slice(0, 8);

        return {
            warehouseId: warehouseId || null,
            generatedAt: new Date().toISOString(),
            sales: {
                todayCount: todaySales._count,
                todayRevenue: Number(todaySales._sum.total || 0),
                monthCount: monthSales._count,
                monthRevenue: Number(monthSales._sum.total || 0),
            },
            receivables: {
                overdueCount: overdueInvoices._count,
                overdueAmount: Number(overdueInvoices._sum.amountDue || 0),
                pendingCount: pendingReceivables._count,
                pendingAmount: Number(pendingReceivables._sum.amountDue || 0),
            },
            payables: {
                overdueCount: overdueSupplierInvoices._count,
                overdueAmount: Number(overdueSupplierInvoices._sum.amountDue || 0),
                dueSoonCount: dueSoonSupplierInvoices._count,
                dueSoonAmount: Number(dueSoonSupplierInvoices._sum.amountDue || 0),
            },
            suppliers: {
                overduePurchaseOrders: overduePOs,
            },
            operations: {
                longOpenShifts: openLongShifts.map(shift => ({
                    id: shift.id,
                    openedBy: shift.openedBy?.name,
                    openedAt: shift.openedAt,
                    totalSales: Number(shift.totalSales || 0),
                })),
            },
            expiry: expiringBatches.map(batch => ({
                id: batch.id,
                productName: batch.product.name,
                batchNumber: batch.batchNumber,
                quantity: batch.quantity,
                expiryDate: batch.expiryDate,
            })),
            stockForecast: forecastAtRisk.map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: item.productCode,
                currentStock: item.currentStock,
                minStock: item.minStock,
                forecasted30d: item.forecasted30d,
                suggestedPurchase: item.suggestedPurchase,
                confidence: item.confidence,
                status: item.status,
                reasoning: item.reasoning,
                source: item.source,
            })),
        };
    }

    private buildRuleCandidates(context: Awaited<ReturnType<CommercialDecisionSuggestionsService['buildContext']>>): CandidateSuggestion[] {
        const suggestions: CandidateSuggestion[] = [];
        const topStockRisk = context.stockForecast[0];
        const expiryRisk = context.expiry[0];
        const longShift = context.operations.longOpenShifts[0];

        if (topStockRisk) {
            const qty = Math.max(1, Number(topStockRisk.suggestedPurchase || topStockRisk.forecasted30d || topStockRisk.minStock));
            suggestions.push({
                id: `stock-${topStockRisk.productId}`,
                title: `Repor ${topStockRisk.productName}`,
                summary: `A previsão indica compra sugerida de ${qty} unidade(s).`,
                reasoning: String(topStockRisk.reasoning || 'Procura prevista acima do stock disponível.'),
                priority: topStockRisk.status === 'critical' ? 'critical' : 'high',
                category: 'stock',
                impact: `Evitar ruptura nos próximos 30 dias`,
                confidence: clampConfidence(topStockRisk.confidence),
                actionLabel: 'Criar ordem de compra',
                actionUrl: '/commercial/purchase-orders',
                evidence: topStockRisk,
            });
        }

        if (context.receivables.overdueCount > 0) {
            suggestions.push({
                id: 'receivables-overdue',
                title: 'Cobranças vencidas',
                summary: `${context.receivables.overdueCount} factura(s) vencidas somam ${money(context.receivables.overdueAmount)}.`,
                reasoning: 'O valor vencido reduz liquidez e pode pressionar compras e caixa.',
                priority: context.receivables.overdueAmount > 50000 ? 'high' : 'medium',
                category: 'finance',
                impact: `Recuperar até ${money(context.receivables.overdueAmount)}`,
                confidence: 0.82,
                actionLabel: 'Ver contas a receber',
                actionUrl: '/commercial/finance',
                evidence: context.receivables,
            });
        }

        if (expiryRisk) {
            suggestions.push({
                id: `expiry-${expiryRisk.id}`,
                title: 'Lotes perto da validade',
                summary: `${context.expiry.length} lote(s) expiram em até 30 dias, começando por ${expiryRisk.productName}.`,
                reasoning: 'Produtos com validade próxima devem ser vendidos, transferidos ou retirados antes de gerarem perda.',
                priority: context.expiry.length > 3 ? 'high' : 'medium',
                category: 'stock',
                impact: 'Reduzir perdas por validade',
                confidence: 0.78,
                actionLabel: 'Ver inventário',
                actionUrl: '/commercial/inventory',
                evidence: { first: expiryRisk, total: context.expiry.length },
            });
        }

        if (context.suppliers.overduePurchaseOrders > 0) {
            suggestions.push({
                id: 'purchase-orders-overdue',
                title: 'Ordens de compra atrasadas',
                summary: `${context.suppliers.overduePurchaseOrders} ordem(ns) de compra ultrapassaram a data prevista.`,
                reasoning: 'Atrasos de fornecedores podem transformar-se em rupturas de stock nos produtos de maior saída.',
                priority: 'high',
                category: 'suppliers',
                impact: 'Antecipar falhas de reposição',
                confidence: 0.8,
                actionLabel: 'Rever fornecedores',
                actionUrl: '/commercial/purchase-orders',
                evidence: context.suppliers,
            });
        }

        if (longShift) {
            suggestions.push({
                id: `shift-${longShift.id}`,
                title: 'Turno aberto há demasiado tempo',
                summary: `Há turno aberto há mais de 12 horas com ${money(longShift.totalSales)} registados.`,
                reasoning: 'Turnos longos aumentam risco de divergência no fecho de caixa.',
                priority: 'medium',
                category: 'operations',
                impact: 'Reduzir risco no fecho de caixa',
                confidence: 0.76,
                actionLabel: 'Ver turnos',
                actionUrl: '/commercial/history?tab=shifts',
                evidence: longShift,
            });
        }

        if (context.payables.overdueCount > 0 || context.payables.dueSoonCount > 0) {
            suggestions.push({
                id: 'supplier-invoices-due',
                title: 'Pagamentos a fornecedores',
                summary: `${context.payables.overdueCount} factura(s) vencidas e ${context.payables.dueSoonCount} a vencer em 7 dias.`,
                reasoning: 'Controlar pagamentos ajuda a preservar relação com fornecedores sem comprometer caixa.',
                priority: context.payables.overdueCount > 0 ? 'medium' : 'low',
                category: 'finance',
                impact: `Planear ${money(context.payables.overdueAmount + context.payables.dueSoonAmount)}`,
                confidence: 0.72,
                actionLabel: 'Ver facturas',
                actionUrl: '/commercial/supplier-invoices',
                evidence: context.payables,
            });
        }

        return suggestions
            .sort((a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority] || b.confidence - a.confidence)
            .slice(0, 8);
    }

    private async tryGenerateWithAI(
        context: Awaited<ReturnType<CommercialDecisionSuggestionsService['buildContext']>>,
        candidates: CandidateSuggestion[],
    ): Promise<DecisionSuggestion[]> {
        const prompt = `Gere sugestões automáticas de gestão para o dashboard comercial.

Dados reais do sistema:
${JSON.stringify(context)}

Sugestões calculadas por regras:
${JSON.stringify(candidates)}

Retorne APENAS um array JSON com no máximo 6 objectos. Cada objecto deve ter:
{
  "id": string,
  "title": string,
  "summary": string,
  "reasoning": string,
  "priority": "critical"|"high"|"medium"|"low",
  "category": "stock"|"sales"|"finance"|"operations"|"customers"|"suppliers",
  "impact": string,
  "confidence": number,
  "actionLabel": string,
  "actionUrl": string
}
Use apenas actionUrl existentes nas sugestões por regras. Seja específico, curto e accionável.`;

        try {
            const response = await this.withTimeout(
                aiService.generateResponse(prompt, '', { generatedFor: 'commercial_decision_panel' }, 'commercial'),
                7000,
            );
            const jsonMatch = response.message.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return [];

            const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
            const allowedActions = new Map(candidates.map(item => [item.id, item.actionUrl]));
            const fallbackActionUrls = new Set(candidates.map(item => item.actionUrl));

            return parsed
                .map((item, index): DecisionSuggestion => {
                    const id = String(item.id || candidates[index]?.id || `ai-${index}`);
                    const actionUrl = typeof item.actionUrl === 'string' && fallbackActionUrls.has(item.actionUrl)
                        ? item.actionUrl
                        : allowedActions.get(id) || candidates[index]?.actionUrl || '/commercial/reports';

                    return {
                        id,
                        title: String(item.title || candidates[index]?.title || 'Sugestão comercial'),
                        summary: String(item.summary || candidates[index]?.summary || ''),
                        reasoning: String(item.reasoning || candidates[index]?.reasoning || ''),
                        priority: sanitizePriority(item.priority),
                        category: sanitizeCategory(item.category),
                        impact: String(item.impact || candidates[index]?.impact || 'Melhorar controlo operacional'),
                        confidence: clampConfidence(item.confidence),
                        actionLabel: String(item.actionLabel || candidates[index]?.actionLabel || 'Ver detalhes'),
                        actionUrl,
                        source: 'ai',
                    };
                })
                .filter(item => item.title && item.summary);
        } catch (error) {
            logger.warn('AI decision suggestions unavailable, using rule suggestions', {
                error: (error as Error).message,
            });
            return [];
        }
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        let timeout: NodeJS.Timeout | undefined;
        try {
            return await Promise.race([
                promise,
                new Promise<T>((_, reject) => {
                    timeout = setTimeout(() => reject(new Error('AI suggestions timeout')), timeoutMs);
                }),
            ]);
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }
}

export const commercialDecisionSuggestionsService = new CommercialDecisionSuggestionsService();
