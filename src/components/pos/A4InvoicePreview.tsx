/**
 * A4 Invoice Preview Component
 * Professional A4 Invoice template for Mozambican AT compliance
 */

import { useRef, useEffect } from 'react';
import { HiOutlinePrinter, HiOutlineX, HiOutlineDownload, HiOutlineMail } from 'react-icons/hi';
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
    const printRef = useRef<HTMLDivElement>(null);
    const simulatedHash = useMemo(() => {
        return `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }, []);

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
                        padding: 20px;
                        background: #fff;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 40px;
                        border-bottom: 2px solid #f3f4f6;
                        padding-bottom: 20px;
                    }
                    .company-info {
                        flex: 1;
                    }
                    .company-info h1 {
                        font-size: 24px;
                        color: #0f172a;
                        margin: 0 0 8px 0;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: -0.025em;
                    }
                    .company-info p {
                        margin: 2px 0;
                        color: #64748b;
                    }
                    .invoice-meta {
                        text-align: right;
                    }
                    .invoice-meta h2 {
                        font-size: 20px;
                        color: #2563eb;
                        margin: 0 0 8px 0;
                        font-weight: 700;
                    }
                    .invoice-meta p {
                        margin: 2px 0;
                        font-weight: 600;
                    }
                    /* ... rest of styles ... */
                    /* Re-injecting common styles here for safety */
                    .customer-section { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px; }
                    .customer-box { flex: 1; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .customer-box h3 { font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0 0 8px 0; letter-spacing: 0.05em; }
                    .customer-box p { margin: 2px 0; font-size: 11px; font-weight: 500; }
                    .table-container { margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #1e293b; color: #fff; text-align: left; padding: 10px 12px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.025em; }
                    td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                    .text-right { text-align: right; }
                    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
                    .totals-table { width: 250px; }
                    .totals-table tr td:first-child { font-weight: 600; color: #64748b; }
                    .totals-table tr.grand-total td { font-size: 16px; font-weight: 800; color: #2563eb; border-top: 2px solid #2563eb; padding-top: 12px; }
                    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px; }
                    .payment-info { margin-top: 20px; font-size: 10px; color: #64748b; }
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
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <HiOutlineX className="w-5 h-5" />
                    </Button>
                </div>

                {/* Document Preview Area */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-100 dark:bg-dark-900">
                    <div
                        ref={printRef}
                        className="bg-white text-gray-900 mx-auto w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl rounded-sm"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                        {/* Internal Content (Simplified CSS for React integration) */}
                        <div id="screen-header" className="flex justify-between items-start mb-12 border-b-2 border-gray-100 pb-8">
                            <div>
                                {company.logo && (
                                    <img
                                        src={company.logo}
                                        alt="Company Logo"
                                        className="h-20 mb-4 object-contain"
                                    />
                                )}
                                <h1 className="text-3xl font-black text-gray-900 tracking-tighter mb-2 uppercase">
                                    {company.tradeName || company.companyName}
                                </h1>
                                <div className="text-sm text-gray-500 space-y-0.5">
                                    <p>{company.address}</p>
                                    <p>{company.city}, {company.province}</p>
                                    <p>NUIT: {company.taxId}</p>
                                    <p>Tel: {company.phone} | Email: {company.email}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-bold text-primary-600 mb-1">FATURA</h2>
                                <p className="font-bold text-gray-800">#{sale.receiptNumber}</p>
                                <p className="text-sm text-gray-500 mt-2">Data de Emissão: {formatDate(sale.createdAt)}</p>
                                <p className="text-sm text-gray-500">Moeda: MZN</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-12">
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">CLIENTE</h3>
                                <div className="text-gray-900">
                                    <p className="font-bold text-lg">
                                        {sale.customer?.name ||
                                            (sale.notes && sale.notes.startsWith('Cliente: ')
                                                ? sale.notes.replace('Cliente: ', '')
                                                : 'Consumidor Final')}
                                    </p>
                                    {sale.customer && (
                                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                                            {sale.customer.document && <p>NUIT: {sale.customer.document}</p>}
                                            {sale.customer.address && <p>{sale.customer.address}</p>}
                                            {sale.customer.phone && <p>Tel: {sale.customer.phone}</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-primary-50 p-6 rounded-xl border border-primary-100 flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-primary-700 font-medium">Estado do Pagamento</span>
                                    <Badge variant="success">PAGO</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-primary-700 font-medium">Método</span>
                                    <span className="text-sm font-bold text-primary-900 capitalize">{sale.paymentMethod}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-12">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-900 text-white">
                                        <th className="rounded-tl-lg px-4 py-3 text-xs font-bold uppercase">Descrição</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-center">Qtd</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-right">Preço Unit.</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-right">IVA (16%)</th>
                                        <th className="rounded-tr-lg px-4 py-3 text-xs font-bold uppercase text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sale.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900">{item.product.name}</p>
                                                <p className="text-xs text-gray-500">{item.product.code}</p>
                                            </td>
                                            <td className="px-4 py-4 text-center text-gray-600">{item.quantity}</td>
                                            <td className="px-4 py-4 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                                            <td className="px-4 py-4 text-right text-gray-600">{formatCurrency(item.total * 0.16 / 1.16)}</td>
                                            <td className="px-4 py-4 text-right font-bold text-gray-900">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mb-12">
                            <div className="w-80 space-y-3">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-semibold">{formatCurrency(sale.subtotal)}</span>
                                </div>
                                {sale.discount > 0 && (
                                    <div className="flex justify-between text-sm text-emerald-600 font-medium">
                                        <span>Desconto</span>
                                        <span>-{formatCurrency(sale.discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>IVA (16%)</span>
                                    <span className="font-semibold">{formatCurrency(sale.tax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t-4 border-primary-600">
                                    <span className="text-lg font-black text-gray-900 uppercase">Total</span>
                                    <span className="text-2xl font-black text-primary-600 tracking-tighter">
                                        {formatCurrency(sale.total)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* AT Compliance Footnote */}
                        <div className="mt-auto pt-12 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-8 items-end">
                                <div className="text-[9px] text-gray-400 space-y-1">
                                    <p className="font-bold text-gray-500">NOTAS:</p>
                                    <p>Os produtos/serviços foram colocados à disposição do adquirente na data e local do documento.</p>
                                    <p>Regime Geral de IVA.</p>
                                    <p className="text-gray-900 font-medium italic mt-2">Processado por Computador</p>
                                    <div className="font-mono mt-1">
                                        Hash: {sale.hashCode || simulatedHash} (Simulado)
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="inline-block border-2 border-primary-100 p-4 rounded-2xl bg-primary-50/30 text-left min-w-[200px]">
                                        <p className="text-[8px] font-bold text-primary-500 uppercase tracking-widest mb-2 text-center">Dados Bancários para Transferência</p>
                                        {company.bankAccounts && company.bankAccounts.length > 0 ? (
                                            company.bankAccounts.map((bank, idx) => (
                                                <p key={idx} className="text-[10px] text-gray-700">
                                                    <strong>{bank.bankName}:</strong> {bank.accountNumber}
                                                    {bank.nib && <span className="block text-[8px] text-gray-500">NIB: {bank.nib}</span>}
                                                </p>
                                            ))
                                        ) : (
                                            <p className="text-[10px] text-gray-400 italic">Pagar em numerário ou M-Pesa</p>
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
