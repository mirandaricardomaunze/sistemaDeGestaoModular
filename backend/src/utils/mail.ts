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
    logger.warn('SMTP not configured -- recovery codes will be logged in development mode');
}

export const sendOTP = async (email: string, otp: string) => {
    // Development Log - Always log OTP to console in dev mode for easy testing
    if (process.env.NODE_ENV !== 'production') {
        logger.debug(`[DEV] OTP for ${email}: ${otp}`);
    }

    // Check if SMTP is configured. If not, don't try to send but don't crash in dev.
    if (!process.env.SMTP_USER || (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD)) {
        if (process.env.NODE_ENV !== 'production') {
            logger.warn('SMTP not configured -- skipping real email send');
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
        subject: `Fatura ${invoice.invoiceNumber} -- ${company.name || 'Multicore'}`,
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
                    ${company.name || 'Multicore'} ${company.taxId ? `| NUIT: ${company.taxId}` : ''} -- Este é um email automático.
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
                <p>Este é um aviso automático de que um produto no seu inventrio irá expirar em <strong>7 dias</strong>.</p>
                
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

export const sendStockAlert = async (data: {
    email: string;
    productName: string;
    warehouseName: string;
    currentStock: number;
    threshold: number;
    userName: string;
    type: 'low_stock' | 'out_of_stock';
}) => {
    const isOutOfStock = data.type === 'out_of_stock';
    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Multicore'}" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: `${isOutOfStock ? '🚨 STOCK ESGOTADO' : '⚠️ STOCK BAIXO'}: ${data.productName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid ${isOutOfStock ? '#fee2e2' : '#ffedd5'}; border-radius: 10px;">
                <h2 style="color: ${isOutOfStock ? '#dc2626' : '#ea580c'}; text-align: center; margin-bottom: 20px;">
                    ${isOutOfStock ? 'Alerta de Ruptura de Stock' : 'Alerta de Stock Crítico'}
                </h2>
                <p>Olá <strong>${data.userName}</strong>,</p>
                <p>O sistema detetou que um produto atingiu um nível crítico no armazém <strong>${data.warehouseName}</strong>:</p>
                
                <div style="background-color: ${isOutOfStock ? '#fef2f2' : '#fff7ed'}; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid ${isOutOfStock ? '#fecaca' : '#fed7aa'};">
                    <p style="margin: 5px 0;"><strong>Produto:</strong> ${data.productName}</p>
                    <p style="margin: 5px 0;"><strong>Armazém:</strong> ${data.warehouseName}</p>
                    <p style="margin: 5px 0;"><strong>Quantidade Atual:</strong> <span style="font-size: 18px; font-weight: bold; color: ${isOutOfStock ? '#dc2626' : '#ea580c'};">${data.currentStock}</span></p>
                    <p style="margin: 5px 0;"><strong>Nível Mínimo Configurado:</strong> ${data.threshold}</p>
                </div>

                <p>Por favor, providencie o reabastecimento ou a transferência de stock o mais breve possível para evitar interrupções nas vendas.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/inventory" 
                       style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Ver Inventário Completo
                    </a>
                </div>

                <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">
                    Este alerta foi gerado automaticamente pelo sistema Multicore ERP.
                </p>
            </div>
        `,
    };

    if (!process.env.SMTP_USER || (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD)) {
        if (process.env.NODE_ENV !== 'production') {
            logger.warn(`[DEV] sendStockAlert → ${data.email} (SMTP not configured, skipped)`);
            return { messageId: 'mock-id' };
        }
        throw new Error('Configuração de e-mail (SMTP) em falta');
    }

    return transporter.sendMail(mailOptions);
};

const smtpReady = () =>
    !!(process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD));

// ── Booking Confirmation (Hospitality + Public reservations) ─────────────────

export const sendBookingConfirmation = async (data: {
    email: string; guestName: string; reservationId: string;
    roomNumber: string | number; checkIn: string | Date; checkOut: string | Date;
    nights: number; totalPrice: number; companyName?: string;
}) => {
    if (!smtpReady()) { logger.warn('[DEV] sendBookingConfirmation skipped'); return; }
    const fmt = (d: string | Date) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' });
    const fmtCur = (v: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(v);
    return transporter.sendMail({
        from: `"${data.companyName || process.env.SMTP_FROM_NAME || 'Hotelaria'}" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: `Confirmação de Reserva — Quarto ${data.roomNumber}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
<div style="background:#1e3a5f;padding:24px 32px;color:white"><h1 style="margin:0;font-size:22px">Reserva Confirmada</h1><p style="margin:4px 0 0;opacity:.8;font-size:14px">Ref: ${data.reservationId.slice(-8).toUpperCase()}</p></div>
<div style="padding:24px 32px"><p>Caro/a <strong>${data.guestName}</strong>,</p><p>A sua reserva foi confirmada.</p>
<div style="background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0"><table style="width:100%;font-size:14px">
<tr><td style="color:#6b7280;padding:4px 0">Quarto</td><td style="font-weight:bold">${data.roomNumber}</td></tr>
<tr><td style="color:#6b7280;padding:4px 0">Check-in</td><td style="font-weight:bold">${fmt(data.checkIn)}</td></tr>
<tr><td style="color:#6b7280;padding:4px 0">Check-out</td><td style="font-weight:bold">${fmt(data.checkOut)}</td></tr>
<tr><td style="color:#6b7280;padding:4px 0">Noites</td><td style="font-weight:bold">${data.nights}</td></tr>
<tr><td style="color:#6b7280;padding:4px 0">Total</td><td style="font-weight:bold;font-size:16px;color:#1e3a5f">${fmtCur(data.totalPrice)}</td></tr>
</table></div></div>
<div style="background:#f3f4f6;padding:12px 32px;font-size:11px;color:#9ca3af;text-align:center">${data.companyName || 'Hotelaria'} — Email automático.</div></div>`,
    });
};

// ── Delivery Notification (Logistics) ────────────────────────────────────────

export const sendDeliveryNotification = async (data: {
    email: string; recipientName: string; deliveryNumber: string;
    status: string; address: string; trackingInfo?: string; companyName?: string;
}) => {
    if (!smtpReady()) { logger.warn('[DEV] sendDeliveryNotification skipped'); return; }
    const labels: Record<string, string> = {
        pending: 'Pendente', assigned: 'Atribuída', in_transit: 'Em Trânsito',
        delivered: 'Entregue', failed: 'Falhou', returned: 'Devolvida',
    };
    const isDelivered = data.status === 'delivered';
    return transporter.sendMail({
        from: `"${data.companyName || process.env.SMTP_FROM_NAME || 'Logística'}" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: `${isDelivered ? '✅ Entregue' : '📦 Actualização'}: ${data.deliveryNumber}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
<div style="background:${isDelivered ? '#16a34a' : '#4f46e5'};padding:24px 32px;color:white"><h1 style="margin:0;font-size:20px">${isDelivered ? 'Entrega Concluída!' : 'Actualização da Entrega'}</h1><p style="margin:4px 0 0;opacity:.85;font-size:14px">Ref: ${data.deliveryNumber}</p></div>
<div style="padding:24px 32px"><p>Olá <strong>${data.recipientName}</strong>,</p>
<div style="background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0">
<p style="margin:0 0 4px;font-size:13px;color:#6b7280">Estado</p>
<p style="margin:0;font-size:18px;font-weight:bold;color:${isDelivered ? '#16a34a' : '#4f46e5'}">${labels[data.status] || data.status}</p>
<p style="margin:12px 0 0;font-size:13px"><strong>Endereço:</strong> ${data.address}</p>
${data.trackingInfo ? `<p style="margin:8px 0 0;font-size:13px"><strong>Info:</strong> ${data.trackingInfo}</p>` : ''}
</div></div>
<div style="background:#f3f4f6;padding:12px 32px;font-size:11px;color:#9ca3af;text-align:center">${data.companyName || 'Logística'} — Email automático.</div></div>`,
    });
};

// ── Recall Alert (Pharmacy — to admins) ──────────────────────────────────────

export const sendRecallAlert = async (data: {
    email: string; userName: string; recallNumber: string;
    medicationName: string; batchNumbers: string[]; reason: string;
    severity: string; affectedUnits: number; companyName?: string;
}) => {
    if (!smtpReady()) { logger.warn('[DEV] sendRecallAlert skipped'); return; }
    const color = data.severity === 'mandatory' ? '#dc2626' : '#f59e0b';
    return transporter.sendMail({
        from: `"${data.companyName || process.env.SMTP_FROM_NAME || 'Farmácia'}" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: `🚨 RECALL ${data.recallNumber}: ${data.medicationName}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:2px solid ${color};border-radius:10px;overflow:hidden">
<div style="background:${color};padding:24px 32px;color:white"><h1 style="margin:0;font-size:20px">RECALL — ${data.recallNumber}</h1><p style="margin:4px 0 0;font-size:12px;font-weight:bold;text-transform:uppercase">${data.severity === 'mandatory' ? 'Obrigatório' : 'Voluntário'}</p></div>
<div style="padding:24px 32px"><p>Olá <strong>${data.userName}</strong>,</p>
<div style="background:#fef2f2;border:1px solid ${color};border-radius:8px;padding:16px;margin:20px 0"><table style="width:100%;font-size:14px">
<tr><td style="color:#6b7280;padding:4px 0">Medicamento</td><td style="font-weight:bold">${data.medicationName}</td></tr>
<tr><td style="color:#6b7280;padding:4px 0">Lotes</td><td style="font-weight:bold">${data.batchNumbers.join(', ')}</td></tr>
<tr><td style="color:#6b7280;padding:4px 0">Unidades</td><td style="font-weight:bold">${data.affectedUnits}</td></tr>
<tr><td style="color:#6b7280;padding:4px 0">Motivo</td><td>${data.reason}</td></tr>
</table></div>
<p style="color:#dc2626;font-weight:bold">Retire imediatamente estes lotes do stock.</p></div>
<div style="background:#f3f4f6;padding:12px 32px;font-size:11px;color:#9ca3af;text-align:center">${data.companyName || 'Farmácia'} — Alerta automático.</div></div>`,
    });
};
