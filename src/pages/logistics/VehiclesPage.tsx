/**
 * Vehicles Management Page
 * List, create, edit, and delete vehicles
 */

import { useState } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, Pagination } from '../../components/ui';
import {
    HiOutlineTruck,
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineWrenchScrewdriver,
    HiOutlineExclamationCircle,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2';
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle } from '../../hooks/useLogistics';
import type { Vehicle } from '../../services/api/logistics.api';
import { ExportVehiclesButton } from '../../components/common/ExportButton';
import { PageHeader } from '../../components/ui';
import { useTranslation } from 'react-i18next';

const getStatusBadge = (status: string, t: any) => {
    const variants: Record<string, any> = {
        available: 'success',
        in_use: 'primary',
        maintenance: 'warning',
        inactive: 'danger'
    };
    return <Badge variant={variants[status] || 'gray'}>{t(`logistics_module.vehicles.statuses.${status}`)}</Badge>;
};



/**
 * Returns expiry badge config for a vehicle's insurance.
 * A null return means no alert is needed.
 */
function getInsuranceExpiryAlert(
    insuranceExpiry: string | undefined,
    t: any
): { label: string; className: string } | null {
    if (!insuranceExpiry) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor(
        (new Date(insuranceExpiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 0) {
        return { label: t('logistics_module.vehicles.insuranceExpiry'), className: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 backdrop-blur-sm' };
    }
    if (daysLeft <= 30) {
        return { 
            label: t('logistics_module.vehicles.insuranceDays', { days: daysLeft }), 
            className: daysLeft <= 14 
                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 backdrop-blur-sm' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 backdrop-blur-sm' 
        };
    }
    return null;
}

export default function VehiclesPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [pageSize, setPageSize] = useState(12);

    const vehicleTypes = [
        { value: 'truck', label: t('logistics_module.vehicles.types.truck') },
        { value: 'van', label: t('logistics_module.vehicles.types.van') },
        { value: 'motorcycle', label: t('logistics_module.vehicles.types.motorcycle') },
        { value: 'car', label: t('logistics_module.vehicles.types.car') },
        { value: 'bicycle', label: t('logistics_module.vehicles.types.bicycle') },
        { value: 'other', label: t('logistics_module.vehicles.types.other') }
    ];

    const vehicleStatuses = [
        { value: 'available', label: t('logistics_module.vehicles.statuses.available') },
        { value: 'in_use', label: t('logistics_module.vehicles.statuses.in_use') },
        { value: 'maintenance', label: t('logistics_module.vehicles.statuses.maintenance') },
        { value: 'inactive', label: t('logistics_module.vehicles.statuses.inactive') }
    ];

    const { data, isLoading, refetch } = useVehicles({
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: pageSize
    });

    const createMutation = useCreateVehicle();
    const updateMutation = useUpdateVehicle();
    const deleteMutation = useDeleteVehicle();

    const [formData, setFormData] = useState({
        plate: '',
        brand: '',
        model: '',
        year: '',
        type: 'truck',
        capacity: '',
        capacityUnit: 'kg',
        fuelType: '',
        status: 'available',
        mileage: '0',
        insuranceExpiry: '',
        notes: ''
    });

    const resetForm = () => {
        setFormData({
            plate: '',
            brand: '',
            model: '',
            year: '',
            type: 'truck',
            capacity: '',
            capacityUnit: 'kg',
            fuelType: '',
            status: 'available',
            mileage: '0',
            insuranceExpiry: '',
            notes: ''
        });
        setEditingVehicle(null);
    };

    const openModal = (vehicle?: Vehicle) => {
        if (vehicle) {
            setEditingVehicle(vehicle);
            setFormData({
                plate: vehicle.plate,
                brand: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year?.toString() || '',
                type: vehicle.type,
                capacity: vehicle.capacity?.toString() || '',
                capacityUnit: vehicle.capacityUnit || 'kg',
                fuelType: vehicle.fuelType || '',
                status: vehicle.status,
                mileage: vehicle.mileage.toString(),
                insuranceExpiry: vehicle.insuranceExpiry?.split('T')[0] || '',
                notes: vehicle.notes || ''
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const data = {
            plate: formData.plate.toUpperCase(),
            brand: formData.brand,
            model: formData.model,
            year: formData.year ? parseInt(formData.year) : undefined,
            type: formData.type as Vehicle['type'],
            capacity: formData.capacity ? parseFloat(formData.capacity) : undefined,
            capacityUnit: formData.capacityUnit,
            fuelType: formData.fuelType || undefined,
            status: formData.status as Vehicle['status'],
            mileage: parseInt(formData.mileage) || 0,
            insuranceExpiry: formData.insuranceExpiry || undefined,
            notes: formData.notes || undefined
        };

        if (editingVehicle) {
            await updateMutation.mutateAsync({ id: editingVehicle.id, data });
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

    if (isLoading) {
        return <LoadingSpinner size="xl" className="h-96" />;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('logistics_module.vehicles.title')}
                subtitle={t('logistics_module.vehicles.subtitle')}
                icon={<HiOutlineTruck />}
                actions={
                    <div className="flex gap-2 items-center">
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                            onClick={() => refetch()}
                        >
                            {t('common.refresh')}
                        </Button>
                        <ExportVehiclesButton data={data?.data || []} key="export" />
                        <Button
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            onClick={() => openModal()}
                        >
                            {t('logistics_module.vehicles.add')}
                        </Button>
                    </div>
                }
            />

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder={t('logistics_module.vehicles.searchPlaceholder')}
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: t('common.all') }, ...vehicleStatuses.map(s => ({ value: s.value, label: s.label }))]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <Select
                        options={[{ value: '', label: t('common.all') }, ...vehicleTypes]}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {data?.pagination.total || 0} {t('common.results_found')}
                    </div>
                </div>
            </Card>

            {/* Vehicles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {data?.data.map((vehicle: Vehicle) => (
                    <Card key={vehicle.id} className="bg-white/80 dark:bg-dark-900/40 border border-gray-200/50 dark:border-dark-700/50 shadow-card-strong hover:scale-[1.01] transition-all group overflow-hidden">
                        <div className="p-5 relative">
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors" />

                            <div className="flex items-start justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-primary-200/60 dark:bg-primary-900/40 border border-primary-500/20 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                                        <HiOutlineTruck className="w-6 h-6 text-primary-700 dark:text-primary-300" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-lg text-gray-900 dark:text-white truncate leading-tight">{vehicle.plate}</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500/80 dark:text-gray-400/60 truncate">{vehicle.brand} {vehicle.model}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                    {getStatusBadge(vehicle.status, t)}
                                    {(() => {
                                        const alert = getInsuranceExpiryAlert(vehicle.insuranceExpiry, t);
                                        return alert ? (
                                            <span className={cn("flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm", alert.className)}>
                                                <HiOutlineExclamationTriangle className="w-3 h-3" aria-hidden="true" />
                                                {alert.label}
                                            </span>
                                        ) : null;
                                    })()}
                                </div>
                            </div>

                            <div className="space-y-2 text-xs mb-5 relative z-10">
                                <div className="flex justify-between items-center py-1 border-b border-gray-100/50 dark:border-dark-700/50">
                                    <span className="text-gray-500 font-bold">{t('logistics_module.vehicles.type')}</span>
                                    <span className="font-black text-gray-900 dark:text-white truncate ml-2 bg-gray-100 dark:bg-dark-800 px-2 py-0.5 rounded uppercase text-[10px]">{t(`logistics_module.vehicles.types.${vehicle.type}`)}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-gray-100/50 dark:border-dark-700/50">
                                    <span className="text-gray-500 font-bold">Km</span>
                                    <span className="font-black text-gray-900 dark:text-white">{vehicle.mileage.toLocaleString()}</span>
                                </div>
                                {vehicle.capacity && (
                                    <div className="flex justify-between items-center py-1 border-b border-gray-100/50 dark:border-dark-700/50">
                                        <span className="text-gray-500 font-bold">{t('logistics_module.vehicles.capacity')}</span>
                                        <span className="font-black text-gray-900 dark:text-white">{vehicle.capacity} {vehicle.capacityUnit}</span>
                                    </div>
                                )}
                                {vehicle.nextMaintenance && (
                                    <div className="flex justify-between items-center py-1 border-b border-gray-100/50 dark:border-dark-700/50">
                                        <span className="text-gray-500 flex items-center gap-1 font-bold">
                                            <HiOutlineWrenchScrewdriver className="w-3.5 h-3.5" />
                                            <span>Manutenção</span>
                                        </span>
                                        <span className={cn("font-black", new Date(vehicle.nextMaintenance) < new Date() ? 'text-red-600' : 'text-amber-600')}>
                                            {new Date(vehicle.nextMaintenance).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 relative z-10 pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-100/50 dark:border-blue-500/20 shadow-sm font-black text-[10px] uppercase tracking-widest"
                                    onClick={() => openModal(vehicle)}
                                >
                                    <HiOutlinePencil className="w-4 h-4 mr-1" /> {t('common.edit')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm"
                                    onClick={() => setDeleteConfirm(vehicle.id)}
                                >
                                    <HiOutlineTrash className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {data && data.pagination.total > 0 && (
                <div className="mt-6">
                    <Pagination
                        currentPage={page}
                        totalItems={data.pagination.total}
                        itemsPerPage={pageSize}
                        onPageChange={setPage}
                        onItemsPerPageChange={(size) => {
                            setPageSize(size);
                            setPage(1);
                        }}
                        itemsPerPageOptions={[12, 24, 48, 96]}
                        showInfo={true}
                    />
                </div>
            )}

            {data?.data.length === 0 && (
                <Card variant="default" className="p-12 text-center bg-white dark:bg-dark-900 border-none shadow-premium">
                    <div className="w-20 h-20 rounded-full bg-gray-500/10 flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-gray-500/20">
                        <HiOutlineTruck className="w-10 h-10 text-gray-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('logistics_module.vehicles.noVehicles')}</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{t('logistics_module.vehicles.startAdding')}</p>
                    <Button onClick={() => openModal()}>
                        <HiOutlinePlus className="w-5 h-5 mr-2" /> {t('logistics_module.vehicles.add')}
                    </Button>
                </Card>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingVehicle ? t('logistics_module.vehicles.edit') : t('logistics_module.vehicles.add')}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={`${t('logistics_module.vehicles.plate')} *`}
                            placeholder="AAA-000-BB"
                            value={formData.plate}
                            onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                            required
                        />
                        <Select
                            label={`${t('logistics_module.vehicles.type')} *`}
                            options={vehicleTypes}
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label={`${t('logistics_module.vehicles.brand')} *`}
                            placeholder="Toyota"
                            value={formData.brand}
                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                            required
                        />
                        <Input
                            label={`${t('logistics_module.vehicles.model')} *`}
                            placeholder="Hilux"
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            required
                        />
                        <Input
                            label={t('logistics_module.vehicles.year')}
                            type="number"
                            placeholder="2024"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label={t('logistics_module.vehicles.capacity')}
                            type="number"
                            placeholder="1000"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        />
                        <Select
                            label={t('logistics_module.vehicles.unit')}
                            options={[
                                { value: 'kg', label: t('logistics_module.vehicles.units.kg') },
                                { value: 'ton', label: t('logistics_module.vehicles.units.ton') },
                                { value: 'm3', label: t('logistics_module.vehicles.units.m3') }
                            ]}
                            value={formData.capacityUnit}
                            onChange={(e) => setFormData({ ...formData, capacityUnit: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.vehicles.fuelType')}
                            placeholder="Diesel"
                            value={formData.fuelType}
                            onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Select
                            label={`${t('logistics_module.vehicles.status')} *`}
                            options={vehicleStatuses.map(s => ({ value: s.value, label: s.label }))}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            required
                        />
                        <Input
                            label={t('logistics_module.vehicles.mileage')}
                            type="number"
                            placeholder="0"
                            value={formData.mileage}
                            onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.vehicles.insurance')}
                            type="date"
                            value={formData.insuranceExpiry}
                            onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                        />
                    </div>

                    <Input
                        label={t('common.notes')}
                        placeholder={`${t('common.notes')}...`}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading || updateMutation.isLoading}>
                            {editingVehicle ? t('common.save') : t('logistics_module.vehicles.add')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={t('common.confirmDelete')}
                size="sm"
            >
                <div className="text-center py-4">
                    <HiOutlineExclamationCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {t('messages.confirmDelete')}
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteConfirm!)} isLoading={deleteMutation.isLoading}>
                            {t('common.delete')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
