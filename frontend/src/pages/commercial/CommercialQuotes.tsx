import { useState, useCallback } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Quotation } from '../../services/api/commercial.api';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineDocumentText, HiOutlinePlus,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock,
    HiOutlineEye, HiOutlinePaperAirplane, HiOutlineArrowRight,
    HiOutlinePrinter, HiOutlineTrash, HiOutlineArrowDownTray
} from 'react-icons/hi2';
import { Badge, Button, Input, Select, Textarea, Modal, SmartTable, PageHeader } from '../../components/ui';
import { ProductSearchInput, type ProductOption } from '../../components/commercial/ProductSearchInput';
import { CustomerSearchInput, type CustomerOption } from '../../components/commercial/CustomerSearchInput';
import { formatCurrency, cn } from '../../utils/helpers';
import { generateQuotationPDF, generateQuotationsListPDF, type CompanyInfo } from '../../utils/documentGenerator';
import { useQuotations } from '../../hooks/useCommercial';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { ordersAPI } from '../../services/api';
import { commercialAPI } from '../../services/api/commercial.api';
import { getDocumentWorkflow, type WorkflowTransitions } from '../../hooks/commercial/useDocumentWorkflow';
import toast from 'react-hot-toast';
import { PAGE_SIZE } from '../../utils/constants';

import { MetricCard } from '../../components/common/ModuleMetricCard';

// ── Status display ────────────────────────────────────────────────────────────

const QUOTE_STATUS = {
    created:   { label: 'Rascunho',   variant: 'gray'    as const, icon: HiOutlineDocumentText,  color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-50/50   dark:bg-gray-500/10' },
    printed:   { label: 'Enviada',    variant: 'info'    as const, icon: HiOutlinePaperAirplane,  color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50/50   dark:bg-blue-500/10' },
    separated: { label: 'Aceite',     variant: 'success' as const, icon: HiOutlineCheckCircle,    color: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-50/50  dark:bg-emerald-500/10' },
    completed: { label: 'Facturada',  variant: 'primary' as const, icon: HiOutlineArrowRight,     color: 'text-primary-600 dark:text-primary-400',bg: 'bg-primary-50/50 dark:bg-primary-500/10' },
    cancelled: { label: 'Cancelada',  variant: 'danger'  as const, icon: HiOutlineXCircle,        color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50/50    dark:bg-red-500/10' },
} as const;

type QuoteStatus = keyof typeof QUOTE_STATUS;
type QuoteAction = QuoteStatus | 'sale' | 'invoice';

// Actions available per status
const QUOTE_TRANSITIONS: WorkflowTransitions<QuoteStatus> = {
    created:   [{ next: 'sale',      label: 'Converter em Venda', variant: 'primary', icon: <HiOutlineArrowRight     className="w-3.5 h-3.5" /> },
                { next: 'printed',   label: 'Marcar Enviada',     variant: 'ghost',   icon: <HiOutlinePaperAirplane  className="w-3.5 h-3.5" /> },
                { next: 'cancelled', label: 'Cancelar',           variant: 'danger',  icon: <HiOutlineXCircle        className="w-3.5 h-3.5" /> }],
    printed:   [{ next: 'sale',      label: 'Converter em Venda', variant: 'primary', icon: <HiOutlineArrowRight     className="w-3.5 h-3.5" /> },
                { next: 'separated', label: 'Marcar Aceite',      variant: 'success', icon: <HiOutlineCheckCircle    className="w-3.5 h-3.5" /> },
                { next: 'cancelled', label: 'Cancelar',           variant: 'danger',  icon: <HiOutlineXCircle        className="w-3.5 h-3.5" /> }],
    separated: [{ next: 'sale',    label: 'Vender (PDV)',         variant: 'primary', icon: <HiOutlineArrowRight     className="w-3.5 h-3.5" /> },
                { next: 'invoice', label: 'Gerar Factura',        variant: 'success', icon: <HiOutlineDocumentText   className="w-3.5 h-3.5" /> }],
    completed: [],
    cancelled: [],
};

type SaleUnit = 'box' | 'unit';
type LineItem = { product: ProductOption | null; quantity: number; price: number; saleUnit: SaleUnit };
type QuotationDetailsItem = Quotation['items'][number] & {
    barcode?: string | null;
    product?: { barcode?: string | null } | null;
};
type QuotationDetails = Omit<Quotation, 'items'> & {
    items: QuotationDetailsItem[];
};

// ── CreateQuoteModal ──────────────────────────────────────────────────────────

interface CreateQuoteModalProps { onClose: () => void; onSuccess: () => void }

function CreateQuoteModal({ onClose, onSuccess }: CreateQuoteModalProps) {
    const [customer, setCustomer]       = useState<CustomerOption | null>(null);
    const [manualName, setManualName]   = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [validUntil, setValidUntil]   = useState('');
    const [notes, setNotes]             = useState('');
    const [lines, setLines]             = useState<LineItem[]>([{ product: null, quantity: 1, price: 0, saleUnit: 'box' }]);
    const [saving, setSaving]           = useState(false);

    const { settings } = useCompanySettings();
    const ivaRate = settings?.ivaRate || 16;

    const addLine    = () => setLines(p => [...p, { product: null, quantity: 1, price: 0, saleUnit: 'box' }]);
    const removeLine = (i: number) => setLines(p => p.filter((_, idx) => idx !== i));

    const updateLine = useCallback(<K extends keyof LineItem>(i: number, k: K, v: LineItem[K]) =>
        setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l)), []);

    const handleProductSelect = useCallback((i: number, product: ProductOption) => {
        setLines(p => p.map((l, idx) =>
            idx === i ? { ...l, product, price: product.price, saleUnit: 'box' } : l
        ));
    }, []);

    const toggleSaleUnit = useCallback((i: number, next: SaleUnit) => {
        setLines(p => p.map((l, idx) => {
            if (idx !== i || !l.product) return l;
            const packSize = Math.max(1, Number(l.product.packSize) || 1);
            const nextPrice = next === 'unit' ? l.product.price / packSize : l.product.price;
            return { ...l, saleUnit: next, price: Number(nextPrice.toFixed(2)) };
        }));
    }, []);

    const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0);
    const ivaValue = subtotal * (ivaRate / 100);
    const grandTotal = subtotal + ivaValue;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer && !manualName.trim()) return toast.error('Preencha o nome do cliente ou seleccione um cliente registado');
        const valid = lines.filter(l => l.product && l.quantity > 0);
        if (!valid.length) return toast.error('Adicione pelo menos um produto');

        setSaving(true);
        try {
            const finalCustomerName = customer?.name || manualName || 'Consumidor Final';
            const finalCustomerPhone = customer?.phone || manualPhone || '---';

            await commercialAPI.createQuotation({
                customerName:  finalCustomerName,
                customerPhone: finalCustomerPhone,
                customerEmail: customer?.email,
                customerId:    customer?.id,
                validUntil,
                notes,
                items: valid.map(l => ({
                    productId:   l.product!.id,
                    productName: l.saleUnit === 'unit'
                        ? `${l.product!.name} (un)`
                        : l.product!.name,
                    quantity:    l.quantity,
                    price:       l.price,
                    barcode:     l.product!.barcode,
                })),
            });
            toast.success('Cotação criada com sucesso!');
            onSuccess();
            onClose();
        } catch {
            toast.error('Erro ao criar cotação');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title="Nova Cotação" size="xl">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Customer + validity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <CustomerSearchInput
                            label="Cliente Registado (opcional)"
                            onSelect={setCustomer}
                            selectedCustomer={customer}
                            clearable
                            size="sm"
                        />
                        {!customer && (
                            <div className="space-y-1">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    — ou preencha manualmente —
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Input
                                        label="Nome do Cliente *"
                                        placeholder="Ex: Manuel Silva"
                                        size="sm"
                                        value={manualName}
                                        onChange={e => setManualName(e.target.value)}
                                    />
                                    <Input
                                        label="Telefone"
                                        placeholder="+258 84 000 0000"
                                        size="sm"
                                        value={manualPhone}
                                        onChange={e => setManualPhone(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <Input
                        label="Válida até"
                        type="date"
                        size="sm"
                        value={validUntil}
                        onChange={e => setValidUntil(e.target.value)}
                    />
                </div>

                {/* Products */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Produtos / Serviços
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addLine}
                            className="px-3 text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                            <HiOutlinePlus className="w-3.5 h-3.5" /> Adicionar linha
                        </Button>
                    </div>

                    <div className="space-y-4 overflow-visible">
                        {lines.map((line, i) => (
                            <div key={i}
                                style={{ zIndex: (lines.length - i) * 10 }}
                                className="relative overflow-visible grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-700/30">
                                <div className="col-span-12 sm:col-span-5">
                                    <ProductSearchInput
                                        label={i === 0 ? 'Produto' : undefined}
                                        originModule="commercial"
                                        onSelect={p => handleProductSelect(i, p)}
                                        selectedProduct={line.product}
                                        placeholder="Pesquisar produto..."
                                        showStock={false}
                                        size="sm"
                                    />
                                </div>
                                <div className="col-span-5 sm:col-span-2">
                                    {i === 0 && (
                                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo</label>
                                    )}
                                    <div className="flex min-h-11 sm:min-h-10 rounded-md border border-gray-200 dark:border-dark-600 overflow-hidden">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleSaleUnit(i, 'box')}
                                            disabled={!line.product}
                                            className={cn(
                                                "flex-1 rounded-none text-[11px] font-bold uppercase tracking-wider disabled:opacity-50",
                                                line.saleUnit === 'box'
                                                    ? "bg-primary-500 text-white"
                                                    : "bg-white dark:bg-dark-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-600"
                                            )}
                                        >
                                            Cx
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleSaleUnit(i, 'unit')}
                                            disabled={!line.product || !line.product.packSize || line.product.packSize <= 1}
                                            className={cn(
                                                "flex-1 rounded-none text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed",
                                                line.saleUnit === 'unit'
                                                    ? "bg-primary-500 text-white"
                                                    : "bg-white dark:bg-dark-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-600"
                                            )}
                                        >
                                            Un
                                        </Button>
                                    </div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <Input
                                        label={i === 0 ? 'Qtd' : undefined}
                                        size="sm" type="number" min="1"
                                        value={line.quantity}
                                        onChange={e => updateLine(i, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-3">
                                    <Input
                                        label={i === 0 ? (line.saleUnit === 'unit' ? 'Preço/un' : 'Preço/cx') : undefined}
                                        size="sm" type="number" min="0" step="0.01"
                                        value={line.price}
                                        onChange={e => updateLine(i, 'price', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="col-span-1 sm:col-span-1 flex justify-center pb-0.5">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)}
                                        disabled={lines.length === 1}
                                        className="w-10 p-0 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <HiOutlineXCircle className="w-5 h-5" />
                                    </Button>
                                </div>
                                {line.product && (
                                    <p className="col-span-12 text-right text-xs text-gray-500 -mt-1">
                                        {line.saleUnit === 'unit'
                                            ? `${line.quantity} un × ${formatCurrency(line.price)}`
                                            : `${line.quantity} cx × ${formatCurrency(line.price)}`}
                                        {' · Subtotal: '}<strong>{formatCurrency(line.quantity * line.price)}</strong>
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <Textarea label="Notas / Condições" rows={2}
                    placeholder="Condições de pagamento, prazo de entrega, validade..."
                    value={notes} onChange={e => setNotes(e.target.value)} />

                <div className="flex flex-col md:flex-row items-center justify-between pt-4 border-t border-gray-100 dark:border-dark-700 gap-4">
                    <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-3 md:flex gap-6">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Subtotal</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(subtotal)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">IVA ({ivaRate}%)</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(ivaValue)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-primary-500 uppercase font-bold tracking-wider">Total Final</p>
                            <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(grandTotal)}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                        <Button variant="primary" type="submit" isLoading={saving}>Criar Cotação</Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

// ── QuoteDetailsModal (reusable) ─────────────────────────────────────────────

interface QuoteDetailsModalProps {
    quote: QuotationDetails | null;
    ivaRate: number;
    companySettings: CompanyInfo | null;
    onClose: () => void;
}

function QuoteDetailsModal({ quote, ivaRate, companySettings, onClose }: QuoteDetailsModalProps) {
    if (!quote) return null;
    const subtotal = (quote.items || []).reduce(
        (s, i) => s + Number(i.price) * Number(i.quantity), 0
    );
    const ivaValue = subtotal * (ivaRate / 100);
    const total = subtotal + ivaValue;

    const companyName = companySettings?.tradeName || companySettings?.companyName || 'Multicore';
    const companyAddress = [
        companySettings?.address,
        companySettings?.city,
        companySettings?.province
    ].filter(Boolean).join(', ') || 'Endereço não configurado';

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Visualização de Cotação — ${quote.orderNumber}`}
            size="xl"
        >
            <div className="space-y-6">
                {/* Modal Header Actions */}
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-dark-700 pb-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em]">Cotação {quote.orderNumber}</p>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">Pré-visualização do Documento</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => generateQuotationPDF(quote, companySettings ?? {}, 'save')}
                            leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />}
                            className="font-bold uppercase text-[10px] tracking-widest"
                        >
                            PDF
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => generateQuotationPDF(quote, companySettings ?? {}, 'print')}
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
                                <h1 className="text-2xl font-black tracking-widest uppercase" style={{ color: '#0f172a' }}>Cotação</h1>
                                <p className="text-xs font-mono font-bold" style={{ color: '#334155' }}>Nº: {quote.orderNumber}</p>
                                <p className="text-[10px]" style={{ color: '#64748b' }}>
                                    Emissão: {new Date(quote.createdAt).toLocaleDateString('pt-MZ')}<br />
                                    {quote.deliveryDate && `Válida até: ${new Date(quote.deliveryDate).toLocaleDateString('pt-MZ')}`}
                                </p>
                            </div>
                        </div>

                        {/* 2. Customer Info */}
                        <div className="mb-8 p-4 rounded-lg border border-slate-100" style={{ backgroundColor: '#f8fafc' }}>
                            <h3 className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Dados do Cliente</h3>
                            <p className="text-xs font-bold" style={{ color: '#0f172a' }}>{quote.customerName}</p>
                            {quote.customerPhone && quote.customerPhone !== '---' && (
                                <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Telefone: {quote.customerPhone}</p>
                            )}
                        </div>

                        {/* 3. Items Table */}
                        <table className="w-full print-table mb-8" style={{ backgroundColor: '#ffffff' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                                    <th className="text-left py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Código</th>
                                    <th className="text-left py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Descrição</th>
                                    <th className="text-center py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Qtd</th>
                                    <th className="text-right py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Preço Unit.</th>
                                    <th className="text-right py-2 px-1 text-[9px] font-black uppercase tracking-wider" style={{ color: '#475569' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(quote.items ?? []).map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                                        <td className="py-2 px-1 text-[10px] font-mono" style={{ color: '#475569' }}>{item.barcode || '---'}</td>
                                        <td className="py-2 px-1 text-[10px] font-bold uppercase" style={{ color: '#1e293b' }}>{item.productName}</td>
                                        <td className="py-2 px-1 text-[10px] text-center" style={{ color: '#334155' }}>{item.quantity}</td>
                                        <td className="py-2 px-1 text-[10px] text-right" style={{ color: '#334155' }}>{formatCurrency(Number(item.price))}</td>
                                        <td className="py-2 px-1 text-[10px] font-bold text-right" style={{ color: '#0f172a' }}>{formatCurrency(Number(item.total))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 4. Totals and Notes Grid */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                            <div className="flex-1 w-full max-w-md">
                                {quote.notes && (
                                    <div className="p-3 rounded-lg border border-slate-100 text-[10px] italic leading-relaxed" style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                                        <strong className="block text-[8px] font-black uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Notas e Condições</strong>
                                        {quote.notes}
                                    </div>
                                )}
                            </div>
                            <div className="w-full md:w-64 md:ml-auto p-4 rounded-xl border border-slate-100" style={{ backgroundColor: '#f8fafc' }}>
                                <div className="flex justify-between items-center text-[10px] mb-1.5" style={{ color: '#475569' }}>
                                    <span>Subtotal:</span>
                                    <span className="font-bold">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] mb-2" style={{ color: '#475569' }}>
                                    <span>IVA ({ivaRate}%):</span>
                                    <span className="font-bold">{formatCurrency(ivaValue)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                    <span className="text-[10px] font-black uppercase" style={{ color: '#0f172a' }}>Total:</span>
                                    <span className="text-sm font-black" style={{ color: '#0ea5e9' }}>{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* 5. Signatures area */}
                        <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-slate-100">
                            <div className="text-center">
                                <div className="h-12 border-b border-slate-200" />
                                <span className="text-[8px] font-black uppercase tracking-wider block mt-2" style={{ color: '#64748b' }}>Assinatura do Cliente</span>
                            </div>
                            <div className="text-center">
                                <div className="h-12 border-b border-slate-200" />
                                <span className="text-[8px] font-black uppercase tracking-wider block mt-2" style={{ color: '#64748b' }}>Carimbo e Autorização</span>
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

// ── Main Page ────────────────────────────────────────────────────────────────-

export default function CommercialQuotes() {
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch]             = useState('');
    const [page, setPage]                 = useState(1);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewingQuote, setViewingQuote]       = useState<QuotationDetails | null>(null);
    const [converting, setConverting]           = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [quoteToDelete, setQuoteToDelete]     = useState<string | null>(null);
    const [deleting, setDeleting]               = useState(false);
    const { settings: companySettings }         = useCompanySettings();

    // Server-side filtered + paginated quotations via /commercial/quotations
    const { quotes, pagination, isLoading, refetch } = useQuotations({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
    });

    const handleStatusUpdate = async (id: string, next: QuoteAction) => {
        if (next === 'sale') {
            const quote = quotes.find((q) => q.id === id);
            if (quote) navigate('/commercial/pos', { state: { fromQuote: quote } });
            return;
        }
        if (next === 'invoice') {
            setConverting(id);
            try {
                await commercialAPI.convertQuotationToInvoice(id);
                toast.success('Cotação convertida a factura!');
                refetch();
            } catch {
                toast.error('Erro ao converter cotação');
            } finally {
                setConverting(null);
            }
            return;
        }
        try {
            await ordersAPI.updateStatus(id, { status: next });
            toast.success('Estado actualizado!');
            refetch();
        } catch {
            toast.error('Erro ao actualizar estado');
        }
    };

    const handleDeleteRequest = (id: string) => {
        setQuoteToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!quoteToDelete) return;
        setDeleting(true);
        try {
            await ordersAPI.delete(quoteToDelete);
            toast.success('Cotação eliminada!');
            setDeleteModalOpen(false);
            setQuoteToDelete(null);
            refetch();
        } catch {
            toast.error('Erro ao eliminar');
        } finally {
            setDeleting(false);
        }
    };

    const handleFilterChange = (val: string) => { setStatusFilter(val); setPage(1); };
    const handleSearchChange = (val: string)  => { setSearch(val);       setPage(1); };

    const statusOptions = [
        { value: '', label: 'Todos os estados' },
        ...Object.entries(QUOTE_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
    ];

    const columns: ColumnDef<Quotation>[] = [
        {
            accessorKey: 'orderNumber',
            header: 'Nº COTAÇÃO',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        {row.original.orderNumber}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                        {new Date(row.original.createdAt).toLocaleDateString('pt-MZ')}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'customerName',
            header: 'CLIENTE',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    <span className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight truncate max-w-[200px]">
                        {row.original.customerName}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'total',
            header: 'TOTAL',
            cell: ({ row }) => (
                <span className="font-black text-primary-600 dark:text-primary-400">
                    {formatCurrency(Number(row.original.total))}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'ESTADO',
            cell: ({ row }) => {
                const { config: cfg } = getDocumentWorkflow(row.original.status as QuoteStatus, QUOTE_STATUS, QUOTE_TRANSITIONS, 'created');
                return (
                    <Badge variant={cfg.variant} size="sm" className="font-black text-[9px] uppercase tracking-widest">
                        {cfg.label}
                    </Badge>
                );
            }
        },
        {
            id: 'actions',
            header: 'ACÇÕES',
            cell: ({ row }) => {
                const quote = row.original;
                const { transitions: actions } = getDocumentWorkflow(quote.status as QuoteStatus, QUOTE_STATUS, QUOTE_TRANSITIONS, 'created');
                
                return (
                    <div className="flex items-center gap-2">
                        {actions.map(action => (
                            <Button
                                key={action.next}
                                size="xs"
                                variant={action.variant === 'ghost' ? 'outline' : action.variant}
                                className="text-[10px] font-black uppercase tracking-widest"
                                leftIcon={action.icon}
                                isLoading={converting === quote.id && action.next === 'invoice'}
                                onClick={() => handleStatusUpdate(quote.id, action.next as QuoteAction)}
                            >
                                {action.label}
                            </Button>
                        ))}

                        {quote.status === 'created' && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="p-1.5 h-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => handleDeleteRequest(quote.id)}
                            >
                                <HiOutlineTrash className="w-4 h-4" />
                            </Button>
                        )}

                        <Button
                            size="sm"
                            variant="ghost"
                            className="p-1.5 h-auto text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                            onClick={() => setViewingQuote(quote)}
                            title="Ver detalhes"
                        >
                            <HiOutlineEye className="w-4 h-4" />
                        </Button>

                        <Button
                            size="sm"
                            variant="ghost"
                            className="p-1.5 h-auto text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            onClick={() => generateQuotationPDF(quote, companySettings ?? {}, 'print')}
                            title="Imprimir Cotação"
                        >
                            <HiOutlinePrinter className="w-4 h-4" />
                        </Button>

                        <Button
                            size="sm"
                            variant="ghost"
                            className="p-1.5 h-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => generateQuotationPDF(quote, companySettings ?? {}, 'save')}
                            title="Exportar PDF"
                        >
                            <HiOutlineArrowDownTray className="w-4 h-4" />
                        </Button>
                    </div>
                );
            }
        }
    ];

    const totalQuotes   = pagination?.total ?? quotes.length;
    const totalValue    = quotes.reduce((s, q) => s + Number(q.total), 0);
    const acceptedValue = quotes.filter((q) => q.status === 'separated').reduce((s, q) => s + Number(q.total), 0);

    const statusLabelOf = (s: string) => QUOTE_STATUS[s as QuoteStatus]?.label ?? s;

    const handleExportPDF = () => {
        if (!quotes.length) return toast.error('Sem cotações para exportar');
        generateQuotationsListPDF(quotes, companySettings ?? {}, statusLabelOf, 'save');
    };

    const handlePrintList = () => {
        if (!quotes.length) return toast.error('Sem cotações para imprimir');
        generateQuotationsListPDF(quotes, companySettings ?? {}, statusLabelOf, 'print');
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Cotações"
                subtitle="Gestão de propostas comerciais, aprovações e conversão em vendas."
                icon={<HiOutlineDocumentText />}
                actions={
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowCreateModal(true)}
                        className="w-full justify-center font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20 sm:w-auto"
                        leftIcon={<HiOutlinePlus className="w-4 h-4 text-white" />}
                    >
                        Nova Cotação
                    </Button>
                }
            />

            {/* Summary Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                    icon={<HiOutlineDocumentText className="w-5 h-5" />}
                    color="blue"
                    label="Total Cotações"
                    value={totalQuotes}
                />
                <MetricCard 
                    icon={<HiOutlineClock className="w-5 h-5" />}
                    color="amber"
                    label="Pendentes"
                    value={quotes.filter((q) => ['created','printed'].includes(q.status)).length}
                />
                <MetricCard 
                    icon={<HiOutlinePlus className="w-5 h-5" />}
                    color="primary"
                    label="Valor Total"
                    value={formatCurrency(totalValue)}
                />
                <MetricCard 
                    icon={<HiOutlineCheckCircle className="w-5 h-5" />}
                    color="emerald"
                    label="Aceites"
                    value={formatCurrency(acceptedValue)}
                />
            </div>

            {/* Toolbar: Print + Export */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 [&>*]:w-full sm:[&>*]:w-auto">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePrintList}
                    className="w-full sm:w-auto flex items-center justify-center"
                    leftIcon={<HiOutlinePrinter className="w-4 h-4" />}
                >
                    Imprimir
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExportPDF}
                    className="w-full sm:w-auto flex items-center justify-center"
                    leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />}
                >
                    Exportar PDF
                </Button>
            </div>

            {/* List with SmartTable */}
            <SmartTable
                data={quotes}
                columns={columns}
                isLoading={isLoading}
                pagination={{
                    currentPage: page,
                    totalItems: pagination?.total || 0,
                    itemsPerPage: PAGE_SIZE,
                    onPageChange: setPage
                }}
                search={{
                    value: search,
                    onChange: handleSearchChange,
                    placeholder: "Pesquisar por número ou cliente..."
                }}
                renderFilters={
                    <div className="w-full sm:w-44">
                        <Select 
                            options={statusOptions} 
                            value={statusFilter}
                            onChange={e => handleFilterChange(e.target.value)} 
                            size="sm"
                            className="w-full bg-white dark:bg-dark-800"
                        />
                    </div>
                }
                onRefresh={refetch}
                mobileCardRender={(quote) => {
                    const { config: cfg, transitions: actions } = getDocumentWorkflow(quote.status as QuoteStatus, QUOTE_STATUS, QUOTE_TRANSITIONS, 'created');
                    return (
                        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-4">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                                        <HiOutlineDocumentText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight truncate">
                                            {quote.orderNumber}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            {new Date(quote.createdAt).toLocaleDateString('pt-MZ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <Badge variant={cfg.variant} size="sm" className="font-black text-[9px] uppercase tracking-widest">
                                        {cfg.label}
                                    </Badge>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="bg-gray-50 dark:bg-dark-900/50 p-3 rounded-lg border border-gray-100 dark:border-dark-700">
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Cliente</p>
                                <p className="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase">{quote.customerName}</p>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Total</span>
                                <span className="text-lg font-black text-primary-600 dark:text-primary-400">
                                    {formatCurrency(Number(quote.total))}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingQuote(quote)}
                                    className="p-2 rounded-lg bg-gray-50 dark:bg-dark-900/30 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-dark-700 font-black tracking-widest text-[10px] uppercase"
                                >
                                    <HiOutlineEye className="w-4 h-4 mr-2" /> Detalhes
                                </Button>
                                {actions.map(action => (
                                    <Button
                                        key={action.next}
                                        variant={action.variant === 'ghost' ? 'outline' : action.variant}
                                        size="sm"
                                        isLoading={converting === quote.id && action.next === 'invoice'}
                                        onClick={() => handleStatusUpdate(quote.id, action.next as QuoteAction)}
                                        className="p-2 rounded-lg font-black tracking-widest text-[10px] uppercase"
                                        leftIcon={action.icon}
                                    >
                                        {action.label}
                                    </Button>
                                ))}
                                {quote.status === 'created' && (
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleDeleteRequest(quote.id)}
                                        className="p-2 rounded-lg font-black tracking-widest text-[10px] uppercase"
                                    >
                                        <HiOutlineTrash className="w-4 h-4 mr-2" /> Eliminar
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => generateQuotationPDF(quote, companySettings ?? {}, 'print')}
                                    className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 font-black tracking-widest text-[10px] uppercase col-span-2"
                                >
                                    <HiOutlinePrinter className="w-4 h-4 mr-2" /> Imprimir Documento
                                </Button>
                            </div>
                        </div>
                    );
                }}
            />

            {showCreateModal && (
                <CreateQuoteModal onClose={() => setShowCreateModal(false)} onSuccess={refetch} />
            )}

            <QuoteDetailsModal
                quote={viewingQuote}
                ivaRate={companySettings?.ivaRate || 16}
                companySettings={companySettings}
                onClose={() => setViewingQuote(null)}
            />

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setQuoteToDelete(null); }}
                title="Eliminar Cotação"
                size="sm"
            >
                <div className="space-y-4 py-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tem a certeza que deseja eliminar esta cotação? Esta acção é irreversível.
                    </p>
                    <div className="flex gap-3 justify-end pt-2">
                        <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setQuoteToDelete(null); }}>
                            Cancelar
                        </Button>
                        <Button variant="danger" isLoading={deleting} onClick={handleDeleteConfirm}>
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
