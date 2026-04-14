import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';
import { pdfService } from './pdfService';
import { stockService } from './StockService';
import { logger } from '../utils/logger';
import type { CreateOrderInput, UpdateOrderInput, UpdateOrderStatusInput } from '../validation/orders';

// Valid status transitions: enforces sequential flow
const validTransitions: Record<string, string[]> = {
    created: ['printed', 'cancelled'],
    printed: ['separated', 'cancelled'],
    separated: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
};

export class OrdersService {
    async list(params: any, companyId: string) {
        const { status, priority, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (status && status !== 'all') where.status = status;
        if (priority && priority !== 'all') where.priority = priority;

        const [total, orders] = await Promise.all([
            prisma.customerOrder.count({ where }),
            prisma.customerOrder.findMany({
                where,
                include: { items: true, transitions: { orderBy: { timestamp: 'asc' } } },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limitNum
            })
        ]);

        return {
            data: orders,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async getById(id: string, companyId: string) {
        const order = await prisma.customerOrder.findFirst({
            where: { id, companyId },
            include: { items: true, transitions: { orderBy: { timestamp: 'asc' } } }
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
            customerId, items, total, priority, paymentMethod, deliveryDate, notes
        } = data;

        return await prisma.$transaction(async (tx) => {
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
                        where: { customerId, companyId, status: { in: ['draft', 'sent', 'partial', 'overdue'] as any[] } },
                        _sum: { amountDue: true }
                    });
                    const currentExposure =
                        Number(openOrdersTotal._sum.total ?? 0) +
                        Number((openInvoicesTotal._sum as any).amountDue ?? 0);
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
            for (const item of items) {
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
                    total,
                    status: 'created',
                    priority: priority || 'normal',
                    paymentMethod: paymentMethod || null,
                    deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
                    notes: notes || null,
                    companyId,
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            productName: item.productName || '',
                            quantity: item.quantity,
                            price: item.price || item.unitPrice,
                            total: item.quantity * (item.price || item.unitPrice)
                        }))
                    },
                    transitions: {
                        create: { status: 'created', responsibleName: 'Sistema' }
                    }
                },
                include: { items: true, transitions: true }
            });

            return order;
        });
    }

    async updateStatus(id: string, data: UpdateOrderStatusInput, companyId: string) {
        const existing = await prisma.customerOrder.findFirst({
            where: { id, companyId },
            include: { items: true }
        });
        if (!existing) throw ApiError.notFound('Encomenda não encontrada');

        const { status, responsibleName, notes } = data;

        // Enforce sequential status transitions
        const allowed = validTransitions[existing.status] || [];
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
            // If the order is cancelled, release the reserved stock
            let cancellationDocUrl = null;
            if (status === 'cancelled') {
                let totalCanceled = 0;
                const itemsToReport = [];

                for (const item of existing.items) {
                    await stockService.releaseReservation(item.productId, item.quantity, companyId, tx);

                    totalCanceled += item.total.toNumber ? item.total.toNumber() : Number(item.total);
                    itemsToReport.push({
                        productName: item.productName || 'N/A',
                        quantity: item.quantity,
                        total: item.total.toNumber ? item.total.toNumber() : Number(item.total)
                    });
                }

                // Fetch real company info for the cancellation document
                const company = await prisma.company.findUnique({
                    where: { id: companyId },
                    select: { name: true, address: true, nuit: true }
                });
                const companyInfo = {
                    name: company?.name || 'N/A',
                    address: company?.address || '',
                    nuit: company?.nuit || ''
                };
                const reportData = {
                    orderNumber: existing.orderNumber,
                    customerName: 'Cliente Associado',
                    responsibleName: responsibleName || 'Sistema',
                    notes: notes,
                    items: itemsToReport,
                    total: totalCanceled
                };

                try {
                    cancellationDocUrl = await pdfService.generateReport(reportData, 'order_cancellation', companyInfo);
                } catch (err) {
                    logger.error('Failed to generate cancellation PDF', { orderId: id, error: err });
                }
            }

            // If the order is completed/delivered, do nothing to the stock.
            // Stock deduction and reservation release happens on Invoicing.
            // The reservation is kept until invoiced or cancelled.

            const updateData: any = {
                status: status as any,
                transitions: {
                    create: { status: status as any, responsibleName: responsibleName || 'Sistema', notes }
                }
            };

            if (cancellationDocUrl) {
                updateData.cancellationDocUrl = cancellationDocUrl;
            }

            await tx.customerOrder.update({
                where: { id },
                data: updateData
            });

            return this.getById(id, companyId);
        });
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
        const result = await prisma.customerOrder.deleteMany({
            where: { id, companyId }
        });
        if (result.count === 0) throw ApiError.notFound('Encomenda não encontrada');
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
