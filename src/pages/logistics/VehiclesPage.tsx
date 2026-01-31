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
    HiOutlineExclamationCircle
} from 'react-icons/hi2';
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle } from '../../hooks/useLogistics';
import type { Vehicle } from '../../services/api/logistics.api';
import { ExportVehiclesButton } from '../../components/common/ExportButton';

const vehicleTypes = [
    { value: 'truck', label: 'Camião' },
    { value: 'van', label: 'Carrinha' },
    { value: 'motorcycle', label: 'Mota' },
    { value: 'car', label: 'Carro' },
    { value: 'bicycle', label: 'Bicicleta' },
    { value: 'other', label: 'Outro' }
];

const vehicleStatuses = [
    { value: 'available', label: 'Disponível', color: 'success' },
    { value: 'in_use', label: 'Em Uso', color: 'primary' },
    { value: 'maintenance', label: 'Manutenção', color: 'warning' },
    { value: 'inactive', label: 'Inativo', color: 'danger' }
];

const getStatusBadge = (status: string) => {
    const s = vehicleStatuses.find(vs => vs.value === status);
    return <Badge variant={s?.color as any || 'gray'}>{s?.label || status}</Badge>;
};

const getTypeLabel = (type: string) => {
    return vehicleTypes.find(t => t.value === type)?.label || type;
};

export default function VehiclesPage() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [pageSize, setPageSize] = useState(12);
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Veículos</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerir frota de veículos para entregas</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetch()}>
                        Actualizar
                    </Button>
                    <ExportVehiclesButton data={data?.data || []} />
                    <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => openModal()}>
                        Novo Veículo
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Pesquisar por matrícula, marca..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: 'Todos os Estados' }, ...vehicleStatuses.map(s => ({ value: s.value, label: s.label }))]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <Select
                        options={[{ value: '', label: 'Todos os Tipos' }, ...vehicleTypes]}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {data?.pagination.total || 0} veículo(s) encontrado(s)
                    </div>
                </div>
            </Card>

            {/* Vehicles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {data?.data.map((vehicle: Vehicle) => (
                    <Card key={vehicle.id} variant="glass" className="hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                    <HiOutlineTruck className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-base sm:text-lg truncate">{vehicle.plate}</h3>
                                    <p className="text-xs sm:text-sm text-gray-500 truncate">{vehicle.brand} {vehicle.model}</p>
                                </div>
                            </div>
                            <div className="flex-shrink-0">{getStatusBadge(vehicle.status)}</div>
                        </div>

                        <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm mb-3 sm:mb-4">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Tipo</span>
                                <span className="font-medium truncate ml-2">{getTypeLabel(vehicle.type)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Km</span>
                                <span className="font-medium">{vehicle.mileage.toLocaleString()}</span>
                            </div>
                            {vehicle.capacity && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Capacidade</span>
                                    <span className="font-medium">{vehicle.capacity} {vehicle.capacityUnit}</span>
                                </div>
                            )}
                            {vehicle._count?.deliveries !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Entregas</span>
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
                                <HiOutlinePencil className="w-4 h-4 mr-1" /> Editar
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
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhum veículo encontrado</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Comece adicionando o primeiro veículo da frota.</p>
                    <Button onClick={() => openModal()}>
                        <HiOutlinePlus className="w-5 h-5 mr-2" /> Adicionar Veículo
                    </Button>
                </Card>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Matrícula *"
                            placeholder="AAA-000-BB"
                            value={formData.plate}
                            onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                            required
                        />
                        <Select
                            label="Tipo de Veículo *"
                            options={vehicleTypes}
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Marca *"
                            placeholder="Toyota"
                            value={formData.brand}
                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                            required
                        />
                        <Input
                            label="Modelo *"
                            placeholder="Hilux"
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            required
                        />
                        <Input
                            label="Ano"
                            type="number"
                            placeholder="2024"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Capacidade"
                            type="number"
                            placeholder="1000"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        />
                        <Select
                            label="Unidade"
                            options={[
                                { value: 'kg', label: 'Quilogramas (kg)' },
                                { value: 'ton', label: 'Toneladas (ton)' },
                                { value: 'm3', label: 'Metros Cúbicos (mÂ³)' }
                            ]}
                            value={formData.capacityUnit}
                            onChange={(e) => setFormData({ ...formData, capacityUnit: e.target.value })}
                        />
                        <Input
                            label="Combustível"
                            placeholder="Diesel"
                            value={formData.fuelType}
                            onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Select
                            label="Estado *"
                            options={vehicleStatuses.map(s => ({ value: s.value, label: s.label }))}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            required
                        />
                        <Input
                            label="Quilometragem"
                            type="number"
                            placeholder="0"
                            value={formData.mileage}
                            onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                        />
                        <Input
                            label="Validade do Seguro"
                            type="date"
                            value={formData.insuranceExpiry}
                            onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Observações"
                        placeholder="Notas adicionais sobre o veículo..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading || updateMutation.isLoading}>
                            {editingVehicle ? 'Actualizar' : 'Criar Veículo'}
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
                <div className="text-center py-4">
                    <HiOutlineExclamationCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Tem certeza que deseja eliminar este veículo? Esta acção não pode ser revertida.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteConfirm!)} isLoading={deleteMutation.isLoading}>
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
