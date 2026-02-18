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

export default router;
