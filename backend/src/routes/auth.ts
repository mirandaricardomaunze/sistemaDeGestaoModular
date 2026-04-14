import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { rateLimiters } from '../middleware/rateLimit';
import { CORE_MODULES } from '../constants/modules.constants';

const router = Router();

/**
 * Utility to remove sensitive fields from user object
 */
const sanitizeUser = (user: any) => {
    if (!user) return null;
    const { password, otp, ...safeUser } = user;
    return safeUser;
};

/**
 * Utility to fetch all auth-related data (user, modules, permissions)
 */
async function getAuthData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            company: {
                include: {
                    modules: { where: { isActive: true } }
                }
            },
            userRoles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user) return null;

    // Active modules: Core ones (always) + Company specific ones
    const activeModules = [
        ...CORE_MODULES.map(m => m.code),
        ...(user.company?.modules.map(m => m.moduleCode) || [])
    ];

    // Permissions: Flattened list of codes from all roles assigned to the user
    const permissions = Array.from(new Set(
        user.userRoles.flatMap(ur =>
            ur.role.permissions.map(rp => rp.permission.code)
        )
    ));

    return {
        user: sanitizeUser(user),
        activeModules,
        permissions,
        activeLayers: [] // Placeholder for future layers system
    };
}

router.post('/login', rateLimiters.auth, async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
        throw ApiError.unauthorized('Credenciais inválidas');
    }

    const token = jwt.sign({ userId: user.id, role: user.role, companyId: user.companyId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const authData = await getAuthData(user.id);

    if (!authData) {
        // Fallback for unexpected cases where DB user exists but getAuthData fails
        res.json({ user: sanitizeUser(user), token, activeModules: CORE_MODULES.map(m => m.code), permissions: [] });
    } else {
        res.json({ ...authData, token });
    }
});

router.post('/register', rateLimiters.auth, async (req, res) => {
    const { email, password, name, companyName, companyNuit, moduleCode } = req.body;

    // Input validation
    if (!email || !password || !name || !companyName || !moduleCode) {
        throw ApiError.badRequest('Campos obrigatórios em falta: email, password, name, companyName e moduleCode são necessários.');
    }

    if (password.length < 6) {
        throw ApiError.badRequest('A senha deve ter pelo menos 6 caracteres.');
    }

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) throw ApiError.badRequest('Este email já está registado. Utilize outro email ou faça login.');

    // Check for duplicate NUIT (only if provided)
    if (companyNuit) {
        const existingCompany = await prisma.company.findFirst({ where: { nuit: companyNuit } });
        if (existingCompany) {
            throw ApiError.badRequest(`O NUIT "${companyNuit}" já está registado por outra empresa. Verifique o número e tente novamente.`);
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
                data: {
                    name: companyName,
                    tradeName: req.body.companyTradeName || companyName,
                    nuit: companyNuit || null,
                    phone: req.body.companyPhone,
                    email: req.body.companyEmail,
                    address: req.body.companyAddress,
                    modules: {
                        create: { moduleCode, isActive: true }
                    }
                }
            });

            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    name,
                    role: 'admin',
                    companyId: company.id
                }
            });

            return { user, company };
        });

        const token = jwt.sign(
            { userId: result.user.id, role: result.user.role, companyId: result.company.id },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        res.json({ user: sanitizeUser(result.user), token });
    } catch (error: any) {
        // Handle Prisma unique constraint violations
        if (error?.code === 'P2002') {
            const target = error?.meta?.target;
            if (target?.includes('nuit')) {
                throw ApiError.badRequest('Este NUIT já está registado por outra empresa.');
            }
            if (target?.includes('email')) {
                throw ApiError.badRequest('Este email já está registado.');
            }
            throw ApiError.badRequest('Dados duplicados detectados. Verifique o email e NUIT.');
        }
        throw error; // Re-throw other errors for the global error handler
    }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
    const authData = await getAuthData(req.userId!);
    if (!authData) throw ApiError.notFound('Utilizador não encontrado');

    // Flatten the response for the frontend (all user fields + modules/permissions)
    res.json({
        ...authData.user,
        activeModules: authData.activeModules,
        permissions: authData.permissions,
        activeLayers: authData.activeLayers
    });
});

router.get('/users', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const users = await prisma.user.findMany({
        where: { companyId: req.companyId },
        orderBy: { name: 'asc' }
    });
    res.json(users.map(sanitizeUser));
});

router.put('/users/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { name, email, role, phone } = req.body;

    const user = await prisma.user.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: { name, email: email.toLowerCase(), role, phone }
    });

    if (user.count === 0) throw ApiError.notFound('Utilizador não encontrado');
    res.json({ message: 'Utilizador atualizado' });
});

router.patch('/users/:id/status', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { isActive } = req.body;

    const user = await prisma.user.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: { isActive }
    });

    if (user.count === 0) throw ApiError.notFound('Utilizador não encontrado');
    res.json({ message: 'Status atualizado' });
});

router.delete('/users/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const user = await prisma.user.deleteMany({
        where: { id: req.params.id, companyId: req.companyId }
    });

    if (user.count === 0) throw ApiError.notFound('Utilizador não encontrado');
    res.json({ message: 'Utilizador removido' });
});

export default router;
