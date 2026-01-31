import axios from 'axios';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chat-ai';
const N8N_TIMEOUT = parseInt(process.env.N8N_TIMEOUT || '30000', 10);

export class AIService {
    /**
     * Envia prompt para n8n (Gemini) e retorna resposta
     */
    async generateResponse(originalMessage: string, companyId: string, context?: any): Promise<string> {
        const fullPrompt = this.buildPrompt(originalMessage, context);

        try {
            logger.info('Attempting n8n AI response...');
            // Gera um token dinâmico para esta interação (expira em 1h)
            const aiToken = jwt.sign(
                { companyId, purpose: 'ai_action' },
                process.env.JWT_SECRET || 'multicore_secret_key_2024',
                { expiresIn: '1h' }
            );

            const response = await axios.post(N8N_WEBHOOK_URL, {
                message: fullPrompt,
                originalMessage,
                companyId,
                aiToken, // Token dinâmico enviado ao n8n
                context: context || {},
                timestamp: new Date().toISOString()
            }, {
                timeout: N8N_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            // Log para debug - ver exatamente o que o n8n retorna
            logger.info(`[n8n Response] Raw data: ${JSON.stringify(response.data)}`);

            // Normalizar resposta - n8n pode retornar array ou objeto
            let data = response.data;
            if (Array.isArray(data) && data.length > 0) {
                data = data[0]; // Pegar primeiro item do array
            }

            // Parsing flexível - tentar múltiplos formatos comuns
            const aiResponse =
                data?.response ||          // Formato padrão
                data?.text ||              // Alternativo
                data?.output ||            // Gemini via n8n
                data?.message ||           // Outro formato comum
                data?.result ||            // Mais um formato
                (typeof data === 'string' ? data : null) ||  // Resposta direta como string
                'Desculpe, não consegui processar sua mensagem.';

            return aiResponse;
        } catch (error: any) {
            logger.warn('n8n request failed, attempting direct Gemini fallback...', error.message);

            // Try Direct Gemini Fallback - pass both so it can use fullPrompt for AI and originalMessage for fallback
            return this.generateGeminiResponse(fullPrompt, originalMessage, context);
        }
    }

    /**
     * Chamada direta para o Google Gemini API
     */
    private async generateGeminiResponse(fullPrompt: string, originalMessage: string, context?: any): Promise<string> {
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_KEY) {
            logger.error('GEMINI_API_KEY not found in .env');
            return this.generateFallbackResponse(originalMessage, context);
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
            const response = await axios.post(url, {
                contents: [{
                    parts: [{ text: fullPrompt }]
                }]
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            return aiText || 'O sistema está processando dados, tente novamente em instantes.';
        } catch (error: any) {
            logger.error('Gemini direct API error:', error.message);
            return this.generateFallbackResponse(originalMessage, context);
        }
    }

    /**
     * Constrói prompt com contexto do sistema
     */
    private buildPrompt(userMessage: string, context?: any): string {
        const systemPrompt = `Você é um assistente inteligente de um sistema ERP moçambicano.

DADOS DA EMPRESA:
- Nome: ${context?.companyInfo?.name || 'Multicore System'}
- Ramo: ${context?.companyInfo?.businessType || 'Gestão Empresarial'}

DADOS DA CONSULTA:
${context && Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : 'Nenhum dado detalhado disponível no momento para esta consulta.'}

REGRAS:
1. Responda SEMPRE em português de Moçambique
2. Seja conciso e profissional (máximo 200 palavras)
3. Use os dados fornecidos para fundamentar sua resposta
4. Se não souber ou não tiver dados, utilize as FERRAMENTAS DISPONÍVEIS abaixo solicitando ao sistema
5. Formate valores monetários em MZN (Meticais)
6. Use bullet points para listas
7. Sugira ações práticas quando apropriado
8. Garanta que a resposta use codificação UTF-8 e caracteres especiais (ã, é, etc.) funcionem corretamente

FERRAMENTAS DISPONÍVEIS (Pode solicitar chamadas a estes endpoints se precisar de mais dados):
- get_sales_summary: Resumo de vendas (params: period='today'|'yesterday'|'week')
- get_stock_alerts: Alertas de stock baixo e rutura
- get_financial_status: Status financeiro básico (receita do dia)
- get_hotel_occupancy: Taxa de ocupação e status dos quartos
- get_pharmacy_alerts: Medicamentos a expirar e stock crítico

PERGUNTA DO USUÁRIO: ${userMessage}

RESPOSTA:`;

        return systemPrompt;
    }

    /**
     * Gera resumo executivo baseado em tipo
     */
    async generateSummary(data: any, type: 'sales' | 'inventory' | 'financial', companyId: string): Promise<string> {
        const prompts: Record<string, string> = {
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

        return this.generateResponse(prompts[type], companyId, data);
    }

    /**
     * Resposta de fallback quando n8n e Gemini falham
     */
    private generateFallbackResponse(message: string, context?: any): string {
        const lowerMessage = message.toLowerCase();

        // Se tivermos contexto, tentar dar uma resposta estruturada básica
        if (context && Object.keys(context).length > 0) {
            // Vendas
            if (lowerMessage.includes('venda') || lowerMessage.includes('vendeu')) {
                if (context.total !== undefined) {
                    return `📊 Resumo de Vendas:\n\n` +
                        `• Total: ${this.formatCurrency(context.total)}\n` +
                        `• Transações: ${context.count || 0}\n` +
                        `• Ticket Médio: ${this.formatCurrency(context.average || 0)}\n\n` +
                        `ℹ️ Resposta gerada sem IA (Serviços offline)`;
                }
            }

            // Stock
            if (lowerMessage.includes('stock') || lowerMessage.includes('estoque')) {
                if (context.lowStockCount !== undefined || context.totalProducts !== undefined) {
                    return `📦 Resumo de Inventário:\n\n` +
                        `• Total de Produtos: ${context.totalProducts || 0}\n` +
                        `• Produtos com Stock Baixo: ${context.lowStockCount || 0}\n` +
                        `• Valor Total: ${this.formatCurrency(context.totalValue || 0)}\n\n` +
                        (context.lowStockCount > 0 ? `⚠️ ${context.lowStockCount} produtos precisam de reposição!\n\n` : '') +
                        `ℹ️ Resposta gerada sem IA (Serviços offline)`;
                }
            }

            // Hospitabilidade
            if (lowerMessage.includes('quarto') || lowerMessage.includes('reserva') || lowerMessage.includes('hóspede')) {
                if (context.occupancyRate !== undefined) {
                    return `🏨 Resumo de Hospitalidade:\n\n` +
                        `• Taxa de Ocupação: ${context.occupancyRate}%\n` +
                        `• Quartos Ocupados: ${context.occupiedRooms}\n` +
                        `• Check-ins hoje: ${context.checkinsToday}\n\n` +
                        `ℹ️ Resposta gerada sem IA`;
                }
            }

            // Farmácia
            if (lowerMessage.includes('medicamento') || lowerMessage.includes('receita') || lowerMessage.includes('farmácia')) {
                if (context.expiredCount !== undefined) {
                    return `💊 Resumo de Farmácia:\n\n` +
                        `• Medicamentos em Stock: ${context.totalMedications}\n` +
                        `• Itens Próximos do Vencimento: ${context.expiringSoonCount}\n` +
                        `• Valor em Stock: ${this.formatCurrency(context.totalValue || 0)}\n\n` +
                        `ℹ️ Resposta gerada sem IA`;
                }
            }
        }

        return `Recebi sua mensagem: "${message}"\n\n` +
            `ℹ️ O assistente inteligente Multicore está temporariamente operando em modo offline. ` +
            `Isso pode ocorrer devido a instabilidade na conexão com os servidores Gemini/n8n.\n\n` +
            `Tente comandos simples como "Vendas de hoje" ou "Stock baixo" para obter resumos automáticos.`;
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
