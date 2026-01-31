/**
 * Vehicle Maintenance Management Page
 * List, create, edit, and manage vehicle maintenance records
 */

import { useState, useMemo } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, Pagination } from '../../components/ui';
import {
    HiOutlineWrenchScrewdriver,
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineCurrencyDollar
} from 'react-icons/hi2';
import { useVehicleMaintenances, useCreateMaintenance, useUpdateMaintenance, useDeleteMaintenance, useVehicles } from '../../hooks/useLogistics';
import type { VehicleMaintenance, Vehicle } from '../../services/api/logistics.api';

const maintenanceTypes = [
    { value: 'preventive', label: 'Preventiva', color: 'primary' },
    { value: 'corrective', label: 'Correctiva', color: 'warning' },
    { value: 'inspection', label: 'Inspecção', color: 'info' },
    { value: 'emergency', label: 'Emergência', color: 'danger' }
];

const maintenanceStatuses = [
    { value: 'scheduled', label: 'Agendada', color: 'warning' },
    { value: 'in_progress', label: 'Em Andamento', color: 'primary' },
    { value: 'completed', label: 'Concluída', color: 'success' },
    { value: 'cancelled', label: 'Cancelada', color: 'gray' }
];

const getTypeBadge = (type: string) => {
    const t = maintenanceTypes.find(mt => mt.value === type);
    return <Badge variant={t?.color as any || 'gray'}>{t?.label || type}</Badge>;
};

const getStatusBadge = (status: string) => {
    const s = maintenanceStatuses.find(ms => ms.value === status);
    return <Badge variant={s?.color as any || 'gray'}>{s?.label || status}</Badge>;
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);
};

const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-MZ');
};

export default function MaintenancePage() {
    const [search, setSearch] = useState('');
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMaintenance, setEditingMaintenance] = useState<VehicleMaintenance | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data: maintenancesData, isLoading, refetch } = useVehicleMaintenances({
        vehicleId: vehicleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: pageSize
    });
    const { data: vehiclesData } = useVehicles();

    const createMutation = useCreateMaintenance();
    const updateMutation = useUpdateMaintenance();
    const deleteMutation = useDeleteMaintenance();

    const [formData, setFormData] = useState({
        vehicleId: '',
        type: 'preventive',
        description: '',
        cost: '',
        date: new Date().toISOString().split('T')[0],
        nextDate: '',
        mileageAt: '',
        status: 'scheduled',
        provider: '',
        notes: ''
    });

    const resetForm = () => {
        setFormData({
            vehicleId: '',
            type: 'preventive',
            description: '',
            cost: '',
            date: new Date().toISOString().split('T')[0],
            nextDate: '',
            mileageAt: '',
            status: 'scheduled',
            provider: '',
            notes: ''
        });
        setEditingMaintenance(null);
    };

    const openModal = (maintenance?: VehicleMaintenance) => {
        if (maintenance) {
            setEditingMaintenance(maintenance);
            setFormData({
                vehicleId: maintenance.vehicleId,
                type: maintenance.type,
                description: maintenance.description,
                cost: maintenance.cost.toString(),
                date: maintenance.date.split('T')[0],
                nextDate: maintenance.nextDate?.split('T')[0] || '',
                mileageAt: maintenance.mileageAt?.toString() || '',
                status: maintenance.status,
                provider: maintenance.provider || '',
                notes: maintenance.notes || ''
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const data = {
            vehicleId: formData.vehicleId,
            type: formData.type as VehicleMaintenance['type'],
            description: formData.description,
            cost: parseFloat(formData.cost) || 0,
            date: formData.date,
            nextDate: formData.nextDate || undefined,
            mileageAt: formData.mileageAt ? parseInt(formData.mileageAt) : undefined,
            status: formData.status as VehicleMaintenance['status'],
            provider: formData.provider || undefined,
            notes: formData.notes || undefined
        };

        if (editingMaintenance) {
            await updateMutation.mutateAsync({ id: editingMaintenance.id, data });
        } else {
            await createMutation.mutateAsync(data);
        }

        setIsModalOpen(false);
        resetForm();
    };

    const handleDelete = async (id: string) => {
        await deleteMutation.mutateAsync(id);
        setDeleteConfirm(null);
    };

    // Filter and search
    const filteredMaintenances = useMemo(() => {
        if (!maintenancesData?.data) return [];
        return maintenancesData.data.filter(m => {
            if (search) {
                const searchLower = search.toLowerCase();
                const matchDesc = m.description.toLowerCase().includes(searchLower);
                const matchProvider = m.provider?.toLowerCase().includes(searchLower);
                const matchVehicle = m.vehicle?.plate.toLowerCase().includes(searchLower);
                if (!matchDesc && !matchProvider && !matchVehicle) return false;
            }
            return true;
        });
    }, [maintenancesData?.data, search]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = maintenancesData?.pagination?.total || 0;
        if (!maintenancesData?.data) return { total, scheduled: 0, completed: 0, totalCost: 0 };
        return {
            total,
            scheduled: maintenancesData.data.filter(m => m.status === 'scheduled').length,
            completed: maintenancesData.data.filter(m => m.status === 'completed').length,
            totalCost: maintenancesData.data.filter(m => m.status === 'completed').reduce((sum, m) => sum + Number(m.cost), 0)
        };
    }, [maintenancesData]);

    // Upcoming maintenances (next 30 days)
    const upcomingMaintenances = useMemo(() => {
        if (!maintenancesData?.data) return [];
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return maintenancesData.data
            .filter(m => m.status === 'scheduled' && m.nextDate)
            .filter(m => {
                const nextDate = new Date(m.nextDate!);
                return nextDate >= now && nextDate <= thirtyDaysLater;
            })
            .sort((a, b) => new Date(a.nextDate!).getTime() - new Date(b.nextDate!).getTime());
    }, [maintenancesData]);

    if (isLoading) {
        return <LoadingSpinner size="xl" className="h-96" />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manutenção de Veículos</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie as manutenções da frota</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetch()}>
                        Actualizar
                    </Button>
                    <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => openModal()}>
                        Nova Manutenção
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary-100 dark:bg-primary-900/30">
                            <HiOutlineWrenchScrewdriver className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-xs text-gray-500">Total Registos</p>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-warning-100 dark:bg-warning-900/30">
                            <HiOutlineClock className="w-6 h-6 text-warning-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.scheduled}</p>
                            <p className="text-xs text-gray-500">Agendadas</p>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success-100 dark:bg-success-900/30">
                            <HiOutlineCheckCircle className="w-6 h-6 text-success-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.completed}</p>
                            <p className="text-xs text-gray-500">Concluídas</p>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-danger-100 dark:bg-danger-900/30">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-danger-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</p>
                            <p className="text-xs text-gray-500">Custo Total</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Upcoming Alerts */}
            {upcomingMaintenances.length > 0 && (
                <Card variant="glass" className="p-4 border-l-4 border-warning-500">
                    <div className="flex items-start gap-3">
                        <HiOutlineExclamationTriangle className="w-6 h-6 text-warning-500 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Manutenções Próximas (30 dias)</h3>
                            <div className="mt-2 space-y-1">
                                {upcomingMaintenances.slice(0, 3).map(m => (
                                    <p key={m.id} className="text-sm text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">{m.vehicle?.plate}</span> - {m.description} ({formatDate(m.nextDate!)})
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Pesquisar descrição, fornecedor..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: 'Todos os Veículos' }, ...(vehiclesData?.data?.map((v: Vehicle) => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })) || [])]}
                        value={vehicleFilter}
                        onChange={(e) => {
                            setVehicleFilter(e.target.value);
                            setPage(1);
                        }}
                    />
                    <Select
                        options={[{ value: '', label: 'Todos os Estados' }, ...maintenanceStatuses.map(s => ({ value: s.value, label: s.label }))]}
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {filteredMaintenances.length} registo(s)
                    </div>
                </div>
            </Card>

            {/* Maintenances Table */}
            <Card variant="glass" padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                <th className="p-4 font-semibold">Veículo</th>
                                <th className="p-4 font-semibold">Tipo</th>
                                <th className="p-4 font-semibold">Descrição</th>
                                <th className="p-4 font-semibold">Custo</th>
                                <th className="p-4 font-semibold">Data</th>
                                <th className="p-4 font-semibold">Próxima</th>
                                <th className="p-4 font-semibold">Estado</th>
                                <th className="p-4 font-semibold text-center">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-dark-700">
                            {filteredMaintenances.map((maintenance) => (
                                <tr key={maintenance.id} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium">{maintenance.vehicle?.plate || '-'}</div>
                                        <div className="text-sm text-gray-500">{maintenance.vehicle?.brand} {maintenance.vehicle?.model}</div>
                                    </td>
                                    <td className="p-4">{getTypeBadge(maintenance.type)}</td>
                                    <td className="p-4">
                                        <div className="max-w-xs truncate">{maintenance.description}</div>
                                        {maintenance.provider && (
                                            <div className="text-sm text-gray-500">{maintenance.provider}</div>
                                        )}
                                    </td>
                                    <td className="p-4 font-medium text-primary-600">{formatCurrency(Number(maintenance.cost))}</td>
                                    <td className="p-4 text-sm">{formatDate(maintenance.date)}</td>
                                    <td className="p-4 text-sm">{maintenance.nextDate ? formatDate(maintenance.nextDate) : '-'}</td>
                                    <td className="p-4">{getStatusBadge(maintenance.status)}</td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => openModal(maintenance)}>
                                                <HiOutlinePencil className="w-5 h-5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-danger-500" onClick={() => setDeleteConfirm(maintenance.id)}>
                                                <HiOutlineTrash className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredMaintenances.length === 0 && (
                    <div className="p-12 text-center">
                        <HiOutlineWrenchScrewdriver className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma manutenção encontrada</h3>
                        <p className="text-gray-500 dark:text-gray-400">Registe uma nova manutenção para começar.</p>
                    </div>
                )}

                {/* Pagination */}
                {maintenancesData && maintenancesData.pagination.total > 0 && (
                    <div className="p-4 border-t dark:border-dark-700">
                        <Pagination
                            currentPage={page}
                            totalItems={maintenancesData.pagination.total}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                            itemsPerPageOptions={[10, 20, 50, 100]}
                        />
                    </div>
                )}
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingMaintenance ? 'Editar Manutenção' : 'Nova Manutenção'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Select
                        label="Veículo *"
                        options={[{ value: '', label: 'Seleccionar veículo' }, ...(vehiclesData?.data?.map((v: Vehicle) => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })) || [])]}
                        value={formData.vehicleId}
                        onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Tipo *"
                            options={maintenanceTypes.map(t => ({ value: t.value, label: t.label }))}
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            required
                        />
                        <Select
                            label="Estado *"
                            options={maintenanceStatuses.map(s => ({ value: s.value, label: s.label }))}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            required
                        />
                    </div>

                    <Input
                        label="Descrição *"
                        placeholder="Descreva a manutenção realizada..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Custo (MZN) *"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.cost}
                            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                            required
                        />
                        <Input
                            label="Data *"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                        <Input
                            label="Próxima Manutenção"
                            type="date"
                            value={formData.nextDate}
                            onChange={(e) => setFormData({ ...formData, nextDate: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Quilometragem"
                            type="number"
                            min="0"
                            placeholder="Ex: 50000"
                            value={formData.mileageAt}
                            onChange={(e) => setFormData({ ...formData, mileageAt: e.target.value })}
                        />
                        <Input
                            label="Fornecedor/Oficina"
                            placeholder="Nome da oficina..."
                            value={formData.provider}
                            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Observações"
                        placeholder="Notas adicionais..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading || updateMutation.isLoading}>
                            {editingMaintenance ? 'Guardar Alterações' : 'Registar Manutenção'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Confirmar Eliminação"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Tem certeza que deseja eliminar este registo de manutenção? Esta acção não pode ser desfeita.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            className="flex-1"
                            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                            isLoading={deleteMutation.isLoading}
                        >
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
