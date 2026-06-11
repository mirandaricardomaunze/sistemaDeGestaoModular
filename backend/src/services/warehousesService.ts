import { Prisma, TransferStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { stockService, type StockTransactionClient } from './stockService';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { logger } from '../utils/logger';
import { emitToModule } from '../lib/socket';

type WarehouseCreateInput = {
    name: string;
    code?: string;
    address?: string;
    type?: string;
    isActive?: boolean;
};

type WarehouseUpdateInput = Partial<WarehouseCreateInput>;

type TransferItemInput = {
    productId: string;
    quantity: number;
};

type CreateTransferInput = {
    sourceWarehouseId: string;
    targetWarehouseId: string;
    items: TransferItemInput[];
    responsible: string;
    reason?: string;
    notes?: string;
};

type TransferListQuery = {
    page?: string | number;
    limit?: string | number;
    status?: TransferStatus | string;
    startDate?: string;
    endDate?: string;
};

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

    async createWarehouse(companyId: string, data: WarehouseCreateInput) {
        const code = data.code || `WH-${Date.now().toString().slice(-6)}`;
        return prisma.warehouse.create({
            data: { ...data, code, companyId }
        });
    }

    async updateWarehouse(companyId: string, id: string, data: WarehouseUpdateInput) {
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

    async getAllTransfers(companyId: string, query: TransferListQuery) {
        const { page, limit, skip } = getPaginationParams(query);
        const { status, startDate, endDate } = query;
        const where: Prisma.StockTransferWhereInput = { companyId };
        if (status) where.status = status as TransferStatus;
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
                    items: { include: { product: { select: { id: true, name: true, code: true, barcode: true, sku: true, description: true, unit: true, weight: true, price: true, costPrice: true } } } }
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
    async createTransfer(companyId: string, data: CreateTransferInput, userId: string, userName: string) {
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

                return tx.stockTransfer.create({
                    data: {
                        number, sourceWarehouseId, targetWarehouseId, responsible, reason, notes, companyId,
                        status: TransferStatus.draft,
                        requestedBy: userId,
                        requestedAt: new Date(),
                        items: { create: items.map((item) => ({ productId: item.productId, quantity: item.quantity })) }
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
     * Submit a draft. ALL transfers require manager approval (4-eyes).
     * Creates an ApprovalRequest so the decision is visible in the central
     * approvals history.
     */
    async submitTransfer(companyId: string, id: string, userId: string, userName?: string) {
        const result = await prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: {
                    items: true,
                    sourceWarehouse: { select: { name: true } },
                    targetWarehouse: { select: { name: true } },
                }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== TransferStatus.draft) throw ApiError.badRequest('Apenas rascunhos podem ser submetidos');
            if (transfer.items.length === 0) throw ApiError.badRequest('Transferência sem itens');

            const totalUnits = transfer.items.reduce((sum, i) => sum + Number(i.quantity), 0);

            const updated = await tx.stockTransfer.update({
                where: { id },
                data: { status: TransferStatus.pending, requestedBy: userId, requestedAt: new Date() }
            });

            // Cancel any stale pending approvals for this transfer (re-submit case).
            await tx.approvalRequest.updateMany({
                where: { companyId, requestType: 'warehouse_transfer', resourceType: 'stock_transfer', resourceId: id, status: 'pending' },
                data: { status: 'cancelled', decisionNotes: 'resubmitted' }
            });

            await tx.approvalRequest.create({
                data: {
                    companyId,
                    requestType: 'warehouse_transfer',
                    resourceType: 'stock_transfer',
                    resourceId: id,
                    amount: totalUnits,
                    reason: transfer.reason
                        ? `${transfer.reason} (${transfer.number}: ${transfer.sourceWarehouse.name} → ${transfer.targetWarehouse.name})`
                        : `Transferência ${transfer.number}: ${transfer.sourceWarehouse.name} → ${transfer.targetWarehouse.name}`,
                    payload: {
                        transferNumber: transfer.number,
                        sourceWarehouseId: transfer.sourceWarehouseId,
                        targetWarehouseId: transfer.targetWarehouseId,
                        totalUnits,
                        itemCount: transfer.items.length,
                    } as Prisma.InputJsonValue,
                    requestedByUserId: userId,
                    requestedByName: userName ?? null,
                }
            });

            return updated;
        });

        emitToModule(companyId, 'approvals', 'approvals:created', {
            resourceType: 'stock_transfer',
            resourceId: id,
            requestType: 'warehouse_transfer',
        });

        return result;
    }

    /**
     * Manager approves a pending transfer and the source warehouse RESERVES the stock.
     * Reserved stock cannot be sold or transferred elsewhere until dispatch/cancel.
     * Self-approval (same user as requester) is blocked.
     * Mirrors the decision into the central ApprovalRequest log.
     */
    async approveTransfer(companyId: string, id: string, approverId: string, approverName?: string) {
        const result = await prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== TransferStatus.pending) throw ApiError.badRequest('Apenas transferências pendentes podem ser aprovadas');
            if (transfer.requestedBy && transfer.requestedBy === approverId) {
                throw ApiError.forbidden('O aprovador deve ser diferente de quem solicitou a transferência');
            }

            // Verify and reserve stock at source for every item.
            for (const item of transfer.items) {
                const stock = await tx.warehouseStock.findFirst({
                    where: { warehouseId: transfer.sourceWarehouseId, productId: item.productId, warehouse: { companyId } }
                });
                const available = Number(stock?.quantity ?? 0) - Number(stock?.reservedQuantity ?? 0);
                if (!stock || available < Number(item.quantity)) {
                    throw ApiError.badRequest(
                        `Stock disponível insuficiente para produto ${item.productId} no armazém origem (disponível: ${available}, pedido: ${item.quantity})`
                    );
                }
                await tx.warehouseStock.update({
                    where: { id: stock.id },
                    data: { reservedQuantity: { increment: item.quantity } }
                });
            }

            const updated = await tx.stockTransfer.update({
                where: { id },
                data: { status: TransferStatus.approved, approvedBy: approverId, approvedAt: new Date() }
            });

            await tx.approvalRequest.updateMany({
                where: { companyId, requestType: 'warehouse_transfer', resourceType: 'stock_transfer', resourceId: id, status: 'pending' },
                data: { status: 'approved', decidedByUserId: approverId, decidedByName: approverName ?? null, decidedAt: new Date() }
            });

            return updated;
        });

        emitToModule(companyId, 'approvals', 'approvals:approved', {
            resourceType: 'stock_transfer',
            resourceId: id,
            requestType: 'warehouse_transfer',
        });

        return result;
    }

    /**
     * Manager rejects a pending transfer. No stock impact.
     * Mirrors the decision into the central ApprovalRequest log.
     */
    async rejectTransfer(companyId: string, id: string, approverId: string, approverName: string | undefined, reason: string) {
        const trimmed = (reason || '').trim();
        if (trimmed.length < 5) throw ApiError.badRequest('Motivo da rejeição deve ter pelo menos 5 caracteres');
        const result = await prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({ where: { id, companyId } });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== TransferStatus.pending) throw ApiError.badRequest('Apenas transferências pendentes podem ser rejeitadas');
            if (transfer.requestedBy && transfer.requestedBy === approverId) {
                throw ApiError.forbidden('O aprovador deve ser diferente de quem solicitou a transferência');
            }
            const updated = await tx.stockTransfer.update({
                where: { id },
                data: { status: TransferStatus.rejected, rejectedBy: approverId, rejectedAt: new Date(), rejectReason: trimmed }
            });

            await tx.approvalRequest.updateMany({
                where: { companyId, requestType: 'warehouse_transfer', resourceType: 'stock_transfer', resourceId: id, status: 'pending' },
                data: { status: 'rejected', decidedByUserId: approverId, decidedByName: approverName ?? null, decidedAt: new Date(), decisionNotes: trimmed }
            });

            return updated;
        });

        emitToModule(companyId, 'approvals', 'approvals:rejected', {
            resourceType: 'stock_transfer',
            resourceId: id,
            requestType: 'warehouse_transfer',
        });

        return result;
    }

    /**
     * Mark approved transfer as physically dispatched.
     * Releases reservation and deducts stock from source warehouse.
     */
    async dispatchTransfer(companyId: string, id: string, userId: string, userName: string) {
        return prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== TransferStatus.approved) throw ApiError.badRequest('Apenas transferências aprovadas podem ser despachadas');

            const approverName = await this.resolveApproverName(tx, companyId, transfer);
            const approverNote = approverName ? ` (aprovada por ${approverName})` : '';

            for (const item of transfer.items) {
                const stock = await tx.warehouseStock.findFirst({
                    where: { warehouseId: transfer.sourceWarehouseId, productId: item.productId, warehouse: { companyId } }
                });
                if (!stock || stock.reservedQuantity < item.quantity) {
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
                    reason: `Transferência ${transfer.number} expedida para ${transfer.targetWarehouse.name}${approverNote}`,
                    performedBy: userName || transfer.responsible, companyId
                }, tx);
            }

            return tx.stockTransfer.update({
                where: { id },
                data: { status: TransferStatus.in_transit, dispatchedBy: userId, dispatchedAt: new Date() }
            });
        });
    }

    /**
     * Confirm receipt at destination -- adds stock there.
     * `receivedItems` is optional: pass [{itemId, receivedQuantity}] for partial receipts.
     * If omitted, receives the full ordered quantity for every item.
     */
    async receiveTransfer(companyId: string, id: string, userId: string, userName: string, receivedItems?: Array<{ itemId: string; receivedQuantity: number }>) {
        return prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            if (transfer.status !== TransferStatus.in_transit) {
                throw ApiError.badRequest('Apenas transferências em trânsito podem ser recebidas');
            }

            const receivedMap = new Map<string, number>();
            if (receivedItems && receivedItems.length > 0) {
                for (const r of receivedItems) receivedMap.set(r.itemId, r.receivedQuantity);
            }

            const approverName = await this.resolveApproverName(tx, companyId, transfer);
            const approverNote = approverName ? ` (aprovada por ${approverName})` : '';

            for (const item of transfer.items) {
                const received = receivedMap.has(item.id) ? Math.max(0, receivedMap.get(item.id)!) : Number(item.quantity);
                if (received > Number(item.quantity)) {
                    throw ApiError.badRequest(`Quantidade recebida (${received}) excede a expedida (${Number(item.quantity)}) para item ${item.id}`);
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
                        reason: `Recepção de transferência ${transfer.number} de ${transfer.sourceWarehouse.name}${approverNote}`,
                        performedBy: userName, companyId
                    }, tx);
                }
                // Any shortfall (received < dispatched) stays as a discrepancy --
                // the source warehouse already lost the stock. A separate
                // adjustment workflow can handle write-off / claim.
            }

            return tx.stockTransfer.update({
                where: { id },
                data: { status: TransferStatus.received, receivedBy: userId, receivedAt: new Date() }
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
        return prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id, companyId },
                include: { items: true, sourceWarehouse: true, targetWarehouse: true }
            });
            if (!transfer) throw ApiError.notFound('Transferência não encontrada');
            const terminalStates: TransferStatus[] = [
                TransferStatus.received,
                TransferStatus.completed,
                TransferStatus.rejected,
                TransferStatus.cancelled
            ];
            if (terminalStates.includes(transfer.status)) {
                throw ApiError.badRequest(`Transferência em estado "${transfer.status}" não pode ser cancelada`);
            }

            if (transfer.status === TransferStatus.approved) {
                for (const item of transfer.items) {
                    const stock = await tx.warehouseStock.findFirst({
                        where: { warehouseId: transfer.sourceWarehouseId, productId: item.productId, warehouse: { companyId } }
                    });
                    if (stock && stock.reservedQuantity >= item.quantity) {
                        await tx.warehouseStock.update({
                            where: { id: stock.id },
                            data: { reservedQuantity: { decrement: item.quantity } }
                        });
                    }
                }
            }

            if (transfer.status === TransferStatus.in_transit) {
                const approverName = await this.resolveApproverName(tx, companyId, transfer);
                const approverNote = approverName ? ` (aprovada por ${approverName})` : '';
                for (const item of transfer.items) {
                    await stockService.recordMovement({
                        productId: item.productId, warehouseId: transfer.sourceWarehouseId, quantity: Number(item.quantity),
                        movementType: 'adjustment', originModule: 'LOGISTICS', referenceType: 'transfer',
                        referenceContent: transfer.number,
                        reason: `Cancelamento de transferência ${transfer.number}${approverNote} -- stock reposto na origem`,
                        performedBy: userName, companyId
                    }, tx);
                }
            }

            // Cancel any pending central approval mirrored for this transfer.
            if (transfer.status === TransferStatus.pending) {
                await tx.approvalRequest.updateMany({
                    where: { companyId, requestType: 'warehouse_transfer', resourceType: 'stock_transfer', resourceId: id, status: 'pending' },
                    data: { status: 'cancelled', decisionNotes: 'transferência cancelada' }
                });
            }

            return tx.stockTransfer.update({
                where: { id },
                data: { status: TransferStatus.cancelled, cancelledBy: userId, cancelledAt: new Date() }
            });
        });
    }

    /**
     * Resolve the human-readable name of the approver for a transfer.
     * Prefers the linked ApprovalRequest.decidedByName (set in the same
     * transaction as the approval) and falls back to looking up the user
     * referenced by StockTransfer.approvedBy.
     */
    private async resolveApproverName(
        tx: StockTransactionClient,
        companyId: string,
        transfer: { id: string; approvedBy: string | null }
    ): Promise<string | null> {
        const approval = await tx.approvalRequest.findFirst({
            where: {
                companyId,
                requestType: 'warehouse_transfer',
                resourceType: 'stock_transfer',
                resourceId: transfer.id,
                status: 'approved',
            },
            orderBy: { decidedAt: 'desc' },
            select: { decidedByName: true },
        });
        if (approval?.decidedByName) return approval.decidedByName;
        if (transfer.approvedBy) {
            const user = await tx.user.findUnique({
                where: { id: transfer.approvedBy },
                select: { name: true },
            });
            return user?.name ?? null;
        }
        return null;
    }

    /**
     * Manager inbox -- pending approvals.
     */
    async listPendingApprovals(companyId: string) {
        return prisma.stockTransfer.findMany({
            where: { companyId, status: TransferStatus.pending },
            include: {
                sourceWarehouse: { select: { id: true, name: true, code: true } },
                targetWarehouse: { select: { id: true, name: true, code: true } },
                items: { include: { product: { select: { id: true, name: true, code: true, barcode: true, sku: true, unit: true, price: true, costPrice: true, weight: true } } } }
            },
            orderBy: { requestedAt: 'desc' }
        });
    }

    /** @deprecated Renamed to receiveTransfer. Old POST /:id/complete is now an alias. */
    async completeTransfer(companyId: string, id: string, userId: string, userName: string) {
        return this.receiveTransfer(companyId, id, userId, userName);
    }
}

export const warehousesService = new WarehousesService();
