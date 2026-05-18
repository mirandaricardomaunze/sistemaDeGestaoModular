import { Prisma } from '@prisma/client';
import { prisma, ExtendedPrismaClient } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { approvalsService } from './approvalsService';

type TaxRetentionRow = {
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    baseAmount: number | string | Prisma.Decimal;
    rate: number | string | Prisma.Decimal;
    retainedAmount: number | string | Prisma.Decimal;
    period: string;
    description?: string | null;
    isPaid?: boolean | null;
    paidAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

type DocumentLookup = {
    id: string;
    invoiceNumber?: string;
    number?: string;
    customerId?: string | null;
    customerName?: string | null;
    customerDocument?: string | null;
};

type Numericish = number | string | Prisma.Decimal;
type AmountField = { baseAmount: Numericish; retainedAmount: Numericish };

export class FiscalService {
    constructor(private prisma: ExtendedPrismaClient) { }

    private roundMoney(value: number) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    private getPeriodRange(period: string) {
        const [year, month] = period.split('-').map(Number);
        if (!year || !month || month < 1 || month > 12) {
            throw ApiError.badRequest('Periodo fiscal invalido. Use YYYY-MM.');
        }

        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
        return { start, end };
    }

    private toFiscalRetentionDto(retention: TaxRetentionRow, documentMap: Map<string, DocumentLookup>) {
        const document = documentMap.get(`${retention.entityType}:${retention.entityId}`);
        const isCreditNote = retention.entityType === 'credit_note';
        const documentNumber = document?.invoiceNumber || document?.number || retention.entityId;
        const entityName = document?.customerName || retention.description || retention.entityType;

        return {
            id: retention.id,
            type: retention.type,
            documentType: isCreditNote ? 'credit_note' : retention.entityType,
            documentId: retention.entityId,
            documentNumber,
            entityId: document?.customerId || retention.entityId,
            entityName,
            entityNuit: document?.customerDocument || undefined,
            baseAmount: Number(retention.baseAmount || 0),
            rate: Number(retention.rate || 0),
            retainedAmount: Number(retention.retainedAmount || 0),
            date: retention.createdAt,
            period: retention.period,
            status: retention.isPaid ? 'paid' : 'applied',
            notes: retention.description,
            createdAt: retention.createdAt,
            updatedAt: retention.updatedAt,
            entityType: retention.entityType,
            isPaid: retention.isPaid,
            paidAt: retention.paidAt,
        };
    }

    private async resolveRetentionDocuments(retentions: TaxRetentionRow[], companyId: string) {
        const invoiceIds = retentions
            .filter(r => r.entityType === 'invoice')
            .map(r => r.entityId);
        const creditNoteIds = retentions
            .filter(r => r.entityType === 'credit_note')
            .map(r => r.entityId);

        const [invoices, creditNotes] = await Promise.all([
            invoiceIds.length > 0
                ? this.prisma.invoice.findMany({
                    where: { companyId, id: { in: invoiceIds } },
                    select: { id: true, invoiceNumber: true, customerId: true, customerName: true, customerDocument: true }
                })
                : Promise.resolve([]),
            creditNoteIds.length > 0
                ? this.prisma.creditNote.findMany({
                    where: { companyId, id: { in: creditNoteIds } },
                    select: { id: true, number: true, customerId: true, customerName: true }
                })
                : Promise.resolve([])
        ]);

        const documentMap = new Map<string, DocumentLookup>();
        for (const invoice of invoices) documentMap.set(`invoice:${invoice.id}`, invoice);
        for (const creditNote of creditNotes) documentMap.set(`credit_note:${creditNote.id}`, creditNote);
        return documentMap;
    }

    async getActiveIvaRate(companyId: string) {
        const activeIva = await this.prisma.ivaRate.findFirst({
            where: { companyId, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }]
        });
        return activeIva ? Number(activeIva.rate) : 16;
    }

    private async getPurchaseIvaDeductions(companyId: string, period: string) {
        const { start, end } = this.getPeriodRange(period);
        const ivaRate = await this.getActiveIvaRate(companyId);

        const invoices = await this.prisma.supplierInvoice.findMany({
            where: {
                companyId,
                status: { in: ['registered', 'paid'] },
                issueDate: { gte: start, lt: end }
            },
            include: {
                supplier: { select: { id: true, name: true, nuit: true } },
                purchaseOrder: { select: { id: true, orderNumber: true } },
                items: true
            },
            orderBy: { issueDate: 'desc' }
        });

        return invoices
            .map((invoice) => {
                const baseAmount = Number(invoice.subtotal || 0);
                const retainedAmount = this.roundMoney(Number(invoice.tax || baseAmount * (ivaRate / 100)));

                return {
                    id: `supplier_invoice:${invoice.id}`,
                    type: 'iva',
                    documentType: 'supplier_invoice',
                    documentId: invoice.id,
                    documentNumber: invoice.invoiceNumber,
                    entityId: invoice.supplierId,
                    entityName: invoice.supplier?.name || 'Fornecedor',
                    entityNuit: invoice.supplier?.nuit || undefined,
                    baseAmount: this.roundMoney(baseAmount),
                    rate: Number(invoice.taxRate || ivaRate),
                    retainedAmount,
                    date: invoice.issueDate,
                    period,
                    status: 'applied',
                    notes: invoice.purchaseOrder?.orderNumber
                        ? `IVA dedutivel da factura de fornecedor ligada a ${invoice.purchaseOrder.orderNumber}`
                        : 'IVA dedutivel da factura de fornecedor',
                    createdAt: invoice.createdAt,
                    updatedAt: invoice.updatedAt,
                    entityType: 'supplier_invoice',
                    isPaid: false,
                    paidAt: null,
                };
            })
            .filter((deduction) => deduction.baseAmount > 0);
    }

    private async isFiscalPeriodClosed(companyId: string, period: string) {
        const report = await this.prisma.fiscalReport.findFirst({
            where: {
                companyId,
                period,
                type: 'monthly_close',
                status: { in: ['closed', 'submitted', 'accepted'] }
            },
            orderBy: { updatedAt: 'desc' }
        });
        return Boolean(report);
    }

    async assertFiscalPeriodOpen(companyId: string, period: string) {
        if (await this.isFiscalPeriodClosed(companyId, period)) {
            throw ApiError.badRequest(`Periodo fiscal ${period} ja esta fechado.`);
        }
    }

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
        const retentions = await this.prisma.taxRetention.findMany({
            where: {
                companyId,
                ...(period && { period: String(period) }),
                ...(type && { type: String(type) })
            },
            orderBy: { createdAt: 'desc' }
        });

        const documentMap = await this.resolveRetentionDocuments(retentions, companyId);
        return retentions.map(retention => this.toFiscalRetentionDto(retention, documentMap));
    }

    async getCommercialFiscalSummary(companyId: string, period?: string) {
        const currentPeriod = period || new Date().toISOString().slice(0, 7);
        const currentYear = currentPeriod.slice(0, 4);

        const ytdPeriods = Array.from({ length: 12 }, (_, index) => `${currentYear}-${String(index + 1).padStart(2, '0')}`)
            .filter(p => p <= currentPeriod);

        const [periodRetentions, ytdRetentions, purchaseDeductions, ytdPurchaseDeductions, isClosed] = await Promise.all([
            this.prisma.taxRetention.findMany({
                where: {
                    companyId,
                    type: 'iva',
                    period: currentPeriod,
                    entityType: { in: ['invoice', 'credit_note'] }
                },
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.taxRetention.findMany({
                where: {
                    companyId,
                    type: 'iva',
                    period: { startsWith: currentYear },
                    entityType: { in: ['invoice', 'credit_note'] }
                },
                orderBy: { createdAt: 'desc' }
            }),
            this.getPurchaseIvaDeductions(companyId, currentPeriod),
            Promise.all(ytdPeriods.map(p => this.getPurchaseIvaDeductions(companyId, p))),
            this.isFiscalPeriodClosed(companyId, currentPeriod)
        ]);

        const documentMap = await this.resolveRetentionDocuments(periodRetentions, companyId);
        const periodDtos = periodRetentions.map(retention => this.toFiscalRetentionDto(retention, documentMap));
        const ytdPurchases = ytdPurchaseDeductions.flat();

        const invoiceRetentions = periodRetentions.filter(r => r.entityType === 'invoice');
        const creditNoteRetentions = periodRetentions.filter(r => r.entityType === 'credit_note');
        const sum = <T extends Partial<AmountField>>(items: T[], field: 'baseAmount' | 'retainedAmount') =>
            items.reduce((total, item) => total + Number(item[field] || 0), 0);

        const ivaCollected = sum(invoiceRetentions, 'retainedAmount');
        const ivaReversed = Math.abs(sum(creditNoteRetentions, 'retainedAmount'));
        const ivaNetSales = ivaCollected - ivaReversed;
        const ivaDeductible = sum(purchaseDeductions, 'retainedAmount');
        const ivaPayable = ivaNetSales - ivaDeductible;

        return {
            module: 'commercial',
            period: currentPeriod,
            isClosed,
            currentMonth: {
                taxableBase: sum(invoiceRetentions, 'baseAmount') - Math.abs(sum(creditNoteRetentions, 'baseAmount')),
                invoiceTaxableBase: sum(invoiceRetentions, 'baseAmount'),
                creditNoteTaxableBase: Math.abs(sum(creditNoteRetentions, 'baseAmount')),
                purchaseTaxableBase: sum(purchaseDeductions, 'baseAmount'),
                ivaCollected,
                ivaReversed,
                ivaNetSales,
                ivaDeductible,
                ivaPayable,
                invoiceCount: invoiceRetentions.length,
                creditNoteCount: creditNoteRetentions.length,
                purchaseOrderCount: purchaseDeductions.length,
                documentCount: periodRetentions.length + purchaseDeductions.length,
            },
            ytd: {
                ivaCollected: this.roundMoney(sum(ytdRetentions.filter(r => r.entityType === 'invoice'), 'retainedAmount')),
                ivaReversed: this.roundMoney(Math.abs(sum(ytdRetentions.filter(r => r.entityType === 'credit_note'), 'retainedAmount'))),
                ivaDeductible: this.roundMoney(sum(ytdPurchases, 'retainedAmount')),
                ivaPayable: this.roundMoney(sum(ytdRetentions, 'retainedAmount') - sum(ytdPurchases, 'retainedAmount')),
                documentCount: ytdRetentions.length + ytdPurchases.length,
            },
            purchaseDeductions,
            recentRetentions: [...periodDtos, ...purchaseDeductions]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10),
        };
    }

    async closeFiscalPeriod(companyId: string, period: string, userId?: string) {
        if (await this.isFiscalPeriodClosed(companyId, period)) {
            throw ApiError.badRequest(`Periodo fiscal ${period} ja esta fechado.`);
        }

        const summary = await this.getCommercialFiscalSummary(companyId, period);
        const reportData = {
            closedAt: new Date().toISOString(),
            summary,
        };

        return this.prisma.fiscalReport.create({
            data: {
                type: 'monthly_close',
                period,
                status: 'closed',
                reportData,
                submittedAt: new Date(),
                submittedBy: userId,
                companyId,
            }
        });
    }

    // Reopens a previously closed period. Always requires an approved request,
    // regardless of any threshold — this is a fiscally sensitive operation that
    // must always have a paper trail.
    async reopenFiscalPeriod(companyId: string, period: string, approvalId: string, userId?: string) {
        if (!approvalId) {
            throw ApiError.forbidden('Reabertura de período fiscal requer aprovação obrigatória.');
        }
        const approval = await approvalsService.findApprovedFor(
            companyId, 'fiscal_period_reopen', 'fiscal_period', period,
        );
        if (!approval || approval.id !== approvalId) {
            throw ApiError.forbidden('Aprovação não encontrada para este período.');
        }

        if (!(await this.isFiscalPeriodClosed(companyId, period))) {
            throw ApiError.badRequest(`Período fiscal ${period} não está fechado.`);
        }

        const report = await this.prisma.fiscalReport.findFirst({
            where: { companyId, period, type: 'monthly_close' },
            orderBy: { updatedAt: 'desc' },
        });
        if (!report) throw ApiError.notFound('Relatório fiscal de fecho não encontrado.');

        const updated = await this.prisma.fiscalReport.update({
            where: { id: report.id },
            data: { status: 'draft' as Prisma.FiscalReportUncheckedUpdateInput['status'], submittedAt: null, submittedBy: userId ?? null },
        });

        await approvalsService.markConsumed(approvalId, companyId).catch(() => {});
        return updated;
    }

    async getFiscalPeriodStatus(companyId: string, period: string) {
        const report = await this.prisma.fiscalReport.findFirst({
            where: { companyId, period, type: 'monthly_close' },
            orderBy: { updatedAt: 'desc' }
        });

        return {
            period,
            isClosed: Boolean(report && ['closed', 'submitted', 'accepted'].includes(report.status)),
            closedAt: report?.submittedAt || null,
            closedBy: report?.submittedBy || null,
            reportId: report?.id || null,
        };
    }
}

export const fiscalService = new FiscalService(prisma);
