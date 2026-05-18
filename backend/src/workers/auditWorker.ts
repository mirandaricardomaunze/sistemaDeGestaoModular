import { Worker } from 'bullmq';
import { connection } from '../config/redis';
import { logger } from '../utils/logger';

// ── P5 Performance Fix — Audit Log Worker ────────────────────────────────────
// Processa jobs da auditQueue (enfileirados pelo Prisma Extension em prisma.ts)
// com concurrency=5 e rate limit de 50 writes/segundo para proteger a BD.
//
// Desactivado automaticamente quando Redis não está disponível (connection = null).
// Nesse caso, o prisma.ts usa fallback de escrita directa (comportamento anterior).

/**
 * Create the audit log worker. Called after Redis has been initialized.
 * Returns null when Redis is not available (graceful degradation).
 */
export function createAuditWorker(): Worker | null {
    if (!connection) return null;

    const worker = new Worker(
        'audit-log',
        async (job) => {
            // Late import to avoid circular dependency (auditQueue → prisma → auditQueue)
            const { basePrisma } = await import('../lib/prismaBase');
            const { userId, userName, action, entity, entityId, newData, companyId } = job.data as {
                userId: string | undefined;
                userName: string;
                action: string;
                entity: string;
                entityId: string;
                newData: object | undefined;
                companyId: string;
            };

            await basePrisma.auditLog.create({
                data: { userId, userName, action, entity, entityId, newData, companyId },
            });
        },
        {
            connection,
            concurrency: 5,
            limiter: { max: 50, duration: 1000 }, // máx 50 writes/segundo
        }
    );

    worker.on('completed', (job) => logger.debug('Audit log written', { jobId: job.id }));
    worker.on('failed', (job, err) => logger.error('Audit log worker failed', {
        jobId: job?.id,
        error: err.message,
    }));

    return worker;
}
