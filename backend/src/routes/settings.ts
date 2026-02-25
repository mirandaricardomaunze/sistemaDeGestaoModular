import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/company', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const settings = await prisma.companySettings.findFirst({ where: { companyId: req.companyId } });
    if (!settings) {
        return res.json(await prisma.companySettings.create({
            data: { companyName: 'Minha Empresa', country: 'Moçambique', currency: 'MZN', companyId: req.companyId }
        }));
    }
    res.json(settings);
});

router.put('/company', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const settings = await prisma.companySettings.upsert({
        where: { companyId: req.companyId },
        update: req.body,
        create: { ...req.body, companyId: req.companyId }
    });
    res.json(settings);
});

// Category Management
router.get('/categories', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const categories = await prisma.category.findMany({
        where: { companyId: req.companyId },
        include: { _count: { select: { children: true } } },
        orderBy: { name: 'asc' }
    });
    res.json(categories);
});

router.post('/categories', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { name, description, code, parentId, color } = req.body;

    const category = await prisma.category.create({
        data: {
            name,
            description,
            code: code || `CAT-${Date.now()}`,
            parentId,
            color,
            companyId: req.companyId
        }
    });
    res.json(category);
});

router.put('/categories/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const category = await prisma.category.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: req.body
    });
    if (category.count === 0) throw ApiError.notFound('Categoria não encontrada');
    res.json({ message: 'Categoria atualizada' });
});

router.delete('/categories/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const category = await prisma.category.deleteMany({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (category.count === 0) throw ApiError.notFound('Categoria não encontrada');
    res.json({ message: 'Categoria removida' });
});

// Alert Configuration
router.get('/alert-config', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    let config = await prisma.alertConfig.findUnique({ where: { companyId: req.companyId } });
    if (!config) {
        config = await prisma.alertConfig.create({
            data: { companyId: req.companyId }
        });
    }
    res.json(config);
});

router.put('/alert-config', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const config = await prisma.alertConfig.upsert({
        where: { companyId: req.companyId },
        update: req.body,
        create: { ...req.body, companyId: req.companyId }
    });
    res.json(config);
});

export default router;
