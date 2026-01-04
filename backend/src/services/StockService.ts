import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../index';

export type OriginModule = 'PHARMACY' | 'COMMERCIAL' | 'BOTTLE_STORE' | 'HOTEL' | 'RESTAURANT' | 'LOGISTICS';
export type MovementReferenceType = 'SALE' | 'PURCHASE' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'EXPIRY';
export type MovementType = 'purchase' | 'sale' | 'return_in' | 'return_out' | 'adjustment' | 'expired' | 'transfer' | 'loss';

export interface StockMovementParams {
    productId: string;
    warehouseId?: string;
    batchId?: string;
    quantity: number; // Positive for increment, Negative for decrement
    movementType: MovementType;
    originModule: OriginModule;
    referenceType?: string;
    referenceContent?: string; // ID or Receipt Number
    reason?: string;
    performedBy: string;
    companyId?: string;
}

export class StockService {
    /**
     * Records a stock movement and updates the current stock in the product and warehouse.
     * Uses the provided transaction client if available.
     */
    static async recordMovement(
        params: StockMovementParams,
        tx: Prisma.TransactionClient = defaultPrisma
    ) {
        const {
            productId,
            warehouseId,
            batchId,
            quantity,
            movementType,
            originModule,
            referenceType,
            referenceContent,
            reason,
            performedBy,
            companyId
        } = params;

        // 1. Get current stock state for audit (balanceBefore)
        const currentProduct = await tx.product.findUnique({
            where: { id: productId },
            select: { currentStock: true }
        });

        const balanceBefore = currentProduct?.currentStock || 0;
        const balanceAfter = balanceBefore + quantity;

        // 2. Update Product Global Stock
        const product = await tx.product.update({
            where: { id: productId },
            data: {
                currentStock: { increment: quantity }
            }
        });

        // 3. Update Warehouse Specific Stock if warehouseId is provided
        if (warehouseId) {
            await tx.warehouseStock.upsert({
                where: {
                    warehouseId_productId: {
                        warehouseId,
                        productId
                    }
                },
                update: {
                    quantity: { increment: quantity }
                },
                create: {
                    warehouseId,
                    productId,
                    quantity: quantity
                }
            });
        }

        // 4. Create Detailed Stock Movement Record
        const movement = await tx.stockMovement.create({
            data: {
                companyId,
                productId,
                warehouseId,
                batchId,
                quantity: Math.abs(quantity),
                movementType,
                balanceBefore,
                balanceAfter,
                originModule,
                referenceType,
                reference: referenceContent,
                reason,
                performedBy
            }
        });

        // 5. Update Product Status (Alerts etc.)
        await this.updateProductStatus(product.id, tx);

        return movement;
    }

    /**
     * Updates product status based on current stock levels
     */
    private static async updateProductStatus(productId: string, tx: Prisma.TransactionClient) {
        const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, currentStock: true, minStock: true, status: true, companyId: true }
        });

        if (!product) return;

        let newStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
        if (product.currentStock <= 0) {
            newStatus = 'out_of_stock';
        } else if (product.minStock && product.currentStock <= product.minStock) {
            newStatus = 'low_stock';
        }

        if (newStatus !== product.status) {
            await tx.product.update({
                where: { id: productId },
                data: { status: newStatus as any }
            });

            // Trigger alert if needed
            if (newStatus !== 'in_stock') {
                await tx.alert.create({
                    data: {
                        type: 'low_stock',
                        priority: newStatus === 'out_of_stock' ? 'critical' : 'high',
                        title: newStatus === 'out_of_stock' ? `Stock Esgotado: ${product.name}` : `Stock Baixo: ${product.name}`,
                        message: `${product.name} tem agora ${product.currentStock} unidades em stock.`,
                        relatedId: product.id,
                        relatedType: 'product',
                        companyId: product.companyId
                    }
                });
            }
        }
    }
}
