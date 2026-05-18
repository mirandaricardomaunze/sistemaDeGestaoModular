import { useRef, type CSSProperties, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import {
    HiOutlineBuildingOffice,
    HiOutlinePrinter,
    HiOutlineXMark,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { Modal, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { DebitNote } from '../../types';

interface DebitNotePrintProps {
    isOpen: boolean;
    onClose: () => void;
    debitNote: DebitNote;
}

const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    issued: 'Emitida',
    cancelled: 'Cancelada',
    settled: 'Liquidada',
};

export default function DebitNotePrint({ isOpen, onClose, debitNote }: DebitNotePrintProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings: company } = useStore();
    const taxRate = Number((debitNote as { taxRate?: number | string }).taxRate ?? company.ivaRate ?? 16);

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=900,height=700');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Nota de Débito ${debitNote.number}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
                    <style>
                        :root { color-scheme: light !important; }
                        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        body {
                            font-family: 'Inter', Arial, sans-serif;
                            padding: 30px;
                            max-width: 800px;
                            margin: 0 auto;
                            background: #ffffff !important;
                            color: #111827 !important;
                        }
                        table.print-table { width: 100%; border-collapse: collapse; background: #ffffff !important; }
                        .print-table th, .print-table td { background: #ffffff !important; color: #111827 !important; }
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { padding: 0; }
                            .no-print { display: none !important; }
                            .shadow-lg { box-shadow: none !important; }
                        }
                    </style>
                </head>
                <body>${content.innerHTML}</body>
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
        <Modal isOpen={isOpen} onClose={onClose} title="Visualizar Nota de Débito" size="xl">
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" onClick={onClose}>
                    <HiOutlineXMark className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button onClick={handlePrint} className="bg-amber-600 hover:bg-amber-700 text-white">
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            <Card padding="none" className="max-h-[70vh] overflow-y-auto bg-gray-50/50 dark:bg-dark-900/50 p-4">
                <div
                    ref={printRef}
                    className="bg-white text-gray-900 shadow-lg p-8 max-w-[800px] w-full mx-auto relative flex flex-col min-h-[29.7cm] print-table !bg-white !text-gray-900"
                    style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            paddingBottom: '24px',
                            marginBottom: '28px',
                            borderBottom: '2px solid #1a1a1a',
                        }}
                    >
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {company.logo ? (
                                <img
                                    src={company.logo}
                                    alt="Logo"
                                    style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '64px',
                                        height: '64px',
                                        border: '1px solid #fde68a',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#b45309',
                                    }}
                                >
                                    <HiOutlineBuildingOffice className="w-9 h-9" />
                                </div>
                            )}
                            <div>
                                <h1
                                    style={{
                                        fontSize: '18px',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        color: '#111827',
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {company.tradeName || company.companyName}
                                </h1>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                                    {company.address && (
                                        <p>
                                            {company.address}
                                            {company.city ? `, ${company.city}` : ''}
                                        </p>
                                    )}
                                    {(company.phone || company.email) && (
                                        <p>
                                            {company.phone && `Tel: ${company.phone}`}
                                            {company.email && ` | ${company.email}`}
                                        </p>
                                    )}
                                    {company.taxId && <p>NUIT: {company.taxId}</p>}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div
                                style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    fontSize: '10px',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    marginBottom: '8px',
                                }}
                            >
                                Nota de Débito
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#111827' }}>{debitNote.number}</h2>
                            <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                Ref. Fatura: {debitNote.originalInvoiceNumber}
                            </p>
                            <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                {statusLabels[debitNote.status] || debitNote.status}
                            </p>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '24px',
                            marginBottom: '28px',
                        }}
                    >
                        <InfoBox title="Dados do Cliente">
                            <p style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                                {debitNote.customerName}
                            </p>
                            {debitNote.customerId && (
                                <p style={{ fontSize: '12px', color: '#64748b' }}>
                                    ID Cliente: {debitNote.customerId}
                                </p>
                            )}
                        </InfoBox>
                        <InfoBox title="Detalhes da Emissão">
                            <InfoLine
                                label="Data"
                                value={format(parseISO(debitNote.issueDate), 'dd/MM/yyyy HH:mm')}
                            />
                            <InfoLine label="Motivo" value={debitNote.reason} />
                        </InfoBox>
                    </div>

                    <table
                        className="print-table"
                        style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}
                    >
                        <thead>
                            <tr>
                                <th style={thStyle('left')}>Descrição</th>
                                <th style={thStyle('center', '70px')}>Qtd</th>
                                <th style={thStyle('right', '120px')}>Preço Unit.</th>
                                <th style={thStyle('right', '130px')}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {debitNote.items.map((item, index) => (
                                <tr key={item.id || index}>
                                    <td style={tdStyle('left', true)}>{item.description}</td>
                                    <td style={tdStyle('center')}>{item.quantity}</td>
                                    <td style={tdStyle('right')}>{formatCurrency(item.unitPrice)}</td>
                                    <td style={tdStyle('right', true)}>{formatCurrency(item.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginTop: '28px',
                        }}
                    >
                        <div style={{ maxWidth: '52%' }}>
                            {debitNote.notes && (
                                <>
                                    <p
                                        style={{
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            color: '#374151',
                                            textTransform: 'uppercase',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        Observações
                                    </p>
                                    <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.5 }}>
                                        {debitNote.notes}
                                    </p>
                                </>
                            )}
                        </div>
                        <div
                            style={{
                                width: '260px',
                                backgroundColor: '#f8fafc',
                                padding: '14px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                            }}
                        >
                            <TotalRow label="Subtotal" value={formatCurrency(debitNote.subtotal)} />
                            <TotalRow label={`IVA (${taxRate}%)`} value={formatCurrency(debitNote.tax)} />
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '8px 0 4px',
                                    marginTop: '6px',
                                    borderTop: '1.5px solid #1a1a1a',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 900,
                                        color: '#b45309',
                                        textTransform: 'uppercase',
                                        fontSize: '10px',
                                    }}
                                >
                                    Adicional Cobrado
                                </span>
                                <span style={{ color: '#111827', fontWeight: 900, fontSize: '15px' }}>
                                    {formatCurrency(debitNote.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            padding: '32px 0 24px',
                            marginTop: 'auto',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '64px',
                        }}
                    >
                        <SignatureLine label="Responsável" />
                        <SignatureLine label="Cliente" />
                    </div>

                    <div
                        style={{
                            textAlign: 'center',
                            fontSize: '10px',
                            color: '#9ca3af',
                            paddingTop: '12px',
                            borderTop: '1px solid #f1f5f9',
                        }}
                    >
                        Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')} por{' '}
                        {company.tradeName || company.companyName}
                    </div>
                </div>
            </Card>
        </Modal>
    );
}

function InfoBox({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div
            style={{
                padding: '14px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
            }}
        >
            <h3
                style={{
                    fontSize: '10px',
                    fontWeight: 900,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '8px',
                }}
            >
                {title}
            </h3>
            {children}
        </div>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '12px',
                padding: '2px 0',
            }}
        >
            <span style={{ color: '#64748b', fontWeight: 600 }}>{label}:</span>
            <span style={{ color: '#111827', fontWeight: 600, textAlign: 'right' }}>{value}</span>
        </div>
    );
}

function TotalRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
            <span style={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>
                {label}
            </span>
            <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
        </div>
    );
}

function SignatureLine({ label }: { label: string }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ marginTop: '36px', marginBottom: '6px', borderBottom: '1px solid #1f2937' }} />
            <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{label}</p>
        </div>
    );
}

function thStyle(textAlign: 'left' | 'center' | 'right', width?: string): CSSProperties {
    return {
        textAlign,
        width,
        padding: '12px 14px',
        borderBottom: '1.5px solid #111827',
        fontSize: '10px',
        fontWeight: 900,
        color: '#475569',
        textTransform: 'uppercase',
        backgroundColor: '#ffffff',
    };
}

function tdStyle(textAlign: 'left' | 'center' | 'right', strong = false): CSSProperties {
    return {
        textAlign,
        padding: '11px 14px',
        borderBottom: '1px solid #f1f5f9',
        color: '#111827',
        fontWeight: strong ? 700 : 500,
    };
}
