import { Worker } from 'bullmq';
import { connection } from '../config/redis';
import { sendOTP, sendExpirationAlert } from '../utils/mail';

export const emailWorker = new Worker('email-queue', async (job) => {
    if (job.name === 'send-otp') {
        const { email, otp } = job.data;
        console.log(`Processing email job for ${email}`);
        await sendOTP(email, otp);
        console.log(`Email sent to ${email}`);
    } else if (job.name === 'expiration-alert') {
        console.log(`Processing expiration alert for ${job.data.email}`);
        await sendExpirationAlert(job.data);
        console.log(`Expiration alert sent to ${job.data.email}`);
    }
}, { connection });

emailWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
});
