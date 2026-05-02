import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta, parseFields } from '../utils/pagination';

const INVOICE_FIELD_ALLOWLIST = [
    'id', 'invoiceNumber', 'orderId', 'customerId', 'issueDate', 'dueDate',
    'subtotal', 'discount', 'taxAmount', 'total', 'amountPaid', 'amountDue',
    'status', 'paymentMethod', 'createdAt', 'updatedAt',
    'customer.id', 'customer.name', 'customer.code'
] as const;
import { stockService } from './stockService';
import { logger } from '../utils/logger';
import { ResultHandler } from '../utils/result';

export class InvoicesService {
    async list(params: any, companyId: string) {
        const { status, customerId, startDate, endDate, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (status && status !== 'all') where.status = status;
        if (customerId) where.customerId = customerId;
        if (startDate || endDate) {
            where.issueDate = {};
            if (startDate) where.issueDate.gte = new Date(String(startDate));
            if (endDate) where.issueDate.lte = new Date(String(endDate));
        }

        // Base where for summary stats (ignore status filter but keep other filters)
        const summaryWhere = { ...where };
        delete summaryWhere.status;

        const projection = parseFields(params.fields, INVOICE_FIELD_ALLOWLIST);
        const findArgs: any = {
            where,
            orderBy: { [sortBy as string]: sortOrder },
            skip,
            take: limitNum
        };
        if (projection) {
            findArgs.select = projection;
        } else {
            findArgs.include = { customer: { select: { id: true, name: true, code: true } }, _count: { select: { items: true, payments: true } } };
        }

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
                where: { ...summaryWhere, status: { in: ['sent', 'partial'] } },
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
                where: { companyId, status: { not: 'cancelled' }, id: { notIn: invoicedOrderIds } },
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

    async create(data: any, companyId: string, userName?: string) {
        const count = await prisma.invoice.count({ where: { companyId } });
        const invoiceNumber = `FAT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const { items } = data;

        return await prisma.$transaction(async (tx) => {
            // Validate unique invoice per order
            let sourceOrder: Awaited<ReturnType<typeof tx.customerOrder.findFirst>> & { items: any[] } | null = null;
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
                }) as any;
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

            let verifiedItems: any[];
            let finalSubtotal: number;
            let computedDiscount: number;
            let finalTax: number;
            let finalTotal: number;
            let effectiveIvaRate: number;

            if (sourceOrder) {
                // Inherit from the order: trust the snapshot stored at order creation.
                verifiedItems = sourceOrder.items.map((oi: any) => ({
                    productId: oi.productId,
                    description: oi.productName,
                    quantity: oi.quantity,
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
                const productIds = items.map((i: any) => i.productId).filter(Boolean);
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

                verifiedItems = items.map((item: any) => {
                    if (item.productId && productPriceMap.has(item.productId)) {
                        const dbPrice = productPriceMap.get(item.productId)!;
                        if (dbPrice > 0 && Math.abs(dbPrice - item.unitPrice) > 0.01) {
                            logger.warn('Invoice price mismatch detected', {
                                productId: item.productId,
                                frontendPrice: item.unitPrice,
                                dbPrice,
                                companyId
                            });
                            item.unitPrice = dbPrice;
                        }
                    }
                    const computedTotal = (item.unitPrice * item.quantity) - (item.discount || 0);
                    return { ...item, total: Math.round(computedTotal * 100) / 100 };
                });

                finalSubtotal = Math.round(verifiedItems.reduce((sum: number, item: any) => sum + item.total, 0) * 100) / 100;
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
                        where: { customerId: data.customerId, companyId, status: { in: ['draft', 'sent', 'partial', 'overdue'] as any[] } },
                        _sum: { amountDue: true }
                    });
                    const currentExposure = Number((openInvoicesTotal._sum as any).amountDue ?? 0);
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

            /* 
            // Fetch product weights to snapshot on invoice items
            const productWeightMap = new Map<string, number>();
            if (productIds.length > 0) {
                const products = await tx.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, weight: true } as any
                });
                for (const p of products) {
                    if (p.weight !== null && p.weight !== undefined) {
                        productWeightMap.set(p.id, Number(p.weight));
                    }
                }
            }
            */

            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    companyId,
                    orderId: data.orderId || null,
                    orderNumber: data.orderNumber || null,
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
                    dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
                    notes: data.notes || null,
                    terms: data.paymentTerms || null,
                    items: {
                        create: verifiedItems.map((item: any) => ({
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
        });
    }

    async update(id: string, data: any, companyId: string) {
        const { items } = data;

        return await prisma.$transaction(async (tx) => {
            // Check if invoice exists and belongs to company
            const existingInvoice = await tx.invoice.findFirst({
                where: { id, companyId }
            });
            if (!existingInvoice) throw ApiError.notFound('Fatura não encontrada');

            // Update invoice
            const invoice = await tx.invoice.update({
                where: { id },
                data: {
                    ...data,
                    items: items ? {
                        deleteMany: {},
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount || 0,
                            taxRate: item.taxRate || 0,
                            total: item.total
                        }))
                    } : undefined
                },
                include: { customer: true, items: { include: { product: true } }, payments: true }
            });

            return invoice;
        });
    }

    async getById(id: string, companyId: string) {
        const invoice = await prisma.invoice.findFirst({
            where: { id, companyId },
            include: { customer: true, items: { include: { product: true } }, payments: true, creditNotes: true }
        });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');
        return invoice;
    }

    async cancel(id: string, companyId: string) {
        const result = await prisma.invoice.updateMany({
            where: { id, companyId },
            data: { status: 'cancelled' }
        });
        if (result.count === 0) throw ApiError.notFound('Fatura não encontrada');
        return true;
    }

    async addPayment(id: string, data: any, companyId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id, companyId } });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');

        const payment = await prisma.invoicePayment.create({
            data: { invoiceId: id, amount: data.amount, method: data.method, reference: data.reference, notes: data.notes }
        });

        const newAmountPaid = Number(invoice.amountPaid) + data.amount;
        const newAmountDue = Number(invoice.total) - newAmountPaid;
        let newStatus: any = invoice.status;
        if (newAmountDue <= 0) newStatus = 'paid';
        else if (newAmountPaid > 0) newStatus = 'partial';

        await prisma.invoice.update({
            where: { id },
            data: { amountPaid: newAmountPaid, amountDue: Math.max(0, newAmountDue), status: newStatus, paidDate: newStatus === 'paid' ? new Date() : null }
        });

        return payment;
    }

    async listCreditNotes(params: any, companyId: string) {
        const { invoiceId, page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (invoiceId) where.originalInvoiceId = invoiceId;

        const [total, creditNotes] = await Promise.all([
            prisma.creditNote.count({ where }),
            prisma.creditNote.findMany({ where, include: { originalInvoice: true, items: true }, orderBy: { createdAt: 'desc' }, skip, take: limitNum })
        ]);

        return {
            data: creditNotes,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async createCreditNote(invoiceId: string, data: any, companyId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');

        const count = await prisma.creditNote.count({ where: { companyId } });
        const number = `NC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        // Use company IVA rate dynamically
        const companySettings = await prisma.companySettings.findFirst({ where: { companyId } });
        const ivaRate = Number(companySettings?.ivaRate ?? 16) / 100;

        const subtotal = data.items.reduce((sum: number, item: any) => sum + item.total, 0);
        const taxAmount = subtotal * ivaRate;
        const total = subtotal + taxAmount;

        return prisma.creditNote.create({
            data: {
                number, originalInvoiceId: invoiceId, customerId: invoice.customerId,
                customerName: invoice.customerName, subtotal, tax: taxAmount, total,
                reason: data.reason, notes: data.notes, companyId,
                items: {
                    create: data.items.map((item: any) => ({
                        productId: item.productId, description: item.description,
                        quantity: item.quantity, unitPrice: item.unitPrice, total: item.total,
                        originalInvoiceItemId: item.originalInvoiceItemId, companyId
                    }))
                }
            },
            include: { items: true, originalInvoice: true }
        });
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

        const existing = await prisma.invoice.findFirst({ where: { orderId, companyId } });
        if (existing) throw ApiError.badRequest('Esta encomenda já foi faturada. Fatura: ' + existing.invoiceNumber);

        const companySettings = await prisma.companySettings.findFirst({ where: { companyId } });
        const ivaRate = Number(companySettings?.ivaRate ?? 16) / 100;

        const subtotal = order.items.reduce((sum, i) => sum + Number(i.total), 0);
        const taxAmount = subtotal * ivaRate;
        const total = subtotal + taxAmount;

        const invoiceData = {
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
                quantity: i.quantity,
                unitPrice: Number(i.price),
                discount: 0,
                total: Number(i.total),
            })),
        };

        return this.create(invoiceData, companyId, userName);
    }
}

export const invoicesService = new InvoicesService();
