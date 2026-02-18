import axios from 'axios';
import jwt from 'jsonwebtoken';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export class AIService {
    async generateResponse(originalMessage: string, companyId: string, context?: any) {
        const fullPrompt = this.buildPrompt(originalMessage, context);
        try {
            const aiToken = jwt.sign({ companyId, purpose: 'ai_action' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
            const response = await axios.post(process.env.N8N_WEBHOOK_URL!, { message: fullPrompt, companyId, aiToken, context }, { timeout: 30000 });
            return response.data?.response || 'Não consegui processar sua mensagem.';
        } catch (error: any) {
            logger.warn('AI Fallback trigger:', error.message);
            return 'O assistente está temporariamente offline.';
        }
    }

    private buildPrompt(userMessage: string, context?: any) {
        return `Você é um assistente ERP. Contexto: ${JSON.stringify(context)}. Mensagem: ${userMessage}`;
    }
}

export const aiService = new AIService();
