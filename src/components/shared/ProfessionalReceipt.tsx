/**
 * ProfessionalReceipt - A4 Professional Receipt/Invoice for POS Sales
 * Uses DocumentPreviewModal for consistent preview experience
 */

import { format } from 'date-fns';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { Sale } from '../../types';
import DocumentPreviewModal from './DocumentPreviewModal';

interface ProfessionalReceiptProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale;
}

const paymentLabels: Record<string, string> = {
    cash: 'Dinheiro',
    card: 'Cartão',
    pix: 'PIX',
    mpesa: 'M-Pesa',
    emola: 'E-Mola',
    transfer: 'Transferência',
    credit: 'Crédito',
};

export default function ProfessionalReceipt({ isOpen, onClose, sale }: ProfessionalReceiptProps) {
    const { companySettings } = useStore();

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: format(date, 'dd/MM/yyyy'),
            time: format(date, 'HH:mm:ss'),
        };
    };

    const { date, time } = formatDateTime(sale.createdAt);

    // Extract customer name from notes if available
    const customerName = sale.notes?.startsWith('Cliente: ')
        ? sale.notes.replace('Cliente: ', '')
        : 'Consumidor Final';

    return (
        <DocumentPreviewModal
            isOpen={isOpen}
            onClose={onClose}
            title="Fatura-Recibo Profissional"
            documentTitle={`Fatura-Recibo ${sale.receiptNumber}`}
            footerText="Este documento serve como comprovativo de compra. Guarde para futuras referências."
        >
            <style>{`
                .receipt-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                .receipt-table th { 
                    background: #f3f4f6; 
                    padding: 10px 12px; 
                    text-align: left; 
                    font-size: 8pt; 
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #374151;
                    border-bottom: 2px solid #e5e7eb;
                }
                .receipt-table td { 
                    padding: 10px 12px; 
                    font-size: 9pt; 
                    border-bottom: 1px solid #f3f4f6;
                }
                .receipt-table tbody tr:hover { background: #fafafa; }
                .receipt-totals { 
                    margin-left: auto; 
                    width: 280px; 
                    background: #f9fafb; 
                    border-radius: 8px; 
                    padding: 15px;
                }
                .receipt-totals-row { 
                    display: flex; 
                    justify-content: space-between; 
                    padding: 6px 0; 
                    font-size: 9pt;
                }
                .receipt-totals-row.total {
                    border-top: 2px solid #6366f1;
                    margin-top: 10px;
                    padding-top: 12px;
                    font-size: 12pt;
                    font-weight: 700;
                    color: #1f2937;
                }
            `}</style>

            {/* Document Title */}
            <div className="text-center mb-6">
                <h2 className="text-2xl font-black uppercase tracking-widest text-gray-900">
                    Fatura-Recibo
                </h2>
                <p className="text-sm text-gray-500 mt-1">Documento Fiscal Original</p>
            </div>

            {/* Receipt Info Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-[8pt] text-gray-400 uppercase tracking-wider font-bold">Nº Documento</p>
                    <p className="text-lg font-black text-primary-600">{sale.receiptNumber}</p>
                    {sale.series && (
                        <p className="text-[9pt] text-gray-500">Série: {sale.series}</p>
                    )}
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-[8pt] text-gray-400 uppercase tracking-wider font-bold">Data</p>
                    <p className="text-base font-bold">{date}</p>
                    <p className="text-[9pt] text-gray-500">{time}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-[8pt] text-gray-400 uppercase tracking-wider font-bold">Estado</p>
                    <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-700 text-[9pt] font-bold rounded-full">
                        PAGO
                    </span>
                </div>
            </div>

            {/* Customer Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                <p className="text-[8pt] text-blue-400 uppercase tracking-wider font-bold mb-1">Cliente</p>
                <p className="text-base font-bold text-gray-900">{customerName}</p>
            </div>

            {/* Items Table */}
            <table className="receipt-table">
                <thead>
                    <tr>
                        <th style={{ width: '50%' }}>Descrição</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Qtd</th>
                        <th style={{ width: '20%', textAlign: 'right' }}>Preço Unit.</th>
                        <th style={{ width: '20%', textAlign: 'right' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item, index) => (
                        <tr key={index}>
                            <td>
                                <p className="font-medium text-gray-900">{item.product.name}</p>
                                <p className="text-[8pt] text-gray-400">{item.product.code}</p>
                            </td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals Section */}
            <div className="flex justify-end mt-6">
                <div className="receipt-totals">
                    <div className="receipt-totals-row">
                        <span className="text-gray-500">Subtotal</span>
                        <span>{formatCurrency(sale.subtotal)}</span>
                    </div>
                    {sale.discount > 0 && (
                        <div className="receipt-totals-row text-green-600">
                            <span>Desconto</span>
                            <span>-{formatCurrency(sale.discount)}</span>
                        </div>
                    )}
                    <div className="receipt-totals-row">
                        <span className="text-gray-500">IVA (16%)</span>
                        <span>{formatCurrency(sale.tax)}</span>
                    </div>
                    <div className="receipt-totals-row total">
                        <span>Total (c/ IVA)</span>
                        <span className="text-primary-600">{formatCurrency(sale.total)}</span>
                    </div>
                </div>
            </div>

            {/* Payment Info */}
            <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-[8pt] text-gray-400 uppercase font-bold">Método de Pagamento</p>
                        <p className="text-sm font-bold">{paymentLabels[sale.paymentMethod] || sale.paymentMethod}</p>
                    </div>
                    <div>
                        <p className="text-[8pt] text-gray-400 uppercase font-bold">Valor Recebido</p>
                        <p className="text-sm font-bold">{formatCurrency(sale.amountPaid)}</p>
                    </div>
                    {sale.change > 0 && (
                        <div>
                            <p className="text-[8pt] text-gray-400 uppercase font-bold">Troco</p>
                            <p className="text-sm font-bold text-green-600">{formatCurrency(sale.change)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bank Accounts Section (Optional) */}
            {companySettings.bankAccounts && companySettings.bankAccounts.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[8pt] text-gray-400 uppercase font-bold mb-3 tracking-widest">Dados Bancários</p>
                    <div className="grid grid-cols-2 gap-4">
                        {companySettings.bankAccounts.map((bank, idx) => (
                            <div key={idx} className="text-[9pt]">
                                <p className="font-bold text-gray-700">{bank.bankName}</p>
                                <p className="text-gray-500">CONTA: {bank.accountNumber}</p>
                                {bank.nib && <p className="text-gray-400 text-[8pt]">NIB/IBAN: {bank.nib}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Fiscal Info */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-end">
                <div>
                    <p className="text-[7pt] text-gray-400">Assinatura Digital</p>
                    <p className="font-mono text-[9pt] text-gray-600">{sale.hashCode || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <p className="text-[7pt] text-gray-400">Nº Fiscal</p>
                    <p className="font-mono text-[9pt] text-gray-600">{sale.fiscalNumber || 'N/A'}</p>
                </div>
            </div>

            {/* QR Code placeholder */}
            <div className="mt-6 flex justify-center">
                <div className="w-24 h-24 bg-white border p-1">
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=FR-${sale.receiptNumber}-${sale.total}`}
                        alt="QR Code"
                        className="w-full h-full"
                    />
                </div>
            </div>
        </DocumentPreviewModal>
    );
}
