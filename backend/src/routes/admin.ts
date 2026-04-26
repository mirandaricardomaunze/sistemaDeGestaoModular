import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';
import { z } from 'zod';
import { clearModuleCache } from '../middleware/module';

const router = Router();

const requireSuperAdmin = (req: AuthRequest, res: any, next: any) => {
    if (req.userRole !== 'super_admin') throw ApiError.forbidden('Apenas super administradores');
    next();
};

// ── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
        totalCompanies,
        activeCompanies,
        inactiveCompanies,
        suspendedCompanies,
        totalUsers,
        activeUsers,
        totalSalesCount,
        totalRevenue,
        recentSales,
        newUsers,
        moduleUsage,
        dbSizeResult,
    ] = await Promise.all([
        prisma.company.count(),
        prisma.company.count({ where: { status: 'active' } }),
        prisma.company.count({ where: { status: 'trial' } }),
        prisma.company.count({ where: { status: 'blocked' } }),
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.sale.count(),
        prisma.sale.aggregate({ _sum: { total: true } }),
        prisma.sale.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.companyModule.groupBy({
            by: ['moduleCode'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        }),
        prisma.$queryRaw<Array<{ size: string }>>`
            SELECT pg_size_pretty(pg_database_size(current_database())) AS size
        `.catch(() => [{ size: 'N/A' }]),
    ]);

    // Get module names from Module table
    const moduleCodes = moduleUsage.map(m => m.moduleCode);
    const modules = await prisma.module.findMany({
        where: { code: { in: moduleCodes } },
        select: { code: true, name: true },
    });
    const moduleNameMap = new Map(modules.map(m => [m.code, m.name]));

    res.json({
        companies: {
            total: totalCompanies,
            active: activeCompanies,
            trial: inactiveCompanies,
            blocked: suspendedCompanies,
        },
        users: {
            total: totalUsers,
            active: activeUsers,
            inactive: totalUsers - activeUsers,
        },
        sales: {
            total: totalSalesCount,
            revenue: Number(totalRevenue._sum?.total || 0),
        },
        modules: moduleUsage.map(m => ({
            moduleCode: m.moduleCode,
            moduleName: moduleNameMap.get(m.moduleCode) || m.moduleCode,
            companiesUsing: (m as any)._count.id,
        })),
        recentActivity: {
            sales: recentSales,
            newUsers,
        },
        system: {
            dbSize: (dbSizeResult as any)[0]?.size || 'N/A',
        },
    });
});

// ── Companies ─────────────────────────────────────────────────────────────────

router.get('/companies', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const status = req.query.status as string | undefined;

    const where: any = {};
    if (search) where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { tradeName: { contains: search, mode: 'insensitive' } },
    ];
    if (status && ['active', 'trial', 'blocked', 'cancelled'].includes(status)) where.status = status;

    const [total, companies] = await Promise.all([
        prisma.company.count({ where }),
        prisma.company.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                _count: { select: { users: true, modules: true } },
                modules: { select: { moduleCode: true, isActive: true } },
                companySettings: { select: { companyName: true, tradeName: true, nuit: true, phone: true, email: true } },
            },
        }),
    ]);

    const data = companies.map(c => ({
        id: c.id,
        name: c.name,
        tradeName: c.tradeName,
        status: c.status,
        createdAt: c.createdAt,
        userCount: c._count.users,
        moduleCount: c._count.modules,
        activeModules: c.modules.filter(m => m.isActive).map(m => ({ code: m.moduleCode, name: m.moduleCode })),
        settings: c.companySettings,
    }));

    res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
});

router.get('/companies/:id', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: {
            _count: { select: { users: true, modules: true, sales: true } },
            modules: true,
            companySettings: true,
            users: {
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLogin: true },
            },
        },
    });
    if (!company) throw ApiError.notFound('Empresa não encontrada');
    res.json(company);
});

router.patch('/companies/:id/status', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const { status } = z.object({ status: z.enum(['active', 'trial', 'blocked', 'cancelled']) }).parse(req.body);
    const updated = await prisma.company.update({ where: { id: req.params.id }, data: { status: status as any } });
    res.json(updated);
});

router.patch('/companies/:id/modules', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const { moduleCode, isActive } = z.object({
        moduleCode: z.string(),
        isActive: z.boolean(),
    }).parse(req.body);

    const mod = await prisma.companyModule.findFirst({
        where: { companyId: req.params.id, moduleCode },
    });

    if (!mod) throw ApiError.notFound('Módulo não encontrado para esta empresa');

    const updated = await prisma.companyModule.update({
        where: { id: mod.id },
        data: { isActive },
    });

    // Invalidate module access cache so the change takes effect immediately
    clearModuleCache(req.params.id);

    res.json(updated);
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const companyId = req.query.companyId as string | undefined;

    const where: any = {};
    if (search) where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
    ];
    if (companyId) where.companyId = companyId;

    const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                lastLogin: true,
                company: { select: { id: true, name: true, status: true } },
            },
        }),
    ]);

    res.json({ data: users, pagination: buildPaginationMeta(page, limit, total) });
});

router.patch('/users/:id/status', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive },
        select: { id: true, name: true, email: true, isActive: true },
    });
    res.json(updated);
});

// ── Activity / Audit ──────────────────────────────────────────────────────────

router.get('/activity', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit)) || 50));
    const skip = (page - 1) * limit;
    const companyId = req.query.companyId as string | undefined;
    const action = req.query.action as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {};
    if (companyId) {
        // AuditLog doesn't have companyId, filter via user's company
        where.user = { companyId };
    }
    if (action) where.action = action;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        company: { select: { name: true } },
                    },
                },
            },
        }),
    ]);

    const data = logs.map(l => ({
        id: l.id,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        timestamp: l.createdAt,
        ipAddress: l.ipAddress,
        user: l.user
            ? {
                  name: l.user.name,
                  email: l.user.email,
                  company: l.user.company,
              }
            : null,
    }));

    res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
});

// ── System Health ─────────────────────────────────────────────────────────────

router.get('/system/health', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const [
        dbResult,
        tableStats,
    ] = await Promise.all([
        prisma.$queryRaw<Array<{ size: string; version: string }>>`
            SELECT
                pg_size_pretty(pg_database_size(current_database())) AS size,
                version() AS version
        `.catch(() => [{ size: 'N/A', version: 'N/A' }]),
        prisma.$queryRaw<Array<{ tablename: string; row_count: bigint }>>`
            SELECT
                relname AS tablename,
                n_live_tup AS row_count
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 15
        `.catch(() => [] as Array<{ tablename: string; row_count: bigint }>),
    ]);

    const db = (dbResult as any)[0] || {};

    res.json({
        status: 'healthy',
        timestamp: new Date(),
        database: {
            size: db.size || 'N/A',
            version: db.version || 'N/A',
            topTables: (tableStats as any[]).map(t => ({
                table: t.tablename,
                rows: Number(t.row_count),
            })),
        },
        process: {
            uptime: Math.floor(process.uptime()),
            memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            nodeVersion: process.version,
        },
    });
});

// ── Revenue Overview ──────────────────────────────────────────────────────────

router.get('/revenue', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days)) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byCompany, byDay] = await Promise.all([
        prisma.sale.groupBy({
            by: ['companyId'],
            where: { createdAt: { gte: since } },
            _sum: { total: true },
            _count: { id: true },
            orderBy: { _sum: { total: 'desc' } },
        }),
        prisma.$queryRaw<Array<{ day: string; revenue: number; count: bigint }>>`
            SELECT
                DATE(created_at) AS day,
                SUM(total)::float AS revenue,
                COUNT(*) AS count
            FROM sales
            WHERE created_at >= ${since}
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        `.catch(() => []),
    ]);

    const companyIds = byCompany.map(r => r.companyId).filter((id): id is string => id !== null);
    const companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
    });
    const nameMap = new Map(companies.map(c => [c.id, c.name]));

    res.json({
        period: { days, since },
        byCompany: byCompany.map(r => ({
            companyId: r.companyId,
            companyName: (r.companyId ? nameMap.get(r.companyId) : null) || 'Desconhecida',
            revenue: Number(r._sum?.total || 0),
            salesCount: (r as any)._count.id,
        })),
        byDay: (byDay as any[]).map(d => ({
            day: d.day,
            revenue: Number(d.revenue),
            count: Number(d.count),
        })),
    });
});

export default router;
