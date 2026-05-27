import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    HiOutlineDocumentText, HiOutlinePlus, HiOutlineArrowPath,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock,
    HiOutlineCurrencyDollar, HiOutlineExclamationCircle,
    HiOutlineChevronDown, HiOutlineBanknotes,
} from 'react-icons/hi2';
import {
    Card, Badge, Button, Input, Select, Textarea, Modal,
    Pagination, PageHeader, ConfirmationModal, EmptyState, SimpleTable,
} from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { RequestApprovalModal } from '../../components/common/RequestApprovalModal';
import { formatCurrency, cn } from '../../utils/helpers';
import { useSupplierInvoices } from '../../hooks/useCommercial';
import { commercialAPI } from '../../services/api/commercial.api';
import type { PurchaseOrdersListResult, SupplierInvoice, SupplierInvoiceStatus, SupplierPaymentMethod } from '../../services/api/commercial.api';
import { logger } from '../../utils/logger';
import { getApiErrorMessage, getApiErrorStatus } from '../../utils/apiError';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { PAGE_SIZE } from '../../utils/constants';

const STATUS_CONFIG: Record<SupplierInvoiceStatus, { label: string; variant: 'gray' | 'info' | 'warning' | 'success' | 'danger'; icon: React.ComponentType<{ className?: string }> }> = {
    registered: { label: 'Por Pagar', variant: 'info',    icon: HiOutlineClock },
    partial:    { label: 'Parcial',   variant: 'warning', icon: HiOutlineBanknotes },
    paid:       { label: 'Paga',      variant: 'success', icon: HiOutlineCheckCircle },
    cancelled:  { label: 'Cancelada', variant: 'danger',  icon: HiOutlineXCircle },
};

const PAYMENT_METHOD_LABEL: Record<SupplierPaymentMethod, string> = {
    cash:     'Numerário',
    card:     'Cartão',
    pix:      'PIX',
    transfer: 'Transferência',
    credit:   'Crédito',
    mpesa:    'M-Pesa',
    emola:    'e-Mola',
};

// ── Create Supplier Invoice Modal ────────────────────────────────────────────

interface CreateModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface ReceivedPOOption {
    id: string;
    orderNumber: string;
    supplier: { id: string; name: string };
    items: Array<{
        id: string;
        productId: string;
        quantity: number;
        receivedQty: number;
        unitCost: number;
        product?: { id: string; name: string; code: string };
    }>;
}

function CreateInvoiceModal({ onClose, onSuccess }: CreateModalProps) {
    const [orders, setOrders] = useState<ReceivedPOOption[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState('');
    const [taxRate, setTaxRate] = useState<number>(16);
    const [notes, setNotes] = useState('');
    const [markPaid, setMarkPaid] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                // Pull received + partial orders only — backend rejects others
                const [receivedRes, partialRes] = await Promise.all([
                    commercialAPI.listPurchaseOrders({ status: 'received', limit: 100 }),
                    commercialAPI.listPurchaseOrders({ status: 'partial', limit: 100 }),
                ]);
                if (!active) return;
                const merge = (r: PurchaseOrdersListResult) => r.data;
                setOrders([...merge(receivedRes), ...merge(partialRes)]);
            } catch (err) {
                logger.error('Error loading purchase orders:', err);
                toast.error('Erro ao carregar ordens de compra');
            } finally {
                if (active) setLoadingOrders(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const selectedOrder = useMemo(
        () => orders.find(o => o.id === selectedOrderId) || null,
        [orders, selectedOrderId]
    );

    // When selecting an order, prefill quantities with all received units
    useEffect(() => {
        if (!selectedOrder) {
            setQuantities({});
            return;
        }
        const initial: Record<string, number> = {};
        for (const it of selectedOrder.items) {
            initial[it.id] = Math.max(0, Number(it.receivedQty || 0));
        }
        setQuantities(initial);
    }, [selectedOrder]);

    const totals = useMemo(() => {
        if (!selectedOrder) return { subtotal: 0, tax: 0, total: 0 };
        const subtotal = selectedOrder.items.reduce((sum, it) => {
            const qty = quantities[it.id] ?? 0;
            return sum + qty * Number(it.unitCost || 0);
        }, 0);
        const tax = subtotal * (Number(taxRate) || 0) / 100;
        return {
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round((subtotal + tax) * 100) / 100,
        };
    }, [selectedOrder, quantities, taxRate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) return toast.error('Seleccione uma ordem de compra');
        if (!invoiceNumber.trim()) return toast.error('Indique o número da factura');

        const items = selectedOrder.items
            .map(it => ({ purchaseOrderItemId: it.id, quantity: quantities[it.id] ?? 0 }))
            .filter(it => it.quantity > 0);

        if (!items.length) return toast.error('Indique pelo menos uma quantidade a facturar');

        setSaving(true);
        try {
            await commercialAPI.createSupplierInvoice(selectedOrder.id, {
                invoiceNumber: invoiceNumber.trim(),
                issueDate,
                dueDate: dueDate || null,
                taxRate,
                status: markPaid ? 'paid' : 'registered',
                notes: notes.trim() || null,
                items,
            });
            toast.success('Factura registada!');
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao registar factura'));
        } finally {
            setSaving(false);
        }
    };

    const orderOptions = [
        { value: '', label: loadingOrders ? 'A carregar ordens...' : 'Seleccione uma ordem recebida...' },
        ...orders.map(o => ({
            value: o.id,
            label: `${o.orderNumber} — ${o.supplier?.name || ''}`,
        })),
    ];

    return (
        <Modal isOpen onClose={onClose} title="Nova Factura de Fornecedor" size="xl">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Ordem de Compra *"
                        options={orderOptions}
                        value={selectedOrderId}
                        onChange={e => setSelectedOrderId(e.target.value)}
                        disabled={loadingOrders}
                        required
                    />
                    <Input
                        label="Nº da Factura *"
                        placeholder="Ex: FT-2026/00123"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value)}
                        required
                    />
                    <Input
                        label="Data de Emissão *"
                        type="date"
                        value={issueDate}
                        onChange={e => setIssueDate(e.target.value)}
                        required
                    />
                    <Input
                        label="Data de Vencimento"
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                    />
                    <Input
                        label="Taxa de IVA (%)"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={taxRate}
                        onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    />
                    <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 pb-2">
                            <input
                                type="checkbox"
                                checked={markPaid}
                                onChange={e => setMarkPaid(e.target.checked)}
                                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            Marcar como paga
                        </label>
                    </div>
                </div>

                {selectedOrder && (
                    <div className="border border-gray-100 dark:border-dark-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-dark-900/50 text-[10px] text-gray-400 uppercase tracking-widest font-black">
                                    <th className="px-4 py-3 text-left">Produto</th>
                                    <th className="px-4 py-3 text-right">Recebido</th>
                                    <th className="px-4 py-3 text-right w-32">A Facturar</th>
                                    <th className="px-4 py-3 text-right">Custo Un.</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {selectedOrder.items.map(it => {
                                    const qty = quantities[it.id] ?? 0;
                                    const lineTotal = qty * Number(it.unitCost || 0);
                                    return (
                                        <tr key={it.id}>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-gray-900 dark:text-white text-xs uppercase">
                                                    {it.product?.name || it.productId}
                                                </p>
                                                {it.product?.code && (
                                                    <p className="text-[10px] text-gray-400 font-mono">{it.product.code}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-400">
                                                {it.receivedQty}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    size="sm"
                                                    type="number"
                                                    min="0"
                                                    max={it.receivedQty}
                                                    value={qty}
                                                    onChange={e => setQuantities(prev => ({
                                                        ...prev,
                                                        [it.id]: Math.min(it.receivedQty, Math.max(0, parseInt(e.target.value) || 0)),
                                                    }))}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs">{formatCurrency(Number(it.unitCost))}</td>
                                            <td className="px-4 py-3 text-right text-xs font-bold">{formatCurrency(lineTotal)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <Textarea
                    label="Notas"
                    rows={2}
                    placeholder="Observações..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                />

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                    <div className="space-y-1 text-xs text-gray-500">
                        <p>Subtotal: <strong className="text-gray-900 dark:text-white">{formatCurrency(totals.subtotal)}</strong></p>
                        <p>IVA ({taxRate}%): <strong className="text-gray-900 dark:text-white">{formatCurrency(totals.tax)}</strong></p>
                        <p className="text-base">Total: <strong className="text-primary-600 dark:text-primary-400 text-lg">{formatCurrency(totals.total)}</strong></p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                        <Button variant="primary" type="submit" isLoading={saving}>Registar Factura</Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SupplierInvoices() {
    const [statusFilter, setStatusFilter] = useState<SupplierInvoiceStatus | ''>('');
    const [period, setPeriod] = useState('');
    const [page, setPage] = useState(1);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ id: string; status: 'paid' | 'cancelled'; invoiceNumber: string } | null>(null);
    const [payingInvoice, setPayingInvoice] = useState<SupplierInvoice | null>(null);
    const [paymentApprovalRequest, setPaymentApprovalRequest] = useState<{ invoice: SupplierInvoice; amount: number } | null>(null);

    const { invoices, pagination, isLoading, refetch, updateStatus, addPayment, deletePayment } = useSupplierInvoices({
        status: statusFilter || undefined,
        period: period || undefined,
        page,
        limit: PAGE_SIZE,
    });

    const handleStatusChange = useCallback(async () => {
        if (!confirmAction) return;
        try {
            await updateStatus(confirmAction.id, confirmAction.status);
            setConfirmAction(null);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao actualizar estado'));
        }
    }, [confirmAction, updateStatus]);

    const [pendingPaymentDelete, setPendingPaymentDelete] = useState<{ invoiceId: string; paymentId: string } | null>(null);
    const [isDeletingPayment, setIsDeletingPayment] = useState(false);

    const handleDeletePayment = useCallback((invoiceId: string, paymentId: string) => {
        setPendingPaymentDelete({ invoiceId, paymentId });
    }, []);

    const confirmDeletePayment = useCallback(async () => {
        if (!pendingPaymentDelete) return;
        try {
            setIsDeletingPayment(true);
            await deletePayment(pendingPaymentDelete.invoiceId, pendingPaymentDelete.paymentId);
            setPendingPaymentDelete(null);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao remover pagamento'));
        } finally {
            setIsDeletingPayment(false);
        }
    }, [pendingPaymentDelete, deletePayment]);

    const stats = useMemo(() => {
        const totalOpen = invoices.filter(i => i.status === 'registered' || i.status === 'partial').length;
        const totalPaid = invoices.filter(i => i.status === 'paid').length;
        const totalAmount = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.total), 0);
        const totalDue = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.amountDue || 0), 0);
        const overdue = invoices.filter(i =>
            (i.status === 'registered' || i.status === 'partial') && i.dueDate && new Date(i.dueDate) < new Date()
        ).length;
        return { totalOpen, totalPaid, totalAmount, totalDue, overdue };
    }, [invoices]);

    const statusOptions: Array<{ value: string; label: string }> = [
        { value: '', label: 'Todos os estados' },
        ...(Object.entries(STATUS_CONFIG) as Array<[SupplierInvoiceStatus, { label: string }]>).map(([k, v]) => ({ value: k, label: v.label })),
    ];

    return (
        <div className="space-y-6 pb-10">
            <PageHeader
                title="Facturas de Fornecedor"
                subtitle="Registo de facturas de compras e controlo de IVA dedutível"
                icon={<HiOutlineDocumentText className="text-primary-600" />}
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={refetch}
                            className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-primary-600"
                            leftIcon={<HiOutlineArrowPath className={cn('w-4 h-4', isLoading && 'animate-spin')} />}
                        >
                            Actualizar
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            Nova Factura
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Em Aberto"
                    value={String(stats.totalOpen)}
                    color="primary"
                    icon={<HiOutlineClock className="w-5 h-5" />}
                />
                <MetricCard
                    label="Saldo em Dívida"
                    value={formatCurrency(stats.totalDue)}
                    color="orange"
                    icon={<HiOutlineBanknotes className="w-5 h-5" />}
                />
                <MetricCard
                    label="Vencidas"
                    value={String(stats.overdue)}
                    color="red"
                    icon={<HiOutlineExclamationCircle className="w-5 h-5" />}
                    badge={stats.overdue > 0 ? <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> : undefined}
                />
                <MetricCard
                    label="Valor Facturado"
                    value={formatCurrency(stats.totalAmount)}
                    color="blue"
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                />
            </div>

            <Card padding="md" className="border-none shadow-none bg-gray-100/50 dark:bg-dark-800/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 block mb-1.5 uppercase tracking-widest pl-1">
                            Estado
                        </label>
                        <Select
                            options={statusOptions}
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value as SupplierInvoiceStatus | ''); setPage(1); }}
                            size="sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 block mb-1.5 uppercase tracking-widest pl-1">
                            Período (AAAA-MM)
                        </label>
                        <Input
                            type="month"
                            value={period}
                            onChange={e => { setPeriod(e.target.value); setPage(1); }}
                            size="sm"
                        />
                    </div>
                    <Button
                        onClick={refetch}
                        className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg min-h-11 sm:h-10 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary-500/20"
                    >
                        Filtrar
                    </Button>
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden border-gray-100 dark:border-dark-700 shadow-xl shadow-black/5">
                <SimpleTable
                    columns={[
                        { key: 'invoice', label: 'Nº Factura' },
                        { key: 'supplier', label: 'Fornecedor' },
                        { key: 'order', label: 'Ordem' },
                        { key: 'issue', label: 'Emissão' },
                        { key: 'due', label: 'Vencimento' },
                        { key: 'status', label: 'Estado' },
                        { key: 'total', label: 'Total', className: 'text-right' },
                        { key: 'actions', label: 'Acções', className: 'text-right pr-10' },
                    ]}
                    isLoading={isLoading}
                    isEmpty={!isLoading && invoices.length === 0}
                    emptyTitle="Sem facturas registadas"
                    emptyDescription="Registe a primeira factura a partir de uma ordem de compra recebida."
                    emptyIcon={<HiOutlineDocumentText className="w-12 h-12" />}
                    minHeight="480px"
                    loadingRows={8}
                    loadingMessage="A carregar facturas..."
                    headerRowClassName="text-gray-400 border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/50"
                    tbodyClassName="divide-y divide-gray-100 dark:divide-dark-700"
                >
                            {!isLoading && invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12">
                                        <EmptyState
                                            icon={<HiOutlineDocumentText className="w-12 h-12" />}
                                            title="Sem facturas registadas"
                                            description="Registe a primeira factura a partir de uma ordem de compra recebida."
                                        />
                                    </td>
                                </tr>
                            ) : !isLoading && (
                                invoices.map(invoice => {
                                    const cfg = STATUS_CONFIG[invoice.status];
                                    const Icon = cfg.icon;
                                    const isExpanded = expandedId === invoice.id;
                                    const isOverdue = (invoice.status === 'registered' || invoice.status === 'partial')
                                        && invoice.dueDate
                                        && new Date(invoice.dueDate) < new Date();
                                    const canPay = invoice.status === 'registered' || invoice.status === 'partial';

                                    return (
                                        <React.Fragment key={invoice.id}>
                                            <tr className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all group">
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                                        {invoice.invoiceNumber}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase">
                                                            {invoice.supplier?.name?.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase truncate max-w-[200px]">
                                                                {invoice.supplier?.name}
                                                            </span>
                                                            {invoice.supplier?.nuit && (
                                                                <span className="text-[9px] text-gray-400 font-medium">
                                                                    NUIT: {invoice.supplier.nuit}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-mono text-gray-600 dark:text-gray-400">
                                                    {invoice.purchaseOrder?.orderNumber || '—'}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500">
                                                    {format(parseISO(invoice.issueDate), 'dd/MM/yyyy')}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500">
                                                    {invoice.dueDate ? format(parseISO(invoice.dueDate), 'dd/MM/yyyy') : '—'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={cfg.variant} size="sm" className="w-fit text-[9px] uppercase tracking-tighter">
                                                            <Icon className="w-3 h-3 mr-1" />
                                                            {cfg.label}
                                                        </Badge>
                                                        {isOverdue && (
                                                            <Badge variant="danger" size="sm" className="w-fit text-[8px] animate-pulse">
                                                                VENCIDA
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-black text-primary-600 dark:text-primary-400 tracking-tighter">
                                                            {formatCurrency(Number(invoice.total))}
                                                        </span>
                                                        {Number(invoice.amountDue) > 0 && invoice.status !== 'cancelled' ? (
                                                            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-tight">
                                                                Dívida: {formatCurrency(Number(invoice.amountDue))}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] text-gray-400 font-bold">
                                                                IVA: {formatCurrency(Number(invoice.tax))}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 pr-10">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                        {canPay && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setPayingInvoice(invoice)}
                                                                className="h-9 w-9 p-0 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg shadow-sm"
                                                                title="Registar Pagamento"
                                                            >
                                                                <HiOutlineBanknotes className="w-5 h-5" />
                                                            </Button>
                                                        )}
                                                        {invoice.status !== 'cancelled' && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setConfirmAction({ id: invoice.id, status: 'cancelled', invoiceNumber: invoice.invoiceNumber })}
                                                                className="h-9 w-9 p-0 text-red-500 hover:bg-red-600 hover:text-white rounded-lg shadow-sm"
                                                                title="Cancelar Factura"
                                                            >
                                                                <HiOutlineXCircle className="w-5 h-5" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                                                            className={cn(
                                                                'h-9 w-9 p-0 rounded-lg shadow-sm',
                                                                isExpanded ? 'bg-primary-600 text-white' : 'text-primary-600 hover:bg-primary-600 hover:text-white'
                                                            )}
                                                            title="Ver Itens"
                                                        >
                                                            <HiOutlineChevronDown className={cn('w-5 h-5 transition-transform', isExpanded && 'rotate-180')} />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-4 bg-gray-50/50 dark:bg-dark-900/30">
                                                        <ExpandedInvoiceDetails
                                                            invoice={invoice}
                                                            onDeletePayment={(paymentId) => handleDeletePayment(invoice.id, paymentId)}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                </SimpleTable>

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

            {showCreateModal && (
                <CreateInvoiceModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={refetch}
                />
            )}

            <ConfirmationModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleStatusChange}
                title={confirmAction?.status === 'paid' ? 'Marcar Factura como Paga' : 'Cancelar Factura'}
                message={
                    confirmAction?.status === 'paid'
                        ? `Confirma o pagamento da factura ${confirmAction.invoiceNumber}? Esta acção regista a data de pagamento.`
                        : `Tem a certeza que deseja cancelar a factura ${confirmAction?.invoiceNumber}? O IVA dedutível associado deixa de ser considerado.`
                }
                confirmText={confirmAction?.status === 'paid' ? 'Confirmar Pagamento' : 'Cancelar Factura'}
                variant={confirmAction?.status === 'paid' ? 'success' : 'danger'}
            />

            <ConfirmationModal
                isOpen={!!pendingPaymentDelete}
                onClose={() => !isDeletingPayment && setPendingPaymentDelete(null)}
                onConfirm={confirmDeletePayment}
                title="Remover pagamento?"
                message="Remover este pagamento? O saldo em dívida será actualizado."
                confirmText="Sim, remover"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isDeletingPayment}
            />

            {payingInvoice && (
                <PaymentModal
                    invoice={payingInvoice}
                    onClose={() => setPayingInvoice(null)}
                    onSubmit={async (payload) => {
                        try {
                            await addPayment(payingInvoice.id, payload);
                            setPayingInvoice(null);
                        } catch (err) {
                            if (getApiErrorStatus(err) === 403) {
                                setPaymentApprovalRequest({ invoice: payingInvoice, amount: payload.amount });
                                setPayingInvoice(null);
                                toast.error('Este pagamento precisa de aprovação antes de ser registado.');
                                return;
                            }
                            throw err;
                        }
                    }}
                />
            )}

            {paymentApprovalRequest && (
                <RequestApprovalModal
                    open={!!paymentApprovalRequest}
                    onClose={() => setPaymentApprovalRequest(null)}
                    requestType="supplier_payment"
                    resourceType="supplier_invoice"
                    resourceId={paymentApprovalRequest.invoice.id}
                    initialAmount={paymentApprovalRequest.amount}
                    title="Solicitar aprovação de pagamento"
                    description={`O pagamento da factura ${paymentApprovalRequest.invoice.invoiceNumber} precisa de aprovação antes de ser registado.`}
                    onSubmitted={() => toast.success('Pedido de aprovação enviado. Depois de aprovado, volte a registar o pagamento.')}
                />
            )}
        </div>
    );
}

// ── Payment Modal ────────────────────────────────────────────────────────────

interface PaymentModalProps {
    invoice: SupplierInvoice;
    onClose: () => void;
    onSubmit: (payload: { amount: number; method: SupplierPaymentMethod; paymentDate: string; reference: string | null; notes: string | null }) => Promise<void>;
}

function PaymentModal({ invoice, onClose, onSubmit }: PaymentModalProps) {
    const remaining = Math.max(Number(invoice.amountDue || 0), 0);
    const [amount, setAmount] = useState<number>(Math.round(remaining * 100) / 100);
    const [method, setMethod] = useState<SupplierPaymentMethod>('transfer');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || amount <= 0) {
            toast.error('Indique um montante positivo');
            return;
        }
        if (amount > remaining + 0.01) {
            toast.error(`Montante excede o saldo em divida (${formatCurrency(remaining)})`);
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                amount,
                method,
                paymentDate,
                reference: reference.trim() || null,
                notes: notes.trim() || null,
            });
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao registar pagamento'));
        } finally {
            setSaving(false);
        }
    };

    const methodOptions = (Object.keys(PAYMENT_METHOD_LABEL) as SupplierPaymentMethod[]).map(m => ({
        value: m,
        label: PAYMENT_METHOD_LABEL[m],
    }));

    return (
        <Modal isOpen onClose={onClose} title={`Pagamento — ${invoice.invoiceNumber}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-primary-50/50 dark:bg-primary-900/10 p-4 rounded-lg border border-primary-100 dark:border-primary-900/20 grid grid-cols-3 gap-3">
                    <div>
                        <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest">Total</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(Number(invoice.total))}</p>
                    </div>
                    <div>
                        <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest">Já Pago</p>
                        <p className="text-sm font-black text-emerald-600">{formatCurrency(Number(invoice.amountPaid))}</p>
                    </div>
                    <div>
                        <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest">Em Dívida</p>
                        <p className="text-sm font-black text-amber-600">{formatCurrency(remaining)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Montante *"
                        type="number"
                        min="0.01"
                        max={remaining}
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                        required
                    />
                    <Select
                        label="Método *"
                        options={methodOptions}
                        value={method}
                        onChange={e => setMethod(e.target.value as SupplierPaymentMethod)}
                    />
                    <Input
                        label="Data do Pagamento *"
                        type="date"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        required
                    />
                    <Input
                        label="Referência"
                        placeholder="Nº transferência, recibo, etc."
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                    />
                </div>

                <Textarea
                    label="Notas"
                    rows={2}
                    placeholder="Observações..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-dark-700">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" type="submit" isLoading={saving}>Registar Pagamento</Button>
                </div>
            </form>
        </Modal>
    );
}

// ── Expanded Details ─────────────────────────────────────────────────────────

function ExpandedInvoiceDetails({
    invoice,
    onDeletePayment,
}: {
    invoice: SupplierInvoice;
    onDeletePayment: (paymentId: string) => void;
}) {
    const payments = invoice.payments || [];
    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-white dark:bg-dark-900 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] p-4 border-b border-gray-100 dark:border-dark-700">
                    Itens da Factura
                </h4>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-dark-900/50 text-[10px] text-gray-400 uppercase tracking-widest font-black">
                            <th className="px-4 py-2 text-left">Produto</th>
                            <th className="px-4 py-2 text-right">Qtd</th>
                            <th className="px-4 py-2 text-right">Custo Un.</th>
                            <th className="px-4 py-2 text-right">IVA</th>
                            <th className="px-4 py-2 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                        {invoice.items.map(item => (
                            <tr key={item.id}>
                                <td className="px-4 py-2">
                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">
                                        {item.product?.name || item.description}
                                    </p>
                                    {item.product?.code && (
                                        <p className="text-[10px] text-gray-400 font-mono">{item.product.code}</p>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-right text-xs">{item.quantity}</td>
                                <td className="px-4 py-2 text-right text-xs">{formatCurrency(Number(item.unitCost))}</td>
                                <td className="px-4 py-2 text-right text-xs">{formatCurrency(Number(item.taxAmount))}</td>
                                <td className="px-4 py-2 text-right text-xs font-bold">{formatCurrency(Number(item.total))}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50/50 dark:bg-dark-900/50 text-xs">
                        <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-bold uppercase tracking-widest text-gray-500">Subtotal</td>
                            <td className="px-4 py-2 text-right font-bold">{formatCurrency(Number(invoice.subtotal))}</td>
                        </tr>
                        <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-bold uppercase tracking-widest text-gray-500">IVA ({Number(invoice.taxRate)}%)</td>
                            <td className="px-4 py-2 text-right font-bold">{formatCurrency(Number(invoice.tax))}</td>
                        </tr>
                        <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-black uppercase tracking-widest text-primary-600">Total</td>
                            <td className="px-4 py-2 text-right font-black text-primary-600 text-base">{formatCurrency(Number(invoice.total))}</td>
                        </tr>
                        <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-bold uppercase tracking-widest text-emerald-600">Pago</td>
                            <td className="px-4 py-2 text-right font-bold text-emerald-600">{formatCurrency(Number(invoice.amountPaid))}</td>
                        </tr>
                        <tr>
                            <td colSpan={4} className="px-4 py-2 text-right font-bold uppercase tracking-widest text-amber-600">Em Dívida</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-600">{formatCurrency(Number(invoice.amountDue))}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="bg-white dark:bg-dark-900 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] p-4 border-b border-gray-100 dark:border-dark-700">
                    Histórico de Pagamentos ({payments.length})
                </h4>
                {payments.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-gray-400 italic">
                        Nenhum pagamento registado.
                    </p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-dark-900/50 text-[10px] text-gray-400 uppercase tracking-widest font-black">
                                <th className="px-4 py-2 text-left">Data</th>
                                <th className="px-4 py-2 text-left">Método</th>
                                <th className="px-4 py-2 text-left">Referência</th>
                                <th className="px-4 py-2 text-right">Montante</th>
                                <th className="px-4 py-2 text-center w-16">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {payments.map(p => (
                                <tr key={p.id}>
                                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                        {format(parseISO(p.paymentDate), 'dd/MM/yyyy')}
                                    </td>
                                    <td className="px-4 py-2 text-xs font-medium">{PAYMENT_METHOD_LABEL[p.method]}</td>
                                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">{p.reference || '—'}</td>
                                    <td className="px-4 py-2 text-right text-xs font-black text-emerald-600">{formatCurrency(Number(p.amount))}</td>
                                    <td className="px-4 py-2 text-center">
                                        {invoice.status !== 'cancelled' && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => onDeletePayment(p.id)}
                                                className="h-8 w-8 p-0 text-red-500 hover:bg-red-600 hover:text-white rounded-lg"
                                                title="Remover pagamento"
                                            >
                                                <HiOutlineXCircle className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {invoice.notes && (
                <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/20">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-2">Notas</h4>
                    <p className="text-xs text-amber-800 dark:text-amber-200 italic">{invoice.notes}</p>
                </div>
            )}
        </div>
    );
}
