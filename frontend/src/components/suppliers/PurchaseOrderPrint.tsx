import { useMemo, useRef, type CSSProperties } from 'react';
import { format, parseISO } from 'date-fns';
import { HiOutlinePrinter, HiOutlineXMark as HiOutlineXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { Modal, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { PurchaseOrder } from '../../types';

interface PurchaseOrderPrintProps {
    isOpen: boolean;
    onClose: () => void;
    order: PurchaseOrder;
}

const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    ordered: 'Encomendado',
    partial: 'Parcial',
    received: 'Recebido',
    cancelled: 'Cancelado',
};

export default function PurchaseOrderPrint({ isOpen, onClose, order }: PurchaseOrderPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings: company } = useStore();

    const orderAny = order as typeof order & {
        supplier?: { name?: string; code?: string; nuit?: string; taxId?: string; phone?: string; email?: string };
        supplierCode?: string;
        supplierNuit?: string;
        supplierTaxId?: string;
        supplierPhone?: string;
        supplierEmail?: string;
        subtotal?: number | string;
        tax?: number | string;
        taxAmount?: number | string;
        taxRate?: number | string;
    };
    const supplier = orderAny.supplier || {};
    const supplierName = order.supplierName || supplier.name || 'Fornecedor não identificado';
    const supplierCode = supplier.code || orderAny.supplierCode;
    const supplierNuit = supplier.nuit || supplier.taxId || orderAny.supplierNuit || orderAny.supplierTaxId;
    const supplierPhone = supplier.phone || orderAny.supplierPhone;
    const supplierEmail = supplier.email || orderAny.supplierEmail;

    const totals = useMemo(() => {
        const subtotal = Number(
            orderAny.subtotal ??
            order.items.reduce((sum, item) => sum + Number(item.total || item.unitCost * item.quantity || 0), 0)
        );
        const taxRate = Number(orderAny.taxRate ?? company.ivaRate ?? 16);
        const taxAmount = Number(orderAny.tax ?? orderAny.taxAmount ?? Math.max(0, Number(order.total) - subtotal));
        const grandTotal = Number(order.total ?? subtotal + taxAmount);
        const totalWeight = order.items.reduce((sum, item) => sum + Number(item.unitWeight || 0) * Number(item.quantity || 0), 0);

        return { subtotal, taxRate, taxAmount, grandTotal, totalWeight };
    }, [company.ivaRate, order.items, order.total, orderAny.subtotal, orderAny.tax, orderAny.taxAmount, orderAny.taxRate]);

    const hasWeight = totals.totalWeight > 0;

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
                    <title>Ordem de Compra ${order.orderNumber}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
                    <style>
                        :root { color-scheme: light !important; }
                        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        body {
                            font-family: 'Inter', Arial, sans-serif;
                            padding: 30px;
                            max-width: 800px;
                            margin: 0 auto;
                            color: #1a1a1a;
                            background-color: white !important;
                        }
                        table { width: 100%; border-collapse: collapse; background-color: white !important; }
                        .print-table th, .print-table td { background-color: white !important; color: #1a1a1a !important; }
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { padding: 0; background-color: white !important; }
                            .no-print { display: none !important; }
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
        <Modal isOpen={isOpen} onClose={onClose} title="Visualizar Ordem de Compra" size="xl">
            <div className="flex justify-end gap-2 mb-4 no-print">
                <Button variant="outline" onClick={onClose}>
                    <HiOutlineXMark className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            <Card padding="none" className="max-h-[70vh] overflow-y-auto !bg-white dark:!bg-white p-4 border-none shadow-none">
                <div
                    ref={printRef}
                    className="bg-white text-gray-900 shadow-2xl w-full max-w-[800px] mx-auto relative print-table !bg-white !text-gray-900 border border-gray-100"
                    style={{
                        fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                        backgroundColor: '#ffffff',
                        color: '#1a1a1a',
                        colorScheme: 'light',
                        minHeight: '297mm',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 32px 16px', borderBottom: '2px solid #1a1a1a', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ width: '56px', height: '56px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb' }}>
                                    <span style={{ color: '#9ca3af', fontWeight: 900, fontSize: '20px' }}>M</span>
                                </div>
                            )}
                            <div>
                                <p style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.1', color: '#1a1a1a' }}>
                                    {company.tradeName || company.companyName}
                                </p>
                                {company.address && <p style={{ fontSize: '10px', color: '#64748b', marginTop: '1px', lineHeight: 1.2 }}>{company.address}{company.city ? `, ${company.city}` : ''}</p>}
                                {(company.phone || company.email) && (
                                    <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.2 }}>
                                        {company.phone && `Tel: ${company.phone}`}{company.email && ` | ${company.email}`}
                                    </p>
                                )}
                                {company.taxId && <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.2 }}>NUIT: {company.taxId}</p>}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h1 style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: '#1a1a1a', marginBottom: '2px' }}>
                                ORDEM DE COMPRA
                            </h1>
                            <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{order.orderNumber}</p>
                            <p style={{ fontSize: '10px', color: '#94a3b8' }}>{format(parseISO(order.createdAt), 'dd/MM/yyyy')}</p>
                            <span style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, background: order.status === 'received' ? '#dcfce7' : order.status === 'ordered' ? '#dbeafe' : '#f1f5f9', color: order.status === 'received' ? '#16a34a' : order.status === 'ordered' ? '#2563eb' : '#475569' }}>
                                {statusLabels[order.status] || order.status}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: 'white' }}>
                        <div style={{ borderRight: '1px solid #f3f4f6' }}>
                            <div style={{ borderBottom: '1px solid #1a1a1a', padding: '8px 32px 4px' }}>
                                <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Dados do Fornecedor</h3>
                            </div>
                            <div style={{ padding: '12px 32px' }}>
                                <InfoRow label="Nome" value={supplierName} strong />
                                {supplierCode && <InfoRow label="Código" value={supplierCode} />}
                                {supplierNuit && <InfoRow label="NUIT" value={supplierNuit} />}
                                {supplierPhone && <InfoRow label="Tel" value={supplierPhone} />}
                                {supplierEmail && <InfoRow label="Email" value={supplierEmail} />}
                            </div>
                        </div>
                        <div>
                            <div style={{ borderBottom: '1px solid #1a1a1a', padding: '8px 24px 4px' }}>
                                <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Informações de Entrega</h3>
                            </div>
                            <div style={{ padding: '12px 24px' }}>
                                <InfoRow label="Pedido em" value={format(parseISO(order.createdAt), 'dd/MM/yyyy')} />
                                {order.expectedDeliveryDate && <InfoRow label="Previsão" value={format(parseISO(order.expectedDeliveryDate), 'dd/MM/yyyy')} />}
                                <InfoRow label="Estado" value={statusLabels[order.status] || order.status} />
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '16px 32px' }}>
                        <table className="print-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle('left')}>Descrição do Item</th>
                                    <th style={thStyle('center', '80px')}>Qtd</th>
                                    <th style={thStyle('right', '120px')}>V. Unitário</th>
                                    {hasWeight && <th style={thStyle('right', '100px')}>Peso Total</th>}
                                    <th style={thStyle('right', '120px')}>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item) => {
                                    const lineWeight = Number(item.unitWeight || 0) * Number(item.quantity || 0);

                                    return (
                                        <tr key={item.id || item.productName}>
                                            <td style={tdStyle('left', true)}>
                                                {item.productName}
                                                {item.unitWeight && item.unitWeight > 0 && (
                                                    <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>
                                                        {item.unitWeight.toFixed(3)} kg/un
                                                    </span>
                                                )}
                                            </td>
                                            <td style={tdStyle('center', true)}>{item.quantity}</td>
                                            <td style={tdStyle('right')}>{formatCurrency(item.unitCost)}</td>
                                            {hasWeight && <td style={tdStyle('right')}>{lineWeight > 0 ? `${lineWeight.toFixed(3)} kg` : '-'}</td>}
                                            <td style={tdStyle('right', true)}>{formatCurrency(item.total)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {hasWeight && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Peso Total da Carga</span>
                                    <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                                        {totals.totalWeight >= 1000 ? `${(totals.totalWeight / 1000).toFixed(3)} t` : `${totals.totalWeight.toFixed(3)} kg`}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ maxWidth: '55%' }}>
                            {order.notes && (
                                <div style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' }}>Observações</p>
                                    <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.5', fontStyle: 'italic' }}>{order.notes}</p>
                                </div>
                            )}
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' }}>Termos e Condições</p>
                                <p style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.6' }}>
                                    Esta ordem de compra é um documento comercial vinculativo. Os produtos devem ser entregues conforme as especificações e prazos acordados.
                                </p>
                            </div>
                        </div>

                        <div style={{ width: '240px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <TotalRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
                            <TotalRow label={`IVA/Taxas (${totals.taxRate}%)`} value={formatCurrency(totals.taxAmount)} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', marginTop: '6px', borderTop: '1.5px solid #1a1a1a' }}>
                                <span style={{ fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', fontSize: '10px' }}>Total da Ordem</span>
                                <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '14px' }}>{formatCurrency(totals.grandTotal)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '20px 32px 24px', borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px' }}>
                        <SignatureLine label="Autorizado por" />
                        <SignatureLine label="Recebido por" />
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', padding: '12px 32px 24px', borderTop: '1px solid #e5e7eb' }}>
                        <p>Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')} por {company.tradeName || company.companyName}</p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', minWidth: '80px', textTransform: 'uppercase' }}>{label}:</span>
            <span style={{ flex: 1, fontSize: strong ? '13px' : '12px', color: '#111827', fontWeight: strong ? 600 : 500 }}>{value}</span>
        </div>
    );
}

function TotalRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
            <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>{label}</span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{value}</span>
        </div>
    );
}

function SignatureLine({ label }: { label: string }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ marginTop: '36px', marginBottom: '4px', borderBottom: '1px solid #1e293b' }} />
            <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>{label}</p>
        </div>
    );
}

function thStyle(textAlign: 'left' | 'center' | 'right', width?: string): CSSProperties {
    return {
        textAlign,
        width,
        fontSize: '10px',
        fontWeight: 900,
        color: '#475569',
        textTransform: 'uppercase',
        padding: '12px 16px',
        borderBottom: '1.5px solid #1a1a1a',
        backgroundColor: '#ffffff',
    };
}

function tdStyle(textAlign: 'left' | 'center' | 'right', strong = false): CSSProperties {
    return {
        padding: '10px 16px',
        textAlign,
        color: '#1e293b',
        borderBottom: '1px solid #f1f5f9',
        fontWeight: strong ? 600 : 500,
    };
}
