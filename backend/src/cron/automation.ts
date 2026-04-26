import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { alertsService, checkExpiringBatches } from '../services/alertService';
import { commercialService } from '../services/commercialService';
import { backupService } from '../services/backupService';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';
import { emitToCompany } from '../lib/socket';

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeCompanies = () =>
    prisma.company.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            name: true,
            modules: { where: { isActive: true }, select: { moduleCode: true } }
        }
    });

const runAlertGeneration = async () => {
    const companies = await activeCompanies();
    for (const company of companies) {
        const moduleCodes = company.modules.map((m: { moduleCode: string }) => m.moduleCode).join(', ') || 'core only';
        logger.info(`Generating alerts for company: ${company.name} [modules: ${moduleCodes}]`);
        // generate() internally respects active modules — pharmacy alerts only if PHARMACY is active
        await alertsService.generate(company.id);
    }
};

// ── Fiscal deadline notifications ─────────────────────────────────────────────

const runFiscalDeadlineAlerts = async () => {
    const today   = new Date();
    const in7Days = new Date(Date.now() + 7 * 86400000);
    const in1Day  = new Date(Date.now() + 1 * 86400000);

    const upcoming = await prisma.fiscalDeadline.findMany({
        where: {
            status: 'pending',
            dueDate: { gte: today, lte: in7Days },
        },
        include: { company: { select: { id: true, name: true } } },
    });

    if (upcoming.length === 0) return;

    // Group by company and emit alerts
    const byCompany = new Map<string, typeof upcoming>();
    for (const d of upcoming) {
        if (!d.companyId) continue;
        if (!byCompany.has(d.companyId)) byCompany.set(d.companyId, []);
        byCompany.get(d.companyId)!.push(d);
    }

    // Persist in-app alerts for deadlines due in ≤ 1 day (urgent) or ≤ 7 days (warning)
    for (const [companyId, deadlines] of byCompany) {
        for (const deadline of deadlines) {
            const daysLeft = Math.ceil((deadline.dueDate.getTime() - today.getTime()) / 86400000);
            const isUrgent = daysLeft <= 1;

            // Avoid duplicate alerts: check if one was already created today
            const existing = await prisma.alert.findFirst({
                where: {
                    companyId,
                    type: 'payment_due',
                    message: { contains: deadline.id },
                    createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) },
                },
            });

            if (!existing) {
                await prisma.alert.create({
                    data: {
                        companyId,
                        type: 'payment_due',
                        priority: isUrgent ? 'critical' : 'high',
                        title: `Prazo fiscal: ${deadline.name}`,
                        message: `[${deadline.id}] ${deadline.name} vence em ${daysLeft} dia(s) (${deadline.dueDate.toLocaleDateString('pt-MZ')}).`,
                        module: 'fiscal',
                        isRead: false,
                    },
                });
            }
        }
    }

    // Send email summary if SMTP is configured
    const smtpUser = process.env.SMTP_USER || process.env.SMTP_PASS;
    if (!smtpUser) return;

    try {
        const transporter = nodemailer.createTransport({
            host:   process.env.SMTP_HOST,
            port:   parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS },
        });

        for (const [, deadlines] of byCompany) {
            const companySettings = await prisma.companySettings.findFirst({
                where: { companyId: deadlines[0].companyId! },
                select: { email: true, companyName: true },
            });
            if (!companySettings?.email) continue;

            const rows = deadlines
                .map(d => {
                    const days = Math.ceil((d.dueDate.getTime() - Date.now()) / 86400000);
                    return `• ${d.name} — vence em ${days} dia(s) (${d.dueDate.toLocaleDateString('pt-MZ')})`;
                })
                .join('\n');

            await transporter.sendMail({
                from:    `"${process.env.SMTP_FROM_NAME || 'ERP Sistema'}" <${process.env.SMTP_USER}>`,
                to:      companySettings.email,
                subject: `⚠️ Prazos Fiscais — ${deadlines.length} a vencer nos próximos 7 dias`,
                text:    `Olá,\n\nOs seguintes prazos fiscais estão prestes a vencer:\n\n${rows}\n\nActue com antecedência para evitar penalizações.\n\nERP Sistema`,
            }).catch(err => logger.warn('Fiscal deadline email failed', { error: err.message }));
        }
    } catch (err: any) {
        logger.warn('SMTP error during fiscal alerts', { error: err.message });
    }

    logger.info(`Fiscal deadline alerts sent for ${byCompany.size} companies (${upcoming.length} deadlines).`);
};

// ── Calendar event reminders ──────────────────────────────────────────────────

const runCalendarReminders = async () => {
    const now = new Date();

    // Find events that start within the next 60 minutes and have notifyBefore set
    const events = await prisma.calendarEvent.findMany({
        where: {
            isCompleted: false,
            notifyBefore: { not: null },
            startAt: { gte: now },
        },
        include: { company: { select: { id: true, status: true } } },
    });

    for (const event of events) {
        if (event.company.status !== 'active') continue;

        const minutesUntilStart = (event.startAt.getTime() - now.getTime()) / 60000;
        const threshold = event.notifyBefore!;

        if (minutesUntilStart <= threshold && minutesUntilStart > threshold - 1) {
            const existing = await prisma.alert.findFirst({
                where: {
                    companyId: event.companyId,
                    type: 'system',
                    message: { contains: event.id },
                    createdAt: { gte: new Date(now.getTime() - 60000) },
                },
            });

            if (!existing) {
                await prisma.alert.create({
                    data: {
                        companyId: event.companyId,
                        type: 'system',
                        priority: 'high',
                        title: `Lembrete: ${event.title}`,
                        message: `[${event.id}] O evento "${event.title}" começa em ${threshold} minuto(s).`,
                        module: event.module || 'calendar',
                        isRead: false,
                    },
                });

                emitToCompany(event.companyId, 'calendar:reminder', {
                    eventId: event.id,
                    title: event.title,
                    startAt: event.startAt,
                    minutesUntilStart: Math.round(minutesUntilStart),
                });
            }
        }
    }
};

// ── Local backup cleanup ──────────────────────────────────────────────────────

const runLocalBackupCleanup = async () => {
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
    logger.info(`Running local backup cleanup (retention: ${retentionDays} days)...`);

    const companies = await activeCompanies();
    let cleaned = 0;

    for (const company of companies) {
        try {
            // backupService.cleanOldBackups is private; call the public createBackup
            // which internally calls cleanOldBackups — so we expose it here via cast
            const svc = backupService as any;
            if (typeof svc.cleanOldBackups === 'function') {
                await svc.cleanOldBackups(company.id);
                cleaned++;
            }
        } catch (err: any) {
            logger.warn(`Backup cleanup failed for ${company.name}`, { error: err.message });
        }
    }

    logger.info(`Local backup cleanup done — ${cleaned} companies processed.`);
};

// ── Scheduler ─────────────────────────────────────────────────────────────────

export const startCronJobs = () => {
    // Daily at midnight — full alert generation + expiring batches
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running daily automated tasks...');
        try {
            await runAlertGeneration();
            await checkExpiringBatches();
        } catch (err) {
            logger.error('Error in daily tasks:', err);
        }
    });

    // Every 6 hours — stock & alert refresh
    cron.schedule('0 */6 * * *', async () => {
        logger.info('Running 6-hour alert refresh...');
        try {
            await runAlertGeneration();
        } catch (err) {
            logger.error('Error in 6-hour refresh:', err);
        }
    });

    // Every minute — expired stock reservation cleanup
    cron.schedule('* * * * *', async () => {
        try {
            await commercialService.cleanupExpiredReservations();
        } catch (err) {
            logger.error('Error in reservation cleanup:', err);
        }
    });

    // Daily at 08:00 — fiscal deadline alerts (7-day advance notice + email)
    cron.schedule('0 8 * * *', async () => {
        logger.info('Running fiscal deadline alerts...');
        try {
            await runFiscalDeadlineAlerts();
        } catch (err) {
            logger.error('Error in fiscal deadline alerts:', err);
        }
    });

    // Daily at 03:00 — local backup file cleanup
    cron.schedule('0 3 * * *', async () => {
        try {
            await runLocalBackupCleanup();
        } catch (err) {
            logger.error('Error in local backup cleanup:', err);
        }
    });

    // Every minute — calendar event reminders
    cron.schedule('* * * * *', async () => {
        try {
            await runCalendarReminders();
        } catch (err) {
            logger.error('Error in calendar reminders:', err);
        }
    });

    logger.info('Cron jobs scheduled: midnight daily | 6h refresh | 1min reservations | 08:00 fiscal | 03:00 backup cleanup | 1min calendar reminders');
};
