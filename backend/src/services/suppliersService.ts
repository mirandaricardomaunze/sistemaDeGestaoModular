import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../utils/pagination';
import { auditService } from './auditService';

const SUPPLIER_FIELD_ALLOWLIST = [
    'id', 'code', 'name', 'nuit', 'phone', 'email', 'address',
    'contactPerson', 'paymentTerms', 'isActive',
    'createdAt', 'updatedAt'
] as const;

type ListQuery = {
    page?: string | number;
    limit?: string | number;
    fields?: string;
    search?: string;
    isActive?: string | boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
};

type SupplierInput = {
    name: string;
    code?: string;
    nuit?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    contactPerson?: string | null;
    paymentTerms?: string | null;
    isActive?: boolean;
    [key: string]: unknown;
};

type PurchaseOrderItemInput = {
    productId: string;
    quantity: number;
    unitCost?: number;
};

type PurchaseOrderInput = {
    items: PurchaseOrderItemInput[];
    expectedDeliveryDate?: string | Date | null;
    notes?: string | null;
};

type ReceiveItemInput = {
    itemId: string;
    receivedQty: number;
    expiryDate?: string | Date;
    batchNumber?: string;
};

export class SuppliersService {
    async list(params: ListQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const { search, isActive, sortBy = 'name', sortOrder = 'asc' } = params;

        const where: Prisma.SupplierWhereInput = { companyId };
        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { nuit: { contains: String(search) } },
                { phone: { contains: String(search) } }
            ];
        }
        if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

        const projection = parseFields(params.fields, SUPPLIER_FIELD_ALLOWLIST);
        const baseArgs = {
            where,
            orderBy: { [sortBy]: sortOrder } as Prisma.SupplierOrderByWithRelationInput,
            skip,
            take: limit
        };
        const findArgs: Prisma.SupplierFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.SupplierSelect }
            : { ...baseArgs, include: { _count: { select: { products: true, purchaseOrders: true } } } };

        const [total, suppliers] = await Promise.all([
            prisma.supplier.count({ where }),
            prisma.supplier.findMany(findArgs)
        ]);

        return createPaginatedResponse(suppliers, page, limit, total);
    }

    async getById(id: string, companyId: string) {
        const supplier = await prisma.supplier.findFirst({
            where: { id, companyId },
            include: { products: { take: 20 }, purchaseOrders: { take: 10, orderBy: { createdAt: 'desc' } } }
        });
        if (!supplier) throw ApiError.notFound('Fornecedor não encontrado');
        return supplier;
    }

    async create(data: SupplierInput, companyId: string) {
        const code = data.code || `FOR-${Date.now().toString().slice(-6)}`;
        return prisma.supplier.create({
            data: { ...data, code, companyId, phone: data.phone || '' } as Prisma.SupplierUncheckedCreateInput
        });
    }

    async update(id: string, data: Partial<SupplierInput>, companyId: string) {
        const updateData: Prisma.SupplierUncheckedUpdateInput = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== null) (updateData as Record<string, unknown>)[key] = value;
        }

        const result = await prisma.supplier.updateMany({
            where: { id, companyId },
            data: updateData
        });
        if (result.count === 0) throw ApiError.notFound('Fornecedor não encontrado');
        return prisma.supplier.findFirst({ where: { id, companyId } });
    }

    async delete(id: string, companyId: string) {
        const result = await prisma.supplier.updateMany({
            where: { id, companyId },
            data: { isActive: false }
        });
        if (result.count === 0) throw ApiError.notFound('Fornecedor não encontrado');
        return true;
    }

    async createOrder(supplierId: string, data: PurchaseOrderInput, companyId: string) {
        const { items, expectedDeliveryDate, notes } = data;
        const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
        if (!supplier) throw ApiError.notFound('Fornecedor não encontrado');

        const count = await prisma.purchaseOrder.count({ where: { supplier: { companyId } } });
        const orderNumber = `OC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const total = items.reduce((sum, item) => sum + (item.quantity * (item.unitCost || 0)), 0);

        // Fetch product weights to snapshot on purchase order items
        const poProductIds = items.map((i) => i.productId).filter(Boolean);
        const poWeightMap = new Map<string, number>();
        if (poProductIds.length > 0) {
            const prods = await prisma.product.findMany({
                where: { id: { in: poProductIds } },
                select: { id: true, weight: true }
            });
            for (const p of prods) {
                if (p.weight !== null && p.weight !== undefined) {
                    poWeightMap.set(p.id, Number(p.weight));
                }
            }
        }

        return prisma.purchaseOrder.create({
            data: {
                orderNumber, supplierId, total, companyId,
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                notes,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId, quantity: item.quantity,
                        unitCost: item.unitCost || 0, total: item.quantity * (item.unitCost || 0),
                        unitWeight: item.productId && poWeightMap.has(item.productId)
                            ? poWeightMap.get(item.productId)
                            : null
                    }))
                }
            },
            include: { items: { include: { product: true } }, supplier: true }
        });
    }

    async listOrders(supplierId: string, params: ListQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);

        const where = { supplierId, supplier: { companyId } };

        const [total, orders] = await Promise.all([
            prisma.purchaseOrder.count({ where }),
            prisma.purchaseOrder.findMany({
                where, include: { items: { include: { product: true } } },
                orderBy: { createdAt: 'desc' }, skip, take: limit
            })
        ]);

        return createPaginatedResponse(orders, page, limit, total);
    }

    async receiveOrder(orderId: string, items: ReceiveItemInput[], companyId: string, performedBy: string = 'Sistema', userId?: string, userName?: string, warehouseId?: string) {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id: orderId, supplier: { companyId } },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');

        for (const received of items) {
            const orderItem = order.items.find(i => i.id === received.itemId);
            if (orderItem) {
                // Professional Inventory: Every receipt must create a batch
                const defaultExpiry = new Date();
                defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
                
                const expiryDate = received.expiryDate ? new Date(received.expiryDate) : defaultExpiry;
                const batchNumber = received.batchNumber || `LOT-${order.orderNumber}-${orderItem.productId.slice(-4)}`;

                await prisma.$transaction(async (tx) => {
                    // 1. Update PO Item received quantity
                    await tx.purchaseOrderItem.update({
                        where: { id: received.itemId },
                        data: { receivedQty: { increment: received.receivedQty } }
                    });

                    // 2. Create the Batch (Tracks cost and expiry)
                    await tx.productBatch.create({
                        data: {
                            batchNumber,
                            productId: orderItem.productId,
                            companyId,
                            supplierId: order.supplierId,
                            initialQuantity: received.receivedQty,
                            quantity: received.receivedQty,
                            costPrice: orderItem.unitCost,
                            expiryDate,
                            receivedDate: new Date(),
                            status: 'active'
                        }
                    });

                    // 3. Update Product Global Stock
                    await tx.product.update({
                        where: { id: orderItem.productId },
                        data: { 
                            currentStock: { increment: received.receivedQty },
                            status: 'in_stock' 
                        }
                    });

                    // 4. Update Warehouse Stock (Multi-Warehouse Support)
                    if (warehouseId) {
                        await tx.warehouseStock.upsert({
                            where: {
                                warehouseId_productId: {
                                    warehouseId: warehouseId,
                                    productId: orderItem.productId
                                }
                            },
                            update: { quantity: { increment: received.receivedQty } },
                            create: {
                                productId: orderItem.productId,
                                warehouseId: warehouseId,
                                quantity: received.receivedQty
                            }
                        });
                    }

                    // 5. Log Movement
                    await tx.stockMovement.create({
                        data: {
                            productId: orderItem.productId,
                            companyId,
                            warehouseId: warehouseId || undefined,
                            movementType: 'purchase',
                            quantity: received.receivedQty,
                            balanceBefore: 0, 
                            balanceAfter: 0, 
                            reference: order.orderNumber,
                            reason: `Recebimento de OC ${order.orderNumber} (Lote: ${batchNumber})` + (warehouseId ? ` no armazém ${warehouseId}` : ''),
                            performedBy,
                            originModule: 'commercial'
                        }
                    });
                });
            }
        }

        const updatedOrder = await prisma.purchaseOrder.findFirst({
            where: { id: orderId, companyId },
            include: { items: true }
        });
        const allReceived = updatedOrder?.items.every(i => i.receivedQty >= i.quantity);

        await prisma.purchaseOrder.updateMany({
            where: { id: orderId, companyId },
            data: { 
                status: allReceived ? 'received' : 'partial', 
                receivedDate: allReceived ? new Date() : null 
            }
        });

        // 6. Audit Log
        if (userId) {
            await auditService.log({
                userId,
                userName,
                action: 'RECEIVE_ORDER',
                entity: 'purchase_orders',
                entityId: orderId,
                companyId,
                newData: {
                    orderNumber: order.orderNumber,
                    itemsReceived: items.length,
                    isFullyReceived: allReceived
                }
            });
        }

        return true;
    }

    async cancelOrder(orderId: string, companyId: string, userId?: string, userName?: string, reason?: string) {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id: orderId, companyId },
            include: { items: true, supplier: true }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');

        if (!['draft', 'ordered'].includes(order.status)) {
            throw ApiError.badRequest('Apenas encomendas em rascunho ou encomendadas podem ser canceladas');
        }

        const hasReceivedItems = order.items.some((item) => item.receivedQty > 0);
        if (hasReceivedItems) {
            throw ApiError.badRequest('Esta encomenda já tem itens recebidos. Use o fluxo de devolução/ajuste de stock.');
        }

        const updated = await prisma.purchaseOrder.update({
            where: { id: orderId },
            data: {
                status: 'cancelled',
                notes: reason ? [order.notes, `Cancelada: ${reason}`].filter(Boolean).join('\n') : order.notes
            },
            include: { items: { include: { product: true } }, supplier: true }
        });

        if (userId) {
            await auditService.log({
                userId,
                userName,
                action: 'CANCEL_ORDER',
                entity: 'purchase_orders',
                entityId: orderId,
                companyId,
                oldData: { status: order.status },
                newData: { status: 'cancelled', reason },
            });
        }

        return updated;
    }
}

export const suppliersService = new SuppliersService();
