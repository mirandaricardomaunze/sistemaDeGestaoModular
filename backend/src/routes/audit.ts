import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';

const router = Router();

router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({ where: { companyId: req.companyId }, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
        prisma.auditLog.count({ where: { companyId: req.companyId } })
    ]);

    res.json({ data: logs, pagination: buildPaginationMeta(total, Number(page), Number(limit)) });
});

export default router;
