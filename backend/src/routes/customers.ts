import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createCustomerSchema,
    updateCustomerSchema,
    updateCustomerBalanceSchema,
    formatZodError
} from '../utils/validation';
import { ZodError } from 'zod';

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
        // Validate request body
        const validatedData = createCustomerSchema.parse(req.body);

        // Generate code if not provided
        const customerCode = validatedData.code || `CLI-${Date.now().toString().slice(-6)}`;

        // Extract the validated data and remove code to avoid duplication
        const { code, ...customerData } = validatedData;

        const customer = await prisma.customer.create({
            data: {
                ...customerData,
                code: customerCode,
                phone: customerData.phone || '', // Ensure phone is not null
                // Use connect syntax for company relation
                ...(req.companyId ? { company: { connect: { id: req.companyId } } } : {})
            }
        });

        res.status(201).json(customer);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Erro ao criar cliente' });
    }
});

// Update customer
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        // Validate request body
        const validatedData = updateCustomerSchema.parse(req.body);

        // Filter out null values for non-nullable fields (phone is required in schema)
        const updateData: any = {};
        for (const [key, value] of Object.entries(validatedData)) {
            if (value !== null) {
                updateData[key] = value;
            }
        }

        const customer = await prisma.customer.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: updateData
        });

        if (customer.count === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado' });
        }

        const updated = await prisma.customer.findUnique({ where: { id: req.params.id } });
        res.json(updated);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
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

// Get customer purchase history with pagination
router.get('/:id/purchases', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            startDate,
            endDate,
            page = '1',
            limit = '10'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            customerId: req.params.id,
            customer: { companyId: req.companyId } // Multi-tenancy isolation
        };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        // Get total count and paginated sales in parallel
        const [total, sales] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.findMany({
                where,
                include: {
                    items: {
                        include: { product: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: sales,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + sales.length < total
            }
        });
    } catch (error) {
        console.error('Get customer purchases error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de compras' });
    }
});

// Update customer balance
router.patch('/:id/balance', authenticate, async (req: AuthRequest, res) => {
    try {
        // Validate request body
        const { amount, operation } = updateCustomerBalanceSchema.parse(req.body);

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
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('Update customer balance error:', error);
        res.status(500).json({ error: 'Erro ao atualizar saldo do cliente' });
    }
});

export default router;
