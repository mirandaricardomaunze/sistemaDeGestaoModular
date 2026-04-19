import { useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HiOutlinePrinter, HiOutlineX } from 'react-icons/hi';
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

/* ── Shared inline style fragments (DRY) ──────────────────────-*/
const sectionBar = { background: '#4a4a4a', padding: '6px 16px' } as const;
const sectionTitle = { fontSize: '11px', fontWeight: 700, color: 'white', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: 0 };
const fieldLabel = { fontSize: '11px', fontWeight: 700, color: '#4b5563', minWidth: '100px' } as const;
const fieldValue = { flex: 1, fontSize: '13px', color: '#111827', paddingBottom: '2px', borderBottom: '1px solid #999' } as const;
const fieldRow = { display: 'flex', alignItems: 'baseline', gap: '4px' } as const;

export default function TransferGuidePrint({ isOpen, onClose, transfer }: TransferGuidePrintProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { companySettings: company } = useStore();
    const { warehouses: warehousesData } = useWarehouses();

    const warehouses = Array.isArray(warehousesData) ? warehousesData : [];
    const getWarehouse = (id: string) => warehouses.find(w => w.id === id);
    const source = getWarehouse(transfer.sourceWarehouseId);
    const target = getWarehouse(transfer.targetWarehouseId);

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
                    <HiOutlineX className="w-4 h-4 mr-2" />
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

            <Card padding="none" className="max-h-[70vh] overflow-y-auto bg-slate-100 dark:bg-slate-100 flex justify-center p-8">
                <div
                    ref={printRef}
                    className="bg-white dark:bg-white text-gray-900 shadow-2xl w-full max-w-[800px] mx-auto relative shadow-inner border border-slate-200"
                    style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif", position: 'relative', background: 'white', color: '#111', maxWidth: '800px', margin: '0 auto' }}
                >
                    {/* ───────────────────────────────────────────────────────────── */}
                    {/* TOP HEADER: Company + GUIA DE TRANSFERÊNCIA       */}
                    {/* ───────────────────────────────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '32px 32px 20px', borderBottom: '3px solid #333' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {company.logo ? (
                                <img src={company.logo} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ width: '64px', height: '64px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #34d399, #3b82f6)' }}>
                                    <span style={{ color: 'white', fontWeight: 900, fontSize: '24px' }}>M</span>
                                </div>
                            )}
                            <div>
                                <p style={{ fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: '1.2', color: '#1a1a1a' }}>
                                    {company.tradeName || company.companyName}
                                </p>
                                {company.address && (
                                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{company.address}{company.city ? `, ${company.city}` : ''}</p>
                                )}
                                {company.phone && (
                                    <p style={{ fontSize: '11px', color: '#6b7280' }}>Tel: {company.phone}</p>
                                )}
                                {company.email && (
                                    <p style={{ fontSize: '11px', color: '#6b7280' }}>{company.email}</p>
                                )}
                                {company.taxId && (
                                    <p style={{ fontSize: '11px', color: '#6b7280' }}>NUIT: {company.taxId}</p>
                                )}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h1 style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', fontFamily: 'Georgia, "Times New Roman", serif', color: '#1a1a1a' }}>
                                GUIA DE TRANSFERÊNCIA
                            </h1>
                            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', fontFamily: 'monospace', letterSpacing: '1px' }}>{transfer.number}</p>
                            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                {format(parseISO(transfer.date), 'dd/MM/yyyy HH:mm')}
                            </p>
                        </div>
                    </div>

                    {/* ────────────────────────── */}
                    {/* SECTION: ARMAZÉNS              */}
                    {/* ────────────────────────── */}
                    <div style={{ padding: '0 32px 20px' }}>
                        <h3 className="section-title">Armazéns</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '40px' }}>
                            {/* Origem */}
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Origem</p>
                                <p style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>{source?.name || 'N/A'}</p>
                                {source?.location && <p style={{ fontSize: '11px', color: '#64748b' }}>{source.location}</p>}
                            </div>
                            {/* Destino */}
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Destino</p>
                                <p style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>{target?.name || 'N/A'}</p>
                                {target?.location && <p style={{ fontSize: '11px', color: '#64748b' }}>{target.location}</p>}
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────────────────── */}
                    {/* SECTION: ITENS TRANSFERIDOS    */}
                    {/* ─────────────────────────────── */}
                    <div style={{ padding: '0 32px 10px' }}>
                        <h3 className="section-title">Itens Transferidos</h3>
                    </div>
                    <div style={{ padding: '16px 32px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '150px' }}>Cód. Barras</th>
                                    <th style={{ width: '100px' }}>Referência</th>
                                    <th>Produto</th>
                                    <th style={{ textAlign: 'left', width: '80px' }}>Qtd</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transfer.items.map((item, index) => {
                                    const productName = item.product?.name || item.productName;
                                    const productCode = (item.product as any)?.sku || item.product?.code || item.productCode;
                                    const productBarcode = item.product?.barcode || item.productBarcode || '-';

                                    return (
                                        <tr key={index}>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{productBarcode}</td>
                                            <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{productCode}</td>
                                            <td style={{ fontWeight: '600', color: '#1e293b' }}>{productName}</td>
                                            <td style={{ fontWeight: '800' }}>{item.quantity}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ─────────────────────────── */}
                    {/* SECTION: OBSERVAÇÕES   */}
                    {/* ─────────────────────────── */}
                    <div style={sectionBar}>
                        <h3 style={sectionTitle}>Informações Adicionais</h3>
                    </div>
                    <div style={{ padding: '20px 32px', borderBottom: '1px solid #e5e5e5' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '40px', rowGap: '12px' }}>
                            <div style={fieldRow}>
                                <span style={fieldLabel}>Motivo:</span>
                                <span style={fieldValue}>{transfer.reason || 'N/A'}</span>
                            </div>
                            <div style={fieldRow}>
                                <span style={fieldLabel}>Emissor:</span>
                                <span style={fieldValue}>{transfer.responsible}</span>
                            </div>
                        </div>
                    </div>

                    {/* ─────────────────── */}
                    {/* SIGNATURE SECTION  */}
                    {/* ─────────────────── */}
                    <div style={{ padding: '24px 32px 32px', borderTop: '1px solid #e5e5e5', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginTop: '48px', marginBottom: '6px', borderBottom: '1px solid #333' }} />
                            <p style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>Emitente</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginTop: '48px', marginBottom: '6px', borderBottom: '1px solid #333' }} />
                            <p style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>Transportador</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginTop: '48px', marginBottom: '6px', borderBottom: '1px solid #333' }} />
                            <p style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>Recebedor</p>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', padding: '12px 32px 24px', borderTop: '1px solid #f0f0f0' }}>
                        <p>
                            Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {company.tradeName || company.companyName}
                        </p>
                    </div>
                </div>
            </Card>
        </Modal>
    );
}
