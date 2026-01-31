type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
    private isDevelopment: boolean;

    constructor() {
        this.isDevelopment = import.meta.env.DEV;
    }

    private formatMessage(level: LogLevel, message: string, ...args: any[]): void {
        if (!this.isDevelopment && level === 'debug') return;

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

    info(message: string, ...args: any[]): void {
        this.formatMessage('info', message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.formatMessage('warn', message, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.formatMessage('error', message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.formatMessage('debug', message, ...args);
    }
}

export const logger = new Logger();
