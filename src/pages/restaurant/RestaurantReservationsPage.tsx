import { useState, useMemo } from 'react';
import { 
    HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineTrash, 
    HiOutlineCalendar, HiOutlineUsers, HiOutlinePhone, HiOutlineEnvelope,
    HiOutlineChevronRight, HiOutlineClock, HiOutlineMapPin, HiOutlineCheck
} from 'react-icons/hi2';
import { Card, Button, Input, Modal, Badge, LoadingSpinner, Select } from '../../components/ui';
import { 
    useRestaurantReservations, useCreateReservation, useUpdateReservation, 
    useDeleteReservation, useUpdateReservationStatus, useRestaurantTables
} from '../../hooks/useRestaurant';
import type { RestaurantReservation, ReservationStatus } from '../../services/api/restaurant.api';
import { cn } from '../../utils';

// ============================================================================
// RESERVATION MODAL
// ============================================================================

interface ReservationForm {
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    partySize: number;
    tableId: string;
    scheduledAt: string;
    notes: string;
}

const EMPTY_FORM: ReservationForm = {
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    tableId: '',
    scheduledAt: new Date().toISOString().slice(0, 16),
    notes: ''
};

function ReservationModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: RestaurantReservation | null }) {
    const [form, setForm] = useState<ReservationForm>(
        editing ? {
            guestName: editing.guestName,
            guestPhone: editing.guestPhone,
            guestEmail: editing.guestEmail || '',
            partySize: editing.partySize,
            tableId: editing.tableId || '',
            scheduledAt: new Date(editing.scheduledAt).toISOString().slice(0, 16),
            notes: editing.notes || ''
        } : EMPTY_FORM
    );

    const { data: tablesData } = useRestaurantTables();
    const tables = tablesData?.data || [];

    const create = useCreateReservation();
    const update = useUpdateReservation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editing) {
                await update.mutateAsync({ id: editing.id, data: form });
            } else {
                await create.mutateAsync(form);
            }
            onClose();
        } catch (e) { /* error handled by hook toast */ }
    };

    const isBusy = create.isLoading || update.isLoading;

    return (
        <Modal isOpen={open} onClose={onClose} title={editing ? 'Editar Reserva' : 'Nova Reserva'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Nome do Cliente *" 
                        value={form.guestName} 
                        onChange={e => setForm(p => ({ ...p, guestName: e.target.value }))} 
                        required 
                    />
                    <Input 
                        label="Telefone *" 
                        value={form.guestPhone} 
                        onChange={e => setForm(p => ({ ...p, guestPhone: e.target.value }))} 
                        required 
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Email" 
                        type="email"
                        value={form.guestEmail} 
                        onChange={e => setForm(p => ({ ...p, guestEmail: e.target.value }))} 
                    />
                    <Input 
                        label="Nº de Pessoas *" 
                        type="number" 
                        value={form.partySize || ''} 
                        onChange={e => setForm(p => ({ ...p, partySize: Number(e.target.value) }))} 
                        required 
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Data e Hora *" 
                        type="datetime-local" 
                        value={form.scheduledAt} 
                        onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} 
                        required 
                    />
                    <div className="flex flex-col">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mesa Sugerida</label>
                        <Select
                            value={form.tableId}
                            onChange={e => setForm(p => ({ ...p, tableId: e.target.value }))}
                            options={[
                                { value: '', label: 'Seleccionar Mesa' },
                                ...tables.map(t => ({ value: t.id, label: `Mesa ${t.number} — ${t.capacity} Lugares` }))
                            ]}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                    <textarea 
                        className="w-full rounded-xl border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                        rows={3}
                        value={form.notes}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Ex: Alérgico a camarão, mesa no canto..."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" isLoading={isBusy} className="bg-primary-600 hover:bg-primary-700">
                        {editing ? 'Guardar Alterações' : 'Criar Reserva'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ============================================================================
// RESERVATION CARD
// ============================================================================

const STATUS_CONFIG: Record<ReservationStatus, { label: string; variant: any; icon: any }> = {
    pending:   { label: 'Pendente',   variant: 'warning', icon: HiOutlineClock },
    confirmed: { label: 'Confirmada', variant: 'primary', icon: HiOutlineCheck },
    seated:    { label: 'Sentado',    variant: 'success', icon: HiOutlineMapPin },
    cancelled: { label: 'Cancelada',  variant: 'danger',  icon: HiOutlineCalendar },
    no_show:   { label: 'No Show',    variant: 'gray',    icon: HiOutlineCalendar }
};

function ReservationCard({ res, onEdit, onDelete }: { res: RestaurantReservation; onEdit: () => void; onDelete: () => void }) {
    const updateStatus = useUpdateReservationStatus();
    const config = STATUS_CONFIG[res.status];

    const scheduledDate = new Date(res.scheduledAt);
    const isToday = scheduledDate.toDateString() === new Date().toDateString();

    return (
        <Card className={cn(
            "p-5 hover:shadow-md transition-all border border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800",
            isToday && res.status === 'pending' && "ring-1 ring-primary-200 dark:ring-primary-900/40"
        )}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-black text-lg">
                        {res.guestName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white leading-none">{res.guestName}</h3>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <HiOutlinePhone className="w-3 h-3" />
                            {res.guestPhone}
                        </p>
                    </div>
                </div>
                <Badge variant={config.variant} className="flex items-center gap-1">
                    <config.icon className="w-3 h-3" />
                    {config.label}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                <div className="space-y-1">
                    <p className="text-gray-400 font-bold uppercase tracking-widest">Data & Hora</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                        {scheduledDate.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })} • {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-gray-400 font-bold uppercase tracking-widest">Pessoas & Mesa</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                        {res.partySize} Pax • {res.table ? `Mesa ${res.table.number}` : 'S/ Mesa'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-50 dark:border-dark-700">
                {res.status === 'pending' && (
                    <Button size="sm" className="flex-1 bg-primary-600" onClick={() => updateStatus.mutate({ id: res.id, status: 'confirmed' })}>
                        Confirmar
                    </Button>
                )}
                {res.status === 'confirmed' && (
                    <Button size="sm" className="flex-1 bg-emerald-600" onClick={() => updateStatus.mutate({ id: res.id, status: 'seated' })}>
                        Sentar
                    </Button>
                )}
                
                <button onClick={onEdit} className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700">
                    <HiOutlinePencil className="w-4 h-4" />
                </button>
                <button onClick={onDelete} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <HiOutlineTrash className="w-4 h-4" />
                </button>
            </div>
        </Card>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RestaurantReservationsPage() {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RestaurantReservation | null>(null);
    const [deleting, setDeleting] = useState<RestaurantReservation | null>(null);

    const { data: resData, isLoading, refetch } = useRestaurantReservations({
        search: search || undefined,
        status: status || undefined
    });

    const items = resData?.data || [];
    const deleteMutation = useDeleteReservation();

    const handleEdit = (res: RestaurantReservation) => {
        setEditing(res);
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleting) return;
        await deleteMutation.mutateAsync(deleting.id);
        setDeleting(null);
        refetch();
    };

    return (
        <div className="space-y-6 pb-12 animate-fade-in">
             {/* Header Area */}
             <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-1">
                        <HiOutlineCalendar className="w-3 h-3" />
                        Hostess Panel
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Reservas</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestão de reservas de mesas e ocupação prevista.</p>
                </div>
                <Button 
                    onClick={() => setModalOpen(true)}
                    leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                    className="bg-primary-600 hover:bg-primary-700 shadow-lg"
                >
                    Nova Reserva
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex-1 w-full">
                    <Input 
                        placeholder="Pesquisar cliente ou telefone..." 
                        leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-gray-50 dark:bg-dark-700 border-none"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => setStatus('')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                            !status ? "bg-primary-600 text-white" : "bg-gray-50 dark:bg-dark-700 text-gray-500"
                        )}
                    >
                        Todas
                    </button>
                    <button 
                        onClick={() => setStatus('pending')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                            status === 'pending' ? "bg-orange-600 text-white" : "bg-gray-50 dark:bg-dark-700 text-gray-500"
                        )}
                    >
                        Pendentes
                    </button>
                    <button 
                        onClick={() => setStatus('confirmed')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                            status === 'confirmed' ? "bg-primary-600 text-white" : "bg-gray-50 dark:bg-dark-700 text-gray-500"
                        )}
                    >
                        Confirmadas
                    </button>
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="py-24 flex justify-center"><LoadingSpinner size="xl" /></div>
            ) : items.length === 0 ? (
                <div className="py-24 text-center opacity-50">
                    <HiOutlineCalendar className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                    <h2 className="text-xl font-bold">Sem Reservas</h2>
                    <p className="text-gray-500">Nenhuma reserva agendada para este filtro.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map(res => (
                        <ReservationCard 
                            key={res.id} 
                            res={res} 
                            onEdit={() => handleEdit(res)} 
                            onDelete={() => setDeleting(res)} 
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {modalOpen && (
                <ReservationModal 
                    open={modalOpen} 
                    onClose={() => { setModalOpen(false); setEditing(null); refetch(); }} 
                    editing={editing} 
                />
            )}

            {deleting && (
                <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Eliminar Reserva">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Tem certeza que deseja eliminar a reserva de <span className="font-bold">{deleting.guestName}</span>?
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
                            <Button variant="danger" onClick={handleDelete} isLoading={deleteMutation.isLoading}>
                                Sim, Eliminar
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
