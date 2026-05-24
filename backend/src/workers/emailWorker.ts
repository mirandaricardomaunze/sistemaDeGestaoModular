import { Worker } from 'bullmq';
import { connection } from '../config/redis';
import {
    sendPasswordResetEmail,
    sendExpirationAlert,
    sendStockAlert,
    sendBookingConfirmation,
    sendDeliveryNotification,
    sendRecallAlert,
    sendInvoiceEmail,
    sendNoteEmail,
} from '../utils/mail';
import { logger } from '../utils/logger';

/**
 * Create the email worker. Called after Redis has been initialized.
 * Returns null when Redis is not available.
 */
export function createEmailWorker(): Worker | null {
    if (!connection) return null;

    const worker = new Worker(
        'email-queue',
        async (job) => {
            switch (job.name) {
                case 'password-reset':
                    await sendPasswordResetEmail(job.data.to, job.data.name, job.data.otp);
                    logger.info('Password reset email sent', { to: job.data.to });
                    break;
                case 'expiration-alert':
                    await sendExpirationAlert(job.data);
                    logger.info('Expiration alert sent', { to: job.data.email });
                    break;
                case 'stock-alert':
                    await sendStockAlert(job.data);
                    logger.info('Stock alert sent', { to: job.data.email, product: job.data.productName });
                    break;
                case 'booking-confirmation':
                    await sendBookingConfirmation(job.data);
                    logger.info('Booking confirmation sent', { to: job.data.email });
                    break;
                case 'delivery-notification':
                    await sendDeliveryNotification(job.data);
                    logger.info('Delivery notification sent', { to: job.data.email, ref: job.data.deliveryNumber });
                    break;
                case 'recall-alert':
                    await sendRecallAlert(job.data);
                    logger.info('Recall alert sent', { to: job.data.email, recall: job.data.recallNumber });
                    break;
                case 'invoice-email': {
                    const { pdfBase64, ...rest } = job.data;
                    await sendInvoiceEmail({
                        ...rest,
                        pdfBuffer: pdfBase64 ? Buffer.from(pdfBase64, 'base64') : undefined,
                    });
                    logger.info('Invoice email sent', { to: job.data.to, invoice: job.data.invoice?.invoiceNumber });
                    break;
                }
                case 'note-email': {
                    const { pdfBase64, ...rest } = job.data;
                    await sendNoteEmail({
                        ...rest,
                        pdfBuffer: pdfBase64 ? Buffer.from(pdfBase64, 'base64') : undefined,
                    });
                    logger.info('Note email sent', { to: job.data.to, type: job.data.type, number: job.data.note?.number });
                    break;
                }
                default:
                    logger.warn('Unknown email job', { name: job.name });
            }
        },
        { connection }
    );

    worker.on('completed', (job) => logger.info('Email job completed', { jobId: job.id }));
    worker.on('failed', (job, err) => logger.error('Email job failed', { jobId: job?.id, error: err.message }));

    return worker;
}
