import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

function createTransport() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    // Accept both SMTP_PASSWORD and SMTP_PASS for compatibility
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        logger.warn('SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD missing) -- emails will not be sent');
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

const from = `"${process.env.SMTP_FROM_NAME || 'Sistema'}" <${process.env.SMTP_USER || 'noreply@example.com'}>`;

export async function sendPasswordResetEmail(to: string, name: string, otp: string): Promise<void> {
    const transport = createTransport();
    if (!transport) return;

    await transport.sendMail({
        from,
        to,
        subject: 'Recuperação de Palavra-passe',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
                <h2 style="color:#1e293b">Recuperação de Palavra-passe</h2>
                <p>Olá <strong>${name}</strong>,</p>
                <p>O seu código de recuperação é:</p>
                <div style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#2563eb;
                            background:#eff6ff;padding:24px;border-radius:12px;text-align:center;margin:24px 0">
                    ${otp}
                </div>
                <p>Este código expira em <strong>15 minutos</strong>.</p>
                <p style="color:#64748b;font-size:13px">
                    Se não solicitou a recuperação, ignore este email.
                </p>
            </div>
        `,
    });

    logger.info('Password reset email sent', { to });
}
