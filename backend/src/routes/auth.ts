import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { User, BusinessType, Prisma } from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getModuleByCode } from '../constants/modules.constants';
import {
    loginSchema,
    registerSchema,
    updateProfileSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    verifyOtpSchema,
    resetPasswordSchema,
    updateUserSchema,
    updateUserStatusSchema,
    formatZodError,
    ZodError
} from '../validation';


const router = Router();

// Rate limiter for login endpoint (brute force protection)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for forgot password (prevent email spamming)
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour per IP
    message: 'Muitas solicitações de recuperação. Tente novamente em uma hora.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const { email, password } = validatedData;

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: {
                company: {
                    include: {
                        modules: {
                            where: { isActive: true }
                        }
                    }
                },
                userRoles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        // ðŸ”’ CRITICAL: JWT_SECRET must be defined
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            logger.error('CRITICAL: JWT_SECRET not defined in environment');
            throw new Error('Server configuration error');
        }

        // Generate JWT
        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role,
                companyId: user.companyId
            },
            secret,
            { expiresIn: '7d' }
        );

        // Extract active module codes (now stored directly as moduleCode)
        const activeModules = user.company?.modules?.map(cm => cm.moduleCode) || [];

        // Extract and flatten permissions
        const permissionsSet = new Set<string>();
        user.userRoles?.forEach(ur => {
            ur.role.permissions.forEach(rp => {
                permissionsSet.add(rp.permission.code);
            });
        });
        const permissions = Array.from(permissionsSet);

        // Identify active layers (Inventory, CRM, Fiscal, HR)
        // These are always active but we can filter based on permissions eventually
        const activeLayers = ['INVENTORY', 'CRM', 'FISCAL', 'HR'];

        const { password: _, userRoles: __, company: ___, ...userWithoutPassword } = user;

        // Log successful login
        import('../middleware/audit').then(({ logAudit }) => {
            logAudit({
                userId: user.id,
                userName: user.name,
                action: 'LOGIN',
                entity: 'auth',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        });

        res.json({
            user: {
                ...userWithoutPassword,
                company: user.company ? { id: user.company.id, name: user.company.name } : null
            },
            token,
            activeModules,
            activeLayers,
            permissions
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Login error', { error: error instanceof Error ? error.message : 'Unknown', email: req.body.email });
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Module to Business Type mapping
const MODULE_TO_BUSINESS_TYPE: Record<string, BusinessType> = {
    'PHARMACY': 'pharmacy',
    'COMMERCIAL': 'retail',
    'BOTTLE_STORE': 'bottlestore',
    'HOSPITALITY': 'hotel',
    'LOGISTICS': 'logistics',
    'RESTAURANT': 'retail'
};

// Register with Company and Module Selection
router.post('/register', async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const {
            email, password, name, role, phone,
            companyName, companyTradeName, companyNuit,
            companyPhone, companyEmail, companyAddress,
            moduleCode
        } = validatedData;
        logger.info('[Register Debug] Request Body: %o', { email, name, companyName, companyNuit, moduleCode });

        // Check if user email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            logger.warn('[Register Debug] Email already in use: %s', email);
            return res.status(400).json({ error: 'Este email de utilizador já está em uso.' });
        }

        // Check if company NUIT already exists
        const existingCompanyNuit = await prisma.company.findUnique({
            where: { nuit: companyNuit }
        });

        if (existingCompanyNuit) {
            logger.warn('[Register Debug] NUIT already in use: %s', companyNuit);
            return res.status(400).json({ error: 'Já existe uma empresa registada com este NUIT.' });
        }

        // Check if company email already exists (if provided)
        if (companyEmail) {
            const existingCompanyEmail = await prisma.company.findFirst({
                where: { email: companyEmail.toLowerCase() }
            });

            if (existingCompanyEmail) {
                logger.warn('[Register Debug] Company Email already in use: %s', companyEmail);
                return res.status(400).json({ error: 'Este email de empresa já está em uso.' });
            }
        }

        // Validate module against static definitions (no database lookup needed)
        const selectedModule = getModuleByCode(moduleCode.toUpperCase());

        if (!selectedModule) {
            logger.warn('[Register Debug] Module not found in static definitions: %s', moduleCode);
            return res.status(400).json({ error: 'Módulo inválido' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Use transaction to create company, link module, and create user
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Company with full details
            const company = await tx.company.create({
                data: {
                    name: companyName,
                    tradeName: companyTradeName || companyName,
                    nuit: companyNuit,
                    phone: companyPhone,
                    email: companyEmail,
                    address: companyAddress,
                    businessType: (MODULE_TO_BUSINESS_TYPE[moduleCode.toUpperCase()] || 'retail') as BusinessType,
                    status: 'active'
                }
            });

            // 2. Link Module to Company (using static module code)
            await tx.companyModule.create({
                data: {
                    companyId: company.id,
                    moduleCode: selectedModule.code,
                    isActive: true
                }
            });

            // 3. Create User linked to Company
            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    name,
                    role: (role || 'admin') as any, // Backward compatibility / Internal use
                    phone,
                    companyId: company.id
                }
            });

            // 4. Create CompanySettings for sidebar and settings page
            await tx.companySettings.create({
                data: {
                    companyId: company.id,
                    companyName: companyName,
                    tradeName: companyTradeName || companyName,
                    nuit: companyNuit,
                    phone: companyPhone || '',
                    email: companyEmail || '',
                    address: companyAddress || '',
                    country: 'Moçambique',
                    currency: 'MZN',
                    ivaRate: 16,
                    businessType: (MODULE_TO_BUSINESS_TYPE[moduleCode.toUpperCase()] || 'retail') as BusinessType
                }
            });

            // 5. Assign 'company_admin' RBAC Role
            const companyAdminRole = await tx.role.findUnique({
                where: { code: 'company_admin' }
            });

            if (companyAdminRole) {
                await tx.userModuleRole.create({
                    data: {
                        userId: user.id,
                        moduleId: null, // Global access for company admin
                        roleId: companyAdminRole.id
                    }
                });
            }

            return { user, company, moduleCode: selectedModule.code };
        });

        const { password: _, ...userWithoutPassword } = result.user;

        // Log registration
        import('../middleware/audit').then(({ logAudit }) => {
            logAudit({
                userId: result.user.id,
                userName: result.user.name,
                action: 'REGISTER_WITH_COMPANY',
                entity: 'auth',
                entityId: result.company.id,
                newData: { companyName: result.company.name, module: result.moduleCode },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        });

        res.status(201).json({
            ...userWithoutPassword,
            company: {
                id: result.company.id,
                name: result.company.name
            },
            activeModules: [result.moduleCode]
        });
    } catch (error) {
        logger.error('[Register Debug] Registration failed: %o', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            body: req.body
        });

        if (error instanceof z.ZodError || (error && (error.name === 'ZodError' || error instanceof Error && error.constructor.name === 'ZodError'))) {
            return res.status(400).json({ 
                error: 'Erro de validação', 
                details: typeof formatZodError === 'function' ? formatZodError(error as any) : error 
            });
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Já existe um registo com estes dados únicos (Email ou NUIT).' });
            }
        }

        res.status(500).json({ error: 'Erro ao criar conta.' });
    }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: {
                company: {
                    include: {
                        modules: {
                            where: { isActive: true }
                        }
                    }
                },
                userRoles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        }

        // Extract active module codes (now stored directly as moduleCode)
        const activeModules = user.company?.modules?.map(cm => cm.moduleCode) || [];

        // Extract and flatten permissions
        const permissionsSet = new Set<string>();
        user.userRoles?.forEach(ur => {
            ur.role.permissions.forEach(rp => {
                permissionsSet.add(rp.permission.code);
            });
        });
        const permissions = Array.from(permissionsSet);

        const activeLayers = ['INVENTORY', 'CRM', 'FISCAL', 'HR'];

        const { password: _, userRoles: __, company: ___, ...userWithoutPassword } = user;
        res.json({
            ...userWithoutPassword,
            company: user.company ? { id: user.company.id, name: user.company.name } : null,
            activeModules,
            activeLayers,
            permissions
        });
    } catch (error) {
        logger.error('Get user error', { error: error instanceof Error ? error.message : 'Unknown', userId: req.userId });
        res.status(500).json({ error: 'Erro ao buscar utilizador' });
    }
});

// Update profile
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = updateProfileSchema.parse(req.body);
        const { name, phone } = validatedData;

        const user = await prisma.user.update({
            where: { id: req.userId },
            data: { name, phone }
        });

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Update profile error', { error: error instanceof Error ? error.message : 'Unknown', userId: req.userId });
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Change password
router.put('/change-password', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = changePasswordSchema.parse(req.body);
        const { currentPassword, newPassword } = validatedData;

        const user = await prisma.user.findUnique({
            where: { id: req.userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Senha actual incorrecta' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: req.userId },
            data: { password: hashedPassword }
        });

        // Log password change
        import('../middleware/audit').then(({ logAudit }) => {
            logAudit({
                userId: req.userId,
                action: 'PASSWORD_CHANGE',
                entity: 'auth',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        });

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Change password error', { error: error instanceof Error ? error.message : 'Unknown', userId: req.userId });
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// List users (Scoped by company)
router.get('/users', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId && req.userRole !== 'super_admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const users = await prisma.user.findMany({
            where: req.userRole === 'super_admin' ? {} : { companyId: req.companyId },
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
                        name: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(users);
    } catch (error) {
        logger.error('List users error', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ error: 'Erro ao listar utilizadores' });
    }
});

// Update user (Admin only, same company)
router.put('/users/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        if (req.userRole !== 'admin' && req.userRole !== 'super_admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { id } = req.params;
        const validatedData = updateUserSchema.parse(req.body);
        const { name, email, role, phone } = validatedData;

        const targetUser = await prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        }

        // Security check: ensure same company
        if (req.userRole !== 'super_admin' && targetUser.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado: utilizador pertence a outra empresa' });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { name, email, role: role as any, phone }
        });

        const { password: _, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
    } catch (error) {
        logger.error('Update user error', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ error: 'Erro ao atualizar utilizador' });
    }
});

// Toggle user status (Admin only)
router.patch('/users/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        if (req.userRole !== 'admin' && req.userRole !== 'super_admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { id } = req.params;
        const validatedData = updateUserStatusSchema.parse(req.body);
        const { isActive } = validatedData;

        const targetUser = await prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        }

        if (req.userRole !== 'super_admin' && targetUser.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { isActive }
        });

        res.json({ message: `Utilizador ${isActive ? 'activado' : 'desactivado'} com sucesso` });
    } catch (error) {
        logger.error('Toggle user status error', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ error: 'Erro ao alterar status do utilizador' });
    }
});

// Delete user (Admin only)
router.delete('/users/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        if (req.userRole !== 'admin' && req.userRole !== 'super_admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.userId) {
            return res.status(400).json({ error: 'Não pode apagar a sua própria conta' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        }

        if (req.userRole !== 'super_admin' && targetUser.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        await prisma.user.delete({ where: { id } });

        res.json({ message: 'Utilizador removido com sucesso' });
    } catch (error) {
        logger.error('Delete user error', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ error: 'Erro ao remover utilizador' });
    }
});

// Forgot Password - Request OTP
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
        const validatedData = forgotPasswordSchema.parse(req.body);
        const { email } = validatedData;

        const user: User | null = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            // Security: Always return success to prevent email enumeration
            return res.json({ message: 'Se o email existir, um código foi enviado.' });
        }

        // Generate Secure 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Hash OTP for security
        const salt = await bcrypt.genSalt(10);
        const hashedOtp = await bcrypt.hash(otp, salt);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otp: hashedOtp,
                otpExpiry
            }
        });

        // Add to Email Queue
        try {
            const { addEmailToQueue } = await import('../queues/emailQueue');
            await addEmailToQueue(user.email, otp);
        } catch (queueError) {
            logger.error('Erro ao adicionar e-mail Í fila (Redis):', queueError);
            // In development, we might want to send it directly or just log it
            if (process.env.NODE_ENV !== 'production') {
                console.log('\n-----------------------------------------');
                console.log(`[FALLBACK DEV] OTP para ${user.email}: ${otp}`);
                console.log('-----------------------------------------\n');
            }
        }

        res.json({ message: 'Código de recuperação enviado para o seu e-mail.' });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Forgot password error', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ error: 'Erro ao processar pedido de recuperação' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const validatedData = verifyOtpSchema.parse(req.body);
        const { email, otp } = validatedData;

        const user: User | null = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user || !user.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(400).json({ error: 'Código inválido ou expirado' });
        }

        // Verify OTP hash
        const isValid = await bcrypt.compare(otp, user.otp);
        if (!isValid) {
            return res.status(400).json({ error: 'Código inválido ou expirado' });
        }

        res.json({ message: 'Código verificado com sucesso' });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Verify OTP error', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ error: 'Erro ao verificar código' });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const validatedData = resetPasswordSchema.parse(req.body);
        const { email, otp, newPassword } = validatedData;

        const user: User | null = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user || !user.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(400).json({ error: 'Código inválido ou expirado' });
        }

        // Verify OTP hash
        const isValid = await bcrypt.compare(otp, user.otp);
        if (!isValid) {
            return res.status(400).json({ error: 'Código inválido ou expirado' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                otp: null,
                otpExpiry: null
            }
        });

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Reset password error', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
});

export default router;
