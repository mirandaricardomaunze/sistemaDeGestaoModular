import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HiOutlinePrinter, HiOutlineXMark as HiOutlineXMark } from 'react-icons/hi2';
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
    const { companySettings: company } = useStore();
    const { warehouses: warehousesData } = useWarehouses();

    const warehouses = Array.isArray(warehousesData) ? warehousesData : [];
    const getWarehouse = (id: string) => warehouses.find(w => w.id === id);
    const source = getWarehouse(transfer.sourceWarehouseId);
    const target = getWarehouse(transfer.targetWarehouseId);
    const statusLabels: Record<string, string> = {
        draft: 'Rascunho',
        pending: 'Pendente',
        approved: 'Aprovada',
        in_transit: 'Em trânsito',
        received: 'Recebida',
        completed: 'Concluída',
        rejected: 'Rejeitada',
        cancelled: 'Cancelada',
    };
    const totalUnits = transfer.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalValue = transfer.items.reduce((sum, item) => {
        const product = item.product as { costPrice?: number | string; price?: number | string } | undefined;
        const unitValue = Number(product?.costPrice ?? product?.price ?? 0);
        return sum + unitValue * Number(item.quantity || 0);
    }, 0);

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
                    <title>Guia de Transferência ${transfer.number}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: 'Inter', Arial, sans-serif; 
                            padding: 30px; 
                            max-width: 800px; 
                            margin: 0 auto; 
                            color: #1e293b; 
                            background-color: white !important;
                        }
                        .header-row { margin-bottom: 30px; }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            background-color: white !important;
                            border: none !important;
                        }
                        th { 
                            background-color: #f1f5f9 !important;
                            color: #334155 !important;
                            text-align: left !important;
                            padding: 12px 10px;
                            font-size: 9px;
                            text-transform: uppercase;
                            letter-spacing: 0.1em;
                            font-weight: 800;
                            border: none !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        td { 
                            padding: 12px 10px;
                            border: none !important;
                            vertical-align: middle;
                            color: #334155;
                            font-size: 11px;
                            text-align: left !important;
                        }
                        .section-title {
                            font-size: 10px;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: 0.1em;
                            color: #64748b;
                            margin-bottom: 15px;
                            padding-bottom: 5px;
                            border-bottom: 2px solid #e2e8f0;
                        }
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
        }, 250);

        toast.success('Guia enviada para impressão!');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Visualizar Guia"
            size="xl"
            isLight
        >
            <div className="flex justify-end gap-2 mb-4">
                <Button
                    variant="ghost"
                    onClick={onClose}
                    className="!text-slate-500 hover:!bg-slate-100"
                >
                    <HiOutlineXMark className="w-4 h-4 mr-2" />
                    Fechar
                </Button>
                <Button
                    onClick={handlePrint}
                    className="bg-slate-900 hover:bg-slate-800 text-white border-none shadow-none"
                >
                    <HiOutlinePrinter className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            <Card padding="none" className="max-h-[70vh] overflow-y-auto bg-slate-100 dark:bg-slate-100 p-8">
                <div
                    ref={printRef}
                    className="text-gray-900 shadow-2xl w-full max-w-[800px] mx-auto relative border border-slate-200"
                    style={{
                        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                        position: 'relative',
                        backgroundColor: '#ffffff',
                        color: '#1e293b',
                        maxWidth: '800px',
                        margin: '0 auto',
                        lineHeight: '1.5'
                    }}
                >
                    {/* ───────────────────────────────────────────────────────────── */}
                    {/* TOP HEADER: Company + GUIA DE TRANSFERÊNCIA       */}
                    {/* ───────────────────────────────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 40px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ width: '56px', height: '56px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
                                    <span style={{ color: 'white', fontWeight: 800, fontSize: '24px', letterSpacing: '-1px' }}>M</span>
                                </div>
                            )}
                            <div>
                                <h2 style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '2px' }}>
                                    {company.tradeName || company.companyName}
                                </h2>
                                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    {company.address && <span>{company.address}{company.city ? `, ${company.city}` : ''}</span>}
                                    {company.phone && <span>Tel: {company.phone}</span>}
                                    {company.email && <span>{company.email}</span>}
                                    {company.taxId && <span>NUIT: {company.taxId}</span>}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '4px', marginBottom: '8px', display: 'inline-block' }}>
                                <h1 style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                                    Guia de Transferência
                                </h1>
                            </div>
                            <p style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0' }}>{transfer.number}</p>
                            <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                                {format(parseISO(transfer.date), 'dd/MM/yyyy HH:mm')}
                            </p>
                            <p style={{ fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>
                                {statusLabels[transfer.status] || transfer.status}
                            </p>
                        </div>
                    </div>

                    {/* ────────────────────────── */}
                    {/* SECTION: ARMAZÉNS              */}
                    {/* ────────────────────────── */}
                    <div style={{ padding: '16px 40px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Origem</p>
                                <p style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b', marginBottom: '1px' }}>{source?.name || 'N/A'}</p>
                                {source?.location && <p style={{ fontSize: '11px', color: '#64748b' }}>{source.location}</p>}
                            </div>
                            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Destino</p>
                                <p style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b', marginBottom: '1px' }}>{target?.name || 'N/A'}</p>
                                {target?.location && <p style={{ fontSize: '11px', color: '#64748b' }}>{target.location}</p>}
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────────────────── */}
                    {/* SECTION: ITENS TRANSFERIDOS    */}
                    {/* ─────────────────────────────── */}
                    <div style={{ padding: '0 32px 10px' }}>
                    </div>
                    <div style={{ padding: '16px 32px' }}>
                        {(() => {
                            const hasWeight = transfer.items.some(i => i.product?.weight && i.product.weight > 0);
                            const totalWeight = hasWeight
                                ? transfer.items.reduce((sum, i) => sum + (i.product?.weight ? i.product.weight * i.quantity : 0), 0)
                                : 0;
                            return (
                                <>
                                    <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', border: 'none', backgroundColor: 'white' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #0f172a' }}>
                                                <th style={{ color: '#0f172a', padding: '14px 10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, textAlign: 'left' }}>Cód. Barras</th>
                                                <th style={{ color: '#0f172a', padding: '14px 10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, textAlign: 'left' }}>Referência</th>
                                                <th style={{ color: '#0f172a', padding: '14px 10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, textAlign: 'left' }}>Produto</th>
                                                <th style={{ color: '#0f172a', textAlign: 'center', padding: '14px 10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Qtd</th>
                                                <th style={{ color: '#0f172a', textAlign: 'right', padding: '14px 10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Valor Unit.</th>
                                                {hasWeight && <th style={{ color: '#0f172a', textAlign: 'right', padding: '14px 10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Peso Total</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transfer.items.map((item, index) => {
                                                const productExt = item.product as ({ sku?: string; reference?: string; costPrice?: number | string; price?: number | string } & typeof item.product) | undefined;
                                                const productName = item.product?.name || item.productName;
                                                const productCode = productExt?.sku || productExt?.reference || item.productCode || item.product?.code || '';
                                                const productBarcode = item.product?.barcode || item.productBarcode || '-';
                                                const lineWeight = item.product?.weight ? Number(item.product.weight) * item.quantity : null;
                                                const unitPrice = Number(productExt?.costPrice || productExt?.price || 0);
                                                const formatCurrency = (val: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(val);

                                                return (
                                                    <tr key={index} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '14px 10px', fontSize: '12px', fontWeight: 500, color: '#475569' }}>{productBarcode}</td>
                                                        <td style={{ padding: '14px 10px', fontSize: '12px', fontWeight: 500, color: '#475569' }}>{productCode || '-'}</td>
                                                        <td style={{ padding: '14px 10px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                                            {productName}
                                                        </td>
                                                        <td style={{ padding: '14px 10px', fontWeight: '700', color: '#1e293b', textAlign: 'center', fontSize: '14px' }}>{item.quantity}</td>
                                                        <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: '600', color: '#475569', fontSize: '13px' }}>{formatCurrency(unitPrice)}</td>
                                                        {hasWeight && (
                                                            <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: '600', color: '#475569', fontSize: '13px' }}>
                                                                {lineWeight !== null ? `${lineWeight.toLocaleString('pt-MZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg` : '—'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                                        <div style={{ width: '280px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                                            {hasWeight && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Peso Total</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>
                                                        {totalWeight >= 1000
                                                            ? `${(totalWeight / 1000).toLocaleString('pt-MZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`
                                                            : `${totalWeight.toLocaleString('pt-MZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`}
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f8fafc' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total da Guia</span>
                                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                                                    {new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
                                                        totalValue
                                                    )} MTn
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>


                    <div style={{ padding: '16px 40px' }}>
                        <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            Informações Adicionais
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Motivo</p>
                                <p style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>{transfer.reason || 'Não especificado'}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Emissor</p>
                                <p style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>{transfer.responsible}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Estado</p>
                                <p style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>{statusLabels[transfer.status] || transfer.status}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Total de Unidades</p>
                                <p style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>{totalUnits.toLocaleString('pt-MZ')}</p>
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────── */}
                    {/* SIGNATURE SECTION  */}
                    {/* ─────────────────── */}
                    <div style={{ padding: '32px 40px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '32px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderBottom: '1.5px solid #0f172a', marginBottom: '6px' }} />
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emitente</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderBottom: '1.5px solid #0f172a', marginBottom: '6px' }} />
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transportador</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderBottom: '1.5px solid #0f172a', marginBottom: '6px' }} />
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recebedor</p>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div style={{ textAlign: 'center', fontSize: '10px', color: '#9ca3af', padding: '8px 32px 16px', borderTop: '1px solid #f0f0f0' }}>
                        <p>
                            Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {company.tradeName || company.companyName}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
