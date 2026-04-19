import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { chatService } from '../services/chatService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.post('/message', authenticate, async (req: AuthRequest, res) => {
    const { message } = req.body;
    if (!req.userId || !req.companyId) throw ApiError.badRequest('Usuário ou empresa não identificados');
    if (!message) throw ApiError.badRequest('Mensagem é obrigatória');

    const response = await chatService.processMessage(message, req.userId, req.companyId);
    res.json(response);
});

router.get('/health', authenticate, async (req: AuthRequest, res) => {
    const health = await chatService.checkHealth();
    res.json(health);
});

router.get('/suggestions', authenticate, async (req: AuthRequest, res) => {
    const suggestions = await chatService.getSuggestions();
    res.json(suggestions);
});

export default router;
