type LogLevel = 'info' | 'warn' | 'error' | 'debug';

import { env } from '../config/env';

class Logger {
    private isDevelopment: boolean;

    constructor() {
        this.isDevelopment = env.MODE === 'development';
    }

    private formatMessage(level: LogLevel, message: string, ...args: unknown[]): void {
        // In production, only emit errors
        if (!this.isDevelopment && level !== 'error') return;

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        switch (level) {
            case 'info':
                console.log(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            case 'error':
                console.error(prefix, message, ...args);
                break;
            case 'debug':
                console.debug(prefix, message, ...args);
                break;
        }
    }

    info(message: string, ...args: unknown[]): void {
        this.formatMessage('info', message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.formatMessage('warn', message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        this.formatMessage('error', message, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        this.formatMessage('debug', message, ...args);
    }
}

export const logger = new Logger();
