import Redis from 'ioredis';
import { logger } from '../utils/logger';

let client: Redis | null = null;

function createClient(): Redis | null {
    const url = process.env.REDIS_URL || (
        process.env.REDIS_HOST
            ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
            : null
    );

    if (!url) {
        logger.warn('Redis not configured -- token blacklist and session revocation disabled');
        return null;
    }

    const redis = new Redis(url, {
        maxRetriesPerRequest: 1,        // Fail fast -- do NOT retry indefinitely (would block requests)
        enableReadyCheck: false,
        enableOfflineQueue: false,      // Reject commands immediately when not connected
        lazyConnect: true,
        connectTimeout: 3_000,          // 3s connection timeout (was 10s -- too slow per request)
        retryStrategy: (times) => {
            if (times > 5) return null; // Stop retrying after 5 attempts
            return Math.min(times * 500, 5_000);
        },
    });

    let redisErrLogged = false;
    redis.on('ready', () => {
        redisErrLogged = false;
        logger.info('Redis connected');
    });
    redis.on('error', (err) => {
        // Avoid flooding logs -- only log once per disconnect cycle
        if (!redisErrLogged) {
            // Use 'reason' key (not 'message') so Winston does not override the log message
            logger.error(`Redis unavailable: ${err?.message || (err as any)?.code || 'connection failed'}`);
            redisErrLogged = true;
        }
    });

    return redis;
}

export function getRedis(): Redis | null {
    if (!client) client = createClient();
    return client;
}

/**
 * Blacklist a JWT token until its natural expiry.
 * @param token  Raw JWT string
 * @param expiresAt Unix timestamp (seconds) from the `exp` claim
 */
export async function blacklistToken(token: string, expiresAt: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const ttl = expiresAt - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;

    try {
        await redis.set(`blacklist:${token}`, '1', 'EX', ttl);
    } catch {
        // Redis unavailable -- token blacklisting skipped (non-critical)
    }
}

/**
 * Returns true if the token has been revoked.
 * IMPORTANT: fails open (returns false) if Redis is unavailable -- never blocks requests.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;

    try {
        const result = await redis.get(`blacklist:${token}`);
        return result !== null;
    } catch {
        // Redis unavailable -- cannot verify blacklist, allow through (fail open)
        return false;
    }
}
