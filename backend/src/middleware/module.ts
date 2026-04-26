import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';
import { ApiError } from './error.middleware';
import { cacheService } from '../services/cacheService';

const CACHE_TTL = 300; // 5 minutes
const cacheKey = (companyId: string) => `module_access:${companyId}`;

async function getActiveModules(companyId: string): Promise<Set<string>> {
    const key = cacheKey(companyId);
    const cached = cacheService.get<string[]>(key);
    if (cached) return new Set(cached.map(m => m.toUpperCase()));

    const modules = await prisma.companyModule.findMany({
        where: { companyId, isActive: true },
        select: { moduleCode: true },
    });
    const codes = modules.map(m => m.moduleCode.toUpperCase());
    cacheService.set(key, codes, CACHE_TTL);
    return new Set(codes);
}

/**
 * Invalidate the module access cache for a company.
 * Call this whenever a module is activated or deactivated.
 */
export function clearModuleCache(companyId: string): void {
    cacheService.del(cacheKey(companyId));
}

/**
 * Middleware factory — rejects requests from companies that do not have
 * the specified module active. super_admin always passes.
 *
 * Usage: router.use(requireModule('PHARMACY'))
 */
export function requireModule(moduleCode: string) {
    const code = moduleCode.toUpperCase();
    return async (req: AuthRequest, _res: Response, next: NextFunction) => {
        // super_admin has global access and has no companyId
        if (req.userRole === 'super_admin') return next();

        if (!req.companyId) {
            throw ApiError.unauthorized('Empresa não identificada');
        }

        const activeModules = await getActiveModules(req.companyId);
        if (!activeModules.has(code)) {
            throw ApiError.forbidden(`Módulo ${code} não está activo para esta empresa`);
        }

        next();
    };
}
