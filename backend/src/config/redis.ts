import { Redis } from 'ioredis';

const redisConfig: any = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false, // Don't queue commands if offline
    connectTimeout: 5000,
    retryStrategy: (times: number) => {
        // Slow down retries or stop after some point
        if (times > 3) return null; // Stop retrying after 3 times to avoid flooding
        return Math.min(times * 500, 2000);
    }
};

export const connection = new Redis(redisConfig);

connection.on('error', (err) => {
    // Only log once to avoid flooding
    if ((connection as any)._loggedError) return;
    console.warn('âš ï¸ Redis Connection Error:', err.message);
    (connection as any)._loggedError = true;
});

connection.on('connect', () => {
    console.log('✅ Redis Connected');
    (connection as any)._loggedError = false;
});
