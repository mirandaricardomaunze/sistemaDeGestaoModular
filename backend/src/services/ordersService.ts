import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta, parseFields } from '../utils/pagination';

type ListQuery = {
    status?: string;
    priority?: string;
    page?: string | number;
    limit?: string | number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string;
};

type IncomingOrderItem = {
    productId: string;
    quantity: number;
    price?: number;
    unitPrice?: number;
    productName?: string;
    total?: number;
};

// Tolerance for matching frontend-sent prices against DB prices.
// Mirrors salesService: accept unit price, box price, or any lower (discount).
const PRICE_MATCH_ABS = 0.01;
const PRICE_MATCH_REL = 0.001;

const OPEN_INVOICE_STATUSES: Prisma.InvoiceWhereInput['status'] = { in: ['draft', 'sent', 'partial', 'overdue'] };

const ORDER_FIELD_ALLOWLIST = [
    'id', 'orderNumber', 'customerId', 'customerName', 'customerPhone',
    'customerEmail', 'customerAddress', 'status', 'priority',
    'subtotal', 'discount', 'total', 'paymentMethod', 'deliveryDate',
    'notes', 'createdAt', 'updatedAt'
] as const;
import { stockService } from './stockService';
import { logger } from '../utils/logger';
import type { CreateOrderInput, UpdateOrderInput, UpdateOrderStatusInput } from '../validation/orders';
import { validateQuantityForUnit } from '../constants/unitOfMeasure';

// Valid status transitions: enforces sequential flow
const validTransitions: Record<string, string[]> = {
    created: ['printed'],
    printed: ['separated'],
    separated: ['completed'],
    completed: [],
    cancellation_requested: [],
    cancellation_rejected: [],
    cancelled: [],
};

export class OrdersService {
    async list(params: ListQuery, companyId: string) {
        const { status, priority, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = params;
        const pageNum = parseInt(String(page));
        const limitNum = parseInt(String(limit));
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.CustomerOrderWhereInput = { companyId };
        if (status && status !== 'all') where.status = status as Prisma.CustomerOrderWhereInput['status'];
        if (priority && priority !== 'all') where.priority = priority as Prisma.CustomerOrderWhereInput['priority'];

        const projection = parseFields(params.fields, ORDER_FIELD_ALLOWLIST);
        const baseArgs = {
            where,
            orderBy: { [sortBy]: sortOrder } as Prisma.CustomerOrderOrderByWithRelationInput,
            skip,
            take: limitNum
        };
        const findArgs: Prisma.CustomerOrderFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.CustomerOrderSelect }
            : {
                ...baseArgs,
                include: {
                    items: true,
                    cancellationRequests: { orderBy: { requestedAt: 'desc' }, take: 1 },
                    transitions: { orderBy: { timestamp: 'asc' } }
                }
            };

        const [total, orders] = await Promise.all([
            prisma.customerOrder.count({ where }),
            prisma.customerOrder.findMany(findArgs)
        ]);

        return {
            data: orders,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async getById(id: string, companyId: string) {
        const order = await prisma.customerOrder.findFirst({
            where: { id, companyId },
            include: {
                items: true,
                cancellationRequests: { orderBy: { requestedAt: 'desc' } },
                transitions: { orderBy: { timestamp: 'asc' } }
            }
        });
        if (!order) throw ApiError.notFound('Encomenda não encontrada');
        return order;
    }

    async create(data: CreateOrderInput, companyId: string) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.customerOrder.count({ where: { companyId } });
        const orderNumber = `ENC-${dateStr}-${String(count + 1).padStart(4, '0')}`;

        const {
            customerName, customerPhone, customerEmail, customerAddress,
            customerId, items, priority, paymentMethod, deliveryDate, notes,
            discount: requestedDiscount
        } = data;

        return await prisma.$transaction(async (tx) => {
            // ====================================================================
            // SERVER-SIDE AUTHORITATIVE CALCULATION
            // Fetch real prices from DB and recalculate total.
            // Never trust frontend-provided total.
            // ====================================================================
            // Transaction config moved to the trailing options below — Supabase
            // latency + per-item reservation loop + credit aggregation overruns
            // Prisma's default 5s timeout. Mirrors salesService.create.
            const productIds = items.map(i => i.productId).filter(Boolean) as string[];
            const productMap = new Map<string, { name: string; price: number; packSize: number; unit: string }>();

            if (productIds.length > 0) {
                const products = await tx.product.findMany({
                    where: { id: { in: productIds }, companyId },
                    select: { id: true, name: true, price: true, packSize: true, unit: true }
                });
                for (const p of products) {
                    productMap.set(p.id, {
                        name: p.name,
                        price: Number(p.price),
                        packSize: Number(p.packSize) || 1,
                        unit: p.unit || 'un',
                    });
                }
            }

            // Verify and recalculate each item.
            // product.price = preço de venda DA CAIXA; OrderItem é persistido em UNIDADES
            // com unitPrice por unidade. Aceitamos preço unitário, preço por caixa
            // (cliente legado) ou qualquer preço inferior ao unitário oficial (desconto).
            // Mirrors salesService:280-343.
            const verifiedItems = (items as IncomingOrderItem[]).map((item) => {
                const product = productMap.get(item.productId);
                const sentPrice = Number(item.price ?? item.unitPrice ?? 0);

                if (product) {
                    const uomError = validateQuantityForUnit(item.quantity, product.unit || 'un');
                    if (uomError) {
                        throw ApiError.badRequest(`Produto "${product.name}": ${uomError}`);
                    }
                }

                if (!product || product.price <= 0) {
                    return {
                        ...item,
                        price: sentPrice,
                        unitPrice: sentPrice,
                        productName: item.productName || product?.name || '',
                        total: Math.round(sentPrice * item.quantity * 100) / 100,
                    };
                }

                const packSize = product.packSize;
                const dbBoxPrice = product.price;
                const dbUnitPrice = dbBoxPrice / packSize;

                const matchesUnit = Math.abs(dbUnitPrice - sentPrice) <= Math.max(PRICE_MATCH_ABS, dbUnitPrice * PRICE_MATCH_REL);
                const matchesBox = packSize > 1 && Math.abs(dbBoxPrice - sentPrice) <= PRICE_MATCH_ABS;
                const isBelow = sentPrice <= dbUnitPrice + PRICE_MATCH_ABS;

                let normalizedUnitPrice = sentPrice;
                if (matchesBox) {
                    normalizedUnitPrice = dbUnitPrice;
                } else if (!matchesUnit && !isBelow) {
                    logger.warn('Order price mismatch detected', {
                        productId: item.productId,
                        productName: product.name,
                        frontendPrice: sentPrice,
                        dbUnitPrice,
                        dbBoxPrice,
                        packSize,
                        companyId,
                    });
                    normalizedUnitPrice = dbUnitPrice;
                }

                normalizedUnitPrice = Math.round(normalizedUnitPrice * 10000) / 10000;
                return {
                    ...item,
                    price: normalizedUnitPrice,
                    unitPrice: normalizedUnitPrice,
                    productName: item.productName || product.name,
                    total: Math.round(normalizedUnitPrice * item.quantity * 100) / 100,
                };
            });

            // ====================================================================
            // IVA breakdown (frozen at order creation)
            // The order is the contract with the customer: we capture the tax
            // rate at this moment so the invoice generated later reflects the
            // exact totals the customer agreed to, even if the company-wide
            // rate changes in the meantime.
            // ====================================================================
            const subtotal = Math.round(verifiedItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
            const discount = Math.max(0, Math.round(Number(requestedDiscount || 0) * 100) / 100);
            const taxableBase = Math.max(0, subtotal - discount);

            const companyCfg = await tx.companySettings.findFirst({
                where: { companyId },
                select: { ivaRate: true }
            });
            const taxRate = Number(companyCfg?.ivaRate ?? 16);
            const taxAmount = Math.round(taxableBase * (taxRate / 100) * 100) / 100;
            const total = Math.round((taxableBase + taxAmount) * 100) / 100;

            // 0. Validate customer credit limit if a customer is linked
            if (customerId) {
                const customer = await tx.customer.findFirst({
                    where: { id: customerId, companyId }
                });
                if (customer && customer.creditLimit !== null) {
                    const openOrdersTotal = await tx.customerOrder.aggregate({
                        where: { customerId, companyId, status: { notIn: ['cancelled', 'completed'] } },
                        _sum: { total: true }
                    });
                    const openInvoicesTotal = await tx.invoice.aggregate({
                        where: { customerId, companyId, status: OPEN_INVOICE_STATUSES },
                        _sum: { amountDue: true }
                    });
                    const currentExposure =
                        Number(openOrdersTotal._sum.total ?? 0) +
                        Number(openInvoicesTotal._sum.amountDue ?? 0);
                    if (currentExposure + total > Number(customer.creditLimit)) {
                        throw ApiError.badRequest(
                            `Limite de crédito excedido para "${customer.name}". ` +
                            `Limite: ${Number(customer.creditLimit).toFixed(2)} MT, ` +
                            `Exposição atual: ${currentExposure.toFixed(2)} MT, ` +
                            `Este pedido: ${total.toFixed(2)} MT.`
                        );
                    }
                }
            }

            // 1. Verify and reserve stock for each item
            for (const item of verifiedItems) {
                await stockService.reserveStock(item.productId, item.quantity, companyId, tx);
            }

            // 2. Create the order with only valid fields
            const order = await tx.customerOrder.create({
                data: {
                    orderNumber,
                    customerName,
                    customerPhone,
                    customerEmail: customerEmail || null,
                    customerAddress: customerAddress || null,
                    customerId: customerId || null,
                    subtotal,
                    discount,
                    taxRate,
                    taxAmount,
                    total,
                    status: 'created',
                    priority: priority || 'normal',
                    paymentMethod: paymentMethod || null,
                    deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
                    notes: notes || null,
                    companyId,
                    items: {
                        create: verifiedItems.map((item) => ({
                            productId: item.productId,
                            productName: item.productName || '',
                            quantity: item.quantity,
                            price: item.price || item.unitPrice || 0,
                            total: item.total
                        }))
                    },
                    transitions: {
                        create: { status: 'created', responsibleName: 'Sistema' }
                    }
                },
                include: { items: true, transitions: true }
            });

            return order;
        }, { timeout: 30000, maxWait: 10000 });
    }

    async updateStatus(id: string, data: UpdateOrderStatusInput, companyId: string) {
        const existing = await prisma.customerOrder.findFirst({
            where: { id, companyId },
            include: { items: true }
        });
        if (!existing) throw ApiError.notFound('Encomenda não encontrada');

        const { status, responsibleName, notes } = data;

        // Quotations don't need the cancellation-approval flow — they can be cancelled directly.
        const isQuotation = existing.orderType === 'quotation';
        if (!isQuotation && (status === 'cancelled' || status === 'cancellation_requested' || status === 'cancellation_rejected')) {
            throw ApiError.badRequest('Use o fluxo de pedido/aprovacao de cancelamento para cancelar encomendas.');
        }

        // Enforce sequential status transitions.
        // Quotations also allow direct cancellation from any non-terminal state.
        const allowed = [...(validTransitions[existing.status] || [])];
        if (isQuotation && status === 'cancelled' && existing.status !== 'completed' && existing.status !== 'cancelled') {
            allowed.push('cancelled');
        }
        if (!allowed.includes(status)) {
            if (existing.status === 'cancelled' || existing.status === 'completed') {
                throw ApiError.badRequest(`Esta encomenda já se encontra no estado final: ${existing.status}`);
            }
            const allowedLabels = allowed.join(', ') || 'nenhum';
            throw ApiError.badRequest(
                `Transição inválida: não é possível mudar de "${existing.status}" para "${status}". ` +
                `Próximos estados permitidos: ${allowedLabels}`
            );
        }

        return await prisma.$transaction(async (tx) => {
            const orderStatus = status as Prisma.CustomerOrderUncheckedUpdateInput['status'];
            const updateData: Prisma.CustomerOrderUncheckedUpdateInput = {
                status: orderStatus,
                transitions: {
                    create: {
                        status: status as Prisma.OrderStatusTransitionUncheckedCreateWithoutOrderInput['status'],
                        responsibleName: responsibleName || 'Sistema',
                        notes
                    }
                }
            };

            await tx.customerOrder.update({
                where: { id },
                data: updateData
            });

            // Release reservedStock when a quotation is cancelled (mirrors the create-time increment).
            if (isQuotation && status === 'cancelled') {
                for (const item of existing.items) {
                    if (item.productId) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { reservedStock: { decrement: Number(item.quantity) } }
                        });
                    }
                }
            }

            return this.getById(id, companyId);
        }, { timeout: 15000, maxWait: 10000 });
    }

    async update(id: string, data: UpdateOrderInput, companyId: string) {
        const existing = await prisma.customerOrder.findFirst({
            where: { id, companyId }
        });
        if (!existing) throw ApiError.notFound('Encomenda não encontrada');

        const { deliveryDate, ...updateData } = data;

        await prisma.customerOrder.update({
            where: { id },
            data: {
                ...updateData,
                deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined
            }
        });

        return this.getById(id, companyId);
    }

    async delete(id: string, companyId: string) {
        await prisma.$transaction(async (tx) => {
            const order = await tx.customerOrder.findFirst({
                where: { id, companyId },
                include: { items: { select: { productId: true, quantity: true } } }
            });
            if (!order) throw ApiError.notFound('Encomenda não encontrada');

            // Quotations increment reservedStock on create; release it on delete to avoid leaks.
            if (order.orderType === 'quotation' && order.status !== 'completed' && order.status !== 'cancelled') {
                for (const item of order.items) {
                    if (item.productId) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { reservedStock: { decrement: Number(item.quantity) } }
                        });
                    }
                }
            }

            await tx.customerOrder.delete({ where: { id } });
        }, { timeout: 15000, maxWait: 10000 });
        return true;
    }

    async incrementPrintCount(id: string, companyId: string) {
        const order = await prisma.customerOrder.findFirst({
            where: { id, companyId }
        });
        if (!order) throw ApiError.notFound('Encomenda não encontrada');

        return await prisma.customerOrder.update({
            where: { id },
            data: { printCount: { increment: 1 } }
        });
    }
}

export const ordersService = new OrdersService();
