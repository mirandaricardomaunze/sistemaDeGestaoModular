import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Create Redis client (with fallback to in-memory if Redis is not available)
let redisClient: Redis | null = null;
let useRedis = false;

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    try {
        const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
        redisClient = new Redis(redisUrl, {
            // Remove maxRetriesPerRequest to allow internal handling or set to null
            maxRetriesPerRequest: null,
            enableReadyCheck: false, // More stable if we don't wait for ready
            lazyConnect: true,
            connectTimeout: 10000,
            retryStrategy: (times) => {
                // Try to reconnect with exponential backoff, max 10s
                const delay = Math.min(times * 100, 10000);
                return delay;
            }
        });

        redisClient.on('error', (err) => {
            if (useRedis) {
                logger.warn(`Redis rate-limit store lost (${err?.message || 'connection failed'}) -- falling back to in-memory`);
                useRedis = false;
            }
        });

        redisClient.on('ready', () => {
            logger.info('Redis connected -- rate limiting active');
            useRedis = true;
        });

        // Initially assume it's NOT usable until 'ready'
        useRedis = false;
    } catch (error) {
        logger.warn('Redis setup error -- using in-memory rate limiting');
        redisClient = null;
        useRedis = false;
    }
} else {
    logger.warn('Redis not configured -- using in-memory rate limiting');
}

/**
 * Create rate limiter with Redis store (or in-memory fallback)
 */
function createRateLimiter(windowMs: number, max: number, message: string) {
    const config: any = {
        windowMs,
        max,
        message: { error: 'Too Many Requests', message },
        standardHeaders: true,
        legacyHeaders: false,
    };

    // Use Redis if available, otherwise fall back to in-memory
    if (redisClient && useRedis) {
        config.store = new RedisStore({
            sendCommand: (...args: string[]) => (redisClient as any).call(...args),
            prefix: 'rl:',
        });
    }

    return rateLimit(config);
}

/**
 * Preset rate limiters for common use cases
 */
export const rateLimiters = {
    // Strict limit for auth endpoints
    auth: createRateLimiter(
        15 * 60 * 1000, // 15 minutes
        10,
        'Demasiadas tentativas de login. Tente novamente em 15 minutos.'
    ),

    // Standard API limit
    api: createRateLimiter(
        60 * 1000, // 1 minute
        100,
        'Limite de requisições excedido. Aguarde um momento.'
    ),

    // Relaxed limit for read operations
    read: createRateLimiter(
        60 * 1000, // 1 minute
        200,
        'Limite de requisições excedido.'
    ),

    // Very strict for password reset
    passwordReset: createRateLimiter(
        60 * 60 * 1000, // 1 hour
        3,
        'Limite de recuperação de senha excedido. Tente novamente em 1 hora.'
    ),

    // Moderate for write operations
    write: createRateLimiter(
        60 * 1000, // 1 minute
        30,
        'Limite de operaces de escrita excedido.'
    ),

    // Strict limit for financial mutations (sales, payments, invoices)
    financial: createRateLimiter(
        60 * 1000, // 1 minute
        20,
        'Limite de operaces financeiras excedido. Aguarde um momento.'
    ),

    // Very strict for data export (prevents bulk data exfiltration)
    export: createRateLimiter(
        60 * 60 * 1000, // 1 hour
        10,
        'Limite de exportação de dados excedido. Tente novamente em 1 hora.'
    ),
};

export default createRateLimiter;
