import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { auditService } from './auditService';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

export class CashSessionService {
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
     * Open a new session with an initial balance.
     */
    async openSession(companyId: string, userId: string, openingBalance: number, warehouseId?: string, terminalId?: string) {
        const existing = await this.getCurrentSession(companyId);
        if (existing) throw ApiError.badRequest('Já existe uma sessão de caixa aberta para esta empresa');

        const session = await prisma.cashSession.create({
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

        // Audit entry
        await auditService.log({
            userId,
            action: 'OPEN_SHIFT',
            entity: 'CashSession',
            entityId: session.id,
            newData: { openingBalance },
            companyId
        });

        return session;
    }

    /**
     * Register a manual cash movement (Sangria or Suprimento).
     */
    async registerMovement(companyId: string, userId: string, data: { type: 'sangria' | 'suprimento', amount: number, reason: string }) {
        const session = await this.getCurrentSession(companyId);
        if (!session) throw ApiError.notFound('Não há sessão de caixa aberta');

        const movement = await prisma.cashMovement.create({
            data: {
                sessionId: session.id,
                type: data.type,
                amount: Number(data.amount),
                reason: data.reason,
                performedById: userId
            }
        });

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

        // Professional logic: Fetch sales linked DIRECTLY to this session
        const sales = await prisma.sale.findMany({
            where: { sessionId: session.id },
            select: { paymentMethod: true, total: true, isCredit: true }
        });

        // If no sales are linked (old data fallback), use date range
        let finalSales = sales;
        if (sales.length === 0) {
            finalSales = await prisma.sale.findMany({
                where: { companyId, createdAt: { gte: session.openedAt } },
                select: { paymentMethod: true, total: true, isCredit: true }
            });
        }

        const stats = {
            cashSales: finalSales.filter(s => s.paymentMethod === 'cash' && !s.isCredit).reduce((sum, s) => sum + Number(s.total), 0),
            mpesaSales: finalSales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + Number(s.total), 0),
            emolaSales: finalSales.filter(s => s.paymentMethod === 'emola').reduce((sum, s) => sum + Number(s.total), 0),
            cardSales: finalSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + Number(s.total), 0),
            creditSales: finalSales.filter(s => s.isCredit).reduce((sum, s) => sum + Number(s.total), 0),
            totalSales: finalSales.reduce((sum, s) => sum + Number(s.total), 0)
        };

        const expectedBalance = Number(session.openingBalance) + stats.cashSales - Number(session.withdrawals) + Number(session.deposits);
        const difference = Number(data.closingBalance) - expectedBalance;

        const closedSession = await prisma.cashSession.update({
            where: { id: session.id },
            data: {
                closedById: userId, 
                closedAt: new Date(), 
                closingBalance: Number(data.closingBalance), 
                expectedBalance, 
                difference,
                ...stats,
                notes: data.notes, 
                status: 'closed'
            }
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
            console.warn(`[CASH_DISCREPANCY] Shift ${session.id} closed with ${difference} difference.`);
        }

        return closedSession;
    }

    /**
     * List session history with pagination.
     */
    async getHistory(companyId: string, params: any) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: any = { companyId, status: 'closed' };

        if (params.startDate && params.endDate) {
            where.closedAt = { gte: new Date(params.startDate), lte: new Date(params.endDate) };
        }

        if (params.openedById) where.openedById = params.openedById;

        const [total, sessions] = await Promise.all([
            prisma.cashSession.count({ where }),
            prisma.cashSession.findMany({
                where,
                include: {
                    openedBy: { select: { id: true, name: true } },
                    closedBy: { select: { id: true, name: true } },
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
            select: { paymentMethod: true, total: true, isCredit: true }
        });

        return {
            cashSales: sales.filter(s => s.paymentMethod === 'cash' && !s.isCredit).reduce((sum, s) => sum + Number(s.total), 0),
            mpesaSales: sales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + Number(s.total), 0),
            emolaSales: sales.filter(s => s.paymentMethod === 'emola').reduce((sum, s) => sum + Number(s.total), 0),
            cardSales: sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + Number(s.total), 0),
            creditSales: sales.filter(s => s.isCredit).reduce((sum, s) => sum + Number(s.total), 0),
            totalSales: sales.reduce((sum, s) => sum + Number(s.total), 0),
            openingBalance: Number(session.openingBalance),
            withdrawals: Number(session.withdrawals),
            deposits: Number(session.deposits),
            currentExpected: Number(session.openingBalance) + 
                sales.filter(s => s.paymentMethod === 'cash' && !s.isCredit).reduce((sum, s) => sum + Number(s.total), 0) - 
                Number(session.withdrawals) + Number(session.deposits)
        };
    }

    /**
     * Generate a Z-Report for the current open session or the last closed one.
     */
    async getZReport(companyId: string) {
        // Try current open session first, fallback to last closed
        let session = await prisma.cashSession.findFirst({
            where: { companyId, status: 'open' },
            include: {
                openedBy: { select: { name: true } },
                closedBy: { select: { name: true } },
                movements: { include: { performedBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
            }
        });

        if (!session) {
            session = await prisma.cashSession.findFirst({
                where: { companyId, status: 'closed' },
                orderBy: { closedAt: 'desc' },
                include: {
                    openedBy: { select: { name: true } },
                    closedBy: { select: { name: true } },
                    movements: { include: { performedBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
                }
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

        const byMethod = {
            cash: sales.filter(s => s.paymentMethod === 'cash' && !s.isCredit).reduce((a, s) => a + Number(s.total), 0),
            mpesa: sales.filter(s => s.paymentMethod === 'mpesa').reduce((a, s) => a + Number(s.total), 0),
            emola: sales.filter(s => s.paymentMethod === 'emola').reduce((a, s) => a + Number(s.total), 0),
            card: sales.filter(s => s.paymentMethod === 'card').reduce((a, s) => a + Number(s.total), 0),
            credit: sales.filter(s => s.isCredit).reduce((a, s) => a + Number(s.total), 0),
        };

        const totalSales = Object.values(byMethod).reduce((a, v) => a + v, 0);
        const totalTax = sales.reduce((a, s) => a + Number(s.tax || 0), 0);
        const totalWithdrawals = Number(session.withdrawals || 0);
        const totalDeposits = Number(session.deposits || 0);
        const openingBalance = Number(session.openingBalance || 0);
        const expectedBalance = openingBalance + byMethod.cash - totalWithdrawals + totalDeposits;

        // Top products sold this session
        const productSales: Record<string, { name: string; qty: number; total: number }> = {};
        for (const sale of sales) {
            for (const item of sale.items) {
                const name = item.product?.name || 'Desconhecido';
                if (!productSales[name]) productSales[name] = { name, qty: 0, total: 0 };
                productSales[name].qty += item.quantity;
                productSales[name].total += Number(item.unitPrice) * item.quantity;
            }
        }
        const topProducts = Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, 10);

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { name: true, address: true, phone: true, nuit: true }
        });

        return {
            session: { ...session, openedByName: (session.openedBy as any)?.name, closedByName: (session.closedBy as any)?.name },
            company,
            byMethod,
            totalSales,
            totalTax,
            totalTransactions: sales.length,
            totalWithdrawals,
            totalDeposits,
            openingBalance,
            expectedBalance,
            closingBalance: Number(session.closingBalance || 0),
            difference: Number(session.difference || 0),
            movements: session.movements,
            topProducts,
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
                openedBy: { select: { name: true } },
                closedBy: { select: { name: true } },
                movements: { include: { performedBy: { select: { name: true } } } },
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
