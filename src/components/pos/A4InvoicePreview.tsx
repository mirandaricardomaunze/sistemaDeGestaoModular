/**
 * A4 Invoice Preview Component
 * Professional A4 Invoice template for Mozambican AT compliance
 */

import { useRef, useEffect, useMemo } from 'react';
import { HiOutlinePrinter, HiOutlineX, HiOutlineDownload, HiOutlineMail, HiOutlineDocumentText } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Badge } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { Sale } from '../../types';
import toast from 'react-hot-toast';

interface A4InvoicePreviewProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale;
}

export default function A4InvoicePreview({ isOpen, onClose, sale }: A4InvoicePreviewProps) {
    // Load company settings on mount
    const { companySettings: company, loadCompanySettings } = useStore();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);
    // Deterministic display hash derived from sale ID — replace with AT-issued digital hash when available
    const simulatedHash = useMemo(() => {
        const seed = sale.id.replace(/-/g, '');
        return `${seed.substring(0, 4).toUpperCase()}-${seed.substring(4, 8).toUpperCase()}`;
    }, [sale.id]);

    useEffect(() => {
        if (isOpen) {
            loadCompanySettings();
        }
    }, [isOpen, loadCompanySettings]);

    // Format date/time
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-MZ');
    };

    const handlePrint = () => {
        if (!printRef.current) return;

        // Clone content to manipulate it safely
        const contentClone = printRef.current.cloneNode(true) as HTMLElement;

        // Remove the screen-only header from the clone (we will recreate it with print-specific styles)
        const screenHeader = contentClone.querySelector('#screen-header');
        if (screenHeader) {
            screenHeader.remove();
        }

        const logoHtml = company.logo
            ? `<img src="${company.logo}" style="max-height: 80px; margin-bottom: 15px; display: block;" alt="Logo" />`
            : '';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Fatura ${sale.receiptNumber}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        font-size: 11px;
                        line-height: 1.5;
                        color: #1a1a1a;
                        margin: 0;
                        padding: 0;
                    }
                    .invoice-container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 10px;
                        background: #fff;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 24px;
                        border-bottom: 1.5px solid #1a1a1a;
                        padding-bottom: 12px;
                    }
                    .company-info {
                        flex: 1;
                    }
                    .company-info h1 {
                        font-size: 18px;
                        color: #0f172a;
                        margin: 0 0 4px 0;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: -0.025em;
                        line-height: 1.1;
                    }
                    .company-info p {
                        margin: 1px 0;
                        color: #64748b;
                        font-size: 10px;
                    }
                    .invoice-meta {
                        text-align: right;
                    }
                    .invoice-meta h2 {
                        font-size: 18px;
                        color: #1a1a1a;
                        margin: 0 0 4px 0;
                        font-weight: 800;
                    }
                    .invoice-meta p {
                        margin: 1px 0;
                        font-weight: 600;
                        font-size: 10px;
                    }
                    .customer-section { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 24px; }
                    .customer-box { flex: 1; padding: 12px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; }
                    .customer-box h3 { font-size: 9px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; letter-spacing: 0.05em; font-weight: 800; }
                    .customer-box p { margin: 1px 0; font-size: 10px; font-weight: 500; line-height: 1.3; }
                    .table-container { margin-bottom: 24px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #ffffff; color: #475569; text-align: left; padding: 8px 10px; font-weight: 900; font-size: 9px; text-transform: uppercase; letter-spacing: 0.025em; border-bottom: 1.5px solid #1a1a1a; }
                    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 10px; }
                    .text-right { text-align: right; }
                    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 30px; }
                    .totals-table { width: 220px; }
                    .totals-table tr td { padding: 4px 0; }
                    .totals-table tr td:first-child { font-weight: 600; color: #64748b; font-size: 9px; text-transform: uppercase; }
                    .totals-table tr.grand-total td { font-size: 14px; font-weight: 900; color: #0f172a; border-top: 1.5px solid #1a1a1a; padding-top: 8px; }
                    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 9px; }
                    .payment-info { margin-top: 12px; font-size: 9px; color: #64748b; }
                    @media print {
                        .no-print { display: none !important; }
                        body { padding: 0; }
                        .invoice-container { padding: 0; box-shadow: none; border: none; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <div class="header">
                        <div class="company-info">
                            ${logoHtml}
                            <h1>${company.tradeName || company.companyName}</h1>
                            <p>${company.address}</p>
                            <p>${company.city}, ${company.province}</p>
                            <p>NUIT: ${company.taxId}</p>
                            <p>Tel: ${company.phone} | Email: ${company.email}</p>
                        </div>
                        <div class="invoice-meta">
                            <h2>FATURA</h2>
                            <p>#${sale.receiptNumber}</p>
                            <p style="font-weight: 400; font-size: 10px; color: #666; margin-top: 5px;">Data de Emissão</p>
                            <p>${formatDate(sale.createdAt)}</p>
                            <p style="font-weight: 400; font-size: 10px; color: #666; margin-top: 5px;">Moeda</p>
                            <p>MZN</p>
                        </div>
                    </div>
                    
                    ${contentClone.innerHTML} 
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);

        toast.success('Documento enviado para a fila de impressão');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Visualização de Fatura A4" size="xl">
            <div className="flex flex-col h-[80vh]">
                {/* Actions Toolbar */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-800 border-b dark:border-dark-700 no-print rounded-t-xl">
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <HiOutlinePrinter className="w-4 h-4 mr-2" />
                            Imprimir
                        </Button>
                        <Button variant="outline" size="sm">
                            <HiOutlineDownload className="w-4 h-4 mr-2" />
                            Baixar PDF
                        </Button>
                        <Button variant="outline" size="sm">
                            <HiOutlineMail className="w-4 h-4 mr-2" />
                            Enviar por Email
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                            onClick={() => navigate(`/commercial/invoices?search=${sale.receiptNumber}&open=true`)}
                        >
                            <HiOutlineDocumentText className="w-4 h-4 mr-2" />
                            Gerar Fatura Comercial
                        </Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <HiOutlineX className="w-5 h-5" />
                    </Button>
                </div>

                {/* Document Preview Area */}
                <div className="flex-1 overflow-y-auto p-8 !bg-gray-100 dark:!bg-gray-100">
                    <div
                        ref={printRef}
                        className="bg-white text-gray-900 mx-auto w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl rounded-sm print-table !bg-white !text-gray-900"
                        style={{ fontFamily: 'Inter, sans-serif', colorScheme: 'light', backgroundColor: '#ffffff' }}
                    >
                        {/* Internal Content (Simplified CSS for React integration) */}
                        <div id="screen-header" className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4" style={{ backgroundColor: 'white' }}>
                            <div className="flex gap-4 items-center">
                                {company.logo && (
                                    <img
                                        src={company.logo}
                                        alt="Company Logo"
                                        className="h-12 w-12 object-contain"
                                    />
                                )}
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 tracking-tighter mb-0.5 uppercase leading-none">
                                        {company.tradeName || company.companyName}
                                    </h1>
                                    <div className="text-[10px] text-gray-500 space-y-0 leading-tight">
                                        <p>{company.address}{company.city ? `, ${company.city}` : ''}</p>
                                        <p>NUIT: {company.taxId} | Tel: {company.phone}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-black text-gray-900 mb-0.5">FATURA</h2>
                                <p className="font-bold text-gray-800 text-sm">#{sale.receiptNumber}</p>
                                <div className="text-[10px] text-gray-500 mt-1 leading-tight">
                                    <p>Data: {formatDate(sale.createdAt)}</p>
                                    <p>Moeda: MZN</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white p-4 rounded-lg border border-gray-200" style={{ backgroundColor: 'white' }}>
                                <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">CLIENTE</h3>
                                <div className="text-gray-900">
                                    <p className="font-black text-base leading-tight">
                                        {sale.customer?.name ||
                                            (sale.notes && sale.notes.startsWith('Cliente: ')
                                                ? sale.notes.replace('Cliente: ', '')
                                                : 'Consumidor Final')}
                                    </p>
                                    {sale.customer && (
                                        <div className="text-[10px] text-gray-600 mt-1 space-y-0 leading-tight">
                                            {sale.customer.document && <p>NUIT: {sale.customer.document}</p>}
                                            {sale.customer.address && <p>{sale.customer.address}</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Estado</span>
                                    <Badge variant="success" size="sm">PAGO</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Método</span>
                                    <span className="text-[11px] font-black text-gray-900 capitalize">{sale.paymentMethod}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <table className="w-full text-left print-table" style={{ backgroundColor: 'white' }}>
                                <thead>
                                    <tr className="bg-white text-gray-900 border-b-2 border-gray-900">
                                        <th className="px-4 py-3 text-[10px] font-black uppercase">Descrição do Item</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase text-center">Qtd</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase text-right">Preço Unit.</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase text-right">IVA (%)</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(sale.items || []).map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-[11px] text-gray-900 leading-tight">{item.product.name}</p>
                                                <p className="text-[9px] text-gray-400">{item.product.code}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center text-[11px] text-gray-600">{item.quantity}</td>
                                            <td className="px-4 py-3 text-right text-[11px] text-gray-600">{formatCurrency(item.unitPrice)}</td>
                                            <td className="px-4 py-3 text-right text-[10px] text-gray-500">{formatCurrency(item.total * 0.16 / 1.16)}</td>
                                            <td className="px-4 py-3 text-right font-black text-[11px] text-gray-900">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mb-8">
                            <div className="w-64 space-y-1 bg-slate-50 p-3 rounded-lg border border-gray-100">
                                <div className="flex justify-between text-[10px] text-gray-600">
                                    <span className="font-bold uppercase">Subtotal</span>
                                    <span className="font-semibold">{formatCurrency(sale.subtotal)}</span>
                                </div>
                                {sale.discount > 0 && (
                                    <div className="flex justify-between text-[10px] text-emerald-600 font-bold uppercase">
                                        <span>Desconto</span>
                                        <span>-{formatCurrency(sale.discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-[10px] text-gray-600">
                                    <span className="font-bold uppercase">IVA (16%)</span>
                                    <span className="font-semibold">{formatCurrency(sale.tax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t-2 border-gray-900 mt-2">
                                    <span className="text-xs font-black text-gray-900 uppercase">Total a Pagar</span>
                                    <span className="text-xl font-black text-gray-900 tracking-tighter">
                                        {formatCurrency(sale.total)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* AT Compliance Footnote */}
                        <div className="mt-auto pt-6 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-6 items-end">
                                <div className="text-[8px] text-gray-400 space-y-0.5 leading-tight">
                                    <p className="font-black text-gray-500 uppercase tracking-tighter">NOTAS:</p>
                                    <p>Os produtos/serviços foram colocados à disposição do adquirente na data e local do documento.</p>
                                    <p>Regime Geral de IVA. Processado por Computador.</p>
                                    <div className="font-mono mt-1 text-[7px] text-gray-300">
                                        Hash: {sale.hashCode || simulatedHash}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="inline-block border border-gray-200 p-2 rounded-lg bg-white text-left min-w-[180px]">
                                        <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center">Dados Bancários</p>
                                        {company.bankAccounts && company.bankAccounts.length > 0 ? (
                                            company.bankAccounts.slice(0, 2).map((bank, idx) => (
                                                <p key={idx} className="text-[9px] text-gray-700 leading-tight">
                                                    <strong>{bank.bankName}:</strong> {bank.accountNumber}
                                                </p>
                                            ))
                                        ) : (
                                            <p className="text-[8px] text-gray-400 italic text-center">Numerário / M-Pesa</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <p className="text-center text-[8px] text-gray-300 mt-8">
                                {company.tradeName || company.companyName} - NUIT: {company.taxId} - {company.address}, {company.city}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
