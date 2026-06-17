import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Wakes the database before the suite runs.
 *
 * The test database (Neon) scales to zero after inactivity on the free tier.
 * The first connection during a cold start fails with
 * `PrismaClientInitializationError: Can't reach database server`, which would
 * otherwise take down the entire first batch of DB-dependent suites even though
 * the code is fine. We retry a lightweight `SELECT 1` with backoff until the
 * server is reachable, so the suite only starts once the DB is awake.
 */
export default async function globalSetup(): Promise<void> {
    if (!process.env.DATABASE_URL) {
        console.warn('[jest] DATABASE_URL not set — skipping database warm-up');
        return;
    }

    const prisma = new PrismaClient();
    const maxAttempts = 8;
    let lastErr: unknown;

    try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await prisma.$queryRaw`SELECT 1`;
                if (attempt > 1) {
                    console.log(`[jest] database reachable after ${attempt} attempt(s)`);
                }
                return;
            } catch (err) {
                lastErr = err;
                const delay = Math.min(1000 * attempt, 5000);
                console.warn(
                    `[jest] database not reachable (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw new Error(
            `[jest] database unreachable after ${maxAttempts} attempts — aborting test run. Last error: ${String(lastErr)}`
        );
    } finally {
        await prisma.$disconnect();
    }
}
