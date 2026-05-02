import { useRef, useState } from 'react';
import { Card, Modal, Button } from '../ui';
import { 
    HiOutlinePrinter, 
    HiOutlineMail, 
    HiOutlineDownload,
    HiOutlineX
} from 'react-icons/hi';
import type { Invoice } from '../../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useStore } from '../../stores/useStore';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';

interface InvoicePrintPreviewProps {
    invoice: Invoice;
    isOpen: boolean;
    onClose: () => void;
    isCopy?: boolean;
}

const statusLabels: Record<string, string> = {
    'DRAFT': 'Rascunho',
    'PENDING': 'Pendente',
    'PAID': 'Pago',
    'CANCELLED': 'Cancelado',
    'OVERDUE': 'Vencido',
    'PARTIAL': 'Parcial'
};

const statusColors: Record<string, { bg: string, color: string }> = {
    'DRAFT': { bg: '#f1f5f9', color: '#64748b' },
    'PENDING': { bg: '#fef9c3', color: '#854d0e' },
    'PAID': { bg: '#dcfce7', color: '#166534' },
    'CANCELLED': { bg: '#fee2e2', color: '#991b1b' },
    'OVERDUE': { bg: '#fef2f2', color: '#991b1b' },
    'PARTIAL': { bg: '#dcfce7', color: '#166534' }
};


export function InvoicePrintPreview({ invoice, isOpen, onClose, isCopy = false }: InvoicePrintPreviewProps) {
    const company = useStore((state) => state.companySettings);
    const printRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    if (!company) return null;

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
                        :root { color-scheme: light !important; }
                        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        body { 
                            font-family: 'Inter', Arial, sans-serif; 
                            padding: 30px; 
                            max-width: 800px; 
                            margin: 0 auto; 
                            color: #1a1a1a !important;
                            background-color: white !important;
                        }
                        .print-container { background-color: white !important; width: 100%; height: 100%; padding: 0; margin: 0; }
                        table { width: 100%; border-collapse: collapse; background-color: white !important; border: 1px solid #e5e7eb; }
                        thead, thead tr, thead th { background-color: #f8fafc !important; color: #64748b !important; }
                        div, p, span, h1, h2, h3 { background-color: transparent !important; }
                        .force-white { background-color: white !important; color: black !important; }
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { padding: 0; background-color: white !important; width: 100%; }
                        }
                    </style>
                </head>
                <body class="force-white">
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
                const token = localStorage.getItem('token');
                await fetch('/api/invoices/' + invoice.id + '/print', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
            } catch (error) {
                logger.error('Failed to increment invoice print count:', error);
            }
        }, 250);
    };

    const handleDownloadPDF = async () => {
        setIsExporting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/invoices/' + invoice.id + '/pdf', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            if (!response.ok) throw new Error('Falha ao gerar PDF');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Fatura_' + invoice.invoiceNumber + '.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('PDF gerado com sucesso');
        } catch (error) {
            toast.error('Erro ao baixar PDF');
            logger.error('PDF export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleSendEmail = async () => {
        setIsExporting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/invoices/' + invoice.id + '/email', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            if (!response.ok) throw new Error('Falha ao enviar e-mail');
            toast.success('E-mail enviado com sucesso');
        } catch (error) {
            toast.error('Erro ao enviar e-mail');
            logger.error('Email send failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const stColors = statusColors[invoice.status] || statusColors.PENDING;

    const sectionHeader = { padding: '12px 0', backgroundColor: '#ffffff !important', marginBottom: '4px' };
    const sectionTitle = { fontSize: '11px', fontWeight: 900, color: '#1e293b !important', textTransform: 'uppercase' as const, letterSpacing: '1px' };
    const fieldRow = { display: 'flex', padding: '4px 0', fontSize: '12px', backgroundColor: 'transparent !important' };
    const fieldLabel = { color: '#64748b !important', fontWeight: 600, width: '80px', flexShrink: 0, backgroundColor: 'transparent !important' };
    const fieldValue = { color: '#1e293b !important', fontWeight: 500, backgroundColor: 'transparent !important' };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Imprimir Fatura" size="xl">
            <div className="flex items-center justify-between mb-6 gap-3 bg-slate-50 dark:bg-dark-800 p-4 rounded-xl border border-slate-200 dark:border-dark-700">
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onClose} leftIcon={<HiOutlineX />}>Fechar</Button>
                    <Button variant="outline" onClick={handleSendEmail} disabled={isExporting} leftIcon={<HiOutlineMail />}>Enviar por Email</Button>
                    <Button variant="outline" onClick={handleDownloadPDF} disabled={isExporting} leftIcon={<HiOutlineDownload />}>Baixar PDF</Button>
                </div>
                <Button variant="primary" onClick={handlePrint} leftIcon={<HiOutlinePrinter />}>Imprimir</Button>
            </div>

            <Card padding="none" className="max-h-[70vh] overflow-y-auto bg-gray-200 dark:bg-slate-900 flex justify-center p-8">
                <div
                    ref={printRef}
                    className="bg-white text-gray-900 shadow-2xl w-full max-w-[800px] mx-auto relative"
                    style={{
                        fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                        backgroundColor: '#ffffff',
                        background: '#ffffff !important',
                        color: '#1a1a1a !important',
                        maxWidth: '800px',
                        margin: '0 auto',
                        colorScheme: 'light',
                        minHeight: '297mm',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '32px 32px 24px', borderBottom: '2px solid #f8fafc', backgroundColor: '#ffffff !important', margin: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#ffffff !important' }}>
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', backgroundColor: '#ffffff !important' }} />
                            ) : (
                                <div style={{ width: '64px', height: '64px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1 !important', color: '#ffffff !important' }}>
                                    <span style={{ fontWeight: 900, fontSize: '24px' }}>M</span>
                                </div>
                            )}
                            <div style={{ backgroundColor: '#ffffff !important' }}>
                                <h2 style={{ fontWeight: 900, fontSize: '16px', textTransform: 'uppercase', color: '#0f172a !important' }}>{company.tradeName || company.companyName}</h2>
                                <div style={{ fontSize: '10px', color: '#64748b !important', fontWeight: 600 }}>
                                    {company.address && <p>{company.address}{company.city ? ', ' + company.city : ''}</p>}
                                    <p>{company.phone && 'Tel: ' + company.phone}{company.email && ' | ' + company.email}</p>
                                    {company.taxId && <p>NUIT: {company.taxId}</p>}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', backgroundColor: '#ffffff !important' }}>
                            <h1 style={{ fontWeight: 900, fontSize: '28px', color: '#6366f1 !important' }}>FATURA</h1>
                            <p style={{ fontSize: '11px', fontWeight: 800, color: isCopy ? '#ef4444 !important' : '#64748b !important' }}>{isCopy ? 'Deduplicada / Cópia' : 'Documento Original'}</p>
                            <p style={{ fontSize: '13px', color: '#0f172a !important', fontWeight: 800 }}>Nº {invoice.invoiceNumber}</p>
                            <div style={{ alignSelf: 'flex-end', marginTop: '6px', padding: '4px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, background: stColors.bg + ' !important', color: stColors.color + ' !important' }}>{statusLabels[invoice.status]}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#ffffff !important', margin: 0 }}>
                        <div style={{ borderRight: '1px solid #f3f4f6', backgroundColor: '#ffffff !important' }}>
                            <div style={{ ...sectionHeader, borderBottom: '1px solid #1a1a1a', paddingLeft: '32px', backgroundColor: '#ffffff !important' }}>
                                <h3 style={sectionTitle}>Dados do Cliente</h3>
                            </div>
                            <div style={{ padding: '12px 32px', backgroundColor: '#ffffff !important' }}>
                                <div style={fieldRow}><span style={fieldLabel}>Nome:</span><span style={fieldValue}>{invoice.customerName}</span></div>
                                {invoice.customerDocument && <div style={fieldRow}><span style={fieldLabel}>NUIT:</span><span style={fieldValue}>{invoice.customerDocument}</span></div>}
                                {invoice.customerPhone && <div style={fieldRow}><span style={fieldLabel}>Tel:</span><span style={fieldValue}>{invoice.customerPhone}</span></div>}
                                {invoice.customerAddress && <div style={fieldRow}><span style={fieldLabel}>Endereço:</span><span style={{ ...fieldValue, fontSize: '11px' }}>{invoice.customerAddress}</span></div>}
                            </div>
                        </div>
                        <div style={{ backgroundColor: '#ffffff !important' }}>
                            <div style={{ ...sectionHeader, borderBottom: '1px solid #1a1a1a', paddingLeft: '24px', backgroundColor: '#ffffff !important' }}>
                                <h3 style={sectionTitle}>Informações Gerais</h3>
                            </div>
                            <div style={{ padding: '12px 24px', backgroundColor: '#ffffff !important' }}>
                                <div style={fieldRow}><span style={fieldLabel}>Emissão:</span><span style={fieldValue}>{format(parseISO(invoice.issueDate), 'dd/MM/yyyy')}</span></div>
                                <div style={fieldRow}><span style={fieldLabel}>Vencimento:</span><span style={fieldValue}>{format(parseISO(invoice.dueDate), 'dd/MM/yyyy')}</span></div>
                                {invoice.paidDate && <div style={fieldRow}><span style={fieldLabel}>Pagamento:</span><span style={{ ...fieldValue, color: '#16a34a !important', fontWeight: 600 }}>{format(parseISO(invoice.paidDate), 'dd/MM/yyyy')}</span></div>}
                                <div style={fieldRow}><span style={fieldLabel}>Moeda:</span><span style={fieldValue}>Metical (MZN)</span></div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '16px 32px', backgroundColor: '#ffffff !important', margin: 0 }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', backgroundColor: '#ffffff !important' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc !important' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b !important', backgroundColor: '#f8fafc !important' }}>Produto / Serviço</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b !important', width: '60px', backgroundColor: '#f8fafc !important' }}>Qtd</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b !important', width: '120px', backgroundColor: '#f8fafc !important' }}>Preço Unit.</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b !important', width: '140px', backgroundColor: '#f8fafc !important' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(invoice.items || []).map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff !important' }}>
                                        <td style={{ padding: '12px 16px', color: '#1e293b !important', backgroundColor: '#ffffff !important' }}>{item.description}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569 !important', backgroundColor: '#ffffff !important' }}>{item.quantity}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569 !important', backgroundColor: '#ffffff !important' }}>{formatCurrency(item.unitPrice)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a !important', backgroundColor: '#ffffff !important' }}>{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#ffffff !important', margin: 0, flex: 1 }}>
                        <div style={{ maxWidth: '55%', backgroundColor: '#ffffff !important' }}>
                            {invoice.notes && <div style={{ marginBottom: '12px' }}><p style={{ fontSize: '11px', fontWeight: 700, color: '#374151 !important' }}>Observações:</p><p style={{ fontSize: '11px', color: '#4b5563 !important', fontStyle: 'italic' }}>{invoice.notes}</p></div>}
                            {invoice.terms && <div style={{ marginBottom: '12px' }}><p style={{ fontSize: '11px', fontWeight: 700, color: '#374151 !important' }}>Termos e Condições:</p><p style={{ fontSize: '10px', color: '#6b7280 !important' }}>{invoice.terms}</p></div>}
                        </div>
                        <div style={{ width: '220px', backgroundColor: '#f8fafc !important', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}><span style={{ color: '#64748b !important' }}>Subtotal</span><span style={{ color: '#1e293b !important' }}>{formatCurrency(invoice.subtotal)}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}><span style={{ color: '#64748b !important' }}>IVA (16%)</span><span style={{ color: '#1e293b !important' }}>{formatCurrency(invoice.tax)}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1.5px solid #1a1a1a', marginTop: '6px' }}><span style={{ fontWeight: 900 }}>Total a Pagar</span><span style={{ fontWeight: 900, fontSize: '14px' }}>{formatCurrency(invoice.total)}</span></div>
                        </div>
                    </div>

                    <div style={{ padding: '20px 32px 24px', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', backgroundColor: '#ffffff !important' }}>
                        <div style={{ textAlign: 'center' }}><div style={{ marginTop: '36px', borderBottom: '1px solid #1e293b' }} /><p style={{ fontSize: '10px', color: '#64748b !important' }}>Responsável</p></div>
                        <div style={{ textAlign: 'center' }}><div style={{ marginTop: '36px', borderBottom: '1px solid #1e293b' }} /><p style={{ fontSize: '10px', color: '#64748b !important' }}>Assinatura do Cliente</p></div>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af !important', padding: '12px 32px 24px', backgroundColor: '#ffffff !important' }}>
                        <p>Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {company.tradeName || company.companyName}</p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}

export function formatCurrency(value: number, currency: string = 'MZN'): string {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency }).format(value);
}
