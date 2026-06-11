import { Prisma, InvoiceStatus, PaymentMethod } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta, parseFields } from '../utils/pagination';
import { stockService } from './stockService';
import { logger } from '../utils/logger';
import { ResultHandler } from '../utils/result';
import { auditService } from './auditService';
import { approvalsService } from './approvalsService';
import { getThresholds, isOverThreshold } from './approvals/thresholds';
import { validateQuantityForUnit } from '../constants/unitOfMeasure';

/**
 * Fiscal hash chain per AT-MZ requirement: each invoice hashes
 * (issueDate|invoiceNumber|grossTotal|previousHash). The chain lets the auditor
 * detect tampering — flipping any field invalidates every subsequent hash.
 * See [[saft-xml]] skill.
 */
function buildFiscalHash(params: {
    issueDate: Date;
    invoiceNumber: string;
    grossTotal: number;
    previousHash: string | null;
}): string {
    const payload = [
        params.issueDate.toISOString().slice(0, 19), // up to seconds, no tz
        params.invoiceNumber,
        params.grossTotal.toFixed(2),
        params.previousHash ?? '',
    ].join('|');
    return createHash('sha1').update(payload, 'utf8').digest('hex').toUpperCase();
}
import type {
    CreateInvoiceInput,
    UpdateInvoiceInput,
    AddPaymentInput,
    CreditNoteInput,
    DebitNoteInput
} from '../validation/invoices';

const INVOICE_FIELD_ALLOWLIST = [
    'id', 'invoiceNumber', 'orderId', 'customerId', 'issueDate', 'dueDate',
    'subtotal', 'discount', 'taxAmount', 'total', 'amountPaid', 'amountDue',
    'status', 'paymentMethod', 'createdAt', 'updatedAt',
    'customer.id', 'customer.name', 'customer.code'
] as const;

const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'partial', 'overdue'];
const CONSUMED_CREDIT_NOTE_STATUSES = ['issued', 'refunded'] as const;
const ACTIVE_DEBIT_NOTE_STATUSES = ['issued', 'settled'] as const;

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

type InvoiceListParams = {
    status?: InvoiceStatus | 'all';
    customerId?: string;
    search?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
    page?: string | number;
    limit?: string | number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string;
};

type InvoiceItemInput = {
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
    total: number;
};

// Internal shape — broader than the Zod-validated input so the service can be
// reused by `convertOrderToInvoice` and other internal callers.
type InvoiceServiceCreateInput = CreateInvoiceInput | {
    orderId?: string | null;
    orderNumber?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    customerNuit?: string | null;
    dueDate?: string | Date | null;
    discount?: number;
    taxAmount?: number;
    total?: number;
    subtotal?: number;
    notes?: string | null;
    paymentTerms?: string | null;
    items: InvoiceItemInput[];
};

// Extra fields the credit-note service uses beyond what Zod validates
type CreditNoteServiceInput = CreditNoteInput & {
    expectedTotal?: number;
    approvalId?: string;
};

type CreditNoteListParams = {
    invoiceId?: string;
    page?: string | number;
    limit?: string | number;
};

type CreditNoteWithRelations = Prisma.CreditNoteGetPayload<{
    include: { items: { include: { product: { select: { unit: true } } } }; originalInvoice: true };
}>;

function serializeCreditNote(note: CreditNoteWithRelations) {
    return {
        id: note.id,
        number: note.number,
        originalInvoiceId: note.originalInvoiceId,
        originalInvoiceNumber: note.originalInvoice?.invoiceNumber || '',
        customerId: note.customerId,
        customerName: note.customerName,
        subtotal: Number(note.subtotal || 0),
        tax: Number(note.tax || 0),
        total: Number(note.total || 0),
        reason: note.reason,
        status: note.status,
        issueDate: note.issueDate,
        createdAt: note.createdAt,
        notes: note.notes,
        items: (note.items || []).map((item) => ({
            id: item.id,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice || 0),
            total: Number(item.total || 0),
            originalInvoiceItemId: item.originalInvoiceItemId,
            product: item.product ? { unit: item.product.unit } : null,
        })),
    };
}

type DebitNoteListParams = {
    invoiceId?: string;
    page?: string | number;
    limit?: string | number;
};

type DebitNoteServiceInput = DebitNoteInput & {
    expectedTotal?: number;
    approvalId?: string;
};

type DebitNoteWithRelations = Prisma.DebitNoteGetPayload<{
    include: { items: { include: { product: { select: { unit: true } } } }; originalInvoice: true };
}>;

function serializeDebitNote(note: DebitNoteWithRelations) {
    return {
        id: note.id,
        number: note.number,
        originalInvoiceId: note.originalInvoiceId,
        originalInvoiceNumber: note.originalInvoice?.invoiceNumber || '',
        customerId: note.customerId,
        customerName: note.customerName,
        subtotal: Number(note.subtotal || 0),
        tax: Number(note.tax || 0),
        total: Number(note.total || 0),
        reason: note.reason,
        status: note.status,
        issueDate: note.issueDate,
        createdAt: note.createdAt,
        notes: note.notes,
        items: (note.items || []).map((item) => ({
            id: item.id,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice || 0),
            total: Number(item.total || 0),
            originalInvoiceItemId: item.originalInvoiceItemId,
            product: item.product ? { unit: item.product.unit } : null,
        })),
    };
}

export class InvoicesService {
    async list(params: InvoiceListParams, companyId: string) {
        const { status, customerId, search, warehouseId, startDate, endDate, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = params;
        const pageNum = parseInt(String(page));
        const limitNum = parseInt(String(limit));
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.InvoiceWhereInput = { companyId };
        if (status && status !== 'all') where.status = status as InvoiceStatus;
        if (customerId) where.customerId = customerId;
        if (search?.trim()) {
            const term = search.trim();
            where.OR = [
                { invoiceNumber: { contains: term, mode: 'insensitive' } },
                { orderNumber: { contains: term, mode: 'insensitive' } },
                { customerName: { contains: term, mode: 'insensitive' } },
                { customerEmail: { contains: term, mode: 'insensitive' } },
                { customerPhone: { contains: term, mode: 'insensitive' } },
            ];
        }
        if (warehouseId && warehouseId !== 'all') where.warehouseId = warehouseId;
        if (startDate || endDate) {
            where.issueDate = {};
            if (startDate) where.issueDate.gte = new Date(String(startDate));
            if (endDate) where.issueDate.lte = new Date(String(endDate));
        }

        // Base where for summary stats (ignore status filter but keep other filters)
        const summaryWhere: Prisma.InvoiceWhereInput = { ...where };
        delete summaryWhere.status;

        const projection = parseFields(params.fields, INVOICE_FIELD_ALLOWLIST);
        const baseArgs = {
            where,
            orderBy: { [sortBy]: sortOrder } as Prisma.InvoiceOrderByWithRelationInput,
            skip,
            take: limitNum
        };
        const findArgs: Prisma.InvoiceFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.InvoiceSelect }
            : { ...baseArgs, include: { customer: { select: { id: true, name: true, code: true } }, _count: { select: { items: true, payments: true } } } };

        const [total, invoices, stats] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany(findArgs),
            prisma.invoice.aggregate({
                where: summaryWhere,
                _sum: { total: true, amountPaid: true, amountDue: true }
            })
        ]);

        // Calculate specific pending/overdue stats for the entire set (ignoring status filter)
        const [pendingStats, overdueStats] = await Promise.all([
            prisma.invoice.aggregate({
                where: { ...summaryWhere, status: { in: ['sent', 'partial'] satisfies InvoiceStatus[] } },
                _sum: { amountDue: true }
            }),
            prisma.invoice.aggregate({
                where: { ...summaryWhere, status: 'overdue' },
                _sum: { amountDue: true }
            })
        ]);

        return ResultHandler.success({
            data: invoices,
            pagination: buildPaginationMeta(pageNum, limitNum, total),
            summary: {
                total: Number(stats._sum.total || 0),
                paid: Number(stats._sum.amountPaid || 0),
                pending: Number(pendingStats._sum.amountDue || 0),
                overdue: Number(overdueStats._sum.amountDue || 0)
            }
        });
    }

    async getAvailableSources(companyId: string) {
        const invoicedInvoices = await prisma.invoice.findMany({
            where: { companyId },
            select: { orderId: true }
        });

        const invoicedOrderIds = invoicedInvoices.map(i => i.orderId).filter((id): id is string => !!id);

        const [availableSales, availableOrders] = await Promise.all([
            prisma.pharmacySale.findMany({
                where: { companyId, status: 'completed', id: { notIn: invoicedOrderIds } },
                include: { customer: true, items: { include: { batch: { include: { medication: { include: { product: true } } } } } } },
                orderBy: { createdAt: 'desc' }, take: 50
            }),
            prisma.customerOrder.findMany({
                where: { companyId, status: { notIn: ['cancelled', 'cancellation_requested'] }, id: { notIn: invoicedOrderIds } },
                include: { items: true },
                orderBy: { createdAt: 'desc' }, take: 100
            })
        ]);

        return ResultHandler.success([
            ...availableSales.map(s => ({
                id: s.id, number: s.saleNumber, type: 'pharmacy', customerId: s.customerId,
                customerName: s.customerName || s.customer?.name || 'Cliente Balcão',
                customerPhone: s.customer?.phone || '',
                customerEmail: s.customer?.email || '',
                customerAddress: s.customer?.address || '',
                status: s.status,
                createdAt: s.createdAt,
                items: s.items.map(i => ({
                    productId: i.batch?.medication?.productId, description: i.productName,
                    quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total)
                })),
                subtotal: Number(s.subtotal),
                discount: Number(s.discount),
                taxRate: 0,
                taxAmount: 0,
                total: Number(s.total)
            })),
            ...availableOrders.map(o => ({
                id: o.id, number: o.orderNumber, type: 'commercial',
                customerName: o.customerName,
                customerPhone: o.customerPhone || '',
                customerEmail: o.customerEmail || '',
                customerAddress: o.customerAddress || '',
                status: o.status,
                createdAt: o.createdAt,
                items: o.items.map(i => ({
                    productId: i.productId, description: i.productName,
                    quantity: i.quantity, unitPrice: Number(i.price), total: Number(i.total)
                })),
                subtotal: Number(o.subtotal),
                discount: Number(o.discount),
                taxRate: Number(o.taxRate),
                taxAmount: Number(o.taxAmount),
                total: Number(o.total)
            }))
        ]);
    }

    async create(data: InvoiceServiceCreateInput, companyId: string, userName?: string) {
        const count = await prisma.invoice.count({ where: { companyId } });
        const invoiceNumber = `FAT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const { items } = data;

        return await prisma.$transaction(async (tx) => {
            let sourceOrder: Prisma.CustomerOrderGetPayload<{ include: { items: true } }> | null = null;
            if (data.orderId) {
                const existingInvoice = await tx.invoice.findFirst({
                    where: { orderId: data.orderId, companyId }
                });
                if (existingInvoice) {
                    throw ApiError.badRequest('Esta encomenda já foi faturada.');
                }

                sourceOrder = await tx.customerOrder.findFirst({
                    where: { id: data.orderId, companyId },
                    include: { items: true }
                });
            }

            // ====================================================================
            // PRICING SOURCE OF TRUTH
            //   • Linked to an order: the order is the contract with the customer.
            //     Item prices, subtotal, discount, tax rate and totals are inherited
            //     verbatim. Current DB prices do NOT override agreed prices.
            //   • Manual invoice (no orderId): server is authoritative — fetch
            //     current prices, apply company IVA, recompute everything.
            // ====================================================================
            const companyCfg = await tx.companySettings.findFirst({
                where: { companyId },
                select: { ivaRate: true }
            });

            let verifiedItems: InvoiceItemInput[];
            let finalSubtotal: number;
            let computedDiscount: number;
            let finalTax: number;
            let finalTotal: number;
            let effectiveIvaRate: number;

            if (sourceOrder) {
                // Inherit from the order: trust the snapshot stored at order creation.
                verifiedItems = sourceOrder.items.map((oi) => ({
                    productId: oi.productId,
                    description: oi.productName,
                    quantity: Number(oi.quantity),
                    unitPrice: Number(oi.price),
                    discount: 0,
                    total: Number(oi.total)
                }));
                finalSubtotal = Number(sourceOrder.subtotal);
                computedDiscount = Number(sourceOrder.discount);
                finalTax = Number(sourceOrder.taxAmount);
                finalTotal = Number(sourceOrder.total);
                effectiveIvaRate = Number(sourceOrder.taxRate);
            } else {
                const productIds = items.map((i) => i.productId).filter((id): id is string => !!id);
                const productPriceMap = new Map<string, number>();

                if (productIds.length > 0) {
                    const products = await tx.product.findMany({
                        where: { id: { in: productIds }, companyId },
                        select: { id: true, name: true, price: true }
                    });
                    for (const p of products) {
                        productPriceMap.set(p.id, Number(p.price));
                    }
                }

                const ivaRate = Number(companyCfg?.ivaRate ?? 16) / 100;

                verifiedItems = items.map((item) => {
                    let unitPrice = item.unitPrice;
                    if (item.productId && productPriceMap.has(item.productId)) {
                        const dbPrice = productPriceMap.get(item.productId)!;
                        if (dbPrice > 0 && Math.abs(dbPrice - unitPrice) > 0.01) {
                            logger.warn('Invoice price mismatch detected', {
                                productId: item.productId,
                                frontendPrice: item.unitPrice,
                                dbPrice,
                                companyId
                            });
                            unitPrice = dbPrice;
                        }
                    }
                    const computedTotal = (unitPrice * item.quantity) - (item.discount || 0);
                    return { ...item, unitPrice, total: Math.round(computedTotal * 100) / 100 };
                });

                finalSubtotal = Math.round(verifiedItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
                computedDiscount = Math.max(0, Math.round(Number(data.discount || 0) * 100) / 100);
                const taxableBase = Math.max(0, finalSubtotal - computedDiscount);
                finalTax = Math.round(taxableBase * ivaRate * 100) / 100;
                finalTotal = Math.round((taxableBase + finalTax) * 100) / 100;
                effectiveIvaRate = ivaRate * 100;
            }

            // Validate customer credit limit for direct invoices (not linked to an order)
            if (!data.orderId && data.customerId) {
                const customer = await tx.customer.findFirst({
                    where: { id: data.customerId, companyId }
                });
                if (customer && customer.creditLimit !== null) {
                    const openInvoicesTotal = await tx.invoice.aggregate({
                        where: { customerId: data.customerId, companyId, status: { in: OPEN_INVOICE_STATUSES } },
                        _sum: { amountDue: true }
                    });
                    const currentExposure = Number(openInvoicesTotal._sum.amountDue ?? 0);
                    if (currentExposure + finalTotal > Number(customer.creditLimit)) {
                        throw ApiError.badRequest(
                            `Limite de crédito excedido para "${customer.name}". ` +
                            `Limite: ${Number(customer.creditLimit).toFixed(2)} MT, ` +
                            `Em dívida: ${currentExposure.toFixed(2)} MT, ` +
                            `Esta fatura: ${finalTotal.toFixed(2)} MT.`
                        );
                    }
                }
            }

            // Validate stock for manual invoices (those not linked to an existing order/sale)
            if (!data.orderId) {
                for (const item of verifiedItems) {
                    if (item.productId) {
                        await stockService.validateAvailability(item.productId, item.quantity, companyId, tx);
                    }
                }
            } else {
                // For Orders, release reservation and deduct effective stock
                for (const item of verifiedItems) {
                    if (item.productId) {
                        await stockService.releaseReservation(item.productId, item.quantity, companyId, tx);
                        await stockService.recordMovement({
                            productId: item.productId,
                            quantity: -item.quantity,
                            movementType: 'sale',
                            originModule: 'COMMERCIAL',
                            referenceType: 'SALE',
                            referenceContent: data.orderNumber || 'Fatura via Encomenda',
                            reason: `Venda via Encomenda ${data.orderNumber || 'Fatura via Encomenda'}`,
                            performedBy: userName || 'Sistema',
                            companyId
                        }, tx);
                    }
                }
            }

            // ── AT-MZ fiscal hash chain ─────────────────────────────────────
            // Fetch the previous invoice's hash so we can chain. Order by
            // createdAt to guarantee deterministic ordering even when issueDate
            // ties. Within the same transaction, so concurrent creates are
            // serialised by the outer prisma.$transaction.
            const previous = await tx.invoice.findFirst({
                where: { companyId },
                orderBy: { createdAt: 'desc' },
                select: { hashCode: true },
            });
            const issueDate = new Date();
            const hashCode = buildFiscalHash({
                issueDate,
                invoiceNumber,
                grossTotal: finalTotal,
                previousHash: previous?.hashCode ?? null,
            });

            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    companyId,
                    orderId: data.orderId || null,
                    orderNumber: data.orderNumber || null,
                    warehouseId: (data as { warehouseId?: string | null }).warehouseId || null,
                    customerId: data.customerId || null,
                    customerName: data.customerName || 'Cliente',
                    customerEmail: data.customerEmail || null,
                    customerPhone: data.customerPhone || null,
                    customerAddress: data.customerAddress || null,
                    customerDocument: data.customerNuit || null,
                    subtotal: finalSubtotal,
                    discount: computedDiscount,
                    tax: finalTax,
                    total: finalTotal,
                    amountDue: finalTotal,
                    issueDate,
                    dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
                    notes: data.notes || null,
                    terms: data.paymentTerms || null,
                    hashCode,
                    previousHash: previous?.hashCode ?? null,
                    items: {
                        create: verifiedItems.map((item) => ({
                            productId: item.productId || null,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount || 0,
                            total: item.total,
                            unitWeight: null
                        }))
                    }
                },
                include: { customer: true, items: true }
            });

            // Deduct stock for manual invoices
            if (!data.orderId) {
                for (const item of verifiedItems) {
                    if (item.productId) {
                        await stockService.recordMovement({
                            productId: item.productId,
                            quantity: -item.quantity,
                            movementType: 'sale',
                            originModule: 'COMMERCIAL',
                            referenceType: 'SALE',
                            referenceContent: invoice.invoiceNumber,
                            reason: `Venda via Fatura Direta ${invoice.invoiceNumber}`,
                            performedBy: userName || 'Sistema',
                            companyId
                        }, tx);
                    }
                }
            }

            // Register IVA Retention. The frozen rate from the order takes
            // precedence; for manual invoices use the rate computed above.
            if (finalTax > 0) {
                try {
                    await tx.taxRetention.create({
                        data: {
                            companyId, type: 'iva', entityType: 'invoice', entityId: invoice.id,
                            period: new Date().toISOString().slice(0, 7),
                            baseAmount: finalSubtotal, retainedAmount: finalTax,
                            rate: effectiveIvaRate, description: `IVA da Fatura ${invoiceNumber}`
                        }
                    });
                } catch (e) { logger.error('Fiscal retention creation failed', { invoiceId: invoice.id, error: e }); }
            }

            return ResultHandler.success(invoice);
        }, { timeout: 30000, maxWait: 10000 });
    }

    async update(id: string, data: UpdateInvoiceInput, companyId: string) {
        const { items } = data;

        return await prisma.$transaction(async (tx) => {
            // Check if invoice exists and belongs to company
            const existingInvoice = await tx.invoice.findFirst({
                where: { id, companyId }
            });
            if (!existingInvoice) throw ApiError.notFound('Fatura não encontrada');

            // Strip nested `items` so the scalar fields can be mass-assigned
            // and convert `null` to `undefined` (Prisma update inputs reject `null`
            // for non-nullable optional columns).
            const scalarUpdate: Prisma.InvoiceUncheckedUpdateInput = {};
            const { items: _items, type: _type, ...rest } = data;
            for (const [key, value] of Object.entries(rest)) {
                (scalarUpdate as Record<string, unknown>)[key] = value === null ? undefined : value;
            }

            const invoice = await tx.invoice.update({
                where: { id },
                data: {
                    ...scalarUpdate,
                    items: items ? {
                        deleteMany: {},
                        create: items.map((item) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount || 0,
                            ivaRate: item.taxRate || 0,
                            total: item.total
                        }))
                    } : undefined
                },
                include: { customer: true, items: { include: { product: true } }, payments: true }
            });

            return invoice;
        }, { timeout: 30000, maxWait: 10000 });
    }

    async getById(id: string, companyId: string) {
        const invoice = await prisma.invoice.findFirst({
            where: { id, companyId },
            include: { customer: true, items: { include: { product: true } }, payments: true, creditNotes: true }
        });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');
        return invoice;
    }

    async cancel(id: string, companyId: string, approvalId?: string) {
        const invoice = await prisma.invoice.findFirst({
            where: { id, companyId },
            select: { id: true, total: true, status: true }
        });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');
        if (invoice.status === 'cancelled') throw ApiError.badRequest('Fatura já está cancelada');

        // Cancelling an issued invoice above the threshold needs manager
        // approval — protects against silent reversals of fiscal documents.
        const total = Number(invoice.total ?? 0);
        const thresholds = await getThresholds(companyId);
        if (isOverThreshold(thresholds, 'invoiceCancel', total)) {
            const approval = approvalId
                ? await approvalsService.findApprovedFor(companyId, 'invoice_cancel', 'invoice', id)
                : null;
            if (!approval) {
                throw ApiError.forbidden(
                    `Cancelamento de fatura acima do limite (${thresholds.invoiceCancel}). Solicite aprovação.`
                );
            }
        }

        await prisma.invoice.update({
            where: { id },
            data: { status: 'cancelled' }
        });

        if (approvalId) {
            await approvalsService.markConsumed(approvalId, companyId).catch(() => {});
        }
        return true;
    }

    async addPayment(id: string, data: AddPaymentInput, companyId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id, companyId } });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');
        const currentDue = Number(invoice.amountDue || 0);
        if (currentDue <= 0) throw ApiError.badRequest('Esta fatura ja esta liquidada');
        if (data.amount > currentDue) {
            throw ApiError.badRequest(`Valor excede o saldo da fatura (${currentDue.toFixed(2)} MT)`);
        }

        const payment = await prisma.invoicePayment.create({
            data: {
                invoiceId: id,
                amount: data.amount,
                // Validation schema accepts {check, other} which are not Prisma enum members.
                // Map them to closest valid enum value to avoid a 500 at the DB layer.
                method: (data.method === 'check' || data.method === 'other'
                    ? 'transfer'
                    : data.method) as PaymentMethod,
                reference: data.reference ?? undefined,
                notes: data.notes ?? undefined,
            }
        });

        const newAmountPaid = Number(invoice.amountPaid) + data.amount;
        const newAmountDue = currentDue - data.amount;
        let newStatus: InvoiceStatus = invoice.status;
        if (newAmountDue <= 0) newStatus = 'paid';
        else if (newAmountPaid > 0) newStatus = 'partial';

        await prisma.invoice.update({
            where: { id },
            data: { amountPaid: newAmountPaid, amountDue: Math.max(0, newAmountDue), status: newStatus, paidDate: newStatus === 'paid' ? new Date() : null }
        });

        return payment;
    }

    async getCreditNoteById(id: string, companyId: string) {
        const note = await prisma.creditNote.findFirst({
            where: { id, companyId },
            include: { items: { include: { product: { select: { unit: true } } } }, originalInvoice: true },
        });
        if (!note) throw ApiError.notFound('Nota de crédito não encontrada');
        return serializeCreditNote(note);
    }

    async listCreditNotes(params: CreditNoteListParams, companyId: string) {
        const { invoiceId, page = '1', limit = '20' } = params;
        const pageNum = parseInt(String(page));
        const limitNum = parseInt(String(limit));
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.CreditNoteWhereInput = { companyId };
        if (invoiceId) where.originalInvoiceId = invoiceId;

        const [total, creditNotes] = await Promise.all([
            prisma.creditNote.count({ where }),
            prisma.creditNote.findMany({ where, include: { originalInvoice: true, items: { include: { product: { select: { unit: true } } } } }, orderBy: { createdAt: 'desc' }, skip, take: limitNum })
        ]);

        return {
            data: creditNotes.map(serializeCreditNote),
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async createCreditNote(invoiceId: string, data: CreditNoteServiceInput, companyId: string, userId?: string, userName?: string, userIp?: string) {
        return prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findFirst({
                where: { id: invoiceId, companyId },
                include: { items: { include: { product: { select: { unit: true } } } } }
            });
            if (!invoice) throw ApiError.notFound('Fatura nao encontrada');
            if (invoice.status === 'cancelled') throw ApiError.badRequest('Nao e possivel devolver uma fatura cancelada');

            // Credit notes above the configured threshold need a manager approval
            // (resourceType='invoice', resourceId=invoiceId).
            const requestedTotal = Number(data.expectedTotal ?? 0);
            const approvalId = data.approvalId;
            const thresholds = await getThresholds(companyId);
            if (isOverThreshold(thresholds, 'creditNote', requestedTotal)) {
                const approval = approvalId
                    ? await approvalsService.findApprovedFor(companyId, 'credit_note', 'invoice', invoiceId)
                    : null;
                if (!approval) {
                    throw ApiError.forbidden(
                        `Nota de crédito acima do limite (${thresholds.creditNote}). Solicite aprovação.`
                    );
                }
                if (approval.amount !== null && approval.amount + 0.01 < requestedTotal) {
                    throw ApiError.forbidden('O valor excede a aprovação concedida.');
                }
            }

            const requestedItems = (data.items || []).filter((item) => Number(item.quantity) > 0);
            if (requestedItems.length === 0) throw ApiError.badRequest('Selecione pelo menos um item para devolucao');

            const originalItemsById = new Map(invoice.items.map((item) => [item.id, item]));
            const originalItemIds = requestedItems
                .map((item) => item.originalInvoiceItemId)
                .filter((id): id is string => typeof id === 'string' && id.length > 0);
            const alreadyReturnedItems = await tx.creditNoteItem.findMany({
                where: {
                    originalInvoiceItemId: { in: originalItemIds },
                    creditNote: { is: { companyId, originalInvoiceId: invoiceId } }
                },
                select: { originalInvoiceItemId: true, quantity: true }
            });

            const returnedQuantityByItem = new Map<string, number>();
            for (const item of alreadyReturnedItems) {
                if (!item.originalInvoiceItemId) continue;
                returnedQuantityByItem.set(
                    item.originalInvoiceItemId,
                    (returnedQuantityByItem.get(item.originalInvoiceItemId) || 0) + Number(item.quantity || 0)
                );
            }

            const creditItems = requestedItems.map((requested) => {
                const original = requested.originalInvoiceItemId
                    ? originalItemsById.get(requested.originalInvoiceItemId)
                    : undefined;
                if (!original) {
                    throw ApiError.badRequest(`Item original invalido para devolucao: ${requested.description || requested.originalInvoiceItemId}`);
                }

                const quantity = Number(requested.quantity);
                if (quantity <= 0) {
                    throw ApiError.badRequest(`Quantidade deve ser maior que zero para "${original.description}"`);
                }

                const uomError = validateQuantityForUnit(quantity, original.product?.unit || 'un');
                if (uomError) {
                    throw ApiError.badRequest(`Item "${original.description}": ${uomError}`);
                }

                const alreadyReturned = returnedQuantityByItem.get(original.id) || 0;
                const remainingQuantity = Number(original.quantity) - alreadyReturned;
                if (quantity > remainingQuantity) {
                    throw ApiError.badRequest(
                        `Quantidade de devolucao excede o saldo do item "${original.description}". ` +
                        `Disponivel para devolver: ${remainingQuantity}`
                    );
                }

                const unitCredit = roundMoney(Number(original.total) / Number(original.quantity));
                const lineTotal = roundMoney(unitCredit * quantity);

                return {
                    productId: original.productId || null,
                    description: original.description,
                    quantity,
                    unitPrice: unitCredit,
                    total: lineTotal,
                    originalInvoiceItemId: original.id,
                };
            });

            const count = await tx.creditNote.count({ where: { companyId } });
            const number = `NC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

            const grossCreditSubtotal = roundMoney(creditItems.reduce((sum, item) => sum + item.total, 0));
            const invoiceSubtotal = Number(invoice.subtotal || 0);
            const invoiceDiscount = Number(invoice.discount || 0);
            const discountRatio = invoiceSubtotal > 0 ? invoiceDiscount / invoiceSubtotal : 0;
            const creditDiscount = roundMoney(grossCreditSubtotal * discountRatio);
            const subtotal = roundMoney(Math.max(0, grossCreditSubtotal - creditDiscount));
            const originalTaxableBase = Math.max(0, invoiceSubtotal - invoiceDiscount);
            const ivaRate = originalTaxableBase > 0 ? Number(invoice.tax || 0) / originalTaxableBase : 0;
            const taxAmount = roundMoney(subtotal * ivaRate);
            const total = roundMoney(subtotal + taxAmount);

            const creditNote = await tx.creditNote.create({
                data: {
                    number,
                    originalInvoiceId: invoiceId,
                    customerId: invoice.customerId,
                    customerName: invoice.customerName,
                    subtotal,
                    tax: taxAmount,
                    total,
                    reason: data.reason,
                    notes: data.notes || null,
                    status: 'issued',
                    companyId,
                    items: {
                        create: creditItems
                    }
                },
                include: { items: { include: { product: { select: { unit: true } } } }, originalInvoice: true }
            });

            for (const item of creditItems) {
                if (!item.productId) continue;
                await stockService.recordMovement({
                    productId: item.productId,
                    quantity: item.quantity,
                    movementType: 'return_in',
                    originModule: 'COMMERCIAL',
                    referenceType: 'RETURN',
                    referenceContent: number,
                    reason: `Devolucao via Nota de Credito ${number}: ${data.reason}`,
                    performedBy: userName || 'Sistema',
                    companyId
                }, tx);
            }

            const creditTotals = await tx.creditNote.aggregate({
                where: { companyId, originalInvoiceId: invoiceId, status: { in: [...CONSUMED_CREDIT_NOTE_STATUSES] } },
                _sum: { total: true }
            });
            const totalCredited = roundMoney(Number(creditTotals._sum.total || 0));
            const effectiveInvoiceTotal = roundMoney(Math.max(0, Number(invoice.total) - totalCredited));
            const amountPaid = Number(invoice.amountPaid || 0);
            const amountDue = roundMoney(Math.max(0, effectiveInvoiceTotal - amountPaid));
            const status: InvoiceStatus = amountDue <= 0
                ? 'paid'
                : amountPaid > 0
                    ? 'partial'
                    : invoice.status === 'draft'
                        ? 'draft'
                        : 'sent';

            await tx.invoice.update({
                where: { id: invoice.id },
                data: { amountDue, status }
            });

            if (taxAmount > 0) {
                await tx.taxRetention.create({
                    data: {
                        companyId,
                        type: 'iva',
                        entityType: 'credit_note',
                        entityId: creditNote.id,
                        period: new Date().toISOString().slice(0, 7),
                        baseAmount: -subtotal,
                        retainedAmount: -taxAmount,
                        rate: roundMoney(ivaRate * 100),
                        description: `Estorno de IVA da Nota de Credito ${number}`
                    }
                });
            }

            await auditService.log({
                userId,
                userName,
                action: 'CREATE_CREDIT_NOTE',
                entity: 'credit_note',
                entityId: creditNote.id,
                oldData: { invoiceId, invoiceNumber: invoice.invoiceNumber },
                newData: { number, subtotal, tax: taxAmount, total, reason: data.reason, items: creditItems },
                ipAddress: userIp,
                companyId
            });

            if (data.approvalId) {
                await approvalsService.markConsumed(data.approvalId, companyId).catch(() => {});
            }
            return serializeCreditNote(creditNote);
        }, { timeout: 30000, maxWait: 10000 });
    }

    async getDebitNoteById(id: string, companyId: string) {
        const note = await prisma.debitNote.findFirst({
            where: { id, companyId },
            include: { items: { include: { product: { select: { unit: true } } } }, originalInvoice: true },
        });
        if (!note) throw ApiError.notFound('Nota de débito não encontrada');
        return serializeDebitNote(note);
    }

    async listDebitNotes(params: DebitNoteListParams, companyId: string) {
        const { invoiceId, page = '1', limit = '20' } = params;
        const pageNum = parseInt(String(page));
        const limitNum = parseInt(String(limit));
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.DebitNoteWhereInput = { companyId };
        if (invoiceId) where.originalInvoiceId = invoiceId;

        const [total, debitNotes] = await Promise.all([
            prisma.debitNote.count({ where }),
            prisma.debitNote.findMany({
                where,
                include: { originalInvoice: true, items: { include: { product: { select: { unit: true } } } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);

        return {
            data: debitNotes.map(serializeDebitNote),
            pagination: buildPaginationMeta(pageNum, limitNum, total),
        };
    }

    async createDebitNote(
        invoiceId: string,
        data: DebitNoteServiceInput,
        companyId: string,
        userId?: string,
        userName?: string,
        userIp?: string,
    ) {
        return prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findFirst({
                where: { id: invoiceId, companyId },
                include: { items: true },
            });
            if (!invoice) throw ApiError.notFound('Fatura não encontrada');
            if (invoice.status === 'cancelled') {
                throw ApiError.badRequest('Não é possível emitir nota de débito sobre uma fatura cancelada');
            }

            // Notas de débito acima do limite configurado exigem aprovação de gerente
            // (resourceType='invoice', resourceId=invoiceId). Espelha o fluxo da NC.
            const requestedTotal = Number(data.expectedTotal ?? 0);
            const approvalId = data.approvalId;
            const thresholds = await getThresholds(companyId);
            if (isOverThreshold(thresholds, 'debitNote', requestedTotal)) {
                const approval = approvalId
                    ? await approvalsService.findApprovedFor(companyId, 'debit_note', 'invoice', invoiceId)
                    : null;
                if (!approval) {
                    throw ApiError.forbidden(
                        `Nota de débito acima do limite (${thresholds.debitNote}). Solicite aprovação.`,
                    );
                }
                if (approval.amount !== null && approval.amount + 0.01 < requestedTotal) {
                    throw ApiError.forbidden('O valor excede a aprovação concedida.');
                }
            }

            const requestedItems = (data.items || []).filter((item) => Number(item.quantity) > 0);
            if (requestedItems.length === 0) {
                throw ApiError.badRequest('Selecione pelo menos um item para a nota de débito');
            }

            // Items são livres (juros, multa, frete, correções). Quando referenciam um item
            // da fatura original, validamos só que o item pertence à mesma fatura — não
            // limitamos quantidade porque ND pode adicionar quantidade nova (correção pra cima).
            const originalItemIds = new Set(invoice.items.map((item) => item.id));
            const debitItems = requestedItems.map((item) => {
                if (item.originalInvoiceItemId && !originalItemIds.has(item.originalInvoiceItemId)) {
                    throw ApiError.badRequest(`Item original inválido: ${item.description}`);
                }
                const quantity = Number(item.quantity);
                const unitPrice = roundMoney(Number(item.unitPrice));
                const total = roundMoney(Number(item.total ?? unitPrice * quantity));
                return {
                    productId: item.productId || null,
                    description: item.description,
                    quantity,
                    unitPrice,
                    total,
                    originalInvoiceItemId: item.originalInvoiceItemId || null,
                };
            });

            const subtotal = roundMoney(debitItems.reduce((sum, item) => sum + item.total, 0));
            // Aplica a mesma taxa efectiva de IVA da fatura original (consistência fiscal).
            const invoiceSubtotal = Number(invoice.subtotal || 0);
            const invoiceDiscount = Number(invoice.discount || 0);
            const originalTaxableBase = Math.max(0, invoiceSubtotal - invoiceDiscount);
            const ivaRate = originalTaxableBase > 0 ? Number(invoice.tax || 0) / originalTaxableBase : 0;
            const taxAmount = roundMoney(subtotal * ivaRate);
            const total = roundMoney(subtotal + taxAmount);

            const count = await tx.debitNote.count({ where: { companyId } });
            const number = `ND-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

            const debitNote = await tx.debitNote.create({
                data: {
                    number,
                    originalInvoiceId: invoiceId,
                    customerId: invoice.customerId,
                    customerName: invoice.customerName,
                    subtotal,
                    tax: taxAmount,
                    total,
                    reason: data.reason,
                    notes: data.notes || null,
                    status: 'issued',
                    companyId,
                    items: { create: debitItems },
                },
                include: { items: { include: { product: { select: { unit: true } } } }, originalInvoice: true },
            });

            await this.recalcInvoiceAmountDue(tx, invoice);

            // Retenção fiscal: ND aumenta receita tributável → IVA adicional (positivo).
            if (taxAmount > 0) {
                await tx.taxRetention.create({
                    data: {
                        companyId,
                        type: 'iva',
                        entityType: 'debit_note',
                        entityId: debitNote.id,
                        period: new Date().toISOString().slice(0, 7),
                        baseAmount: subtotal,
                        retainedAmount: taxAmount,
                        rate: roundMoney(ivaRate * 100),
                        description: `IVA da Nota de Débito ${number}`,
                    },
                });
            }

            await auditService.log({
                userId,
                userName,
                action: 'CREATE_DEBIT_NOTE',
                entity: 'debit_note',
                entityId: debitNote.id,
                oldData: { invoiceId, invoiceNumber: invoice.invoiceNumber },
                newData: { number, subtotal, tax: taxAmount, total, reason: data.reason, items: debitItems },
                ipAddress: userIp,
                companyId,
            });

            if (data.approvalId) {
                await approvalsService.markConsumed(data.approvalId, companyId).catch(() => {});
            }
            return serializeDebitNote(debitNote);
        }, { timeout: 30000, maxWait: 10000 });
    }

    /**
     * Recalcula `amountDue` e `status` de uma fatura considerando notas de crédito
     * (subtraem dívida) e notas de débito activas (somam dívida). Reutilizado pelo
     * create/cancel/settle de notas para manter contabilidade consistente.
     *
     * `tx` é o cliente de transação do prisma extendido (lib/prisma.ts) — usar
     * `Parameters<...>` em vez de `Prisma.TransactionClient` para acomodar o $extends.
     */
    private async recalcInvoiceAmountDue(
        tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
        invoice: { id: string; companyId: string | null; total: Prisma.Decimal | number; amountPaid: Prisma.Decimal | number; status: InvoiceStatus },
    ): Promise<{ amountDue: number; status: InvoiceStatus }> {
        const [creditTotals, debitTotals] = await Promise.all([
            tx.creditNote.aggregate({
                where: { companyId: invoice.companyId, originalInvoiceId: invoice.id, status: { in: [...CONSUMED_CREDIT_NOTE_STATUSES] } },
                _sum: { total: true },
            }),
            tx.debitNote.aggregate({
                where: { companyId: invoice.companyId, originalInvoiceId: invoice.id, status: { in: [...ACTIVE_DEBIT_NOTE_STATUSES] } },
                _sum: { total: true },
            }),
        ]);
        const totalCredited = roundMoney(Number(creditTotals._sum.total || 0));
        const totalDebited = roundMoney(Number(debitTotals._sum.total || 0));
        const effectiveInvoiceTotal = roundMoney(Math.max(0, Number(invoice.total) - totalCredited + totalDebited));
        const amountPaid = Number(invoice.amountPaid || 0);
        const amountDue = roundMoney(Math.max(0, effectiveInvoiceTotal - amountPaid));
        const status: InvoiceStatus = amountDue <= 0
            ? 'paid'
            : amountPaid > 0
                ? 'partial'
                : invoice.status === 'draft'
                    ? 'draft'
                    : 'sent';
        await tx.invoice.update({ where: { id: invoice.id }, data: { amountDue, status } });
        return { amountDue, status };
    }

    async cancelDebitNote(id: string, companyId: string, userId?: string, userName?: string, userIp?: string) {
        return prisma.$transaction(async (tx) => {
            const note = await tx.debitNote.findFirst({
                where: { id, companyId },
                include: { originalInvoice: true, items: { include: { product: { select: { unit: true } } } } },
            });
            if (!note) throw ApiError.notFound('Nota de débito não encontrada');
            if (note.status === 'cancelled') throw ApiError.badRequest('Nota de débito já está cancelada');
            if (note.status === 'settled') throw ApiError.badRequest('Não é possível cancelar uma nota de débito liquidada');

            const updated = await tx.debitNote.update({
                where: { id },
                data: { status: 'cancelled' },
                include: { items: { include: { product: { select: { unit: true } } } }, originalInvoice: true },
            });

            // Recalcula amountDue da fatura — a ND cancelada deixa de somar.
            if (note.originalInvoice) {
                await this.recalcInvoiceAmountDue(tx, note.originalInvoice);
            }

            // Estorna a retenção fiscal (entrada negativa) se a ND original tinha IVA.
            const tax = Number(note.tax || 0);
            const subtotal = Number(note.subtotal || 0);
            if (tax > 0) {
                const rate = subtotal > 0 ? roundMoney((tax / subtotal) * 100) : 0;
                await tx.taxRetention.create({
                    data: {
                        companyId,
                        type: 'iva',
                        entityType: 'debit_note',
                        entityId: note.id,
                        period: new Date().toISOString().slice(0, 7),
                        baseAmount: -subtotal,
                        retainedAmount: -tax,
                        rate,
                        description: `Estorno de IVA — Cancelamento da Nota de Débito ${note.number}`,
                    },
                });
            }

            await auditService.log({
                userId,
                userName,
                action: 'CANCEL_DEBIT_NOTE',
                entity: 'debit_note',
                entityId: note.id,
                oldData: { number: note.number, status: note.status, total: Number(note.total) },
                newData: { status: 'cancelled' },
                ipAddress: userIp,
                companyId,
            });

            return serializeDebitNote(updated);
        }, { timeout: 30000, maxWait: 10000 });
    }

    async settleDebitNote(id: string, companyId: string, userId?: string, userName?: string, userIp?: string) {
        return prisma.$transaction(async (tx) => {
            const note = await tx.debitNote.findFirst({
                where: { id, companyId },
                include: { items: { include: { product: { select: { unit: true } } } }, originalInvoice: true },
            });
            if (!note) throw ApiError.notFound('Nota de débito não encontrada');
            if (note.status !== 'issued') {
                throw ApiError.badRequest(`Só é possível liquidar notas emitidas (estado actual: ${note.status})`);
            }

            const updated = await tx.debitNote.update({
                where: { id },
                data: { status: 'settled' },
                include: { items: { include: { product: { select: { unit: true } } } }, originalInvoice: true },
            });

            // 'settled' continua a contar como dívida activa — não altera a fatura.
            // Esta transição é apenas para rastreabilidade contabilística.
            await auditService.log({
                userId,
                userName,
                action: 'SETTLE_DEBIT_NOTE',
                entity: 'debit_note',
                entityId: note.id,
                oldData: { number: note.number, status: note.status },
                newData: { status: 'settled' },
                ipAddress: userIp,
                companyId,
            });

            return serializeDebitNote(updated);
        }, { timeout: 30000, maxWait: 10000 });
    }

    async incrementPrintCount(id: string, companyId: string) {
        const invoice = await prisma.invoice.findFirst({
            where: { id, companyId }
        });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');

        return await prisma.invoice.update({
            where: { id },
            data: { printCount: { increment: 1 } }
        });
    }

    async convertOrderToInvoice(orderId: string, companyId: string, userName?: string) {
        const order = await prisma.customerOrder.findFirst({
            where: { id: orderId, companyId },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Encomenda não encontrada');
        if (order.status === 'cancelled') throw ApiError.badRequest('Não é possível faturar uma encomenda cancelada');
        if (order.status === 'cancellation_requested') throw ApiError.badRequest('Nao e possivel faturar uma encomenda com cancelamento pendente');

        const existing = await prisma.invoice.findFirst({ where: { orderId, companyId } });
        if (existing) throw ApiError.badRequest('Esta encomenda já foi faturada. Fatura: ' + existing.invoiceNumber);

        const companySettings = await prisma.companySettings.findFirst({ where: { companyId } });
        const ivaRate = Number(companySettings?.ivaRate ?? 16) / 100;

        const subtotal = order.items.reduce((sum, i) => sum + Number(i.total), 0);
        const taxAmount = subtotal * ivaRate;
        const total = subtotal + taxAmount;

        const invoiceData: InvoiceServiceCreateInput = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            customerAddress: order.customerAddress,
            subtotal,
            taxAmount,
            total,
            dueDate: order.deliveryDate ? order.deliveryDate.toISOString() : undefined,
            notes: order.notes,
            items: order.items.map(i => ({
                productId: i.productId,
                description: i.productName,
                quantity: Number(i.quantity),
                unitPrice: Number(i.price),
                discount: 0,
                total: Number(i.total),
            })),
        };

        return this.create(invoiceData, companyId, userName);
    }
}

export const invoicesService = new InvoicesService();
