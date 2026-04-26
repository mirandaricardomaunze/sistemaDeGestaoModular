import { Redis } from 'ioredis';
import net from 'net';
import { logger } from '../utils/logger';

const redisUrl =
    process.env.REDIS_URL ||
    (process.env.REDIS_HOST
        ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        : null);

/**
 * Shared Redis connection used by:
 *  - BullMQ (emailQueue + emailWorker)
 *  - Token blacklist (logout revocation)
 *  - Rate limiting (distributed across processes)
 *
 * We lazily initialize it after probing the port to avoid noisy
 * ECONNREFUSED errors flooding the console during development.
 */
export let redis: Redis | null = null;
export let connection: Redis | null = null;

/**
 * Probe the Redis port once before creating the ioredis client.
 * Returns true if the port is open, false otherwise.
 */
function probePort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, host);
    });
}

/**
 * Initialize Redis connection only if the server is reachable.
 * Called once at startup from index.ts.
 */
export async function initRedis(): Promise<void> {
    if (!redisUrl) {
        logger.warn('Redis not configured (REDIS_URL missing) -- token blacklist, rate limiting and email queue disabled');
        return;
    }

    // Parse host and port from the URL
    let host = '127.0.0.1';
    let port = 6379;
    try {
        const parsed = new URL(redisUrl);
        host = parsed.hostname || '127.0.0.1';
        port = parseInt(parsed.port, 10) || 6379;
    } catch { /* use defaults */ }

    const reachable = await probePort(host, port);
    if (!reachable) {
        logger.warn(`Redis not reachable at ${host}:${port} -- running without Redis (rate-limit, email queue, blacklist degraded)`);
        return;
    }

    try {
        const client = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            enableOfflineQueue: true,
            lazyConnect: true,
            connectTimeout: 3000,
            retryStrategy: (times) => {
                if (times > 3) return null;  // stop retrying if Redis goes down after initial connect
                return Math.min(times * 500, 3000);
            },
        });

        client.on('ready', () => logger.info('Redis connected'));
        client.on('error', () => {
            // Silently ignore — we already logged at startup
        });

        await client.connect();
        redis = client;
        connection = client;
        logger.info('Redis connection established');
    } catch {
        logger.warn('Redis connection failed during startup -- running without Redis');
    }
}
