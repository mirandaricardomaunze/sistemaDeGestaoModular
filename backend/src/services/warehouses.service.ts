import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { stockService } from './StockService';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

export class WarehousesService {
    async getWarehouses(companyId: string) {
        return prisma.warehouse.findMany({
            where: { isActive: true, companyId },
            include: { _count: { select: { stocks: true } } },
            orderBy: { name: 'asc' }
        });
    }

    async getWarehouseById(companyId: string, id: string) {
        const warehouse = await prisma.warehouse.findFirst({
            where: { id, companyId },
            include: {
                stocks: {
                    include: { product: { select: { id: true, name: true, code: true, unit: true } } }
                }
            }
        });
        if (!warehouse) throw ApiError.notFound('Armazém não encontrado');
        return warehouse;
    }

    async createWarehouse(companyId: string, data: any) {
        const code = data.code || `WH-${Date.now().toString().slice(-6)}`;
        return prisma.warehouse.create({
            data: { ...data, code, companyId }
        });
    }

    async updateWarehouse(companyId: string, id: string, data: any) {
        const result = await prisma.warehouse.updateMany({
            where: { id, companyId },
            data
        });
        if (result.count === 0) throw ApiError.notFound('Armazém não encontrado');
        return prisma.warehouse.findFirst({ where: { id, companyId } });
    }

    async deleteWarehouse(companyId: string, id: string) {
        const stocks = await prisma.warehouseStock.findMany({
            where: { warehouseId: id, quantity: { gt: 0 }, warehouse: { companyId } }
        });
        if (stocks.length > 0) throw ApiError.badRequest('Não é possível remover armazém com stock. Transfira primeiro.');

        const result = await prisma.warehouse.updateMany({
            where: { id, companyId },
            data: { isActive: false }
        });
        if (result.count === 0) throw ApiError.notFound('Armazém não encontrado');
        return { id };
    }

    async getAllTransfers(companyId: string, query: any) {
        const { page, limit, skip } = getPaginationParams(query);
        const { status, startDate, endDate } = query;
        const where: any = { companyId };
        if (status) where.status = status;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(String(startDate));
            if (endDate) where.date.lte = new Date(String(endDate));
        }

        const [total, transfers] = await Promise.all([
            prisma.stockTransfer.count({ where }),
            prisma.stockTransfer.findMany({
                where,
                include: {
                    sourceWarehouse: { select: { id: true, name: true, code: true } },
                    targetWarehouse: { select: { id: true, name: true, code: true } },
                    items: { include: { product: { select: { id: true, name: true, code: true, barcode: true, description: true, unit: true } } } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        return createPaginatedResponse(transfers, page, limit, total);
    }

    async createTransfer(companyId: string, data: any, userName: string) {
        const { sourceWarehouseId, targetWarehouseId, items, responsible, reason } = data;
        if (sourceWarehouseId === targetWarehouseId) throw ApiError.badRequest('Origem e destino não podem ser iguais');

        return prisma.$transaction(async (tx) => {
            for (const item of items) {
                // Ensure the global stock is not reserved for an order
                await stockService.validateAvailability(item.productId, item.quantity, companyId, tx);

                // Ensure the specific warehouse has enough stock
                const stock = await tx.warehouseStock.findFirst({
                    where: { warehouseId: sourceWarehouseId, productId: item.productId, warehouse: { companyId } }
                });
                if (!stock || stock.quantity < item.quantity) {
                    throw ApiError.badRequest(`Stock insuficiente no armazém de origem para o produto "${item.productName || item.productId}"`);
                }
            }

            const targetWH = await tx.warehouse.findFirst({ where: { id: targetWarehouseId, companyId } });
            if (!targetWH) throw ApiError.notFound('Armazém de destino não encontrado');

            const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
            const count = await tx.stockTransfer.count({ where: { companyId, number: { startsWith: `GT-${dateStr}` } } });

            // Gerar número único atrelado a data: GT-YYMMDD-0001
            const number = `GT-${dateStr}-${String(count + 1).padStart(4, '0')}`;

            const transfer = await tx.stockTransfer.create({
                data: {
                    number, sourceWarehouseId, targetWarehouseId, responsible, reason, status: 'in_transit', companyId,
                    items: { create: items.map((item: any) => ({ productId: item.productId, quantity: item.quantity })) }
                },
                include: { sourceWarehouse: true, targetWarehouse: true }
            });

            // Na criação, apenas retiramos do armazém de origem
            for (const item of items) {
                await stockService.recordMovement({
                    productId: item.productId, warehouseId: sourceWarehouseId, quantity: -item.quantity,
                    movementType: 'transfer', originModule: 'LOGISTICS', referenceType: 'transfer',
                    referenceContent: number, reason: `Transferência expedida para ${targetWH.name}`,
                    performedBy: userName || responsible, companyId
                }, tx);
            }

            return transfer;
        });
    }

    async completeTransfer(companyId: string, id: string, userName: string) {
        return prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });

            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status === 'completed') throw ApiError.badRequest('Transferência já foi completada');
            if (transfer.status === 'cancelled') throw ApiError.badRequest('Transferência foi cancelada');

            // Actualizar status da transferência
            const updatedTransfer = await tx.stockTransfer.update({
                where: { id },
                data: { status: 'completed' }
            });

            // Dar entrada no armazém de destino
            for (const item of transfer.items) {
                await stockService.recordMovement({
                    productId: item.productId, warehouseId: transfer.targetWarehouseId, quantity: item.quantity,
                    movementType: 'transfer', originModule: 'LOGISTICS', referenceType: 'transfer',
                    referenceContent: transfer.number, reason: `Recepção de transferência de ${transfer.sourceWarehouse.name}`,
                    performedBy: userName, companyId
                }, tx);
            }

            return updatedTransfer;
        });
    }

    async cancelTransfer(companyId: string, id: string, userName: string) {
        return prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });

            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status === 'completed') throw ApiError.badRequest('Não é possível cancelar uma transferência já completada');
            if (transfer.status === 'cancelled') throw ApiError.badRequest('Transferência já foi cancelada');

            // Actualizar status para cancelado
            const updatedTransfer = await tx.stockTransfer.update({
                where: { id },
                data: { status: 'cancelled' }
            });

            // Restaurar stock ao armazém de origem (estornar a saída)
            for (const item of transfer.items) {
                await stockService.recordMovement({
                    productId: item.productId, warehouseId: transfer.sourceWarehouseId, quantity: item.quantity,
                    movementType: 'adjustment', originModule: 'LOGISTICS', referenceType: 'transfer',
                    referenceContent: transfer.number, reason: `Cancelamento de transferência GT ${transfer.number} — stock reposto`,
                    performedBy: userName, companyId
                }, tx);
            }

            return updatedTransfer;
        });
    }
}

export const warehousesService = new WarehousesService();
