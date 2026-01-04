import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { HiOutlinePrinter, HiOutlineX, HiOutlineUser, HiOutlineDocumentText, HiOutlineOfficeBuilding, HiOutlineMail, HiOutlinePhone } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { CreditNote } from '../../types';
import toast from 'react-hot-toast';

interface CreditNotePrintProps {
    isOpen: boolean;
    onClose: () => void;
    creditNote: CreditNote;
}

export default function CreditNotePrint({ isOpen, onClose, creditNote }: CreditNotePrintProps) {
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

        const logoHtml = company.logo
            ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${company.logo}" style="max-height: 80px;" /></div>`
            : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Nota de Crédito ${creditNote.number}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
        <Modal isOpen={isOpen} onClose={onClose} title={`Visualizar Nota de Crédito`} size="xl">
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button onClick={handlePrint} className="bg-red-600 hover:bg-red-700 text-white">
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            <Card padding="none" className="max-h-[70vh] overflow-y-auto bg-gray-50/50 dark:bg-dark-900/50 flex justify-center p-4">
                <div ref={printRef} className="bg-white text-gray-900 shadow-lg p-8 max-w-[800px] w-full mx-auto relative flex flex-col min-h-[29.7cm]">
                    <style>{`
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .no-print { display: none !important; }
                            .shadow-lg { box-shadow: none !important; }
                        }
                        .header-line { border-bottom: 2px solid #ef4444; }
                        .text-primary { color: #ef4444; }
                        .bg-primary-light { background-color: #fef2f2; }
                        .bg-header { background-color: #ef4444; color: white; }
                    `}</style>

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 pb-6 header-line">
                        <div className="flex gap-4">
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" className="w-16 h-16 object-contain" />
                            ) : (
                                <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
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
                            <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                                Nota de Crédito
                            </span>
                            <h2 className="text-3xl font-bold text-gray-900">{creditNote.number}</h2>
                            <p className="text-sm text-gray-500 mt-1">Ref. Fatura: <span className="font-medium text-gray-900">{creditNote.originalInvoiceNumber}</span></p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-3 text-red-600">
                                <HiOutlineUser className="w-5 h-5" />
                                <h3 className="font-bold text-sm uppercase tracking-wide">Dados do Cliente</h3>
                            </div>
                            <div className="text-sm space-y-1 text-gray-700 pl-7">
                                <p className="font-semibold text-gray-900 text-lg">{creditNote.customerName}</p>
                                {creditNote.customerId && <p>ID do Cliente: {creditNote.customerId}</p>}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-3 text-red-600">
                                <HiOutlineDocumentText className="w-5 h-5" />
                                <h3 className="font-bold text-sm uppercase tracking-wide">Detalhes da Emissão</h3>
                            </div>
                            <div className="text-sm space-y-2 pl-7">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Data de Emissão:</span>
                                    <span className="font-medium text-gray-900">{format(parseISO(creditNote.issueDate), 'dd/MM/yyyy HH:mm')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Motivo:</span>
                                    <span className="font-medium text-gray-900">{creditNote.reason}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8 border rounded-lg overflow-hidden border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-header">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                                    <th className="px-4 py-3 text-center font-semibold w-24">Qtd</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Preço Unit.</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {creditNote.items.map((item, index) => (
                                    <tr key={index} className="odd:bg-white even:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-900">{item.description}</td>
                                        <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Totals */}
                    <div className="flex justify-end mb-12">
                        <div className="w-64 bg-primary-light p-6 rounded-xl">
                            <div className="flex justify-between items-center mb-2 text-red-800/70 text-sm">
                                <span>Subtotal</span>
                                <span>{formatCurrency(creditNote.subtotal)}</span>
                            </div>
                            <div className="h-px bg-red-200 my-3"></div>
                            <div className="flex justify-between items-center text-red-700 font-bold text-lg">
                                <span>Total a Reembolsar</span>
                                <span>{formatCurrency(creditNote.total)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-xs text-gray-400 mt-auto pt-8 border-t border-gray-100">
                        <p>Documento processado por computador © {new Date().getFullYear()} {company.tradeName}</p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
