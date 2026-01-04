import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { chatService } from '../services/chatService';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/chat/message
 * Envia mensagem e recebe resposta do assistente
 */
router.post('/message', authenticate, async (req: AuthRequest, res) => {
    try {
        const { message } = req.body;
        const userId = req.userId!;
        const companyId = req.companyId!;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        if (message.length > 1000) {
            return res.status(400).json({ error: 'Mensagem muito longa (máximo 1000 caracteres)' });
        }

        logger.info(`Chat message from user ${userId}: ${message.substring(0, 50)}...`);

        const response = await chatService.processMessage(message, userId, companyId);

        res.json(response);
    } catch (error: any) {
        logger.error('Chat message error:', error);
        res.status(500).json({
            error: 'Erro ao processar mensagem',
            message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.'
        });
    }
});

/**
 * GET /api/chat/health
 * Verifica status do assistente de IA
 */
router.get('/health', authenticate, async (req: AuthRequest, res) => {
    try {
        const ollamaAvailable = await aiService.checkHealth();

        res.json({
            status: 'ok',
            ai: {
                available: ollamaAvailable,
                provider: 'Gemini via n8n',
                model: 'gemini-1.5-flash'
            },
            features: {
                chat: true,
                pdfGeneration: true,
                dataQuery: true
            }
        });
    } catch (error: any) {
        logger.error('Chat health check error:', error);
        res.status(500).json({ error: 'Erro ao verificar status' });
    }
});

/**
 * GET /api/chat/suggestions
 * Retorna sugestões de perguntas
 */
router.get('/suggestions', authenticate, async (req: AuthRequest, res) => {
    try {
        const suggestions = [
            {
                category: 'Vendas',
                icon: '💰',
                questions: [
                    'Quanto vendi hoje?',
                    'Quais os produtos mais vendidos esta semana?',
                    'Gerar relatório de vendas do mês em PDF'
                ]
            },
            {
                category: 'Inventário',
                icon: '📦',
                questions: [
                    'Quais produtos têm stock baixo?',
                    'Qual o valor total do inventário?',
                    'Produtos sem stock'
                ]
            },
            {
                category: 'Clientes',
                icon: '👥',
                questions: [
                    'Quantos clientes tenho?',
                    'Quem são os clientes VIP?',
                    'Gerar lista de clientes em PDF'
                ]
            },
            {
                category: 'Financeiro',
                icon: '💵',
                questions: [
                    'Resumo financeiro do mês',
                    'Qual foi a receita de hoje?',
                    'Métodos de pagamento mais usados'
                ]
            }
        ];

        res.json({ suggestions });
    } catch (error: any) {
        logger.error('Chat suggestions error:', error);
        res.status(500).json({ error: 'Erro ao buscar sugestões' });
    }
});

export default router;
