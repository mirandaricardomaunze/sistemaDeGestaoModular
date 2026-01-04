import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendOTP = async (email: string, otp: string) => {
    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Sistema de Gestão'}" <${process.env.SMTP_USER}>`,
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

export const sendExpirationAlert = async (data: {
    email: string;
    productName: string;
    batchNumber: string | null;
    expiryDate: Date;
    currentStock: number;
    userName: string;
}) => {
    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Sistema de Gestão'}" <${process.env.SMTP_USER}>`,
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
