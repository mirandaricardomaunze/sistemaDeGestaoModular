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
        return { label: t('logistics_module.vehicles.insuranceExpiry'), className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
    }
    if (daysLeft <= 30) {
        return { 
            label: t('logistics_module.vehicles.insuranceDays', { days: daysLeft }), 
            className: daysLeft <= 14 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' 
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
                    <Card key={vehicle.id} variant="glass" className="hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                    <HiOutlineTruck className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-base sm:text-lg truncate">{vehicle.plate}</h3>
                                    <p className="text-xs sm:text-sm text-gray-500 truncate">{vehicle.brand} {vehicle.model}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {getStatusBadge(vehicle.status, t)}
                                {(() => {
                                    const alert = getInsuranceExpiryAlert(vehicle.insuranceExpiry, t);
                                    return alert ? (
                                        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${alert.className}`}>
                                            <HiOutlineExclamationTriangle className="w-3 h-3" aria-hidden="true" />
                                            {alert.label}
                                        </span>
                                    ) : null;
                                })()}
                            </div>
                        </div>

                        <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm mb-3 sm:mb-4">
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('logistics_module.vehicles.type')}</span>
                                <span className="font-medium truncate ml-2">{t(`logistics_module.vehicles.types.${vehicle.type}`)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Km</span>
                                <span className="font-medium">{vehicle.mileage.toLocaleString()}</span>
                            </div>
                            {vehicle.capacity && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">{t('logistics_module.vehicles.capacity')}</span>
                                    <span className="font-medium">{vehicle.capacity} {vehicle.capacityUnit}</span>
                                </div>
                            )}
                            {vehicle._count?.deliveries !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">{t('logistics_module.deliveries.title')}</span>
                                    <span className="font-medium">{vehicle._count.deliveries}</span>
                                </div>
                            )}
                            {vehicle.nextMaintenance && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 flex items-center gap-1">
                                        <HiOutlineWrenchScrewdriver className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Manutenção</span>
                                    </span>
                                    <span className={`font-medium ${new Date(vehicle.nextMaintenance) < new Date() ? 'text-red-500' : ''}`}>
                                        {new Date(vehicle.nextMaintenance).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-4 border-t dark:border-dark-700">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => openModal(vehicle)}>
                                <HiOutlinePencil className="w-4 h-4 mr-1" /> {t('common.edit')}
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-500 border-red-500 hover:bg-red-50" onClick={() => setDeleteConfirm(vehicle.id)}>
                                <HiOutlineTrash className="w-4 h-4" />
                            </Button>
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
                <Card variant="glass" className="p-12 text-center">
                    <HiOutlineTruck className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
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
                                { value: 'kg', label: 'Quilogramas (kg)' },
                                { value: 'ton', label: 'Toneladas (ton)' },
                                { value: 'm3', label: 'Metros Cúbicos (m³)' }
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
                        label={t('logistics_module.vehicles.notes')}
                        placeholder="Notas adicionais sobre o veículo..."
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
