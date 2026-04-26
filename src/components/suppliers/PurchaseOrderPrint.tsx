import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { HiOutlinePrinter, HiOutlineX } from 'react-icons/hi';
import { Modal, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { PurchaseOrder } from '../../types';
import toast from 'react-hot-toast';

interface PurchaseOrderPrintProps {
    isOpen: boolean;
    onClose: () => void;
    order: PurchaseOrder;
}

export default function PurchaseOrderPrint({ isOpen, onClose, order }: PurchaseOrderPrintProps) {
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
                    <title>Encomenda ${order.orderNumber}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Inter', Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #1a1a1a; }
                        .section-bar { background: #4a4a4a; color: white; padding: 5px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
                        table { width: 100%; border-collapse: collapse; }
                        th { background: #e5e5e5; border: 1px solid #bbb; padding: 8px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
                        td { border: 1px solid #ccc; padding: 8px 12px; font-size: 13px; }
                        .field-label { font-size: 11px; font-weight: 700; color: #555; min-width: 100px; display: inline-block; }
                        .field-value { font-size: 13px; border-bottom: 1px solid #999; flex: 1; padding-bottom: 2px; }
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { padding: 0; }
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
        <Modal isOpen={isOpen} onClose={onClose} title="Visualizar Encomenda" size="xl">
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

            <Card padding="none" className="max-h-[70vh] overflow-y-auto !bg-white dark:!bg-white flex justify-center p-4 border-none shadow-none">
                <div
                    ref={printRef}
                    className="bg-white text-gray-900 shadow-2xl w-full max-w-[800px] mx-auto relative print-table !bg-white !text-gray-900 border border-gray-100"
                    style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif", backgroundColor: '#ffffff', color: '#1a1a1a', colorScheme: 'light' }}
                >
                    {/* --------------------------------------------------- */}
                    {/* TOP HEADER: Logo left + ORDER FORM title right    */}
                    {/* --------------------------------------------------- */}
                    {/* --------------------------------------------------- */}
                    {/* TOP HEADER: Logo left + ORDER title right         */}
                    {/* --------------------------------------------------- */}
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
                                    <p style={{ fontSize: '10px', color: '#64748b', marginTop: '1px', lineHeight: 1.2 }}>{company.address}</p>
                                )}
                                <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.2 }}>
                                    {company.phone && `Tel: ${company.phone}`}
                                </p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', backgroundColor: 'white' }}>
                            <h1 style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: '#1a1a1a', marginBottom: '2px' }}>
                                ORDEM DE COMPRA
                            </h1>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{order.orderNumber}</p>
                                <p style={{ fontSize: '10px', color: '#94a3b8' }}>
                                    {format(parseISO(order.createdAt), 'dd/MM/yyyy')}
                                </p>
                                <span style={{ alignSelf: 'flex-end', marginTop: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, background: order.status === 'received' ? '#dcfce7' : order.status === 'ordered' ? '#dbeafe' : '#fee2e2', color: order.status === 'received' ? '#16a34a' : order.status === 'ordered' ? '#2563eb' : '#dc2626' }}>
                                    {order.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* --------------------------- */}
                    {/* SECTION: DADOS DO CLIENTE  */}
                    {/* --------------------------- */}
                    {/* --------------- */}
                    {/* SECTION: DADOS  */}
                    {/* --------------- */}
                    {/* --------------------------------------- */}
                    {/* SECTION: FORNECEDOR + INFO (SIDE BY SIDE) */}
                    {/* --------------------------------------- */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: 'white', margin: 0 }}>
                        {/* Column 1: Fornecedor */}
                        <div style={{ borderRight: '1px solid #f3f4f6' }}>
                            <div style={{ borderBottom: '1px solid #1a1a1a', padding: '8px 32px 4px', margin: 0, backgroundColor: 'white' }}>
                                <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                    Dados do Fornecedor
                                </h3>
                            </div>
                            <div style={{ padding: '12px 32px', backgroundColor: 'white' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#555', minWidth: '80px', textTransform: 'uppercase' }}>Nome:</span>
                                    <span style={{ flex: 1, fontSize: '13px', color: '#111827', fontWeight: 500 }}>{order.supplierName}</span>
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Datas/Info */}
                        <div>
                            <div style={{ borderBottom: '1px solid #1a1a1a', padding: '8px 24px 4px', margin: 0, backgroundColor: 'white' }}>
                                <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                    Informações de Entrega
                                </h3>
                            </div>
                            <div style={{ padding: '12px 24px', backgroundColor: 'white' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#555', minWidth: '80px', textTransform: 'uppercase' }}>Pedido em:</span>
                                    <span style={{ flex: 1, fontSize: '12px', color: '#111827', fontWeight: 500 }}>{format(parseISO(order.createdAt), 'dd/MM/yyyy')}</span>
                                </div>
                                {order.expectedDeliveryDate && (
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#555', minWidth: '80px', textTransform: 'uppercase' }}>Previsão:</span>
                                        <span style={{ flex: 1, fontSize: '12px', color: '#111827', fontWeight: 500 }}>{format(parseISO(order.expectedDeliveryDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ------------------------------- */}
                    {/* SECTION: DETALHES DOS PRODUTOS */}
                    {/* ------------------------------- */}
                    <div style={{ padding: '0 32px 16px' }}>
                        {(() => {
                            const hasWeight = order.items.some(i => i.unitWeight && i.unitWeight > 0);
                            const totalWeight = hasWeight
                                ? order.items.reduce((sum, i) => sum + (i.unitWeight ? i.unitWeight * i.quantity : 0), 0)
                                : 0;
                            return (
                                <>
                                    <table className="print-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', padding: '12px 16px', borderBottom: '1.5px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                                                    Descrição do Item
                                                </th>
                                                <th style={{ textAlign: 'center', fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', padding: '12px 16px', width: '80px', borderBottom: '1.5px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                                                    Qtd
                                                </th>
                                                <th style={{ textAlign: 'right', fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', padding: '12px 16px', width: '120px', borderBottom: '1.5px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                                                    V. Unitário
                                                </th>
                                                {hasWeight && (
                                                    <th style={{ textAlign: 'right', fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', padding: '12px 16px', width: '100px', borderBottom: '1.5px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                                                        Peso Total
                                                    </th>
                                                )}
                                                <th style={{ textAlign: 'right', fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', padding: '12px 16px', width: '120px', borderBottom: '1.5px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                                                    Subtotal
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.items.map((item) => {
                                                const lineWeight = item.unitWeight ? item.unitWeight * item.quantity : null;
                                                return (
                                                    <tr key={item.productName}>
                                                        <td style={{ padding: '10px 16px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}>
                                                            {item.productName}
                                                            {item.unitWeight && item.unitWeight > 0 && (
                                                                <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>
                                                                    {item.unitWeight.toFixed(3)} kg/un
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 16px', textAlign: 'center', color: '#1e293b', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                                                            {item.quantity}
                                                        </td>
                                                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>
                                                            {formatCurrency(item.unitCost)}
                                                        </td>
                                                        {hasWeight && (
                                                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                                                                {lineWeight !== null ? `${lineWeight.toFixed(3)} kg` : '—'}
                                                            </td>
                                                        )}
                                                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#1a1a1a', fontWeight: 700, borderBottom: '1px solid #f1f5f9' }}>
                                                            {formatCurrency(item.total)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
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

                    {/* --------------- */}
                    {/* SECTION: TOTAIS */}
                    {/* --------------- */}
                    {/* --------------- */}
                    {/* SECTION: TOTAIS */}
                    {/* --------------- */}
                    <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Left: Notes + Terms */}
                        <div style={{ maxWidth: '55%' }}>
                            {order.notes && (
                                <div className="mb-4">
                                    <p className="text-[10px] font-black text-gray-800 mb-1 uppercase tracking-widest">Observações:</p>
                                    <p className="text-xs text-gray-600 leading-relaxed italic">{order.notes}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-[10px] font-black text-gray-800 mb-1 uppercase tracking-widest">Termos e Condições:</p>
                                <p className="text-gray-400 leading-relaxed" style={{ fontSize: '10px' }}>
                                    Esta ordem de compra é um documento comercial vinculativo.
                                    Os produtos devem ser entregues conforme as especificaces
                                    e prazos acordados. Qualquer divergência deve ser comunicada
                                    antes da entrega.
                                </p>
                            </div>
                        </div>

                        {/* Right: Totals */}
                        <div style={{ width: '220px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Subtotal</span>
                                <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatCurrency(order.total)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Taxas</span>
                                <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatCurrency(0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', marginTop: '6px', borderTop: '1.5px solid #1a1a1a' }}>
                                <span style={{ fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', fontSize: '10px' }}>Total da Ordem</span>
                                <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '14px' }}>{formatCurrency(order.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* ------------------- */}
                    {/* SIGNATURE SECTION  */}
                    {/* ------------------- */}
                    <div className="px-8 pt-5 pb-6" style={{ borderTop: '1px solid #f1f5f9' }}>
                        <div className="grid grid-cols-2 gap-16">
                            <div className="text-center">
                                <div className="mt-8 mb-1" style={{ borderBottom: '1px solid #1e293b' }} />
                                <p className="text-[10px] text-gray-400 italic">Autorizado Por</p>
                            </div>
                            <div className="text-center">
                                <div className="mt-8 mb-1" style={{ borderBottom: '1px solid #1e293b' }} />
                                <p className="text-[10px] text-gray-400 italic">Recebido Por</p>
                            </div>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-center text-xs text-gray-400 pb-6 px-8" style={{ borderTop: '1px solid #f0f0f0' }}>
                        <p className="pt-3">Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')} por {company.tradeName || company.companyName}</p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
