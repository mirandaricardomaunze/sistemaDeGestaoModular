import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { alertsService, checkExpiringBatches } from '../services/alertService';
import { commercialService } from '../services/commercialService';
import { logger } from '../utils/logger';

const runAlertGeneration = async () => {
    const companies = await prisma.company.findMany({
        where: { status: 'active' },
        select: { id: true, name: true }
    });
    for (const company of companies) {
        logger.info(`Generating alerts for company: ${company.name}`);
        await alertsService.generate(company.id);
    }
};

export const startCronJobs = () => {
    // Run daily at midnight -- full check + email notifications
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running daily automated tasks...');
        try {
            await runAlertGeneration();
            await checkExpiringBatches();
        } catch (error) {
            logger.error('Error running daily automated tasks:', error);
        }
    });

    // Run every 6 hours -- stock and expiry alert refresh
    cron.schedule('0 */6 * * *', async () => {
        logger.info('Running 6-hour alert refresh...');
        try {
            await runAlertGeneration();
        } catch (error) {
            logger.error('Error running 6-hour alert refresh:', error);
        }
    });

    // Run every minute -- Stock Reservation Cleanup
    cron.schedule('* * * * *', async () => {
        try {
            await commercialService.cleanupExpiredReservations();
        } catch (error) {
            logger.error('Error running stock reservation cleanup:', error);
        }
    });

    logger.info('Cron jobs scheduled: Daily (00:00) + 6-hour refresh + 1-min reservation cleanup');
};
