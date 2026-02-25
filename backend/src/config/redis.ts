import { Redis } from 'ioredis';

const redisConfig: any = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    lazyConnect: true,
    retryStrategy: (times: number) => {
        if (times > 2) return null;
        return Math.min(times * 500, 2000);
    }
};

export const connection = new Redis(redisConfig);

let _loggedError = false;

connection.on('error', (err) => {
    if (_loggedError) return;
    console.warn('⚠️  Redis not available:', err.message, '— features using Redis will be disabled.');
    _loggedError = true;
});

connection.on('connect', () => {
    console.log('✅ Redis Connected');
    _loggedError = false;
});

// Attempt connection but don't block startup
connection.connect().catch(() => {
    if (!_loggedError) {
        console.warn('⚠️  Redis not available — running without cache/queues.');
        _loggedError = true;
    }
});
