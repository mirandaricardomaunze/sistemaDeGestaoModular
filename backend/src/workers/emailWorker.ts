import { Worker } from 'bullmq';
import { connection } from '../config/redis';
import { sendOTP, sendExpirationAlert } from '../utils/mail';
import { logger } from '../utils/logger';

export const emailWorker = new Worker('email-queue', async (job) => {
    if (job.name === 'send-otp') {
        const { email, otp } = job.data;
        await sendOTP(email, otp);
        logger.info('OTP email sent', { email });
    } else if (job.name === 'expiration-alert') {
        await sendExpirationAlert(job.data);
        logger.info('Expiration alert sent', { email: job.data.email });
    }
}, { connection });

emailWorker.on('completed', (job) => {
    logger.info('Email job completed', { jobId: job.id });
});

emailWorker.on('failed', (job, err) => {
    logger.error('Email job failed', { jobId: job?.id, error: err.message });
});
