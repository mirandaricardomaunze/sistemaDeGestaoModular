import { useState } from 'react';
import { Card, Button, Input, Modal, Badge } from '../ui';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineRefresh,
    HiOutlineCheckCircle, HiOutlineChartBar, HiOutlineCurrencyDollar,
    HiOutlineStar, HiOutlineInformationCircle,
} from 'react-icons/hi';
import {
    useIvaDashboard, useIvaRates,
    useCreateIvaRate, useUpdateIvaRate, useDeleteIvaRate,
} from '../../hooks/useIva';
import type { IvaRate, CreateIvaRateDto } from '../../services/api';
import { formatCurrency, cn } from '../../utils';

// ============================================================================
// RATE BADGE
// ============================================================================

function RateBadge({ rate }: { rate: number }) {
    return (
        <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
            rate === 0 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
            rate <= 5 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
        )}>
            {rate}%
        </span>
    );
}

// ============================================================================
// FORM MODAL
// ============================================================================

const EMPTY: CreateIvaRateDto = {
    code: '', name: '', description: '', rate: 16,
    isDefault: false, applicableCategories: [], isActive: true,
};

function IvaRateModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: IvaRate | null }) {
    const [form, setForm] = useState<CreateIvaRateDto>(
        editing ? {
            code: editing.code, name: editing.name, description: editing.description || '',
            rate: Number(editing.rate), isDefault: editing.isDefault,
            applicableCategories: editing.applicableCategories,
            isActive: editing.isActive,
            effectiveFrom: editing.effectiveFrom?.split('T')[0],
            effectiveTo: editing.effectiveTo?.split('T')[0] || '',
        } : EMPTY
    );
    const [catInput, setCatInput] = useState('');
    const create = useCreateIvaRate();
    const update = useUpdateIvaRate();

    const addCat = () => {
        const trimmed = catInput.trim().toLowerCase();
        if (trimmed && !form.applicableCategories?.includes(trimmed)) {
            setForm(p => ({ ...p, applicableCategories: [...(p.applicableCategories || []), trimmed] }));
        }
        setCatInput('');
    };

    const removeCat = (cat: string) =>
        setForm(p => ({ ...p, applicableCategories: (p.applicableCategories || []).filter(c => c !== cat) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.code || !form.name) return;
        try {
            if (editing) {
                await update.mutateAsync({ id: editing.id, data: form });
            } else {
                await create.mutateAsync(form);
            }
            onClose();
        } catch { /* handled by hook */ }
    };

    const busy = create.isLoading || update.isLoading;

    return (
        <Modal isOpen={open} onClose={onClose} title={editing ? 'Editar Taxa IVA' : 'Nova Taxa IVA'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Código *" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                        placeholder="Ex: NORMAL, REDUZIDA, ISENTO" required />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taxa (%) *</label>
                        <input type="number" min={0} max={100} step={0.01} required value={form.rate}
                            onChange={e => setForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))}
                            className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                </div>
                <Input label="Nome / Descrição curta *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Taxa Normal (16%)" required />
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição completa</label>
                    <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Vigência: De" type="date" value={form.effectiveFrom || ''} onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))} />
                    <Input label="Vigência: Até" type="date" value={form.effectiveTo || ''} onChange={e => setForm(p => ({ ...p, effectiveTo: e.target.value }))} />
                </div>

                {/* Categories */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Categorias aplicáveis
                        <span className="text-xs text-gray-400 ml-1">(deixe vazio = todas)</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                        <input value={catInput} onChange={e => setCatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } }}
                            placeholder="Ex: alimentos, saúde..."
                            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        <Button type="button" size="sm" variant="outline" onClick={addCat}>Adicionar</Button>
                    </div>
                    {(form.applicableCategories || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {(form.applicableCategories || []).map(cat => (
                                <span key={cat} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                    {cat}
                                    <button type="button" onClick={() => removeCat(cat)} className="hover:text-red-500">×</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Flags */}
                <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Taxa padrão</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Activa</span>
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" isLoading={busy}>{editing ? 'Guardar' : 'Criar Taxa'}</Button>
                </div>
            </form>
        </Modal>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IvaManager() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<IvaRate | null>(null);
    const [deleting, setDeleting] = useState<IvaRate | null>(null);

    const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useIvaDashboard();
    const { data: ratesData, isLoading, refetch } = useIvaRates();
    const deleteRate = useDeleteIvaRate();

    const rates: IvaRate[] = ratesData?.data || [];
    const summary = dashboard?.summary;
    const breakdown = dashboard?.breakdown || [];

    const handleEdit = (rate: IvaRate) => { setEditing(rate); setModalOpen(true); };
    const handleCloseModal = () => { setModalOpen(false); setEditing(null); refetch(); refetchDash(); };
    const handleDelete = async () => {
        if (!deleting) return;
        try { await deleteRate.mutateAsync(deleting.id); refetch(); refetchDash(); } catch { }
        setDeleting(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Taxas IVA</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Gerir taxas de IVA aplicadas a produtos e facturas</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { refetch(); refetchDash(); }} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>Atualizar</Button>
                    <Button onClick={() => setModalOpen(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Nova Taxa</Button>
                </div>
            </div>

            {/* Dashboard Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card padding="md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <HiOutlineChartBar className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total de Taxas</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalRates}</p>
                            </div>
                        </div>
                    </Card>
                    <Card padding="md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Taxas Activas</p>
                                <p className="text-2xl font-bold text-emerald-600">{summary.activeRates}</p>
                            </div>
                        </div>
                    </Card>
                    <Card padding="md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <HiOutlineCurrencyDollar className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">IVA Cobrado</p>
                                <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalIvaCollected)}</p>
                            </div>
                        </div>
                    </Card>
                    <Card padding="md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <HiOutlineStar className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Taxa Padrão</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {summary.defaultRate ? `${Number(summary.defaultRate.rate)}%` : '—'}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Breakdown Chart */}
            {breakdown.length > 0 && (
                <Card padding="md">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Distribuição por Taxa</h3>
                    <div className="space-y-3">
                        {breakdown.map((r: any) => (
                            <div key={r.id} className="flex items-center gap-4">
                                <div className="w-24 flex-shrink-0">
                                    <RateBadge rate={r.rate} />
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{r.code}</p>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>{r.productCount} produtos</span>
                                        <span>{formatCurrency(r.ivaCollected)} cobrado</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-primary-500 transition-all"
                                            style={{ width: `${summary?.totalIvaCollected > 0 ? (r.ivaCollected / summary.totalIvaCollected) * 100 : 0}%` }} />
                                    </div>
                                </div>
                                <Badge variant={r.isActive ? 'success' : 'gray'}>{r.isActive ? 'Activa' : 'Inactiva'}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Rates Table */}
            <Card padding="md">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Taxas Configuradas</h3>
                {isLoading ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-dark-700 rounded-xl animate-pulse" />)}</div>
                ) : rates.length === 0 ? (
                    <div className="text-center py-10">
                        <HiOutlineInformationCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm mb-4">Nenhuma taxa configurada.</p>
                        <Button onClick={() => setModalOpen(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Criar Primeira Taxa</Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-dark-700">
                                    {['Código', 'Nome', 'Taxa', 'Produtos', 'Padrão', 'Estado', 'Vigência', ''].map(h => (
                                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 pr-4">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {rates.map((rate) => (
                                    <tr key={rate.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                        <td className="py-3 pr-4 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">{rate.code}</td>
                                        <td className="py-3 pr-4">
                                            <p className="font-medium text-gray-900 dark:text-white">{rate.name}</p>
                                            {rate.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{rate.description}</p>}
                                        </td>
                                        <td className="py-3 pr-4"><RateBadge rate={Number(rate.rate)} /></td>
                                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{rate._count?.products ?? 0}</td>
                                        <td className="py-3 pr-4">
                                            {rate.isDefault && <HiOutlineStar className="w-5 h-5 text-amber-500" />}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <Badge variant={rate.isActive ? 'success' : 'gray'}>
                                                {rate.isActive ? 'Activa' : 'Inactiva'}
                                            </Badge>
                                        </td>
                                        <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">
                                            {new Date(rate.effectiveFrom).toLocaleDateString('pt-MZ')}
                                            {rate.effectiveTo && ` → ${new Date(rate.effectiveTo).toLocaleDateString('pt-MZ')}`}
                                        </td>
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleEdit(rate)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDeleting(rate)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {modalOpen && <IvaRateModal open={modalOpen} onClose={handleCloseModal} editing={editing} />}

            {deleting && (
                <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Eliminar Taxa IVA">
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                        Tem a certeza que quer eliminar a taxa <strong>{deleting.name}</strong> ({Number(deleting.rate)}%)?
                    </p>
                    <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-6">
                        Apenas possível se não estiver em uso em produtos.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={handleDelete} isLoading={deleteRate.isLoading}>Eliminar</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
