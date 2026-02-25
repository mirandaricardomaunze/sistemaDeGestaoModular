import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

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
                console.warn('⚠️  Conexão com Redis perdida, usando rate limiting em memória');
                useRedis = false;
            }
        });

        redisClient.on('ready', () => {
            console.log('✅ Redis conectado e pronto para rate limiting');
            useRedis = true;
        });

        // Initially assume it's NOT usable until 'ready'
        useRedis = false;
    } catch (error) {
        console.warn('⚠️  Erro ao configurar Redis, usando rate limiting em memória');
        redisClient = null;
        useRedis = false;
    }
} else {
    console.warn('⚠️  Configuração Redis ausente, usando rate limiting em memória');
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
        'Limite de operações de escrita excedido.'
    ),
};

export default createRateLimiter;
