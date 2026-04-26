import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { cacheService } from '../cacheService';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { stockService } from '../stockService';
import { ResultHandler, Result } from '../../utils/result';

export class CommercialPurchaseOrderService {

    async listPurchaseOrders(companyId: string, query: any): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const { page, limit, skip } = getPaginationParams(query);
        const { status, supplierId, search } = query;

        const where: any = { companyId, deletedAt: null };
        if (status) where.status = status;
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

    async getPurchaseOrderById(id: string, companyId: string): Promise<Result<any>> {
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

    async updatePurchaseOrderStatus(id: string, status: string, companyId: string, userId?: string): Promise<Result<any>> {
        const validTransitions: Record<string, string[]> = {
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

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.purchaseOrder.update({
                where: { id },
                data: {
                    status: status as any,
                    ...(status === 'received' ? { receivedDate: new Date() } : {}),
                },
                include: {
                    supplier: { select: { id: true, name: true } },
                    items: { include: { product: { select: { id: true, name: true } } } }
                }
            });

            if (status === 'received' && order.status !== 'received') {
                for (const item of order.items) {
                    const qtyToAdd = item.quantity - item.receivedQty;
                    if (qtyToAdd > 0) {
                        await stockService.recordMovement({
                            productId: item.productId,
                            companyId,
                            quantity: qtyToAdd,
                            movementType: 'purchase',
                            originModule: 'COMMERCIAL',
                            referenceType: 'PURCHASE',
                            referenceContent: order.orderNumber,
                            reason: `Receção de OC ${order.orderNumber}`,
                            performedBy: userId || companyId,
                        }, tx as any);
                        await tx.product.update({ where: { id: item.productId }, data: { costPrice: item.unitCost } });
                        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.quantity } });
                    }
                }
            }

            return updated;
        });

        cacheService.invalidatePattern(`commercial:analytics:${companyId}`);
        return ResultHandler.success(result, `Estado da OC actualizado para ${status}`);
    }

    async registerPartialDelivery(id: string, deliveries: Array<{ itemId: string; receivedQty: number }>, companyId: string, userId?: string): Promise<Result<any>> {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId, deletedAt: null, status: { in: ['ordered', 'partial'] } },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada ou já concluída');

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
                        quantity: addedQty,
                        movementType: 'purchase',
                        originModule: 'COMMERCIAL',
                        referenceType: 'PURCHASE',
                        referenceContent: order.orderNumber,
                        reason: `Entrega parcial de OC ${order.orderNumber}`,
                        performedBy: userId || companyId,
                    }, tx as any);
                }

                if (newReceived < item.quantity) allReceived = false;
            }

            const newStatus = allReceived ? 'received' : 'partial';
            return tx.purchaseOrder.update({
                where: { id },
                data: { status: newStatus as any, ...(newStatus === 'received' ? { receivedDate: new Date() } : {}) },
                include: {
                    supplier: { select: { id: true, name: true } },
                    items: { include: { product: { select: { id: true, name: true } } } }
                }
            });
        });

        cacheService.invalidatePattern(`commercial:analytics:${companyId}`);
        return ResultHandler.success(result, 'Entrega parcial registada');
    }

    async deletePurchaseOrder(id: string, companyId: string): Promise<Result<any>> {
        const order = await prisma.purchaseOrder.findFirst({ where: { id, companyId, status: 'draft', deletedAt: null } });
        if (!order) throw ApiError.badRequest('Apenas ordens em rascunho podem ser eliminadas');
        await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
        return ResultHandler.success(true, 'Ordem de compra eliminada');
    }

    async validateSupplierProducts(supplierId: string, productIds: string[], companyId: string): Promise<void> {
        if (!productIds.length) return;
        const mismatched = await prisma.product.findMany({
            where: { id: { in: productIds }, companyId, supplierId: { not: supplierId } },
            select: { name: true }
        });
        if (mismatched.length > 0) {
            throw ApiError.badRequest(`Os seguintes produtos não pertencem a este fornecedor: ${mismatched.map(p => p.name).join(', ')}`);
        }
    }
}

export const commercialPurchaseOrderService = new CommercialPurchaseOrderService();
