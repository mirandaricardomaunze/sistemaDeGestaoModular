import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export const tenantMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        let companyId = req.companyId;

        // MIGRATION FALLBACK: Se o token for antigo e não tiver companyId,
        // tentamos buscar o companyId do usuário no banco de dados.
        if (!companyId && req.userId) {
            const user = await prisma.user.findUnique({
                where: { id: req.userId },
                select: { companyId: true }
            });
            companyId = user?.companyId || undefined;
            req.companyId = companyId; // Injetar para uso posterior
        }

        if (!companyId) {
            // Se ainda não tiver companyId, pegamos a primeira empresa ativa como padrão (TEMP)
            const defaultCompany = await prisma.company.findFirst({
                where: { status: 'active' }
            });

            if (defaultCompany) {
                companyId = defaultCompany.id;
                req.companyId = companyId;
            } else {
                return res.status(403).json({ error: 'Contexto de empresa não encontrado e nenhuma empresa padrão disponível' });
            }
        }

        // Resolvê e validar a empresa e seus módulos
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                modules: {
                    where: { isActive: true }
                }
            }
        });

        if (!company) {
            return res.status(404).json({ error: 'Empresa não encontrada ou inativa' });
        }

        if (company.status === 'blocked' || company.status === 'cancelled') {
            return res.status(403).json({ error: `Acesso bloqueado. Status da empresa: ${company.status}` });
        }

        // Injetar status e lista de módulos ativos no request para uso posterior
        req.companyStatus = company.status;
        req.activeModules = company.modules.map(cm => cm.moduleCode);

        next();
    } catch (error) {
        logger.error('Erro no tenantMiddleware:', error);
        return res.status(500).json({ error: 'Erro interno ao validar contexto da empresa' });
    }
};

/**
 * Middleware para validar se a empresa possui um módulo específico ativo
 */
export const requireModule = (moduleCode: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const activeModules = req.activeModules;

        if (!activeModules || !activeModules.includes(moduleCode)) {
            return res.status(403).json({
                error: `Módulo ${moduleCode} não está ativo para esta empresa.`
            });
        }
        next();
    };
};
