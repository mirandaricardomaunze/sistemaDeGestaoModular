import { Queue } from 'bullmq';
import { redis } from '../config/redis';

// ── P5 Performance Fix — Audit Log Queue ─────────────────────────────────────
// A extensão do Prisma fazia auditLog.create() fire-and-forget em cada mutação
// (1 query extra por CRUD, sem batching). Agora enfileira em Redis via BullMQ.
// O worker (createAuditWorker) processa com concurrency=5 e max 50 writes/s.
// Fallback automático: se Redis não disponível, o prisma.ts escreve directamente.
//
// Producers (src/lib/prisma.ts) devem verificar `if (auditQueue)` antes de .add().

export const auditQueue: Queue | null = redis
    ? new Queue('audit-log', { connection: redis })
    : null;

export const AUDIT_JOB_OPTIONS = {
    removeOnComplete: 100,  // manter últimos 100 jobs concluídos para debug
    removeOnFail: 50,       // manter últimos 50 jobs falhados
} as const;
