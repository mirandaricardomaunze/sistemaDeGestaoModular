import { Button, Modal, Badge } from '../ui';
import { HiOutlinePrinter, HiOutlineArrowDownTray } from 'react-icons/hi2';
import { formatCurrency } from '../../utils/helpers';
import { generateSupplierInvoicePDF, type CompanyInfo } from '../../utils/documentGenerator';
import type { SupplierInvoice } from '../../services/api/commercial.api';
import { format, parseISO } from 'date-fns';

interface SupplierInvoiceDetailsModalProps {
    invoice: SupplierInvoice | null;
    companySettings: CompanyInfo | null;
    onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'gray' | 'info' | 'warning' | 'success' | 'danger' }> = {
    registered: { label: 'Por Pagar', variant: 'info' },
    partial:    { label: 'Parcial',   variant: 'warning' },
    paid:       { label: 'Paga',      variant: 'success' },
    cancelled:  { label: 'Cancelada', variant: 'danger' },
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
    cash:     'Numerário',
    card:     'Cartão',
    pix:      'PIX',
    transfer: 'Transferência',
    credit:   'Crédito',
    mpesa:    'M-Pesa',
    emola:    'e-Mola',
};

export function SupplierInvoiceDetailsModal({ invoice, companySettings, onClose }: SupplierInvoiceDetailsModalProps) {
    if (!invoice) return null;

    const companyName = companySettings?.tradeName || companySettings?.companyName || 'Multicore';
    const companyAddress = [
        companySettings?.address,
        companySettings?.city,
        companySettings?.province
    ].filter(Boolean).join(', ') || 'Endereço não configurado';

    const statusCfg = STATUS_LABELS[invoice.status] || { label: invoice.status, variant: 'gray' };
    const payments = invoice.payments || [];

    return (
        <Modal
            isOpen={!!invoice}
            onClose={onClose}
            title={`Visualização de Factura de Compra — ${invoice.invoiceNumber}`}
            size="xl"
        >
            <div className="space-y-6">
                {/* Modal Header Actions */}
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-dark-700 pb-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Factura {invoice.invoiceNumber}</p>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">Pré-visualização do Documento</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={() => generateSupplierInvoicePDF(invoice, companySettings ?? {}, 'save')} 
                            leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />}
                            className="font-bold uppercase text-[10px] tracking-widest"
                        >
                            PDF
                        </Button>
                        <Button 
                            variant="primary"
                            onClick={() => generateSupplierInvoicePDF(invoice, companySettings ?? {}, 'print')} 
                            leftIcon={<HiOutlinePrinter className="w-4 h-4" />}
                            className="border-none font-bold uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-primary-500/20"
                        >
                            Imprimir
                        </Button>
                    </div>
                </div>

                {/* A4 Paper Document Preview Container */}
                <div className="bg-slate-50 dark:bg-dark-900/50 border border-slate-200 dark:border-dark-700 rounded-xl p-4 sm:p-8 max-h-[60vh] overflow-y-auto">
                    <div 
                        className="w-full mx-auto shadow-lg rounded-lg p-8 sm:p-12 border border-slate-100"
                        style={{ backgroundColor: '#ffffff', color: '#0f172a', pointerEvents: 'none' }}
                    >
                        {/* 1. Header (Logo / Company Info vs Doc Info) */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8 pb-6 border-b border-slate-200">
                            <div className="space-y-2">
                                {companySettings?.logo && (
                                    <img src={companySettings.logo} alt="Logo" className="h-12 object-contain filter grayscale mb-2" />
                                )}
                                <h2 className="text-lg font-black tracking-tight" style={{ color: '#0f172a' }}>{companyName}</h2>
                                <p className="text-[10px] leading-tight" style={{ color: '#475569' }}>
                                    {companyAddress}<br />
                                    {companySettings?.phone && `Tel: ${companySettings.phone}`}
                                    {companySettings?.email && ` • Email: ${companySettings.email}`}
                                </p>
                                <p className="text-[10px] font-black" style={{ color: '#1e293b' }}>
                                    NUIT: {companySettings?.taxId || companySettings?.nuit || 'N/A'}
                                </p>
                            </div>
                            <div className="text-left sm:text-right space-y-1 sm:ml-auto">
                                <h1 className="text-2xl font-black tracking-widest uppercase" style={{ color: '#0f172a' }}>Factura de Compra</h1>
                                <p className="text-xs font-mono font-bold" style={{ color: '#334155' }}>Nº: {invoice.invoiceNumber}</p>
                                <p className="text-[10px]" style={{ color: '#64748b' }}>
                                    Emissão: {format(parseISO(invoice.issueDate), 'dd/MM/yyyy')}<br />
                                    {invoice.dueDate && `Vencimento: ${format(parseISO(invoice.dueDate), 'dd/MM/yyyy')}`}
                                </p>
                            </div>
                        </div>

                        {/* 2. Supplier Info */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 p-4 rounded-lg border border-slate-100" style={{ backgroundColor: '#f8fafc' }}>
                            <div>
                                <h3 className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Fornecedor</h3>
                                <p className="text-xs font-bold" style={{ color: '#0f172a' }}>{invoice.supplier?.name}</p>
                                {invoice.supplier?.phone && (
                                    <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Telefone: {invoice.supplier.phone}</p>
                                )}
                                {invoice.supplier?.nuit && (
                                    <p className="text-[10px]" style={{ color: '#475569' }}>NUIT: {invoice.supplier.nuit}</p>
                                )}
                            </div>
                            <div className="sm:text-right">
                                <h3 className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Estado</h3>
                                <Badge variant={statusCfg.variant} size="sm" className="w-fit text-[9px] uppercase tracking-tighter">
                                    {statusCfg.label}
                                </Badge>
                                {invoice.purchaseOrder?.orderNumber && (
                                    <p className="text-[10px] mt-2 font-mono" style={{ color: '#475569' }}>OC: {invoice.purchaseOrder.orderNumber}</p>
                                )}
                            </div>
                        </div>

                        {/* 3. Items Table */}
                        <table className="w-full print-table mb-8" style={{ backgroundColor: '#ffffff' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                                    <th className="text-left py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Código</th>
                                    <th className="text-left py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Descrição</th>
                                    <th className="text-center py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Qtd</th>
                                    <th className="text-right py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Custo Unit.</th>
                                    <th className="text-right py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>IVA</th>
                                    <th className="text-right py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(invoice.items ?? []).map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                                        <td className="py-2 px-1 text-[10px] font-mono" style={{ color: '#475569' }}>{item.product?.code || '---'}</td>
                                        <td className="py-2 px-1 text-[10px] font-bold uppercase" style={{ color: '#1e293b' }}>{item.product?.name || item.description}</td>
                                        <td className="py-2 px-1 text-[10px] text-center" style={{ color: '#334155' }}>{item.quantity} {item.product?.unit || 'un'}</td>
                                        <td className="py-2 px-1 text-[10px] text-right" style={{ color: '#334155' }}>{formatCurrency(Number(item.unitCost))}</td>
                                        <td className="py-2 px-1 text-[10px] text-right" style={{ color: '#334155' }}>{formatCurrency(Number(item.taxAmount))}</td>
                                        <td className="py-2 px-1 text-[10px] font-bold text-right" style={{ color: '#0f172a' }}>{formatCurrency(Number(item.total))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 4. Totals, Notes, and Payments Grid */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                            <div className="flex-1 w-full space-y-4">
                                {payments.length > 0 && (
                                    <div className="rounded-xl border border-slate-100 p-4" style={{ backgroundColor: '#f8fafc' }}>
                                        <h4 className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Histórico de Pagamentos</h4>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <th className="py-1 text-[8px] font-bold text-slate-400 uppercase">Data</th>
                                                    <th className="py-1 text-[8px] font-bold text-slate-400 uppercase">Método</th>
                                                    <th className="py-1 text-[8px] font-bold text-slate-400 uppercase text-right">Montante</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {payments.map(p => (
                                                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td className="py-1 text-[9px]" style={{ color: '#475569' }}>{format(parseISO(p.paymentDate), 'dd/MM/yyyy')}</td>
                                                        <td className="py-1 text-[9px] font-medium" style={{ color: '#475569' }}>{PAYMENT_METHOD_LABEL[p.method] || p.method}</td>
                                                        <td className="py-1 text-[9px] font-black text-right text-emerald-600">{formatCurrency(Number(p.amount))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {invoice.notes && (
                                    <div className="p-3 rounded-lg border border-slate-100 text-[10px] italic leading-relaxed" style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                                        <strong className="block text-[8px] font-black uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Notas</strong>
                                        {invoice.notes}
                                    </div>
                                )}
                            </div>
                            <div className="w-full md:w-64 md:ml-auto p-4 rounded-xl border border-slate-100" style={{ backgroundColor: '#f8fafc' }}>
                                <div className="flex justify-between items-center text-[10px] mb-1.5" style={{ color: '#475569' }}>
                                    <span>Subtotal:</span>
                                    <span className="font-bold">{formatCurrency(Number(invoice.subtotal))}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] mb-1.5" style={{ color: '#475569' }}>
                                    <span>IVA ({Number(invoice.taxRate)}%):</span>
                                    <span className="font-bold">{formatCurrency(Number(invoice.tax))}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] mb-2" style={{ color: '#475569' }}>
                                    <span>Valor Pago:</span>
                                    <span className="font-bold text-emerald-600">{formatCurrency(Number(invoice.amountPaid))}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                    <span className="text-[10px] font-black uppercase" style={{ color: '#0f172a' }}>Em Dívida:</span>
                                    <span className="text-sm font-black text-amber-600">{formatCurrency(Number(invoice.amountDue))}</span>
                                </div>
                            </div>
                        </div>

                        {/* 5. Signatures area */}
                        <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-slate-100">
                            <div className="text-center">
                                <div className="h-12 border-b border-slate-200" />
                                <span className="text-[8px] font-black uppercase tracking-wider block mt-2" style={{ color: '#64748b' }}>Conformidade (Receção)</span>
                            </div>
                            <div className="text-center">
                                <div className="h-12 border-b border-slate-200" />
                                <span className="text-[8px] font-black uppercase tracking-wider block mt-2" style={{ color: '#64748b' }}>Direção Financeira</span>
                            </div>
                        </div>

                        <div className="text-center text-[7px] font-black uppercase tracking-widest mt-12" style={{ color: '#cbd5e1' }}>
                            Processado por Computador • Multicore ERP
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-dark-700">
                    <Button variant="ghost" onClick={onClose}>Fechar Visualização</Button>
                </div>
            </div>
        </Modal>
    );
}
