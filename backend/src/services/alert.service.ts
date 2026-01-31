import { prisma } from '../lib/prisma';
import { emailWorker } from '../workers/emailWorker';
import { Queue } from 'bullmq';
import { connection } from '../config/redis';

const emailQueue = new Queue('email-queue', { connection });

export const checkExpiringBatches = async () => {
    console.log('ðŸ” Iniciando verificação de lotes prestes a expirar...');

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const startOfTargetDay = new Date(sevenDaysFromNow);
    startOfTargetDay.setHours(0, 0, 0, 0);

    const endOfTargetDay = new Date(sevenDaysFromNow);
    endOfTargetDay.setHours(23, 59, 59, 999);

    try {
        const expiringProducts = await prisma.product.findMany({
            where: {
                expiryDate: {
                    gte: startOfTargetDay,
                    lte: endOfTargetDay
                },
                currentStock: {
                    gt: 0
                }
            },
            include: {
                company: true
            }
        });

        if (expiringProducts.length === 0) {
            console.log('✅ Nenhum produto expira em exatamente 7 dias.');
            return;
        }

        console.log(`âš ï¸ Encontrados ${expiringProducts.length} produtos para alertar.`);

        // For each product, notify admins of its company
        for (const product of expiringProducts) {
            if (!product.companyId) continue;

            const usersToNotify = await prisma.user.findMany({
                where: {
                    companyId: product.companyId,
                    role: { in: ['admin', 'manager'] }
                }
            });

            for (const user of usersToNotify) {
                if (user.email) {
                    await emailQueue.add('expiration-alert', {
                        email: user.email,
                        productName: product.name,
                        batchNumber: product.batchNumber,
                        expiryDate: product.expiryDate,
                        currentStock: product.currentStock,
                        userName: user.name
                    });
                }
            }
        }
    } catch (error) {
        console.error('âŒ Erro ao verificar lotes expirando:', error);
    }
};
