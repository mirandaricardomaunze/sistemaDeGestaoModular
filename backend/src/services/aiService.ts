import axios from 'axios';
import { logger } from '../utils/logger';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chat-ai';
const N8N_TIMEOUT = parseInt(process.env.N8N_TIMEOUT || '30000', 10);

export class AIService {
    /**
     * Envia prompt para n8n (Gemini) e retorna resposta
     */
    async generateResponse(prompt: string, context?: any): Promise<string> {
        try {
            const response = await axios.post(N8N_WEBHOOK_URL, {
                message: prompt,
                context: context || {},
                timestamp: new Date().toISOString()
            }, {
                timeout: N8N_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // n8n retorna { response, timestamp, provider, model }
            return response.data.response || response.data.text || 'Desculpe, não consegui processar sua mensagem.';
        } catch (error: any) {
            logger.error('n8n/Gemini error:', error);

            // Sempre usar fallback quando n8n não estiver disponível
            logger.warn('n8n unavailable, using fallback response');
            return this.generateFallbackResponse(prompt, context);
        }
    }

    /**
     * Constrói prompt com contexto do sistema
     */
    private buildPrompt(userMessage: string, context?: any): string {
        const systemPrompt = `Você é um assistente inteligente de um sistema ERP moçambicano.

DADOS DISPONÍVEIS:
${context ? JSON.stringify(context, null, 2) : 'Nenhum dado disponível no momento'}

REGRAS:
1. Responda SEMPRE em português de Moçambique
2. Seja conciso e profissional (máximo 200 palavras)
3. Use os dados fornecidos para fundamentar sua resposta
4. Se não souber ou não tiver dados, diga claramente
5. Formate valores monetários em MZN (Meticais)
6. Use bullet points para listas
7. Sugira ações práticas quando apropriado

PERGUNTA DO USUÁRIO: ${userMessage}

RESPOSTA:`;

        return systemPrompt;
    }

    /**
     * Gera resumo executivo baseado em tipo
     */
    async generateSummary(data: any, type: 'sales' | 'inventory' | 'financial'): Promise<string> {
        const prompts = {
            sales: `Analise os dados de vendas abaixo e crie um resumo executivo profissional:

DADOS:
${JSON.stringify(data, null, 2)}

Inclua:
- Total de vendas e número de transações
- Produtos mais vendidos (top 3)
- Tendências observadas
- Recomendações de ação`,

            inventory: `Analise o inventário abaixo e crie um resumo executivo:

DADOS:
${JSON.stringify(data, null, 2)}

Inclua:
- Produtos com stock crítico (abaixo do mínimo)
- Produtos parados (sem movimento)
- Valor total imobilizado em stock
- Ações recomendadas urgentes`,

            financial: `Analise os dados financeiros e crie um resumo executivo:

DADOS:
${JSON.stringify(data, null, 2)}

Inclua:
- Receita total e número de transações
- Ticket médio
- Análise de tendência
- Recomendações financeiras`
        };

        return this.generateResponse(prompts[type]);
    }

    /**
     * Resposta de fallback quando Ollama não está disponível
     */
    private generateFallbackResponse(message: string, context?: any): string {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('venda') || lowerMessage.includes('vendeu')) {
            if (context?.total !== undefined) {
                return `📊 Resumo de Vendas:\n\n` +
                    `• Total: ${this.formatCurrency(context.total)}\n` +
                    `• Transações: ${context.count || 0}\n` +
                    `• Ticket Médio: ${this.formatCurrency(context.average || 0)}\n\n` +
                    `ℹ️ Resposta gerada sem IA (Ollama offline)`;
            }
        }

        if (lowerMessage.includes('stock') || lowerMessage.includes('estoque')) {
            if (context?.lowStockCount !== undefined) {
                return `📦 Resumo de Inventário:\n\n` +
                    `• Total de Produtos: ${context.totalProducts || 0}\n` +
                    `• Produtos com Stock Baixo: ${context.lowStockCount}\n` +
                    `• Valor Total: ${this.formatCurrency(context.totalValue || 0)}\n\n` +
                    `⚠️ ${context.lowStockCount} produtos precisam de reposição!\n\n` +
                    `ℹ️ Resposta gerada sem IA (Ollama offline)`;
            }
        }

        return `Recebi sua mensagem: "${message}"\n\n` +
            `ℹ️ O assistente de IA está temporariamente indisponível. ` +
            `Tente novamente em alguns instantes ou use os comandos específicos do sistema.`;
    }

    /**
     * Formata valor monetário
     */
    private formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(value);
    }

    /**
     * Verifica se n8n está disponível
     */
    async checkHealth(): Promise<boolean> {
        try {
            // Fazer uma requisição simples ao webhook n8n
            const response = await axios.post(N8N_WEBHOOK_URL, {
                message: 'health check',
                context: {},
                healthCheck: true
            }, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            logger.warn('n8n health check failed');
            return false;
        }
    }
}

export const aiService = new AIService();
