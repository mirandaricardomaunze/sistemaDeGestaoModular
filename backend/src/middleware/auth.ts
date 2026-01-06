import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import type { User } from '@prisma/client';

export interface AuthRequest extends Request {
    userId?: string;
    userRole?: string;
    companyId?: string;
    companyStatus?: string;
    permissions?: string[];
    activeModules?: string[];
    user?: User;  // ✅ Fixed: was 'any'
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autenticação não fornecido' });
        }

        const token = authHeader.substring(7);

        // 🔒 CRITICAL FIX: JWT_SECRET não pode ter default
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('CRITICAL: JWT_SECRET não está definido nas variáveis de ambiente!');
        }

        const decoded = jwt.verify(token, secret) as { userId: string; role: string; companyId: string };

        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.companyId = decoded.companyId;

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expirado' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Token inválido' });
        }
        return res.status(401).json({ error: 'Falha na autenticação' });
    }
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({
                error: 'Acesso negado. Permissão insuficiente.'
            });
        }
        next();
    };
};

/**
 * Middleware to check if user has a specific permission
 * @param permission Code of the permission (e.g., 'inventory.products.create')
 */
export const hasPermission = (permission: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: 'Não autenticado' });
            }

            // Fetch user permissions with RBAC
            const user = await prisma.user.findUnique({
                where: { id: req.userId },
                include: {
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
                return res.status(401).json({ error: 'Utilizador não encontrado' });
            }

            // System Admin override
            if (user.role === 'super_admin' || user.role === 'admin') {
                return next();
            }

            const permissions = new Set<string>();
            user.userRoles.forEach(ur => {
                ur.role.permissions.forEach(rp => {
                    permissions.add(rp.permission.code);
                });
            });

            if (!permissions.has(permission)) {
                return res.status(403).json({
                    error: `Acesso negado. Requer permissão: ${permission}`
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Erro ao verificar permissões' });
        }
    };
};

/**
 * Middleware to check if company has a specific module active
 * @param moduleCode Code of the module (e.g., 'PHARMACY')
 */
export const hasModule = (moduleCode: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.companyId) {
                return res.status(400).json({ error: 'Empresa não identificada' });
            }

            const companyModule = await prisma.companyModule.findFirst({
                where: {
                    companyId: req.companyId,
                    module: { code: moduleCode.toUpperCase() },
                    isActive: true
                }
            });

            if (!companyModule) {
                return res.status(403).json({
                    error: `Acesso negado. Módulo ${moduleCode} não está activo para esta empresa.`
                });
            }

            next();
        } catch (error) {
            console.error('Module check error:', error);
            res.status(500).json({ error: 'Erro ao verificar módulos' });
        }
    };
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const secret = process.env.JWT_SECRET;

            if (secret) {
                const decoded = jwt.verify(token, secret) as { userId: string; role: string };
                req.userId = decoded.userId;
                req.userRole = decoded.role;
            }
        }
        next();
    } catch {
        // Authentication is optional, so continue even if token is invalid
        next();
    }
};
