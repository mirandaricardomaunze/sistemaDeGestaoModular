import { PhysicalInventoryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { stockService } from './stockService';
import type { BulkCountInput, CreateInventoryInput } from '../validation/physicalInventory.validation';

export class PhysicalInventoryService {
    async listInventories(companyId: string, warehouseId?: string) {
        return prisma.physicalInventory.findMany({
            where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
            include: {
                warehouse: { select: { id: true, name: true, code: true } },
                _count: { select: { lines: true } }
            },
            orderBy: { startedAt: 'desc' }
        });
    }

    async getInventoryDetail(inventoryId: string, companyId: string) {
        const inventory = await prisma.physicalInventory.findFirst({
            where: { id: inventoryId, companyId },
            include: {
                warehouse: { select: { id: true, name: true, code: true } },
                lines: {
                    include: { product: { select: { id: true, code: true, name: true, unit: true, currentStock: true } } },
                    orderBy: { product: { name: 'asc' } }
                }
            }
        });
        if (!inventory) throw ApiError.notFound('Inventario fisico nao encontrado');
        return inventory;
    }

    async createInventory(companyId: string, userId: string, data: CreateInventoryInput) {
        const warehouse = await prisma.warehouse.findFirst({
            where: { id: data.warehouseId, companyId, isActive: true }
        });
        if (!warehouse) throw ApiError.notFound('Armazem nao encontrado');

        const reference = await this.generateReference(companyId);

        const stockRows = await prisma.warehouseStock.findMany({
            where: { companyId, warehouseId: data.warehouseId },
            include: { product: true },
            orderBy: { product: { name: 'asc' } }
        });

        const lineSource = stockRows.length > 0
            ? stockRows.map((row) => ({
                productId: row.productId,
                expectedQuantity: row.quantity
            }))
            : (await prisma.product.findMany({
                where: { companyId, isActive: true },
                select: { id: true, currentStock: true },
                orderBy: { name: 'asc' }
            })).map((product) => ({
                productId: product.id,
                expectedQuantity: product.currentStock
            }));

        if (lineSource.length === 0) {
            throw ApiError.badRequest('Nao existem produtos activos para contar neste armazem');
        }

        return prisma.$transaction(async (tx) => tx.physicalInventory.create({
            data: {
                companyId,
                warehouseId: data.warehouseId,
                reference,
                notes: data.notes || null,
                createdBy: userId,
                lines: {
                    create: lineSource.map((line) => ({
                        productId: line.productId,
                        expectedQuantity: line.expectedQuantity,
                        countedQuantity: line.expectedQuantity,
                        difference: 0
                    }))
                }
            },
            include: {
                warehouse: { select: { id: true, name: true, code: true } },
                _count: { select: { lines: true } }
            }
        }));
    }

    async submitCounts(inventoryId: string, companyId: string, data: BulkCountInput) {
        const inventory = await prisma.physicalInventory.findFirst({
            where: { id: inventoryId, companyId, status: { in: [PhysicalInventoryStatus.DRAFT, PhysicalInventoryStatus.COUNTING] } },
            include: { lines: true }
        });
        if (!inventory) throw ApiError.notFound('Inventario aberto nao encontrado');

        const lineById = new Map(inventory.lines.map((line) => [line.id, line]));

        return prisma.$transaction(async (tx) => {
            await tx.physicalInventory.update({
                where: { id: inventoryId },
                data: { status: PhysicalInventoryStatus.COUNTING }
            });

            for (const count of data.lines) {
                const line = lineById.get(count.lineId);
                if (!line) throw ApiError.badRequest('Linha de contagem invalida');
                const difference = count.countedQuantity - Number(line.expectedQuantity);
                await tx.physicalInventoryLine.update({
                    where: { id: count.lineId },
                    data: {
                        countedQuantity: count.countedQuantity,
                        difference,
                        notes: count.notes || null
                    }
                });
            }

            return tx.physicalInventory.update({
                where: { id: inventoryId },
                data: { status: PhysicalInventoryStatus.REVIEW },
                include: {
                    warehouse: { select: { id: true, name: true, code: true } },
                    lines: { include: { product: { select: { id: true, code: true, name: true, unit: true, currentStock: true } } } }
                }
            });
        });
    }

    async approveInventory(inventoryId: string, companyId: string, approvedBy: string) {
        const inventory = await prisma.physicalInventory.findFirst({
            where: { id: inventoryId, companyId, status: PhysicalInventoryStatus.REVIEW },
            include: { lines: true }
        });
        if (!inventory) throw ApiError.notFound('Inventario em revisao nao encontrado');

        return prisma.$transaction(async (tx) => {
            for (const line of inventory.lines) {
                if (Number(line.difference) === 0) continue;
                await stockService.recordMovement({
                    companyId,
                    productId: line.productId,
                    warehouseId: inventory.warehouseId,
                    quantity: Number(line.difference),
                    movementType: 'adjustment',
                    originModule: 'COMMERCIAL',
                    referenceType: 'PHYSICAL_INVENTORY',
                    referenceContent: inventory.reference,
                    reason: `Ajuste inventario fisico ${inventory.reference}`,
                    performedBy: approvedBy
                }, tx);
            }

            return tx.physicalInventory.update({
                where: { id: inventoryId },
                data: {
                    status: PhysicalInventoryStatus.APPROVED,
                    finishedAt: new Date(),
                    approvedBy
                },
                include: {
                    warehouse: { select: { id: true, name: true, code: true } },
                    lines: { include: { product: { select: { id: true, code: true, name: true, unit: true, currentStock: true } } } }
                }
            });
        });
    }

    async cancelInventory(inventoryId: string, companyId: string) {
        const inventory = await prisma.physicalInventory.findFirst({
            where: { id: inventoryId, companyId, status: { not: PhysicalInventoryStatus.APPROVED } }
        });
        if (!inventory) throw ApiError.notFound('Inventario cancelavel nao encontrado');
        return prisma.physicalInventory.update({
            where: { id: inventoryId },
            data: { status: PhysicalInventoryStatus.CANCELLED, finishedAt: new Date() }
        });
    }

    private async generateReference(companyId: string): Promise<string> {
        const year = new Date().getFullYear();
        const count = await prisma.physicalInventory.count({
            where: {
                companyId,
                reference: { startsWith: `INV-${year}-` }
            }
        });
        return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    }
}

export const physicalInventoryService = new PhysicalInventoryService();
