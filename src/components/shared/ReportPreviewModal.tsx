/**
 * ReportPreviewModal - Standardized report preview with print functionality
 * Used for Sales Reports, Inventory Reports, Financial Reports, etc.
 */

import { useRef, ReactNode } from 'react';
import { HiOutlinePrinter, HiOutlineX, HiOutlineDownload, HiOutlineDocumentReport } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { useStore } from '../../stores/useStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ReportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    reportTitle: string;
    subtitle?: string;
    dateRange?: { start: Date; end: Date };
    children: ReactNode;
    size?: 'md' | 'lg' | 'xl' | 'full';
    showLandscape?: boolean;
}

export default function ReportPreviewModal({
    isOpen,
    onClose,
    title,
    reportTitle,
    subtitle,
    dateRange,
    children,
    size = 'xl',
    showLandscape = false
}: ReportPreviewModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings } = useStore();

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=1100,height=800');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>${reportTitle}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                            background: #fff;
                            color: #1f2937;
                            padding: 20px;
                            font-size: 9pt;
                        }
                        .report-container {
                            max-width: ${showLandscape ? '297mm' : '210mm'};
                            margin: 0 auto;
                        }
                        .report-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            padding-bottom: 15px;
                            border-bottom: 2px solid #6366f1;
                            margin-bottom: 15px;
                        }
                        .company-info h1 {
                            font-size: 14pt;
                            font-weight: 700;
                            color: #1f2937;
                            margin-bottom: 3px;
                        }
                        .company-info p {
                            font-size: 8pt;
                            color: #6b7280;
                            margin: 1px 0;
                        }
                        .report-title-box {
                            text-align: right;
                        }
                        .report-title-box h2 {
                            font-size: 16pt;
                            font-weight: 800;
                            color: #6366f1;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .report-title-box p {
                            font-size: 9pt;
                            color: #6b7280;
                            margin-top: 3px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 10px 0;
                        }
                        th {
                            background: #f3f4f6;
                            padding: 8px 10px;
                            text-align: left;
                            font-size: 8pt;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            color: #374151;
                            border-bottom: 2px solid #e5e7eb;
                        }
                        td {
                            padding: 8px 10px;
                            font-size: 9pt;
                            border-bottom: 1px solid #f3f4f6;
                        }
                        tbody tr:nth-child(even) { background: #fafafa; }
                        .report-footer {
                            margin-top: 20px;
                            padding-top: 10px;
                            border-top: 1px solid #e5e7eb;
                            text-align: center;
                            font-size: 7pt;
                            color: #9ca3af;
                        }
                        .summary-box {
                            background: #f9fafb;
                            border-radius: 6px;
                            padding: 12px;
                            margin: 10px 0;
                        }
                        @media print {
                            @page { 
                                margin: 0.5cm; 
                                size: ${showLandscape ? 'A4 landscape' : 'A4 portrait'}; 
                            }
                            body { 
                                -webkit-print-color-adjust: exact; 
                                print-color-adjust: exact; 
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        ${content.innerHTML}
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

        toast.success('Relatório enviado para impressão!');
    };

    const handleExportPDF = () => {
        toast('Exportação PDF em desenvolvimento', { icon: '📄' });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" size="sm" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <HiOutlineDownload className="w-4 h-4 mr-2" />
                    Exportar PDF
                </Button>
                <Button size="sm" onClick={handlePrint} className="bg-gray-800 hover:bg-black text-white px-6">
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir Relatório
                </Button>
            </div>

            {/* Report Preview Container */}
            <Card padding="none" className="h-[calc(100vh-200px)] overflow-auto bg-gray-200 dark:bg-dark-950 p-4 sm:p-6">
                <div
                    ref={printRef}
                    className={`bg-white text-black shadow-lg p-6 sm:p-10 mx-auto relative flex flex-col border border-gray-300 ${showLandscape ? 'max-w-[1000px] min-h-[21cm]' : 'max-w-[850px] min-h-[29.7cm]'
                        }`}
                >
                    {/* Report Header */}
                    <div className="flex justify-between items-start pb-4 border-b-2 border-primary-500 mb-6">
                        <div className="flex items-start gap-3">
                            {companySettings?.logo && (
                                <img
                                    src={companySettings.logo}
                                    alt="Logo"
                                    className="h-12 w-auto object-contain"
                                />
                            )}
                            <div>
                                <h1 className="text-lg font-bold text-gray-900">
                                    {companySettings?.tradeName || companySettings?.companyName || 'Empresa'}
                                </h1>
                                <p className="text-[8pt] text-gray-500">
                                    {companySettings?.address}
                                </p>
                                <p className="text-[8pt] text-gray-500">
                                    NUIT: {companySettings?.taxId}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-2 mb-1">
                                <HiOutlineDocumentReport className="w-6 h-6 text-primary-600" />
                                <h2 className="text-xl font-black text-primary-600 uppercase tracking-wider">
                                    {reportTitle}
                                </h2>
                            </div>
                            {subtitle && (
                                <p className="text-sm text-gray-600">{subtitle}</p>
                            )}
                            {dateRange && (
                                <p className="text-[9pt] text-gray-500 mt-1">
                                    Período: {format(dateRange.start, 'dd/MM/yyyy')} a {format(dateRange.end, 'dd/MM/yyyy')}
                                </p>
                            )}
                            <p className="text-[8pt] text-gray-400 mt-1">
                                Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm')}
                            </p>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="flex-1">
                        {children}
                    </div>

                    {/* Report Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                        <p className="text-[7pt] text-gray-400">
                            Relatório gerado pelo Multicore | {companySettings?.tradeName || companySettings?.companyName}
                        </p>
                        <p className="text-[6pt] text-gray-300 mt-1 font-mono">
                            Documento emitido em {format(new Date(), 'dd/MM/yyyy')} às {format(new Date(), 'HH:mm:ss')}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
