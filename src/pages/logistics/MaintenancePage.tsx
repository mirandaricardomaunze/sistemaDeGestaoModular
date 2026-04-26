/**
 * Vehicle Maintenance Management Page
 * List, create, edit, and manage vehicle maintenance records
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { PageHeader } from '../../components/ui';

const getTypeBadge = (type: string, t: any) => {
    const typeMap: Record<string, { label: string, color: string }> = {
        preventive: { label: t('logistics_module.maintenance.types.preventive'), color: 'primary' },
        corrective: { label: t('logistics_module.maintenance.types.corrective'), color: 'warning' },
        inspection: { label: t('logistics_module.maintenance.types.inspection'), color: 'info' },
        emergency: { label: t('logistics_module.maintenance.types.emergency'), color: 'danger' }
    };
    const mt = typeMap[type];
    return <Badge variant={mt?.color as any || 'gray'}>{mt?.label || type}</Badge>;
};

const getStatusBadge = (status: string, t: any) => {
    const statusMap: Record<string, { label: string, color: string }> = {
        scheduled: { label: t('logistics_module.maintenance.statuses.scheduled'), color: 'warning' },
        in_progress: { label: t('logistics_module.maintenance.statuses.in_progress'), color: 'primary' },
        completed: { label: t('logistics_module.maintenance.statuses.completed'), color: 'success' },
        cancelled: { label: t('logistics_module.maintenance.statuses.cancelled'), color: 'gray' }
    };
    const s = statusMap[status];
    return <Badge variant={s?.color as any || 'gray'}>{s?.label || status}</Badge>;
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);
};

const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-MZ');
};

export default function MaintenancePage() {
    const { t } = useTranslation();
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
            <PageHeader
                title={t('logistics_module.maintenance.title')}
                subtitle={t('logistics_module.maintenance.subtitle')}
                icon={<HiOutlineWrenchScrewdriver />}
                actions={
                    <div className="flex gap-2 items-center">
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                            onClick={() => refetch()}
                        >
                            {t('common.update')}
                        </Button>
                        <Button
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            onClick={() => openModal()}
                        >
                            {t('logistics_module.maintenance.add')}
                        </Button>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-primary-100/40 dark:bg-primary-900/20 border border-primary-200/50 dark:border-primary-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary-200/60 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineWrenchScrewdriver className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-primary-900 dark:text-white leading-none">{stats.total}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-600/70 dark:text-primary-400/60 mt-1">{t('logistics_module.maintenance.totalRecords')}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-warning-100/40 dark:bg-warning-900/20 border border-warning-200/50 dark:border-warning-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-warning-200/60 dark:bg-warning-900/40 text-warning-700 dark:text-warning-300 shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineClock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-warning-900 dark:text-white leading-none">{stats.scheduled}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-warning-600/70 dark:text-warning-400/60 mt-1">{t('logistics_module.maintenance.scheduled')}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-success-100/40 dark:bg-success-900/20 border border-success-200/50 dark:border-success-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success-200/60 dark:bg-success-900/40 text-success-700 dark:text-success-300 shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineCheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-success-900 dark:text-white leading-none">{stats.completed}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-success-600/70 dark:text-success-400/60 mt-1">{t('logistics_module.maintenance.completed')}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-danger-100/40 dark:bg-danger-900/20 border border-danger-200/50 dark:border-danger-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-danger-200/60 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300 shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineCurrencyDollar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-danger-900 dark:text-white leading-none">{formatCurrency(stats.totalCost)}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-danger-600/70 dark:text-danger-400/60 mt-1">{t('logistics_module.maintenance.totalCost')}</p>
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
                            <h3 className="font-semibold text-gray-900 dark:text-white">{t('logistics_module.maintenance.upcoming')}</h3>
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
                        <input
                            placeholder={t('logistics_module.maintenance.searchPlaceholder')}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: t('logistics_module.maintenance.allVehicles') }, ...(vehiclesData?.data?.map((v: Vehicle) => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })) || [])]}
                        value={vehicleFilter}
                        onChange={(e) => {
                            setVehicleFilter(e.target.value);
                            setPage(1);
                        }}
                    />
                    <Select
                        options={[
                            { value: '', label: t('common.all_statuses') },
                            { value: 'scheduled', label: t('logistics_module.maintenance.statuses.scheduled') },
                            { value: 'in_progress', label: t('logistics_module.maintenance.statuses.in_progress') },
                            { value: 'completed', label: t('logistics_module.maintenance.statuses.completed') },
                            { value: 'cancelled', label: t('logistics_module.maintenance.statuses.cancelled') }
                        ]}
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {filteredMaintenances.length} {t('logistics_module.maintenance.registos')}
                    </div>
                </div>
            </Card>

            {/* Maintenances Table */}
            <Card variant="glass" padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                <th className="p-4 font-semibold">{t('logistics_module.deliveries.vehicle')}</th>
                                <th className="p-4 font-semibold">{t('common.type')}</th>
                                <th className="p-4 font-semibold">{t('common.description')}</th>
                                <th className="p-4 font-semibold">{t('common.cost')}</th>
                                <th className="p-4 font-semibold">{t('common.date')}</th>
                                <th className="p-4 font-semibold">{t('logistics_module.maintenance.nextDate')}</th>
                                <th className="p-4 font-semibold">{t('common.status')}</th>
                                <th className="p-4 font-semibold text-center">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-dark-700">
                            {filteredMaintenances.map((maintenance) => (
                                <tr key={maintenance.id} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium">{maintenance.vehicle?.plate || '-'}</div>
                                        <div className="text-sm text-gray-500">{maintenance.vehicle?.brand} {maintenance.vehicle?.model}</div>
                                    </td>
                                    <td className="p-4">{getTypeBadge(maintenance.type, t)}</td>
                                    <td className="p-4">
                                        <div className="max-w-xs truncate">{maintenance.description}</div>
                                        {maintenance.provider && (
                                            <div className="text-sm text-gray-500">{maintenance.provider}</div>
                                        )}
                                    </td>
                                    <td className="p-4 font-medium text-primary-600">{formatCurrency(Number(maintenance.cost))}</td>
                                    <td className="p-4 text-sm">{formatDate(maintenance.date)}</td>
                                    <td className="p-4 text-sm">{maintenance.nextDate ? formatDate(maintenance.nextDate) : '-'}</td>
                                    <td className="p-4">{getStatusBadge(maintenance.status, t)}</td>
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
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('logistics_module.parcels.notFound')}</h3>
                        <p className="text-gray-500 dark:text-gray-400">{t('logistics_module.parcels.startRegister')}</p>
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
                title={editingMaintenance ? t('logistics_module.maintenance.edit') : t('logistics_module.maintenance.add')}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Select
                        label={`${t('logistics_module.deliveries.vehicle')} *`}
                        options={[{ value: '', label: t('common.select') }, ...(vehiclesData?.data?.map((v: Vehicle) => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })) || [])]}
                        value={formData.vehicleId}
                        onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label={`${t('common.type')} *`}
                            options={[
                                { value: 'preventive', label: t('logistics_module.maintenance.types.preventive') },
                                { value: 'corrective', label: t('logistics_module.maintenance.types.corrective') },
                                { value: 'inspection', label: t('logistics_module.maintenance.types.inspection') },
                                { value: 'emergency', label: t('logistics_module.maintenance.types.emergency') }
                            ]}
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            required
                        />
                        <Select
                            label={`${t('common.status')} *`}
                            options={[
                                { value: 'scheduled', label: t('logistics_module.maintenance.statuses.scheduled') },
                                { value: 'in_progress', label: t('logistics_module.maintenance.statuses.in_progress') },
                                { value: 'completed', label: t('logistics_module.maintenance.statuses.completed') },
                                { value: 'cancelled', label: t('logistics_module.maintenance.statuses.cancelled') }
                            ]}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            required
                        />
                    </div>

                    <Input
                        label={`${t('common.description')} *`}
                        placeholder="Descreva a manutenção realizada..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label={`${t('common.cost')} (MZN) *`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.cost}
                            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                            required
                        />
                        <Input
                            label={`${t('common.date')} *`}
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                        <Input
                            label={t('logistics_module.maintenance.nextDate')}
                            type="date"
                            value={formData.nextDate}
                            onChange={(e) => setFormData({ ...formData, nextDate: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={t('logistics_module.maintenance.mileage')}
                            type="number"
                            min="0"
                            placeholder="Ex: 50000"
                            value={formData.mileageAt}
                            onChange={(e) => setFormData({ ...formData, mileageAt: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.maintenance.provider')}
                            placeholder={t('logistics_module.maintenance.placeholderProvider')}
                            value={formData.provider}
                            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                        />
                    </div>

                    <Input
                        label={t('common.notes')}
                        placeholder="Notas adicionais..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading || updateMutation.isLoading}>
                            {editingMaintenance ? t('common.save') : t('logistics_module.maintenance.add')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={t('common.confirm')}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        {t('messages.confirmDelete')}
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            className="flex-1"
                            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                            isLoading={deleteMutation.isLoading}
                        >
                            {t('common.delete')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
