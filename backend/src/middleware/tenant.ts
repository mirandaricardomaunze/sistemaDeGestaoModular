import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';
import { ApiError } from './error.middleware';

export const tenantMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.companyId) throw ApiError.badRequest('Contexto de empresa não identificado');

    const company = await prisma.company.findUnique({
        where: { id: req.companyId },
        include: { modules: { where: { isActive: true } } }
    });

    if (!company) throw ApiError.notFound('Empresa não encontrada');
    if (company.status !== 'active') throw ApiError.forbidden('Acesso bloqueado: empresa inativa');

    next();
};
