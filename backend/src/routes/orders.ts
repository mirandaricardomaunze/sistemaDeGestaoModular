import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createOrderSchema,
    updateOrderStatusSchema,
    formatZodError,
    ZodError
} from '../validation';

const router = Router();

// Get all orders with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            status,
            priority,
            page = '1',
            limit = '20',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId
        };
        if (status && status !== 'all') where.status = status;
        if (priority && priority !== 'all') where.priority = priority;

        // Get total count
        const total = await prisma.customerOrder.count({ where });

        // Get paginated orders
        const orders = await prisma.customerOrder.findMany({
            where,
            include: {
                items: true,
                transitions: {
                    orderBy: { timestamp: 'asc' }
                }
            },
            orderBy: { [sortBy as string]: sortOrder },
            skip,
            take: limitNum
        });

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
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Erro ao buscar encomendas' });
    }
});

// Get order by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const order = await prisma.customerOrder.findFirst({
            where: { id: req.params.id, companyId: req.companyId },
            include: {
                items: true,
                transitions: {
                    orderBy: { timestamp: 'asc' }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Erro ao buscar encomenda' });
    }
});

// Create order
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        // Validate request body
        const validatedData = createOrderSchema.parse(req.body);
        const {
            customerName,
            customerPhone,
            customerAddress,
            items,
            total,
            deliveryDate,
            notes,
            paymentMethod
        } = validatedData;

        // Generate order number
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.customerOrder.count();
        const orderNumber = `ENC-${dateStr}-${String(count + 1).padStart(4, '0')}`;

        const order = await prisma.customerOrder.create({
            data: {
                orderNumber,
                customerName,
                customerPhone,
                customerAddress,
                total,
                priority: 'normal',
                paymentMethod,
                deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
                notes,
                companyId: req.companyId, // Multi-tenancy isolation
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        productName: '', // Will be filled from product lookup if needed
                        quantity: item.quantity,
                        price: item.unitPrice,
                        total: item.quantity * item.unitPrice
                    }))
                },
                transitions: {
                    create: {
                        status: 'created',
                        responsibleName: 'Sistema'
                    }
                }
            },
            include: {
                items: true,
                transitions: true
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
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Erro ao criar encomenda' });
    }
});

// Update order status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        // Validate request body
        const validatedData = updateOrderStatusSchema.parse(req.body);
        const { status, responsibleName, notes } = validatedData;

        // Verify ownership before status update
        const existing = await prisma.customerOrder.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        const order = await prisma.customerOrder.update({
            where: { id: req.params.id },
            data: {
                status,
                transitions: {
                    create: {
                        status,
                        responsibleName: responsibleName || 'Sistema',
                        notes
                    }
                }
            },
            include: {
                items: true,
                transitions: {
                    orderBy: { timestamp: 'asc' }
                }
            }
        });

        res.json(order);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Erro ao atualizar status da encomenda' });
    }
});

// Update order
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            customerName,
            customerPhone,
            customerEmail,
            customerAddress,
            priority,
            paymentMethod,
            deliveryDate,
            notes
        } = req.body;

        // Verify ownership before update
        const existing = await prisma.customerOrder.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        const order = await prisma.customerOrder.update({
            where: { id: req.params.id },
            data: {
                customerName,
                customerPhone,
                customerEmail,
                customerAddress,
                priority,
                paymentMethod,
                deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
                notes
            },
            include: {
                items: true,
                transitions: {
                    orderBy: { timestamp: 'asc' }
                }
            }
        });

        res.json(order);
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Erro ao atualizar encomenda' });
    }
});

// Delete order
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.customerOrder.deleteMany({
            where: { id: req.params.id, companyId: req.companyId }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        res.json({ message: 'Encomenda eliminada com sucesso' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ error: 'Erro ao eliminar encomenda' });
    }
});

export default router;
