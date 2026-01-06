import { useRef } from 'react';
import { format } from 'date-fns';
import { HiOutlinePrinter, HiOutlineX } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { useStore } from '../../stores/useStore';
import { formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface Modelo10PrintProps {
    isOpen: boolean;
    onClose: () => void;
    retentions: any[];
    moduleTitle: string;
}

export default function Modelo10Print({ isOpen, onClose, retentions, moduleTitle }: Modelo10PrintProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings } = useStore();

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=1000,height=900');
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
                    <title>Modelo 10 - ${moduleTitle}</title>
                    ${styles}
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        @media print {
                            @page { margin: 0.5cm; size: A4 landscape; }
                            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Inter', sans-serif; font-size: 8pt; }
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

    const totalRetained = retentions.reduce((sum, r) => sum + (r.amount || 0), 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Gerar Relatório Modelo 10`} size="xl">
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" size="sm" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button size="sm" onClick={handlePrint} className="bg-gray-800 hover:bg-black text-white px-6">
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir Relatório
                </Button>
            </div>

            <Card padding="none" className="h-[calc(100vh-200px)] overflow-auto bg-gray-200 dark:bg-dark-950 p-4 sm:p-8">
                <div ref={printRef} className="bg-white text-black shadow-lg p-6 sm:p-10 max-w-[1200px] w-full mx-auto relative flex flex-col border border-gray-300 min-h-[21cm]">
                    <style>{`
                        @media print {
                            .shadow-sm { box-shadow: none !important; }
                            .border { border: 1px solid #000 !important; }
                            .bg-gray-100 { background-color: #f3f4f6 !important; }
                        }
                        .m10-table td, .m10-table th { border: 1px solid #d1d5db; padding: 4px 8px; font-size: 8pt; }
                        .m10-label { font-size: 7pt; color: #4b5563; text-transform: uppercase; font-weight: 700; }
                        .m10-value { font-size: 8pt; font-weight: 600; color: #000; }
                    `}</style>

                    {/* Official Header */}
                    <div className="flex border-b-4 border-black pb-4 mb-6">
                        <div className="w-1/4 text-center border-r border-gray-200 pr-4">
                            <div className="text-[9pt] font-black uppercase leading-tight mt-2">Modelo 10</div>
                            <div className="text-[7pt] font-bold text-gray-500 uppercase mt-1">Autoridade Tributária</div>
                        </div>
                        <div className="flex-1 text-center px-4">
                            <div className="text-[10pt] font-bold uppercase tracking-widest leading-tight">República de Moçambique</div>
                            <div className="text-[12pt] font-black uppercase tracking-tighter mt-1">Relação de Rendimentos e Retenções</div>
                            <div className="text-[8pt] font-medium text-gray-500 italic mt-1">(Artigo 58.º do Regulamento do IRPS e Artigo 56.º do Regulamento do IRPC)</div>
                        </div>
                        <div className="w-1/4 text-right pl-4">
                            <div className="text-[8pt] font-bold uppercase">Folha N.º ______</div>
                            <div className="text-[8pt] font-bold uppercase mt-1">Ano de {new Date().getFullYear()}</div>
                        </div>
                    </div>

                    {/* Taxpayer Information */}
                    <div className="grid grid-cols-12 gap-0 border border-black mb-6">
                        <div className="col-span-9 p-2 border-r border-black">
                            <p className="m10-label">01 - Nome ou Designação Social do Sujeito Passivo</p>
                            <p className="m10-value uppercase">{companySettings?.tradeName || 'Sua Empresa'}</p>
                        </div>
                        <div className="col-span-3 p-2 bg-gray-50">
                            <p className="m10-label">02 - NUIT</p>
                            <p className="m10-value tracking-widest">{companySettings?.taxId || '000000000'}</p>
                        </div>
                        <div className="col-span-12 p-2 border-t border-black">
                            <p className="m10-label">03 - Módulo / Unidade de Origem</p>
                            <p className="m10-value uppercase">{moduleTitle} - Sistema Integrado de Gestão</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="mb-6 flex-1">
                        <table className="w-full m10-table border-collapse">
                            <thead className="bg-gray-100">
                                <tr className="text-[7pt] font-bold uppercase text-center">
                                    <th className="w-8">N.º</th>
                                    <th className="w-32">NUIT Beneficiário</th>
                                    <th>Nome do Hóspede / Beneficiário</th>
                                    <th className="w-20">Cód. Rend.</th>
                                    <th className="w-32">Rendimento Ilíquido</th>
                                    <th className="w-16">Taxa %</th>
                                    <th className="w-32">Imposto Retido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {retentions.length > 0 ? (
                                    retentions.map((item, index) => (
                                        <tr key={item.id} className="text-center">
                                            <td>{index + 1}</td>
                                            <td className="font-mono tracking-tighter">{item.beneficiaryNuit || '000000000'}</td>
                                            <td className="text-left font-medium truncate max-w-[200px] uppercase">{item.beneficiary}</td>
                                            <td className="font-bold">{item.revenueCode || '1.1'}</td>
                                            <td className="text-right">{formatCurrency(item.grossAmount || (item.amount / 0.2))}</td>
                                            <td className="font-medium">{item.rate || '20'}%</td>
                                            <td className="text-right font-bold">{formatCurrency(item.amount)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="py-20 text-center text-gray-400 italic">Nenhum dado de retenção encontrado para o período.</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold">
                                <tr>
                                    <td colSpan={6} className="text-right p-3 text-[9pt] uppercase tracking-widest">Totais Gerais do Período</td>
                                    <td className="text-right text-[10pt] p-3 border-l-2 border-black underline decoration-double">
                                        {formatCurrency(totalRetained)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Footer / Declarations */}
                    <div className="grid grid-cols-2 gap-8 mt-10 border-t border-gray-200 pt-8">
                        <div className="space-y-4">
                            <p className="text-[7pt] uppercase font-bold text-gray-400">04 - Data e Assinatura do Responsável</p>
                            <div className="h-12 border-b border-black w-4/5 mx-auto"></div>
                            <p className="text-[6pt] text-gray-400 text-center uppercase tracking-widest">Responsável de Finanças / Técnico de Contas</p>
                        </div>
                        <div className="bg-gray-50 p-4 border border-gray-100 rounded">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[7pt] font-black uppercase text-gray-700">Validação Digital AT</span>
                                <span className="text-[6pt] font-mono text-gray-400">MODELO-10-v4.20</span>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-16 h-16 bg-white border p-1 shadow-sm">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=M10-FISCAL-${companySettings?.taxId}-${new Date().getFullYear()}`} alt="QR" className="w-full h-full opacity-60" />
                                </div>
                                <div className="flex-1 text-[6pt] text-gray-500 space-y-1">
                                    <p>Este relatório é gerado automaticamente pelo sistema de gestão modular.</p>
                                    <p>Os dados aqui apresentados foram extraídos dos eventos fiscais registados nas transacções.</p>
                                    <p>Emitido em: {format(new Date(), 'dd-MM-yyyy HH:mm:ss')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-[6pt] text-gray-300 mt-auto pt-8 text-center uppercase tracking-widest">
                        Documento Gerado por Processamento Automático • ERP Modular
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
