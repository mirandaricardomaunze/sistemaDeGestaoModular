import { redis } from '../config/redis';

/**
 * Blacklist a JWT token until its natural expiry.
 * Fails silently if Redis is unavailable.
 */
export async function blacklistToken(token: string, expiresAt: number): Promise<void> {
    if (!redis) return;
    const ttl = expiresAt - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;
    try {
        await redis.set(`blacklist:${token}`, '1', 'EX', ttl);
    } catch {
        // Redis unavailable — token blacklisting skipped (non-critical)
    }
}

/**
 * Returns true if the token has been explicitly revoked.
 * Fails open (returns false) if Redis is unavailable — never blocks requests.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
    if (!redis) return false;
    try {
        return (await redis.get(`blacklist:${token}`)) !== null;
    } catch {
        return false; // fail open
    }
}
