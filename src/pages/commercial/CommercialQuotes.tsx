import { useState, useCallback } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineDocumentText, HiOutlinePlus,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock,
    HiOutlineEye, HiOutlinePaperAirplane, HiOutlineArrowRight,
    HiOutlinePrinter, HiOutlineTrash, HiOutlineArrowDownTray
} from 'react-icons/hi2';
import { Badge, Button, Input, Select, Textarea, Modal, SmartTable } from '../../components/ui';
import { ProductSearchInput, type ProductOption } from '../../components/commercial/ProductSearchInput';
import { CustomerSearchInput, type CustomerOption } from '../../components/commercial/CustomerSearchInput';
import { formatCurrency, cn } from '../../utils/helpers';
import { generateQuotationPDF, generateQuotationsListPDF } from '../../utils/documentGenerator';
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
        <Modal isOpen onClose={onClose} title="Nova Cotação / Orçamento" size="xl">
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
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        label="Nome do Cliente *"
                                        placeholder="Ex: Manuel Silva"
                                        size="sm"
                                        value={manualName}
                                        onChange={e => setManualName(e.target.value)}
                                    />
                                    <Input
                                        label="Telefone"
                                        placeholder="840000000"
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
                        <button type="button" onClick={addLine}
                            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
                            <HiOutlinePlus className="w-3.5 h-3.5" /> Adicionar linha
                        </button>
                    </div>

                    <div className="space-y-4 overflow-visible">
                        {lines.map((line, i) => (
                            <div key={i}
                                style={{ zIndex: (lines.length - i) * 10 }}
                                className="relative overflow-visible grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-700/30">
                                <div className="col-span-5">
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
                                <div className="col-span-2">
                                    {i === 0 && (
                                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo</label>
                                    )}
                                    <div className="flex rounded-md border border-gray-200 dark:border-dark-600 overflow-hidden h-[34px]">
                                        <button
                                            type="button"
                                            onClick={() => toggleSaleUnit(i, 'box')}
                                            disabled={!line.product}
                                            className={cn(
                                                "flex-1 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
                                                line.saleUnit === 'box'
                                                    ? "bg-primary-500 text-white"
                                                    : "bg-white dark:bg-dark-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-600"
                                            )}
                                        >
                                            Cx
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleSaleUnit(i, 'unit')}
                                            disabled={!line.product || !line.product.packSize || line.product.packSize <= 1}
                                            className={cn(
                                                "flex-1 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                                line.saleUnit === 'unit'
                                                    ? "bg-primary-500 text-white"
                                                    : "bg-white dark:bg-dark-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-600"
                                            )}
                                        >
                                            Un
                                        </button>
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <Input
                                        label={i === 0 ? 'Qtd' : undefined}
                                        size="sm" type="number" min="1"
                                        value={line.quantity}
                                        onChange={e => updateLine(i, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Input
                                        label={i === 0 ? (line.saleUnit === 'unit' ? 'Preço/un' : 'Preço/cx') : undefined}
                                        size="sm" type="number" min="0" step="0.01"
                                        value={line.price}
                                        onChange={e => updateLine(i, 'price', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="col-span-1 flex justify-center pb-0.5">
                                    <button type="button" onClick={() => removeLine(i)}
                                        disabled={lines.length === 1}
                                        className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                        <HiOutlineXCircle className="w-5 h-5" />
                                    </button>
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
                    <div className="w-full md:w-auto grid grid-cols-3 md:flex gap-6">
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
    quote: any | null;
    ivaRate: number;
    onClose: () => void;
}

function QuoteDetailsModal({ quote, ivaRate, onClose }: QuoteDetailsModalProps) {
    if (!quote) return null;
    const subtotal = (quote.items || []).reduce(
        (s: number, i: any) => s + Number(i.price) * Number(i.quantity), 0
    );
    const ivaValue = subtotal * (ivaRate / 100);

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Cotação ${quote.orderNumber} — ${quote.customerName}`}
            size="xl"
        >
            <div className="space-y-5">
                <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Itens da Cotação</h4>
                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-dark-700/50 text-gray-400">
                                    <th className="text-left p-3 font-black uppercase tracking-widest">Produto</th>
                                    <th className="text-left p-3 font-black uppercase tracking-widest">Cód. Barra</th>
                                    <th className="text-right p-3 font-black uppercase tracking-widest">Qtd</th>
                                    <th className="text-right p-3 font-black uppercase tracking-widest">Preço</th>
                                    <th className="text-right p-3 font-black uppercase tracking-widest">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(quote.items ?? []).map((item: any) => (
                                    <tr key={item.id} className="border-t border-gray-50 dark:border-dark-700/50">
                                        <td className="p-3 font-bold text-gray-700 dark:text-gray-300 uppercase">{item.productName}</td>
                                        <td className="p-3 text-gray-500">{item.barcode || item.product?.barcode || '---'}</td>
                                        <td className="p-3 text-right text-gray-500">{item.quantity}</td>
                                        <td className="p-3 text-right text-gray-500">{formatCurrency(Number(item.price))}</td>
                                        <td className="p-3 text-right font-black text-gray-900 dark:text-white">{formatCurrency(Number(item.total))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Informações Adicionais</h4>
                    <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-dark-900/30 border border-gray-100 dark:border-dark-700 space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Data de Emissão:</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                                {new Date(quote.createdAt).toLocaleDateString('pt-MZ')}
                            </span>
                        </div>
                        {quote.deliveryDate && (
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Válida até:</span>
                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                    {new Date(quote.deliveryDate).toLocaleDateString('pt-MZ')}
                                </span>
                            </div>
                        )}
                        <div className="pt-2 mt-2 border-t border-gray-100 dark:border-dark-700 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Subtotal:</span>
                                <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">IVA ({ivaRate}%):</span>
                                <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(ivaValue)}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-1 border-t border-gray-100 dark:border-dark-700/50">
                                <span className="text-gray-400 font-bold">Total Final:</span>
                                <span className="font-black text-primary-600 dark:text-primary-400">
                                    {formatCurrency(Number(quote.total))}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {(quote.notes ?? '').trim() && (
                    <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Observações</h4>
                        <div className="p-3 rounded-lg bg-primary-50/30 dark:bg-primary-900/10 border border-primary-100/30 dark:border-primary-500/10 text-[11px] text-gray-600 dark:text-gray-400 italic">
                            {quote.notes}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <Button variant="ghost" onClick={onClose}>Fechar</Button>
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
    const [viewingQuote, setViewingQuote]       = useState<any | null>(null);
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

    const handleStatusUpdate = async (id: string, next: string) => {
        if (next === 'sale') {
            const quote = quotes.find((q: any) => q.id === id);
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
            await ordersAPI.updateStatus(id, { status: next as any });
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

    const columns: ColumnDef<any>[] = [
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
                                onClick={() => handleStatusUpdate(quote.id, action.next)}
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
                            onClick={() => generateQuotationPDF(quote, companySettings, 'print')}
                            title="Imprimir Cotação"
                        >
                            <HiOutlinePrinter className="w-4 h-4" />
                        </Button>

                        <Button
                            size="sm"
                            variant="ghost"
                            className="p-1.5 h-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => generateQuotationPDF(quote, companySettings, 'save')}
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
    const totalValue    = quotes.reduce((s: number, q: any) => s + Number(q.total), 0);
    const acceptedValue = quotes.filter((q: any) => q.status === 'separated').reduce((s: number, q: any) => s + Number(q.total), 0);

    const statusLabelOf = (s: string) => QUOTE_STATUS[s as QuoteStatus]?.label ?? s;

    const handleExportPDF = () => {
        if (!quotes.length) return toast.error('Sem cotações para exportar');
        generateQuotationsListPDF(quotes, companySettings, statusLabelOf, 'save');
    };

    const handlePrintList = () => {
        if (!quotes.length) return toast.error('Sem cotações para imprimir');
        generateQuotationsListPDF(quotes, companySettings, statusLabelOf, 'print');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                            <HiOutlineDocumentText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex flex-col">
                            <span>Cotações / Orçamentos</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Gestão de Propostas Comerciais</span>
                        </div>
                    </h2>
                </div>
                <Button variant="primary" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20">
                    <HiOutlinePlus className="w-4 h-4 text-white" /> Nova Cotação
                </Button>
            </div>

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
                    value={quotes.filter((q: any) => ['created','printed'].includes(q.status)).length}
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
            <div className="flex justify-end gap-2">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePrintList}
                    className="flex items-center gap-2"
                >
                    <HiOutlinePrinter className="w-4 h-4" />
                    Imprimir
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExportPDF}
                    className="flex items-center gap-2"
                >
                    <HiOutlineArrowDownTray className="w-4 h-4" />
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
                    <div className="w-44">
                        <Select 
                            options={statusOptions} 
                            value={statusFilter}
                            onChange={e => handleFilterChange(e.target.value)} 
                        />
                    </div>
                }
                onRefresh={refetch}
            />

            {showCreateModal && (
                <CreateQuoteModal onClose={() => setShowCreateModal(false)} onSuccess={refetch} />
            )}

            <QuoteDetailsModal
                quote={viewingQuote}
                ivaRate={companySettings?.ivaRate || 16}
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
