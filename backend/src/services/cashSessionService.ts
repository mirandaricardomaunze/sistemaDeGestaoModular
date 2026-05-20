import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { auditService } from './auditService';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { approvalsService } from './approvalsService';
import { getThresholds, isOverThreshold } from './approvals/thresholds';
import { logger } from '../utils/logger';
import type { CashSessionHistoryQuery } from '../validation/cashSession';

type PaymentTotalKey = 'cash' | 'mpesa' | 'emola' | 'card' | 'credit';
type PaymentTotals = Record<PaymentTotalKey, number>;
type SalePaymentSummary = {
    paymentMethod: string;
    total: unknown;
    isCredit: boolean;
    paymentRef?: string | null;
    change?: unknown;
};
type PaymentReferenceEntry = { method?: string; amount?: number };

const PAYMENT_TOTAL_KEYS: readonly PaymentTotalKey[] = ['cash', 'mpesa', 'emola', 'card', 'credit'];
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isPaymentReferenceEntry(value: unknown): value is PaymentReferenceEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Record<string, unknown>;
    const methodOk = entry.method === undefined || typeof entry.method === 'string';
    const amountOk = entry.amount === undefined || typeof entry.amount === 'number';
    return methodOk && amountOk;
}

function isPaymentTotalKey(method: string): method is PaymentTotalKey {
    return PAYMENT_TOTAL_KEYS.includes(method as PaymentTotalKey);
}

function parseHistoryBoundary(value: string, endOfDay: boolean): Date {
    const match = DATE_ONLY_RE.exec(value);
    if (match) {
        const [, year, month, day] = match.map(Number);
        return new Date(
            year,
            month - 1,
            day,
            endOfDay ? 23 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 59 : 0,
            endOfDay ? 999 : 0,
        );
    }

    const date = new Date(value);
    if (endOfDay) date.setHours(23, 59, 59, 999);
    return date;
}

export class CashSessionService {
    private getPaymentTotals(sales: SalePaymentSummary[]): PaymentTotals {
        const totals: PaymentTotals = { cash: 0, mpesa: 0, emola: 0, card: 0, credit: 0 };

        for (const sale of sales) {
            const saleTotal = Number(sale.total || 0);
            if (sale.isCredit) {
                totals.credit += saleTotal;
                continue;
            }

            let parsed: Array<{ method?: string; amount?: number }> | null = null;
            if (sale.paymentRef) {
                try {
                    const value = JSON.parse(sale.paymentRef);
                    if (Array.isArray(value) && value.every(isPaymentReferenceEntry)) parsed = value;
                } catch {
                    parsed = null;
                }
            }

            if (!parsed || parsed.length === 0) {
                if (isPaymentTotalKey(sale.paymentMethod)) totals[sale.paymentMethod] += saleTotal;
                continue;
            }

            const change = Number(sale.change || 0);
            let remaining = saleTotal;
            for (const entry of parsed) {
                const method = entry.method;
                if (!method || !isPaymentTotalKey(method) || remaining <= 0) continue;
                const rawAmount = Number(entry.amount || 0);
                const netAmount = method === 'cash' ? Math.max(0, rawAmount - change) : rawAmount;
                const applied = Math.min(netAmount, remaining);
                totals[method] += applied;
                remaining -= applied;
            }
        }

        return totals;
    }

    /**
     * Get the currently open session for the company.
     * In professional retail, this could be filtered by terminalId or userId.
     */
    async getCurrentSession(companyId: string) {
        return prisma.cashSession.findFirst({
            where: { companyId, status: 'open' },
            include: {
                openedBy: { select: { id: true, name: true } },
                movements: {
                    include: { performedBy: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
    }

    /**
     * Open a new session with an initial balance, reserving a fiscal-number
     * block and an offline stock buffer atomically so the POS can sell offline
     * with valid fiscal numbers and without overselling between terminals.
     */
    async openSession(companyId: string, userId: string, openingBalance: number, warehouseId?: string, terminalId?: string) {
        const existing = await this.getCurrentSession(companyId);
        if (existing) throw ApiError.badRequest('Já existe uma sessão de caixa aberta para esta empresa');

        const FISCAL_BLOCK_SIZE = 100;
        const STOCK_BUFFER_PER_PRODUCT = 5;
        const STOCK_MIN_TO_RESERVE = 10;
        const STOCK_RESERVATION_TTL_HOURS = 24;

        const session = await prisma.$transaction(async (tx) => {
            const created = await tx.cashSession.create({
                data: {
                    companyId,
                    openedById: userId,
                    openingBalance: Number(openingBalance),
                    terminalId,
                    warehouseId: warehouseId || null,
                    status: 'open'
                },
                include: { openedBy: { select: { name: true } } }
            });

            // ── Fiscal block reservation (B7) ────────────────────────────────
            // SELECT FOR UPDATE to serialize concurrent shift openings on the
            // same series. We always reserve from the active 'FR' series.
            const seriesRows = (await tx.$queryRaw(Prisma.sql`
                SELECT id, series, "lastNumber" FROM document_series
                WHERE prefix = 'FR' AND "isActive" = true AND "companyId" = ${companyId}
                ORDER BY "createdAt" DESC
                LIMIT 1
                FOR UPDATE
            `)) as Array<{ id: string; series: string; lastNumber: number }>;

            let docSeries = seriesRows[0];
            if (!docSeries) {
                const yearCode = `FR-${new Date().getFullYear()}`;
                docSeries = await tx.documentSeries.upsert({
                    where: { companyId_code: { companyId, code: yearCode } },
                    update: { isActive: true, prefix: 'FR' },
                    create: {
                        code: yearCode,
                        name: `Faturas Recibo ${new Date().getFullYear()}`,
                        prefix: 'FR',
                        series: 'A',
                        lastNumber: 0,
                        isActive: true,
                        companyId
                    }
                });
            }

            const fromNumber = Number(docSeries.lastNumber) + 1;
            const toNumber = Number(docSeries.lastNumber) + FISCAL_BLOCK_SIZE;
            await tx.documentSeries.update({
                where: { id: docSeries.id },
                data: { lastNumber: toNumber }
            });
            await tx.documentSeriesReservation.create({
                data: {
                    seriesId: docSeries.id,
                    sessionId: created.id,
                    companyId,
                    fromNumber,
                    toNumber,
                    nextNumber: fromNumber,
                }
            });

            // ── Stock reservation buffer (B3) ────────────────────────────────
            // Reserve a small slice of in-stock products so an offline POS can
            // sell up to that quantity without risking overselling against
            // another terminal. Cap excludes scarce items (< 10 units).
            const productScope: Prisma.ProductWhereInput = {
                companyId,
                isActive: true,
                currentStock: { gte: STOCK_MIN_TO_RESERVE },
            };
            const products = await tx.product.findMany({
                where: productScope,
                select: { id: true, currentStock: true, reservedStock: true },
                take: 500, // safety cap to keep the transaction bounded
            });
            const expiresAt = new Date(Date.now() + STOCK_RESERVATION_TTL_HOURS * 60 * 60 * 1000);
            const reservations: Array<{ productId: string; quantity: number }> = [];
            for (const p of products) {
                const free = Number(p.currentStock) - Number(p.reservedStock);
                const reserveQty = Math.min(STOCK_BUFFER_PER_PRODUCT, Math.max(0, free));
                if (reserveQty <= 0) continue;
                reservations.push({ productId: p.id, quantity: reserveQty });
            }
            if (reservations.length > 0) {
                await tx.stockReservation.createMany({
                    data: reservations.map(r => ({
                        productId: r.productId,
                        quantity: r.quantity,
                        sessionId: created.id,
                        companyId,
                        expiresAt,
                    }))
                });
                // Update aggregated reservedStock so validateAvailability sees it.
                for (const r of reservations) {
                    await tx.product.update({
                        where: { id: r.productId },
                        data: { reservedStock: { increment: r.quantity } }
                    });
                }
            }

            return {
                ...created,
                fiscalReservation: {
                    seriesId: docSeries.id,
                    series: docSeries.series,
                    prefix: 'FR',
                    fromNumber,
                    toNumber,
                    nextNumber: fromNumber,
                },
                stockReservations: reservations,
            };
        });

        await auditService.log({
            userId,
            action: 'OPEN_SHIFT',
            entity: 'CashSession',
            entityId: session.id,
            newData: {
                openingBalance,
                fiscalBlock: { from: session.fiscalReservation.fromNumber, to: session.fiscalReservation.toNumber },
                stockReservationCount: session.stockReservations.length,
            },
            companyId
        });

        return session;
    }

    /**
     * Register a manual cash movement (Sangria or Suprimento).
     */
    async registerMovement(
        companyId: string,
        userId: string,
        data: { type: 'sangria' | 'suprimento', amount: number, reason: string, approvalId?: string },
    ) {
        const session = await this.getCurrentSession(companyId);
        if (!session) throw ApiError.notFound('Não há sessão de caixa aberta');

        // Cash drops above the configured threshold require manager approval.
        // Suprimentos (deposits) are inflow and not gated.
        if (data.type === 'sangria') {
            const thresholds = await getThresholds(companyId);
            if (isOverThreshold(thresholds, 'cashDrop', Number(data.amount))) {
                if (!data.approvalId) {
                    throw ApiError.forbidden(
                        `Sangria acima do limite (${thresholds.cashDrop}). Solicite aprovação.`
                    );
                }
                const approval = await approvalsService.findApprovedFor(
                    companyId, 'cash_drop', 'cash_session', session.id,
                );
                if (!approval || approval.id !== data.approvalId) {
                    throw ApiError.forbidden('Aprovação não encontrada ou não corresponde a esta sessão.');
                }
                if (approval.amount !== null && approval.amount + 0.01 < Number(data.amount)) {
                    throw ApiError.forbidden('O valor excede a aprovação concedida.');
                }
            }
        }

        const movement = await prisma.cashMovement.create({
            data: {
                sessionId: session.id,
                type: data.type,
                amount: Number(data.amount),
                reason: data.reason,
                performedById: userId
            }
        });

        if (data.approvalId) {
            await approvalsService.markConsumed(data.approvalId, companyId).catch(() => {});
        }

        // Update session totals
        const updateField = data.type === 'sangria' ? 'withdrawals' : 'deposits';
        await prisma.cashSession.update({
            where: { id: session.id },
            data: { [updateField]: { increment: Number(data.amount) } }
        });

        // Audit entry
        await auditService.log({
            userId,
            action: data.type.toUpperCase(),
            entity: 'CashSession',
            entityId: session.id,
            newData: movement,
            companyId
        });

        return movement;
    }

    /**
     * Close a session with blind counting.
     */
    async closeSession(companyId: string, userId: string, data: { closingBalance: number; notes?: string }) {
        const session = await this.getCurrentSession(companyId);
        if (!session) throw ApiError.notFound('Não há sessão de caixa aberta');

        // Fetch sales linked DIRECTLY to this session
        const finalSales = await prisma.sale.findMany({
            where: { sessionId: session.id },
            select: { paymentMethod: true, total: true, isCredit: true, paymentRef: true, change: true }
        });
        const byMethod = this.getPaymentTotals(finalSales);

        const stats = {
            cashSales: byMethod.cash,
            mpesaSales: byMethod.mpesa,
            emolaSales: byMethod.emola,
            cardSales: byMethod.card,
            creditSales: byMethod.credit,
            totalSales: finalSales.reduce((sum, s) => sum + Number(s.total), 0)
        };

        const expectedBalance = Number(session.openingBalance) + stats.cashSales - Number(session.withdrawals) + Number(session.deposits);
        const difference = Number(data.closingBalance) - expectedBalance;
        if (Math.abs(difference) >= 0.01 && (!data.notes || data.notes.trim().length < 5)) {
            throw ApiError.badRequest('Informe uma justificativa para diferenças no fecho de caixa');
        }

        const closedSession = await prisma.$transaction(async (tx) => {
            const updated = await tx.cashSession.update({
                where: { id: session.id },
                data: {
                    closedById: userId,
                    closedAt: new Date(),
                    closingBalance: Number(data.closingBalance),
                    expectedBalance,
                    difference,
                    ...stats,
                    notes: data.notes?.trim(),
                    status: 'closed'
                }
            });

            // Release stock reservations attached to this session — restores
            // reservedStock so other sessions can sell those units.
            const stockReservations = await tx.stockReservation.findMany({
                where: { sessionId: session.id },
                select: { productId: true, quantity: true },
            });
            if (stockReservations.length > 0) {
                for (const r of stockReservations) {
                    await tx.product.update({
                        where: { id: r.productId },
                        data: { reservedStock: { decrement: Number(r.quantity) } }
                    });
                }
                await tx.stockReservation.deleteMany({ where: { sessionId: session.id } });
            }

            // Mark fiscal block as released — unused numbers in [nextNumber, toNumber]
            // become gaps in the series. Gaps are legally acceptable in MZ
            // provided audit trail is preserved; reusing them is not.
            await tx.documentSeriesReservation.updateMany({
                where: { sessionId: session.id, releasedAt: null },
                data: { releasedAt: new Date() }
            });

            return updated;
        });

        // Audit entry for the close
        await auditService.log({
            userId,
            action: 'CLOSE_SHIFT',
            entity: 'CashSession',
            entityId: session.id,
            newData: { closedSession },
            companyId
        });

        // Security Alert: If significant discrepancy, log as warning
        if (Math.abs(difference) > 10) { // Threshold for warning
            logger.warn('Cash discrepancy detected on shift close', {
                sessionId: session.id,
                difference,
                companyId,
            });
        }

        return closedSession;
    }

    /**
     * List session history with pagination.
     */
    async getHistory(companyId: string, params: CashSessionHistoryQuery) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: Prisma.CashSessionWhereInput = { companyId, status: 'closed' };

        if (params.startDate && params.endDate) {
            where.closedAt = {
                gte: parseHistoryBoundary(params.startDate, false),
                lte: parseHistoryBoundary(params.endDate, true)
            };
        }

        if (params.openedById) where.openedById = params.openedById;
        if (params.warehouseId) where.warehouseId = params.warehouseId;
        if (params.search) {
            where.openedBy = {
                name: { contains: params.search, mode: 'insensitive' }
            };
        }

        const [total, sessions] = await Promise.all([
            prisma.cashSession.count({ where }),
            prisma.cashSession.findMany({
                where,
                include: {
                    openedBy: { select: { id: true, name: true } },
                    closedBy: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, code: true, name: true, location: true } },
                    _count: { select: { sales: true } }
                },
                orderBy: { closedAt: 'desc' },
                skip,
                take: limit
            }),
        ]);

        return createPaginatedResponse(sessions, page, limit, total);
    }

    /**
     * Get a real-time summary of the current open session (vendas por método).
     */
    async getDailySummary(companyId: string) {
        const session = await this.getCurrentSession(companyId);
        if (!session) return null;

        const sales = await prisma.sale.findMany({
            where: { sessionId: session.id },
            select: { paymentMethod: true, total: true, isCredit: true, paymentRef: true, change: true }
        });
        const byMethod = this.getPaymentTotals(sales);

        return {
            cashSales: byMethod.cash,
            mpesaSales: byMethod.mpesa,
            emolaSales: byMethod.emola,
            cardSales: byMethod.card,
            creditSales: byMethod.credit,
            totalSales: sales.reduce((sum, s) => sum + Number(s.total), 0),
            openingBalance: Number(session.openingBalance),
            withdrawals: Number(session.withdrawals),
            deposits: Number(session.deposits),
            currentExpected: Number(session.openingBalance) + 
                byMethod.cash -
                Number(session.withdrawals) + Number(session.deposits)
        };
    }

    /**
     * Generate a Z-Report for the current open session or the last closed one.
     */
    async getZReport(companyId: string, sessionId?: string) {
        const sessionInclude = {
            openedBy: { select: { id: true, name: true } },
            closedBy: { select: { id: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true, location: true } },
            movements: { include: { performedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } },
        };

        let session = sessionId
            ? await prisma.cashSession.findFirst({
                where: { id: sessionId, companyId },
                include: sessionInclude
            })
            : await prisma.cashSession.findFirst({
                where: { companyId, status: 'open' },
                include: sessionInclude
            });

        if (!session && !sessionId) {
            session = await prisma.cashSession.findFirst({
                where: { companyId, status: 'closed' },
                orderBy: { closedAt: 'desc' },
                include: sessionInclude
            });
        }

        if (!session) throw ApiError.notFound('Nenhuma sessão de caixa encontrada');

        const sales = await prisma.sale.findMany({
            where: { sessionId: session.id },
            include: {
                customer: { select: { name: true } },
                items: { include: { product: { select: { name: true, category: true } } } },
            },
            orderBy: { createdAt: 'asc' },
        });

        const byMethod = this.getPaymentTotals(sales);

        const totalSales = Object.values(byMethod).reduce((a, v) => a + v, 0);
        const totalTax = sales.reduce((a, s) => a + Number(s.tax || 0), 0);
        const totalWithdrawals = Number(session.withdrawals || 0);
        const totalDeposits = Number(session.deposits || 0);
        const openingBalance = Number(session.openingBalance || 0);
        const expectedBalance = openingBalance + byMethod.cash - totalWithdrawals + totalDeposits;
        const closingBalance = session.closingBalance == null ? null : Number(session.closingBalance);
        const difference = closingBalance == null ? null : closingBalance - expectedBalance;

        // Top products sold this session
        const productSales: Record<string, { name: string; qty: number; total: number }> = {};
        for (const sale of sales) {
            for (const item of sale.items) {
                const name = item.product?.name || 'Desconhecido';
                if (!productSales[name]) productSales[name] = { name, qty: 0, total: 0 };
                productSales[name].qty += Number(item.quantity);
                productSales[name].total += Number(item.total || 0);
            }
        }
        const topProducts = Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, 10);

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { name: true, address: true, phone: true, nuit: true }
        });

        return {
            session: { ...session, openedByName: session.openedBy.name, closedByName: session.closedBy?.name },
            company,
            byMethod,
            paymentMethods: [
                { key: 'cash', label: 'Dinheiro', amount: byMethod.cash },
                { key: 'mpesa', label: 'M-Pesa', amount: byMethod.mpesa },
                { key: 'emola', label: 'e-Mola', amount: byMethod.emola },
                { key: 'card', label: 'Cartao/TPA', amount: byMethod.card },
                { key: 'credit', label: 'Credito', amount: byMethod.credit },
            ],
            cashFlow: {
                openingBalance,
                cashSales: byMethod.cash,
                deposits: totalDeposits,
                withdrawals: totalWithdrawals,
                expectedBalance,
                closingBalance,
                difference,
                requiresReview: difference == null ? false : Math.abs(difference) >= 0.01,
            },
            totalSales,
            totalTax,
            totalTransactions: sales.length,
            totalWithdrawals,
            totalDeposits,
            openingBalance,
            expectedBalance,
            closingBalance: closingBalance || 0,
            difference: difference || 0,
            movements: session.movements,
            topProducts,
            sales: sales.map(sale => ({
                id: sale.id,
                createdAt: sale.createdAt,
                receiptNumber: sale.receiptNumber,
                paymentMethod: sale.paymentMethod,
                customerName: sale.customer?.name,
                subtotal: Number(sale.subtotal || 0),
                tax: Number(sale.tax || 0),
                total: Number(sale.total || 0),
            })),
            generatedAt: new Date(),
        };
    }

    /**
     * Get a detailed summary of a specific session (for Z-Report).
     */
    async getSessionDetails(sessionId: string, companyId: string) {
        const session = await prisma.cashSession.findFirst({
            where: { id: sessionId, companyId },
            include: {
                openedBy: { select: { id: true, name: true } },
                closedBy: { select: { id: true, name: true } },
                warehouse: { select: { id: true, code: true, name: true, location: true } },
                movements: { include: { performedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
                sales: {
                    include: { customer: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!session) throw ApiError.notFound('Sessão não encontrada');
        return session;
    }
}

export const cashSessionService = new CashSessionService();
