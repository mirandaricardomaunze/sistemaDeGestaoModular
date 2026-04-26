import { logger } from '../../utils/logger';
import { useRef } from 'react';
import {
    HiOutlinePrinter,
    HiOutlineCheck,
    HiOutlineX,
} from 'react-icons/hi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button, Modal, Card } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { Product } from '../../types';
import toast from 'react-hot-toast';

/** Taxa de IVA padrão em Moçambique (16%) */
const IVA_RATE = 0.16;

interface OrderItem {
    product: Product;
    quantity: number;
}

interface OrderData {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryDate: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    items: OrderItem[];
    notes?: string;
    total: number;
    status: string;
}

interface OrderPrintPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    order: OrderData;
    onMarkAsPrinted: () => void;
}

const priorityLabels: Record<string, string> = {
    low: 'Baixa',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'URGENTE',
};

export default function OrderPrintPreview({
    isOpen,
    onClose,
    order,
    onMarkAsPrinted,
}: OrderPrintPreviewProps) {
    const { companySettings: company } = useStore();
    const printRef = useRef<HTMLDivElement>(null);

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
                    <title>Encomenda ${order.orderNumber}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: 'Inter', Arial, sans-serif; 
                            padding: 30px; 
                            max-width: 800px; 
                            margin: 0 auto; 
                            color: #1a1a1a;
                            background-color: white !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .print-container { background-color: white !important; width: 100%; height: 100%; }
                        table { width: 100%; border-collapse: collapse; background-color: white !important; }
                        div, p, span, h1, h2, h3 { background-color: transparent !important; }
                        .force-white { background-color: white !important; }
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { padding: 0; background-color: white !important; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container force-white">
                        ${content.innerHTML}
                    </div>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(async () => {
            printWindow.print();
            printWindow.close();

            try {
                await fetch(`/api/orders/${order.id}/print`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                onMarkAsPrinted();
            } catch (error) {
                logger.error('Failed to increment print count:', error);
            }
        }, 250);

        toast.success('Pedido enviado para impressão!');
    };

    const handleMarkAsPrinted = () => {
        onMarkAsPrinted();
        toast.success('Pedido marcado como impresso!');
    };

    // Min 6 rows for the product table
    const minRows = 6;
    const emptyRowCount = Math.max(0, minRows - order.items.length);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Preview de Impressão" size="xl">
            {/* Action buttons */}
            <div className="flex justify-end gap-2 mb-4">
                <Button variant="ghost" onClick={onClose}>
                    <HiOutlineX className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button variant="outline" onClick={handleMarkAsPrinted}>
                    <HiOutlineCheck className="w-5 h-5 mr-2" />
                    Marcar como Impresso
                </Button>
                <Button onClick={handlePrint}>
                    <HiOutlinePrinter className="w-5 h-5 mr-2" />
                    Imprimir
                </Button>
            </div>

            {/* Print Preview Document */}
            <Card padding="none" className="max-h-[70vh] overflow-y-auto !bg-white dark:!bg-white flex justify-center p-4 border-none shadow-none">
                <div
                    ref={printRef}
                    className="bg-white text-gray-900 shadow-2xl w-full max-w-[800px] mx-auto relative print-table !bg-white !text-gray-900 border border-gray-100"
                    style={{
                        fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                        position: 'relative',
                        backgroundColor: '#ffffff',
                        color: '#1a1a1a',
                        maxWidth: '800px',
                        margin: '0 auto',
                        colorScheme: 'light',
                        minHeight: '297mm',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >

                    {/* ─────────────────────────────────────────────────────────────────── */}
                    {/* TOP HEADER: Company + ENCOMENDA                    */}
                    {/* ─────────────────────────────────────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 32px 16px', borderBottom: '2px solid #1a1a1a', backgroundColor: 'white', margin: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: 'white' }}>
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ width: '56px', height: '56px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', backgroundColor: 'transparent' }}>
                                    <span style={{ color: '#9ca3af', fontWeight: 900, fontSize: '20px' }}>M</span>
                                </div>
                            )}
                            <div style={{ backgroundColor: 'white' }}>
                                <p style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.1', color: '#1a1a1a' }}>
                                    {company.tradeName || company.companyName}
                                </p>
                                {company.address && (
                                    <p style={{ fontSize: '10px', color: '#64748b', marginTop: '1px', lineHeight: 1.2 }}>{company.address}{company.city ? `, ${company.city}` : ''}</p>
                                )}
                                <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.2 }}>
                                    {company.phone && `Tel: ${company.phone}`}
                                    {company.email && ` | ${company.email}`}
                                </p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', backgroundColor: 'white' }}>
                            <h1 style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: '#1a1a1a', marginBottom: '2px' }}>
                                ENCOMENDA
                            </h1>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', color: order.status !== 'created' ? '#dc2626' : '#16a34a' }}>
                                    {order.status !== 'created' ? 'CÓPIA' : 'ORIGINAL'}
                                </p>
                                <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{order.orderNumber}</p>
                                <p style={{ fontSize: '10px', color: '#94a3b8' }}>
                                    {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────────────────────────── */}
                    {/* SECTION: CLIENTE + INFO (SIDE BY SIDE) */}
                    {/* ─────────────────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: 'white', margin: 0 }}>
                        {/* Column 1: Cliente */}
                        <div style={{ borderRight: '1px solid #f3f4f6' }}>
                            <div style={{ borderBottom: '1px solid #1a1a1a', padding: '8px 32px 4px', margin: 0, backgroundColor: 'white' }}>
                                <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                    Dados do Cliente
                                </h3>
                            </div>
                            <div style={{ padding: '12px 32px', backgroundColor: 'white' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', minWidth: '80px', textTransform: 'uppercase' }}>Nome:</span>
                                    <span style={{ flex: 1, fontSize: '12px', color: '#1e293b', fontWeight: 500, lineHeight: 1.25 }}>{order.customerName}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', minWidth: '80px', textTransform: 'uppercase' }}>Tel:</span>
                                    <span style={{ flex: 1, fontSize: '12px', color: '#1e293b', fontWeight: 500, lineHeight: 1.25 }}>{order.customerPhone}</span>
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Entrega/Info */}
                        <div>
                            <div style={{ borderBottom: '1px solid #1a1a1a', padding: '8px 24px 4px', margin: 0, backgroundColor: 'white' }}>
                                <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                    Detalhes da Encomenda
                                </h3>
                            </div>
                            <div style={{ padding: '12px 24px', backgroundColor: 'white' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', minWidth: '80px', textTransform: 'uppercase' }}>Entrega:</span>
                                    <span style={{ flex: 1, fontSize: '12px', color: '#1e293b', fontWeight: 500, lineHeight: 1.25 }}>
                                        {format(new Date(order.deliveryDate), 'dd/MM/yyyy', { locale: ptBR })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', minWidth: '80px', textTransform: 'uppercase' }}>Prioridade:</span>
                                    <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: order.priority === 'urgent' ? '#b91c1c' : order.priority === 'high' ? '#c2410c' : '#1e293b' }}>
                                        {priorityLabels[order.priority]}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────────────────── */}
                    {/* SECTION: DETALHES DOS PRODUTOS */}
                    {/* ─────────────────────────────── */}
                    <div style={{ padding: '0 32px 16px', backgroundColor: 'white', margin: 0 }}>
                        {(() => {
                            const hasWeight = order.items.some(i => i.product.weight && i.product.weight > 0);
                            const totalWeight = hasWeight
                                ? order.items.reduce((sum, i) => sum + (i.product.weight ? i.product.weight * i.quantity : 0), 0)
                                : 0;
                            return (
                                <>
                                    <table className="print-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#ffffff' }}>
                                                <th style={{ padding: '10px 12px', borderBottom: '1.5px solid #1a1a1a', textAlign: 'left', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Descrição do Item</th>
                                                <th style={{ padding: '10px 12px', borderBottom: '1.5px solid #1a1a1a', textAlign: 'center', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Qtd</th>
                                                <th style={{ padding: '10px 12px', borderBottom: '1.5px solid #1a1a1a', textAlign: 'right', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.025em' }}>V. Unitário</th>
                                                {hasWeight && (
                                                    <th style={{ padding: '10px 12px', borderBottom: '1.5px solid #1a1a1a', textAlign: 'right', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Peso Total</th>
                                                )}
                                                <th style={{ padding: '10px 12px', borderBottom: '1.5px solid #1a1a1a', textAlign: 'right', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.items.map((item, index) => {
                                                const lineWeight = item.product.weight ? item.product.weight * item.quantity : null;
                                                return (
                                                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                                                        <td style={{ padding: '10px 12px', fontSize: '11px', backgroundColor: 'white' }}>
                                                            <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{item.product.name}</div>
                                                            {item.product.code && <div style={{ fontSize: '9px', color: '#64748b' }}>#{item.product.code}</div>}
                                                            {item.product.weight && item.product.weight > 0 && (
                                                                <div style={{ fontSize: '9px', color: '#94a3b8' }}>{item.product.weight.toFixed(3)} kg/un</div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: '#1a1a1a', backgroundColor: 'white' }}>{item.quantity}</td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', color: '#1a1a1a', backgroundColor: 'white' }}>{formatCurrency(item.product.price)}</td>
                                                        {hasWeight && (
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', color: '#475569', backgroundColor: 'white' }}>
                                                                {lineWeight !== null ? `${lineWeight.toFixed(3)} kg` : '—'}
                                                            </td>
                                                        )}
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 800, color: '#1a1a1a', backgroundColor: 'white' }}>{formatCurrency(item.product.price * item.quantity)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {emptyRowCount > 0 && Array.from({ length: 1 }).map((_, i) => (
                                                <tr key={`empty-${i}`}>
                                                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>&nbsp;</td>
                                                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>&nbsp;</td>
                                                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>&nbsp;</td>
                                                    {hasWeight && <td style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>&nbsp;</td>}
                                                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>&nbsp;</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {hasWeight && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Peso Total da Carga</span>
                                                <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                                                    {totalWeight >= 1000
                                                        ? `${(totalWeight / 1000).toFixed(3)} t`
                                                        : `${totalWeight.toFixed(3)} kg`}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* ───────────────── */}
                    {/* SECTION: TOTAIS */}
                    {/* ───────────────── */}
                    <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Left: Notes + Terms */}
                        <div style={{ maxWidth: '55%' }}>
                            {order.notes && (
                                <div style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' }}>Observações:</p>
                                    <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.5', fontStyle: 'italic' }}>{order.notes}</p>
                                </div>
                            )}
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' }}>Termos e Condições:</p>
                                <p style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.6' }}>
                                    Esta encomenda é um documento comercial. Os produtos serão
                                    reservados conforme disponibilidade de estoque. A entrega está
                                    sujeita à confirmação do pagamento e disponibilidade logística.
                                </p>
                            </div>
                        </div>

                        {/* Right: Totals */}
                        <div style={{ width: '220px', backgroundColor: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Subtotal</span>
                                <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatCurrency(order.total)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>IVA (16%)</span>
                                <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatCurrency(order.total * IVA_RATE)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', marginTop: '6px', borderTop: '1.5px solid #1a1a1a' }}>
                                <span style={{ fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', fontSize: '10px' }}>Total Estimado</span>
                                <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '14px' }}>{formatCurrency(order.total * (1 + IVA_RATE))}</span>
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────── */}
                    {/* SIGNATURE SECTION  */}
                    {/* ─────────────────── */}
                    <div style={{ padding: '20px 32px 24px', borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', backgroundColor: 'white', margin: 0 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginTop: '36px', marginBottom: '4px', borderBottom: '1px solid #1e293b' }} />
                            <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>Responsável</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginTop: '36px', marginBottom: '4px', borderBottom: '1px solid #1e293b' }} />
                            <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>Assinatura do Cliente</p>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', padding: '12px 32px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: 'white', margin: 0 }}>
                        <p style={{ margin: 0 }}>
                            Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {company.tradeName || company.companyName}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
