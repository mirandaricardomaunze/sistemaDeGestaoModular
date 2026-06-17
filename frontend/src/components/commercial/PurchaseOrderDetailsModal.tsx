import { Button, Modal } from '../ui';
import { HiOutlinePrinter, HiOutlineArrowDownTray } from 'react-icons/hi2';
import { formatCurrency } from '../../utils/helpers';
import { generatePurchaseOrderPDF, type CompanyInfo } from '../../utils/documentGenerator';
import type { PurchaseOrder } from '../../services/api/commercial.api';

interface PurchaseOrderDetailsModalProps {
    order: PurchaseOrder | null;
    companySettings: CompanyInfo | null;
    onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
    draft: 'Rascunho',
    ordered: 'Enviada',
    partial: 'Parcial',
    received: 'Recebida',
    cancelled: 'Cancelada',
};

export function PurchaseOrderDetailsModal({ order, companySettings, onClose }: PurchaseOrderDetailsModalProps) {
    if (!order) return null;

    const companyName = companySettings?.tradeName || companySettings?.companyName || 'Multicore';
    const companyAddress = [
        companySettings?.address,
        companySettings?.city,
        companySettings?.province
    ].filter(Boolean).join(', ') || 'Endereço não configurado';

    return (
        <Modal
            isOpen={!!order}
            onClose={onClose}
            title={`Visualização de Ordem de Compra — ${order.orderNumber}`}
            size="xl"
        >
            <div className="space-y-6">
                {/* Modal Header Actions */}
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-dark-700 pb-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Ordem {order.orderNumber}</p>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">Pré-visualização do Documento</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={() => generatePurchaseOrderPDF(order, companySettings ?? {}, 'save')} 
                            leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />}
                            className="font-bold uppercase text-[10px] tracking-widest"
                        >
                            PDF
                        </Button>
                        <Button 
                            variant="primary"
                            onClick={() => generatePurchaseOrderPDF(order, companySettings ?? {}, 'print')} 
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
                                <h1 className="text-2xl font-black tracking-widest uppercase" style={{ color: '#0f172a' }}>Ordem de Compra</h1>
                                <p className="text-xs font-mono font-bold" style={{ color: '#334155' }}>Nº: {order.orderNumber}</p>
                                <p className="text-[10px]" style={{ color: '#64748b' }}>
                                    Emissão: {new Date(order.createdAt).toLocaleDateString('pt-MZ')}<br />
                                    {order.expectedDeliveryDate && `Entrega esperada: ${new Date(order.expectedDeliveryDate).toLocaleDateString('pt-MZ')}`}
                                </p>
                            </div>
                        </div>

                        {/* 2. Supplier Info */}
                        <div className="mb-8 p-4 rounded-lg border border-slate-100" style={{ backgroundColor: '#f8fafc' }}>
                            <h3 className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Dados do Fornecedor</h3>
                            <p className="text-xs font-bold" style={{ color: '#0f172a' }}>{order.supplier?.name}</p>
                            {order.supplier?.phone && order.supplier?.phone !== '---' && (
                                <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Telefone: {order.supplier.phone}</p>
                            )}
                            <p className="text-[10px]" style={{ color: '#475569' }}>Estado do Pedido: <span className="font-bold">{STATUS_LABELS[order.status]}</span></p>
                        </div>

                        {/* 3. Items Table */}
                        <table className="w-full print-table mb-8" style={{ backgroundColor: '#ffffff' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                                    <th className="text-left py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Código</th>
                                    <th className="text-left py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Descrição</th>
                                    <th className="text-center py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Qtd</th>
                                    <th className="text-right py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Custo Unit.</th>
                                    <th className="text-right py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(order.items ?? []).map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                                        <td className="py-2 px-1 text-[10px] font-mono" style={{ color: '#475569' }}>{item.product?.code || '---'}</td>
                                        <td className="py-2 px-1 text-[10px] font-bold uppercase" style={{ color: '#1e293b' }}>{item.product?.name}</td>
                                        <td className="py-2 px-1 text-[10px] text-center" style={{ color: '#334155' }}>{item.quantity} {item.product?.unit || 'un'}</td>
                                        <td className="py-2 px-1 text-[10px] text-right" style={{ color: '#334155' }}>{formatCurrency(Number(item.unitCost))}</td>
                                        <td className="py-2 px-1 text-[10px] font-bold text-right" style={{ color: '#0f172a' }}>{formatCurrency(Number(item.total))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 4. Totals and Notes Grid */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                            <div className="flex-1 w-full max-w-md">
                                {order.notes && (
                                    <div className="p-3 rounded-lg border border-slate-100 text-[10px] italic leading-relaxed" style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                                        <strong className="block text-[8px] font-black uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Notas e Observações</strong>
                                        {order.notes}
                                    </div>
                                )}
                            </div>
                            <div className="w-full md:w-64 md:ml-auto p-4 rounded-xl border border-slate-100" style={{ backgroundColor: '#f8fafc' }}>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[10px] font-black uppercase" style={{ color: '#0f172a' }}>Total:</span>
                                    <span className="text-sm font-black" style={{ color: '#0ea5e9' }}>{formatCurrency(Number(order.total))}</span>
                                </div>
                            </div>
                        </div>

                        {/* 5. Signatures area */}
                        <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-slate-100">
                            <div className="text-center">
                                <div className="h-12 border-b border-slate-200" />
                                <span className="text-[8px] font-black uppercase tracking-wider block mt-2" style={{ color: '#64748b' }}>Responsável pela Ordem</span>
                            </div>
                            <div className="text-center">
                                <div className="h-12 border-b border-slate-200" />
                                <span className="text-[8px] font-black uppercase tracking-wider block mt-2" style={{ color: '#64748b' }}>Carimbo e Aprovação</span>
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
