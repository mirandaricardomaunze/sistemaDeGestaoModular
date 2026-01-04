import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all customers with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            search,
            type,
            isActive,
            page = '1',
            limit = '20',
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { phone: { contains: String(search) } },
                { email: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        if (type) {
            where.type = type;
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        // Get total count
        const total = await prisma.customer.count({ where });

        // Get paginated customers
        const customers = await prisma.customer.findMany({
            where,
            orderBy: { [sortBy as string]: sortOrder },
            skip,
            take: limitNum
        });

        res.json({
            data: customers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + customers.length < total
            }
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
});

// Get customer by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: req.params.id },
            include: {
                sales: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                },
                invoices: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        res.json(customer);
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
});

// Create customer
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            code, name, type, email, phone, document,
            address, city, province, notes, creditLimit
        } = req.body;

        // Generate code if not provided
        const customerCode = code || `CLI-${Date.now().toString().slice(-6)}`;

        const customer = await prisma.customer.create({
            data: {
                code: customerCode,
                name,
                type: type || 'individual',
                email,
                phone,
                document,
                address,
                city,
                province,
                notes,
                creditLimit: creditLimit || null
            }
        });

        res.status(201).json(customer);
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Erro ao criar cliente' });
    }
});

// Update customer
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const customer = await prisma.customer.update({
            where: { id: req.params.id },
            data: req.body
        });

        res.json(customer);
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
});

// Delete customer (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        await prisma.customer.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

        res.json({ message: 'Cliente removido com sucesso' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Erro ao remover cliente' });
    }
});

// Get customer purchase history
router.get('/:id/purchases', authenticate, async (req: AuthRequest, res) => {
    try {
        const { startDate, endDate } = req.query;

        const where: any = { customerId: req.params.id };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        const sales = await prisma.sale.findMany({
            where,
            include: {
                items: {
                    include: { product: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(sales);
    } catch (error) {
        console.error('Get customer purchases error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de compras' });
    }
});

// Update customer balance
router.patch('/:id/balance', authenticate, async (req: AuthRequest, res) => {
    try {
        const { amount, operation } = req.body;

        const customer = await prisma.customer.findUnique({
            where: { id: req.params.id }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        let newBalance = Number(customer.currentBalance);

        if (operation === 'add') {
            newBalance += amount;
        } else if (operation === 'subtract') {
            newBalance -= amount;
        } else if (operation === 'set') {
            newBalance = amount;
        }

        const updated = await prisma.customer.update({
            where: { id: req.params.id },
            data: { currentBalance: newBalance }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update customer balance error:', error);
        res.status(500).json({ error: 'Erro ao atualizar saldo do cliente' });
    }
});

export default router;
