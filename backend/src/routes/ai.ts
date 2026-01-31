import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { aiActionService } from '../services/aiActionService';
import { logger } from '../utils/logger';

const router = Router();

// Endpoint para ferramentas do Agente IA (n8n)
// TODO: Em produção, usar um middleware de autenticação robusto
router.post('/actions', async (req, res) => {
    const { action, params, companyId, secret } = req.body;

    logger.info(`[AI Actions] Incoming Request Body: ${JSON.stringify(req.body)}`);

    // Verificação de segurança (Estática ou Dinâmica via JWT)
    const AI_SECRET = process.env.AI_SECRET || 'multicore_ai_secret_2026';
    let isAuthorized = (secret === AI_SECRET);

    logger.info(`[AI Auth] Action: ${action}, Company: ${companyId}`);
    logger.info(`[AI Auth] Secret received: ${secret ? 'Present (Length: ' + secret.length + ')' : 'Missing'}`);

    // Se não for o segredo estático, tenta validar como Token JWT dinâmico
    if (!isAuthorized && secret) {
        try {
            const decoded = jwt.verify(secret, process.env.JWT_SECRET || 'multicore_secret_key_2024') as any;
            logger.info(`[AI Auth] JWT Decoded for company: ${decoded.companyId}`);

            if (String(decoded.companyId) === String(companyId) && decoded.purpose === 'ai_action') {
                isAuthorized = true;
                logger.info(`[AI Auth] SUCCESS: Authorized via Dynamic Token`);
            } else {
                logger.warn(`[AI Auth] FAIL: Company mismatch. Token: ${decoded.companyId}, Request: ${companyId}`);
            }
        } catch (error: any) {
            logger.error(`[AI Auth] FAIL: JWT Verification Error: ${error.message}`);
        }
    }

    if (!isAuthorized) {
        logger.warn(`[AI Auth] FINAL REJECTION: Unauthorized attempt for ${action}`);
        return res.status(401).json({ error: 'Não autorizado' });
    }

    if (!action || !companyId) {
        return res.status(400).json({ error: 'Ação e CompanyId são obrigatórios' });
    }

    try {
        const result = await aiActionService.executeAction(action, params || {}, companyId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
