import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

if (!redis) {
    logger.warn('Rate limiting using in-memory store (Redis not configured)');
}

function createRateLimiter(windowMs: number, max: number, message: string) {
    const config: Parameters<typeof rateLimit>[0] = {
        windowMs,
        max,
        message: { error: 'Too Many Requests', message },
        standardHeaders: true,
        legacyHeaders: false,
        store: redis
            ? new RedisStore({
                  sendCommand: (...args: string[]) => (redis as any).call(...args),
                  prefix: 'rl:',
              })
            : undefined, // undefined → express-rate-limit uses its built-in in-memory store
    };

    return rateLimit(config);
}

export const rateLimiters = {
    auth: createRateLimiter(
        15 * 60 * 1000, 10,
        'Demasiadas tentativas de login. Tente novamente em 15 minutos.'
    ),
    api: createRateLimiter(
        60 * 1000, 100,
        'Limite de requisições excedido. Aguarde um momento.'
    ),
    read: createRateLimiter(
        60 * 1000, 200,
        'Limite de requisições excedido.'
    ),
    passwordReset: createRateLimiter(
        60 * 60 * 1000, 3,
        'Limite de recuperação de senha excedido. Tente novamente em 1 hora.'
    ),
    write: createRateLimiter(
        60 * 1000, 30,
        'Limite de operações de escrita excedido.'
    ),
    financial: createRateLimiter(
        60 * 1000, 20,
        'Limite de operações financeiras excedido. Aguarde um momento.'
    ),
    export: createRateLimiter(
        60 * 60 * 1000, 10,
        'Limite de exportação de dados excedido. Tente novamente em 1 hora.'
    ),
};

export default createRateLimiter;
