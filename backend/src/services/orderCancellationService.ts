import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { pdfService } from './pdfService';
import { stockService } from './stockService';
import type { DecideOrderCancellationInput, RequestOrderCancellationInput } from '../validation/orders';

type Actor = {
    userId?: string;
    userName?: string;
};

type OrderWithItems = Prisma.CustomerOrderGetPayload<{ include: { items: true } }>;
type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true } }>;
type CancellationRequest = Prisma.OrderCancellationRequestGetPayload<Record<string, never>>;

// Prisma transaction client type (the parameter passed to a $transaction callback)
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type CancellationContext = {
    order: OrderWithItems;
    invoice: InvoiceWithItems | null;
};

type ListParams = {
    status?: string;
    orderId?: string;
    limit?: string | number;
};

class OrderCancellationPolicy {
    ensureCanRequest(order: OrderWithItems, hasPendingRequest: boolean) {
        if (order.status === 'cancelled') {
            throw ApiError.badRequest('Esta encomenda ja esta cancelada.');
        }

        if (order.status === 'cancellation_requested') {
            throw ApiError.badRequest('Esta encomenda ja tem um pedido de cancelamento pendente.');
        }

        if (hasPendingRequest) {
            throw ApiError.badRequest('Ja existe um pedido de cancelamento pendente para esta encomenda.');
        }
    }

    assess(order: OrderWithItems, invoice: InvoiceWithItems | null) {
        const orderTotal = Number(order.total || 0);
        const hasInvoice = Boolean(invoice);
        const hasPayment = Number(invoice?.amountPaid || 0) > 0;

        const riskLevel = hasInvoice || hasPayment || orderTotal >= 10000 || order.status === 'completed'
            ? 'high'
            : order.status === 'separated'
                ? 'medium'
                : 'standard';

        return {
            riskLevel,
            requiresCreditNote: hasInvoice,
            invoiceId: invoice?.id ?? null,
        };
    }

    ensurePending(request: CancellationRequest) {
        if (request.status !== 'pending') {
            throw ApiError.badRequest('Este pedido de cancelamento ja foi decidido.');
        }
    }
}

export class OrderCancellationService {
    private readonly policy = new OrderCancellationPolicy();

    async list(params: ListParams, companyId: string) {
        const where: Prisma.OrderCancellationRequestWhereInput = { companyId };
        if (params.status && params.status !== 'all') where.status = params.status as Prisma.OrderCancellationRequestWhereInput['status'];
        if (params.orderId) where.orderId = params.orderId;

        return prisma.orderCancellationRequest.findMany({
            where,
            include: {
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        customerName: true,
                        status: true,
                        total: true,
                    }
                }
            },
            orderBy: { requestedAt: 'desc' },
            take: Math.min(Number(params.limit || 100), 200),
        });
    }

    async request(orderId: string, data: RequestOrderCancellationInput, companyId: string, actor: Actor) {
        const { order, invoice } = await this.getContext(orderId, companyId);
        const pending = await prisma.orderCancellationRequest.findFirst({
            where: { orderId, companyId, status: 'pending' }
        });

        this.policy.ensureCanRequest(order, Boolean(pending));
        const assessment = this.policy.assess(order, invoice);

        return prisma.$transaction(async (tx) => {
            const request = await tx.orderCancellationRequest.create({
                data: {
                    orderId,
                    originalStatus: order.status,
                    reason: data.reason,
                    riskLevel: assessment.riskLevel,
                    requiresCreditNote: assessment.requiresCreditNote,
                    invoiceId: assessment.invoiceId,
                    requestedByUserId: actor.userId,
                    requestedByName: actor.userName || 'Sistema',
                    companyId,
                },
            });

            await tx.customerOrder.update({
                where: { id: orderId },
                data: {
                    status: 'cancellation_requested',
                    transitions: {
                        create: {
                            status: 'cancellation_requested',
                            responsibleName: actor.userName || 'Sistema',
                            notes: data.notes || data.reason,
                        }
                    }
                }
            });

            return request;
        });
    }

    async approve(requestId: string, data: DecideOrderCancellationInput, companyId: string, actor: Actor) {
        const request = await prisma.orderCancellationRequest.findFirst({
            where: { id: requestId, companyId },
            include: { order: { include: { items: true } } }
        });
        if (!request) throw ApiError.notFound('Pedido de cancelamento nao encontrado.');

        this.policy.ensurePending(request);

        const invoice = await prisma.invoice.findFirst({
            where: { orderId: request.orderId, companyId },
            include: { items: true }
        });

        const result = await prisma.$transaction(async (tx) => {
            let creditNote: Awaited<ReturnType<typeof this.createCreditNoteFromInvoice>> | null = null;

            if (invoice) {
                creditNote = await this.createCreditNoteFromInvoice(tx, invoice, request.reason, data.notes, companyId);
                await this.restoreInvoicedStock(tx, invoice, request.order.orderNumber, actor.userName || 'Sistema', companyId);
                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: { status: 'cancelled', amountDue: 0 }
                });
            } else {
                await this.releaseReservedStock(tx, request.order, companyId);
            }

            await tx.orderCancellationRequest.update({
                where: { id: requestId },
                data: {
                    status: 'approved',
                    creditNoteId: creditNote?.id ?? null,
                    decidedByUserId: actor.userId,
                    decidedByName: actor.userName || 'Sistema',
                    decisionNotes: data.notes || null,
                    decidedAt: new Date(),
                }
            });

            await tx.customerOrder.update({
                where: { id: request.orderId },
                data: {
                    status: 'cancelled',
                    transitions: {
                        create: [
                            {
                                status: 'cancellation_requested',
                                responsibleName: request.requestedByName || 'Sistema',
                                notes: request.reason,
                            },
                            {
                                status: 'cancelled',
                                responsibleName: actor.userName || 'Sistema',
                                notes: data.notes || request.reason,
                            }
                        ]
                    }
                }
            });

            return { creditNote };
        });

        await this.tryGenerateCancellationDocument(request.orderId, companyId, actor.userName || 'Sistema', data.notes || request.reason);

        return this.getResult(request.orderId, companyId, result.creditNote?.id);
    }

    async reject(requestId: string, data: DecideOrderCancellationInput, companyId: string, actor: Actor) {
        const request = await prisma.orderCancellationRequest.findFirst({
            where: { id: requestId, companyId }
        });
        if (!request) throw ApiError.notFound('Pedido de cancelamento nao encontrado.');

        this.policy.ensurePending(request);

        await prisma.$transaction(async (tx) => {
            await tx.orderCancellationRequest.update({
                where: { id: requestId },
                data: {
                    status: 'rejected',
                    decidedByUserId: actor.userId,
                    decidedByName: actor.userName || 'Sistema',
                    decisionNotes: data.notes || null,
                    decidedAt: new Date(),
                }
            });

            await tx.customerOrder.update({
                where: { id: request.orderId },
                data: {
                    status: request.originalStatus,
                    transitions: {
                        create: {
                            status: 'cancellation_rejected',
                            responsibleName: actor.userName || 'Sistema',
                            notes: data.notes || 'Pedido de cancelamento rejeitado.',
                        }
                    }
                }
            });
        });

        return this.getResult(request.orderId, companyId);
    }

    private async getContext(orderId: string, companyId: string): Promise<CancellationContext> {
        const order = await prisma.customerOrder.findFirst({
            where: { id: orderId, companyId },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Encomenda nao encontrada.');

        const invoice = await prisma.invoice.findFirst({
            where: { orderId, companyId },
            include: { items: true }
        });

        return { order, invoice };
    }

    private async createCreditNoteFromInvoice(tx: TxClient, invoice: InvoiceWithItems & { orderNumber?: string | null }, reason: string, notes: string | null | undefined, companyId: string) {
        const count = await tx.creditNote.count({ where: { companyId } });
        const number = `NC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        return tx.creditNote.create({
            data: {
                number,
                originalInvoiceId: invoice.id,
                customerId: invoice.customerId,
                customerName: invoice.customerName,
                subtotal: invoice.subtotal,
                tax: invoice.tax,
                total: invoice.total,
                reason,
                notes: notes || `Cancelamento da encomenda ${invoice.orderNumber || invoice.orderId}`,
                status: 'issued',
                companyId,
                items: {
                    create: invoice.items.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.total,
                        originalInvoiceItemId: item.id,
                    }))
                }
            },
            include: { items: true, originalInvoice: true }
        });
    }

    private async restoreInvoicedStock(tx: TxClient, invoice: InvoiceWithItems, orderNumber: string, performedBy: string, companyId: string) {
        for (const item of invoice.items) {
            if (!item.productId) continue;
            await stockService.recordMovement({
                productId: item.productId,
                quantity: item.quantity,
                movementType: 'return_in',
                originModule: 'COMMERCIAL',
                referenceType: 'RETURN',
                referenceContent: invoice.invoiceNumber,
                reason: `Reposicao por cancelamento da encomenda ${orderNumber}`,
                performedBy,
                companyId,
            }, tx);
        }
    }

    private async releaseReservedStock(tx: TxClient, order: OrderWithItems, companyId: string) {
        for (const item of order.items) {
            if (!item.productId) continue;
            await stockService.releaseReservation(item.productId, item.quantity, companyId, tx);
        }
    }

    private async tryGenerateCancellationDocument(orderId: string, companyId: string, responsibleName: string, notes: string) {
        try {
            const order = await prisma.customerOrder.findFirst({
                where: { id: orderId, companyId },
                include: { items: true }
            });
            if (!order) return;

            const company = await prisma.company.findUnique({
                where: { id: companyId },
                select: { name: true, address: true, nuit: true }
            });

            const cancellationDocUrl = await pdfService.generateReport({
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                responsibleName,
                notes,
                items: order.items.map((item) => ({
                    productName: item.productName || 'N/A',
                    quantity: item.quantity,
                    total: Number(item.total)
                })),
                total: Number(order.total)
            }, 'order_cancellation', {
                name: company?.name || 'N/A',
                address: company?.address || '',
                nuit: company?.nuit || ''
            });

            await prisma.customerOrder.update({
                where: { id: orderId },
                data: { cancellationDocUrl }
            });
        } catch (error) {
            logger.error('Failed to generate order cancellation document', { orderId, error });
        }
    }

    private async getResult(orderId: string, companyId: string, creditNoteId?: string) {
        const [order, cancellationRequests, creditNote] = await Promise.all([
            prisma.customerOrder.findFirst({
                where: { id: orderId, companyId },
                include: { items: true, transitions: { orderBy: { timestamp: 'asc' } } }
            }),
            prisma.orderCancellationRequest.findMany({
                where: { orderId, companyId },
                orderBy: { requestedAt: 'desc' }
            }),
            creditNoteId
                ? prisma.creditNote.findFirst({ where: { id: creditNoteId, companyId }, include: { items: true, originalInvoice: true } })
                : Promise.resolve(null),
        ]);

        return { order, cancellationRequests, creditNote };
    }
}

export const orderCancellationService = new OrderCancellationService();
