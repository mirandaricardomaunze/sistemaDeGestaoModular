import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { ResultHandler, Result } from '../../utils/result';
import { round2 } from './shared';

export class CommercialFinancialService {

    async getAccountsReceivable(companyId: string, params: any = {}): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');

        const { page, limit, skip } = getPaginationParams(params);
        const { status, search } = params;

        const where: any = { companyId, amountDue: { gt: 0 } };
        if (status === 'overdue') {
            where.dueDate = { lt: new Date() };
            where.status = { in: ['sent', 'partial', 'overdue'] };
        } else if (status === 'pending') {
            where.status = { in: ['sent', 'partial'] };
            where.dueDate = { gte: new Date() };
        } else {
            where.status = { in: ['sent', 'partial', 'overdue'] };
        }
        if (search) {
            where.OR = [
                { customer: { name: { contains: String(search), mode: 'insensitive' } } },
                { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const [total, invoices] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: { customer: { select: { id: true, name: true, phone: true, code: true, currentBalance: true } } },
                orderBy: { dueDate: 'asc' },
                skip, take: limit,
            }),
        ]);

        const today = new Date();
        const data = invoices.map(inv => {
            const isOverdue = !!inv.dueDate && new Date(inv.dueDate) < today;
            const daysOverdue = isOverdue && inv.dueDate
                ? Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
                : 0;
            return {
                id: inv.id,
                number: inv.invoiceNumber,
                quotationId: inv.quotationId ?? null,
                customer: inv.customer,
                total: round2(Number(inv.total)),
                amountDue: round2(Number(inv.amountDue)),
                amountPaid: round2(Number(inv.total) - Number(inv.amountDue)),
                dueDate: inv.dueDate,
                status: inv.status,
                daysOverdue,
                isOverdue,
                createdAt: inv.createdAt,
            };
        });

        const totalReceivable = invoices.reduce((s, i) => s + Number(i.amountDue), 0);
        const overdueInvoices = invoices.filter(i => i.dueDate && new Date(i.dueDate) < today);

        return ResultHandler.success({
            ...createPaginatedResponse(data, page, limit, total),
            summary: {
                totalReceivable: Math.round(totalReceivable),
                overdueAmount: Math.round(overdueInvoices.reduce((s, i) => s + Number(i.amountDue), 0)),
                invoiceCount: total,
                overdueCount: overdueInvoices.length,
            },
        });
    }
}

export const commercialFinancialService = new CommercialFinancialService();
