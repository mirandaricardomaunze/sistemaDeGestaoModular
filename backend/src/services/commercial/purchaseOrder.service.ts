import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { stockService } from '../stockService';
import { ResultHandler, Result } from '../../utils/result';
import { invalidateCommercialCache } from './shared';

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
        status: string,
        companyId: string,
        userId?: string,
        warehouseId?: string
    ): Promise<Result<any>> {
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

        const targetWarehouseId = status === 'received'
            ? await this.resolveWarehouseId(companyId, warehouseId)
            : undefined;

        // Receiving stock fans out into multiple recordMovement queries per item;
        // bumping the txn timeout from Prisma's 5s default avoids 504s on slow DBs.
        const result = await prisma.$transaction(async (tx) => {
            // Atomic guard: only update if status hasn't changed since we read it.
            const updated = await tx.purchaseOrder.updateMany({
                where: { id, companyId, status: order.status as any, deletedAt: null },
                data: {
                    status: status as any,
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
                        }, tx as any);
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
        return ResultHandler.success(result, `Estado da OC actualizado para ${status}`);
    }

    async registerPartialDelivery(
        id: string,
        deliveries: Array<{ itemId: string; receivedQty: number }>,
        companyId: string,
        userId?: string,
        warehouseId?: string
    ): Promise<Result<any>> {
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
        }, { timeout: 30000, maxWait: 10000 });

        invalidateCommercialCache(companyId);
        return ResultHandler.success(result, 'Entrega parcial registada');
    }

    async deletePurchaseOrder(id: string, companyId: string): Promise<Result<any>> {
        const order = await prisma.purchaseOrder.findFirst({ where: { id, companyId, status: 'draft', deletedAt: null } });
        if (!order) throw ApiError.badRequest('Apenas ordens em rascunho podem ser eliminadas');
        await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
        invalidateCommercialCache(companyId);
        return ResultHandler.success(true, 'Ordem de compra eliminada');
    }
}

export const commercialPurchaseOrderService = new CommercialPurchaseOrderService();
