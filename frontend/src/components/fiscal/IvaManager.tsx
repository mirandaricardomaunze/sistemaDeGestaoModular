import { useState } from 'react';
import { Card, Button, Input, Modal, Badge, ConfirmationModal, Pagination, SimpleTable, usePagination, Textarea } from '../ui';
import { MetricCard } from '../common/ModuleMetricCard';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineArrowPath,
    HiOutlineCheckCircle, HiOutlineChartBar, HiOutlineCurrencyDollar,
    HiOutlineStar, HiOutlineInformationCircle,
} from 'react-icons/hi2';
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
                    <Input
                        label="Taxa (%) *"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        required
                        value={form.rate}
                        onChange={e => setForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))}
                    />
                </div>
                <Input label="Nome / Descrição curta *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Taxa Normal (16%)" required />
                <Textarea
                    label="Descrição completa"
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Vigência: De" type="date" value={form.effectiveFrom || ''} onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))} />
                    <Input label="Vigência: At" type="date" value={form.effectiveTo || ''} onChange={e => setForm(p => ({ ...p, effectiveTo: e.target.value }))} />
                </div>

                {/* Categories */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Categorias aplicáveis
                        <span className="text-xs text-gray-400 ml-1">(deixe vazio = todas)</span>
                    </label>
                    <div className="flex gap-2 mb-2 items-start">
                        <div className="flex-1">
                            <Input
                                size="sm"
                                value={catInput}
                                onChange={e => setCatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } }}
                                placeholder="Ex: alimentos, saúde..."
                            />
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={addCat}>Adicionar</Button>
                    </div>
                    {(form.applicableCategories || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {(form.applicableCategories || []).map(cat => (
                                <span key={cat} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                    {cat}
                                    <Button variant="ghost" size="sm" type="button" onClick={() => removeCat(cat)} className="p-0.5 hover:text-red-500 text-xs leading-none active:scale-90">×</Button>
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

    const { data: dashboard, isLoading: _dashLoading, refetch: refetchDash } = useIvaDashboard();
    const { data: ratesData, isLoading, refetch } = useIvaRates();
    const deleteRate = useDeleteIvaRate();

    const rates: IvaRate[] = ratesData?.data || [];
    
    const {
        paginatedItems: paginatedRates,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        totalItems,
    } = usePagination(rates, 10);

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
                    <Button variant="ghost" onClick={() => { refetch(); refetchDash(); }} leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}>Atualizar</Button>
                    <Button onClick={() => setModalOpen(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Nova Taxa</Button>
                </div>
            </div>

            {/* Dashboard Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        icon={<HiOutlineChartBar className="w-5 h-5" />}
                        color="primary"
                        value={summary.totalRates}
                        label="Total de Taxas"
                    />
                    <MetricCard
                        icon={<HiOutlineCheckCircle className="w-5 h-5" />}
                        color="emerald"
                        value={summary.activeRates}
                        label="Taxas Activas"
                    />
                    <MetricCard
                        icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                        color="blue"
                        value={summary.totalIvaCollected}
                        label="IVA Cobrado"
                        isCurrency
                    />
                    <MetricCard
                        icon={<HiOutlineStar className="w-5 h-5" />}
                        color="amber"
                        value={summary.defaultRate ? `${Number(summary.defaultRate.rate)}%` : '—'}
                        label="Taxa Padrão"
                    />
                </div>
            )}

            {/* Breakdown Chart */}
            {breakdown.length > 0 && (
                <Card padding="md">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Distribuição por Taxa</h3>
                    <div className="space-y-3">
                        {breakdown.map((r: { id: string; code: string; rate: number; productCount: number; ivaCollected: number; taxableBase: number; invoiceItemCount?: number; isActive?: boolean }) => (
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
                <SimpleTable
                    columns={[
                        { key: 'code', label: 'Código', className: 'pr-4' },
                        { key: 'name', label: 'Nome', className: 'pr-4' },
                        { key: 'rate', label: 'Taxa', className: 'pr-4' },
                        { key: 'products', label: 'Produtos', className: 'pr-4' },
                        { key: 'default', label: 'Padrão', className: 'pr-4' },
                        { key: 'status', label: 'Estado', className: 'pr-4' },
                        { key: 'effective', label: 'Vigência', className: 'pr-4' },
                        { key: 'actions', label: '', className: 'pr-4' },
                    ]}
                    isLoading={isLoading}
                    isEmpty={!isLoading && rates.length === 0}
                    emptyTitle="Nenhuma taxa configurada"
                    emptyDescription="Crie a primeira taxa para começar a classificar produtos."
                    emptyIcon={<HiOutlineInformationCircle className="w-10 h-10 text-gray-300" />}
                    onEmptyAction={() => setModalOpen(true)}
                    emptyActionLabel="Criar Primeira Taxa"
                    minHeight="360px"
                    loadingRows={6}
                    loadingMessage="A carregar taxas..."
                    tableClassName="w-full text-sm"
                    headerRowClassName="border-gray-200 dark:border-dark-700"
                    tbodyClassName="divide-y divide-gray-100 dark:divide-dark-700"
                >
                                {paginatedRates.map((rate) => (
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
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(rate)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 active:scale-95">
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setDeleting(rate)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95">
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                </SimpleTable>
                
                {!isLoading && rates.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-gray-200 dark:border-dark-700">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    </div>
                )}
            </Card>

            {modalOpen && <IvaRateModal open={modalOpen} onClose={handleCloseModal} editing={editing} />}

            {deleting && (
                <ConfirmationModal
                    isOpen={!!deleting}
                    onClose={() => setDeleting(null)}
                    onConfirm={handleDelete}
                    title="Eliminar Taxa IVA"
                    message={`Tem a certeza que deseja eliminar a taxa "${deleting.name}" (${Number(deleting.rate)}%)? Esta ação apenas é possível se a taxa não estiver em uso em produtos.`}
                    confirmText="Eliminar"
                    cancelText="Cancelar"
                    variant="danger"
                    isLoading={deleteRate.isLoading}
                />
            )}
        </div>
    );
}
