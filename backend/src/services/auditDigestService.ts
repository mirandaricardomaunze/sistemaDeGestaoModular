/**
 * Audit Email Digest
 *
 * Daily 07:00 cron sends a per-role summary of unresolved audit alerts to
 * each user in roles that have `inEmail=true` on their NotificationPreference.
 *
 * Skip silently when:
 *  - SMTP not configured (mail.ts logs warning)
 *  - No active audit alerts (no point emailing "all clear")
 *  - Role has no opted-in users
 *
 * See [[audit-alerts]] skill.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import nodemailer, { type SendMailOptions } from 'nodemailer';

const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const PRIORITY_COLOR: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#0284c7',
};
const PRIORITY_LABEL: Record<string, string> = {
    critical: 'CRÍTICA',
    high: 'ALTA',
    medium: 'MÉDIA',
    low: 'BAIXA',
};

const AUDIT_TYPE_LABEL: Record<string, string> = {
    invoice_overdue: 'Facturas vencidas',
    credit_note_draft: 'Notas de Crédito em rascunho',
    debit_note_draft: 'Notas de Débito em rascunho',
    approval_pending: 'Aprovações pendentes',
    order_stuck: 'Encomendas paradas',
    order_cancellation_pending: 'Cancelamentos de encomenda pendentes',
    shift_open_too_long: 'Turnos abertos há demasiado tempo',
    sangria_no_approval: 'Sangrias sem aprovação',
    negative_stock: 'Produtos com stock negativo',
    invoice_no_warehouse: 'Facturas sem armazém atribuído',
    sale_no_fiscal_number: 'Vendas sem nº fiscal',
    shift_discrepancy: 'Discrepâncias de turno',
    duplicate_fiscal_number: 'Nº fiscal duplicado',
    irps_brackets_missing: 'Tabela IRPS em falta',
};

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
    },
});

interface DigestGroup {
    auditType: string;
    label: string;
    count: number;
    topPriority: string;
    samples: { title: string; message: string; priority: string }[];
}

function buildHTML(params: {
    recipientName: string;
    companyName: string;
    groups: DigestGroup[];
    totalAlerts: number;
    appUrl: string;
}): string {
    const { recipientName, companyName, groups, totalAlerts, appUrl } = params;
    const today = new Date().toLocaleDateString('pt-MZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const groupsHTML = groups.map(g => {
        const color = PRIORITY_COLOR[g.topPriority] || '#64748b';
        const samplesHTML = g.samples.slice(0, 3).map(s => `
            <li style="margin: 6px 0; font-size: 13px; color: #475569;">
                <strong style="color: ${PRIORITY_COLOR[s.priority] || '#64748b'};">[${PRIORITY_LABEL[s.priority] || s.priority}]</strong>
                ${s.title} — ${s.message}
            </li>
        `).join('');
        const more = g.count > 3 ? `<li style="margin: 6px 0; font-size: 12px; color: #94a3b8; font-style: italic;">... e mais ${g.count - 3}</li>` : '';
        return `
            <div style="margin: 16px 0; padding: 14px; background: #f8fafc; border-left: 4px solid ${color}; border-radius: 6px;">
                <h3 style="margin: 0 0 8px; font-size: 14px; color: #0f172a;">
                    ${g.label} <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-left: 8px;">${g.count}</span>
                </h3>
                <ul style="margin: 0; padding-left: 16px; list-style: none;">
                    ${samplesHTML}${more}
                </ul>
            </div>
        `;
    }).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: white; color: #0f172a;">
            <div style="background: linear-gradient(135deg, #3b54ff 0%, #6366f1 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">🔍 Digest de Auditoria</h1>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">${today}</p>
            </div>
            <div style="padding: 24px; background: white; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px;">
                <p style="font-size: 15px; color: #0f172a; margin: 0 0 8px;">Bom dia, <strong>${recipientName}</strong>.</p>
                <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">
                    Tem <strong style="color: #dc2626;">${totalAlerts}</strong> pendência${totalAlerts === 1 ? '' : 's'} de auditoria em <strong>${companyName}</strong> que precisam da sua atenção:
                </p>

                ${groupsHTML}

                <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <a href="${appUrl}" style="display: inline-block; background: #3b54ff; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
                        Ver todas as pendências →
                    </a>
                </div>

                <p style="margin: 24px 0 0; font-size: 11px; color: #94a3b8; text-align: center;">
                    Email automático enviado pelo Sistema de Gestão. Para configurar a frequência ou desactivar, vá a Configurações → Notificações.
                </p>
            </div>
        </div>
    `;
}

export class AuditDigestService {
    /**
     * Build and send the daily digest for every company that has at least one
     * role with `inEmail=true` for the audit module.
     */
    async sendDailyDigest(): Promise<{ companies: number; emailsSent: number; skipped: number }> {
        const isSMTPConfigured = Boolean(process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD));
        if (!isSMTPConfigured && process.env.NODE_ENV === 'production') {
            logger.warn('auditDigest: SMTP not configured in production — skipping');
            return { companies: 0, emailsSent: 0, skipped: 0 };
        }

        const companies = await prisma.company.findMany({
            where: { status: 'active' },
            select: { id: true, name: true },
        });

        let emailsSent = 0;
        let skipped = 0;

        for (const company of companies) {
            try {
                const result = await this.sendForCompany(company.id, company.name);
                emailsSent += result.sent;
                skipped += result.skipped;
            } catch (err) {
                logger.error(`auditDigest: failed for company ${company.name}`, { companyId: company.id, error: err instanceof Error ? err.message : String(err) });
            }
        }

        logger.info('auditDigest.sendDailyDigest', { companies: companies.length, emailsSent, skipped });
        return { companies: companies.length, emailsSent, skipped };
    }

    private async sendForCompany(companyId: string, companyName: string): Promise<{ sent: number; skipped: number }> {
        // Find roles with inEmail=true for the audit module.
        const prefs = await prisma.notificationPreference.findMany({
            where: { companyId, module: 'audit', inEmail: true },
            select: { role: true, minPriority: true },
        });
        if (prefs.length === 0) return { sent: 0, skipped: 0 };

        // Collect all active audit alerts for the company.
        const alerts = await prisma.alert.findMany({
            where: { companyId, module: 'audit', isResolved: false },
            select: { priority: true, title: true, message: true, metadata: true },
            orderBy: { priority: 'asc' },
        });
        if (alerts.length === 0) return { sent: 0, skipped: prefs.length };

        let sent = 0;
        const appUrl = process.env.APP_URL || 'http://localhost:3000';

        for (const pref of prefs) {
            const minRank = PRIORITY_RANK[pref.minPriority] ?? 0;
            const relevant = alerts.filter(a => (PRIORITY_RANK[a.priority] ?? 0) >= minRank);
            if (relevant.length === 0) continue;

            // Group by auditType.
            const byType = new Map<string, typeof relevant>();
            for (const alert of relevant) {
                const auditType = (alert.metadata as { auditType?: string } | null)?.auditType || 'unknown';
                if (!byType.has(auditType)) byType.set(auditType, []);
                byType.get(auditType)!.push(alert);
            }

            const groups: DigestGroup[] = Array.from(byType.entries()).map(([auditType, items]) => {
                const topPriority = items.reduce((max, a) => (PRIORITY_RANK[a.priority] ?? 0) > (PRIORITY_RANK[max] ?? 0) ? a.priority : max, 'low');
                return {
                    auditType,
                    label: AUDIT_TYPE_LABEL[auditType] || auditType,
                    count: items.length,
                    topPriority,
                    samples: items.slice(0, 3).map(i => ({ title: i.title, message: i.message, priority: i.priority })),
                };
            }).sort((a, b) => (PRIORITY_RANK[b.topPriority] ?? 0) - (PRIORITY_RANK[a.topPriority] ?? 0));

            // Find users of this role with email.
            // User.email is non-nullable, so we don't need a `not: null` filter.
            // Cast pref.role to the UserRole enum — the validation route guarantees the value is valid.
            const users = await prisma.user.findMany({
                where: { companyId, role: pref.role as Prisma.UserWhereInput['role'], isActive: true },
                select: { email: true, name: true },
            });

            for (const user of users.filter(u => u.email)) {
                const html = buildHTML({
                    recipientName: user.name,
                    companyName,
                    groups,
                    totalAlerts: relevant.length,
                    appUrl,
                });

                if (!process.env.SMTP_USER || (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD)) {
                    logger.warn(`[DEV] auditDigest → ${user.email} (SMTP not configured, skipped — ${relevant.length} alerts)`);
                    continue;
                }

                const mailOptions: SendMailOptions = {
                    from: `"${process.env.SMTP_FROM_NAME || 'Multicore Audit'}" <${process.env.SMTP_USER}>`,
                    to: user.email!,
                    subject: `🔍 ${relevant.length} pendência${relevant.length === 1 ? '' : 's'} de auditoria — ${companyName}`,
                    html,
                };
                try {
                    await transporter.sendMail(mailOptions);
                    sent++;
                } catch (err) {
                    logger.warn(`auditDigest: send failed to ${user.email}`, { error: err instanceof Error ? err.message : String(err) });
                }
            }
        }

        return { sent, skipped: 0 };
    }
}

export const auditDigestService = new AuditDigestService();
