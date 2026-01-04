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
                        .bg-header { background-color: #2563eb; color: white; }
                    `}</style>

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 pb-6 header-line">
                        <div className="flex gap-4">
                            {companySettings.logo ? (
                                <img src={companySettings.logo} alt="Logo" className="w-16 h-16 object-contain" />
                            ) : (
                                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                    <HiOutlineOfficeBuilding className="w-10 h-10" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">{companySettings?.tradeName ?? 'Empresa'}</h1>
                                <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                                    <p>{companySettings?.address ?? ''}</p>
                                    <p>{companySettings?.city ?? ''} - {companySettings?.state ?? ''}</p>
                                    <p>Tel: {companySettings?.phone ?? ''}</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                                Guia de Transferência
                            </span>
                            <h2 className="text-2xl font-bold text-gray-900">{transfer.number}</h2>
                            <p className="text-sm text-gray-500 mt-1">Data: <span className="font-medium text-gray-900">{format(parseISO(transfer.date), 'dd/MM/yyyy HH:mm')}</span></p>
                        </div>
                    </div>

                    {/* Warehouses Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 relative">
                            <div className="absolute top-0 right-0 p-2 text-gray-300">
                                <HiOutlineTruck className="w-12 h-12 opacity-10" />
                            </div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Origem</h3>
                            <p className="font-bold text-lg text-gray-900">{source?.name}</p>
                            <p className="text-sm text-gray-600">{source?.location}</p>
                            <p className="text-xs text-gray-400 mt-1">Resp: {source?.responsible}</p>
                        </div>
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Destino</h3>
                            <p className="font-bold text-lg text-gray-900">{target?.name}</p>
                            <p className="text-sm text-gray-600">{target?.location}</p>
                            <p className="text-xs text-gray-400 mt-1">Resp: {target?.responsible}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8 border rounded-lg overflow-hidden border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-header">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold w-16">#</th>
                                    <th className="px-4 py-3 text-left font-semibold">Produto</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Quantidade</th>
                                    <th className="px-4 py-3 text-center font-semibold w-32">Conferência</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {transfer.items.map((item, index) => (
                                    <tr key={index} className="odd:bg-white even:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">{item.quantity}</td>
                                        <td className="px-4 py-3 border-l border-gray-100"></td> {/* Checkbox area for manual check */}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-4 mb-12 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="block text-gray-500 text-xs uppercase mb-1">Motivo / Observações</span>
                                <p className="text-gray-900 font-medium">{transfer.reason || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="block text-gray-500 text-xs uppercase mb-1">Responsável pela Emissão</span>
                                <p className="text-gray-900 font-medium">{transfer.responsible}</p>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-auto pt-12 pb-8">
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-2 h-8"></div>
                            <p className="text-xs text-gray-500 uppercase">Emitente</p>
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-2 h-8"></div>
                            <p className="text-xs text-gray-500 uppercase">Transportador</p>
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-300 mb-2 h-8"></div>
                            <p className="text-xs text-gray-500 uppercase">Recebedor</p>
                        </div>
                    </div>

                    <div className="text-center text-xs text-gray-400 pt-8 border-t border-gray-100">
                        <p>Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')} • Sistema de Gestão</p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
