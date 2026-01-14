import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createSupplierSchema,
    updateSupplierSchema,
    createPurchaseOrderSchema,
    receivePurchaseOrderSchema,
    formatZodError,
    ZodError
} from '../validation';

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
        const supplier = await prisma.supplier.findFirst({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
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
        // Validate request body
        const validatedData = createSupplierSchema.parse(req.body);

        const code = validatedData.code || `FOR-${Date.now().toString().slice(-6)}`;

        const supplier = await prisma.supplier.create({
            data: {
                ...validatedData,
                code,
                phone: validatedData.phone || '', // Ensure phone is not null
                companyId: req.companyId // Multi-tenancy isolation
            } as any
        });

        res.status(201).json(supplier);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('Create supplier error:', error);
        res.status(500).json({ error: 'Erro ao criar fornecedor' });
    }
});

// Update supplier
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        // Validate request body
        const validatedData = updateSupplierSchema.parse(req.body);

        // Filter out null values for non-nullable fields
        const updateData: any = {};
        for (const [key, value] of Object.entries(validatedData)) {
            if (value !== null) {
                updateData[key] = value;
            }
        }

        const supplier = await prisma.supplier.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: updateData
        });

        if (supplier.count === 0) {
            return res.status(404).json({ error: 'Fornecedor não encontrado ou acesso negado' });
        }

        const updated = await prisma.supplier.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        res.json(updated);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('Update supplier error:', error);
        res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
    }
});

// Delete supplier (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.supplier.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: { isActive: false }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Fornecedor não encontrado ou acesso negado' });
        }

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

        // Validate request body
        const validatedData = createPurchaseOrderSchema.parse(req.body);
        const { items, expectedDeliveryDate, notes } = validatedData;

        const supplier = await prisma.supplier.findFirst({
            where: {
                id: supplierId,
                companyId: req.companyId // Multi-tenancy isolation
            }
        });

        if (!supplier) {
            return res.status(404).json({ error: 'Fornecedor não encontrado ou acesso negado' });
        }

        // Generate order number (per company ideally, but global unique is fine)
        const count = await prisma.purchaseOrder.count({
            where: { supplier: { companyId: req.companyId } }
        });
        const orderNumber = `OC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        // Calculate total
        const total = items.reduce((sum: number, item) => sum + (item.quantity * (item.unitCost || 0)), 0);

        const order = await prisma.purchaseOrder.create({
            data: {
                orderNumber,
                supplierId,
                total,
                companyId: req.companyId, // Multi-tenancy isolation
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                notes,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitCost: item.unitCost || 0,
                        total: item.quantity * (item.unitCost || 0)
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
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('Create purchase order error:', error);
        res.status(500).json({ error: 'Erro ao criar ordem de compra' });
    }
});

// Get supplier's purchase orders with pagination
router.get('/:id/orders', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            page = '1',
            limit = '10'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            supplierId: req.params.id,
            supplier: { companyId: req.companyId } // Multi-tenancy isolation
        };

        // Get total count and paginated orders in parallel
        const [total, orders] = await Promise.all([
            prisma.purchaseOrder.count({ where }),
            prisma.purchaseOrder.findMany({
                where,
                include: {
                    items: { include: { product: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: orders,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + orders.length < total
            }
        });
    } catch (error) {
        console.error('Get supplier orders error:', error);
        res.status(500).json({ error: 'Erro ao buscar ordens de compra' });
    }
});

// Receive purchase order
router.post('/orders/:orderId/receive', authenticate, async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;

        // Validate request body
        const validatedData = receivePurchaseOrderSchema.parse(req.body);
        const { items } = validatedData;

        const order = await prisma.purchaseOrder.findFirst({
            where: {
                id: orderId,
                supplier: { companyId: req.companyId } // Multi-tenancy isolation
            },
            include: { items: true }
        });

        if (!order) {
            return res.status(404).json({ error: 'Ordem de compra não encontrada ou acesso negado' });
        }

        // Update received quantities and stock
        for (const received of items) {
            const orderItem = order.items.find(i => i.id === received.itemId);
            if (orderItem) {
                // Update order item
                await prisma.purchaseOrderItem.updateMany({
                    where: {
                        id: received.itemId,
                        purchaseOrder: { companyId: req.companyId }
                    },
                    data: { receivedQty: { increment: received.receivedQty } }
                });

                // Update product stock
                await prisma.product.updateMany({
                    where: {
                        id: orderItem.productId,
                        companyId: req.companyId
                    },
                    data: {
                        currentStock: { increment: received.receivedQty },
                        status: 'in_stock'
                    }
                });
            }
        }

        // Check if fully received
        const updatedOrder = await prisma.purchaseOrder.findFirst({
            where: { id: orderId, companyId: req.companyId },
            include: { items: true }
        });

        const allReceived = updatedOrder?.items.every(i => i.receivedQty >= i.quantity);

        await prisma.purchaseOrder.updateMany({
            where: {
                id: orderId,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: {
                status: allReceived ? 'received' : 'partial',
                receivedDate: allReceived ? new Date() : null
            }
        });

        res.json({ message: 'Itens recebidos com sucesso' });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('Receive order error:', error);
        res.status(500).json({ error: 'Erro ao receber ordem de compra' });
    }
});

export default router;
