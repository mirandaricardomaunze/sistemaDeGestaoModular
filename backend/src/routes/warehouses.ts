import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all warehouses
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const warehouses = await prisma.warehouse.findMany({
            where: { isActive: true, companyId: req.companyId },
            include: {
                _count: {
                    select: { stocks: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(warehouses);
    } catch (error) {
        console.error('Get warehouses error:', error);
        res.status(500).json({ error: 'Erro ao buscar armazéns' });
    }
});

// Get warehouse by ID with stock
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const warehouse = await prisma.warehouse.findFirst({
            where: { id: req.params.id, companyId: req.companyId },
            include: {
                stocks: {
                    include: {
                        product: {
                            select: { id: true, name: true, code: true, unit: true }
                        }
                    }
                }
            }
        });

        if (!warehouse) {
            return res.status(404).json({ error: 'Armazém não encontrado' });
        }

        res.json(warehouse);
    } catch (error) {
        console.error('Get warehouse error:', error);
        res.status(500).json({ error: 'Erro ao buscar armazém' });
    }
});

// Create warehouse
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const code = req.body.code || `WH-${Date.now().toString().slice(-6)}`;

        const warehouse = await prisma.warehouse.create({
            data: {
                ...req.body,
                code,
                companyId: req.companyId
            }
        });

        res.status(201).json(warehouse);
    } catch (error) {
        console.error('Create warehouse error:', error);
        res.status(500).json({ error: 'Erro ao criar armazém' });
    }
});

// Update warehouse
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const warehouse = await prisma.warehouse.updateMany({
            where: { id: req.params.id, companyId: req.companyId },
            data: req.body
        });

        if (warehouse.count === 0) {
            return res.status(404).json({ error: 'Armazém não encontrado ou acesso negado' });
        }

        const updated = await prisma.warehouse.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update warehouse error:', error);
        res.status(500).json({ error: 'Erro ao atualizar armazém' });
    }
});

// Delete warehouse (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        // Check if warehouse has stock
        const stocks = await prisma.warehouseStock.findMany({
            where: {
                warehouseId: req.params.id,
                quantity: { gt: 0 },
                warehouse: { companyId: req.companyId }
            }
        });

        if (stocks.length > 0) {
            return res.status(400).json({
                error: 'Não é possível remover armazém com stock. Transfira primeiro.'
            });
        }

        const result = await prisma.warehouse.updateMany({
            where: { id: req.params.id, companyId: req.companyId },
            data: { isActive: false }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Armazém não encontrado ou acesso negado' });
        }

        res.json({ message: 'Armazém removido com sucesso' });
    } catch (error) {
        console.error('Delete warehouse error:', error);
        res.status(500).json({ error: 'Erro ao remover armazém' });
    }
});

// === STOCK TRANSFERS ===

// Get all transfers
router.get('/transfers/all', authenticate, async (req: AuthRequest, res) => {
    try {
        const { status, startDate, endDate } = req.query;

        const where: any = {
            companyId: req.companyId
        };
        if (status) where.status = status;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(String(startDate));
            if (endDate) where.date.lte = new Date(String(endDate));
        }

        const transfers = await prisma.stockTransfer.findMany({
            where,
            include: {
                sourceWarehouse: { select: { id: true, name: true, code: true } },
                targetWarehouse: { select: { id: true, name: true, code: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, code: true, barcode: true, description: true, unit: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(transfers);
    } catch (error) {
        console.error('Get transfers error:', error);
        res.status(500).json({ error: 'Erro ao buscar transferências' });
    }
});

// Create stock transfer
router.post('/transfers', authenticate, async (req: AuthRequest, res) => {
    try {
        const { sourceWarehouseId, targetWarehouseId, items, responsible, reason } = req.body;

        if (sourceWarehouseId === targetWarehouseId) {
            return res.status(400).json({ error: 'Origem e destino não podem ser iguais' });
        }

        // Use a transaction to ensure all operations succeed or none do
        const transferResult = await prisma.$transaction(async (tx) => {
            // Verify source warehouse ownership and stock availability
            for (const item of items) {
                const stock = await tx.warehouseStock.findFirst({
                    where: {
                        warehouseId: sourceWarehouseId,
                        productId: item.productId,
                        warehouse: { companyId: req.companyId }
                    }
                });

                if (!stock || stock.quantity < item.quantity) {
                    throw new Error(`Stock insuficiente para o produto "${item.productName || item.productId}" no armazém de origem`);
                }
            }

            // Verify target warehouse ownership
            const targetWH = await tx.warehouse.findFirst({
                where: { id: targetWarehouseId, companyId: req.companyId }
            });

            if (!targetWH) {
                throw new Error('Armazém de destino não encontrado ou acesso negado');
            }

            // Generate transfer number inside transaction
            const year = new Date().getFullYear();
            const count = await tx.stockTransfer.count({
                where: { companyId: req.companyId }
            });
            const number = `GT-${year}-${String(count + 1).padStart(4, '0')}`;

            // Create transfer
            const newTransfer = await tx.stockTransfer.create({
                data: {
                    number,
                    sourceWarehouseId,
                    targetWarehouseId,
                    responsible,
                    reason,
                    status: 'completed',
                    companyId: req.companyId,
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            quantity: item.quantity
                        }))
                    }
                },
                include: {
                    sourceWarehouse: true,
                    targetWarehouse: true,
                    items: { include: { product: { select: { id: true, name: true, code: true, barcode: true, description: true, unit: true } } } }
                }
            });

            // Update warehouse stocks and log movements
            for (const item of items) {
                // Get current source stock for balance tracking
                const sourceStock = await tx.warehouseStock.findUnique({
                    where: {
                        warehouseId_productId: {
                            warehouseId: sourceWarehouseId,
                            productId: item.productId
                        }
                    }
                });

                const sourceBalanceBefore = sourceStock?.quantity || 0;
                const sourceBalanceAfter = sourceBalanceBefore - item.quantity;

                // Decrease from source
                await tx.warehouseStock.update({
                    where: {
                        warehouseId_productId: {
                            warehouseId: sourceWarehouseId,
                            productId: item.productId
                        }
                    },
                    data: {
                        quantity: { decrement: item.quantity }
                    }
                });

                // Log Source Movement (Audit)
                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        warehouseId: sourceWarehouseId,
                        movementType: 'transfer',
                        quantity: -item.quantity, // Negative for decrease
                        balanceBefore: sourceBalanceBefore,
                        balanceAfter: sourceBalanceAfter,
                        reference: number,
                        referenceType: 'transfer',
                        reason: `Saída por transferência para ${targetWH.name}`,
                        performedBy: req.userName || responsible,
                        companyId: req.companyId,
                        originModule: 'inventory'
                    }
                });

                // Increase at target
                const targetStock = await tx.warehouseStock.findFirst({
                    where: { warehouseId: targetWarehouseId, productId: item.productId }
                });

                const targetBalanceBefore = targetStock?.quantity || 0;
                const targetBalanceAfter = targetBalanceBefore + item.quantity;

                if (targetStock) {
                    await tx.warehouseStock.update({
                        where: { id: targetStock.id },
                        data: { quantity: { increment: item.quantity } }
                    });
                } else {
                    await tx.warehouseStock.create({
                        data: {
                            warehouseId: targetWarehouseId,
                            productId: item.productId,
                            quantity: item.quantity
                        }
                    });
                }

                // Get source warehouse name for logging
                const sourceWH = await tx.warehouse.findFirst({
                    where: { id: sourceWarehouseId, companyId: req.companyId },
                    select: { name: true }
                });

                // Log Target Movement (Audit)
                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        warehouseId: targetWarehouseId,
                        movementType: 'transfer',
                        quantity: item.quantity,
                        balanceBefore: targetBalanceBefore,
                        balanceAfter: targetBalanceAfter,
                        reference: number,
                        referenceType: 'transfer',
                        reason: `Entrada por transferência de ${sourceWH?.name || 'Origem'}`,
                        performedBy: req.userName || responsible,
                        companyId: req.companyId,
                        originModule: 'inventory'
                    }
                });
            }

            return newTransfer;
        });

        res.status(201).json(transferResult);
    } catch (error: unknown) {
        console.error('Create transfer error:', error);
        res.status(400).json({ error: error.message || 'Erro ao criar transferência' });
    }
});

// Cancel transfer
router.post('/transfers/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    try {
        const transfer = await prisma.stockTransfer.findFirst({
            where: { id: req.params.id, companyId: req.companyId },
            include: { items: true }
        });

        if (!transfer) {
            return res.status(404).json({ error: 'Transferência não encontrada' });
        }

        if (transfer.status === 'cancelled') {
            return res.status(400).json({ error: 'Transferência já cancelada' });
        }

        // Reverse stock movements
        for (const item of transfer.items) {
            // Return to source
            await prisma.warehouseStock.updateMany({
                where: {
                    warehouseId: transfer.sourceWarehouseId,
                    productId: item.productId,
                    warehouse: { companyId: req.companyId }
                },
                data: {
                    quantity: { increment: item.quantity }
                }
            });

            // Remove from target
            await prisma.warehouseStock.updateMany({
                where: {
                    warehouseId: transfer.targetWarehouseId,
                    productId: item.productId,
                    warehouse: { companyId: req.companyId }
                },
                data: {
                    quantity: { decrement: item.quantity }
                }
            });
        }

        // Update transfer status
        const updated = await prisma.stockTransfer.updateMany({
            where: { id: req.params.id, companyId: req.companyId },
            data: { status: 'cancelled' }
        });

        if (updated.count === 0) {
            return res.status(404).json({ error: 'Transferência não encontrada ou acesso negado' });
        }

        res.json(updated);
    } catch (error) {
        console.error('Cancel transfer error:', error);
        res.status(500).json({ error: 'Erro ao cancelar transferência' });
    }
});

// Get warehouse stock
router.get('/:id/stock', authenticate, async (req: AuthRequest, res) => {
    try {
        const stocks = await prisma.warehouseStock.findMany({
            where: {
                warehouseId: req.params.id,
                warehouse: { companyId: req.companyId }
            },
            include: {
                product: true
            }
        });

        res.json(stocks);
    } catch (error) {
        console.error('Get warehouse stock error:', error);
        res.status(500).json({ error: 'Erro ao buscar stock do armazém' });
    }
});

export default router;
