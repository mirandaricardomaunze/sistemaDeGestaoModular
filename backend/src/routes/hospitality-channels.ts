import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { hospitalityChannelsService } from '../services/hospitality-channels.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// ============================================================================
// Channel Manager (iCal)
// ============================================================================

/**
 * GET /api/hospitality/channels/rooms/:roomId/ical
 * URL Pública mas autenticada opcionalmente via token ou query param (caso uma OTA faça scraping).
 * Aqui por simplificação usaremos autenticação padrao mas numa real, OTA nao envia Bearer Token padrão.
 * Podemos omitir 'authenticate' e checar token estático via query. 
 */
router.get('/rooms/:roomId/ical', async (req, res) => {
    try {
        // Obter companyId associado a este quarto, por simplificacao no MVP exigiremos 'c' na query param
        const companyId = req.query.c as string;
        if (!companyId) {
            return res.status(400).send('Missing company identification in query ?c=');
        }

        const icalContent = await hospitalityChannelsService.generateICalForRoom(companyId, req.params.roomId);
        
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="room-${req.params.roomId}.ics"`);
        res.send(icalContent);
    } catch (error: any) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).send(error.message);
        } else {
            res.status(500).send('Internal Server Error');
        }
    }
});

/**
 * POST /api/hospitality/channels/rooms/:roomId/sync
 * Força sincronização de um iCal remoto
 */
router.post('/rooms/:roomId/sync', authenticate, async (req: any, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { icalUrl } = req.body;
    
    if (!icalUrl) throw ApiError.badRequest('iCal URL é obriagtória');

    const result = await hospitalityChannelsService.syncFromICal(req.companyId, req.params.roomId, icalUrl);
    res.json(result);
});

export default router;
