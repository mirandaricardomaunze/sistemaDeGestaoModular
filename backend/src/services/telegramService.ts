import TelegramBot from 'node-telegram-bot-api';
import { chatService } from './chatService';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class TelegramService {
    private bot: TelegramBot | null = null;

    async initialize() {
        const token = process.env.TELEGRAM_TOKEN;
        if (!token) return;
        this.bot = new TelegramBot(token, { polling: true });
        this.bot.on('message', (msg) => this.handleMessage(msg));
    }

    private async handleMessage(msg: TelegramBot.Message) {
        if (!msg.text || !this.bot) return;
        const companyId = process.env.DEFAULT_COMPANY_ID; // Simplified for multi-tenancy
        if (!companyId) return;

        const response = await chatService.processMessage(msg.text, 'telegram', companyId);
        this.bot.sendMessage(msg.chat.id, response.message);
    }
}

export const telegramService = new TelegramService();
