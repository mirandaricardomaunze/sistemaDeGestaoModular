import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

export class SuppliersService {
    async list(params: any, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const { search, isActive, sortBy = 'name', sortOrder = 'asc' } = params;

        const where: any = { companyId };
        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { nuit: { contains: String(search) } },
                { phone: { contains: String(search) } }
            ];
        }
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const [total, suppliers] = await Promise.all([
            prisma.supplier.count({ where }),
            prisma.supplier.findMany({
                where,
                include: { _count: { select: { products: true, purchaseOrders: true } } },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limit
            })
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

    async create(data: any, companyId: string) {
        const code = data.code || `FOR-${Date.now().toString().slice(-6)}`;
        return prisma.supplier.create({
            data: { ...data, code, companyId, phone: data.phone || '' } as any
        });
    }

    async update(id: string, data: any, companyId: string) {
        const updateData: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== null) updateData[key] = value;
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

    async createOrder(supplierId: string, data: any, companyId: string) {
        const { items, expectedDeliveryDate, notes } = data;
        const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
        if (!supplier) throw ApiError.notFound('Fornecedor não encontrado');

        const count = await prisma.purchaseOrder.count({ where: { supplier: { companyId } } });
        const orderNumber = `OC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const total = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.unitCost || 0)), 0);

        return prisma.purchaseOrder.create({
            data: {
                orderNumber, supplierId, total, companyId,
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                notes,
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId, quantity: item.quantity,
                        unitCost: item.unitCost || 0, total: item.quantity * (item.unitCost || 0)
                    }))
                }
            },
            include: { items: { include: { product: true } }, supplier: true }
        });
    }

    async listOrders(supplierId: string, params: any, companyId: string) {
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

    async receiveOrder(orderId: string, items: any[], companyId: string, performedBy: string = 'Sistema', userId?: string, userName?: string, warehouseId?: string) {
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
            const { auditService } = require('./auditService');
            await auditService.log({
                userId,
                userName,
                action: 'RECEIVE_ORDER',
                entity: 'purchase_orders',
                entityId: orderId,
                companyId,
                details: {
                    orderNumber: order.orderNumber,
                    itemsReceived: items.length,
                    isFullyReceived: allReceived
                }
            });
        }

        return true;
    }
}

export const suppliersService = new SuppliersService();
