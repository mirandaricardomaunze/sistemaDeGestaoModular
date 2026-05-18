import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { createPaginatedResponse } from '../../utils/pagination';
import { ResultHandler, Result } from '../../utils/result';
import { round2 } from './shared';

type AccountsReceivableFilter = 'all' | 'overdue' | 'pending';

export interface AccountsReceivableParams {
    page?: number | string;
    limit?: number | string;
    status?: AccountsReceivableFilter;
    search?: string;
}

export interface ReceivableInvoiceDTO {
    id: string;
    number: string;
    quotationId: string | null;
    customer: {
        id: string;
        name: string;
        phone: string;
        code: string;
        currentBalance: Prisma.Decimal;
    } | null;
    total: number;
    amountDue: number;
    amountPaid: number;
    dueDate: Date | null;
    status: string;
    daysOverdue: number;
    isOverdue: boolean;
    createdAt: Date;
}

export interface AccountsReceivableResult {
    data: ReceivableInvoiceDTO[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    summary: {
        totalReceivable: number;
        overdueAmount: number;
        invoiceCount: number;
        overdueCount: number;
    };
}

const RECEIVABLE_STATUSES = ['sent', 'partial', 'overdue'] as const;

export class CommercialFinancialService {
    async getAccountsReceivable(
        companyId: string,
        params: AccountsReceivableParams = {}
    ): Promise<Result<AccountsReceivableResult>> {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');

        const { page, limit, skip } = this.getPagination(params);
        const where = this.buildReceivablesWhere(companyId, params);

        const [total, invoices] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: { customer: { select: { id: true, name: true, phone: true, code: true, currentBalance: true } } },
                orderBy: { dueDate: 'asc' },
                skip,
                take: limit,
            }),
        ]);

        const today = new Date();
        const data = invoices.map(invoice => this.toReceivableDTO(invoice, today));
        const overdueInvoices = invoices.filter(invoice => this.isOverdue(invoice.dueDate, today));

        return ResultHandler.success({
            ...createPaginatedResponse(data, page, limit, total),
            summary: {
                totalReceivable: Math.round(invoices.reduce((sum, invoice) => sum + Number(invoice.amountDue), 0)),
                overdueAmount: Math.round(overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amountDue), 0)),
                invoiceCount: total,
                overdueCount: overdueInvoices.length,
            },
        });
    }

    private buildReceivablesWhere(
        companyId: string,
        params: AccountsReceivableParams
    ): Prisma.InvoiceWhereInput {
        const today = new Date();
        const where: Prisma.InvoiceWhereInput = { companyId, amountDue: { gt: 0 } };

        if (params.status === 'overdue') {
            where.dueDate = { lt: today };
            where.status = { in: [...RECEIVABLE_STATUSES] };
        } else if (params.status === 'pending') {
            where.status = { in: ['sent', 'partial'] };
            where.dueDate = { gte: today };
        } else {
            where.status = { in: [...RECEIVABLE_STATUSES] };
        }

        if (params.search) {
            where.OR = [
                { customer: { name: { contains: params.search, mode: 'insensitive' } } },
                { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        return where;
    }

    private toReceivableDTO(
        invoice: Prisma.InvoiceGetPayload<{
            include: { customer: { select: { id: true; name: true; phone: true; code: true; currentBalance: true } } }
        }>,
        today: Date
    ): ReceivableInvoiceDTO {
        const isOverdue = this.isOverdue(invoice.dueDate, today);
        const daysOverdue = isOverdue && invoice.dueDate
            ? Math.floor((today.getTime() - invoice.dueDate.getTime()) / 86400000)
            : 0;

        return {
            id: invoice.id,
            number: invoice.invoiceNumber,
            quotationId: invoice.quotationId ?? null,
            customer: invoice.customer,
            total: round2(Number(invoice.total)),
            amountDue: round2(Number(invoice.amountDue)),
            amountPaid: round2(Number(invoice.total) - Number(invoice.amountDue)),
            dueDate: invoice.dueDate,
            status: invoice.status,
            daysOverdue,
            isOverdue,
            createdAt: invoice.createdAt,
        };
    }

    private isOverdue(dueDate: Date | null, today: Date): boolean {
        return Boolean(dueDate && dueDate < today);
    }

    private getPagination(params: AccountsReceivableParams): { page: number; limit: number; skip: number } {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
        return { page, limit, skip: (page - 1) * limit };
    }
}

export const commercialFinancialService = new CommercialFinancialService();
