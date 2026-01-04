import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all suppliers with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            search,
            isActive,
            page = '1',
            limit = '20',
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId // Multi-tenancy isolation
        };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { nuit: { contains: String(search) } },
                { phone: { contains: String(search) } }
            ];
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        // Get total count and paginated items in parallel
        const [total, suppliers] = await Promise.all([
            prisma.supplier.count({ where }),
            prisma.supplier.findMany({
                where,
                include: {
                    _count: { select: { products: true, purchaseOrders: true } }
                },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: suppliers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + suppliers.length < total
            }
        });
    } catch (error) {
        console.error('Get suppliers error:', error);
        res.status(500).json({ error: 'Erro ao buscar fornecedores' });
    }
});

// Get supplier by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const supplier = await prisma.supplier.findUnique({
            where: { id: req.params.id },
            include: {
                products: { take: 20 },
                purchaseOrders: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!supplier) {
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }

        res.json(supplier);
    } catch (error) {
        console.error('Get supplier error:', error);
        res.status(500).json({ error: 'Erro ao buscar fornecedor' });
    }
});

// Create supplier
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const code = req.body.code || `FOR-${Date.now().toString().slice(-6)}`;

        const supplier = await prisma.supplier.create({
            data: {
                ...req.body,
                code
            }
        });

        res.status(201).json(supplier);
    } catch (error) {
        console.error('Create supplier error:', error);
        res.status(500).json({ error: 'Erro ao criar fornecedor' });
    }
});

// Update supplier
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const supplier = await prisma.supplier.update({
            where: { id: req.params.id },
            data: req.body
        });

        res.json(supplier);
    } catch (error) {
        console.error('Update supplier error:', error);
        res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
    }
});

// Delete supplier (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        await prisma.supplier.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

        res.json({ message: 'Fornecedor removido com sucesso' });
    } catch (error) {
        console.error('Delete supplier error:', error);
        res.status(500).json({ error: 'Erro ao remover fornecedor' });
    }
});

// Create purchase order
router.post('/:id/orders', authenticate, async (req: AuthRequest, res) => {
    try {
        const supplierId = req.params.id;
        const { items, expectedDeliveryDate, notes } = req.body;

        const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId }
        });

        if (!supplier) {
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }

        // Generate order number
        const count = await prisma.purchaseOrder.count();
        const orderNumber = `OC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        // Calculate total
        const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0);

        const order = await prisma.purchaseOrder.create({
            data: {
                orderNumber,
                supplierId,
                total,
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                notes,
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        total: item.quantity * item.unitCost
                    }))
                }
            },
            include: {
                items: { include: { product: true } },
                supplier: true
            }
        });

        res.status(201).json(order);
    } catch (error) {
        console.error('Create purchase order error:', error);
        res.status(500).json({ error: 'Erro ao criar ordem de compra' });
    }
});

// Get supplier's purchase orders
router.get('/:id/orders', authenticate, async (req: AuthRequest, res) => {
    try {
        const orders = await prisma.purchaseOrder.findMany({
            where: { supplierId: req.params.id },
            include: {
                items: { include: { product: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        console.error('Get supplier orders error:', error);
        res.status(500).json({ error: 'Erro ao buscar ordens de compra' });
    }
});

// Receive purchase order
router.post('/orders/:orderId/receive', authenticate, async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;
        const { items } = req.body; // Array of { itemId, receivedQty }

        const order = await prisma.purchaseOrder.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order) {
            return res.status(404).json({ error: 'Ordem de compra não encontrada' });
        }

        // Update received quantities and stock
        for (const received of items) {
            const orderItem = order.items.find(i => i.id === received.itemId);
            if (orderItem) {
                // Update order item
                await prisma.purchaseOrderItem.update({
                    where: { id: received.itemId },
                    data: { receivedQty: { increment: received.receivedQty } }
                });

                // Update product stock
                await prisma.product.update({
                    where: { id: orderItem.productId },
                    data: {
                        currentStock: { increment: received.receivedQty },
                        status: 'in_stock'
                    }
                });
            }
        }

        // Check if fully received
        const updatedOrder = await prisma.purchaseOrder.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        const allReceived = updatedOrder?.items.every(i => i.receivedQty >= i.quantity);

        await prisma.purchaseOrder.update({
            where: { id: orderId },
            data: {
                status: allReceived ? 'received' : 'partial',
                receivedDate: allReceived ? new Date() : null
            }
        });

        res.json({ message: 'Itens recebidos com sucesso' });
    } catch (error) {
        console.error('Receive order error:', error);
        res.status(500).json({ error: 'Erro ao receber ordem de compra' });
    }
});

export default router;
