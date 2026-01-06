import { useRef } from 'react';
import { format } from 'date-fns';
import { HiOutlinePrinter, HiOutlineX } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { useStore } from '../../stores/useStore';
import { formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface PaymentGuidePrintProps {
    isOpen: boolean;
    onClose: () => void;
    metrics: {
        totalInvoiced: number;
        ivaPayable: number;
        retentions: number;
        lastSubmission?: string;
    };
    moduleTitle: string;
}

export default function PaymentGuidePrint({ isOpen, onClose, metrics, moduleTitle }: PaymentGuidePrintProps) {
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
                    <title>GNR - ${moduleTitle}</title>
                    ${styles}
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        @media print {
                            @page { margin: 0.5cm; size: A4; }
                            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Inter', sans-serif; font-size: 10pt; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    const totalToPay = metrics.ivaPayable + metrics.retentions;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Guia de Pagamento (GNR)`} size="xl">
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

            <Card padding="none" className="h-[calc(100vh-200px)] overflow-auto bg-gray-200 dark:bg-dark-950 p-4 sm:p-8">
                <div ref={printRef} className="bg-white text-black shadow-lg p-6 sm:p-12 max-w-[850px] w-full mx-auto relative flex flex-col border border-gray-300 min-h-[29.7cm]">
                    <style>{`
                        @media print {
                            .shadow-sm { box-shadow: none !important; }
                            .border { border: 1px solid #000 !important; }
                            .bg-gray-50 { background-color: #f3f4f6 !important; }
                            .bg-gray-100 { background-color: #f3f4f6 !important; }
                        }
                        .gnr-table td, .gnr-table th { border: 1px solid #e5e7eb; padding: 6px 10px; font-size: 9pt; }
                        .gnr-label { font-size: 7pt; color: #4b5563; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
                        .gnr-value { font-size: 9pt; font-weight: 600; color: #000; }
                        .official-stamp { border: 3px double #d1d5db; border-radius: 50%; width: 100px; height: 100px; display: flex; align-items: center; justify-center; text-align: center; font-size: 7pt; color: #9ca3af; text-transform: uppercase; transform: rotate(-15deg); }
                    `}</style>

                    {/* Mozambican Emblem & Header */}
                    <div className="flex flex-col items-center text-center mb-6 border-b pb-4 border-gray-100">
                        <div className="text-[10pt] font-bold uppercase tracking-widest leading-tight">República de Moçambique</div>
                        <div className="text-[9pt] font-bold uppercase leading-tight">Ministério da Economia e Finanças</div>
                        <div className="text-[11pt] font-black uppercase tracking-tighter mt-1">Autoridade Tributária de Moçambique</div>
                        <div className="mt-4 bg-black text-white px-4 py-1 text-[10pt] font-black uppercase tracking-widest">
                            Guia de Nota de Receita (GNR)
                        </div>
                    </div>

                    {/* Top Info Grid */}
                    <div className="grid grid-cols-12 gap-0 border mb-6">
                        <div className="col-span-8 p-3 border-r">
                            <p className="gnr-label">Sujeito Passivo (Empresa)</p>
                            <p className="gnr-value uppercase truncate">{companySettings?.tradeName || 'Nome da Empresa Não Configurado'}</p>
                            <p className="text-[8pt] text-gray-600 mt-1">{companySettings?.address || 'Endereço Indisponível'}</p>
                        </div>
                        <div className="col-span-4 p-3 bg-gray-50">
                            <p className="gnr-label">NUIT do Sujeito Passivo</p>
                            <p className="gnr-value tracking-widest">{companySettings?.taxId || '000000000'}</p>
                        </div>

                        <div className="col-span-4 p-3 border-t border-r">
                            <p className="gnr-label">Período de Referência</p>
                            <p className="gnr-value uppercase">{format(new Date(), 'MMMM / yyyy')}</p>
                        </div>
                        <div className="col-span-4 p-3 border-t border-r">
                            <p className="gnr-label">Direcção / Unidade</p>
                            <p className="gnr-value uppercase">DGC - {moduleTitle}</p>
                        </div>
                        <div className="col-span-4 p-3 border-t bg-gray-50">
                            <p className="gnr-label">Data de Emissão</p>
                            <p className="gnr-value">{format(new Date(), 'dd/MM/yyyy')}</p>
                        </div>
                    </div>

                    {/* Tax Specification Table */}
                    <div className="mb-6">
                        <table className="w-full gnr-table border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="w-20 text-center font-bold uppercase text-[7pt]">Código Rec.</th>
                                    <th className="text-left font-bold uppercase text-[7pt]">Designação do Imposto / Taxa</th>
                                    <th className="w-32 text-right font-bold uppercase text-[7pt]">Valor do Imposto</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="text-center font-medium">101</td>
                                    <td>
                                        <p className="font-bold">IVA - Imposto Sobre Valor Acrescentado</p>
                                        <p className="text-[7pt] text-gray-500 italic">Operações Internas / Mercado Local</p>
                                    </td>
                                    <td className="text-right font-bold">{formatCurrency(metrics.ivaPayable)}</td>
                                </tr>
                                <tr>
                                    <td className="text-center font-medium">104</td>
                                    <td>
                                        <p className="font-bold">Retenção na Fonte (IRPS/IRPC)</p>
                                        <p className="text-[7pt] text-gray-500 italic">Serviços e Outros Rendimentos</p>
                                    </td>
                                    <td className="text-right font-bold">{formatCurrency(metrics.retentions)}</td>
                                </tr>
                                <tr className="bg-gray-50 font-bold">
                                    <td colSpan={2} className="text-right uppercase tracking-wider">Montante Total a Pagar</td>
                                    <td className="text-right text-[11pt] underline decoration-double">{formatCurrency(totalToPay)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Payment Details Box */}
                    <div className="border p-4 bg-gray-50 mb-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-3">
                                <h4 className="text-[8pt] font-black uppercase text-gray-900 border-b pb-1">DADOS PARA PAGAMENTO BANCÁRIO (SIMPLIFICADO)</h4>
                                <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                                    <div>
                                        <p className="gnr-label">Referência de Pagamento</p>
                                        <p className="text-[10pt] font-black tracking-widest text-primary-700">900 {format(new Date(), 'MMyy')} 123 456</p>
                                    </div>
                                    <div>
                                        <p className="gnr-label">Entidade GNR</p>
                                        <p className="text-[10pt] font-black tracking-widest">80123</p>
                                    </div>
                                    <div className="col-span-2 pt-2">
                                        <p className="gnr-label">Utilização Obrigatória em</p>
                                        <p className="text-[8pt] font-bold italic">Bancos de Moçambique, ATM, Mobile Money, Internet Banking</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-20 h-20 bg-white border p-1 mb-1">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=GNR-${format(new Date(), 'yyyyMM')}-${totalToPay}`} alt="QR Code" className="w-full h-full" />
                                </div>
                                <span className="text-[6pt] text-gray-400 font-bold uppercase">Validar Documento</span>
                            </div>
                        </div>
                    </div>

                    {/* Signatures and Seals */}
                    <div className="grid grid-cols-3 gap-8 mt-4 items-center">
                        <div className="text-center">
                            <div className="official-stamp mx-auto">
                                Autoridade Tributária<br />Processamento<br />Centralizado
                            </div>
                        </div>
                        <div className="col-span-2 space-y-8">
                            <div className="flex justify-between gap-8">
                                <div className="flex-1 text-center">
                                    <div className="border-b border-black h-12 mb-2"></div>
                                    <p className="text-[7pt] font-bold uppercase">O Recebedor / Agente Bancário</p>
                                </div>
                                <div className="flex-1 text-center">
                                    <div className="border-b border-black h-12 mb-2"></div>
                                    <p className="text-[7pt] font-bold uppercase">O Sujeito Passivo / Declarante</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Official Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center opacity-50">
                        <p className="text-[6pt] uppercase font-bold tracking-tighter">
                            Este documento é uma guia de arrecadação de receita do estado moçambicano.<br />
                            Processado pelo Sistema ERP Modular v4.20 - Módulo Fiscal
                        </p>
                        <p className="text-[6pt] font-mono whitespace-nowrap">
                            UUID: {crypto.randomUUID().substring(0, 18).toUpperCase()} | {format(new Date(), 'dd-MM-yyyy HH:mm:ss')}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
