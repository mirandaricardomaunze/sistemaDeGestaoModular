import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { HiOutlinePrinter, HiOutlineX, HiOutlineOfficeBuilding, HiOutlineMail, HiOutlinePhone, HiOutlineTruck, HiOutlineCalendar } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { PurchaseOrder } from '../../types';
import toast from 'react-hot-toast';

interface PurchaseOrderPrintProps {
    isOpen: boolean;
    onClose: () => void;
    order: PurchaseOrder;
}

export default function PurchaseOrderPrint({ isOpen, onClose, order }: PurchaseOrderPrintProps) {
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

        // Collect all styles from the main document
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(style => style.outerHTML)
            .join('');

        const logoHtml = company.logo
            ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${company.logo}" style="max-height: 80px;" /></div>`
            : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Encomenda ${order.orderNumber}</title>
                    ${styles}
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Visualizar Encomenda`} size="xl">
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            <Card padding="none" className="max-h-[70vh] overflow-y-auto bg-gray-50/50 dark:bg-dark-900/50 flex justify-center p-4">
                <div ref={printRef} className="bg-white text-gray-900 shadow-lg p-8 max-w-[800px] w-full mx-auto relative flex flex-col min-h-[29.7cm]">
                    <style>{`
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Inter', sans-serif; }
                            .no-print { display: none !important; }
                            .shadow-lg { box-shadow: none !important; }
                            .bg-gray-50 { background-color: #f9fafb !important; }
                        }
                        .header-line { border-bottom: 2px solid #2563eb; }
                        .text-primary { color: #2563eb; }
                        .bg-primary-light { background-color: #eff6ff; }
                        .bg-header { background-color: #2563eb; color: white; }
                    `}</style>

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 pb-6 header-line">
                        <div className="flex gap-4">
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" className="w-16 h-16 object-contain" />
                            ) : (
                                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                    <HiOutlineOfficeBuilding className="w-10 h-10" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">{company.tradeName || company.companyName}</h1>
                                <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                                    <p>{company.address}, {company.city} - {company.state}</p>
                                    <p className="flex items-center gap-1"><HiOutlinePhone className="w-3 h-3" /> {company.phone} | <HiOutlineMail className="w-3 h-3" /> {company.email}</p>
                                    <p>NUIT: {company.taxId}</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                                Ordem de Compra
                            </span>
                            <h2 className="text-3xl font-bold text-gray-900">{order.orderNumber}</h2>
                            <p className="text-sm text-gray-500 mt-1">Status: <span className="font-medium text-gray-900 uppercase">{order.status === 'received' ? 'Recebido' : order.status === 'ordered' ? 'Encomendado' : order.status}</span></p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-3 text-blue-600">
                                <HiOutlineTruck className="w-5 h-5" />
                                <h3 className="font-bold text-sm uppercase tracking-wide">Fornecedor</h3>
                            </div>
                            <div className="text-sm space-y-1 text-gray-700 pl-7">
                                <p className="font-semibold text-gray-900 text-lg">{order.supplierName}</p>
                                {/* We could add more supplier details here if we fetched the full supplier object */}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-3 text-blue-600">
                                <HiOutlineCalendar className="w-5 h-5" />
                                <h3 className="font-bold text-sm uppercase tracking-wide">Detalhes do Pedido</h3>
                            </div>
                            <div className="text-sm space-y-2 pl-7">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Data do Pedido:</span>
                                    <span className="font-medium text-gray-900">{format(parseISO(order.createdAt), 'dd/MM/yyyy')}</span>
                                </div>
                                {order.expectedDeliveryDate && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Previsão de Entrega:</span>
                                        <span className="font-medium text-gray-900">{format(parseISO(order.expectedDeliveryDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8 border rounded-lg overflow-hidden border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-header">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Produto</th>
                                    <th className="px-4 py-3 text-center font-semibold w-24">Qtd</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Custo Unit.</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {order.items.map((item, index) => (
                                    <tr key={index} className="odd:bg-white even:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-900">{item.productName}</td>
                                        <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unitCost)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Totals */}
                    <div className="flex justify-end mb-12">
                        <div className="w-64 bg-primary-light p-6 rounded-xl">
                            <div className="flex justify-between items-center text-blue-700 font-bold text-lg">
                                <span>Total do Pedido</span>
                                <span>{formatCurrency(order.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                        <div className="mb-12 p-4 border border-dashed border-gray-300 rounded-lg">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Observações</h4>
                            <p className="text-sm text-gray-600 italic">{order.notes}</p>
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-12 mt-auto pt-12 pb-8">
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-2 h-8"></div>
                            <p className="text-xs text-gray-500 uppercase">Autorizado Por</p>
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-2 h-8"></div>
                            <p className="text-xs text-gray-500 uppercase">Recebido Por</p>
                        </div>
                    </div>

                    <div className="text-center text-xs text-gray-400 pt-8 border-t border-gray-100">
                        <p>Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')} por {company.tradeName}</p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
