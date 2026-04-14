import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineDocumentText, HiOutlinePlus, HiOutlineRefresh,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock,
    HiOutlineChevronDown, HiOutlinePaperAirplane, HiOutlineArrowRight,
} from 'react-icons/hi';
import { Card, Badge, Button, Input, Select, Textarea, Modal } from '../../components/ui';
import { ProductSearchInput, type ProductOption } from '../../components/commercial/ProductSearchInput';
import { CustomerSearchInput, type CustomerOption } from '../../components/commercial/CustomerSearchInput';
import { formatCurrency, cn } from '../../utils/helpers';
import { useOrders } from '../../hooks/useOrders';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { invoicesAPI } from '../../services/api';
import { commercialAPI } from '../../services/api/commercial.api';
import toast from 'react-hot-toast';

// ── Status display ────────────────────────────────────────────────────────────

const QUOTE_STATUS = {
    created:   { label: 'Rascunho',   variant: 'gray'    as const, icon: HiOutlineDocumentText,  color: 'text-gray-500',   bg: 'bg-gray-100   dark:bg-dark-700' },
    printed:   { label: 'Enviada',    variant: 'info'    as const, icon: HiOutlinePaperAirplane,  color: 'text-blue-500',   bg: 'bg-blue-100   dark:bg-blue-900/30' },
    separated: { label: 'Aceite',     variant: 'success' as const, icon: HiOutlineCheckCircle,    color: 'text-green-500',  bg: 'bg-green-100  dark:bg-green-900/30' },
    completed: { label: 'Facturada',  variant: 'primary' as const, icon: HiOutlineArrowRight,     color: 'text-primary-500',bg: 'bg-primary-100 dark:bg-primary-900/30' },
    cancelled: { label: 'Cancelada',  variant: 'danger'  as const, icon: HiOutlineXCircle,        color: 'text-red-500',    bg: 'bg-red-100    dark:bg-red-900/30' },
} as const;

type QuoteStatus = keyof typeof QUOTE_STATUS;

// Actions available per status
const QUOTE_TRANSITIONS: Record<string, Array<{ next: string; label: string; variant: 'primary'|'success'|'danger'|'ghost' }>> = {
    created:   [{ next: 'sale',      label: 'Converter em Venda', variant: 'primary' },
                { next: 'printed',   label: 'Marcar Enviada',     variant: 'ghost'   },
                { next: 'cancelled', label: 'Cancelar',           variant: 'danger'  }],
    printed:   [{ next: 'sale',      label: 'Converter em Venda', variant: 'primary' },
                { next: 'separated', label: 'Marcar Aceite',      variant: 'success' },
                { next: 'cancelled', label: 'Cancelar',           variant: 'danger'  }],
    separated: [{ next: 'sale',    label: 'Vender (PDV)',         variant: 'primary' },
                { next: 'invoice', label: 'Gerar Factura',        variant: 'success' }],
    completed: [],
    cancelled: [],
};

type LineItem = { product: ProductOption | null; quantity: number; price: number };

// ── CreateQuoteModal ──────────────────────────────────────────────────────────

interface CreateQuoteModalProps { onClose: () => void; onSuccess: () => void }

function CreateQuoteModal({ onClose, onSuccess }: CreateQuoteModalProps) {
    const [customer, setCustomer]       = useState<CustomerOption | null>(null);
    const [manualName, setManualName]   = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [validUntil, setValidUntil]   = useState('');
    const [notes, setNotes]             = useState('');
    const [lines, setLines]             = useState<LineItem[]>([{ product: null, quantity: 1, price: 0 }]);
    const [saving, setSaving]           = useState(false);

    const { settings } = useCompanySettings();
    const ivaRate = settings?.ivaRate || 16;

    const addLine    = () => setLines(p => [...p, { product: null, quantity: 1, price: 0 }]);
    const removeLine = (i: number) => setLines(p => p.filter((_, idx) => idx !== i));

    const updateLine = useCallback(<K extends keyof LineItem>(i: number, k: K, v: LineItem[K]) =>
        setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l)), []);

    const handleProductSelect = useCallback((i: number, product: ProductOption) => {
        setLines(p => p.map((l, idx) =>
            idx === i ? { ...l, product, price: product.price } : l
        ));
    }, []);

    const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0);
    const ivaValue = subtotal * (ivaRate / 100);
    const grandTotal = subtotal + ivaValue;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return toast.error('Seleccione um cliente');
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
                notes:         `${notes} __QUOTE__`, // Ensure tag is preserved
                items: valid.map(l => ({
                    productId:   l.product!.id,
                    productName: l.product!.name,
                    quantity:    l.quantity,
                    price:       l.price,
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
                    <div className="space-y-4">
                        <CustomerSearchInput
                            label="Pesquisar Cliente"
                            onSelect={setCustomer}
                            selectedCustomer={customer}
                            clearable
                            size="sm"
                        />
                        {!customer && (
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    label="Nome do Cliente"
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
                                <div className="col-span-6">
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
                                    <Input
                                        label={i === 0 ? 'Qtd' : undefined}
                                        size="sm" type="number" min="1"
                                        value={line.quantity}
                                        onChange={e => updateLine(i, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Input
                                        label={i === 0 ? 'Preço unit.' : undefined}
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
                                        Subtotal: <strong>{formatCurrency(line.quantity * line.price)}</strong>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommercialQuotes() {
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch]             = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [expandedId, setExpandedId]           = useState<string | null>(null);
    const [converting, setConverting]           = useState<string | null>(null);

    // Reuse ordersAPI — quotations are CustomerOrders tagged with __QUOTE__
    const { orders: quotes, isLoading, refetch, updateOrderStatus, deleteOrder } = useOrders({
        status: statusFilter || undefined,
        search: search || undefined,
        limit: 20,
    });

    // Filter client-side to only show items tagged as quotes
    const filteredQuotes = quotes.filter(q =>
        q.notes?.includes('__QUOTE__')
    );

    const handleStatusUpdate = async (id: string, next: string) => {
        if (next === 'sale') {
            const quote = quotes.find(q => q.id === id);
            if (quote) {
                navigate('/commercial/pos', { state: { fromQuote: quote } });
            }
            return;
        }
        if (next === 'invoice') {
            setConverting(id);
            try {
                await invoicesAPI.convertOrderToInvoice(id);
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
            await updateOrderStatus(id, { status: next as any });
        } catch {
            toast.error('Erro ao actualizar estado');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar esta cotação?')) return;
        try { await deleteOrder(id); }
        catch { toast.error('Erro ao eliminar'); }
    };

    const statusOptions = [
        { value: '', label: 'Todos os estados' },
        ...Object.entries(QUOTE_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
    ];

    const totalQuotes   = filteredQuotes.length;
    const totalValue    = filteredQuotes.reduce((s, q) => s + Number(q.total), 0);
    const acceptedValue = filteredQuotes.filter(q => q.status === 'separated').reduce((s, q) => s + Number(q.total), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineDocumentText className="text-primary-500" />
                        Cotações / Orçamentos
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Fluxo: Rascunho → Enviada → Aceite → Factura
                    </p>
                </div>
                <Button variant="primary" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                    <HiOutlinePlus className="w-4 h-4" /> Nova Cotação
                </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Cotações',  value: String(totalQuotes),              color: 'border-l-primary-500' },
                    { label: 'Pendentes',        value: String(filteredQuotes.filter(q => ['created','printed'].includes(q.status)).length), color: 'border-l-yellow-500' },
                    { label: 'Valor Total',      value: formatCurrency(totalValue),       color: 'border-l-blue-500'    },
                    { label: 'Aceites',          value: formatCurrency(acceptedValue),    color: 'border-l-green-500'   },
                ].map(c => (
                    <Card key={c.label} padding="md" className={`border-l-4 ${c.color}`}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{c.value}</p>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                        <Input placeholder="Pesquisar por número ou cliente..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            leftIcon={<HiOutlineDocumentText className="w-4 h-4" />} />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-44">
                            <Select options={statusOptions} value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)} />
                        </div>
                        <button onClick={refetch} title="Actualizar"
                            className="p-2.5 rounded-lg border border-gray-300 dark:border-dark-600 text-gray-500 hover:text-gray-700 transition-colors">
                            <HiOutlineRefresh className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </Card>

            {/* Quotes list */}
            <div className="space-y-3">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-20 bg-gray-100 dark:bg-dark-700 rounded-xl animate-pulse" />
                    ))
                ) : filteredQuotes.length === 0 ? (
                    <Card padding="lg" className="text-center py-16">
                        <HiOutlineDocumentText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Nenhuma cotação encontrada</p>
                        <Button variant="primary" className="mt-4" onClick={() => setShowCreateModal(true)}>
                            <HiOutlinePlus className="w-4 h-4 mr-1" /> Nova Cotação
                        </Button>
                    </Card>
                ) : (
                    filteredQuotes.map(quote => {
                        const cfg        = QUOTE_STATUS[quote.status as QuoteStatus] ?? QUOTE_STATUS.created;
                        const Icon       = cfg.icon;
                        const isExpanded = expandedId === quote.id;
                        const actions    = QUOTE_TRANSITIONS[quote.status] ?? [];
                        const cleanNotes = (quote.notes ?? '').replace('__QUOTE__', '').trim();

                        return (
                            <Card key={quote.id} padding="md" className="hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
                                        <Icon className={cn('w-5 h-5', cfg.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                                                {quote.orderNumber}
                                            </span>
                                            <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                                            {quote.deliveryDate && new Date(quote.deliveryDate) < new Date() && quote.status !== 'completed' && (
                                                <Badge variant="warning" size="sm">
                                                    <HiOutlineClock className="w-3 h-3 mr-1" /> Expirada
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                            {quote.customerName}
                                            {quote.deliveryDate && (
                                                <span className="ml-2 text-xs">
                                                    · Válida até: {new Date(quote.deliveryDate).toLocaleDateString('pt-MZ')}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(Number(quote.total))}
                                        </span>
                                        <button onClick={() => setExpandedId(isExpanded ? null : quote.id)}
                                            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                                            <HiOutlineChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700 space-y-4">
                                        {/* Items */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                                        <th className="text-left py-2 font-medium">Produto</th>
                                                        <th className="text-right py-2 font-medium">Qtd</th>
                                                        <th className="text-right py-2 font-medium">Preço Unit.</th>
                                                        <th className="text-right py-2 font-medium">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(quote.items ?? []).map((item: any) => (
                                                        <tr key={item.id} className="border-b border-gray-50 dark:border-dark-700/50">
                                                            <td className="py-2 font-medium text-gray-700 dark:text-gray-300">{item.productName}</td>
                                                            <td className="py-2 text-right">{item.quantity}</td>
                                                            <td className="py-2 text-right">{formatCurrency(Number(item.price))}</td>
                                                            <td className="py-2 text-right font-bold">{formatCurrency(Number(item.total))}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {cleanNotes && (
                                            <p className="text-xs text-gray-500 bg-gray-50 dark:bg-dark-700/50 rounded-lg px-3 py-2">
                                                <strong>Condições:</strong> {cleanNotes}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            {actions.map(action => (
                                                <Button key={action.next} size="sm" variant={action.variant}
                                                    isLoading={converting === quote.id && action.next === 'invoice'}
                                                    onClick={() => handleStatusUpdate(quote.id, action.next)}>
                                                    {action.label}
                                                </Button>
                                            ))}
                                            {quote.status === 'created' && (
                                                <Button size="sm" variant="danger" onClick={() => handleDelete(quote.id)}>
                                                    Eliminar
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>

            {showCreateModal && (
                <CreateQuoteModal onClose={() => setShowCreateModal(false)} onSuccess={refetch} />
            )}
        </div>
    );
}
