import { Queue } from 'bullmq';
import { redis } from '../config/redis';

/**
 * Email job queue — null when Redis is not configured.
 * Producers must check for null before calling .add().
 */
export const emailQueue: Queue | null = redis
    ? new Queue('email-queue', { connection: redis })
    : null;

export const JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 50,
};
