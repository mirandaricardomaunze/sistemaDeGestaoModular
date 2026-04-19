import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

const requireSuperAdmin = (req: AuthRequest, res: any, next: any) => {
    if (req.userRole !== 'super_admin') throw ApiError.forbidden('Apenas super administradores');
    next();
};

router.get('/stats', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const [companies, users, sales] = await Promise.all([
        prisma.company.count(),
        prisma.user.count(),
        prisma.sale.aggregate({ _sum: { total: true } })
    ]);
    res.json({ companies, users, revenue: sales._sum?.total || 0 });
});

router.get('/companies', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const companies = await prisma.company.findMany({ include: { _count: { select: { users: true } } } });
    res.json(companies);
});

router.get('/companies/:id', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { users: true, modules: true } }, modules: true }
    });
    if (!company) throw ApiError.notFound('Empresa não encontrada');
    res.json(company);
});

router.patch('/companies/:id/status', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const { status } = req.body;
    const allowed = ['active', 'suspended', 'inactive'];
    if (!allowed.includes(status)) throw ApiError.badRequest(`status deve ser um de: ${allowed.join(', ')}`);
    const updated = await prisma.company.update({ where: { id: req.params.id }, data: { status } });
    res.json(updated);
});

router.get('/users', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true } } }
    });
    const { password: _pw, otp: _otp, ...rest } = users[0] ?? {};
    res.json(users.map(({ password, otp, ...u }) => u));
});

router.get('/activity', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { id: true, name: true, email: true } } }
    });
    res.json(logs);
});

export default router;
