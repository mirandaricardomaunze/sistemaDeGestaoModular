import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export const IDEMPOTENCY_HEADER = 'x-client-operation-id';
const TTL_SECONDS = 24 * 60 * 60; // 24h
const MEMORY_MAX_ENTRIES = 5000;

interface CachedResponse {
    statusCode: number;
    body: unknown;
    storedAt: number;
}

const memoryStore = new Map<string, CachedResponse>();

function memoryGet(key: string): CachedResponse | null {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > TTL_SECONDS * 1000) {
        memoryStore.delete(key);
        return null;
    }
    return entry;
}

function memorySet(key: string, value: CachedResponse): void {
    if (memoryStore.size >= MEMORY_MAX_ENTRIES) {
        const firstKey = memoryStore.keys().next().value;
        if (firstKey) memoryStore.delete(firstKey);
    }
    memoryStore.set(key, value);
}

function buildKey(companyId: string, clientId: string): string {
    return `idemp:${companyId}:${clientId}`;
}

async function readCached(key: string): Promise<CachedResponse | null> {
    if (redis) {
        try {
            const raw = await redis.get(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            logger.warn('idempotency: redis read failed, falling back to memory', e as Error);
        }
    }
    return memoryGet(key);
}

async function writeCached(key: string, value: CachedResponse): Promise<void> {
    if (redis) {
        try {
            await redis.set(key, JSON.stringify(value), 'EX', TTL_SECONDS);
            return;
        } catch (e) {
            logger.warn('idempotency: redis write failed, falling back to memory', e as Error);
        }
    }
    memorySet(key, value);
}

/**
 * Lightweight JWT decode that only extracts companyId. Does NOT enforce
 * blacklist or DB lookups — if the token is invalid the route's own
 * `authenticate` middleware will reject it later. We only need a stable
 * tenant scope to key the idempotency cache.
 */
function extractCompanyId(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    try {
        const decoded = jwt.verify(authHeader.substring(7), secret, {
            algorithms: ['HS256'],
        }) as { companyId?: string };
        return decoded.companyId ?? null;
    } catch {
        return null;
    }
}

/**
 * Replays the cached response when a request carrying a previously seen
 * `X-Client-Operation-Id` header arrives. Makes POST/PUT/PATCH/DELETE
 * safe to retry from the offline queue without creating duplicates.
 *
 * - Scoped per tenant so two companies can never collide on the same key.
 * - Only caches 2xx responses; non-2xx replays go through to the handler again.
 */
export async function idempotency(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return next();
    }

    const clientId = req.header(IDEMPOTENCY_HEADER);
    if (!clientId) return next();

    const companyId = extractCompanyId(req);
    if (!companyId) return next();

    const key = buildKey(companyId, clientId);

    try {
        const cached = await readCached(key);
        if (cached) {
            res.setHeader('X-Idempotent-Replay', 'true');
            res.status(cached.statusCode).json(cached.body);
            return;
        }
    } catch (e) {
        logger.warn('idempotency: read error, proceeding without cache', e as Error);
    }

    const originalJson = res.json.bind(res);
    let captured = false;
    res.json = (body: unknown) => {
        if (!captured) {
            captured = true;
            const status = res.statusCode;
            if (status >= 200 && status < 300) {
                writeCached(key, {
                    statusCode: status,
                    body,
                    storedAt: Date.now(),
                }).catch(() => {});
            }
        }
        return originalJson(body);
    };

    next();
}
