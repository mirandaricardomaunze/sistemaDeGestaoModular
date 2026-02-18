import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.post('/migrate-users-to-default-company', async (req, res) => {
    const defaultCompany = await prisma.company.findFirst({ where: { status: 'active' } });
    if (!defaultCompany) throw ApiError.notFound('Nenhuma empresa ativa encontrada');

    const result = await prisma.user.updateMany({
        where: { companyId: null },
        data: { companyId: defaultCompany.id }
    });

    res.json({ message: 'Migração concluída', count: result.count });
});

export default router;
