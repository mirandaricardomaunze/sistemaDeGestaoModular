import TelegramBot from 'node-telegram-bot-api';
import { chatService } from './chatService';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

export class TelegramService {
    private bot: TelegramBot | null = null;
    private isInitialized = false;

    /**
     * Inicializa o bot do Telegram
     */
    async initialize() {
        const token = process.env.TELEGRAM_TOKEN;

        if (!token) {
            logger.warn('TELEGRAM_TOKEN não encontrado no .env. Bot do Telegram desativado.');
            return;
        }

        try {
            // Inicializa com polling
            this.bot = new TelegramBot(token, { polling: true });
            this.isInitialized = true;
            logger.info('🚀 Bot do Telegram inicializado com sucesso');

            this.setupListeners();
        } catch (error) {
            logger.error('Erro ao inicializar bot do Telegram:', error);
        }
    }

    /**
     * Configura listeners de mensagens
     */
    private setupListeners() {
        if (!this.bot) return;

        this.bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;

            if (!text) return;

            // Comando /start
            if (text === '/start') {
                return this.bot?.sendMessage(chatId,
                    '👋 Olá! Eu sou o assistente inteligente Multicore.\n\n' +
                    'Como posso ajudar você hoje?\n' +
                    'Tente perguntar: "Quanto vendi hoje?" ou "Status do stock".'
                );
            }

            try {
                // Notifica que está processando
                await this.bot?.sendChatAction(chatId, 'typing');

                // FIXME: Para multi-tenancy real em produção, precisaríamos associar o chatId a um usuário/empresa.
                // Por agora, usaremos a primeira empresa ativa ou uma empresa definida em env se disponível.
                const companyId = await this.getDefaultCompanyId();
                const userId = await this.getSystemUserId(companyId);

                if (!companyId || !userId) {
                    return this.bot?.sendMessage(chatId, '❌ Erro de configuração: Não foi possível identificar sua empresa.');
                }

                const response = await chatService.processMessage(text, userId, companyId);

                let reply = response.message;

                // Adicionar link do PDF se gerado
                if (response.pdfUrl) {
                    reply += `\n\n📄 Relatório gerado: ${process.env.BACKEND_URL || 'http://localhost:3001'}${response.pdfUrl}`;
                }

                // Sugestões
                if (response.suggestions && response.suggestions.length > 0) {
                    const opts = {
                        reply_markup: {
                            keyboard: response.suggestions.map((s: string) => [{ text: s }]),
                            one_time_keyboard: true,
                            resize_keyboard: true
                        }
                    };
                    await this.bot?.sendMessage(chatId, reply, opts);
                } else {
                    await this.bot?.sendMessage(chatId, reply);
                }

            } catch (error: any) {
                logger.error('Erro no processamento do Telegram:', error);
                this.bot?.sendMessage(chatId, '😓 Desculpe, ocorreu um erro ao processar sua solicitação.');
            }
        });

        // Erros de polling
        this.bot.on('polling_error', (error) => {
            logger.error('Telegram Polling Error:', error.message);
        });
    }

    /**
     * Busca ID da empresa padrão para o bot (Primeira empresa ou via ENV)
     */
    private async getDefaultCompanyId(): Promise<string | null> {
        const envId = process.env.DEFAULT_COMPANY_ID;
        if (envId) return envId;

        const company = await prisma.company.findFirst({
            where: { status: 'active' },
            orderBy: { createdAt: 'asc' }
        });

        return company?.id || null;
    }

    /**
     * Busca um ID de usuário administrativo para a empresa
     */
    private async getSystemUserId(companyId: string): Promise<string | null> {
        const user = await prisma.user.findFirst({
            where: { companyId, role: 'admin' }
        });

        return user?.id || null;
    }

    /**
     * Envia mensagem proativa (notificações, alertas)
     */
    async sendMessage(chatId: string | number, text: string) {
        if (!this.bot || !this.isInitialized) return;
        return this.bot.sendMessage(chatId, text);
    }
}

export const telegramService = new TelegramService();
