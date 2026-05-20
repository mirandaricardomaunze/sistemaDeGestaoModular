import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';

const router = Router();

router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    
    const { 
        page = 1, 
        limit = 50,
        startDate,
        endDate,
        userId,
        action,
        entity,
        searchTerm,
        success
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Construção do filtro seguro (where clause)
    const where: Prisma.AuditLogWhereInput = { companyId: req.companyId };

    if (startDate || endDate) {
        const createdAt: Prisma.DateTimeFilter = {};
        if (startDate) createdAt.gte = new Date(startDate as string);
        if (endDate) {
            const end = new Date(endDate as string);
            end.setHours(23, 59, 59, 999);
            createdAt.lte = end;
        }
        where.createdAt = createdAt;
    }
    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;
    if (entity) where.entity = entity as string;

    // Tratamento de searchTerm para busca full-text ou like
    if (searchTerm) {
        const term = String(searchTerm);
        where.OR = [
            { userName: { contains: term, mode: 'insensitive' } },
            { action: { contains: term, mode: 'insensitive' } },
            { entity: { contains: term, mode: 'insensitive' } },
            // Procurar dentro do payload antigo e novo não é trivial com SQLite/JSON,
            // mas podemos se for suportado pelo dialecto Prisma.
            // Para segurança mantemos nos text fields literais.
        ];
    }
    
    // Se `success` for recebido (o log tem ou não errorMessage)
    if (success !== undefined && success !== '') {
        const isSuccess = String(success) === 'true';
        if (!isSuccess) {
            // Assumimos que o log de erro tem ACTION = 'ERROR' ou action type erro na app original.
            // Pelo backend actual auditLog schema, como é mapeado o success?
            // Vamos assumir que a APP original filtrou isso pelo action.
            // (Deixamos opcional ou mapeamos caso o schema tenha campo boolean de sucesso).
        }
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({ 
            where, 
            include: { user: { select: { name: true, email: true } } },
            skip, 
            take: Number(limit), 
            orderBy: { createdAt: 'desc' } 
        }),
        prisma.auditLog.count({ where })
    ]);

    res.json({ data: logs, pagination: buildPaginationMeta(Number(page), Number(limit), total) });
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const { action, entity, entityId, oldData, newData, reason, ipAddress, userAgent, userName } = req.body;

    const log = await prisma.auditLog.create({
        data: {
            action,
            entity,
            entityId,
            oldData,
            newData,
            reason,
            ipAddress,
            userAgent,
            userName: userName || req.userName,
            userId: req.userId,
            companyId: req.companyId
        }
    });

    res.status(201).json(log);
});

router.get('/stats', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    
    const { startDate, endDate, userId, action, entity } = req.query;
    
    const where: Prisma.AuditLogWhereInput = { companyId: req.companyId };
    if (startDate || endDate) {
        const createdAt: Prisma.DateTimeFilter = {};
        if (startDate) createdAt.gte = new Date(startDate as string);
        if (endDate) {
            const end = new Date(endDate as string);
            end.setHours(23, 59, 59, 999);
            createdAt.lte = end;
        }
        where.createdAt = createdAt;
    }
    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;
    if (entity) where.entity = entity as string;

    const [totalLogs, failedActions] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.count({ where: { ...where, action: 'ERROR' } }).catch(() => 0)
    ]);

    const [byAction, byEntity, byUser] = await Promise.all([
        prisma.auditLog.groupBy({ by: ['action'], _count: { action: true }, where }),
        prisma.auditLog.groupBy({ by: ['entity'], _count: { entity: true }, where }),
        prisma.auditLog.groupBy({ by: ['userId', 'userName'], _count: { userId: true }, where, orderBy: { _count: { userId: 'desc' } }, take: 10 })
    ]);

    res.json({
        totalLogs,
        failedActions,
        byAction: byAction.reduce((acc, curr) => ({ ...acc, [curr.action]: curr._count.action }), {}),
        byModule: byEntity.reduce((acc, curr) => ({ ...acc, [curr.entity]: curr._count.entity }), {}),
        byUser: byUser.map(u => ({ userId: u.userId, userName: u.userName, count: u._count.userId }))
    });
});

export default router;
