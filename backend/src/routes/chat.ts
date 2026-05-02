import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { chatService } from '../services/chatService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.post('/message', authenticate, async (req: AuthRequest, res) => {
    const { message, module } = req.body;
    if (!req.userId || !req.companyId) throw ApiError.badRequest('Usuário ou empresa não identificados');
    if (!message) throw ApiError.badRequest('Mensagem é obrigatória');

    const response = await chatService.processMessage(message, req.userId, req.companyId, module);
    res.json(response);
});

router.get('/health', authenticate, async (req: AuthRequest, res) => {
    const health = await chatService.checkHealth();
    res.json(health);
});

router.get('/suggestions', authenticate, async (req: AuthRequest, res) => {
    const { module } = req.query;
    const suggestions = await chatService.getSuggestions(module as string);
    res.json(suggestions);
});

export default router;
