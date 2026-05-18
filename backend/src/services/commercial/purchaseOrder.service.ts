import { PaymentMethod, Prisma, PurchaseOrderStatus, SupplierInvoiceStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { stockService, type StockTransactionClient } from '../stockService';
import { ResultHandler, Result } from '../../utils/result';
import { invalidateCommercialCache } from './shared';
import { fiscalService } from '../fiscalService';
import { approvalsService } from '../approvalsService';
import { getThresholds, isOverThreshold } from '../approvals/thresholds';
import type { CommercialListQuery, PartialDeliveryInput } from '../../validation/commercial';
import type {
    AddSupplierInvoicePaymentInput,
    CreateSupplierInvoiceInput,
    ListSupplierInvoicesQuery,
} from '../../validation/supplierInvoices';

type SupplierPaymentTransactionClient = Pick<StockTransactionClient, 'transaction'>;
type SupplierInvoiceItemInput = NonNullable<CreateSupplierInvoiceInput['items']>[number];
type CalculatedSupplierInvoiceItem = Prisma.SupplierInvoiceItemUncheckedCreateWithoutSupplierInvoiceInput;

const PURCHASE_ORDER_STATUSES = ['draft', 'ordered', 'partial', 'received', 'cancelled'] as const satisfies readonly PurchaseOrderStatus[];

function isPurchaseOrderStatus(status: string): status is PurchaseOrderStatus {
    return PURCHASE_ORDER_STATUSES.includes(status as PurchaseOrderStatus);
}

export class CommercialPurchaseOrderService {
    private roundMoney(value: number) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    private supplierPaymentReference(paymentId: string) {
        return `SUPPAY-${paymentId}`;
    }

    private async recordSupplierPaymentExpense(
        tx: SupplierPaymentTransactionClient,
        params: {
            companyId: string;
            supplierName?: string | null;
            invoiceNumber: string;
            paymentId: string;
            amount: number;
            method?: PaymentMethod | null;
            paymentDate: Date;
            reference?: string | null;
            notes?: string | null;
        }
    ) {
        await tx.transaction.create({
            data: {
                type: 'expense',
                category: 'Stock_Purchase',
                description: `Pagamento fornecedor: ${params.supplierName || params.invoiceNumber}`,
                amount: params.amount,
                date: params.paymentDate,
                status: 'completed',
                paymentMethod: params.method || 'transfer',
                reference: this.supplierPaymentReference(params.paymentId),
                notes: [
                    `Factura: ${params.invoiceNumber}`,
                    params.reference ? `Ref. externa: ${params.reference}` : null,
                    params.notes || null,
                ].filter(Boolean).join('\n') || null,
                module: 'commercial',
                companyId: params.companyId,
            },
        });
    }

    async listPurchaseOrders(companyId: string, query: CommercialListQuery) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const { page, limit, skip } = getPaginationParams(query);
        const { status, supplierId, search } = query;

        const where: Prisma.PurchaseOrderWhereInput = { companyId, deletedAt: null };
        if (status && isPurchaseOrderStatus(status)) where.status = status;
        if (supplierId) where.supplierId = supplierId;
        if (search) {
            where.OR = [
                { orderNumber: { contains: String(search), mode: 'insensitive' } },
                { supplier: { name: { contains: String(search), mode: 'insensitive' } } }
            ];
        }

        const [total, orders] = await Promise.all([
            prisma.purchaseOrder.count({ where }),
            prisma.purchaseOrder.findMany({
                where,
                include: {
                    supplier: { select: { id: true, name: true, code: true, phone: true } },
                    items: { include: { product: { select: { id: true, name: true, code: true, unit: true } } } }
                },
                orderBy: { createdAt: 'desc' },
                skip, take: limit
            })
        ]);

        return ResultHandler.success(createPaginatedResponse(orders, page, limit, total));
    }

    async getPurchaseOrderById(id: string, companyId: string) {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId, deletedAt: null },
            include: {
                supplier: true,
                items: { include: { product: { select: { id: true, name: true, code: true, unit: true, costPrice: true } } } }
            }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');
        return ResultHandler.success(order);
    }

    async listSupplierInvoices(companyId: string, query: ListSupplierInvoicesQuery) {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
        const { page, limit, skip } = getPaginationParams(query);
        const { purchaseOrderId, supplierId, status, period } = query;

        const where: Prisma.SupplierInvoiceWhereInput = { companyId };
        if (purchaseOrderId) where.purchaseOrderId = String(purchaseOrderId);
        if (supplierId) where.supplierId = String(supplierId);
        if (status) where.status = status;
        if (period) {
            const [year, month] = String(period).split('-').map(Number);
            if (year && month) {
                where.issueDate = {
                    gte: new Date(Date.UTC(year, month - 1, 1)),
                    lt: new Date(Date.UTC(year, month, 1)),
                };
            }
        }

        const [total, invoices] = await Promise.all([
            prisma.supplierInvoice.count({ where }),
            prisma.supplierInvoice.findMany({
                where,
                include: {
                    supplier: { select: { id: true, name: true, nuit: true } },
                    purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
                    items: { include: { product: { select: { id: true, name: true, code: true } } } },
                    payments: { orderBy: { paymentDate: 'desc' } }
                },
                orderBy: { issueDate: 'desc' },
                skip,
                take: limit
            })
        ]);

        return ResultHandler.success(createPaginatedResponse(invoices, page, limit, total));
    }

    async createSupplierInvoice(
        purchaseOrderId: string,
        data: CreateSupplierInvoiceInput,
        companyId: string,
        userId?: string
    ) {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');

        const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
        const period = issueDate.toISOString().slice(0, 7);
        await fiscalService.assertFiscalPeriodOpen(companyId, period);

        const order = await prisma.purchaseOrder.findFirst({
            where: {
                id: purchaseOrderId,
                companyId,
                deletedAt: null,
                status: { in: [PurchaseOrderStatus.partial, PurchaseOrderStatus.received] },
            },
            include: {
                supplier: true,
                items: { include: { product: { select: { id: true, name: true, code: true } } } }
            }
        });
        if (!order) throw ApiError.badRequest('A factura so pode ser registada para uma ordem recebida ou parcialmente recebida');

        const invoiceNumber = String(data.invoiceNumber || '').trim();
        if (!invoiceNumber) throw ApiError.badRequest('Numero da factura do fornecedor e obrigatorio');

        const existing = await prisma.supplierInvoice.findFirst({
            where: { companyId, invoiceNumber },
            select: { id: true }
        });
        if (existing) throw ApiError.badRequest('Ja existe uma factura de fornecedor com este numero nesta empresa');

        const taxRate = data.taxRate !== undefined
            ? Number(data.taxRate)
            : await fiscalService.getActiveIvaRate(companyId);
        if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
            throw ApiError.badRequest('Taxa de IVA invalida');
        }

        const existingItems = await prisma.supplierInvoiceItem.findMany({
            where: {
                purchaseOrderItemId: { in: order.items.map(item => item.id) },
                supplierInvoice: { companyId, status: { not: 'cancelled' } }
            },
            select: { purchaseOrderItemId: true, quantity: true }
        });

        const alreadyInvoiced = existingItems.reduce((map: Map<string, number>, item) => {
            if (!item.purchaseOrderItemId) return map;
            map.set(item.purchaseOrderItemId, (map.get(item.purchaseOrderItemId) || 0) + Number(item.quantity || 0));
            return map;
        }, new Map<string, number>());

        const requestedItems = Array.isArray(data.items) && data.items.length > 0
            ? data.items
            : order.items.map(item => ({
                purchaseOrderItemId: item.id,
                quantity: Math.max(0, Number(item.receivedQty || 0) - (alreadyInvoiced.get(item.id) || 0))
            }));

        const invoiceItems: CalculatedSupplierInvoiceItem[] = requestedItems
            .map((requested: SupplierInvoiceItemInput) => {
                const orderItem = order.items.find(item => item.id === requested.purchaseOrderItemId);
                if (!orderItem) throw ApiError.badRequest('Item da ordem de compra invalido');

                const quantity = Number(requested.quantity || 0);
                const available = Number(orderItem.receivedQty || 0) - (alreadyInvoiced.get(orderItem.id) || 0);
                if (!Number.isInteger(quantity) || quantity <= 0) {
                    throw ApiError.badRequest('Quantidade da factura deve ser inteira e positiva');
                }
                if (quantity > available) {
                    throw ApiError.badRequest(`Quantidade facturada excede a quantidade recebida disponivel para ${orderItem.product?.name || orderItem.productId}`);
                }

                const unitCost = Number(orderItem.unitCost || 0);
                const lineBase = this.roundMoney(quantity * unitCost);
                const lineTax = this.roundMoney(lineBase * (taxRate / 100));

                return {
                    purchaseOrderItemId: orderItem.id,
                    productId: orderItem.productId,
                    description: orderItem.product?.name || orderItem.productId,
                    quantity,
                    unitCost,
                    taxRate,
                    taxAmount: lineTax,
                    total: lineBase,
                };
            })
            .filter(item => item.quantity > 0);

        if (!invoiceItems.length) {
            throw ApiError.badRequest('Nao existem quantidades recebidas por facturar nesta ordem');
        }

        const subtotal = this.roundMoney(invoiceItems.reduce((sum, item) => sum + Number(item.total), 0));
        const tax = this.roundMoney(invoiceItems.reduce((sum, item) => sum + Number(item.taxAmount), 0));
        const total = this.roundMoney(subtotal + tax);

        const markPaid = data.status === 'paid';
        const invoice = await prisma.supplierInvoice.create({
            data: {
                invoiceNumber,
                supplierId: order.supplierId,
                purchaseOrderId: order.id,
                subtotal,
                tax,
                total,
                amountPaid: markPaid ? total : 0,
                amountDue: markPaid ? 0 : total,
                taxRate,
                status: markPaid ? 'paid' : 'registered',
                issueDate,
                dueDate: data.dueDate ? new Date(data.dueDate) : null,
                paidAt: markPaid ? new Date() : null,
                notes: data.notes || null,
                createdByUserId: userId,
                companyId,
                items: { create: invoiceItems }
            },
            include: {
                supplier: { select: { id: true, name: true, nuit: true } },
                purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
                items: { include: { product: { select: { id: true, name: true, code: true } } } }
            }
        });

        if (markPaid) {
            await prisma.$transaction(async (tx) => {
                const payment = await tx.supplierInvoicePayment.create({
                    data: {
                        supplierInvoiceId: invoice.id,
                        amount: total,
                        method: 'transfer',
                        paymentDate: issueDate,
                        reference: invoiceNumber,
                        notes: 'Pagamento registado na criacao da factura',
                        createdByUserId: userId ?? null,
                    },
                });
                await this.recordSupplierPaymentExpense(tx, {
                    companyId,
                    supplierName: order.supplier?.name,
                    invoiceNumber,
                    paymentId: payment.id,
                    amount: total,
                    method: 'transfer',
                    paymentDate: issueDate,
                    reference: invoiceNumber,
                    notes: 'Pagamento registado na criacao da factura',
                });
            });
        }

        invalidateCommercialCache(companyId);
        return ResultHandler.success(invoice, 'Factura de fornecedor registada');
    }

    async getSupplierInvoiceById(id: string, companyId: string) {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
        const invoice = await prisma.supplierInvoice.findFirst({
            where: { id, companyId },
            include: {
                supplier: { select: { id: true, name: true, nuit: true, phone: true, email: true } },
                purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
                items: { include: { product: { select: { id: true, name: true, code: true, unit: true } } } },
                payments: { orderBy: { paymentDate: 'desc' } }
            }
        });
        if (!invoice) throw ApiError.notFound('Factura de fornecedor nao encontrada');
        return ResultHandler.success(invoice);
    }

    async updateSupplierInvoiceStatus(
        id: string,
        status: Extract<SupplierInvoiceStatus, 'paid' | 'cancelled'>,
        companyId: string,
        userId?: string
    ) {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');

        const invoice = await prisma.supplierInvoice.findFirst({
            where: { id, companyId },
            include: { supplier: { select: { name: true } } }
        });
        if (!invoice) throw ApiError.notFound('Factura de fornecedor nao encontrada');

        const validTransitions: Record<SupplierInvoiceStatus, SupplierInvoiceStatus[]> = {
            registered: ['paid', 'cancelled'],
            partial:    ['paid', 'cancelled'],
            paid:       ['cancelled'],
            cancelled:  [],
        };
        const allowed = validTransitions[invoice.status] ?? [];
        if (!allowed.includes(status)) {
            throw ApiError.badRequest(`Transicao de "${invoice.status}" para "${status}" nao e permitida`);
        }

        const period = new Date(invoice.issueDate).toISOString().slice(0, 7);
        await fiscalService.assertFiscalPeriodOpen(companyId, period);

        const total = Number(invoice.total);
        const updated = await prisma.$transaction(async (tx) => {
            if (status === 'paid') {
                const remaining = this.roundMoney(total - Number(invoice.amountPaid || 0));
                if (remaining > 0) {
                    const payment = await tx.supplierInvoicePayment.create({
                        data: {
                            supplierInvoiceId: id,
                            amount: remaining,
                            method: 'transfer',
                            paymentDate: new Date(),
                            reference: invoice.invoiceNumber,
                            notes: 'Pagamento registado ao marcar factura como paga',
                            createdByUserId: userId ?? null,
                        },
                    });
                    await this.recordSupplierPaymentExpense(tx, {
                        companyId,
                        supplierName: invoice.supplier?.name,
                        invoiceNumber: invoice.invoiceNumber,
                        paymentId: payment.id,
                        amount: remaining,
                        method: 'transfer',
                        paymentDate: payment.paymentDate,
                        reference: invoice.invoiceNumber,
                        notes: 'Pagamento registado ao marcar factura como paga',
                    });
                }
            }

            return tx.supplierInvoice.update({
                where: { id },
                data: {
                    status,
                    ...(status === 'paid'
                        ? { amountPaid: total, amountDue: 0, paidAt: new Date() }
                        : { paidAt: null }),
                },
                include: {
                    supplier: { select: { id: true, name: true, nuit: true } },
                    purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
                    items: { include: { product: { select: { id: true, name: true, code: true } } } },
                    payments: { orderBy: { paymentDate: 'desc' } }
                }
            });
        });

        invalidateCommercialCache(companyId);
        return ResultHandler.success(updated, `Factura ${status === 'paid' ? 'marcada como paga' : 'cancelada'}`);
    }

    async addSupplierInvoicePayment(
        invoiceId: string,
        data: AddSupplierInvoicePaymentInput,
        companyId: string,
        userId?: string
    ) {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');

        const invoice = await prisma.supplierInvoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { supplier: { select: { name: true } } }
        });
        if (!invoice) throw ApiError.notFound('Factura de fornecedor nao encontrada');
        if (invoice.status === 'cancelled') {
            throw ApiError.badRequest('Nao e possivel registar pagamentos numa factura cancelada');
        }
        if (invoice.status === 'paid') {
            throw ApiError.badRequest('Esta factura ja se encontra totalmente paga');
        }

        const paymentDate = data.paymentDate ?? new Date();
        const period = paymentDate.toISOString().slice(0, 7);
        await fiscalService.assertFiscalPeriodOpen(companyId, period);

        const amount = this.roundMoney(Number(data.amount));
        if (!Number.isFinite(amount) || amount <= 0) {
            throw ApiError.badRequest('Montante do pagamento deve ser positivo');
        }

        // Supplier payments above the configured threshold need a manager
        // approval. Resource is the supplier invoice being paid.
        const thresholds = await getThresholds(companyId);
        let consumedApprovalId: string | undefined;
        if (isOverThreshold(thresholds, 'supplierPayment', amount)) {
            const approval = await approvalsService.findApprovedFor(companyId, 'supplier_payment', 'supplier_invoice', invoiceId);
            if (!approval) {
                throw ApiError.forbidden(
                    `Pagamento acima do limite (${thresholds.supplierPayment}). Solicite aprovação.`
                );
            }
            if (approval.amount !== null && approval.amount + 0.01 < amount) {
                throw ApiError.forbidden('O valor excede a aprovação concedida.');
            }
            consumedApprovalId = approval.id;
        }

        const total = Number(invoice.total);
        const currentPaid = Number(invoice.amountPaid);
        const remaining = this.roundMoney(total - currentPaid);
        if (amount > remaining + 0.01) {
            throw ApiError.badRequest(`Montante excede o saldo em divida (${remaining.toFixed(2)})`);
        }

        const newPaid = this.roundMoney(currentPaid + amount);
        const newDue = this.roundMoney(Math.max(total - newPaid, 0));
        const fullyPaid = newDue <= 0;

        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.supplierInvoicePayment.create({
                data: {
                    supplierInvoiceId: invoiceId,
                    amount,
                    method: data.method ?? 'transfer',
                    paymentDate,
                    reference: data.reference ?? null,
                    notes: data.notes ?? null,
                    createdByUserId: userId ?? null,
                },
            });

            await this.recordSupplierPaymentExpense(tx, {
                companyId,
                supplierName: invoice.supplier?.name,
                invoiceNumber: invoice.invoiceNumber,
                paymentId: payment.id,
                amount,
                method: data.method ?? 'transfer',
                paymentDate,
                reference: data.reference ?? null,
                notes: data.notes ?? null,
            });

            return tx.supplierInvoice.update({
                where: { id: invoiceId },
                data: {
                    amountPaid: newPaid,
                    amountDue: newDue,
                    status: fullyPaid ? 'paid' : 'partial',
                    paidAt: fullyPaid ? new Date() : null,
                },
                include: {
                    supplier: { select: { id: true, name: true, nuit: true } },
                    purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
                    items: { include: { product: { select: { id: true, name: true, code: true } } } },
                    payments: { orderBy: { paymentDate: 'desc' } }
                }
            });
        });

        invalidateCommercialCache(companyId);
        if (consumedApprovalId || data.approvalId) {
            await approvalsService.markConsumed(consumedApprovalId || data.approvalId!, companyId).catch(() => {});
        }
        return ResultHandler.success(result, fullyPaid ? 'Factura totalmente paga' : 'Pagamento registado');
    }

    async listSupplierInvoicePayments(invoiceId: string, companyId: string) {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
        const invoice = await prisma.supplierInvoice.findFirst({
            where: { id: invoiceId, companyId },
            select: { id: true }
        });
        if (!invoice) throw ApiError.notFound('Factura de fornecedor nao encontrada');

        const payments = await prisma.supplierInvoicePayment.findMany({
            where: { supplierInvoiceId: invoiceId },
            orderBy: { paymentDate: 'desc' }
        });
        return ResultHandler.success(payments);
    }

    async deleteSupplierInvoicePayment(
        invoiceId: string,
        paymentId: string,
        companyId: string
    ) {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');

        const payment = await prisma.supplierInvoicePayment.findFirst({
            where: { id: paymentId, supplierInvoiceId: invoiceId },
            include: { supplierInvoice: { select: { id: true, companyId: true, status: true, total: true, amountPaid: true, issueDate: true } } }
        });
        if (!payment || payment.supplierInvoice.companyId !== companyId) {
            throw ApiError.notFound('Pagamento nao encontrado');
        }
        if (payment.supplierInvoice.status === 'cancelled') {
            throw ApiError.badRequest('Factura cancelada — nao e possivel reverter pagamentos');
        }

        const period = new Date(payment.supplierInvoice.issueDate).toISOString().slice(0, 7);
        await fiscalService.assertFiscalPeriodOpen(companyId, period);

        const total = Number(payment.supplierInvoice.total);
        const currentPaid = Number(payment.supplierInvoice.amountPaid);
        const newPaid = this.roundMoney(Math.max(currentPaid - Number(payment.amount), 0));
        const newDue = this.roundMoney(Math.max(total - newPaid, 0));
        const newStatus = newPaid <= 0 ? 'registered' : (newDue <= 0 ? 'paid' : 'partial');

        const result = await prisma.$transaction(async (tx) => {
            await tx.transaction.deleteMany({
                where: {
                    companyId,
                    module: 'commercial',
                    reference: this.supplierPaymentReference(paymentId),
                },
            });
            await tx.supplierInvoicePayment.delete({ where: { id: paymentId } });
            return tx.supplierInvoice.update({
                where: { id: invoiceId },
                data: {
                    amountPaid: newPaid,
                    amountDue: newDue,
                    status: newStatus,
                    paidAt: newStatus === 'paid' ? new Date() : null,
                },
                include: {
                    supplier: { select: { id: true, name: true, nuit: true } },
                    purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
                    items: { include: { product: { select: { id: true, name: true, code: true } } } },
                    payments: { orderBy: { paymentDate: 'desc' } }
                }
            });
        });

        invalidateCommercialCache(companyId);
        return ResultHandler.success(result, 'Pagamento removido');
    }

    // Resolve a destination warehouse:
    //   - explicit ID wins (must belong to company and be active)
    //   - if multiple active warehouses exist, an explicit ID is mandatory to avoid silent misrouting
    //   - single-warehouse companies fall back to that warehouse
    private async resolveWarehouseId(companyId: string, explicitId?: string): Promise<string | undefined> {
        if (explicitId) {
            const exists = await prisma.warehouse.findFirst({
                where: { id: explicitId, companyId, isActive: true },
                select: { id: true }
            });
            if (!exists) throw ApiError.badRequest('Armazém não encontrado ou inactivo');
            return exists.id;
        }
        const active = await prisma.warehouse.findMany({
            where: { companyId, isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true }
        });
        if (active.length > 1) {
            throw ApiError.badRequest('Seleccione o armazém de destino — esta empresa tem múltiplos armazéns activos');
        }
        return active[0]?.id;
    }

    async updatePurchaseOrderStatus(
        id: string,
        status: PurchaseOrderStatus,
        companyId: string,
        userId?: string,
        warehouseId?: string,
        approvalId?: string,
    ) {
        const validTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
            draft:     ['ordered', 'cancelled'],
            ordered:   ['partial', 'received', 'cancelled'],
            partial:   ['received', 'cancelled'],
            received:  [],
            cancelled: [],
        };

        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId, deletedAt: null },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');

        const allowed = validTransitions[order.status] ?? [];
        if (!allowed.includes(status)) {
            throw ApiError.badRequest(`Transição de "${order.status}" para "${status}" não é permitida`);
        }

        // Confirming a draft into "ordered" commits the company to a payable.
        // Above the threshold we require an approved request linked to this PO.
        let consumedApprovalId: string | undefined;
        if (order.status === 'draft' && status === 'ordered') {
            const orderTotal = Number(order.total ?? 0);
            const thresholds = await getThresholds(companyId);
            if (isOverThreshold(thresholds, 'purchaseOrder', orderTotal)) {
                const approval = await approvalsService.findApprovedFor(companyId, 'purchase_order', 'purchase_order', id);
                if (!approval) {
                    throw ApiError.forbidden(
                        `Ordem de compra acima do limite (${thresholds.purchaseOrder}). Solicite aprovação.`
                    );
                }
                if (approval.amount !== null && approval.amount + 0.01 < orderTotal) {
                    throw ApiError.forbidden('O valor da OC excede a aprovação concedida.');
                }
                consumedApprovalId = approval.id;
            }
        }

        const targetWarehouseId = status === 'received'
            ? await this.resolveWarehouseId(companyId, warehouseId)
            : undefined;

        // Receiving stock fans out into multiple recordMovement queries per item;
        // bumping the txn timeout from Prisma's 5s default avoids 504s on slow DBs.
        const result = await prisma.$transaction(async (tx) => {
            // Atomic guard: only update if status hasn't changed since we read it.
            const updated = await tx.purchaseOrder.updateMany({
                where: { id, companyId, status: order.status, deletedAt: null },
                data: {
                    status,
                    ...(status === 'received' ? { receivedDate: new Date() } : {}),
                },
            });
            if (updated.count === 0) {
                throw ApiError.badRequest('A ordem de compra foi alterada por outro utilizador. Recarregue.');
            }

            if (status === 'received') {
                for (const item of order.items) {
                    const qtyToAdd = item.quantity - item.receivedQty;
                    if (qtyToAdd > 0) {
                        await stockService.recordMovement({
                            productId: item.productId,
                            companyId,
                            warehouseId: targetWarehouseId,
                            quantity: qtyToAdd,
                            movementType: 'purchase',
                            originModule: 'COMMERCIAL',
                            referenceType: 'PURCHASE',
                            referenceContent: order.orderNumber,
                            reason: `Receção de OC ${order.orderNumber}`,
                            performedBy: userId || companyId,
                        }, tx);
                        await tx.product.update({ where: { id: item.productId }, data: { costPrice: item.unitCost } });
                        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.quantity } });
                    }
                }
            }

            return tx.purchaseOrder.findUnique({
                where: { id },
                include: {
                    supplier: { select: { id: true, name: true } },
                    items: { include: { product: { select: { id: true, name: true } } } }
                }
            });
        }, { timeout: 30000, maxWait: 10000 });

        invalidateCommercialCache(companyId);
        if ((consumedApprovalId || approvalId) && order.status === 'draft' && status === 'ordered') {
            await approvalsService.markConsumed(consumedApprovalId || approvalId!, companyId).catch(() => {});
        }
        return ResultHandler.success(result, `Estado da OC actualizado para ${status}`);
    }

    async registerPartialDelivery(
        id: string,
        deliveries: PartialDeliveryInput['deliveries'],
        companyId: string,
        userId?: string,
        warehouseId?: string
    ) {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId, deletedAt: null, status: { in: ['ordered', 'partial'] } },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada ou já concluída');

        const targetWarehouseId = await this.resolveWarehouseId(companyId, warehouseId);

        const result = await prisma.$transaction(async (tx) => {
            let allReceived = true;

            for (const delivery of deliveries) {
                const item = order.items.find(i => i.id === delivery.itemId);
                if (!item) continue;

                const newReceived = Math.min(item.receivedQty + delivery.receivedQty, item.quantity);
                const addedQty = newReceived - item.receivedQty;

                if (addedQty > 0) {
                    await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: newReceived } });
                    await stockService.recordMovement({
                        productId: item.productId,
                        companyId,
                        warehouseId: targetWarehouseId,
                        quantity: addedQty,
                        movementType: 'purchase',
                        originModule: 'COMMERCIAL',
                        referenceType: 'PURCHASE',
                        referenceContent: order.orderNumber,
                        reason: `Entrega parcial de OC ${order.orderNumber}`,
                        performedBy: userId || companyId,
                    }, tx);
                }

                if (newReceived < item.quantity) allReceived = false;
            }

            const newStatus = allReceived ? PurchaseOrderStatus.received : PurchaseOrderStatus.partial;
            return tx.purchaseOrder.update({
                where: { id },
                data: { status: newStatus, ...(newStatus === PurchaseOrderStatus.received ? { receivedDate: new Date() } : {}) },
                include: {
                    supplier: { select: { id: true, name: true } },
                    items: { include: { product: { select: { id: true, name: true } } } }
                }
            });
        }, { timeout: 30000, maxWait: 10000 });

        invalidateCommercialCache(companyId);
        return ResultHandler.success(result, 'Entrega parcial registada');
    }

    async deletePurchaseOrder(id: string, companyId: string): Promise<Result<boolean>> {
        const order = await prisma.purchaseOrder.findFirst({ where: { id, companyId, status: 'draft', deletedAt: null } });
        if (!order) throw ApiError.badRequest('Apenas ordens em rascunho podem ser eliminadas');
        await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
        invalidateCommercialCache(companyId);
        return ResultHandler.success(true, 'Ordem de compra eliminada');
    }
}

export const commercialPurchaseOrderService = new CommercialPurchaseOrderService();
