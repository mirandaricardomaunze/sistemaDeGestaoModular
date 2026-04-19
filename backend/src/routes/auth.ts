import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { rateLimiters } from '../middleware/rateLimit';
import { CORE_MODULES } from '../constants/modules.constants';
import { blacklistToken } from '../lib/redis';
import { sendPasswordResetEmail } from '../services/emailService';

const router = Router();

/** Requires ≥8 chars with at least one uppercase, one lowercase and one digit */
const isPasswordStrong = (pwd: string): boolean =>
    pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);

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
    if (!email || !password) throw ApiError.badRequest('Email e senha são obrigatórios');

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const passwordMatch = user && (await bcrypt.compare(password, user.password));

    if (!user || !user.isActive || !passwordMatch) {
        // Log failed login attempt (security event)
        await prisma.auditLog.create({
            data: {
                userName: 'Anônimo',
                action: 'LOGIN_FAILED',
                entity: 'User',
                entityId: user?.id ?? 'unknown',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                newData: { email: email.toLowerCase(), reason: !user ? 'user_not_found' : !user.isActive ? 'account_inactive' : 'wrong_password' }
            }
        }).catch(() => {}); // Never block login flow due to audit failure
        throw ApiError.unauthorized('Credenciais inválidas');
    }

    // Log successful login
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = jwt.sign({ userId: user.id, role: user.role, companyId: user.companyId, name: user.name }, process.env.JWT_SECRET!, { expiresIn: '7d', algorithm: 'HS256' });
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

    if (!isPasswordStrong(password)) {
        throw ApiError.badRequest('A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.');
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

    const hashedPassword = await bcrypt.hash(password, 12);

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
            { userId: result.user.id, role: result.user.role, companyId: result.company.id, name: result.user.name },
            process.env.JWT_SECRET!,
            { expiresIn: '7d', algorithm: 'HS256' }
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

// ---------------------------------------------------------------------------
// POST /auth/logout -- revoke current token immediately
// ---------------------------------------------------------------------------
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
    const token = req.headers.authorization!.substring(7);
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const exp = decoded?.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    await blacklistToken(token, exp);
    res.json({ message: 'Sessão terminada com sucesso' });
});

// ---------------------------------------------------------------------------
// POST /auth/forgot-password -- send OTP to registered email
// ---------------------------------------------------------------------------
router.post('/forgot-password', rateLimiters.passwordReset, async (req, res) => {
    const { email } = req.body;
    if (!email) throw ApiError.badRequest('Email é obrigatório');

    // Intentionally vague response to prevent user enumeration
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
        res.json({ message: 'Se o email existir receberá um código de recuperação' });
        return;
    }

    // Generate a 6-digit numeric OTP and store it hashed
    const otpPlain = crypto.randomInt(100_000, 999_999).toString();
    const otpHash = crypto.createHash('sha256').update(otpPlain).digest('hex');
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
        where: { id: user.id },
        data: { otp: otpHash, otpExpiry, otpAttempts: 0 }
    });

    await sendPasswordResetEmail(user.email, user.name, otpPlain);

    res.json({ message: 'Se o email existir receberá um código de recuperação' });
});

// ---------------------------------------------------------------------------
// POST /auth/reset-password -- verify OTP and set new password
// ---------------------------------------------------------------------------
router.post('/reset-password', rateLimiters.passwordReset, async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
        throw ApiError.badRequest('email, otp e newPassword são obrigatórios');
    }
    if (!isPasswordStrong(newPassword)) {
        throw ApiError.badRequest('A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.');
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    const MAX_OTP_ATTEMPTS = 5;

    if (!user || !user.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
        throw ApiError.badRequest('Código inválido ou expirado');
    }

    if ((user.otpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
        // Lock out: clear OTP to force re-request
        await prisma.user.update({ where: { id: user.id }, data: { otp: null, otpExpiry: null, otpAttempts: 0 } });
        throw ApiError.badRequest('Demasiadas tentativas incorretas. Solicite um novo código.');
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (user.otp !== otpHash) {
        await prisma.user.update({ where: { id: user.id }, data: { otpAttempts: { increment: 1 } } });
        throw ApiError.badRequest('Código inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, otp: null, otpExpiry: null, otpAttempts: 0 }
    });

    res.json({ message: 'Palavra-passe alterada com sucesso. Pode fazer login.' });
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

// ---------------------------------------------------------------------------
// PUT /auth/profile -- self-service profile update (authenticated user)
// ---------------------------------------------------------------------------
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
    if (!req.userId) throw ApiError.unauthorized('Não autenticado');
    const { name, phone, avatar } = req.body;
    const updated = await prisma.user.update({
        where: { id: req.userId },
        data: {
            ...(name && { name }),
            ...(phone !== undefined && { phone }),
            ...(avatar !== undefined && { avatar }),
        }
    });
    res.json(sanitizeUser(updated));
});

// ---------------------------------------------------------------------------
// PUT /auth/change-password -- authenticated user changes own password
// ---------------------------------------------------------------------------
router.put('/change-password', authenticate, async (req: AuthRequest, res) => {
    if (!req.userId) throw ApiError.unauthorized('Não autenticado');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw ApiError.badRequest('currentPassword e newPassword são obrigatórios');
    if (!isPasswordStrong(newPassword)) throw ApiError.badRequest('A nova senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.');

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw ApiError.notFound('Utilizador não encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw ApiError.badRequest('Palavra-passe atual incorreta');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });
    res.json({ message: 'Palavra-passe alterada com sucesso' });
});

// ---------------------------------------------------------------------------
// POST /auth/verify-otp -- verify OTP code only (step 1 of 2-step reset)
// ---------------------------------------------------------------------------
router.post('/verify-otp', rateLimiters.passwordReset, async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw ApiError.badRequest('email e otp são obrigatórios');

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
        throw ApiError.badRequest('Código inválido ou expirado');
    }
    if ((user.otpAttempts ?? 0) >= 5) {
        await prisma.user.update({ where: { id: user.id }, data: { otp: null, otpExpiry: null, otpAttempts: 0 } });
        throw ApiError.badRequest('Demasiadas tentativas. Solicite um novo código.');
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (user.otp !== otpHash) {
        await prisma.user.update({ where: { id: user.id }, data: { otpAttempts: { increment: 1 } } });
        throw ApiError.badRequest('Código inválido ou expirado');
    }

    res.json({ message: 'Código verificado com sucesso', verified: true });
});

export default router;
