/**
 * Drivers Management Page
 * List, create, edit, and delete drivers
 */

import { useState } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, Pagination } from '../../components/ui';
import {
    HiOutlineUser,
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlinePhone,
    HiOutlineIdentification,
    HiOutlineExclamationCircle,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2';
import { useDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver } from '../../hooks/useLogistics';
import type { Driver } from '../../services/api/logistics.api';
import { PageHeader } from '../../components/ui';
import { useTranslation } from 'react-i18next';

const getStatusBadge = (status: string, t: any) => {
    const variants: Record<string, any> = {
        available: 'success',
        on_delivery: 'primary',
        off_duty: 'warning',
        inactive: 'danger'
    };
    return <Badge variant={variants[status] || 'gray'}>{t(`logistics_module.drivers.statuses.${status}`)}</Badge>;
};

/**
 * Returns expiry badge config for a driver's license.
 * Returns null when no alert is needed (license valid for more than 30 days).
 */
function getLicenseExpiryAlert(
    licenseExpiry: string | undefined,
    t: any
): { label: string; className: string } | null {
    if (!licenseExpiry) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor(
        (new Date(licenseExpiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 0) {
        return { label: t('logistics_module.drivers.licenseExpired'), className: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 backdrop-blur-sm' };
    }
    if (daysLeft <= 30) {
        return { 
            label: t('logistics_module.drivers.licenseDays', { days: daysLeft }), 
            className: daysLeft <= 14 
                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 backdrop-blur-sm' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 backdrop-blur-sm' 
        };
    }
    return null;
}

export default function DriversPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const driverStatuses = [
        { value: 'available', label: t('logistics_module.drivers.statuses.available') },
        { value: 'on_delivery', label: t('logistics_module.drivers.statuses.on_delivery') },
        { value: 'off_duty', label: t('logistics_module.drivers.statuses.off_duty') },
        { value: 'inactive', label: t('logistics_module.drivers.statuses.inactive') }
    ];

    const [pageSize, setPageSize] = useState(12);
    const { data, isLoading, refetch } = useDrivers({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: pageSize
    });

    const createMutation = useCreateDriver();
    const updateMutation = useUpdateDriver();
    const deleteMutation = useDeleteDriver();

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        phone: '',
        email: '',
        licenseNumber: '',
        licenseType: '',
        licenseExpiry: '',
        status: 'available',
        hireDate: '',
        address: '',
        emergencyContact: '',
        notes: ''
    });

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            phone: '',
            email: '',
            licenseNumber: '',
            licenseType: '',
            licenseExpiry: '',
            status: 'available',
            hireDate: '',
            address: '',
            emergencyContact: '',
            notes: ''
        });
        setEditingDriver(null);
    };

    const openModal = (driver?: Driver) => {
        if (driver) {
            setEditingDriver(driver);
            setFormData({
                code: driver.code,
                name: driver.name,
                phone: driver.phone,
                email: driver.email || '',
                licenseNumber: driver.licenseNumber || '',
                licenseType: driver.licenseType || '',
                licenseExpiry: driver.licenseExpiry?.split('T')[0] || '',
                status: driver.status,
                hireDate: driver.hireDate?.split('T')[0] || '',
                address: driver.address || '',
                emergencyContact: driver.emergencyContact || '',
                notes: driver.notes || ''
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const data = {
            code: formData.code,
            name: formData.name,
            phone: formData.phone,
            email: formData.email || undefined,
            licenseNumber: formData.licenseNumber,
            licenseType: formData.licenseType || undefined,
            licenseExpiry: formData.licenseExpiry || undefined,
            status: formData.status as Driver['status'],
            hireDate: formData.hireDate || undefined,
            address: formData.address || undefined,
            emergencyContact: formData.emergencyContact || undefined,
            notes: formData.notes || undefined
        };

        if (editingDriver) {
            await updateMutation.mutateAsync({ id: editingDriver.id, data });
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
                title={t('logistics_module.drivers.title')}
                subtitle={t('logistics_module.drivers.subtitle')}
                icon={<HiOutlineUser />}
                actions={
                    <div className="flex gap-2 items-center">
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                            onClick={() => refetch()}
                        >
                            {t('common.refresh')}
                        </Button>
                        <Button
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            onClick={() => openModal()}
                        >
                            {t('logistics_module.drivers.add')}
                        </Button>
                    </div>
                }
            />

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder={t('logistics_module.drivers.searchPlaceholder')}
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: t('common.all') }, ...driverStatuses.map(s => ({ value: s.value, label: s.label }))]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {data?.pagination.total || 0} {t('common.results_found')}
                    </div>
                </div>
            </Card>

            {/* Drivers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.data.map((driver: Driver) => (
                    <Card key={driver.id} variant="glass" className="p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-300 font-black text-lg backdrop-blur-sm group-hover:scale-110 transition-transform">
                                    {driver.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{driver.name}</h3>
                                    <p className="text-sm text-gray-500 font-mono">{driver.code}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {getStatusBadge(driver.status, t)}
                                {(() => {
                                    const alert = getLicenseExpiryAlert(driver.licenseExpiry, t);
                                    return alert ? (
                                        <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${alert.className}`}>
                                            <HiOutlineExclamationTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                            {alert.label}
                                        </span>
                                    ) : null;
                                })()}
                            </div>
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <HiOutlinePhone className="w-4 h-4 text-gray-400" />
                                <span>{driver.phone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <HiOutlineIdentification className="w-4 h-4 text-gray-400" />
                                <span>{t('logistics_module.drivers.license')}: {driver.licenseNumber}</span>
                                {driver.licenseType && <Badge variant="gray" size="sm">{driver.licenseType}</Badge>}
                            </div>
                            {driver.licenseExpiry && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">{t('logistics_module.drivers.expiry')}</span>
                                    <span className={`font-medium ${new Date(driver.licenseExpiry) < new Date() ? 'text-red-500' : ''}`}>
                                        {new Date(driver.licenseExpiry).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                            {driver._count?.deliveries !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">{t('logistics_module.deliveries.title')}</span>
                                    <span className="font-medium">{driver._count.deliveries}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-4 border-t dark:border-dark-700">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-100/50 dark:border-blue-500/20 shadow-sm font-black text-[10px] uppercase tracking-widest"
                                onClick={() => openModal(driver)}
                            >
                                <HiOutlinePencil className="w-4 h-4 mr-1" /> {t('common.edit')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm"
                                onClick={() => setDeleteConfirm(driver.id)}
                            >
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
                <Card variant="default" className="p-12 text-center bg-white dark:bg-dark-900 border-none shadow-premium group">
                    <div className="w-20 h-20 rounded-full bg-gray-500/10 flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-gray-500/20">
                        <HiOutlineUser className="w-10 h-10 text-gray-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 tracking-tight">{t('logistics_module.drivers.noDrivers')}</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{t('logistics_module.drivers.startAdding')}</p>
                    <Button onClick={() => openModal()}>
                        <HiOutlinePlus className="w-5 h-5 mr-2" /> {t('logistics_module.drivers.add')}
                    </Button>
                </Card>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingDriver ? t('logistics_module.drivers.edit') : t('logistics_module.drivers.add')}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={`${t('logistics_module.drivers.code')} *`}
                            placeholder="MOT001"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            required
                            disabled={!!editingDriver}
                        />
                        <Select
                            label={`${t('logistics_module.drivers.statuses.available').replace('Disponível', t('common.status'))} *`}
                            options={driverStatuses.map(s => ({ value: s.value, label: s.label }))}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            required
                        />
                    </div>

                    <Input
                        label={`${t('logistics_module.drivers.name')} *`}
                        placeholder="Nome do motorista"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={`${t('logistics_module.drivers.phone')} *`}
                            placeholder="+258 84 000 0000"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            required
                        />
                        <Input
                            label={t('logistics_module.drivers.email')}
                            type="email"
                            placeholder="email@exemplo.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label={`${t('logistics_module.drivers.license')} *`}
                            placeholder="123456789"
                            value={formData.licenseNumber}
                            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                            required
                        />
                        <Select
                            label={t('logistics_module.drivers.category')}
                            options={[
                                { value: '', label: t('common.select') },
                                { value: 'A', label: t('logistics_module.drivers.license_categories.A') },
                                { value: 'B', label: t('logistics_module.drivers.license_categories.B') },
                                { value: 'C', label: t('logistics_module.drivers.license_categories.C') },
                                { value: 'D', label: t('logistics_module.drivers.license_categories.D') },
                                { value: 'E', label: t('logistics_module.drivers.license_categories.E') }
                            ]}
                            value={formData.licenseType}
                            onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.drivers.expiry')}
                            type="date"
                            value={formData.licenseExpiry}
                            onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={t('logistics_module.drivers.hireDate')}
                            type="date"
                            value={formData.hireDate}
                            onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.drivers.emergency')}
                            placeholder="+258 84 000 0000"
                            value={formData.emergencyContact}
                            onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                        />
                    </div>

                    <Input
                        label={t('logistics_module.drivers.address')}
                        placeholder="Endereço do motorista"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />

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
                            {editingDriver ? t('common.save') : t('logistics_module.drivers.add')}
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
