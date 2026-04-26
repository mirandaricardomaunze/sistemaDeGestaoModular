import { useState, useEffect } from 'react';
import { Card, Button, Input, Modal, Badge, Skeleton, ConfirmationModal } from '../ui';
import {
    HiOutlinePlus, 
    HiOutlineArrowPath, 
    HiOutlinePencil, 
    HiOutlineTrash,
    HiOutlineMagnifyingGlass, 
    HiOutlineExclamationTriangle,
    HiOutlineClock, 
    HiOutlineCheckCircle, 
    HiOutlineCube,
} from 'react-icons/hi2';
import { cn, formatCurrency } from '../../utils';
import {
    useBatchesDashboard, useBatches, useExpBatches,
    useCreateBatch, useUpdateBatch, useDeleteBatch,
} from '../../hooks/useBatches';
import { useWarehouses } from '../../hooks/useWarehouses';
import type { ProductBatch, CreateBatchDto } from '../../services/api';
import { useProducts } from '../../hooks/useData';
import { differenceInDays } from 'date-fns';

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CFG = {
    active:        { label: 'Activo',        color: 'success' as const, icon: HiOutlineCheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
    expiring_soon: { label: 'A Expirar',     color: 'warning' as const, icon: HiOutlineClock,        bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    expired:       { label: 'Expirado',      color: 'danger'  as const, icon: HiOutlineExclamationTriangle,  bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
    depleted:      { label: 'Esgotado',      color: 'gray'    as const, icon: HiOutlineCube,         bg: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700' },
    quarantine:    { label: 'Quarentena',    color: 'info'    as const, icon: HiOutlineExclamationTriangle,  bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
};

// ============================================================================
// EXPIRY BADGE
// ============================================================================

function ExpiryBadge({ expiryDate, daysToExpiry }: { expiryDate?: string | null; daysToExpiry?: number | null }) {
    if (!expiryDate) return <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">-</span>;

    const days = daysToExpiry ?? differenceInDays(new Date(expiryDate), new Date());
    const label = new Date(expiryDate).toLocaleDateString('pt-MZ');

    if (days < 0) return <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-black uppercase tracking-widest"><HiOutlineExclamationTriangle className="w-3.5 h-3.5" />{label} (expirado)</span>;
    if (days <= 7) return <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-black uppercase tracking-widest"><HiOutlineClock className="w-3.5 h-3.5" />{label} ({days}d)</span>;
    if (days <= 30) return <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-black uppercase tracking-widest"><HiOutlineClock className="w-3.5 h-3.5" />{label} ({days}d)</span>;
    return <span className="text-[10px] text-gray-600 dark:text-gray-400 font-black uppercase tracking-widest">{label}</span>;
}

// ============================================================================
// BATCH FORM MODAL
// ============================================================================

const EMPTY_FORM: Partial<CreateBatchDto> = {
    batchNumber: '', productId: '', quantity: 0, costPrice: 0,
    expiryDate: '', manufactureDate: '', receivedDate: new Date().toISOString().split('T')[0],
    notes: '',
};

function BatchFormModal({ open, onClose, editing, defaultProductId }: {
    open: boolean; onClose: () => void; editing?: ProductBatch | null; defaultProductId?: string;
}) {
    const [form, setForm] = useState<Partial<CreateBatchDto & { status?: string; totalCost?: number }>>(
        editing ? {
            batchNumber: editing.batchNumber, productId: editing.productId,
            quantity: editing.quantity, costPrice: Number(editing.costPrice),
            totalCost: editing.quantity * Number(editing.costPrice),
            expiryDate: editing.expiryDate?.split('T')[0] || '',
            manufactureDate: editing.manufactureDate?.split('T')[0] || '',
            receivedDate: editing.receivedDate?.split('T')[0] || '',
            supplierId: editing.supplierId, warehouseId: editing.warehouseId,
            notes: editing.notes || '',
        } : { ...EMPTY_FORM, productId: defaultProductId || '', totalCost: 0 }
    );

    const { products } = useProducts({ limit: 200 });
    const { warehouses } = useWarehouses();
    const create = useCreateBatch();
    const update = useUpdateBatch();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.batchNumber || !form.productId || form.quantity === undefined) return;
        try {
            const payload: any = {
                batchNumber: form.batchNumber.trim().toUpperCase(),
                productId: form.productId,
                quantity: form.quantity,
                costPrice: form.costPrice || 0,
                expiryDate: form.expiryDate || undefined,
                manufactureDate: form.manufactureDate || undefined,
                receivedDate: form.receivedDate,
                notes: form.notes,
                supplierId: form.supplierId || undefined,
                warehouseId: form.warehouseId || undefined,
            };
            if (editing) {
                await update.mutateAsync({ id: editing.id, data: payload });
            } else {
                await create.mutateAsync(payload);
            }
            onClose();
        } catch { /* handled by hook */ }
    };

    const busy = create.isLoading || update.isLoading;

    // Auto-preencher preço de custo do produto ao selecionar
    useEffect(() => {
        if (!editing && form.productId && products) {
            const product = (products as any).find((p: any) => p.id === form.productId);
            if (product && (!form.costPrice || form.costPrice === 0)) {
                setForm(p => ({
                    ...p,
                    costPrice: Number(product.costPrice),
                    totalCost: Number(((p.quantity || 0) * Number(product.costPrice)).toFixed(2))
                }));
            }
        }
    }, [form.productId, products, editing]);

    return (
        <Modal isOpen={open} onClose={onClose} title={editing ? 'Editar Lote' : 'Registar Novo Lote'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Nº Lote *" value={form.batchNumber || ''} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value.toUpperCase() }))}
                        placeholder="Ex: LT2026001" required />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto *</label>
                        <select required value={form.productId || ''} onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}
                            disabled={!!editing || !!defaultProductId}
                            className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60">
                            <option value="">Seleccionar produto...</option>
                            {(products || []).map((p: any) => (
                                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                        <Input 
                            label="Qtd. Caixas" 
                            type="number" 
                            min={0} 
                            placeholder="Caixas"
                            onChange={e => {
                                const boxes = parseInt(e.target.value) || 0;
                                const product = products?.find((p: any) => p.id === form.productId);
                                const packSize = product?.packSize || 1;
                                const qty = boxes * packSize;
                                
                                setForm(p => ({ 
                                    ...p, 
                                    quantity: qty,
                                    totalCost: Number((qty * (p.costPrice || 0)).toFixed(2))
                                }));
                            }}
                        />
                    </div>
                    <div className="md:col-span-1">
                        <Input 
                            label="Qtd. Unidades *" 
                            type="number" 
                            min={0} 
                            value={form.quantity || ''} 
                            onChange={e => {
                                const qty = parseInt(e.target.value) || 0;
                                setForm(p => ({ 
                                    ...p, 
                                    quantity: qty,
                                    totalCost: Number((qty * (p.costPrice || 0)).toFixed(2))
                                }));
                            }} 
                            required 
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Armazém *</label>
                        <select required value={form.warehouseId || ''} onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="">Seleccionar armazém...</option>
                            {(warehouses || []).map((w: any) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Custo Unitário (MZN)" 
                        type="number" 
                        min={0} 
                        step={0.01} 
                        value={form.costPrice || ''} 
                        onChange={e => {
                            const price = parseFloat(e.target.value) || 0;
                            setForm(p => ({ 
                                ...p, 
                                costPrice: price,
                                totalCost: Number(((p.quantity || 0) * price).toFixed(2))
                            }));
                        }} 
                    />
                    <Input 
                        label="Custo Total (MZN)" 
                        type="number" 
                        min={0} 
                        step={0.01} 
                        value={form.totalCost || ''} 
                        onChange={e => {
                            const total = parseFloat(e.target.value) || 0;
                            const qty = form.quantity || 0;
                            setForm(p => ({ 
                                ...p, 
                                totalCost: total,
                                costPrice: qty > 0 ? Number((total / qty).toFixed(2)) : p.costPrice
                            }));
                        }} 
                    />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <Input label="Data de Fabricação" type="date" value={form.manufactureDate || ''} onChange={e => setForm(p => ({ ...p, manufactureDate: e.target.value }))} />
                    <Input label="Data de Entrada" type="date" value={form.receivedDate || ''} onChange={e => setForm(p => ({ ...p, receivedDate: e.target.value }))} />
                    <Input label="Validade (Expiração)" type="date" value={form.expiryDate || ''} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                    <textarea rows={2} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" isLoading={busy}>{editing ? 'Guardar' : 'Registar Lote'}</Button>
                </div>
            </form>
        </Modal>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type ViewTab = 'list' | 'expiring' | 'dashboard';

export default function BatchManager({ defaultProductId }: { defaultProductId?: string }) {
    const [tab, setTab] = useState<ViewTab>('list');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ProductBatch | null>(null);
    const [deleting, setDeleting] = useState<ProductBatch | null>(null);

    const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useBatchesDashboard();
    const { data: batchesData, isLoading, refetch } = useBatches({ productId: defaultProductId, status: filterStatus || undefined, search });
    const { data: expiringData } = useExpBatches({ days: 30 });
    const deleteBatch = useDeleteBatch();

    const batches: ProductBatch[] = batchesData?.data || [];
    const expiring: any[] = expiringData?.data || [];
    const summary = dashboard?.summary;

    const handleEdit = (batch: ProductBatch) => { setEditing(batch); setModalOpen(true); };
    const handleCloseModal = () => { setModalOpen(false); setEditing(null); refetch(); refetchDash(); };
    const handleDelete = async () => {
        if (!deleting) return;
        try { await deleteBatch.mutateAsync(deleting.id); refetch(); refetchDash(); } catch { }
        setDeleting(null);
    };

    const TABS = [
        { id: 'list' as ViewTab, label: 'Todos os Lotes' },
        { id: 'expiring' as ViewTab, label: `A Expirar ${expiring.length > 0 ? `(${expiring.length})` : ''}`, urgent: expiring.some(b => (b.daysToExpiry ?? 999) <= 7) },
        { id: 'dashboard' as ViewTab, label: 'Painel' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Lotes & Validade</h2>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5">Rastreio de lotes, datas de expiração e alertas</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        className="text-[10px] font-black uppercase tracking-widest"
                        onClick={() => { refetch(); refetchDash(); }} 
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                    >
                        Atualizar
                    </Button>
                    <Button 
                        className="text-[10px] font-black uppercase tracking-widest"
                        onClick={() => setModalOpen(true)} 
                        leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                    >
                        Novo Lote
                    </Button>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-4 border-b border-gray-100 dark:border-dark-700">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={cn('group px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 border-b-2',
                            tab === t.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600')}>
                        {t.label}
                        {t.urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                    </button>
                ))}
            </div>

            {/* DASHBOARD TAB */}
            {tab === 'dashboard' && (
                <div className="space-y-4">
                    {dashLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} height={80} />)}</div>
                    ) : summary && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {[
                                    { label: 'Total Lotes', value: summary.total, color: 'text-blue-600' },
                                    { label: 'Activos', value: summary.active, color: 'text-emerald-600' },
                                    { label: 'Expiram (30d)', value: summary.expiring30, color: 'text-amber-600' },
                                    { label: 'Expiram (7d)', value: summary.expiring7, color: 'text-orange-600' },
                                    { label: 'Expirados', value: summary.expiredCount, color: 'text-red-600' },
                                    { label: 'Esgotados', value: summary.depleted, color: 'text-gray-500' },
                                ].map(({ label, value, color }) => (
                                    <Card key={label} variant="premium" padding="sm" className="hover:shadow-lg transition-all">
                                        <p className={cn('text-2xl font-black tracking-tighter', color)}>{value}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                                    </Card>
                                ))}
                            </div>
                            {summary.valueAtRisk > 0 && (
                                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-900/50 flex items-center gap-3 animate-pulse">
                                    <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Valor em Risco (Stock Expirado)</p>
                                        <p className="text-[10px] text-red-600 font-bold uppercase tracking-tight">{formatCurrency(summary.valueAtRisk)} em stock sem validade comercial</p>
                                    </div>
                                </div>
                            )}
                            {(dashboard?.upcoming || []).length > 0 && (
                                <Card variant="premium" padding="md">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Próximas Expiraces (30 dias)</h3>
                                    <div className="space-y-1">
                                        {(dashboard.upcoming || []).map((b: any) => (
                                            <div key={b.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-dark-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-dark-900/30 transition-colors px-2 rounded-lg">
                                                <div>
                                                    <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight">{b.product?.name} · LT {b.batchNumber}</p>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{b.quantity} {b.product?.unit}</p>
                                                </div>
                                                <ExpiryBadge expiryDate={b.expiryDate} daysToExpiry={b.daysToExpiry} />
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* EXPIRING TAB */}
            {tab === 'expiring' && (
                <div className="space-y-3">
                    {expiring.length === 0 ? (
                        <Card padding="lg"><p className="text-center text-gray-500 py-8 text-sm">Nenhum lote a expirar nos próximos 30 dias.</p></Card>
                    ) : expiring.map((b: ProductBatch & { daysToExpiry?: number | null; isExpired?: boolean }) => {
                        const cfg = STATUS_CFG[b.status] || STATUS_CFG.active;
                        const Icon = cfg.icon;
                        return (
                            <div key={b.id} className={cn('rounded-lg border-2 p-4 flex items-center justify-between gap-4', cfg.bg)}>
                                <div className="flex items-center gap-3">
                                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', b.isExpired ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{b.product?.name}</p>
                                        <p className="text-xs text-gray-500">Lote: {b.batchNumber} · {b.quantity} {b.product?.unit}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <ExpiryBadge expiryDate={b.expiryDate} daysToExpiry={b.daysToExpiry} />
                                    <p className="text-xs text-gray-400 mt-0.5">{b.warehouse?.name || 'Sem armazém'}</p>
                                </div>
                                <button onClick={() => handleEdit(b)} className="p-2 rounded text-gray-400 hover:text-primary-600 transition-colors">
                                    <HiOutlinePencil className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* LIST TAB */}
            {tab === 'list' && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input className="flex-1" placeholder="Pesquisar lote, produto..." leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                            value={search} onChange={e => setSearch(e.target.value)} />
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            className="rounded-lg border border-gray-300 dark:border-dark-700 bg-white dark:bg-dark-800 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm appearance-none cursor-pointer">
                            <option value="">FILTRO: TODOS</option>
                            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label.toUpperCase()}</option>)}
                        </select>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} height={64} />)}</div>
                    ) : batches.length === 0 ? (
                        <Card padding="lg">
                            <div className="text-center py-10">
                                <HiOutlineCube className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm mb-4">Nenhum lote encontrado.</p>
                                <Button onClick={() => setModalOpen(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Registar Primeiro Lote</Button>
                            </div>
                        </Card>
                    ) : (
                        <Card padding="md">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-dark-700">
                                            {['Nº Lote', 'Produto', 'Qty', 'Custo/Un', 'Validade', 'Entrada', 'Armazém', 'Estado', ''].map(h => (
                                                <th key={h} className="text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pb-4 pr-4">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                        {batches.map(b => {
                                            const cfg = STATUS_CFG[b.status] || STATUS_CFG.active;
                                            return (
                                                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                                    <td className="py-4 pr-4 font-mono text-xs font-black text-primary-600">{b.batchNumber}</td>
                                                    <td className="py-4 pr-4">
                                                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{b.product?.name || ''}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{b.product?.code} · {b.product?.category}</p>
                                                    </td>
                                                    <td className="py-4 pr-4 font-black text-gray-900 dark:text-white">{b.quantity} <span className="text-[10px] text-gray-400 uppercase font-black">{b.product?.unit}</span></td>
                                                    <td className="py-4 pr-4 font-black text-gray-900 dark:text-white tracking-tighter">{formatCurrency(Number(b.costPrice))}</td>
                                                    <td className="py-4 pr-4"><ExpiryBadge expiryDate={b.expiryDate} /></td>
                                                    <td className="py-4 pr-4 text-[11px] text-gray-400 font-bold uppercase">{b.receivedDate ? new Date(b.receivedDate).toLocaleDateString('pt-MZ') : ''}</td>
                                                    <td className="py-4 pr-4 text-[11px] text-gray-500 font-bold uppercase">{b.warehouse?.name || ''}</td>
                                                    <td className="py-4 pr-4"><Badge variant={cfg.color}>{cfg.label}</Badge></td>
                                                    <td className="py-3">
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => handleEdit(b)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><HiOutlinePencil className="w-4 h-4" /></button>
                                                            <button onClick={() => setDeleting(b)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><HiOutlineTrash className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {modalOpen && <BatchFormModal open={modalOpen} onClose={handleCloseModal} editing={editing} defaultProductId={defaultProductId} />}

            {deleting && (
                <ConfirmationModal
                    isOpen={!!deleting}
                    onClose={() => setDeleting(null)}
                    onConfirm={handleDelete}
                    title="Eliminar Lote"
                    message={`Tem a certeza que deseja eliminar o lote "${deleting.batchNumber}"? Esta ação apenas é possível se o lote não estiver em uso em vendas.`}
                    confirmText="Eliminar"
                    cancelText="Cancelar"
                    variant="danger"
                    isLoading={deleteBatch.isLoading}
                />
            )}
        </div>
    );
}
