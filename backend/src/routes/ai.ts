import { Router } from 'express';
import { aiActionService } from '../services/aiActionService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.post('/actions', async (req, res) => {
    const { action, params, companyId, secret } = req.body;
    if (secret !== process.env.AI_SECRET) throw ApiError.unauthorized('Não autorizado');
    const result = await aiActionService.executeAction(action, params, companyId);
    res.json(result);
});

export default router;
