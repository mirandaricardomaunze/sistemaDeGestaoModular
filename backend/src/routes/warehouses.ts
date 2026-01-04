import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all warehouses
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const warehouses = await prisma.warehouse.findMany({
            where: { isActive: true },
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
        const warehouse = await prisma.warehouse.findUnique({
            where: { id: req.params.id },
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
                code
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
        const warehouse = await prisma.warehouse.update({
            where: { id: req.params.id },
            data: req.body
        });

        res.json(warehouse);
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
                quantity: { gt: 0 }
            }
        });

        if (stocks.length > 0) {
            return res.status(400).json({
                error: 'Não é possível remover armazém com stock. Transfira primeiro.'
            });
        }

        await prisma.warehouse.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

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

        const where: any = {};
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
                        product: { select: { id: true, name: true, code: true } }
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

        // Validate stock availability
        for (const item of items) {
            const stock = await prisma.warehouseStock.findUnique({
                where: {
                    warehouseId_productId: {
                        warehouseId: sourceWarehouseId,
                        productId: item.productId
                    }
                }
            });

            if (!stock || stock.quantity < item.quantity) {
                return res.status(400).json({
                    error: `Stock insuficiente para produto ${item.productName || item.productId}`
                });
            }
        }

        // Generate transfer number
        const year = new Date().getFullYear();
        const count = await prisma.stockTransfer.count();
        const number = `GT-${year}-${String(count + 1).padStart(4, '0')}`;

        // Create transfer
        const transfer = await prisma.stockTransfer.create({
            data: {
                number,
                sourceWarehouseId,
                targetWarehouseId,
                responsible,
                reason,
                status: 'completed',
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
                items: { include: { product: true } }
            }
        });

        // Update warehouse stocks
        for (const item of items) {
            // Decrease from source
            await prisma.warehouseStock.update({
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

            // Increase at target
            await prisma.warehouseStock.upsert({
                where: {
                    warehouseId_productId: {
                        warehouseId: targetWarehouseId,
                        productId: item.productId
                    }
                },
                update: {
                    quantity: { increment: item.quantity }
                },
                create: {
                    warehouseId: targetWarehouseId,
                    productId: item.productId,
                    quantity: item.quantity
                }
            });
        }

        res.status(201).json(transfer);
    } catch (error) {
        console.error('Create transfer error:', error);
        res.status(500).json({ error: 'Erro ao criar transferência' });
    }
});

// Cancel transfer
router.post('/transfers/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    try {
        const transfer = await prisma.stockTransfer.findUnique({
            where: { id: req.params.id },
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
            await prisma.warehouseStock.update({
                where: {
                    warehouseId_productId: {
                        warehouseId: transfer.sourceWarehouseId,
                        productId: item.productId
                    }
                },
                data: {
                    quantity: { increment: item.quantity }
                }
            });

            // Remove from target
            await prisma.warehouseStock.update({
                where: {
                    warehouseId_productId: {
                        warehouseId: transfer.targetWarehouseId,
                        productId: item.productId
                    }
                },
                data: {
                    quantity: { decrement: item.quantity }
                }
            });
        }

        // Update transfer status
        const updated = await prisma.stockTransfer.update({
            where: { id: req.params.id },
            data: { status: 'cancelled' }
        });

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
            where: { warehouseId: req.params.id },
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
