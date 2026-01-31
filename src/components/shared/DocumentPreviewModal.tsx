/**
 * DocumentPreviewModal - Reusable document preview wrapper
 * Provides consistent A4 paper preview with print functionality
 */

import { useRef, ReactNode } from 'react';
import { HiOutlinePrinter, HiOutlineX, HiOutlineDownload } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { useStore } from '../../stores/useStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface DocumentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    documentTitle?: string;
    children: ReactNode;
    size?: 'md' | 'lg' | 'xl' | 'full';
    showCompanyHeader?: boolean;
    footerText?: string;
}

export default function DocumentPreviewModal({
    isOpen,
    onClose,
    title,
    documentTitle,
    children,
    size = 'xl',
    showCompanyHeader = true,
    footerText
}: DocumentPreviewModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings } = useStore();

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=900,height=900');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(style => style.outerHTML)
            .join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>${documentTitle || title}</title>
                    ${styles}
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        @media print {
                            @page { margin: 0.5cm; size: A4; }
                            body { 
                                margin: 0; 
                                padding: 0; 
                                -webkit-print-color-adjust: exact; 
                                print-color-adjust: exact; 
                                font-family: 'Inter', sans-serif; 
                                font-size: 10pt; 
                            }
                            .no-print { display: none !important; }
                            .shadow-lg { box-shadow: none !important; }
                        }
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                            background: #fff;
                            color: #000;
                        }
                        .document-container {
                            max-width: 210mm;
                            min-height: 297mm;
                            margin: 0 auto;
                            padding: 15mm;
                        }
                        .company-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            padding-bottom: 20px;
                            border-bottom: 2px solid #6366f1;
                            margin-bottom: 20px;
                        }
                        .company-logo img {
                            max-height: 60px;
                            max-width: 150px;
                        }
                        .company-info h1 {
                            font-size: 18pt;
                            font-weight: 700;
                            color: #1f2937;
                            margin: 0 0 5px 0;
                        }
                        .company-info p {
                            font-size: 9pt;
                            color: #6b7280;
                            margin: 2px 0;
                        }
                        .document-footer {
                            margin-top: 30px;
                            padding-top: 15px;
                            border-top: 1px solid #e5e7eb;
                            text-align: center;
                            font-size: 8pt;
                            color: #9ca3af;
                        }
                    </style>
                </head>
                <body>
                    <div class="document-container">
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

        toast.success('Documento enviado para impressão!');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" size="sm" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button size="sm" onClick={handlePrint} className="bg-gray-800 hover:bg-black text-white px-6">
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir Documento
                </Button>
            </div>

            {/* Document Preview Container */}
            <Card padding="none" className="h-[calc(100vh-200px)] overflow-auto bg-gray-200 dark:bg-dark-950 p-4 sm:p-8">
                <div
                    ref={printRef}
                    className="bg-white text-black shadow-lg p-6 sm:p-12 max-w-[850px] w-full mx-auto relative flex flex-col border border-gray-300 min-h-[29.7cm]"
                >
                    {/* Company Header */}
                    {showCompanyHeader && (
                        <div className="flex justify-between items-start pb-5 border-b-2 border-primary-500 mb-6">
                            <div className="flex items-start gap-4">
                                {companySettings?.logo && (
                                    <img
                                        src={companySettings.logo}
                                        alt="Logo"
                                        className="h-14 w-auto object-contain"
                                    />
                                )}
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">
                                        {companySettings?.tradeName || companySettings?.companyName || 'Empresa'}
                                    </h1>
                                    <p className="text-[9pt] text-gray-500">
                                        {companySettings?.address}
                                    </p>
                                    <p className="text-[9pt] text-gray-500">
                                        Tel: {companySettings?.phone} | Email: {companySettings?.email}
                                    </p>
                                    <p className="text-[9pt] text-gray-500 font-medium">
                                        NUIT: {companySettings?.taxId}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[8pt] text-gray-400 uppercase tracking-widest">Data de Emissão</p>
                                <p className="text-sm font-bold">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                            </div>
                        </div>
                    )}

                    {/* Document Content */}
                    <div className="flex-1">
                        {children}
                    </div>

                    {/* Document Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                        <p className="text-[7pt] text-gray-400">
                            {footerText || 'Documento gerado pelo Multicore'}
                        </p>
                        <p className="text-[6pt] text-gray-300 mt-1 font-mono">
                            Emitido em {format(new Date(), 'dd/MM/yyyy')} às {format(new Date(), 'HH:mm:ss')}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
