import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineClock,
    HiOutlineExclamation,
} from 'react-icons/hi';
import { Button, Input, Badge } from '../ui';
import { batchesAPI, type ProductBatch } from '../../services/api/batches.api';
import { cn } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface Props {
    productId: string;
}

interface BatchForm {
    batchNumber: string;
    quantity: string;
    expiryDate: string;
    costPrice: string;
    notes: string;
}

const emptyForm: BatchForm = { batchNumber: '', quantity: '0', expiryDate: '', costPrice: '0', notes: '' };

type BatchStatus = ProductBatch['status'];

function StatusBadge({ status, daysToExpiry }: { status: BatchStatus; daysToExpiry?: number | null }) {
    if (status === 'expired') {
        return (
            <Badge variant="danger" className="flex items-center gap-1">
                <HiOutlineExclamation className="w-3 h-3" />
                Expirado
            </Badge>
        );
    }
    if (status === 'expiring_soon') {
        return (
            <Badge variant="warning" className="flex items-center gap-1">
                <HiOutlineClock className="w-3 h-3" />
                {daysToExpiry != null ? `Expira em ${daysToExpiry}d` : 'A expirar'}
            </Badge>
        );
    }
    if (status === 'depleted') {
        return <Badge variant="gray">Esgotado</Badge>;
    }
    return <Badge variant="success">Válido</Badge>;
}

export default function ProductValiditiesSection({ productId }: Props) {
    const [batches, setBatches] = useState<(ProductBatch & { daysToExpiry?: number | null })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<BatchForm>(emptyForm);
    const [submitting, setSubmitting] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const res = await batchesAPI.list({ productId });
            const data = res.data ?? res;
            const now = Date.now();
            setBatches(
                (Array.isArray(data) ? data : []).map((b: ProductBatch) => ({
                    ...b,
                    daysToExpiry: b.expiryDate
                        ? Math.ceil((new Date(b.expiryDate).getTime() - now) / 86400000)
                        : null,
                }))
            );
        } catch {
            toast.error('Erro ao carregar lotes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [productId]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const openEdit = (b: ProductBatch) => {
        setEditingId(b.id);
        setForm({
            batchNumber: b.batchNumber,
            quantity: String(b.quantity),
            expiryDate: b.expiryDate ? b.expiryDate.slice(0, 10) : '',
            costPrice: String(b.costPrice ?? 0),
            notes: b.notes || '',
        });
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
    };

    const handleSave = async () => {
        if (!form.batchNumber.trim()) { toast.error('Número de lote obrigatório'); return; }
        if (!form.expiryDate) { toast.error('Data de validade obrigatória'); return; }
        setSubmitting(true);
        try {
            if (editingId) {
                await batchesAPI.update(editingId, {
                    quantity: parseInt(form.quantity) || 0,
                    expiryDate: form.expiryDate,
                    costPrice: parseFloat(form.costPrice) || 0,
                    notes: form.notes || undefined,
                });
                toast.success('Lote actualizado');
            } else {
                await batchesAPI.create({
                    batchNumber: form.batchNumber,
                    productId,
                    quantity: parseInt(form.quantity) || 0,
                    expiryDate: form.expiryDate,
                    costPrice: parseFloat(form.costPrice) || 0,
                    notes: form.notes || undefined,
                });
                toast.success('Lote adicionado');
            }
            cancelForm();
            await load();
        } catch {
            // error handled by API interceptor
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar este lote?')) return;
        try {
            await batchesAPI.delete(id);
            toast.success('Lote eliminado');
            await load();
        } catch {
            // error handled
        }
    };

    const totalQty = batches.reduce((s, b) => s + b.quantity, 0);
    const hasExpired = batches.some(b => b.status === 'expired');
    const hasExpiringSoon = batches.some(b => b.status === 'expiring_soon');

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Lotes / Validades ({batches.length})
                    </span>
                    {totalQty > 0 && (
                        <span className="text-xs text-gray-400">— {totalQty} unid. total</span>
                    )}
                    {hasExpired && <Badge variant="danger" size="sm">Expirado</Badge>}
                    {!hasExpired && hasExpiringSoon && <Badge variant="warning" size="sm">A expirar</Badge>}
                </div>
                {!showForm && (
                    <Button size="sm" variant="outline" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={openCreate}>
                        Adicionar
                    </Button>
                )}
            </div>

            {/* Inline Form */}
            {showForm && (
                <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-4 bg-primary-50 dark:bg-primary-900/10 space-y-3">
                    <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wider">
                        {editingId ? 'Editar Lote' : 'Novo Lote'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Número do Lote *"
                            value={form.batchNumber}
                            onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
                            placeholder="LOTE-001"
                            disabled={!!editingId}
                        />
                        <Input
                            label="Quantidade *"
                            type="number"
                            min={0}
                            value={form.quantity}
                            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                        />
                        <Input
                            label="Data de Validade *"
                            type="date"
                            value={form.expiryDate}
                            onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                        />
                        <Input
                            label="Preço de Custo (MT)"
                            type="number"
                            step="0.01"
                            min={0}
                            value={form.costPrice}
                            onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                        />
                        <Input
                            label="Notas"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Opcional"
                            className="col-span-2"
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" leftIcon={<HiOutlineX className="w-4 h-4" />} onClick={cancelForm}>
                            Cancelar
                        </Button>
                        <Button size="sm" leftIcon={<HiOutlineCheck className="w-4 h-4" />} onClick={handleSave} isLoading={submitting}>
                            Guardar
                        </Button>
                    </div>
                </div>
            )}

            {/* Batches List */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />)}
                </div>
            ) : batches.length === 0 ? (
                <div className="text-center py-6 text-gray-400 dark:text-gray-600 text-sm border border-dashed border-gray-200 dark:border-dark-600 rounded-xl">
                    Nenhum lote registado
                </div>
            ) : (
                <div className="space-y-2">
                    {batches.map(b => (
                        <div
                            key={b.id}
                            className={cn(
                                'flex items-center justify-between px-4 py-3 rounded-xl border',
                                b.status === 'expired'
                                    ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'
                                    : b.status === 'expiring_soon'
                                        ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800'
                                        : b.status === 'depleted'
                                            ? 'border-gray-200 bg-gray-50 dark:bg-dark-700 dark:border-dark-600 opacity-60'
                                            : 'border-gray-100 bg-white dark:bg-dark-800 dark:border-dark-700'
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div>
                                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-0.5">
                                        Lote: {b.batchNumber}
                                    </p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                        {b.expiryDate
                                            ? format(parseISO(b.expiryDate), "dd 'de' MMMM yyyy", { locale: pt })
                                            : 'Sem data de validade'}
                                    </p>
                                    {b.notes && (
                                        <p className="text-xs text-gray-400 mt-0.5">{b.notes}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">Qtd.</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{b.quantity}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <StatusBadge status={b.status} daysToExpiry={b.daysToExpiry} />
                                <button
                                    onClick={() => openEdit(b)}
                                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <HiOutlinePencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(b.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Eliminar"
                                >
                                    <HiOutlineTrash className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
