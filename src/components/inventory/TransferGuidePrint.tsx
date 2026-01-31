import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { HiOutlinePrinter, HiOutlineX, HiOutlineOfficeBuilding, HiOutlineTruck } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { useStore } from '../../stores/useStore';
import { useWarehouses } from '../../hooks/useData';
import type { StockTransfer } from '../../types';
import toast from 'react-hot-toast';

interface TransferGuidePrintProps {
    isOpen: boolean;
    onClose: () => void;
    transfer: StockTransfer;
}

export default function TransferGuidePrint({ isOpen, onClose, transfer }: TransferGuidePrintProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings } = useStore();
    const { warehouses: warehousesData } = useWarehouses();

    // Ensure warehouses is always an array
    const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

    const getWarehouse = (id: string) => warehouses.find(w => w.id === id);
    const source = getWarehouse(transfer.sourceWarehouseId);
    const target = getWarehouse(transfer.targetWarehouseId);

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

        const logoHtml = companySettings.logo
            ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${companySettings.logo}" style="max-height: 80px;" /></div>`
            : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Guia de Transferência ${transfer.number}</title>
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
        <Modal isOpen={isOpen} onClose={onClose} title={`Visualizar Guia`} size="xl">
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

            <Card padding="none" className="max-h-[85vh] overflow-y-auto bg-gray-100 dark:bg-dark-950 p-4 md:p-8">
                <div ref={printRef} className="bg-white text-gray-900 shadow-lg p-6 max-w-[800px] w-full mx-auto relative flex flex-col">
                    <style>{`
                        @media print {
                            @page { margin: 10mm; size: auto; }
                            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Inter', sans-serif; }
                            .no-print { display: none !important; }
                            .shadow-lg { box-shadow: none !important; }
                            .bg-gray-50 { background-color: #f9fafb !important; }
                        }
                        .header-line { border-bottom: 2px solid #2563eb; }
                        .text-primary { color: #2563eb; }
                        .bg-header { background-color: #2563eb; color: white; }
                    `}</style>

                    {/* Header */}
                    <div className="flex justify-between items-start mb-4 pb-4 header-line">
                        <div className="flex gap-3">
                            {companySettings.logo ? (
                                <img src={companySettings.logo} alt="Logo" className="w-12 h-12 object-contain" />
                            ) : (
                                <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center text-blue-600">
                                    <HiOutlineOfficeBuilding className="w-8 h-8" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 uppercase tracking-tight">{companySettings?.tradeName ?? 'Empresa'}</h1>
                                <div className="text-[10px] text-gray-500 mt-0.5 space-y-0">
                                    <p>{companySettings?.address ?? ''}, {companySettings?.city ?? ''}</p>
                                    <p>Tel: {companySettings?.phone ?? ''}</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1">
                                Guia de Transferência
                            </span>
                            <h2 className="text-xl font-bold text-gray-900">{transfer.number}</h2>
                            <p className="text-[10px] text-gray-500 mt-0.5">Data: <span className="font-medium text-gray-900">{format(parseISO(transfer.date), 'dd/MM/yyyy HH:mm')}</span></p>
                        </div>
                    </div>

                    {/* Warehouses Info */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 relative">
                            <div className="absolute top-0 right-0 p-1 text-gray-300">
                                <HiOutlineTruck className="w-8 h-8 opacity-10" />
                            </div>
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Origem</h3>
                            <p className="font-bold text-base text-gray-900">{source?.name}</p>
                            <p className="text-xs text-gray-600 line-clamp-1">{source?.location}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Destino</h3>
                            <p className="font-bold text-base text-gray-900">{target?.name}</p>
                            <p className="text-xs text-gray-600 line-clamp-1">{target?.location}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-4 border rounded overflow-hidden border-gray-200">
                        <table className="w-full text-xs">
                            <thead className="bg-header">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold w-32">Cód. Barras</th>
                                    <th className="px-3 py-2 text-left font-semibold w-24">REF</th>
                                    <th className="px-3 py-2 text-left font-semibold">Produto / Descrição</th>
                                    <th className="px-3 py-2 text-right font-semibold w-20">Qtd</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {transfer.items.map((item, index) => {
                                    const productName = item.product?.name || item.productName;
                                    const productCode = item.product?.code || item.productCode;
                                    const productDescription = item.product?.description || item.productDescription;

                                    return (
                                        <tr key={index} className="odd:bg-white even:bg-[#fafafa]">
                                            <td className="px-3 py-1.5 font-mono text-[10px] text-gray-600 truncate max-w-[120px]" title={item.product?.barcode || item.productBarcode}>{item.product?.barcode || item.productBarcode || 'N/A'}</td>
                                            <td className="px-3 py-1.5 font-mono text-[10px] text-gray-500">{productCode || 'N/A'}</td>
                                            <td className="px-3 py-1.5 text-left">
                                                <p className="font-semibold text-gray-900 text-xs">{productName}</p>
                                                {productDescription && (
                                                    <p className="text-[10px] text-gray-500 line-clamp-1 italic">{productDescription}</p>
                                                )}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-bold text-gray-900 tabular-nums">{item.quantity}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Info */}
                    <div className="mb-6 p-3 bg-gray-50 rounded border border-gray-100">
                        <div className="grid grid-cols-2 gap-4 text-xs font-inter">
                            <div>
                                <span className="block text-gray-500 text-[10px] uppercase mb-0.5">Motivo / Observações</span>
                                <p className="text-gray-900">{transfer.reason || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="block text-gray-500 text-[10px] uppercase mb-0.5">Emissor</span>
                                <p className="text-gray-900 font-medium">{transfer.responsible}</p>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-6 pt-4 pb-4 mt-auto">
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-1 h-6"></div>
                            <p className="text-[9px] text-gray-500 uppercase">Emitente</p>
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-1 h-6"></div>
                            <p className="text-[9px] text-gray-500 uppercase">Transportador</p>
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-1 h-6"></div>
                            <p className="text-[9px] text-gray-500 uppercase">Recebedor</p>
                        </div>
                    </div>

                    <div className="text-center text-[9px] text-gray-400 pt-4 border-t border-gray-100">
                        <p>Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')} • Multicore</p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
