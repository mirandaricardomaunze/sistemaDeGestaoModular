import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const alerts = await prisma.alert.findMany({
        where: { companyId: req.companyId },
        orderBy: [{ isResolved: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
        take: 50
    });
    res.json(alerts);
});

router.patch('/:id/resolve', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await prisma.alert.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: { isResolved: true, resolvedAt: new Date() }
    });
    if (result.count === 0) throw ApiError.notFound('Alerta não encontrado');
    res.json({ message: 'Alerta resolvido' });
});

export default router;
