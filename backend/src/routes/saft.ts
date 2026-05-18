import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { saftService } from '../services/saftService';
import { SAFTParamsSchema } from '../validation/saft.validation';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/saft/export
 * Gera e faz download do ficheiro SAF-T XML completo.
 *
 * Query params:
 *   - startDate  (YYYY-MM-DD) — início do período fiscal
 *   - endDate    (YYYY-MM-DD) — fim do período fiscal
 *   - fiscalYear (YYYY)       — ano fiscal para o header
 *
 * Permissões: admin, manager
 */
router.get(
    '/export',
    authenticate,
    authorize('admin', 'manager', 'super_admin'),
    async (req: AuthRequest, res) => {
        if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');

        const parsed = SAFTParamsSchema.safeParse(req.query);
        if (!parsed.success) {
            throw ApiError.badRequest(
                'Parâmetros inválidos: ' + JSON.stringify(parsed.error.flatten().fieldErrors)
            );
        }

        logger.info('SAF-T export requested', {
            companyId: req.companyId,
            userId: req.userId,
            ...parsed.data,
        });

        const xml = await saftService.generateSAFT(req.companyId, parsed.data);

        const filename = `SAFT-MZ_${parsed.data.fiscalYear}_${parsed.data.startDate}_a_${parsed.data.endDate}.xml`;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(xml, 'utf8'));

        return res.send(xml);
    }
);

export default router;
