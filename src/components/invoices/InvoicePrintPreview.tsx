import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { HiOutlinePrinter, HiOutlineX } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { Invoice, InvoiceStatus } from '../../types';
import toast from 'react-hot-toast';

interface InvoicePrintPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice;
}

const statusLabels: Record<InvoiceStatus, string> = {
    draft: 'Rascunho',
    sent: 'Enviada',
    paid: 'Paga',
    partial: 'Parcial',
    overdue: 'Vencida',
    cancelled: 'Cancelada',
};

const paymentMethodLabels: Record<string, string> = {
    pix: 'PIX',
    transfer: 'Transferência',
    cash: 'Dinheiro',
    card: 'Cartão',
    credit: 'Crédito',
    invoice: 'Fatura',
};

export default function InvoicePrintPreview({ isOpen, onClose, invoice }: InvoicePrintPreviewProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings: company } = useStore();

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=900,height=700');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        const logoHtml = company.logo
            ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${company.logo}" style="max-height: 80px;" /></div>`
            : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Fatura ${invoice.invoiceNumber}</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Segoe UI', Arial, sans-serif;
                            padding: 40px;
                            max-width: 800px;
                            margin: 0 auto;
                            color: #1f2937;
                            background: #fff;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            padding-bottom: 30px;
                            border-bottom: 3px solid #6366f1;
                            margin-bottom: 30px;
                        }
                        .company-info h1 {
                            font-size: 28px;
                            color: #6366f1;
                            margin-bottom: 8px;
                            font-weight: 700;
                        }
                        .company-info p {
                            font-size: 12px;
                            color: #6b7280;
                            line-height: 1.6;
                        }
                        .invoice-badge {
                            text-align: right;
                        }
                        .invoice-badge .label {
                            font-size: 14px;
                            color: #6b7280;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .invoice-badge .number {
                            font-size: 32px;
                            font-weight: 700;
                            color: #1f2937;
                        }
                        .invoice-badge .status {
                            display: inline-block;
                            padding: 4px 12px;
                            border-radius: 20px;
                            font-size: 12px;
                            font-weight: 600;
                            margin-top: 8px;
                        }
                        .status-paid { background: #dcfce7; color: #166534; }
                        .status-partial { background: #fef9c3; color: #854d0e; }
                        .status-overdue { background: #fee2e2; color: #991b1b; }
                        .status-sent { background: #dbeafe; color: #1e40af; }
                        .status-draft { background: #f3f4f6; color: #4b5563; }
                        .status-cancelled { background: #f3f4f6; color: #9ca3af; }
                        
                        .info-section {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 30px;
                            margin-bottom: 30px;
                        }
                        .info-box {
                            background: #f9fafb;
                            padding: 20px;
                            border-radius: 8px;
                        }
                        .info-box h3 {
                            font-size: 12px;
                            color: #6b7280;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            margin-bottom: 12px;
                        }
                        .info-box p {
                            font-size: 14px;
                            color: #1f2937;
                            line-height: 1.6;
                        }
                        .info-box p strong {
                            display: block;
                            font-size: 16px;
                            margin-bottom: 4px;
                        }
                        
                        .dates-row {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        .date-item {
                            text-align: center;
                            padding: 15px;
                            background: #f9fafb;
                            border-radius: 8px;
                        }
                        .date-item .label {
                            font-size: 11px;
                            color: #6b7280;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .date-item .value {
                            font-size: 16px;
                            font-weight: 600;
                            color: #1f2937;
                            margin-top: 4px;
                        }
                        
                        .items-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                        }
                        .items-table thead {
                            background: #6366f1;
                            color: #fff;
                        }
                        .items-table th {
                            padding: 12px 16px;
                            text-align: left;
                            font-size: 12px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            font-weight: 600;
                        }
                        .items-table th:last-child,
                        .items-table td:last-child {
                            text-align: right;
                        }
                        .items-table tbody tr {
                            border-bottom: 1px solid #e5e7eb;
                        }
                        .items-table tbody tr:nth-child(even) {
                            background: #f9fafb;
                        }
                        .items-table td {
                            padding: 14px 16px;
                            font-size: 14px;
                        }
                        
                        .totals-section {
                            display: flex;
                            justify-content: flex-end;
                            margin-bottom: 30px;
                        }
                        .totals-box {
                            width: 300px;
                            background: #f9fafb;
                            border-radius: 8px;
                            padding: 20px;
                        }
                        .totals-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 8px 0;
                            font-size: 14px;
                        }
                        .totals-row.discount {
                            color: #dc2626;
                        }
                        .totals-row.total {
                            border-top: 2px solid #6366f1;
                            margin-top: 10px;
                            padding-top: 15px;
                            font-size: 18px;
                            font-weight: 700;
                        }
                        .totals-row.paid {
                            color: #16a34a;
                        }
                        .totals-row.due {
                            color: #dc2626;
                            font-weight: 600;
                        }
                        
                        .payments-section {
                            margin-bottom: 30px;
                        }
                        .payments-section h3 {
                            font-size: 14px;
                            font-weight: 600;
                            color: #1f2937;
                            margin-bottom: 15px;
                            padding-bottom: 8px;
                            border-bottom: 1px solid #e5e7eb;
                        }
                        .payment-item {
                            display: flex;
                            justify-content: space-between;
                            padding: 10px 0;
                            border-bottom: 1px dashed #e5e7eb;
                            font-size: 13px;
                        }
                        .payment-item .method {
                            background: #e0e7ff;
                            color: #4338ca;
                            padding: 2px 8px;
                            border-radius: 4px;
                            font-size: 11px;
                            margin-left: 8px;
                        }
                        .payment-item .amount {
                            color: #16a34a;
                            font-weight: 600;
                        }
                        
                        .notes-section {
                            background: #fffbeb;
                            border-left: 4px solid #f59e0b;
                            padding: 15px 20px;
                            margin-bottom: 30px;
                            border-radius: 0 8px 8px 0;
                        }
                        .notes-section h4 {
                            font-size: 12px;
                            color: #92400e;
                            margin-bottom: 8px;
                        }
                        .notes-section p {
                            font-size: 13px;
                            color: #78350f;
                        }
                        
                        .terms-section {
                            background: #f3f4f6;
                            padding: 15px 20px;
                            margin-bottom: 30px;
                            border-radius: 8px;
                        }
                        .terms-section h4 {
                            font-size: 12px;
                            color: #6b7280;
                            margin-bottom: 8px;
                        }
                        .terms-section p {
                            font-size: 13px;
                            color: #4b5563;
                        }
                        
                        .footer {
                            text-align: center;
                            padding-top: 30px;
                            border-top: 1px solid #e5e7eb;
                        }
                        .footer p {
                            font-size: 12px;
                            color: #9ca3af;
                        }
                        .footer p:first-child {
                            color: #6366f1;
                            font-weight: 600;
                            margin-bottom: 5px;
                        }
                        
                        @media print {
                            body { 
                                padding: 20px;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    ${logoHtml}
                    ${content.innerHTML}
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);

        toast.success('Fatura enviada para impressão!');
    };

    const getStatusClass = (status: InvoiceStatus) => {
        return `status-${status}`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Imprimir Fatura" size="xl">
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button onClick={handlePrint}>
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            {/* Print Preview */}
            <Card padding="lg" className="max-h-[70vh] overflow-y-auto">
                <div ref={printRef}>
                    {/* Header */}
                    <div className="header">
                        <div className="company-info">
                            {company.logo && (
                                <img src={company.logo} alt="Logo" style={{ maxHeight: '60px', marginBottom: '10px' }} />
                            )}
                            <h1>{company.tradeName || company.companyName}</h1>
                            <p>
                                {company.address}<br />
                                {company.city}, {company.state} - {company.zipCode}<br />
                                Tel: {company.phone}<br />
                                {company.email}<br />
                                NUIT: {company.taxId}
                            </p>
                        </div>
                        <div className="invoice-badge">
                            <div className="label">Fatura</div>
                            <div className="number">{invoice.invoiceNumber}</div>
                            {invoice.orderNumber && (
                                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                    Ref. Encomenda: {invoice.orderNumber}
                                </p>
                            )}
                            <div className={`status ${getStatusClass(invoice.status)}`}>
                                {statusLabels[invoice.status]}
                            </div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="info-section">
                        <div className="info-box">
                            <h3>Cliente</h3>
                            <p>
                                <strong>{invoice.customerName}</strong>
                                {invoice.customerPhone && <>{invoice.customerPhone}<br /></>}
                                {invoice.customerEmail && <>{invoice.customerEmail}<br /></>}
                                {invoice.customerDocument && <>Documento: {invoice.customerDocument}<br /></>}
                                {invoice.customerAddress && <>{invoice.customerAddress}</>}
                            </p>
                        </div>
                        <div className="info-box">
                            <h3>Datas</h3>
                            <p>
                                <strong>Emissão:</strong> {format(parseISO(invoice.issueDate), 'dd/MM/yyyy')}<br />
                                <strong>Vencimento:</strong> {format(parseISO(invoice.dueDate), 'dd/MM/yyyy')}
                                {invoice.paidDate && (
                                    <>
                                        <br />
                                        <strong style={{ color: '#16a34a' }}>
                                            Pago em: {format(parseISO(invoice.paidDate), 'dd/MM/yyyy')}
                                        </strong>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="items-table">
                        <thead>
                            <tr>
                                <th style={{ width: '50%' }}>Descrição</th>
                                <th style={{ width: '12%', textAlign: 'center' }}>Qtd</th>
                                <th style={{ width: '18%', textAlign: 'right' }}>Preço Unit.</th>
                                <th style={{ width: '20%' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.description}</td>
                                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                    <td>{formatCurrency(item.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="totals-section">
                        <div className="totals-box">
                            <div className="totals-row">
                                <span>Subtotal</span>
                                <span>{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.discount > 0 && (
                                <div className="totals-row discount">
                                    <span>Desconto</span>
                                    <span>-{formatCurrency(invoice.discount)}</span>
                                </div>
                            )}
                            {invoice.tax > 0 && (
                                <div className="totals-row">
                                    <span>IVA (16%)</span>
                                    <span>+{formatCurrency(invoice.tax)}</span>
                                </div>
                            )}
                            <div className="totals-row total">
                                <span>Total (c/ IVA)</span>
                                <span>{formatCurrency(invoice.total)}</span>
                            </div>
                            {invoice.amountPaid > 0 && (
                                <div className="totals-row paid">
                                    <span>Valor Pago</span>
                                    <span>{formatCurrency(invoice.amountPaid)}</span>
                                </div>
                            )}
                            {invoice.amountDue > 0 && (
                                <div className="totals-row due">
                                    <span>Valor Pendente</span>
                                    <span>{formatCurrency(invoice.amountDue)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payments History */}
                    {invoice.payments.length > 0 && (
                        <div className="payments-section">
                            <h3>Histórico de Pagamentos</h3>
                            {invoice.payments.map((payment, index) => (
                                <div key={index} className="payment-item">
                                    <span>
                                        {format(parseISO(payment.date), 'dd/MM/yyyy')}
                                        <span className="method">
                                            {paymentMethodLabels[payment.method] || payment.method}
                                        </span>
                                        {payment.reference && (
                                            <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                                Ref: {payment.reference}
                                            </span>
                                        )}
                                    </span>
                                    <span className="amount">{formatCurrency(payment.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Notes */}
                    {invoice.notes && (
                        <div className="notes-section">
                            <h4>Observações</h4>
                            <p>{invoice.notes}</p>
                        </div>
                    )}

                    {/* Terms */}
                    {invoice.terms && (
                        <div className="terms-section">
                            <h4>Termos e Condições</h4>
                            <p>{invoice.terms}</p>
                        </div>
                    )}

                    {/* Bank Accounts */}
                    {company.bankAccounts && company.bankAccounts.length > 0 && (
                        <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Dados Bancários</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                                {company.bankAccounts.map((bank, idx) => (
                                    <div key={idx} style={{ fontSize: '13px' }}>
                                        <p style={{ fontWeight: 600, color: '#1e293b' }}>{bank.bankName}</p>
                                        <p style={{ color: '#475569' }}>Conta: {bank.accountNumber}</p>
                                        {bank.nib && <p style={{ color: '#64748b', fontSize: '11px' }}>NIB: {bank.nib}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="footer">
                        <p>Obrigado pela preferência!</p>
                        <p>
                            {company.tradeName || company.companyName} | {company.phone} | {company.email}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal >
    );
}
