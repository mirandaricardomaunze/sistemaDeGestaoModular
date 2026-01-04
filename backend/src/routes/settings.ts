import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Get company settings
router.get('/company', authenticate, async (req: AuthRequest, res) => {
    try {
        let settings = await prisma.companySettings.findFirst();

        if (!settings) {
            // Create default settings
            settings = await prisma.companySettings.create({
                data: {
                    companyName: 'Minha Empresa',
                    tradeName: 'Minha Empresa',
                    country: 'Moçambique',
                    currency: 'MZN',
                    ivaRate: 16
                }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Get company settings error:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// Update company settings
router.put('/company', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.companySettings.findFirst();

        const allowedFields = [
            'companyName', 'tradeName', 'nuit', 'phone', 'email',
            'address', 'city', 'province', 'country', 'logo',
            'ivaRate', 'currency', 'businessType'
        ];

        const updateData: any = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        // Ensure numeric ivaRate
        if (updateData.ivaRate !== undefined) {
            updateData.ivaRate = Number(updateData.ivaRate);
        }

        let settings;
        if (existing) {
            settings = await prisma.companySettings.update({
                where: { id: existing.id },
                data: updateData
            });
        } else {
            settings = await prisma.companySettings.create({
                data: updateData
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Update company settings error:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
});

// ============================================================================
// Alert Configuration
// ============================================================================

// Get alert configuration
router.get('/alert-config', authenticate, async (req: AuthRequest, res) => {
    try {
        let config = await prisma.alertConfig.findFirst();

        if (!config) {
            // Create default config
            config = await prisma.alertConfig.create({
                data: {
                    lowStockThreshold: 10,
                    expiryWarningDays: 30,
                    paymentDueDays: 7,
                    enableEmailAlerts: true,
                    enablePushNotifications: true,
                }
            });
        }

        res.json(config);
    } catch (error) {
        console.error('Get alert config error:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração de alertas' });
    }
});

// Update alert configuration
router.put('/alert-config', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.alertConfig.findFirst();

        let config;
        if (existing) {
            config = await prisma.alertConfig.update({
                where: { id: existing.id },
                data: req.body
            });
        } else {
            config = await prisma.alertConfig.create({
                data: req.body
            });
        }

        res.json(config);
    } catch (error) {
        console.error('Update alert config error:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração de alertas' });
    }
});

// Get all categories
router.get('/categories', authenticate, async (req: AuthRequest, res) => {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            include: {
                parent: { select: { id: true, name: true } },
                children: { select: { id: true, name: true } }
            },
            orderBy: { name: 'asc' }
        });

        // Get product counts per category (ProductCategory enum)
        const productCounts = await prisma.product.groupBy({
            by: ['category'],
            where: { isActive: true },
            _count: { id: true }
        });

        // Create a map of category enum value to product count
        const countMap: Record<string, number> = {};
        productCounts.forEach(pc => {
            // pc.category is ProductCategory enum (e.g., 'electronics', 'food')
            countMap[pc.category] = pc._count.id;
        });

        // Mapping from Portuguese category names to ProductCategory enum
        const categoryNameToEnum: Record<string, string> = {
            'eletrónicos': 'electronics',
            'eletronicos': 'electronics',
            'electrónicos': 'electronics',
            'electronics': 'electronics',
            'alimentos': 'food',
            'comida': 'food',
            'food': 'food',
            'medicamentos': 'medicine',
            'medicina': 'medicine',
            'medicine': 'medicine',
            'vestuário': 'clothing',
            'vestuario': 'clothing',
            'roupas': 'clothing',
            'clothing': 'clothing',
            'móveis': 'furniture',
            'moveis': 'furniture',
            'furniture': 'furniture',
            'cosméticos': 'cosmetics',
            'cosmeticos': 'cosmetics',
            'cosmetics': 'cosmetics',
            'bebidas': 'beverages',
            'beverages': 'beverages',
            'limpeza': 'cleaning',
            'cleaning': 'cleaning',
            'escritório': 'office',
            'escritorio': 'office',
            'office': 'office',
            'outros': 'other',
            'other': 'other',
        };

        // Map categories - match by name to enum
        const result = categories.map(cat => {
            const nameLower = cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const enumValue = categoryNameToEnum[nameLower] || cat.code;
            const productCount = countMap[enumValue] || 0;
            return {
                ...cat,
                productCount
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
});

// Create category
router.post('/categories', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const code = req.body.code || `CAT-${Date.now().toString().slice(-6)}`;

        const { name, description, color, parentId } = req.body;

        const category = await prisma.category.create({
            data: {
                code,
                name,
                description,
                color,
                parentId
            }
        });

        res.status(201).json({ ...category, productCount: 0 });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Erro ao criar categoria' });
    }
});

// Update category
router.put('/categories/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const category = await prisma.category.update({
            where: { id: req.params.id },
            data: req.body
        });

        // For now return 0, ideally we should fetch the count again or return the existing count if not modified
        res.json({ ...category, productCount: 0 });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
});

// Delete category
router.delete('/categories/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        await prisma.category.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

        res.json({ message: 'Categoria removida' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Erro ao remover categoria' });
    }
});

// Get audit logs
router.get('/audit-logs', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { entity, userId, startDate, endDate, limit = 100 } = req.query;

        const where: any = {};
        if (entity) where.entity = entity;
        if (userId) where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(String(limit))
        });

        res.json(logs);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
    }
});

// Create audit log (internal use)
router.post('/audit-logs', authenticate, async (req: AuthRequest, res) => {
    try {
        const log = await prisma.auditLog.create({
            data: {
                ...req.body,
                userId: req.userId
            }
        });

        res.status(201).json(log);
    } catch (error) {
        console.error('Create audit log error:', error);
        res.status(500).json({ error: 'Erro ao criar log' });
    }
});

// System statistics
router.get('/stats', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const [
            usersCount,
            productsCount,
            customersCount,
            suppliersCount,
            employeesCount,
            salesCount,
            invoicesCount,
            warehousesCount
        ] = await Promise.all([
            prisma.user.count(),
            prisma.product.count({ where: { isActive: true } }),
            prisma.customer.count({ where: { isActive: true } }),
            prisma.supplier.count({ where: { isActive: true } }),
            prisma.employee.count({ where: { isActive: true } }),
            prisma.sale.count(),
            prisma.invoice.count(),
            prisma.warehouse.count({ where: { isActive: true } })
        ]);

        res.json({
            users: usersCount,
            products: productsCount,
            customers: customersCount,
            suppliers: suppliersCount,
            employees: employeesCount,
            sales: salesCount,
            invoices: invoicesCount,
            warehouses: warehousesCount
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Backup (simplified - just returns data counts)
router.get('/backup/info', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const counts = {
            users: await prisma.user.count(),
            products: await prisma.product.count(),
            customers: await prisma.customer.count(),
            suppliers: await prisma.supplier.count(),
            employees: await prisma.employee.count(),
            sales: await prisma.sale.count(),
            invoices: await prisma.invoice.count(),
            warehouses: await prisma.warehouse.count(),
            lastBackup: null // Would be tracked separately
        };

        res.json(counts);
    } catch (error) {
        console.error('Get backup info error:', error);
        res.status(500).json({ error: 'Erro ao buscar informações de backup' });
    }
});

export default router;
