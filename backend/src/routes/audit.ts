import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all audit logs (Admin only) with pagination
router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const {
            entity,
            action,
            userId,
            startDate,
            endDate,
            limit = '50',
            page = '1',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId
        };

        if (entity) where.entity = String(entity);
        if (action) where.action = String(action);
        if (userId) where.userId = String(userId);

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { [sortBy as string]: sortOrder },
                take: limitNum,
                skip: skip
            }),
            prisma.auditLog.count({ where })
        ]);

        res.json({
            data: logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + logs.length < total
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
    }
});

// Get audit log by ID
router.get('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const log = await prisma.auditLog.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });

        if (!log) {
            return res.status(404).json({ error: 'Log não encontrado' });
        }

        res.json(log);
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhe do log' });
    }
});

// Create audit log entry
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { userId, userName, action, entity, entityId, oldData, newData, ipAddress } = req.body;

        const log = await prisma.auditLog.create({
            data: {
                userId: userId || req.userId,
                userName: userName || 'Sistema',
                action,
                entity,
                entityId,
                oldData: oldData || undefined,
                newData: newData || undefined,
                ipAddress: ipAddress || req.ip,
                companyId: req.companyId
            }
        });

        res.status(201).json(log);
    } catch (error) {
        console.error('Create audit log error:', error);
        res.status(500).json({ error: 'Erro ao criar log de auditoria' });
    }
});

export default router;
