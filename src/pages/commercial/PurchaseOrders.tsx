import { useState, useCallback, useEffect } from 'react';
import {
    HiOutlineClipboardList, HiOutlinePlus, HiOutlineRefresh,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock,
    HiOutlineTruck, HiOutlineExclamation, HiOutlineChevronDown,
    HiOutlineDownload,
} from 'react-icons/hi';
import { Card, Badge, Button, Input, Select, Textarea, Modal } from '../../components/ui';
import { ProductSearchInput, type ProductOption } from '../../components/commercial/ProductSearchInput';
import { formatCurrency, cn } from '../../utils/helpers';
import { usePurchaseOrders } from '../../hooks/useCommercial';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useWarehouses } from '../../hooks/useData';
import toast from 'react-hot-toast';
import { suppliersAPI } from '../../services/api';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    draft:     { label: 'Rascunho',  variant: 'gray'    as const, icon: HiOutlineClipboardList, color: 'text-gray-500 dark:text-gray-400',   bg: 'bg-gray-100   dark:bg-dark-700' },
    ordered:   { label: 'Enviada',   variant: 'info'    as const, icon: HiOutlineTruck,          color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100   dark:bg-blue-900/30' },
    partial:   { label: 'Parcial',   variant: 'warning' as const, icon: HiOutlineClock,           color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    received:  { label: 'Recebida',  variant: 'success' as const, icon: HiOutlineCheckCircle,     color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100  dark:bg-green-900/30' },
    cancelled: { label: 'Cancelada', variant: 'danger'  as const, icon: HiOutlineXCircle,         color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-100    dark:bg-red-900/30' },
} as const;

const STATUS_TRANSITIONS: Record<string, string[]> = {
    draft:     ['ordered', 'cancelled'],
    ordered:   ['partial', 'received', 'cancelled'],
    partial:   ['received', 'cancelled'],
    received:  [],
    cancelled: [],
};

type OrderStatus = keyof typeof STATUS_CONFIG;
type LineItem = { product: ProductOption | null; quantity: number; unitCost: number };

// ── Helpers ──────────────────────────────────────────────────────────────────

function lineTotal(item: LineItem): number {
    return item.quantity * item.unitCost;
}

// ── CreatePOModal ────────────────────────────────────────────────────────────-

interface CreatePOModalProps { onClose: () => void; onSuccess: () => void }

function CreatePOModal({ onClose, onSuccess }: CreatePOModalProps) {
    const { suppliers } = useSuppliers({ limit: 200 });
    const [supplierId, setSupplierId]     = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes]               = useState('');
    const [lines, setLines]               = useState<LineItem[]>([
        { product: null, quantity: 1, unitCost: 0 },
    ]);
    const [saving, setSaving] = useState(false);

    const addLine    = () => setLines(p => [...p, { product: null, quantity: 1, unitCost: 0 }]);
    const removeLine = (i: number) => setLines(p => p.filter((_, idx) => idx !== i));

    const updateLine = useCallback(<K extends keyof LineItem>(
        i: number, field: K, value: LineItem[K]
    ) => {
        setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
    }, []);

    const handleProductSelect = useCallback((i: number, product: ProductOption) => {
        setLines(p => p.map((l, idx) =>
            idx === i ? { ...l, product, unitCost: product.costPrice > 0 ? product.costPrice : l.unitCost } : l
        ));
    }, []);

    const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId) return toast.error('Seleccione um fornecedor');

        const valid = lines.filter(l => l.product && l.quantity > 0);
        if (!valid.length) return toast.error('Adicione pelo menos um produto');

        setSaving(true);
        try {
            await suppliersAPI.createPurchaseOrder(supplierId, {
                items: valid.map(l => ({
                    productId: l.product!.id,
                    quantity:  l.quantity,
                    unitCost:  l.unitCost,
                })),
                expectedDeliveryDate: expectedDate || undefined,
                notes:               notes || undefined,
            });
            toast.success('Ordem de compra criada!');
            onSuccess();
            onClose();
        } catch {
            toast.error('Erro ao criar ordem de compra');
        } finally {
            setSaving(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));

    return (
        <Modal isOpen onClose={onClose} title="Nova Ordem de Compra" size="xl">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Fornecedor *"
                        options={supplierOptions}
                        placeholder="Seleccione um fornecedor..."
                        value={supplierId}
                        onChange={e => setSupplierId(e.target.value)}
                        required
                    />
                    <Input
                        label="Data de Entrega Prevista"
                        type="date"
                        value={expectedDate}
                        onChange={e => setExpectedDate(e.target.value)}
                    />
                </div>

                {/* Line items */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Produtos ({lines.length})
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addLine}
                            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                            <HiOutlinePlus className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                            Adicionar linha
                        </Button>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {lines.map((line, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-700/30">
                                {/* Product search - spans 6 cols */}
                                <div className="col-span-6">
                                    <ProductSearchInput
                                        label={i === 0 ? 'Produto' : undefined}
                                        originModule="commercial"
                                        onSelect={p => handleProductSelect(i, p)}
                                        selectedProduct={line.product}
                                        showStock
                                        placeholder="Pesquisar produto..."
                                    />
                                </div>
                                {/* Qty */}
                                <div className="col-span-2">
                                    <Input
                                        label={i === 0 ? 'Qtd' : undefined}
                                        size="sm"
                                        type="number"
                                        min="1"
                                        value={line.quantity}
                                        onChange={e => updateLine(i, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                {/* Unit cost */}
                                <div className="col-span-3">
                                    <Input
                                        label={i === 0 ? 'Custo unit.' : undefined}
                                        size="sm"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={line.unitCost}
                                        onChange={e => updateLine(i, 'unitCost', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                {/* Remove */}
                                <div className="col-span-1 flex justify-center pb-0.5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeLine(i)}
                                        disabled={lines.length === 1}
                                        className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <HiOutlineXCircle className="w-5 h-5" />
                                    </Button>
                                </div>
                                {/* Subtotal */}
                                {line.product && (
                                    <div className="col-span-12 text-right text-xs text-gray-500 -mt-1">
                                        Subtotal: <strong>{formatCurrency(lineTotal(line))}</strong>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <Textarea
                    label="Notas"
                    rows={2}
                    placeholder="Observações adicionais..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                />

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                    <div>
                        <p className="text-xs text-gray-400">Total estimado</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(grandTotal)}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                        <Button variant="primary" type="submit" isLoading={saving}>Criar Ordem</Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

// ── ReceiveModal - partial stock receipt ────────────────────────────────────-

interface ReceiveModalProps {
    order: any; // PurchaseOrder with items
    onClose: () => void;
    onSuccess: () => void;
}

function ReceiveModal({ order, onClose, onSuccess }: ReceiveModalProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>(() =>
        Object.fromEntries(
            (order.items ?? []).map((item: any) => [
                item.id,
                Math.max(0, item.quantity - item.receivedQty),
            ])
        )
    );
    const { warehouses } = useWarehouses();
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [saving, setSaving] = useState(false);

    // Set default warehouse
    useEffect(() => {
        if (warehouses && warehouses.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(warehouses[0].id);
        }
    }, [warehouses, selectedWarehouseId]);

    const handleReceive = async () => {
        const items = Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([itemId, receivedQty]) => ({ itemId, receivedQty }));

        if (!items.length) return toast.error('Defina pelo menos uma quantidade a receber');

        setSaving(true);
        try {
            await suppliersAPI.receivePurchaseOrder(order.id, items, selectedWarehouseId);
            toast.success('Stock actualizado com sucesso!');
            onSuccess();
            onClose();
        } catch {
            toast.error('Erro ao registar recebimento');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title={`Receber - ${order.orderNumber}`} size="lg">
            <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Defina as quantidades recebidas e o armazém de destino. O stock será actualizado automaticamente.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-dark-700/30 p-4 rounded-lg border border-gray-100 dark:border-dark-700">
                    <div>
                        <Select
                            label="Destino da Mercadoria"
                            value={selectedWarehouseId}
                            onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            options={[
                                { value: '', label: 'Seleccione um armazém...' },
                                ...(warehouses || []).map(w => ({ value: w.id, label: `${w.name} (${w.location})` }))
                            ]}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                <th className="text-left py-2 font-medium">Produto</th>
                                <th className="text-right py-2 font-medium">Encomendado</th>
                                <th className="text-right py-2 font-medium">J recebido</th>
                                <th className="text-right py-2 font-medium w-32">Receber agora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(order.items ?? []).map((item: any) => {
                                const pending = item.quantity - item.receivedQty;
                                return (
                                    <tr key={item.id} className="border-b border-gray-50 dark:border-dark-700/50">
                                        <td className="py-3">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {item.product?.name}
                                            </p>
                                            <p className="text-xs text-gray-400">{item.product?.code}</p>
                                        </td>
                                        <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                                            {item.quantity}
                                        </td>
                                        <td className="py-3 text-right">
                                            <span className={cn(
                                                'font-medium',
                                                item.receivedQty >= item.quantity ? 'text-green-500' :
                                                item.receivedQty > 0 ? 'text-yellow-500' : 'text-gray-400'
                                            )}>
                                                {item.receivedQty}
                                            </span>
                                        </td>
                                        <td className="py-3 pl-4">
                                            <Input
                                                size="sm"
                                                type="number"
                                                min="0"
                                                max={pending}
                                                value={quantities[item.id] ?? 0}
                                                onChange={e => setQuantities(p => ({
                                                    ...p,
                                                    [item.id]: Math.min(
                                                        pending,
                                                        Math.max(0, parseInt(e.target.value) || 0)
                                                    ),
                                                }))}
                                                helperText={pending > 0 ? `Máx: ${pending}` : 'Completo'}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-dark-700">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        variant="success"
                        onClick={handleReceive}
                        isLoading={saving}
                        className="flex items-center gap-2"
                    >
                        <HiOutlineDownload className="w-4 h-4" />
                        Registar Recebimento
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PurchaseOrders() {
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch]             = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [receivingOrder, setReceivingOrder]   = useState<any | null>(null);
    const [expandedId, setExpandedId]           = useState<string | null>(null);

    const { orders, pagination, isLoading, refetch, updateStatus, deletePO } = usePurchaseOrders({
        status:  statusFilter || undefined,
        search:  search || undefined,
        limit:   20,
    });

    const handleStatusUpdate = async (id: string, next: string) => {
        try { await updateStatus(id, next); }
        catch { toast.error('Erro ao actualizar estado'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar este rascunho?')) return;
        try { await deletePO(id); }
        catch { toast.error('Erro ao eliminar'); }
    };

    const statusOptions = [
        { value: '', label: 'Todos os estados' },
        ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
    ];

    const totalPending = orders.filter(o => ['draft', 'ordered'].includes(o.status)).length;
    const totalValue   = orders.reduce((s, o) => s + Number(o.total), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineClipboardList className="text-primary-600 dark:text-primary-400" />
                        Ordens de Compra
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Gestão de compras a fornecedores com recebimento parcial de stock
                    </p>
                </div>
                <Button variant="primary" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                    <HiOutlinePlus className="w-4 h-4" />
                    Nova Ordem
                </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Ordens',  value: String(pagination?.total ?? orders.length),                      color: 'border-l-primary-500' },
                    { label: 'Pendentes',     value: String(totalPending),                                             color: 'border-l-yellow-500'  },
                    { label: 'Valor Total',   value: formatCurrency(totalValue),                                       color: 'border-l-green-500'   },
                    { label: 'Recebidas',     value: String(orders.filter(o => o.status === 'received').length),       color: 'border-l-blue-500'    },
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
                        <Input
                            placeholder="Pesquisar por número ou fornecedor..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            leftIcon={<HiOutlineClipboardList className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-48">
                            <Select
                                options={statusOptions}
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={refetch}
                            title="Actualizar"
                            className="p-2.5 rounded-lg border border-gray-300 dark:border-dark-600 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                            <HiOutlineRefresh className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* List */}
            <div className="space-y-3">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-20 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                    ))
                ) : orders.length === 0 ? (
                    <Card padding="lg" className="text-center py-16">
                        <HiOutlineClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Nenhuma ordem encontrada</p>
                        <p className="text-sm text-gray-400 mb-4">
                            {search || statusFilter ? 'Tente outros filtros' : 'Crie a primeira ordem de compra'}
                        </p>
                        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                            <HiOutlinePlus className="w-4 h-4 mr-1" /> Nova Ordem
                        </Button>
                    </Card>
                ) : (
                    orders.map(order => {
                        const cfg        = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.draft;
                        const Icon       = cfg.icon;
                        const isExpanded = expandedId === order.id;
                        const transitions = STATUS_TRANSITIONS[order.status] ?? [];
                        const isOverdue  = order.expectedDeliveryDate
                            && new Date(order.expectedDeliveryDate) < new Date()
                            && !['received', 'cancelled'].includes(order.status);
                        const canReceive = ['ordered', 'partial'].includes(order.status);

                        return (
                            <Card key={order.id} padding="md" className="hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
                                        <Icon className={cn('w-5 h-5', cfg.color)} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                                                {order.orderNumber}
                                            </span>
                                            <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                                            {isOverdue && (
                                                <Badge variant="danger" size="sm" className="flex items-center gap-1">
                                                    <HiOutlineExclamation className="w-3 h-3" /> Atrasada
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                            {order.supplier.name}
                                            {order.expectedDeliveryDate && (
                                                <span className="ml-2 text-xs">
                                                    · Entrega: {new Date(order.expectedDeliveryDate).toLocaleDateString('pt-MZ')}
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(Number(order.total))}
                                        </span>
                                        {canReceive && (
                                            <Button
                                                size="sm"
                                                variant="success"
                                                onClick={() => setReceivingOrder(order)}
                                                className="flex items-center gap-1"
                                            >
                                                <HiOutlineDownload className="w-3.5 h-3.5" />
                                                Receber
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                        >
                                            <HiOutlineChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                                        </Button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700 space-y-4">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-gray-400 border-b border-gray-100 dark:border-dark-700">
                                                        <th className="text-left py-2 font-medium">Produto</th>
                                                        <th className="text-right py-2 font-medium">Enc.</th>
                                                        <th className="text-right py-2 font-medium">Recebido</th>
                                                        <th className="text-right py-2 font-medium">Custo Unit.</th>
                                                        <th className="text-right py-2 font-medium">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map((item: any) => (
                                                        <tr key={item.id} className="border-b border-gray-50 dark:border-dark-700/50">
                                                            <td className="py-2 font-medium text-gray-700 dark:text-gray-300">
                                                                {item.product?.name}
                                                                <span className="ml-1 text-gray-400 font-normal">{item.product?.code}</span>
                                                            </td>
                                                            <td className="py-2 text-right">{item.quantity}</td>
                                                            <td className="py-2 text-right">
                                                                <span className={cn(
                                                                    'font-semibold',
                                                                    item.receivedQty >= item.quantity ? 'text-green-500' :
                                                                    item.receivedQty > 0 ? 'text-yellow-500' : 'text-gray-400'
                                                                )}>
                                                                    {item.receivedQty}/{item.quantity}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 text-right">{formatCurrency(Number(item.unitCost))}</td>
                                                            <td className="py-2 text-right font-bold">{formatCurrency(Number(item.total))}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {order.notes && (
                                            <p className="text-xs text-gray-500 bg-gray-50 dark:bg-dark-700/50 rounded-lg px-3 py-2">
                                                <strong>Notas:</strong> {order.notes}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            {transitions.map(next => {
                                                const ncfg = STATUS_CONFIG[next as OrderStatus];
                                                return (
                                                    <Button
                                                        key={next}
                                                        size="sm"
                                                        variant={next === 'cancelled' ? 'danger' : next === 'received' ? 'success' : 'primary'}
                                                        onClick={() => handleStatusUpdate(order.id, next)}
                                                    >
                                                        Marcar: {ncfg?.label}
                                                    </Button>
                                                );
                                            })}
                                            {order.status === 'draft' && (
                                                <Button size="sm" variant="danger" onClick={() => handleDelete(order.id)}>
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

            {/* Modals */}
            {showCreateModal && (
                <CreatePOModal onClose={() => setShowCreateModal(false)} onSuccess={refetch} />
            )}
            {receivingOrder && (
                <ReceiveModal
                    order={receivingOrder}
                    onClose={() => setReceivingOrder(null)}
                    onSuccess={() => { refetch(); setExpandedId(null); }}
                />
            )}
        </div>
    );
}
