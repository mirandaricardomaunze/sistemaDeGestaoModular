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

    async generateResponse(originalMessage: string, _companyId: string, context?: any, module?: string): Promise<{ message: string; toolCall?: { name: string; args: any } }> {
        this.init();

        if (!this.model) {
            return { message: 'O assistente de IA não está configurado. Por favor, adicione a GEMINI_API_KEY no ficheiro .env.' };
        }

        try {
            const systemPrompt = this.buildSystemPrompt(context, module);
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

    private buildSystemPrompt(context?: any, module?: string) {
        const businessInfo = context?.companyInfo 
            ? `Empresa: ${context.companyInfo.name} (${context.companyInfo.businessType}). `
            : '';
            
        let modulePersona = 'Você é o "Multicore AI", um assistente virtual de inteligência de negócios para o sistema ERP Multicore.';
        
        if (module === 'pharmacy') {
            modulePersona = 'Você é o "Assistente de Farmácia Multicore". Você é um especialista em gestão farmacêutica, controle de medicamentos e conformidade sanitária.';
        } else if (module === 'hospitality' || module === 'hotel') {
            modulePersona = 'Você é o "Assistente de Hospitalidade Multicore". Você é um especialista em gestão hoteleira, ocupação de quartos e experiência do hóspede.';
        } else if (module === 'commercial') {
            modulePersona = 'Você é o "Assistente Comercial Multicore". Você é um especialista em vendas, margens de lucro, análise de stock e gestão de retalho.';
        } else if (module === 'restaurant') {
            modulePersona = 'Você é o "Assistente de Restaurante Multicore". Você é um especialista em gestão de F&B (Food & Beverage), controlo de mesas e performance de cozinha.';
        } else if (module === 'logistics') {
            modulePersona = 'Você é o "Assistente de Logística Multicore". Você é um especialista em gestão de frotas, rotas de entrega e eficiência operacional.';
        }

        return `${modulePersona}
${businessInfo}
Objetivo: Fornecer resumos executivos profissionais, precisos e baseados nos dados reais fornecidos para o módulo específico: ${module || 'Geral'}.

Diretrizes de Resposta:
1. Tom: Profissional, executivo, direto e útil.
2. Formatação: O painel suporta e encoraja a formatação rica em Markdown. Utilize negrito (**texto**) para destacar totalizadores e títulos. TABELAS: Sempre que listar funcionários, vendas ou produtos, utilize OBRIGATORIAMENTE uma tabela Markdown devidamente alinhada.
3. Referências: NUNCA exiba a propriedade interna "code" (IDs que começam por PROD-). Utilize sempre a propriedade "barcode" ou apenas "Nome" do produto para apresentar ao utilizador.
4. Exatidão: Utilize APENAS os dados fornecidos no "Contexto atual". Se os dados estiverem vazios, não diga apenas que não há registos; seja proativo e ajude o utilizador.
5. Moeda: Use sempre a abreviatura "MT" acompanhada de formatação monetária (ex: 12.500,00 MT).
6. **Relatórios PDF**: Chame a ferramenta 'generate_pdf_report' APENAS quando o usuário solicitar explicitamente ("gera um pdf", "exporta para pdf", etc).

Contexto atual: ${JSON.stringify(context || {})}
Responda em Português de Moçambique/Portugal.`;
    }
}

export const aiService = new AIService();
