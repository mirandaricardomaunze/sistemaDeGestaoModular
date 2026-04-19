import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { logger } from '../utils/logger';

export class AIService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    private init() {
        if (this.genAI) return;
        const apiKey = process.env.GEMINI_API_KEY;
        const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
        
        if (!apiKey) {
            logger.warn('GEMINI_API_KEY não encontrada no .env');
            return;
        }
        
        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel(
                { 
                    model: modelName,
                    tools: [
                        {
                            functionDeclarations: [
                                {
                                    name: "generate_pdf_report",
                                    description: "Gera um relatório profissional em PDF com os dados atuais do sistema (vendas, estoque, finanças ou clientes). Chame esta ferramenta APENAS quando o usuário solicitar explicitamente um PDF ou exportação.",
                                    parameters: {
                                        type: SchemaType.OBJECT,
                                        properties: {
                                            reportType: {
                                                type: SchemaType.STRING,
                                                format: "enum",
                                                description: "O tipo de relatório a gerar: 'sales' (vendas), 'inventory' (resumo de estoque), 'inventory_table' (tabela detalhada de estoque), 'quotation' (cotação/orçamento), 'price_list' (catlogo de preços), 'financial' (financeiro), 'customers' (clientes), 'hr' (recursos humanos).",
                                                enum: ['sales', 'inventory', 'inventory_table', 'quotation', 'price_list', 'financial', 'customers', 'hr']
                                            }
                                        },
                                        required: ["reportType"]
                                    }
                                }
                            ]
                        }
                    ]
                },
                { apiVersion: 'v1beta' }
            );
            logger.info(`Gemini AI inicializado com suporte a ferramentas (Modelo: ${modelName})`);
        } catch (error: any) {
            logger.error('Erro ao inicializar Gemini AI:', error.message);
        }
    }

    async generateResponse(originalMessage: string, _companyId: string, context?: any): Promise<{ message: string; toolCall?: { name: string; args: any } }> {
        this.init();

        if (!this.model) {
            return { message: 'O assistente de IA não está configurado. Por favor, adicione a GEMINI_API_KEY no ficheiro .env.' };
        }

        try {
            const systemPrompt = this.buildSystemPrompt(context);
            const prompt = `${systemPrompt}\n\nPergunta do Usuário: ${originalMessage}\n\nResposta do Assistente:`;
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            
            // Verificar chamadas de ferramentas (Function Calling)
            const candidate = response.candidates?.[0];
            const call = candidate?.content?.parts?.find((p: any) => p.functionCall);
            
            if (call) {
                logger.info(`IA solicitou execução da ferramenta: ${call.functionCall.name}`);
                return {
                    message: "Certo, estou a gerar o relatório PDF solicitado...",
                    toolCall: {
                        name: call.functionCall.name,
                        args: call.functionCall.args
                    }
                };
            }

            const text = response.text();
            return { message: text || 'Não consegui processar sua mensagem.' };
        } catch (error: any) {
            const msg = error.message || 'Erro desconhecido';
            logger.error(`Gemini AI Error (Model: ${this.model?.model || 'unknown'}): ${msg}`);
            
            return { 
                message: `Lamento, ocorreu um erro ao comunicar com a IA. (Erro: ${msg.substring(0, 100)}...)` 
            };
        }
    }

    private buildSystemPrompt(context?: any) {
        const businessInfo = context?.companyInfo 
            ? `Empresa: ${context.companyInfo.name} (${context.companyInfo.businessType}). `
            : '';
            
        return `Você é o "Multicore AI", um assistente virtual de inteligência de negócios para o sistema ERP Multicore.
${businessInfo}
Objetivo: Fornecer resumos executivos profissionais, precisos e baseados nos dados reais fornecidos.

Diretrizes de Resposta:
1. Tom: Profissional, executivo, direto e útil.
2. Formatação: Não utilize símbolos de formatação Markdown como asteriscos (** ou *) ou underscores (_) para negrito ou listas. Use apenas texto simples e quebras de linha claras. TABELAS: Sempre que listar múltiplos funcionários ou produtos, utilize OBRIGATORIAMENTE uma tabela Markdown com as colunas adequadas (ex para inventrio: Nome, Referência, Cód. Barras e Quantidade). Estilize a tabela sem negrito.
3. Exatidão: Utilize APENAS os dados fornecidos no "Contexto atual". Se os dados estiverem vazios ou com status 'empty_inventory', não diga apenas que não há registos; procure ser proativo. Informe que o sistema está pronto e pergunte se o utilizador deseja ajuda para registar o primeiro produto ou importar dados.
4. Moeda: Use sempre "MT" (Meticais).
5. Se o utilizador pedir um "relatório", "tabela" ou simplesmente "mostrar produtos", use o formato de tabela Markdown.
6. **Relatórios PDF**: Chame a ferramenta 'generate_pdf_report' APENAS quando o usuário solicitar explicitamente ("gera um pdf", "exporta para pdf", etc).

Contexto atual: ${JSON.stringify(context || {})}
Responda em Português de Moçambique/Portugal.`;
    }
}

export const aiService = new AIService();
