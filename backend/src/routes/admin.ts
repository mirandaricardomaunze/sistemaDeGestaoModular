import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { updateCompanyStatusSchema, formatZodError, ZodError } from '../validation';

const router = Router();

// Middleware to check super_admin role
const requireSuperAdmin = (req: AuthRequest, res: any, next: any) => {
    if (req.userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas super administradores.' });
    }
    next();
};

// Get global system statistics
router.get('/stats', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        // Get companies stats
        const totalCompanies = await prisma.company.count();
        const activeCompanies = await prisma.company.count({
            where: { status: 'active' }
        });

        // Get users stats
        const totalUsers = await prisma.user.count();
        const activeUsers = await prisma.user.count({
            where: { isActive: true }
        });

        // Get sales stats (all companies)
        const totalSales = await prisma.sale.count();
        const totalRevenue = await prisma.sale.aggregate({
            _sum: { total: true }
        });

        // Get module usage stats
        const moduleUsage = await prisma.companyModule.groupBy({
            by: ['moduleCode'],
            _count: { moduleCode: true },
            where: { isActive: true }
        });

        // Get module details - moduleCode is stored directly
        const moduleStats = moduleUsage.map(mu => ({
            moduleCode: mu.moduleCode,
            moduleName: mu.moduleCode,
            companiesUsing: mu._count?.moduleCode || 0
        }));

        // Recent activity - last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentSales = await prisma.sale.count({
            where: {
                createdAt: { gte: sevenDaysAgo }
            }
        });

        const recentUsers = await prisma.user.count({
            where: {
                createdAt: { gte: sevenDaysAgo }
            }
        });

        // Get database size (PostgreSQL specific)
        const dbSizeResult: any = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
        const dbSize = dbSizeResult[0]?.size || 'N/A';

        res.json({
            companies: {
                total: totalCompanies,
                active: activeCompanies,
                inactive: totalCompanies - activeCompanies
            },
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: totalUsers - activeUsers
            },
            sales: {
                total: totalSales,
                revenue: totalRevenue._sum?.total || 0
            },
            modules: moduleStats,
            recentActivity: {
                sales: recentSales,
                newUsers: recentUsers
            },
            system: {
                dbSize: dbSize
            }
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: 'Erro ao carregar estatísticas' });
    }
});

// Get all companies
router.get('/companies', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        const companies = await prisma.company.findMany({
            include: {
                _count: {
                    select: {
                        users: true,
                        modules: true
                    }
                },
                modules: {
                    where: { isActive: true },
                    select: {
                        moduleCode: true,
                        isActive: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const companiesWithDetails = companies.map(company => ({
            id: company.id,
            name: company.name,
            tradeName: company.tradeName,
            nuit: company.nuit,
            email: company.email,
            phone: company.phone,
            address: company.address,
            status: company.status,
            createdAt: company.createdAt,
            userCount: company._count.users,
            moduleCount: company._count.modules,
            activeModules: company.modules.map(cm => ({
                code: cm.moduleCode,
                name: cm.moduleCode
            }))
        }));

        res.json(companiesWithDetails);
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ error: 'Erro ao carregar empresas' });
    }
});

// Get company by ID with full details
router.get('/companies/:id', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        isActive: true,
                        lastLogin: true,
                        createdAt: true
                    }
                },
                modules: {
                    select: {
                        moduleCode: true,
                        isActive: true,
                        expiresAt: true
                    }
                },
                _count: {
                    select: {
                        pharmacySales: true,
                        products: true,
                        customers: true
                    }
                }
            }
        });

        if (!company) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }

        res.json({
            ...company,
            stats: {
                totalSales: (company as any)._count.pharmacySales,
                totalProducts: (company as any)._count.products,
                totalCustomers: (company as any)._count.customers
            }
        });
    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Erro ao carregar empresa' });
    }
});

// Toggle company status
router.patch('/companies/:id/status', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const validatedData = updateCompanyStatusSchema.parse(req.body);
        const { status } = validatedData;

        const company = await prisma.company.update({
            where: { id },
            data: { status }
        });

        // Log the action
        import('../middleware/audit').then(({ logAudit }) => {
            logAudit({
                userId: req.userId,
                action: 'COMPANY_STATUS_CHANGE',
                entity: 'company',
                entityId: id,
                newData: { status },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        });

        res.json({
            message: `Empresa ${status === 'active' ? 'activada' : status === 'blocked' ? 'bloqueada' : status === 'cancelled' ? 'cancelada' : 'em trial'} com sucesso`,
            company
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Toggle company status error:', error);
        res.status(500).json({ error: 'Erro ao alterar status da empresa' });
    }
});

// Get all users from all companies
router.get('/users', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                company: {
                    select: {
                        id: true,
                        name: true,
                        nuit: true,
                        status: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(users);
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Erro ao carregar utilizadores' });
    }
});

// Get system activity logs (recent)
router.get('/activity', authenticate, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        const { limit = 50 } = req.query;

        const activities = await prisma.auditLog.findMany({
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        company: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        res.json(activities);
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ error: 'Erro ao carregar logs de actividade' });
    }
});

export default router;
