import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../utils/pagination';
import { logger } from '../utils/logger';

type ListQuery = {
    page?: string | number;
    limit?: string | number;
    fields?: string;
    productId?: string;
    status?: string;
    warehouseId?: string;
    supplierId?: string;
    search?: string;
    expiryDate?: string;
};

type ExpiringQuery = ListQuery & { days?: string | number };

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type BatchSummary = { id: string; batchNumber: string; status: string; quantity: number };
type ProductSummary = { name: string; unit?: string | null };

const BATCH_FIELD_ALLOWLIST = [
    'id', 'batchNumber', 'productId', 'supplierId', 'warehouseId',
    'initialQuantity', 'quantity', 'costPrice',
    'manufactureDate', 'receivedDate', 'expiryDate',
    'status', 'notes', 'createdAt', 'updatedAt',
    'product.id', 'product.name', 'product.code', 'product.unit',
    'supplier.id', 'supplier.name',
    'warehouse.id', 'warehouse.name', 'warehouse.code'
] as const;
import { addDays, isBefore, differenceInDays } from 'date-fns';
import { stockService } from './stockService';

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

    async list(companyId: string, params: ListQuery = {}) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: Prisma.ProductBatchWhereInput = { companyId };

        if (params.productId) where.productId = params.productId;
        if (params.status) where.status = params.status as Prisma.ProductBatchWhereInput['status'];
        if (params.warehouseId) where.warehouseId = params.warehouseId;
        if (params.supplierId) where.supplierId = params.supplierId;
        if (params.search) {
            where.OR = [
                { batchNumber: { contains: params.search, mode: 'insensitive' } },
                { product: { name: { contains: params.search, mode: 'insensitive' } } },
            ];
        }

        const projection = parseFields(params.fields, BATCH_FIELD_ALLOWLIST);
        const baseArgs = {
            where,
            orderBy: params.expiryDate ? { expiryDate: 'asc' as const } : { createdAt: 'desc' as const },
            skip,
            take: limit,
        };
        const findArgs: Prisma.ProductBatchFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.ProductBatchSelect }
            : {
                ...baseArgs,
                include: {
                    product: { select: { id: true, name: true, code: true, unit: true, category: true } },
                    supplier: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, name: true, code: true } },
                },
            };

        const [total, batches] = await Promise.all([
            prisma.productBatch.count({ where }),
            prisma.productBatch.findMany(findArgs),
        ]);

        return createPaginatedResponse(batches, page, limit, total);
    }

    async getExpiring(companyId: string, params: ExpiringQuery = {}) {
        const days = parseInt(String(params.days ?? '')) || 30;
        const { page, limit, skip } = getPaginationParams(params);
        const threshold = addDays(new Date(), days);
        const now = new Date();

        const where: Prisma.ProductBatchWhereInput = {
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
        logger.debug('Creating product batch', { productId: data.productId, batchNumber: data.batchNumber, companyId });
        
        // Validate product belongs to company
        const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } });
        if (!product) {
            logger.warn('Batch creation rejected because product was not found in tenant', { productId: data.productId, companyId });
            throw ApiError.notFound('Produto não encontrado');
        }

        const existing = await prisma.productBatch.findFirst({ where: { companyId, batchNumber: data.batchNumber } });
        if (existing) {
            console.error('Batch number already exists:', data.batchNumber);
            throw ApiError.badRequest(`Lote "${data.batchNumber}" já existe`);
        }

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

        const batch = await prisma.$transaction(async (tx) => {
            const b = await tx.productBatch.create({ data: batchData });

            // Update Stock Balances (Global and Warehouse)
            await stockService.recordMovement({
                productId: data.productId,
                warehouseId: data.warehouseId,
                productBatchId: b.id,
                quantity: data.quantity,
                movementType: 'purchase', // Batches are usually inventory entries/purchases
                originModule: 'COMMERCIAL',
                reason: `Entrada de lote: ${data.batchNumber}`,
                performedBy: 'Sistema (Lote)',
                companyId
            }, tx as TxClient);

            return b;
        }, { timeout: 30000, maxWait: 10000 });

        // Update product expiry date logic (now outside transaction if needed, or inside)
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

        const updateData: Prisma.ProductBatchUncheckedUpdateInput = {};
        const nextQuantity: number | undefined = data.quantity;
        const nextExpiry: Date | null | undefined = data.expiryDate !== undefined
            ? (data.expiryDate ? new Date(data.expiryDate) : null)
            : undefined;
        if (nextQuantity !== undefined) updateData.quantity = nextQuantity;
        if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;
        if (nextExpiry !== undefined) updateData.expiryDate = nextExpiry;
        if (data.manufactureDate !== undefined) updateData.manufactureDate = data.manufactureDate ? new Date(data.manufactureDate) : null;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId;
        if (data.status !== undefined) updateData.status = data.status;

        // Auto-compute status if not explicitly provided
        if (!data.status) {
            const newQty = nextQuantity ?? batch.quantity;
            const newExpiry = nextExpiry !== undefined ? nextExpiry : batch.expiryDate;
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

        await prisma.$transaction(async (tx) => {
            // Reverter o stock antes de eliminar o lote
            if (batch.quantity > 0) {
                await stockService.recordMovement({
                    productId: batch.productId,
                    warehouseId: batch.warehouseId || undefined,
                    batchId: batch.id,
                    quantity: -batch.quantity, // Subtract remaining quantity
                    movementType: 'adjustment',
                    originModule: 'COMMERCIAL',
                    reason: `Eliminação do lote: ${batch.batchNumber}`,
                    performedBy: 'Sistema (Lote)',
                    companyId
                }, tx as TxClient);
            }

            await tx.productBatch.delete({ where: { id } });
        }, { timeout: 30000, maxWait: 10000 });

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

        // Use live date comparisons -- don't rely on the stored status field which may be stale
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

    // expiryDate was removed from Product -- nothing to sync
    private async syncProductExpiryDate(_productId: string, _companyId: string) {
        // no-op: expiry is now tracked exclusively in ProductBatch
    }

    private async createExpiryAlert(batch: BatchSummary, product: ProductSummary, companyId: string) {
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
