import { TransferStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { stockService } from './stockService';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { logger } from '../utils/logger';

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
                    items: { include: { product: { select: { id: true, name: true, code: true, barcode: true, description: true, unit: true, weight: true } } } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        return createPaginatedResponse(transfers, page, limit, total);
    }

    /**
     * Create a transfer in `draft` status.
     * No stock is touched; the operator can edit until they `submit`.
     */
    async createTransfer(companyId: string, data: any, userId: string, userName: string) {
        logger.info('Creating stock transfer:', { companyId, userId, userName, data });
        const { sourceWarehouseId, targetWarehouseId, items, responsible, reason, notes } = data;
        
        if (!sourceWarehouseId || !targetWarehouseId) {
            logger.warn('Missing warehouse IDs:', { sourceWarehouseId, targetWarehouseId });
            throw ApiError.badRequest('Armazém de origem e destino são obrigatórios');
        }
        if (sourceWarehouseId === targetWarehouseId) throw ApiError.badRequest('Origem e destino não podem ser iguais');
        if (!Array.isArray(items) || items.length === 0) throw ApiError.badRequest('Adicione pelo menos um produto');

        try {
            return await prisma.$transaction(async (tx) => {
                const targetWH = await tx.warehouse.findFirst({ where: { id: targetWarehouseId, companyId } });
                if (!targetWH) {
                    logger.warn('Target warehouse not found:', { targetWarehouseId, companyId });
                    throw ApiError.notFound('Armazém de destino não encontrado');
                }
                const sourceWH = await tx.warehouse.findFirst({ where: { id: sourceWarehouseId, companyId } });
                if (!sourceWH) {
                    logger.warn('Source warehouse not found:', { sourceWarehouseId, companyId });
                    throw ApiError.notFound('Armazém de origem não encontrado');
                }

                const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
                const count = await tx.stockTransfer.count({ where: { companyId, number: { startsWith: `GT-${dateStr}` } } });
                const number = `GT-${dateStr}-${String(count + 1).padStart(4, '0')}`;

                logger.info('Generating transfer number:', { number });

                return (tx as any).stockTransfer.create({
                    data: {
                        number, sourceWarehouseId, targetWarehouseId, responsible, reason, notes, companyId,
                        status: (TransferStatus as any).draft || 'draft',
                        requestedBy: userId,
                        requestedAt: new Date(),
                        items: { create: items.map((item: any) => ({ productId: item.productId, quantity: item.quantity })) }
                    },
                    include: { sourceWarehouse: true, targetWarehouse: true, items: true }
                });
            });
        } catch (error) {
            logger.error('Error in createTransfer transaction:', error);
            throw error;
        }
    }

    /**
     * Submit a draft for manager approval. No stock impact.
     */
    async submitTransfer(companyId: string, id: string, userId: string) {
        return prisma.$transaction(async (tx: any) => {
            const transfer = await tx.stockTransfer.findFirst({ where: { id, companyId }, include: { items: true } });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== ((TransferStatus as any).draft || 'draft')) throw ApiError.badRequest('Apenas rascunhos podem ser submetidos');
            if (transfer.items.length === 0) throw ApiError.badRequest('Transferência sem itens');

            return tx.stockTransfer.update({
                where: { id },
                data: { status: (TransferStatus as any).pending || 'pending', requestedBy: userId, requestedAt: new Date() }
            });
        });
    }

    /**
     * Manager approves a pending transfer and the source warehouse RESERVES the stock.
     * Reserved stock cannot be sold or transferred elsewhere until dispatch/cancel.
     * Self-approval (same user as requester) is blocked.
     */
    async approveTransfer(companyId: string, id: string, approverId: string) {
        return prisma.$transaction(async (tx: any) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== ((TransferStatus as any).pending || 'pending')) throw ApiError.badRequest('Apenas transferências pendentes podem ser aprovadas');
            if (transfer.requestedBy && transfer.requestedBy === approverId) {
                throw ApiError.forbidden('O aprovador deve ser diferente de quem solicitou a transferência');
            }

            // Verify and reserve stock at source for every item.
            for (const item of transfer.items) {
                const stock = await tx.warehouseStock.findFirst({
                    where: { warehouseId: transfer.sourceWarehouseId, productId: item.productId, warehouse: { companyId } }
                });
                const available = (stock?.quantity ?? 0) - ((stock as any)?.reservedQuantity ?? 0);
                if (!stock || available < item.quantity) {
                    throw ApiError.badRequest(
                        `Stock disponível insuficiente para produto ${item.productId} no armazém origem (disponível: ${available}, pedido: ${item.quantity})`
                    );
                }
                await tx.warehouseStock.update({
                    where: { id: stock.id },
                    data: { reservedQuantity: { increment: item.quantity } }
                });
            }

            return tx.stockTransfer.update({
                where: { id },
                data: { status: (TransferStatus as any).approved || 'approved', approvedBy: approverId, approvedAt: new Date() }
            });
        });
    }

    /**
     * Manager rejects a pending transfer. No stock impact.
     */
    async rejectTransfer(companyId: string, id: string, approverId: string, reason: string) {
        const trimmed = (reason || '').trim();
        if (trimmed.length < 5) throw ApiError.badRequest('Motivo da rejeição deve ter pelo menos 5 caracteres');
        return prisma.$transaction(async (tx: any) => {
            const transfer = await tx.stockTransfer.findFirst({ where: { id, companyId } });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== ((TransferStatus as any).pending || 'pending')) throw ApiError.badRequest('Apenas transferências pendentes podem ser rejeitadas');
            if (transfer.requestedBy && transfer.requestedBy === approverId) {
                throw ApiError.forbidden('O aprovador deve ser diferente de quem solicitou a transferência');
            }
            return tx.stockTransfer.update({
                where: { id },
                data: { status: (TransferStatus as any).rejected || 'rejected', rejectedBy: approverId, rejectedAt: new Date(), rejectReason: trimmed }
            });
        });
    }

    /**
     * Mark approved transfer as physically dispatched.
     * Releases reservation and deducts stock from source warehouse.
     */
    async dispatchTransfer(companyId: string, id: string, userId: string, userName: string) {
        return prisma.$transaction(async (tx: any) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== ((TransferStatus as any).approved || 'approved')) throw ApiError.badRequest('Apenas transferências aprovadas podem ser despachadas');

            for (const item of transfer.items) {
                const stock = await tx.warehouseStock.findFirst({
                    where: { warehouseId: transfer.sourceWarehouseId, productId: item.productId, warehouse: { companyId } }
                });
                if (!stock || (stock as any).reservedQuantity < item.quantity) {
                    throw ApiError.conflict(`Reserva inconsistente para produto ${item.productId}`);
                }
                await tx.warehouseStock.update({
                    where: { id: stock.id },
                    data: { reservedQuantity: { decrement: item.quantity } }
                });
                await stockService.recordMovement({
                    productId: item.productId, warehouseId: transfer.sourceWarehouseId, quantity: -item.quantity,
                    movementType: 'transfer', originModule: 'LOGISTICS', referenceType: 'transfer',
                    referenceContent: transfer.number,
                    reason: `Transferência ${transfer.number} expedida para ${transfer.targetWarehouse.name}`,
                    performedBy: userName || transfer.responsible, companyId
                }, tx);
            }

            return tx.stockTransfer.update({
                where: { id },
                data: { status: (TransferStatus as any).in_transit || 'in_transit', dispatchedBy: userId, dispatchedAt: new Date() }
            });
        });
    }

    /**
     * Confirm receipt at destination -- adds stock there.
     * `receivedItems` is optional: pass [{itemId, receivedQuantity}] for partial receipts.
     * If omitted, receives the full ordered quantity for every item.
     */
    async receiveTransfer(companyId: string, id: string, userId: string, userName: string, receivedItems?: Array<{ itemId: string; receivedQuantity: number }>) {
        return prisma.$transaction(async (tx: any) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== ((TransferStatus as any).in_transit || 'in_transit')) {
                throw ApiError.badRequest('Apenas transferências em trânsito podem ser recebidas');
            }

            const receivedMap = new Map<string, number>();
            if (receivedItems && receivedItems.length > 0) {
                for (const r of receivedItems) receivedMap.set(r.itemId, r.receivedQuantity);
            }

            for (const item of transfer.items) {
                const received = receivedMap.has(item.id) ? Math.max(0, receivedMap.get(item.id)!) : item.quantity;
                if (received > item.quantity) {
                    throw ApiError.badRequest(`Quantidade recebida (${received}) excede a expedida (${item.quantity}) para item ${item.id}`);
                }
                await tx.stockTransferItem.update({
                    where: { id: item.id },
                    data: { receivedQuantity: received }
                });
                if (received > 0) {
                    await stockService.recordMovement({
                        productId: item.productId, warehouseId: transfer.targetWarehouseId, quantity: received,
                        movementType: 'transfer', originModule: 'LOGISTICS', referenceType: 'transfer',
                        referenceContent: transfer.number,
                        reason: `Recepção de transferência ${transfer.number} de ${transfer.sourceWarehouse.name}`,
                        performedBy: userName, companyId
                    }, tx);
                }
                // Any shortfall (received < dispatched) stays as a discrepancy --
                // the source warehouse already lost the stock. A separate
                // adjustment workflow can handle write-off / claim.
            }

            return tx.stockTransfer.update({
                where: { id },
                data: { status: (TransferStatus as any).received || 'received', receivedBy: userId, receivedAt: new Date() }
            });
        });
    }

    /**
     * Cancel a transfer.
     * - draft / pending: no stock impact
     * - approved: release reservation
     * - in_transit: restore stock to source (was already deducted)
     * Terminal states (received, rejected, cancelled) cannot be cancelled.
     */
    async cancelTransfer(companyId: string, id: string, userId: string, userName: string) {
        return prisma.$transaction(async (tx: any) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            const terminalStates = [(TransferStatus as any).received, (TransferStatus as any).completed, (TransferStatus as any).rejected, (TransferStatus as any).cancelled];
            if (terminalStates.includes(transfer.status)) {
                throw ApiError.badRequest(`Transferência em estado "${transfer.status}" não pode ser cancelada`);
            }

            if (transfer.status === ((TransferStatus as any).approved || 'approved')) {
                for (const item of transfer.items) {
                    const stock = await tx.warehouseStock.findFirst({
                        where: { warehouseId: transfer.sourceWarehouseId, productId: item.productId, warehouse: { companyId } }
                    });
                    if (stock && (stock as any).reservedQuantity >= item.quantity) {
                        await tx.warehouseStock.update({
                            where: { id: stock.id },
                            data: { reservedQuantity: { decrement: item.quantity } }
                        });
                    }
                }
            }

            if (transfer.status === ((TransferStatus as any).in_transit || 'in_transit')) {
                for (const item of transfer.items) {
                    await stockService.recordMovement({
                        productId: item.productId, warehouseId: transfer.sourceWarehouseId, quantity: item.quantity,
                        movementType: 'adjustment', originModule: 'LOGISTICS', referenceType: 'transfer',
                        referenceContent: transfer.number,
                        reason: `Cancelamento de transferência ${transfer.number} -- stock reposto na origem`,
                        performedBy: userName, companyId
                    }, tx);
                }
            }

            return tx.stockTransfer.update({
                where: { id },
                data: { status: (TransferStatus as any).cancelled || 'cancelled', cancelledBy: userId, cancelledAt: new Date() }
            });
        });
    }

    /**
     * Manager inbox -- pending approvals.
     */
    async listPendingApprovals(companyId: string) {
        return prisma.stockTransfer.findMany({
            where: { companyId, status: (TransferStatus as any).pending || 'pending' },
            include: {
                sourceWarehouse: { select: { id: true, name: true, code: true } },
                targetWarehouse: { select: { id: true, name: true, code: true } },
                items: { include: { product: { select: { id: true, name: true, code: true, unit: true } } } }
            },
            orderBy: { requestedAt: (undefined as any) }
        });
    }

    /** @deprecated Renamed to receiveTransfer. Old POST /:id/complete is now an alias. */
    async completeTransfer(companyId: string, id: string, userId: string, userName: string) {
        return this.receiveTransfer(companyId, id, userId, userName);
    }
}

export const warehousesService = new WarehousesService();
