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

        const where: any = {
            companyId: req.companyId // Multi-tenancy isolation
        };

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
        const customer = await prisma.customer.findFirst({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
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
                ...req.body,
                code: customerCode,
                companyId: req.companyId, // Multi-tenancy isolation
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
        const customer = await prisma.customer.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: req.body
        });

        if (customer.count === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado' });
        }

        const updated = await prisma.customer.findUnique({ where: { id: req.params.id } });
        res.json(updated);
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
});

// Delete customer (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.customer.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: { isActive: false }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado' });
        }

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

        const where: any = {
            customerId: req.params.id,
            customer: { companyId: req.companyId } // Multi-tenancy isolation
        };

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

        const customer = await prisma.customer.findFirst({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            }
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

        const updated = await prisma.customer.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: { currentBalance: newBalance }
        });

        if (updated.count === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado' });
        }

        const result = await prisma.customer.findUnique({ where: { id: req.params.id } });
        res.json(result);
    } catch (error) {
        console.error('Update customer balance error:', error);
        res.status(500).json({ error: 'Erro ao atualizar saldo do cliente' });
    }
});

export default router;
