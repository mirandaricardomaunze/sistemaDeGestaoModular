import { Queue } from 'bullmq';
import { connection } from '../config/redis';

export const emailQueue = new Queue('email-queue', { connection });

export const addEmailToQueue = async (email: string, otp: string) => {
    return emailQueue.add('send-otp', { email, otp }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 100
    });
};
