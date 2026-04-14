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
        prisma.auditLog.findMany({ 
            where: { companyId: req.companyId }, 
            include: { user: { select: { name: true, email: true } } },
            skip, 
            take: Number(limit), 
            orderBy: { createdAt: 'desc' } 
        }),
        prisma.auditLog.count({ where: { companyId: req.companyId } })
    ]);

    res.json({ data: logs, pagination: buildPaginationMeta(Number(page), Number(limit), total) });
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const { action, entity, entityId, oldData, newData, ipAddress, userAgent, userName } = req.body;

    const log = await prisma.auditLog.create({
        data: {
            action,
            entity,
            entityId,
            oldData,
            newData,
            ipAddress,
            userAgent,
            userName: userName || req.userName,
            userId: req.userId,
            companyId: req.companyId
        }
    });

    res.status(201).json(log);
});

export default router;
