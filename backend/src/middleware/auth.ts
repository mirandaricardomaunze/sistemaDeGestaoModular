import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { tenantContext } from '../lib/context';
import { ApiError } from './error.middleware';

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

    try {
        const decoded = jwt.verify(authHeader.substring(7), secret) as { userId: string; role: string; companyId: string };
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.companyId = decoded.companyId;

        tenantContext.run({ companyId: req.companyId, userId: req.userId }, () => next());
    } catch (error) {
        throw ApiError.unauthorized('Token inválido ou expirado');
    }
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.userRole || !roles.includes(req.userRole)) throw ApiError.forbidden('Acesso negado');
        next();
    };
};
