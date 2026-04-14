import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
    },
});

if (process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)) {
    logger.info('SMTP configuration detected');
} else {
    logger.warn('SMTP not configured — recovery codes will be logged in development mode');
}

export const sendOTP = async (email: string, otp: string) => {
    // Development Log - Always log OTP to console in dev mode for easy testing
    if (process.env.NODE_ENV !== 'production') {
        logger.debug(`[DEV] OTP for ${email}: ${otp}`);
    }

    // Check if SMTP is configured. If not, don't try to send but don't crash in dev.
    if (!process.env.SMTP_USER || (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD)) {
        if (process.env.NODE_ENV !== 'production') {
            logger.warn('SMTP not configured — skipping real email send');
            return { messageId: 'mock-id' };
        }
        throw new Error('Configuração de e-mail (SMTP) em falta');
    }

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Multicore'}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Código de Recuperação de Senha',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #3b82f6; text-align: center;">Recuperação de Senha</h2>
                <p>Olá,</p>
                <p>Recebemos um pedido para redefinir a sua senha. Use o código abaixo para prosseguir:</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 8px; margin: 20px 0;">
                    ${otp}
                </div>
                <p>Este código é válido por 15 minutos. Se você não solicitou esta alteração, ignore este e-mail.</p>
                <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #6b7280; text-align: center;">
                    Este é um e-mail automático, por favor não responda.
                </p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};

export const sendInvoiceEmail = async (params: {
    to: string;
    invoice: {
        invoiceNumber: string;
        customerName: string;
        issueDate: string | Date;
        dueDate: string | Date;
        subtotal: number;
        tax: number;
        total: number;
        amountDue: number;
        status: string;
        items?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    };
    company: { name?: string; email?: string; phone?: string; taxId?: string };
    pdfBuffer?: Buffer;
}) => {
    const { to, invoice, company, pdfBuffer } = params;
    const fmt = (d: string | Date) => new Date(d).toLocaleDateString('pt-MZ');
    const fmtCur = (v: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(v);

    const itemRows = (invoice.items || [])
        .map(i => `<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${i.description}</td><td style="padding:6px 8px;text-align:center;border-bottom:1px solid #f1f5f9">${i.quantity}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9">${fmtCur(i.unitPrice)}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600">${fmtCur(i.total)}</td></tr>`)
        .join('');

    const mailOptions: any = {
        from: `"${company.name || process.env.SMTP_FROM_NAME || 'Multicore'}" <${process.env.SMTP_USER}>`,
        to,
        subject: `Fatura ${invoice.invoiceNumber} — ${company.name || 'Multicore'}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
                <div style="background:#1e40af;padding:24px 32px;color:white">
                    <h1 style="margin:0;font-size:22px;font-weight:900">FATURA</h1>
                    <p style="margin:4px 0 0;font-size:14px;opacity:0.85">${invoice.invoiceNumber}</p>
                </div>
                <div style="padding:24px 32px">
                    <p style="margin:0 0 16px">Caro/a <strong>${invoice.customerName}</strong>,</p>
                    <p style="margin:0 0 20px;color:#4b5563">Segue em anexo a fatura referente à sua compra. Por favor, verifique os detalhes abaixo:</p>

                    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
                        <thead><tr style="background:#f8fafc">
                            <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Descrição</th>
                            <th style="padding:8px;text-align:center;border-bottom:2px solid #e5e7eb">Qtd</th>
                            <th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb">V. Unit.</th>
                            <th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb">Total</th>
                        </tr></thead>
                        <tbody>${itemRows}</tbody>
                    </table>

                    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px">
                        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span>Subtotal:</span><span>${fmtCur(invoice.subtotal)}</span></div>
                        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span>IVA:</span><span>${fmtCur(invoice.tax)}</span></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0 4px;border-top:2px solid #1a1a1a;margin-top:6px;font-size:15px;font-weight:900"><span>TOTAL:</span><span>${fmtCur(invoice.total)}</span></div>
                        ${invoice.amountDue > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#dc2626"><span>Saldo Pendente:</span><span>${fmtCur(invoice.amountDue)}</span></div>` : ''}
                    </div>

                    <div style="background:#eff6ff;border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px">
                        <p style="margin:2px 0"><strong>Data de Emissão:</strong> ${fmt(invoice.issueDate)}</p>
                        <p style="margin:2px 0"><strong>Data de Vencimento:</strong> ${fmt(invoice.dueDate)}</p>
                    </div>

                    <p style="color:#6b7280;font-size:12px">Para qualquer dúvida, contacte-nos por ${company.email || 'email'} ou ${company.phone || 'telefone'}.</p>
                </div>
                <div style="background:#f3f4f6;padding:12px 32px;font-size:11px;color:#9ca3af;text-align:center">
                    ${company.name || 'Multicore'} ${company.taxId ? `| NUIT: ${company.taxId}` : ''} — Este é um email automático.
                </div>
            </div>
        `,
    };

    if (pdfBuffer) {
        mailOptions.attachments = [{
            filename: `Fatura-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
        }];
    }

    if (!process.env.SMTP_USER || (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD)) {
        if (process.env.NODE_ENV !== 'production') {
            logger.warn(`[DEV] sendInvoiceEmail → ${to} (SMTP not configured, skipped)`);
            return { messageId: 'mock-id' };
        }
        throw new Error('Configuração de e-mail (SMTP) em falta');
    }

    return transporter.sendMail(mailOptions);
};

export const sendExpirationAlert = async (data: {
    email: string;
    productName: string;
    batchNumber: string | null;
    expiryDate: Date;
    currentStock: number;
    userName: string;
}) => {
    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Multicore'}" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: `⚠️ ALERTA DE VALIDADE: ${data.productName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 10px;">
                <h2 style="color: #dc2626; text-align: center;">Alerta de Validade Próxima</h2>
                <p>Olá <strong>${data.userName}</strong>,</p>
                <p>Este é um aviso automático de que um produto no seu inventário irá expirar em <strong>7 dias</strong>.</p>
                
                <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
                    <p style="margin: 5px 0;"><strong>Produto:</strong> ${data.productName}</p>
                    <p style="margin: 5px 0;"><strong>Lote:</strong> ${data.batchNumber || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Data de Validade:</strong> ${new Date(data.expiryDate).toLocaleDateString()}</p>
                    <p style="margin: 5px 0;"><strong>Quantidade em Stock:</strong> ${data.currentStock}</p>
                </div>

                <p>Por favor, tome as medidas necessárias para priorizar o uso ou venda deste lote antes do vencimento.</p>
                
                <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">
                    Este alerta foi gerado automaticamente pelo sistema de Controle Farmacêutico/Logística.
                </p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};
