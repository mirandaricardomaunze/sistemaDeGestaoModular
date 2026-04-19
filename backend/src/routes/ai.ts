import { Router } from 'express';
import { aiActionService } from '../services/aiActionService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { emitToCompany } from '../lib/socket';

const router = Router();

// Uses JWT authentication -- companyId is derived from the verified token,
// never from the request body, to prevent cross-tenant data access.
router.post('/actions', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { action, params } = req.body;
    const result = await aiActionService.executeAction(action, params, req.companyId);

    // Socket Notification: AI analysis or action complete
    emitToCompany(req.companyId, 'ai:action_complete', {
        action,
        status: result.success ? 'success' : 'failed',
        timestamp: new Date()
    });

    res.json(result);
});

export default router;
