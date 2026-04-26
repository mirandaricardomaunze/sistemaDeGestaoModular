import { useState } from 'react';
import { Card, Button, Input, Modal, Badge, Textarea, PageHeader } from '../../components/ui';
import {
    HiOutlinePlus, HiOutlineRefresh, HiOutlinePencil, HiOutlineTrash,
    HiOutlineSearch, HiOutlineUsers, HiOutlineCheckCircle,
} from 'react-icons/hi';
import { HiOutlineCake } from 'react-icons/hi2';
import { cn } from '../../utils/helpers';
import {
    useRestaurantTables, useCreateRestaurantTable,
    useUpdateRestaurantTable, useDeleteRestaurantTable, useUpdateTableStatus,
} from '../../hooks/useRestaurant';
import type { RestaurantTable } from '../../services/api';

// ============================================================================
// STATUS HELPERS
// ============================================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    available:   { label: 'Disponível',    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20',   border: 'border-emerald-200 dark:border-emerald-800' },
    occupied:    { label: 'Ocupada',       color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20',           border: 'border-red-200 dark:border-red-800' },
    reserved:    { label: 'Reservada',     color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',       border: 'border-amber-200 dark:border-amber-800' },
    maintenance: { label: 'Manutenção',    color: 'text-gray-500',    bg: 'bg-gray-50 dark:bg-gray-900/20',         border: 'border-gray-200 dark:border-gray-700' },
};

// ============================================================================
// TABLE FORM
// ============================================================================

interface TableFormData { number: number; name: string; capacity: number; section: string; notes: string }

const EMPTY_FORM: TableFormData = { number: 0, name: '', capacity: 4, section: '', notes: '' };

function TableFormModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: RestaurantTable | null }) {
    const [form, setForm] = useState<TableFormData>(
        editing ? { number: editing.number, name: editing.name || '', capacity: editing.capacity, section: editing.section || '', notes: editing.notes || '' } : EMPTY_FORM
    );
    const create = useCreateRestaurantTable();
    const update = useUpdateRestaurantTable();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.number) return;
        try {
            if (editing) {
                await update.mutateAsync({ id: editing.id, data: form });
            } else {
                await create.mutateAsync(form);
            }
            onClose();
        } catch { /* toast handled in hook */ }
    };

    const isBusy = create.isLoading || update.isLoading;

    return (
        <Modal isOpen={open} onClose={onClose} title={editing ? 'Editar Mesa' : 'Nova Mesa'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Número *" type="number" value={form.number || ''} onChange={e => setForm(p => ({ ...p, number: Number(e.target.value) }))} min={1} required />
                    <Input label="Capacidade (lugares)" type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))} min={1} max={50} />
                </div>
                <Input label="Nome / Descrição" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Terraço, VIP, Jardim" />
                <Input label="Secção" value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} placeholder="Ex: Interior, Exterior" />
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Informação adicional sobre a mesa..."
                />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" isLoading={isBusy} className="bg-red-600 hover:bg-red-700">
                        {editing ? 'Guardar' : 'Criar Mesa'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ============================================================================
// TABLE CARD
// ============================================================================

function TableCard({ table, onEdit, onDelete }: { table: RestaurantTable; onEdit: () => void; onDelete: () => void }) {
    const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
    const updateStatus = useUpdateTableStatus();

    const nextStatus = table.status === 'available' ? 'occupied' : table.status === 'occupied' ? 'available' : null;

    return (
        <div className={cn('rounded-lg border-2 p-4 transition-all hover:shadow-md', cfg.bg, cfg.border)}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg',
                        table.status === 'available' ? 'bg-emerald-500' :
                        table.status === 'occupied'  ? 'bg-red-500'     :
                        table.status === 'reserved'  ? 'bg-amber-500'   : 'bg-gray-400'
                    )}>
                        {table.number}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{table.name || `Mesa ${table.number}`}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <HiOutlineUsers className="w-3.5 h-3.5" />
                            <span>{table.capacity} lugares</span>
                            {table.section && <span className="mx-1">•</span>}
                            {table.section && <span>{table.section}</span>}
                        </div>
                    </div>
                </div>
                <Badge variant={table.status === 'available' ? 'success' : table.status === 'occupied' ? 'danger' : table.status === 'reserved' ? 'warning' : 'gray'}>
                    {cfg.label}
                </Badge>
            </div>

            <div className="flex items-center gap-2 mt-4">
                {nextStatus && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus.mutate({ id: table.id, status: nextStatus })}
                        isLoading={updateStatus.isLoading}
                        leftIcon={<HiOutlineCheckCircle className="w-4 h-4" />}
                        className="flex-1"
                    >
                        {nextStatus === 'available' ? 'Libertar' : 'Ocupar'}
                    </Button>
                )}
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onEdit} 
                    className="text-gray-500 hover:text-primary-600"
                >
                    <HiOutlinePencil className="w-4 h-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onDelete} 
                    className="text-red-500 hover:text-red-600"
                >
                    <HiOutlineTrash className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RestaurantTables() {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RestaurantTable | null>(null);
    const [deleting, setDeleting] = useState<RestaurantTable | null>(null);

    const { data, isLoading, refetch } = useRestaurantTables({ status: filterStatus || undefined });
    const deleteTable = useDeleteRestaurantTable();

    const tables: RestaurantTable[] = data?.data || [];

    const filtered = tables.filter(t =>
        !search ||
        String(t.number).includes(search) ||
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.section?.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (table: RestaurantTable) => { setEditing(table); setModalOpen(true); };
    const handleCloseModal = () => { setModalOpen(false); setEditing(null); refetch(); };
    const handleDelete = async () => {
        if (!deleting) return;
        try { await deleteTable.mutateAsync(deleting.id); refetch(); } catch { /* handled */ }
        setDeleting(null);
    };

    // Status summary
    const statusCounts = tables.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);

    return (
        <div className="space-y-6 p-2">
            {/* Header */}
            <PageHeader 
                title="Gestão de Mesas"
                subtitle={`${tables.length} mesa${tables.length !== 1 ? 's' : ''} configurada${tables.length !== 1 ? 's' : ''}`}
                icon={<HiOutlineCake className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <>
                        <Button variant="ghost" onClick={() => refetch()} leftIcon={<HiOutlineRefresh className="w-5 h-5 text-primary-600 dark:text-primary-400" />}>Atualizar</Button>
                        <Button onClick={() => setModalOpen(true)} leftIcon={<HiOutlinePlus className="w-5 h-5" />} className="bg-red-600 hover:bg-red-700">Nova Mesa</Button>
                    </>
                }
            />

            {/* Status Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <Button 
                        key={key} 
                        onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                        variant={filterStatus === key ? 'outline' : 'ghost'}
                        className={cn(
                            'h-auto p-3 text-left border-2 transition-all flex flex-col items-start block w-full', 
                            cfg.bg, 
                            filterStatus === key ? cfg.border : 'border-transparent'
                        )}
                    >
                        <p className={cn('text-2xl font-bold', cfg.color)}>{statusCounts[key] || 0}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
                    </Button>
                ))}
            </div>

            {/* Search */}
            <div className="flex gap-3">
                <div className="flex-1">
                    <Input
                        placeholder="Pesquisar mesa, nome ou secção..."
                        leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Tables Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => <Card key={i} padding="md"><div className="animate-pulse space-y-3"><div className="h-12 bg-gray-200 dark:bg-dark-600 rounded" /><div className="h-6 bg-gray-200 dark:bg-dark-600 rounded w-3/4" /></div></Card>)}
                </div>
            ) : filtered.length === 0 ? (
                <Card padding="lg">
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center mx-auto mb-4">
                            <HiOutlineCake className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Sem mesas</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            {search ? 'Nenhuma mesa encontrada com esse critrio.' : 'Adicione a primeira mesa do seu restaurante.'}
                        </p>
                        {!search && (
                            <Button onClick={() => setModalOpen(true)} leftIcon={<HiOutlinePlus className="w-5 h-5" />} className="bg-red-600 hover:bg-red-700">Nova Mesa</Button>
                        )}
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(table => (
                        <TableCard key={table.id} table={table} onEdit={() => handleEdit(table)} onDelete={() => setDeleting(table)} />
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {modalOpen && <TableFormModal open={modalOpen} onClose={handleCloseModal} editing={editing} />}

            {/* Delete Confirm */}
            {deleting && (
                <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Eliminar Mesa">
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Tem a certeza que quer eliminar a <strong>Mesa {deleting.number}</strong>? Esta acção não pode ser desfeita.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={handleDelete} isLoading={deleteTable.isLoading}>Eliminar</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
