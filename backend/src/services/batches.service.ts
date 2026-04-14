import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { addDays, isAfter, isBefore, differenceInDays } from 'date-fns';

export type BatchStatus = 'active' | 'expiring_soon' | 'expired' | 'depleted' | 'quarantine';

export interface CreateBatchInput {
    batchNumber: string;
    productId: string;
    supplierId?: string;
    warehouseId?: string;
    quantity: number;
    costPrice?: number;
    manufactureDate?: string;
    receivedDate?: string;
    expiryDate?: string;
    notes?: string;
}

export class BatchesService {

    // =========================================================================
    // STATUS LOGIC
    // =========================================================================

    private computeStatus(batch: { quantity: number; expiryDate: Date | null }): BatchStatus {
        if (batch.quantity <= 0) return 'depleted';
        if (!batch.expiryDate) return 'active';
        const now = new Date();
        if (isBefore(batch.expiryDate, now)) return 'expired';
        if (isBefore(batch.expiryDate, addDays(now, 30))) return 'expiring_soon';
        return 'active';
    }

    // =========================================================================
    // LIST
    // =========================================================================

    async list(companyId: string, params: any = {}) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: any = { companyId };

        if (params.productId) where.productId = params.productId;
        if (params.status) where.status = params.status;
        if (params.warehouseId) where.warehouseId = params.warehouseId;
        if (params.supplierId) where.supplierId = params.supplierId;
        if (params.search) {
            where.OR = [
                { batchNumber: { contains: params.search, mode: 'insensitive' } },
                { product: { name: { contains: params.search, mode: 'insensitive' } } },
            ];
        }

        const [total, batches] = await Promise.all([
            prisma.productBatch.count({ where }),
            prisma.productBatch.findMany({
                where,
                include: {
                    product: { select: { id: true, name: true, code: true, unit: true, category: true } },
                    supplier: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, name: true, code: true } },
                },
                orderBy: params.expiryDate ? { expiryDate: 'asc' } : { createdAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);

        return createPaginatedResponse(batches, page, limit, total);
    }

    async getExpiring(companyId: string, params: any = {}) {
        const days = parseInt(params.days as string) || 30;
        const { page, limit, skip } = getPaginationParams(params);
        const threshold = addDays(new Date(), days);
        const now = new Date();

        const where: any = {
            companyId,
            quantity: { gt: 0 },
            status: { not: 'depleted' },
            expiryDate: { not: null, lte: threshold },
        };

        const [total, batches] = await Promise.all([
            prisma.productBatch.count({ where }),
            prisma.productBatch.findMany({
                where,
                include: {
                    product: { select: { id: true, name: true, code: true, unit: true } },
                    supplier: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, name: true } },
                },
                orderBy: { expiryDate: 'asc' },
                skip,
                take: limit,
            }),
        ]);

        const enriched = batches.map(b => ({
            ...b,
            daysToExpiry: b.expiryDate ? differenceInDays(b.expiryDate, now) : null,
            isExpired: b.expiryDate ? isBefore(b.expiryDate, now) : false,
        }));

        return createPaginatedResponse(enriched, page, limit, total);
    }

    async getById(id: string, companyId: string) {
        const batch = await prisma.productBatch.findFirst({
            where: { id, companyId },
            include: {
                product: true,
                supplier: { select: { id: true, name: true } },
                warehouse: { select: { id: true, name: true } },
                saleItems: {
                    include: { sale: { select: { receiptNumber: true, createdAt: true } } },
                    orderBy: { sale: { createdAt: 'desc' } },
                    take: 20,
                },
            },
        });
        if (!batch) throw ApiError.notFound('Lote não encontrado');
        return {
            ...batch,
            daysToExpiry: batch.expiryDate ? differenceInDays(batch.expiryDate, new Date()) : null,
        };
    }

    // =========================================================================
    // CREATE
    // =========================================================================

    async create(data: CreateBatchInput, companyId: string) {
        // Validate product belongs to company
        const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } });
        if (!product) throw ApiError.notFound('Produto não encontrado');

        const existing = await prisma.productBatch.findFirst({ where: { companyId, batchNumber: data.batchNumber } });
        if (existing) throw ApiError.badRequest(`Lote "${data.batchNumber}" já existe`);

        const batchData = {
            batchNumber: data.batchNumber,
            productId: data.productId,
            companyId,
            supplierId: data.supplierId || null,
            warehouseId: data.warehouseId || null,
            initialQuantity: data.quantity,
            quantity: data.quantity,
            costPrice: data.costPrice || 0,
            manufactureDate: data.manufactureDate ? new Date(data.manufactureDate) : null,
            receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
            notes: data.notes || null,
            status: 'active' as BatchStatus,
        };

        batchData.status = this.computeStatus({ quantity: batchData.quantity, expiryDate: batchData.expiryDate });

        const batch = await prisma.productBatch.create({ data: batchData });

        // Update product expiry date to the nearest non-expired batch
        await this.syncProductExpiryDate(data.productId, companyId);

        // Create expiry alert if needed
        if (batch.status === 'expiring_soon' || batch.status === 'expired') {
            await this.createExpiryAlert(batch, product, companyId);
        }

        return batch;
    }

    // =========================================================================
    // UPDATE
    // =========================================================================

    async update(id: string, data: Partial<CreateBatchInput> & { status?: BatchStatus }, companyId: string) {
        const batch = await prisma.productBatch.findFirst({ where: { id, companyId } });
        if (!batch) throw ApiError.notFound('Lote não encontrado');

        const updateData: any = {};
        if (data.quantity !== undefined) updateData.quantity = data.quantity;
        if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;
        if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
        if (data.manufactureDate !== undefined) updateData.manufactureDate = data.manufactureDate ? new Date(data.manufactureDate) : null;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId;
        if (data.status !== undefined) updateData.status = data.status;

        // Auto-compute status if not explicitly provided
        if (!data.status) {
            const newQty = updateData.quantity ?? batch.quantity;
            const newExpiry = updateData.expiryDate !== undefined ? updateData.expiryDate : batch.expiryDate;
            updateData.status = this.computeStatus({ quantity: newQty, expiryDate: newExpiry });
        }

        const updated = await prisma.productBatch.update({ where: { id }, data: updateData });
        await this.syncProductExpiryDate(batch.productId, companyId);
        return updated;
    }

    // =========================================================================
    // DELETE
    // =========================================================================

    async delete(id: string, companyId: string) {
        const batch = await prisma.productBatch.findFirst({ where: { id, companyId } });
        if (!batch) throw ApiError.notFound('Lote não encontrado');

        const usageCount = await prisma.saleItem.count({ where: { batchId: id } });
        if (usageCount > 0) throw ApiError.badRequest('Lote em uso em vendas. Não pode ser eliminado.');

        await prisma.productBatch.delete({ where: { id } });
        await this.syncProductExpiryDate(batch.productId, companyId);
        return { success: true };
    }

    // =========================================================================
    // DASHBOARD
    // =========================================================================

    async getDashboard(companyId: string) {
        const now = new Date();
        const threshold30 = addDays(now, 30);
        const threshold7 = addDays(now, 7);

        // Use live date comparisons — don't rely on the stored status field which may be stale
        const [total, expiredCount, expiring30, expiring7, depleted, activeCount] = await Promise.all([
            prisma.productBatch.count({ where: { companyId } }),
            prisma.productBatch.count({ where: { companyId, quantity: { gt: 0 }, expiryDate: { not: null, lt: now } } }),
            prisma.productBatch.count({ where: { companyId, quantity: { gt: 0 }, expiryDate: { not: null, gte: now, lte: threshold30 } } }),
            prisma.productBatch.count({ where: { companyId, quantity: { gt: 0 }, expiryDate: { not: null, gte: now, lte: threshold7 } } }),
            prisma.productBatch.count({ where: { companyId, quantity: { lte: 0 } } }),
            prisma.productBatch.count({ where: { companyId, quantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gt: threshold30 } }] } }),
        ]);

        // Value at risk (expired stock value)
        const expiredBatches = await prisma.productBatch.findMany({
            where: { companyId, status: 'expired', quantity: { gt: 0 } },
            select: { quantity: true, costPrice: true },
        });
        const valueAtRisk = expiredBatches.reduce((s, b) => s + b.quantity * Number(b.costPrice), 0);

        // Upcoming expiries (next 30 days)
        const upcoming = await prisma.productBatch.findMany({
            where: { companyId, quantity: { gt: 0 }, expiryDate: { gte: now, lte: threshold30 } },
            include: { product: { select: { name: true, code: true, unit: true } } },
            orderBy: { expiryDate: 'asc' },
            take: 10,
        });

        return {
            summary: { total, active: activeCount, expiredCount, expiring30, expiring7, depleted, valueAtRisk },
            upcoming: upcoming.map(b => ({
                ...b,
                daysToExpiry: b.expiryDate ? differenceInDays(b.expiryDate, now) : null,
            })),
        };
    }

    // =========================================================================
    // SYNC PRODUCT EXPIRY DATE
    // =========================================================================

    // expiryDate was removed from Product — nothing to sync
    private async syncProductExpiryDate(_productId: string, _companyId: string) {
        // no-op: expiry is now tracked exclusively in ProductBatch
    }

    private async createExpiryAlert(batch: any, product: any, companyId: string) {
        const existing = await prisma.alert.findFirst({
            where: { relatedId: batch.id, type: 'expiring_soon', isResolved: false },
        });
        if (existing) return;

        const isExpired = batch.status === 'expired';
        await prisma.alert.create({
            data: {
                type: isExpired ? 'expired_product' : 'expiring_soon',
                priority: isExpired ? 'critical' : 'high',
                title: isExpired ? `Lote expirado: ${product.name}` : `Lote a expirar em breve: ${product.name}`,
                message: `Lote ${batch.batchNumber} de "${product.name}" ${isExpired ? 'está expirado' : 'expira em breve'}. Quantidade: ${batch.quantity} ${product.unit}`,
                relatedId: batch.id,
                relatedType: 'product_batch',
                companyId,
            },
        });
    }
}

export const batchesService = new BatchesService();
