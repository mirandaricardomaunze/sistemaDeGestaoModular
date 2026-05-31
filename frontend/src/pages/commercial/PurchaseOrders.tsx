import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    HiOutlineClipboardDocumentList, HiOutlinePlus, HiOutlineArrowPath,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock,
    HiOutlineTruck, HiOutlineExclamationCircle, HiOutlineChevronDown,
    HiOutlineArrowDownTray, HiOutlineCurrencyDollar, HiOutlineSparkles,
    HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { Card, Badge, Button, Input, Select, Textarea, Modal, Pagination, PageHeader, SmartTable, ConfirmationModal } from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { ProductSearchInput, type ProductOption } from '../../components/commercial/ProductSearchInput';
import { formatCurrency, cn } from '../../utils/helpers';
import { usePurchaseOrders } from '../../hooks/useCommercial';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useWarehouses } from '../../hooks/useData';
import { getDocumentWorkflow, type WorkflowTransitions } from '../../hooks/commercial/useDocumentWorkflow';
import { usePredictiveForecast } from '../../hooks/usePredictive';
import { RequestApprovalModal } from '../../components/common/RequestApprovalModal';
import toast from 'react-hot-toast';
import { PAGE_SIZE } from '../../utils/constants';
import { commercialAPI } from '../../services/api/commercial.api';
import type { InventoryForecast, PurchaseOrder } from '../../services/api/commercial.api';
import { getApiErrorMessage, getApiErrorStatus } from '../../utils/apiError';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    draft:     { label: 'Rascunho',  variant: 'gray'    as const, icon: HiOutlineClipboardDocumentList, color: 'text-gray-500 dark:text-gray-400',   bg: 'bg-gray-100   dark:bg-dark-700' },
    ordered:   { label: 'Enviada',   variant: 'info'    as const, icon: HiOutlineTruck,          color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100   dark:bg-blue-900/30' },
    partial:   { label: 'Parcial',   variant: 'warning' as const, icon: HiOutlineClock,           color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    received:  { label: 'Recebida',  variant: 'success' as const, icon: HiOutlineCheckCircle,     color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100  dark:bg-green-900/30' },
    cancelled: { label: 'Cancelada', variant: 'danger'  as const, icon: HiOutlineXCircle,         color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-100    dark:bg-red-900/30' },
} as const;

const STATUS_TRANSITIONS: WorkflowTransitions<OrderStatus> = {
    draft:     [{ next: 'ordered',   label: 'Marcar Enviada', variant: 'primary' },
                { next: 'cancelled', label: 'Cancelar',       variant: 'danger'  }],
    ordered:   [{ next: 'partial',   label: 'Recebimento Parcial', variant: 'warning' },
                { next: 'received',  label: 'Marcar Recebida',      variant: 'success' },
                { next: 'cancelled', label: 'Cancelar',            variant: 'danger'  }],
    partial:   [{ next: 'received',  label: 'Completar Recebimento', variant: 'success' },
                { next: 'cancelled', label: 'Cancelar',              variant: 'danger'  }],
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
            await commercialAPI.createPurchaseOrder({
                supplierId,
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
                                {/* Product search - spans 12 cols on mobile, 6 on desktop */}
                                <div className="col-span-12 sm:col-span-6">
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
                                <div className="col-span-5 sm:col-span-2">
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
                                <div className="col-span-5 sm:col-span-3">
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
                                <div className="col-span-2 sm:col-span-1 flex justify-center pb-0.5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeLine(i)}
                                        disabled={lines.length === 1}
                                        className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors h-11 sm:h-10 w-full"
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
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
    order: PurchaseOrder;
    onClose: () => void;
    onSuccess: () => void;
}

function ReceiveModal({ order, onClose, onSuccess }: ReceiveModalProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>(() =>
        Object.fromEntries(
            (order.items ?? []).map((item) => [
                item.id,
                Math.max(0, item.quantity - item.receivedQty),
            ])
        )
    );
    // New states for batch and expiry
    const [batchNumbers, setBatchNumbers] = useState<Record<string, string>>({});
    const [expiryDates, setExpiryDates]   = useState<Record<string, string>>({});

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
            .map(([itemId, receivedQty]) => ({ 
                itemId, 
                receivedQty,
                batchNumber: batchNumbers[itemId] || undefined,
                expiryDate: expiryDates[itemId] || undefined
            }));

        if (!items.length) return toast.error('Defina pelo menos uma quantidade a receber');

        setSaving(true);
        try {
            await commercialAPI.receivePurchaseOrder(order.id, items, selectedWarehouseId);
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
        <Modal isOpen onClose={onClose} title={`Receber - ${order.orderNumber}`} size="xl">
            <div className="space-y-4">
                <div className="bg-primary-50 dark:bg-primary-500/5 p-4 rounded-lg border border-primary-100 dark:border-primary-500/20">
                    <p className="text-sm text-primary-700 dark:text-primary-400 font-medium">
                        Registo de entrada de mercadoria. Pode definir lotes e datas de validade para um controlo profissional de inventário.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Armazém de Destino *"
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        options={[
                            { value: '', label: 'Seleccione um armazém...' },
                            ...(warehouses || []).map(w => ({ value: w.id, label: `${w.name} (${w.location})` }))
                        ]}
                        required
                    />
                </div>

                <div className="overflow-x-auto border border-gray-100 dark:border-dark-700 rounded-lg">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] text-gray-400 bg-gray-50 dark:bg-dark-900/50 uppercase tracking-widest font-black">
                                <th className="text-left px-4 py-3 font-medium">Produto</th>
                                <th className="text-right px-4 py-3 font-medium">Pendente</th>
                                <th className="text-left px-4 py-3 font-medium w-32">Receber</th>
                                <th className="text-left px-4 py-3 font-medium">Lote / Validade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-dark-700/50">
                            {(order.items ?? []).map((item) => {
                                const pending = item.quantity - item.receivedQty;
                                if (pending <= 0) return null;

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-gray-900 dark:text-white uppercase text-xs">
                                                {item.product?.name}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-mono">{item.product?.code}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Badge variant="gray" size="sm">{pending} {item.product?.unit || 'un'}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
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
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-2">
                                                <Input
                                                    size="xs"
                                                    placeholder="Nº Lote"
                                                    value={batchNumbers[item.id] || ''}
                                                    onChange={e => setBatchNumbers(p => ({ ...p, [item.id]: e.target.value }))}
                                                />
                                                <Input
                                                    size="xs"
                                                    type="date"
                                                    value={expiryDates[item.id] || ''}
                                                    onChange={e => setExpiryDates(p => ({ ...p, [item.id]: e.target.value }))}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-dark-700">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        variant="primary"
                        onClick={handleReceive}
                        isLoading={saving}
                        className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest"
                    >
                        <HiOutlineArrowDownTray className="w-4 h-4" />
                        Confirmar Recebimento
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
    const [receivingOrder, setReceivingOrder]   = useState<PurchaseOrder | null>(null);
    const [expandedId, setExpandedId]           = useState<string | null>(null);
    const [page, setPage]                       = useState(1);
    const [activeTab, setActiveTab]             = useState<'list' | 'predictive'>('list');
    const [approvalRequest, setApprovalRequest] = useState<{
        resourceId: string;
        amount: number;
        title: string;
        description: string;
    } | null>(null);

    const { orders, pagination, isLoading, refetch, updateStatus, deletePO } = usePurchaseOrders({
        status:  statusFilter || undefined,
        search:  search || undefined,
        page,
        limit:   PAGE_SIZE,
    });

    const { data: predictiveData, isLoading: predictiveLoading, refetch: refetchPredictive, createOrders, isCreating } = usePredictiveForecast();
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    const handleStatusUpdate = async (order: PurchaseOrder, next: OrderStatus) => {
        try {
            await updateStatus(order.id, next);
        } catch (err) {
            const msg = getApiErrorMessage(err, 'Erro ao actualizar estado');
            if (getApiErrorStatus(err) === 403 && next === 'ordered') {
                setApprovalRequest({
                    resourceId: order.id,
                    amount: Number(order.total || 0),
                    title: 'Solicitar aprovação da ordem de compra',
                    description: `A ordem ${order.orderNumber} precisa de aprovação antes de ser enviada ao fornecedor.`,
                });
                toast.error('Esta ordem precisa de aprovação antes de avançar.');
                return;
            }
            toast.error(msg);
        }
    };

    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = (id: string) => setPendingDeleteId(id);

    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        try {
            setIsDeleting(true);
            await deletePO(pendingDeleteId);
            setPendingDeleteId(null);
        } catch {
            toast.error('Erro ao eliminar');
        } finally {
            setIsDeleting(false);
        }
    };

    const statusOptions = [
        { value: '', label: 'Todos os estados' },
        ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
    ];

    const stats = useMemo(() => {
        const pending = orders.filter(o => ['draft', 'ordered', 'partial'].includes(o.status)).length;
        const totalVal = orders.reduce((s, o) => s + Number(o.total), 0);
        const received = orders.filter(o => o.status === 'received').length;
        const overdue = orders.filter(o => 
            o.expectedDeliveryDate && 
            new Date(o.expectedDeliveryDate) < new Date() && 
            !['received', 'cancelled'].includes(o.status)
        ).length;

        return { pending, totalVal, received, overdue };
    }, [orders]);

    const columns = [
        {
            key: 'order',
            header: 'Ordem #',
            render: (order: PurchaseOrder) => (
                <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        {order.orderNumber}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">
                        {new Date(order.createdAt).toLocaleDateString('pt-MZ')}
                    </span>
                </div>
            )
        },
        {
            key: 'supplier',
            header: 'Fornecedor',
            render: (order: PurchaseOrder) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase">
                        {order.supplier?.name?.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase truncate max-w-[200px]">
                            {order.supplier?.name}
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">
                            ENTREGA: {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('pt-MZ') : 'N/A'}
                        </span>
                    </div>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Estado',
            render: (order: PurchaseOrder) => {
                const { config: cfg } = getDocumentWorkflow(order.status as OrderStatus, STATUS_CONFIG, STATUS_TRANSITIONS, 'draft');
                const Icon = cfg.icon as React.ElementType;
                const isOverdue = order.expectedDeliveryDate
                    && new Date(order.expectedDeliveryDate) < new Date()
                    && !['received', 'cancelled'].includes(order.status);
                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant={cfg.variant} size="sm" className="w-fit text-[9px] uppercase tracking-tighter">
                            <Icon className="w-3 h-3 mr-1" />
                            {cfg.label}
                        </Badge>
                        {isOverdue && (
                            <Badge variant="danger" size="sm" className="w-fit text-[8px] animate-pulse">
                                ATRASADA
                            </Badge>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'total',
            header: 'Total',
            align: 'right' as const,
            render: (order: PurchaseOrder) => (
                <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-primary-600 dark:text-primary-400 tracking-tighter">
                        {formatCurrency(Number(order.total))}
                    </span>
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                        {order.items?.length || 0} ITENS
                    </span>
                </div>
            )
        },
        {
            key: 'actions',
            header: 'Acções',
            align: 'right' as const,
            render: (order: PurchaseOrder) => {
                const isExpanded = expandedId === order.id;
                const canReceive = ['ordered', 'partial'].includes(order.status);
                return (
                    <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                        {canReceive && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setReceivingOrder(order)}
                                className="h-9 w-9 p-0 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg shadow-sm"
                                title="Receber Stock"
                            >
                                <HiOutlineArrowDownTray className="w-5 h-5" />
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                            className={cn(
                                "h-9 w-9 p-0 rounded-lg shadow-sm",
                                isExpanded ? "bg-primary-600 text-white" : "text-primary-600 hover:bg-primary-600 hover:text-white"
                            )}
                            title="Ver Detalhes"
                        >
                            <HiOutlineChevronDown className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-180")} />
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-6 pb-10">
            <PageHeader
                title="Ordens de Compra"
                subtitle="Gestão de aprovisionamento e receção de stock profissional"
                icon={<HiOutlineClipboardDocumentList className="text-primary-600" />}
                actions={
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={refetch}
                            className="w-full h-11 sm:w-auto sm:h-10 font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-primary-600"
                            leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4", isLoading && "animate-spin")} />}
                        >
                            Actualizar
                        </Button>
                        <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => setShowCreateModal(true)} 
                            className="w-full h-11 sm:w-auto sm:h-10 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            Nova Ordem
                        </Button>
                    </div>
                }
            />

            <div className="flex w-full overflow-x-auto overscroll-x-contain p-1 bg-gray-100/50 dark:bg-dark-800/50 rounded-xl border border-gray-200/30 dark:border-dark-700/30 shadow-inner scrollbar-none">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('list')}
                    className={cn(
                        "flex-1 sm:flex-none justify-center sm:min-w-max min-h-11 sm:h-10 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg",
                        activeTab === 'list'
                            ? "bg-white dark:bg-dark-700 text-primary-600 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                >
                    <HiOutlineClipboardDocumentList className="w-4 h-4" />
                    <span>
                        <span className="hidden sm:inline">Lista de Ordens</span>
                        <span className="inline sm:hidden">Lista</span>
                    </span>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('predictive')}
                    className={cn(
                        "flex-1 sm:flex-none justify-center sm:min-w-max min-h-11 sm:h-10 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg",
                        activeTab === 'predictive'
                            ? "bg-white dark:bg-dark-700 text-primary-600 dark:text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                >
                    <HiOutlineSparkles className={cn("w-4 h-4", activeTab === 'predictive' ? "text-amber-500" : "text-amber-500 opacity-50")} />
                    <span>
                        <span className="hidden sm:inline">IA Preditiva & Reposição</span>
                        <span className="inline sm:hidden">Preditiva</span>
                    </span>
                </Button>
            </div>

            {activeTab === 'list' ? (
                <>
                    {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Total em Aberto"
                    value={String(stats.pending)}
                    color="primary"
                    icon={<HiOutlineClipboardDocumentList className="w-5 h-5" />}
                    badge={<span className="text-[9px] font-bold uppercase tracking-tight">Pendentes</span>}
                />
                <MetricCard
                    label="Investimento Total"
                    value={formatCurrency(stats.totalVal)}
                    color="emerald"
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                />
                <MetricCard
                    label="Atrasos na Entrega"
                    value={String(stats.overdue)}
                    color="red"
                    icon={<HiOutlineExclamationCircle className="w-5 h-5" />}
                    badge={stats.overdue > 0 ? <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> : undefined}
                />
                <MetricCard
                    label="Ordens Concluídas"
                    value={String(stats.received)}
                    color="blue"
                    icon={<HiOutlineCheckCircle className="w-5 h-5" />}
                />
            </div>

            {/* High Density Filters */}
            <Card padding="md" className="border-none shadow-none bg-gray-100/50 dark:bg-dark-800/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <Input
                            label="Pesquisar Ordem / Fornecedor"
                            size="sm"
                            leftIcon={<HiOutlineClipboardDocumentList className="w-4 h-4" />}
                            placeholder="Nº OC ou Nome do fornecedor..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="bg-white dark:bg-dark-900 border-none shadow-sm rounded-lg font-medium"
                        />
                    </div>
                    <div>
                        <Select
                            label="Estado"
                            options={statusOptions}
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                            size="sm"
                            className="bg-white dark:bg-dark-900 border-none shadow-sm rounded-lg font-medium"
                        />
                    </div>
                    <Button 
                        onClick={refetch}
                        variant="primary"
                        size="sm"
                        fullWidth
                        className="rounded-lg shadow-lg shadow-primary-500/20"
                    >
                        Filtrar Resultados
                    </Button>
                </div>
            </Card>

            {/* Orders Data Table */}
            <Card padding="none" className="overflow-hidden border-gray-100 dark:border-dark-700 shadow-xl shadow-black/5">
                <SmartTable
                    data={orders}
                    columns={columns}
                    isLoading={isLoading}
                    onRefresh={refetch}
                    expandedId={expandedId}
                    expandedRowRender={(order) => {
                        const { transitions } = getDocumentWorkflow(order.status as OrderStatus, STATUS_CONFIG, STATUS_TRANSITIONS, 'draft');
                        return (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-dark-900 p-4 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Itens da Ordem</h4>
                                        <div className="space-y-2">
                                            {order.items.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-dark-700/50 last:border-0">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">{item.product?.name}</span>
                                                        <span className="text-[9px] text-gray-400 font-mono">{item.product?.code}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-gray-400 uppercase font-bold">Qtd / Rec</p>
                                                            <p className="text-xs font-black text-gray-700 dark:text-gray-300">
                                                                {item.quantity} / <span className={cn(item.receivedQty >= item.quantity ? "text-emerald-500" : "text-amber-500")}>{item.receivedQty}</span>
                                                            </p>
                                                        </div>
                                                        <div className="text-right min-w-[80px]">
                                                            <p className="text-[9px] text-gray-400 uppercase font-bold">Total</p>
                                                            <p className="text-xs font-black text-primary-600">{formatCurrency(Number(item.total))}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {order.notes && (
                                            <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
                                                    <HiOutlineExclamationCircle className="w-3 h-3" /> Notas
                                                </h4>
                                                <p className="text-xs text-amber-800 dark:text-amber-200 font-medium italic">{order.notes}</p>
                                            </div>
                                        )}
                                        <div className="bg-white dark:bg-dark-900 p-4 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm flex-1">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Acções de Estado</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {transitions.map(action => (
                                                    <Button
                                                        key={action.next}
                                                        size="sm"
                                                        variant={action.variant}
                                                        onClick={() => handleStatusUpdate(order, action.next as OrderStatus)}
                                                        className="font-black text-[9px] uppercase tracking-widest px-4"
                                                    >
                                                        {action.label}
                                                    </Button>
                                                ))}
                                                {order.status === 'draft' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => handleDelete(order.id)}
                                                        className="font-black text-[9px] uppercase tracking-widest text-red-500 hover:bg-red-50"
                                                    >
                                                        Eliminar Rascunho
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }}
                    emptyTitle="Sem registos de ordens"
                    emptyDescription="As ordens de compra aparecerão aqui assim que forem registadas."
                    mobileCardRender={(order) => {
                        const { config: cfg, transitions } = getDocumentWorkflow(order.status as OrderStatus, STATUS_CONFIG, STATUS_TRANSITIONS, 'draft');
                        const isExpanded = expandedId === order.id;
                        const canReceive = ['ordered', 'partial'].includes(order.status);
                        const isOverdue = order.expectedDeliveryDate
                            && new Date(order.expectedDeliveryDate) < new Date()
                            && !['received', 'cancelled'].includes(order.status);

                        return (
                            <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-3">
                                {/* 1. Header: Nome + Código */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                                            <span className="text-primary-600 dark:text-primary-400 font-black text-sm uppercase">{order.supplier?.name?.charAt(0)}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{order.supplier?.name}</p>
                                            <p className="text-[10px] text-gray-500 font-mono">OC: {order.orderNumber}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant={cfg.variant} size="sm" className="w-fit text-[9px] uppercase tracking-tighter">
                                            {cfg.label}
                                        </Badge>
                                        {isOverdue && (
                                            <Badge variant="danger" size="sm" className="w-fit text-[8px] animate-pulse">
                                                ATRASADA
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* 2. Corpo: Entrega e Itens */}
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineTruck className="w-4 h-4 text-primary-500 shrink-0" />
                                            <span className="text-xs">Entrega: {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('pt-MZ') : 'N/A'}</span>
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-widest bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded text-gray-500">
                                            {order.items?.length || 0} ITENS
                                        </span>
                                    </div>
                                </div>

                                {/* Expand details in card */}
                                {isExpanded && (
                                    <div className="pt-2">
                                        <div className="bg-gray-50/50 dark:bg-dark-900/30 rounded-lg p-3">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Acções de Estado</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {transitions.map(action => (
                                                    <Button
                                                        key={action.next}
                                                        size="sm"
                                                        variant={action.variant}
                                                        onClick={() => handleStatusUpdate(order, action.next as OrderStatus)}
                                                        className="font-black text-[9px] uppercase tracking-widest flex-1 px-2"
                                                    >
                                                        {action.label}
                                                    </Button>
                                                ))}
                                                {order.status === 'draft' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => handleDelete(order.id)}
                                                        className="font-black text-[9px] uppercase tracking-widest text-red-500 hover:bg-red-50 flex-1 px-2 border border-red-200"
                                                    >
                                                        Eliminar Rascunho
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 3. Rodapé: Total */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                                        <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{formatCurrency(Number(order.total))}</p>
                                    </div>
                                </div>

                                {/* 4. Ações — Espaço Total */}
                                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-white/5 w-full">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                        className="flex-1 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-500/20 font-black tracking-widest text-[10px] uppercase"
                                    >
                                        <HiOutlineChevronDown className={cn("w-4 h-4 mr-2 transition-transform", isExpanded && "rotate-180")} /> {isExpanded ? 'Ocultar' : 'Detalhes'}
                                    </Button>
                                    {canReceive && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setReceivingOrder(order)}
                                            className="flex-1 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20 font-black tracking-widest text-[10px] uppercase"
                                        >
                                            <HiOutlineArrowDownTray className="w-4 h-4 mr-2" /> Receber Stock
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    }}
                />

                {!isLoading && pagination && pagination.totalPages > 1 && (
                    <div className="px-3 sm:px-6 py-4 border-t border-gray-100 dark:border-dark-700">
                        <Pagination 
                            currentPage={page}
                            totalItems={pagination.total}
                            itemsPerPage={pagination.limit}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>

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
            {approvalRequest && (
                <RequestApprovalModal
                    open={!!approvalRequest}
                    onClose={() => setApprovalRequest(null)}
                    requestType="purchase_order"
                    resourceType="purchase_order"
                    resourceId={approvalRequest.resourceId}
                    initialAmount={approvalRequest.amount}
                    title={approvalRequest.title}
                    description={approvalRequest.description}
                    onSubmitted={() => toast.success('Pedido de aprovação enviado. Depois de aprovado, volte a enviar a ordem.')}
                />
            )}
                </>
            ) : null}

            {activeTab === 'predictive' && (
                predictiveLoading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />)}
                        </div>
                        <div className="h-96 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <MetricCard
                                label="Risco Crítico"
                                value={predictiveData.filter((p) => p.status === 'critical').length}
                                color="red"
                                icon={<HiOutlineExclamationTriangle className="w-5 h-5" />}
                                badge={<span className="text-[8px] font-black text-red-500 dark:text-red-400 uppercase tracking-tighter animate-pulse">Ruptura Imínente</span>}
                            />
                            <MetricCard
                                label="Sugestões Recompra"
                                value={predictiveData.filter((p) => p.suggestedPurchase > 0).length}
                                color="orange"
                                icon={<HiOutlineTruck className="w-5 h-5" />}
                            />
                            <MetricCard
                                label="Precisão da IA"
                                value={`${(predictiveData.reduce((s: number, p: InventoryForecast) => s + p.confidence, 0) / (predictiveData.length || 1) * 100).toFixed(0)}%`}
                                color="blue"
                                icon={<HiOutlineSparkles className="w-5 h-5" />}
                            />
                            <MetricCard
                                label="Investimento Necessário"
                                value={formatCurrency(predictiveData.reduce((s: number, p: InventoryForecast) => s + (p.suggestedPurchase * p.costPrice), 0))}
                                color="green"
                                icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                                badge={<span className="text-[9px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-tight">Stock 30d</span>}
                            />
                        </div>

                        {/* Forecasting & Action Table */}
                        <Card padding="none" className="overflow-hidden shadow-xl shadow-black/5">
                            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-dark-700 flex flex-col gap-4 bg-gray-50/30 dark:bg-dark-900/30 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <HiOutlineSparkles className="text-amber-500" />
                                        Análise Preditiva e Reposição
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">Procura estimada para os próximos 30 dias com base no histórico real</p>
                                </div>
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                    {selectedItems.length > 0 && (
                                        <Button 
                                            size="sm" 
                                            onClick={async () => {
                                                const suggestions = predictiveData
                                                    .filter((p) => selectedItems.includes(p.productId))
                                                    .map((p) => ({ productId: p.productId, quantity: p.suggestedPurchase || p.minStock }));
                                                await createOrders(suggestions);
                                                setSelectedItems([]);
                                                setActiveTab('list');
                                                refetch();
                                            }}
                                            isLoading={isCreating}
                                            className="font-black text-[10px] uppercase tracking-widest bg-primary-600 shadow-lg shadow-primary-500/20"
                                            leftIcon={<HiOutlinePlus className="w-4 h-4 text-white" />}
                                        >
                                            Gerar OCs ({selectedItems.length})
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={refetchPredictive}
                                        className="font-black text-[10px] uppercase tracking-widest text-gray-400"
                                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                                    >
                                        Recalcular
                                    </Button>
                                </div>
                            </div>
                            <div className="max-w-full overflow-x-auto overscroll-x-contain scrollbar-thin">
                                <table className="w-full min-w-[760px] text-left text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-dark-800 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                                            <th className="px-6 py-4 w-10 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-dark-900"
                                                    checked={selectedItems.length === predictiveData.length && predictiveData.length > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedItems(predictiveData.map((p) => p.productId));
                                                        else setSelectedItems([]);
                                                    }}
                                                />
                                            </th>
                                            <th className="px-6 py-4">Produto</th>
                                            <th className="px-6 py-4">Tendência 6M</th>
                                            <th className="px-6 py-4">Stock Atual/Mín</th>
                                            <th className="px-6 py-4">Procura 30d (IA)</th>
                                            <th className="px-6 py-4">Sugestão</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                        {predictiveData.map((item) => (
                                            <tr key={item.productId} className={cn(
                                                "hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors",
                                                selectedItems.includes(item.productId) && "bg-primary-50/30 dark:bg-primary-900/10"
                                            )}>
                                                <td className="px-6 py-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-dark-900"
                                                        checked={selectedItems.includes(item.productId)}
                                                        onChange={() => {
                                                            setSelectedItems(prev => 
                                                                prev.includes(item.productId) 
                                                                    ? prev.filter(id => id !== item.productId)
                                                                    : [...prev, item.productId]
                                                            );
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-black text-gray-900 dark:text-white uppercase text-xs">{item.productName}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">{item.productCode}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-end gap-1 h-8 w-24">
                                                        {item.history.map((h: number, i: number) => (
                                                            <div 
                                                                key={i} 
                                                                className="w-full bg-gray-200 dark:bg-dark-600 rounded-t-sm transition-all hover:bg-primary-400"
                                                                style={{ height: `${Math.min(100, (h / (Math.max(...item.history) || 1)) * 100)}%` }}
                                                            />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "font-black text-xs",
                                                            item.currentStock <= item.minStock ? "text-red-500" : "text-gray-900 dark:text-white"
                                                        )}>
                                                            {item.currentStock}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-bold">/ {item.minStock}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-xs text-primary-600 dark:text-primary-400">{item.forecasted30d} un.</span>
                                                        <span className="text-[9px] text-gray-400 font-bold uppercase">{(item.confidence * 100).toFixed(0)}% confiança</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.suggestedPurchase > 0 ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-emerald-600 uppercase">Comprar {item.suggestedPurchase}</span>
                                                            <span className="text-[10px] text-gray-400 font-bold">{formatCurrency(item.suggestedPurchase * item.costPrice)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-[10px] font-bold uppercase tracking-widest">Suficiente</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={
                                                            item.status === 'critical' ? 'danger' :
                                                            item.status === 'high_risk' ? 'danger' :
                                                            item.status === 'low_risk' ? 'warning' : 'success'
                                                        } size="sm" className="w-fit text-[9px] font-black uppercase tracking-widest">
                                                            {item.status.toUpperCase()}
                                                        </Badge>
                                                        <p className="text-[9px] text-gray-500 mt-1 max-w-[150px] leading-tight italic line-clamp-2" title={item.reasoning}>
                                                            {item.reasoning}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )
            )}

            <ConfirmationModal
                isOpen={!!pendingDeleteId}
                onClose={() => !isDeleting && setPendingDeleteId(null)}
                onConfirm={confirmDelete}
                title="Eliminar rascunho?"
                message="Tem a certeza que deseja eliminar este rascunho de ordem de compra? Esta acção não pode ser desfeita."
                confirmText="Sim, eliminar"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
