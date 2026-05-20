import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { tenantContext } from '../lib/context';
import { ApiError } from './error.middleware';
import { isTokenBlacklisted } from '../lib/redis';

export interface AuthRequest extends Request {
    userId?: string;
    userRole?: string;
    userName?: string;
    companyId?: string;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw ApiError.unauthorized('Token não fornecido');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw ApiError.internal('JWT_SECRET não configurado');

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { userId: string; role: string; companyId: string; name?: string; exp: number };

        // Check if this token was explicitly revoked (logout)
        if (await isTokenBlacklisted(token)) {
            throw ApiError.unauthorized('Sessão terminada. Faça login novamente.');
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, name: true, role: true, companyId: true, isActive: true }
        });

        if (!user || !user.isActive) {
            throw ApiError.unauthorized('Utilizador bloqueado ou desativado.');
        }

        req.userId = user.id;
        req.userRole = user.role;
        // Favor live DB data so role/status changes take effect without waiting
        // for the old JWT to expire.
        req.userName = user.name || decoded.name || user.id || 'Utilizador';
        req.companyId = user.companyId ?? undefined;

        tenantContext.run({ companyId: req.companyId, userId: req.userId }, () => next());
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw ApiError.unauthorized('Token inválido ou expirado');
    }
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            // Log authorization failures so they are visible in the audit trail.
            // companyId is required for tenant-scoped audit queries — copy it from
            // the request (set by `authenticate` upstream).
            prisma.auditLog.create({
                data: {
                    userId: req.userId,
                    userName: req.userName ?? 'Anônimo',
                    action: 'ACCESS_DENIED',
                    entity: 'Authorization',
                    companyId: req.companyId,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    newData: { path: req.path, method: req.method, userRole: req.userRole, requiredRoles: roles }
                }
            }).catch(() => {});
            throw ApiError.forbidden('Acesso negado');
        }
        next();
    };
};
