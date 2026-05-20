import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../utils/pagination';

const CUSTOMER_FIELD_ALLOWLIST = [
    'id', 'code', 'name', 'type', 'document', 'taxId',
    'phone', 'email', 'address', 'city', 'province',
    'creditLimit', 'currentBalance', 'isActive',
    'createdAt', 'updatedAt'
] as const;

type ListQuery = {
    page?: string | number;
    limit?: string | number;
    search?: string;
    type?: string;
    isActive?: string | boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string;
};

type CustomerInput = {
    code?: string;
    companyId?: string;
    name?: string;
    type?: string;
    document?: string | null;
    taxId?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    creditLimit?: number | string | null;
    currentBalance?: number | string | null;
    isActive?: boolean;
    [key: string]: unknown;
};

type PurchasesQuery = {
    page?: string | number;
    limit?: string | number;
    startDate?: string;
    endDate?: string;
};

type AccountPaymentInput = {
    targetType: 'invoice' | 'credit_sale';
    targetId: string;
    amount: number;
    method: 'cash' | 'card' | 'transfer' | 'check' | 'mpesa' | 'emola' | 'other';
    reference?: string | null;
    notes?: string | null;
    sessionId?: string | null;
};

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function normalizePaymentMethod(method: AccountPaymentInput['method']): PaymentMethod {
    if (method === 'check' || method === 'other') return 'transfer';
    return method as PaymentMethod;
}

export class CustomersService {
    private async generateCustomerCode(companyId: string) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const suffix = `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
            const code = `CLI-${suffix}`;
            const existing = await prisma.customer.findFirst({ where: { companyId, code }, select: { id: true } });
            if (!existing) return code;
        }
        throw ApiError.conflict('Nao foi possivel gerar um codigo unico para o cliente. Tente novamente.');
    }

    async list(params: ListQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            search,
            type,
            isActive,
            sortBy = 'name',
            sortOrder = 'asc'
        } = params;

        const where: Prisma.CustomerWhereInput = { companyId };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { phone: { contains: String(search) } },
                { email: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        if (type) where.type = type as Prisma.EnumCustomerTypeFilter['equals'];
        if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

        const projection = parseFields(params.fields, CUSTOMER_FIELD_ALLOWLIST);
        const findArgs: Prisma.CustomerFindManyArgs = {
            where,
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit
        };
        if (projection) findArgs.select = projection satisfies Prisma.CustomerSelect;

        const [total, customers] = await Promise.all([
            prisma.customer.count({ where }),
            prisma.customer.findMany(findArgs)
        ]);

        return createPaginatedResponse(customers, page, limit, total);
    }

    async getById(id: string, companyId: string) {
        const customer = await prisma.customer.findFirst({
            where: { id, companyId },
            include: {
                sales: { take: 10, orderBy: { createdAt: 'desc' } },
                invoices: { take: 10, orderBy: { createdAt: 'desc' } }
            }
        });

        if (!customer) throw ApiError.notFound('Cliente não encontrado');
        return customer;
    }

    async create(data: CustomerInput, companyId: string) {
        const customerCode = data.code?.trim() || await this.generateCustomerCode(companyId);
        const { code: _code, companyId: _dataCompanyId, ...customerData } = data;

        return prisma.customer.create({
            data: {
                ...(customerData as Prisma.CustomerUncheckedCreateInput),
                code: customerCode,
                phone: customerData.phone || '',
                companyId
            }
        });
    }

    async update(id: string, data: CustomerInput, companyId: string) {
        const updateData: Prisma.CustomerUpdateInput = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== null) (updateData as Record<string, unknown>)[key] = value;
        }

        const result = await prisma.customer.updateMany({
            where: { id, companyId },
            data: updateData
        });

        if (result.count === 0) throw ApiError.notFound('Cliente não encontrado ou acesso negado');

        const updated = await prisma.customer.findUnique({ where: { id } });
        if (!updated) throw ApiError.notFound('Cliente não encontrado');
        return updated;
    }

    async delete(id: string, companyId: string) {
        const result = await prisma.customer.updateMany({
            where: { id, companyId },
            data: { isActive: false }
        });

        if (result.count === 0) throw ApiError.notFound('Cliente não encontrado ou acesso negado');
        return true;
    }

    async getPurchases(id: string, params: PurchasesQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const { startDate, endDate } = params;

        const where: Prisma.SaleWhereInput = {
            customerId: id,
            customer: { companyId }
        };

        if (startDate || endDate) {
            const dateFilter: Prisma.DateTimeFilter = {};
            if (startDate) dateFilter.gte = new Date(String(startDate));
            if (endDate) dateFilter.lte = new Date(String(endDate));
            where.createdAt = dateFilter;
        }

        const [total, sales] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.findMany({
                where,
                include: { items: { include: { product: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        return createPaginatedResponse(sales, page, limit, total);
    }

    async getAccount(id: string, companyId: string) {
        const customer = await prisma.customer.findFirst({
            where: { id, companyId },
            select: {
                id: true,
                code: true,
                name: true,
                email: true,
                phone: true,
                creditLimit: true,
                currentBalance: true,
                totalPurchases: true
            }
        });

        if (!customer) throw ApiError.notFound('Cliente nÃ£o encontrado');

        const now = new Date();
        const [invoices, recentInvoicePayments, creditSales] = await Promise.all([
            prisma.invoice.findMany({
                where: {
                    companyId,
                    customerId: id,
                    status: { not: 'cancelled' }
                },
                orderBy: { issueDate: 'desc' },
                take: 20,
                select: {
                    id: true,
                    invoiceNumber: true,
                    issueDate: true,
                    dueDate: true,
                    total: true,
                    amountPaid: true,
                    amountDue: true,
                    status: true,
                    payments: {
                        orderBy: { date: 'desc' },
                        take: 5,
                        select: { id: true, date: true, amount: true, method: true, reference: true, notes: true }
                    },
                    creditNotes: {
                        where: { status: { in: ['issued', 'refunded'] } },
                        select: { id: true, number: true, total: true, status: true, issueDate: true }
                    },
                    debitNotes: {
                        where: { status: { not: 'cancelled' } },
                        select: { id: true, number: true, total: true, status: true, issueDate: true }
                    }
                }
            }),
            prisma.invoicePayment.findMany({
                where: { invoice: { companyId, customerId: id } },
                orderBy: { date: 'desc' },
                take: 10,
                select: {
                    id: true,
                    date: true,
                    amount: true,
                    method: true,
                    reference: true,
                    invoice: { select: { id: true, invoiceNumber: true } }
                }
            }),
            prisma.sale.findMany({
                where: {
                    companyId,
                    customerId: id,
                    isCredit: true,
                    voidStatus: { not: 'voided' }
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    receiptNumber: true,
                    createdAt: true,
                    dueDate: true,
                    total: true,
                    paidAmount: true,
                    paymentMethod: true,
                    creditPayments: {
                        orderBy: { paidAt: 'desc' },
                        take: 5,
                        select: { id: true, paidAt: true, amount: true, paymentMethod: true, reference: true, notes: true }
                    }
                }
            })
        ]);

        const invoiceDebt = invoices.reduce((sum, inv) => sum + Number(inv.amountDue), 0);
        const overdueDebt = invoices
            .filter(inv => Number(inv.amountDue) > 0 && inv.dueDate < now)
            .reduce((sum, inv) => sum + Number(inv.amountDue), 0);
        const invoicePaid = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
        const invoiceTotal = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

        const creditSalesWithBalance = creditSales.map(sale => {
            const total = Number(sale.total);
            const paidAmount = Number(sale.paidAmount);
            return {
                id: sale.id,
                receiptNumber: sale.receiptNumber,
                createdAt: sale.createdAt,
                dueDate: sale.dueDate,
                total,
                paidAmount,
                amountDue: Math.max(0, total - paidAmount),
                paymentMethod: sale.paymentMethod,
                payments: sale.creditPayments.map(payment => ({
                    id: payment.id,
                    date: payment.paidAt,
                    amount: Number(payment.amount),
                    method: payment.paymentMethod,
                    reference: payment.reference,
                    notes: payment.notes
                }))
            };
        });

        const creditSalesDebt = creditSalesWithBalance.reduce((sum, sale) => sum + sale.amountDue, 0);
        const manualBalance = Number(customer.currentBalance);
        const positiveManualBalance = Math.max(0, manualBalance);

        return {
            customer: {
                ...customer,
                creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
                currentBalance: manualBalance,
                totalPurchases: Number(customer.totalPurchases)
            },
            summary: {
                invoiceTotal,
                invoicePaid,
                invoiceDebt,
                overdueDebt,
                creditSalesDebt,
                manualBalance,
                totalOutstanding: invoiceDebt + creditSalesDebt + positiveManualBalance,
                openInvoiceCount: invoices.filter(inv => Number(inv.amountDue) > 0).length,
                overdueInvoiceCount: invoices.filter(inv => Number(inv.amountDue) > 0 && inv.dueDate < now).length,
                creditSaleCount: creditSalesWithBalance.filter(sale => sale.amountDue > 0).length
            },
            invoices: invoices.map(inv => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                issueDate: inv.issueDate,
                dueDate: inv.dueDate,
                total: Number(inv.total),
                amountPaid: Number(inv.amountPaid),
                amountDue: Number(inv.amountDue),
                status: inv.status,
                isOverdue: Number(inv.amountDue) > 0 && inv.dueDate < now,
                payments: inv.payments.map(payment => ({
                    id: payment.id,
                    date: payment.date,
                    amount: Number(payment.amount),
                    method: payment.method,
                    reference: payment.reference,
                    notes: payment.notes
                })),
                creditNotes: inv.creditNotes.map(note => ({
                    id: note.id,
                    number: note.number,
                    total: Number(note.total),
                    status: note.status,
                    issueDate: note.issueDate
                })),
                debitNotes: inv.debitNotes.map(note => ({
                    id: note.id,
                    number: note.number,
                    total: Number(note.total),
                    status: note.status,
                    issueDate: note.issueDate
                }))
            })),
            creditSales: creditSalesWithBalance,
            recentPayments: recentInvoicePayments.map(payment => ({
                id: payment.id,
                date: payment.date,
                amount: Number(payment.amount),
                method: payment.method,
                reference: payment.reference,
                invoice: payment.invoice
            }))
        };
    }

    async registerAccountPayment(id: string, data: AccountPaymentInput, companyId: string, receivedBy: string) {
        const amount = roundMoney(Number(data.amount));
        if (amount <= 0) throw ApiError.badRequest('Valor deve ser maior que zero');

        const customer = await prisma.customer.findFirst({
            where: { id, companyId },
            select: { id: true }
        });
        if (!customer) throw ApiError.notFound('Cliente nao encontrado');

        if (data.targetType === 'invoice') {
            const invoice = await prisma.invoice.findFirst({
                where: {
                    id: data.targetId,
                    companyId,
                    customerId: id,
                    status: { not: 'cancelled' }
                }
            });

            if (!invoice) throw ApiError.notFound('Fatura nao encontrada para este cliente');

            const currentDue = roundMoney(Number(invoice.amountDue || 0));
            if (currentDue <= 0) throw ApiError.badRequest('Esta fatura ja esta liquidada');
            if (amount > currentDue) {
                throw ApiError.badRequest(`Valor excede o saldo da fatura (${currentDue.toFixed(2)} MT)`);
            }

            const newAmountPaid = roundMoney(Number(invoice.amountPaid || 0) + amount);
            const newAmountDue = roundMoney(Math.max(0, currentDue - amount));
            const newStatus = newAmountDue <= 0 ? 'paid' : 'partial';

            const payment = await prisma.$transaction(async (tx) => {
                const createdPayment = await tx.invoicePayment.create({
                    data: {
                        invoiceId: invoice.id,
                        amount,
                        method: normalizePaymentMethod(data.method),
                        reference: data.reference?.trim() || undefined,
                        notes: data.notes?.trim() || undefined
                    }
                });

                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        amountPaid: newAmountPaid,
                        amountDue: newAmountDue,
                        status: newStatus,
                        paidDate: newStatus === 'paid' ? new Date() : null
                    }
                });

                return createdPayment;
            });

            return { payment, account: await this.getAccount(id, companyId) };
        }

        const sale = await prisma.sale.findFirst({
            where: {
                id: data.targetId,
                companyId,
                customerId: id,
                isCredit: true,
                voidStatus: { not: 'voided' }
            }
        });

        if (!sale) throw ApiError.notFound('Venda a credito nao encontrada para este cliente');

        const remaining = roundMoney(Number(sale.total || 0) - Number(sale.paidAmount || 0));
        if (remaining <= 0) throw ApiError.badRequest('Esta venda a credito ja esta liquidada');
        if (amount > remaining) {
            throw ApiError.badRequest(`Valor excede o saldo da venda (${remaining.toFixed(2)} MT)`);
        }
        if (!sale.customerId) throw ApiError.badRequest('Venda sem cliente associado');

        const session = data.sessionId
            ? await prisma.cashSession.findFirst({
                where: { id: data.sessionId, companyId, status: 'open' }
            })
            : await prisma.cashSession.findFirst({
                where: { companyId, status: 'open' },
                orderBy: { openedAt: 'desc' }
            });

        if (!session) {
            throw ApiError.badRequest('Abra uma sessao de caixa para registar pagamentos de vendas a credito.');
        }

        const payment = await prisma.$transaction(async (tx) => {
            const createdPayment = await tx.creditPayment.create({
                data: {
                    companyId,
                    saleId: sale.id,
                    customerId: sale.customerId!,
                    amount,
                    paymentMethod: normalizePaymentMethod(data.method),
                    reference: data.reference?.trim() || undefined,
                    notes: data.notes?.trim() || undefined,
                    receivedBy
                }
            });

            await tx.sale.update({
                where: { id: sale.id },
                data: { paidAmount: { increment: amount } }
            });

            return createdPayment;
        });

        return { payment, account: await this.getAccount(id, companyId) };
    }

    async updateBalance(id: string, data: { amount: number, operation: string }, companyId: string) {
        const customer = await prisma.customer.findFirst({
            where: { id, companyId }
        });

        if (!customer) throw ApiError.notFound('Cliente não encontrado');

        let newBalance = Number(customer.currentBalance);
        if (data.operation === 'add') newBalance += data.amount;
        else if (data.operation === 'subtract') newBalance -= data.amount;
        else if (data.operation === 'set') newBalance = data.amount;

        const result = await prisma.customer.updateMany({
            where: { id, companyId },
            data: { currentBalance: newBalance }
        });

        if (result.count === 0) throw ApiError.notFound('Cliente não encontrado ou acesso negado');

        const updated = await prisma.customer.findUnique({ where: { id } });
        if (!updated) throw ApiError.notFound('Cliente não encontrado');
        return updated;
    }
}

export const customersService = new CustomersService();
