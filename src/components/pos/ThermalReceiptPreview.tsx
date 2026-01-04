/**
 * Thermal Receipt Print Preview
 * Preview moderno no ecrã + formato térmico optimizado para impressão
 */

import { HiOutlinePrinter, HiOutlineX, HiOutlineCheck, HiOutlineCash, HiOutlineCreditCard, HiOutlineReceiptTax, HiOutlineDownload } from 'react-icons/hi';
import { Modal, Button, Card, Badge } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { Sale } from '../../types';
import toast from 'react-hot-toast';
import { useEffect, useRef } from 'react';

interface ThermalReceiptPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    onShowA4?: () => void;
    sale: Sale;
}

export default function ThermalReceiptPreview({ isOpen, onClose, onShowA4, sale }: ThermalReceiptPreviewProps) {

    const { companySettings: company } = useStore();
    const printProcessed = useRef(false);

    // Format date/time
    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('pt-MZ'),
            time: date.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
    };

    const { date, time } = formatDateTime(sale.createdAt);

    // Payment method labels and icons
    const paymentLabels: Record<string, string> = {
        cash: 'Dinheiro',
        card: 'Cartão',
        pix: 'PIX',
        mpesa: 'M-Pesa',
        emola: 'E-Mola',
        credit: 'Crédito',
    };

    const getPaymentIcon = () => {
        if (sale.paymentMethod === 'cash') return <HiOutlineCash className="w-5 h-5" />;
        return <HiOutlineCreditCard className="w-5 h-5" />;
    };

    // Generate thermal print content
    const generateThermalContent = () => {
        const sep = '================================';
        const sepDash = '--------------------------------';

        let content = '';

        // Header
        content += `${sep}\n`;
        content += `${(company.tradeName || company.companyName).toUpperCase().padStart(16 + (company.tradeName || company.companyName).length / 2).padEnd(32)}\n`;
        if (company.address) content += `${company.address.substring(0, 32).padStart(16 + company.address.length / 2).padEnd(32)}\n`;
        if (company.phone) content += `Tel: ${company.phone}\n`.padStart(16 + company.phone.length / 2);
        if (company.taxId) content += `NUIT: ${company.taxId}\n`.padStart(16 + company.taxId.length / 2);
        content += `${sep}\n`;

        // Receipt info
        content += `Fatura-Recibo: ${sale.receiptNumber}\n`;
        if (sale.series) content += `Serie: ${sale.series}\n`;
        content += `Data: ${date}  Hora: ${time}\n`;

        // Customer name if available
        if (sale.notes && sale.notes.startsWith('Cliente: ')) {
            const customerName = sale.notes.replace('Cliente: ', '');
            content += `Cliente: ${customerName}\n`;
        }

        content += `${sepDash}\n`;

        // Items
        sale.items.forEach(item => {
            const name = item.product.name.substring(0, 24);
            content += `${name}\n`;
            const qty = `${item.quantity} x ${formatCurrency(item.unitPrice)}`;
            const total = formatCurrency(item.total);
            content += `  ${qty.padEnd(20)}${total.padStart(10)}\n`;
        });

        content += `${sep}\n`;

        // Totals
        content += `Subtotal:${formatCurrency(sale.subtotal).padStart(23)}\n`;
        if (sale.discount > 0) {
            content += `Desconto:${('-' + formatCurrency(sale.discount)).padStart(23)}\n`;
        }
        content += `IVA (16%):${formatCurrency(sale.tax).padStart(22)}\n`;
        content += `${sepDash}\n`;
        content += `TOTAL:${formatCurrency(sale.total).padStart(26)}\n`;
        content += `${sep}\n`;

        // Payment
        const paymentMethod = (paymentLabels[sale.paymentMethod] || sale.paymentMethod).toUpperCase();
        content += `Pagamento: ${paymentMethod}\n`;
        content += `Valor Pago:${formatCurrency(sale.amountPaid).padStart(21)}\n`;
        if (sale.change > 0) {
            content += `TROCO:${formatCurrency(sale.change).padStart(26)}\n`;
        }

        content += `${sepDash}\n`;
        content += `Artigos: ${sale.items.length}\n`;
        content += `Assinatura: ${sale.hashCode || 'Simulado-Hash-AT'}\n`;
        content += `Processado por Computador\n`;

        // Footer
        content += `${sep}\n`;
        content += `   OBRIGADO PELA PREFERÊNCIA!   \n`;
        content += `Guarde este documento para trocas\n`;
        content += `${sep}\n`;

        return content;
    };

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=450,height=700');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        // Generate thermal-optimized content
        const thermalContent = generateThermalContent();
        const paperWidth = company.thermalPaperWidth || '80mm';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Recibo ${sale.receiptNumber}</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Courier New', 'Consolas', monospace;
                            font-size: ${paperWidth === '58mm' ? '10px' : '12px'};
                            width: ${paperWidth};
                            max-width: ${paperWidth};
                            padding: 3mm;
                            color: #000;
                            background: #fff;
                            line-height: 1.2;
                        }
                        pre {
                            font-family: inherit;
                            font-size: inherit;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        }
                        @media print {
                            body { 
                                width: ${paperWidth};
                                padding: 1mm;
                            }
                            @page {
                                size: ${paperWidth} auto;
                                margin: 0;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${company.logo ? `<div style="text-align: center; margin-bottom: 5px;"><img src="${company.logo}" style="max-width: 60%; max-height: 50px; filter: grayscale(100%) contrast(1.2);" /></div>` : ''}
                    <pre>${thermalContent}</pre>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);

        toast.success('Recibo enviado para impressão!');
    };

    // Auto-print effect
    useEffect(() => {
        if (isOpen && company.autoPrintReceipt && !printProcessed.current) {
            printProcessed.current = true;
            // Delay slightly to ensure content is ready
            setTimeout(() => {
                handlePrint();
            }, 600);
        }
    }, [isOpen, company.autoPrintReceipt]);

    // Reset ref when modal closes
    useEffect(() => {
        if (!isOpen) {
            printProcessed.current = false;
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
            <div className="space-y-6">
                {/* Success Header */}
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                        <HiOutlineCheck className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Venda Concluída!</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Recibo pronto para impressão</p>
                </div>

                {/* Receipt Card */}
                <Card padding="none" className="overflow-hidden">
                    {/* Receipt Header */}
                    <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-primary-200 text-sm">Recibo Nº</p>
                                <p className="text-xl font-bold">{sale.receiptNumber}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-primary-200 text-sm">{date}</p>
                                <p className="text-lg font-semibold">{time}</p>
                            </div>
                        </div>
                    </div>

                    {/* Company Info */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                        <p className="font-semibold text-gray-900 dark:text-white">{company.tradeName || company.companyName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {company.address} • NUIT: {company.taxId}
                        </p>
                    </div>

                    {/* Customer Name if available */}
                    {sale.notes && sale.notes.startsWith('Cliente: ') && (
                        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b dark:border-dark-600">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Cliente</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {sale.notes.replace('Cliente: ', '')}
                            </p>
                        </div>
                    )}

                    {/* Items List */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                            <HiOutlineReceiptTax className="w-4 h-4" />
                            <span>Itens ({sale.items.length})</span>
                        </div>

                        {sale.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-dark-600 last:border-0">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">{item.product.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {item.quantity} × {formatCurrency(item.unitPrice)}
                                    </p>
                                </div>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    {formatCurrency(item.total)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Totals */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-dark-700 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                            <span className="text-gray-900 dark:text-white">{formatCurrency(sale.subtotal)}</span>
                        </div>
                        {sale.discount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-green-600">Desconto</span>
                                <span className="text-green-600 font-medium">-{formatCurrency(sale.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">IVA (16%)</span>
                            <span className="text-gray-900 dark:text-white">{formatCurrency(sale.tax)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-dark-600">
                            <span className="text-gray-900 dark:text-white">Total</span>
                            <span className="text-primary-600">{formatCurrency(sale.total)}</span>
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className="p-4 border-t border-gray-200 dark:border-dark-600">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                                {getPaymentIcon()}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                                    </span>
                                    <Badge variant="success" size="sm">Pago</Badge>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Pago: {formatCurrency(sale.amountPaid)}
                                </p>
                            </div>
                            {sale.change > 0 && (
                                <div className="text-right">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Troco</p>
                                    <p className="text-lg font-bold text-green-600">{formatCurrency(sale.change)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        <HiOutlineX className="w-4 h-4 mr-2" />
                        Fechar
                    </Button>
                    <Button className="flex-1" onClick={handlePrint}>
                        <HiOutlinePrinter className="w-4 h-4 mr-2" />
                        Imprimir Recibo
                    </Button>
                </div>

                {onShowA4 && (
                    <Button variant="ghost" className="w-full text-primary-600 dark:text-primary-400" onClick={onShowA4}>
                        <HiOutlineDownload className="w-4 h-4 mr-2" />
                        Visualizar Fatura A4 Profissional
                    </Button>
                )}

                {/* Print Preview Note */}
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                    O recibo será impresso no formato optimizado para impressora térmica ({company.thermalPaperWidth || '80mm'})
                </p>
            </div>
        </Modal>
    );
}
