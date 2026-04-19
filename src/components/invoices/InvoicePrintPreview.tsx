import { logger } from '../../utils/logger';
import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HiOutlinePrinter, HiOutlineXMark as HiOutlineX, HiOutlineArrowDownTray as HiOutlineDownload, HiOutlineEnvelope as HiOutlineMail } from 'react-icons/hi2';
import { Modal, Button, Card, Input } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { Invoice, InvoiceStatus } from '../../types';
import toast from 'react-hot-toast';
import { invoicesAPI } from '../../services/api';

interface InvoicePrintPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice & { printCount?: number };
}

const statusLabels: Record<InvoiceStatus, string> = {
    draft: 'Rascunho',
    sent: 'Enviada',
    paid: 'Paga',
    partial: 'Parcial',
    overdue: 'Vencida',
    cancelled: 'Cancelada',
};

const statusColors: Record<InvoiceStatus, { bg: string; color: string }> = {
    paid: { bg: '#dcfce7', color: '#166534' },
    partial: { bg: '#fef9c3', color: '#854d0e' },
    overdue: { bg: '#fee2e2', color: '#991b1b' },
    sent: { bg: '#dbeafe', color: '#1e40af' },
    draft: { bg: '#f3f4f6', color: '#4b5563' },
    cancelled: { bg: '#f3f4f6', color: '#9ca3af' },
};

const paymentMethodLabels: Record<string, string> = {
    pix: 'PIX',
    transfer: 'Transferência',
    cash: 'Dinheiro',
    card: 'Cartão',
    credit: 'Crédito',
    invoice: 'Fatura',
};

/* ── Shared inline style fragments (DRY) ──────────────────────-*/
const sectionHeader = { borderBottom: '1.5px solid #1a1a1a', padding: '8px 32px 4px', margin: 0, backgroundColor: 'white' } as const;
const sectionTitle = { fontSize: '10px', fontWeight: 900, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: 0 };
const fieldLabel = { fontSize: '10px', fontWeight: 700, color: '#64748b', minWidth: '80px', textTransform: 'uppercase' as const } as const;
const fieldValue = { flex: 1, fontSize: '12px', color: '#1e293b', fontWeight: 500, lineHeight: 1.25 } as const;
const fieldRow = { display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' } as const;

export default function InvoicePrintPreview({ isOpen, onClose, invoice }: InvoicePrintPreviewProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings: company } = useStore();

    const ivaRate = (company.ivaRate ?? 16) / 100;
    const isCopy = (invoice.printCount || 0) > 0;
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailAddress, setEmailAddress] = useState(invoice.customerEmail || '');

    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
            const blob = await invoicesAPI.downloadPdf(invoice.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Fatura-${invoice.invoiceNumber}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('PDF descarregado com sucesso!');
        } catch (err) {
            logger.error('PDF download failed:', err);
            toast.error('Erro ao descarregar PDF');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailAddress) { toast.error('Insira um email válido'); return; }
        setIsSendingEmail(true);
        try {
            const result = await invoicesAPI.sendByEmail(invoice.id, emailAddress);
            toast.success(result.message || 'Fatura enviada por email!');
            setShowEmailModal(false);
        } catch (err) {
            logger.error('Email send failed:', err);
            toast.error('Erro ao enviar email');
        } finally {
            setIsSendingEmail(false);
        }
    };
    const stColors = statusColors[invoice.status] || statusColors.draft;

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=900,height=700');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Fatura ${invoice.invoiceNumber}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: 'Inter', Arial, sans-serif; 
                            padding: 30px; 
                            max-width: 800px; 
                            margin: 0 auto; 
                            color: #1a1a1a;
                            background-color: white !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .print-container { background-color: white !important; width: 100%; height: 100%; padding: 0; margin: 0; }
                        table { width: 100%; border-collapse: collapse; background-color: white !important; border: 1px solid #e5e7eb; }
                        div, p, span, h1, h2, h3 { background-color: transparent !important; }
                        .force-white { background-color: white !important; color: black !important; }
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { padding: 0; background-color: white !important; width: 100%; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container force-white">
                        ${content.innerHTML}
                    </div>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(async () => {
            printWindow.print();
            printWindow.close();

            try {
                await fetch(`/api/invoices/${invoice.id}/print`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
            } catch (error) {
                logger.error('Failed to increment invoice print count:', error);
            }
        }, 250);

        toast.success('Fatura enviada para impressão!');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Imprimir Fatura" size="xl">
            <div className="flex justify-end gap-2 mb-4">
                <Button variant="outline" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button variant="outline" onClick={() => setShowEmailModal(true)}>
                    <HiOutlineMail className="w-4 h-4 mr-2" />
                    Enviar por Email
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
                    <HiOutlineDownload className="w-4 h-4 mr-2" />
                    {isDownloading ? 'A descarregar...' : 'Baixar PDF'}
                </Button>
                <Button onClick={handlePrint}>
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            {/* Email Modal */}
            <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title="Enviar Fatura por Email" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        A fatura <strong>{invoice.invoiceNumber}</strong> será enviada em PDF para o email indicado.
                    </p>
                    <Input
                        label="Email do Destinatário"
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        placeholder="cliente@email.com"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setShowEmailModal(false)}>Cancelar</Button>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                            <HiOutlineMail className="w-4 h-4 mr-2" />
                            {isSendingEmail ? 'A enviar...' : 'Enviar'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Card padding="none" className="max-h-[70vh] overflow-y-auto !bg-gray-100 dark:!bg-gray-100 flex justify-center p-4">
                <div
                    ref={printRef}
                    className="bg-white text-gray-900 shadow-xl w-full max-w-[800px] mx-auto relative print-table !bg-white !text-gray-900"
                    style={{
                        fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                        position: 'relative',
                        backgroundColor: '#ffffff',
                        color: '#1a1a1a',
                        maxWidth: '800px',
                        margin: '0 auto',
                        colorScheme: 'light',
                        minHeight: '297mm',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* ───────────────────────────────────────────────────────────── */}
                    {/* TOP HEADER: Company + FATURA    */}
                    {/* ───────────────────────────────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '32px 32px 24px', borderBottom: '2px solid #f8fafc', backgroundColor: 'white', margin: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'white' }}>
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ width: '64px', height: '64px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', color: 'white' }}>
                                    <span style={{ fontWeight: 900, fontSize: '24px' }}>M</span>
                                </div>
                            )}
                            <div style={{ backgroundColor: 'white' }}>
                                <h2 style={{ fontWeight: 900, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '-0.5px', marginBottom: '4px', color: '#0f172a' }}>
                                    {company.tradeName || company.companyName}
                                </h2>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {company.address && <p>{company.address}{company.city ? `, ${company.city}` : ''}</p>}
                                    <p>
                                        {company.phone && `Tel: ${company.phone}`}
                                        {company.email && ` | ${company.email}`}
                                    </p>
                                    {company.taxId && <p>NUIT: {company.taxId}</p>}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', backgroundColor: 'white' }}>
                            <h1 style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-1.5px', color: '#6366f1', textTransform: 'uppercase', marginBottom: '2px' }}>
                                FATURA
                            </h1>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <p style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '2px', color: isCopy ? '#ef4444' : '#64748b', textTransform: 'uppercase' }}>
                                    {isCopy ? 'Deduplicada / Cópia' : 'Documento Original'}
                                </p>
                                <p style={{ fontSize: '13px', color: '#0f172a', fontWeight: 800, fontFamily: "'Inter', sans-serif" }}>Nº {invoice.invoiceNumber}</p>
                                <div style={{ alignSelf: 'flex-end', marginTop: '6px', padding: '4px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', background: stColors.bg, color: stColors.color }}>
                                    {statusLabels[invoice.status]}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────────────────────────── */}
                    {/* SECTION: CLIENTE + INFO (SIDE BY SIDE) */}
                    {/* ─────────────────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: 'white', margin: 0 }}>
                        {/* Column 1: Cliente */}
                        <div style={{ borderRight: '1px solid #f3f4f6' }}>
                            <div style={{ ...sectionHeader, borderBottom: '1px solid #1a1a1a', paddingLeft: '32px' }}>
                                <h3 style={sectionTitle}>Dados do Cliente</h3>
                            </div>
                            <div style={{ padding: '12px 32px', backgroundColor: 'white' }}>
                                <div style={fieldRow}>
                                    <span style={fieldLabel}>Nome:</span>
                                    <span style={fieldValue}>{invoice.customerName}</span>
                                </div>
                                {invoice.customerDocument && (
                                    <div style={fieldRow}>
                                        <span style={fieldLabel}>NUIT:</span>
                                        <span style={fieldValue}>{invoice.customerDocument}</span>
                                    </div>
                                )}
                                {invoice.customerPhone && (
                                    <div style={fieldRow}>
                                        <span style={fieldLabel}>Tel:</span>
                                        <span style={fieldValue}>{invoice.customerPhone}</span>
                                    </div>
                                )}
                                {invoice.customerAddress && (
                                    <div style={fieldRow}>
                                        <span style={fieldLabel}>Endereço:</span>
                                        <span style={{ ...fieldValue, fontSize: '11px' }}>{invoice.customerAddress}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Datas/Info */}
                        <div>
                            <div style={{ ...sectionHeader, borderBottom: '1px solid #1a1a1a', paddingLeft: '24px' }}>
                                <h3 style={sectionTitle}>Informações Gerais</h3>
                            </div>
                            <div style={{ padding: '12px 24px', backgroundColor: 'white' }}>
                                <div style={fieldRow}>
                                    <span style={fieldLabel}>Emissão:</span>
                                    <span style={fieldValue}>{format(parseISO(invoice.issueDate), 'dd/MM/yyyy')}</span>
                                </div>
                                <div style={fieldRow}>
                                    <span style={fieldLabel}>Vencimento:</span>
                                    <span style={fieldValue}>{format(parseISO(invoice.dueDate), 'dd/MM/yyyy')}</span>
                                </div>
                                {invoice.paidDate && (
                                    <div style={fieldRow}>
                                        <span style={fieldLabel}>Pagamento:</span>
                                        <span style={{ ...fieldValue, color: '#16a34a', fontWeight: 600 }}>{format(parseISO(invoice.paidDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                )}
                                <div style={fieldRow}>
                                    <span style={fieldLabel}>Moeda:</span>
                                    <span style={fieldValue}>Metical (MZN)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────────────────── */}
                    {/* SECTION: DETALHES DOS PRODUTOS */}
                    {/* ─────────────────────────────── */}
                    <div style={{ padding: '0 32px 16px', backgroundColor: 'white', margin: 0 }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', backgroundColor: '#ffffff', overflow: 'hidden', borderRadius: '8px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc' }}>
                                    <th style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'left', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }}>Produto / Serviço</th>
                                    <th style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'left', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }}>Qtd</th>
                                    <th style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'left', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }}>Preço Unitário</th>
                                    <th style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(invoice.items || []).map((item, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>
                                            {item.description}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: 500 }}>{item.quantity}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: 500 }}>{formatCurrency(item.unitPrice)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ───────────────── */}
                    {/* SECTION: TOTAIS */}
                    {/* ───────────────── */}
                    <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: 'white', margin: 0, flex: 1 }}>
                        {/* Left: Notes + Terms */}
                        <div style={{ maxWidth: '55%' }}>
                            {invoice.notes && (
                                <div style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' }}>Observações:</p>
                                    <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.5', fontStyle: 'italic' }}>{invoice.notes}</p>
                                </div>
                            )}
                            {invoice.terms && (
                                <div style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' }}>Termos e Condições:</p>
                                    <p style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.6' }}>{invoice.terms}</p>
                                </div>
                            )}
                            {/* Bank Accounts */}
                            {company.bankAccounts && company.bankAccounts.length > 0 && (
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>Dados Bancários:</p>
                                    {company.bankAccounts.map((bank, idx) => (
                                        <div key={idx} style={{ fontSize: '11px', marginBottom: '6px' }}>
                                            <p style={{ fontWeight: 600, color: '#1e293b' }}>{bank.bankName}</p>
                                            <p style={{ color: '#475569' }}>Conta: {bank.accountNumber}</p>
                                            {bank.nib && <p style={{ color: '#64748b', fontSize: '10px' }}>NIB: {bank.nib}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: Totals */}
                        <div style={{ width: '220px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Subtotal</span>
                                <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.discount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                    <span style={{ fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', fontSize: '9px' }}>Desconto</span>
                                    <span style={{ color: '#dc2626', fontWeight: 500 }}>-{formatCurrency(invoice.discount)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>IVA ({(ivaRate * 100).toFixed(0)}%)</span>
                                <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatCurrency(invoice.tax)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', marginTop: '6px', borderTop: '1.5px solid #1a1a1a' }}>
                                <span style={{ fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', fontSize: '10px' }}>Total a Pagar</span>
                                <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '14px' }}>{formatCurrency(invoice.total)}</span>
                            </div>
                            {invoice.amountPaid > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px', borderTop: '1px dashed #e2e8f0', marginTop: '4px' }}>
                                    <span style={{ fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', fontSize: '9px' }}>Total Pago</span>
                                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(invoice.amountPaid)}</span>
                                </div>
                            )}
                            {invoice.amountDue > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px', color: '#dc2626' }}>
                                    <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '9px' }}>Saldo Pendente</span>
                                    <span style={{ fontWeight: 700 }}>{formatCurrency(invoice.amountDue)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─────────────────────────── */}
                    {/* PAYMENTS HISTORY           */}
                    {/* ─────────────────────────── */}
                    {(invoice.payments || []).length > 0 && (
                        <>
                            <div style={{ ...sectionHeader, backgroundColor: 'white', margin: 0 }}>
                                <h3 style={sectionTitle}>Histórico de Pagamentos</h3>
                            </div>
                            <div style={{ padding: '16px 32px', backgroundColor: 'white', margin: 0 }}>
                                {(invoice.payments || []).map((payment, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px dashed #e5e7eb' }}>
                                        <span style={{ color: '#374151' }}>
                                            {format(parseISO(payment.date), 'dd/MM/yyyy')}
                                            <span style={{ border: '1px solid #4338ca', color: '#4338ca', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', marginLeft: '8px', fontWeight: 600 }}>
                                                {paymentMethodLabels[payment.method] || payment.method}
                                            </span>
                                            {payment.reference && (
                                                <span style={{ marginLeft: '8px', color: '#6b7280', fontSize: '11px' }}>
                                                    Ref: {payment.reference}
                                                </span>
                                            )}
                                        </span>
                                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(payment.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ─────────────────── */}
                    {/* SIGNATURE SECTION  */}
                    {/* ─────────────────── */}
                    <div style={{ padding: '20px 32px 24px', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', backgroundColor: 'white', margin: 0 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginTop: '36px', marginBottom: '4px', borderBottom: '1px solid #1e293b' }} />
                            <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>Responsável</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginTop: '36px', marginBottom: '4px', borderBottom: '1px solid #1e293b' }} />
                            <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>Assinatura do Cliente</p>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', padding: '12px 32px 24px', borderTop: '1px solid #f0f0f0', backgroundColor: 'white', margin: 0 }}>
                        <p style={{ margin: 0 }}>
                            Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {company.tradeName || company.companyName}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
