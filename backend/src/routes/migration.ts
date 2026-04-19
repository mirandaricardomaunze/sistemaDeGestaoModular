import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// Migration endpoints require admin JWT -- never expose unauthenticated
router.post('/migrate-users-to-default-company', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    const defaultCompany = await prisma.company.findFirst({ where: { status: 'active' } });
    if (!defaultCompany) throw ApiError.notFound('Nenhuma empresa ativa encontrada');

    const result = await prisma.user.updateMany({
        where: { companyId: null },
        data: { companyId: defaultCompany.id }
    });

    res.json({ message: 'Migração concluída', count: result.count });
});

export default router;
