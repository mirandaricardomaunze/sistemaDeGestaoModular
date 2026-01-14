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
    HiOutlineExclamationCircle
} from 'react-icons/hi2';
import { useDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver } from '../../hooks/useLogistics';
import type { Driver } from '../../services/api/logistics.api';

const driverStatuses = [
    { value: 'available', label: 'Disponível', color: 'success' },
    { value: 'on_delivery', label: 'Em Entrega', color: 'primary' },
    { value: 'off_duty', label: 'Fora de Serviço', color: 'warning' },
    { value: 'inactive', label: 'Inactivo', color: 'danger' }
];

const getStatusBadge = (status: string) => {
    const s = driverStatuses.find(ds => ds.value === status);
    return <Badge variant={s?.color as any || 'gray'}>{s?.label || status}</Badge>;
};

export default function DriversPage() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data, isLoading, refetch } = useDrivers({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 12
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
                licenseNumber: driver.licenseNumber,
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
            email: formData.email || null,
            licenseNumber: formData.licenseNumber,
            licenseType: formData.licenseType || null,
            licenseExpiry: formData.licenseExpiry || null,
            status: formData.status as Driver['status'],
            hireDate: formData.hireDate || null,
            address: formData.address || null,
            emergencyContact: formData.emergencyContact || null,
            notes: formData.notes || null
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Motoristas</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerir motoristas e condutores de entregas</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetch()}>
                        Actualizar
                    </Button>
                    <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => openModal()}>
                        Novo Motorista
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Pesquisar por nome, código, telefone..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: 'Todos os Estados' }, ...driverStatuses.map(s => ({ value: s.value, label: s.label }))]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {data?.pagination.total || 0} motorista(s) encontrado(s)
                    </div>
                </div>
            </Card>

            {/* Drivers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.data.map((driver: Driver) => (
                    <Card key={driver.id} variant="glass" className="p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg">
                                    {driver.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{driver.name}</h3>
                                    <p className="text-sm text-gray-500 font-mono">{driver.code}</p>
                                </div>
                            </div>
                            {getStatusBadge(driver.status)}
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <HiOutlinePhone className="w-4 h-4 text-gray-400" />
                                <span>{driver.phone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <HiOutlineIdentification className="w-4 h-4 text-gray-400" />
                                <span>Carta: {driver.licenseNumber}</span>
                                {driver.licenseType && <Badge variant="gray" size="sm">{driver.licenseType}</Badge>}
                            </div>
                            {driver.licenseExpiry && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Validade Carta</span>
                                    <span className={`font-medium ${new Date(driver.licenseExpiry) < new Date() ? 'text-red-500' : ''}`}>
                                        {new Date(driver.licenseExpiry).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                            {driver._count?.deliveries !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total Entregas</span>
                                    <span className="font-medium">{driver._count.deliveries}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-4 border-t dark:border-dark-700">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => openModal(driver)}>
                                <HiOutlinePencil className="w-4 h-4 mr-1" /> Editar
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-500 border-red-500 hover:bg-red-50" onClick={() => setDeleteConfirm(driver.id)}>
                                <HiOutlineTrash className="w-4 h-4" />
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {data && data.pagination.totalPages > 1 && (
                <Pagination
                    currentPage={page}
                    totalItems={data.pagination.total}
                    itemsPerPage={data.pagination.limit}
                    onPageChange={setPage}
                    showInfo={true}
                />
            )}

            {data?.data.length === 0 && (
                <Card variant="glass" className="p-12 text-center">
                    <HiOutlineUser className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhum motorista encontrado</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Comece adicionando o primeiro motorista.</p>
                    <Button onClick={() => openModal()}>
                        <HiOutlinePlus className="w-5 h-5 mr-2" /> Adicionar Motorista
                    </Button>
                </Card>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Código *"
                            placeholder="MOT001"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            required
                            disabled={!!editingDriver}
                        />
                        <Select
                            label="Estado *"
                            options={driverStatuses.map(s => ({ value: s.value, label: s.label }))}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            required
                        />
                    </div>

                    <Input
                        label="Nome Completo *"
                        placeholder="Nome do motorista"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Telefone *"
                            placeholder="+258 84 000 0000"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            required
                        />
                        <Input
                            label="Email"
                            type="email"
                            placeholder="email@exemplo.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Nº Carta de Condução *"
                            placeholder="123456789"
                            value={formData.licenseNumber}
                            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                            required
                        />
                        <Select
                            label="Categoria"
                            options={[
                                { value: '', label: 'Seleccionar' },
                                { value: 'A', label: 'A - Motociclos' },
                                { value: 'B', label: 'B - Ligeiros' },
                                { value: 'C', label: 'C - Pesados Mercadorias' },
                                { value: 'D', label: 'D - Pesados Passageiros' },
                                { value: 'E', label: 'E - Reboque' }
                            ]}
                            value={formData.licenseType}
                            onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                        />
                        <Input
                            label="Validade Carta"
                            type="date"
                            value={formData.licenseExpiry}
                            onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data de Contratação"
                            type="date"
                            value={formData.hireDate}
                            onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                        />
                        <Input
                            label="Contacto de Emergência"
                            placeholder="+258 84 000 0000"
                            value={formData.emergencyContact}
                            onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Morada"
                        placeholder="Endereço do motorista"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />

                    <Input
                        label="Observações"
                        placeholder="Notas adicionais sobre o motorista..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading || updateMutation.isLoading}>
                            {editingDriver ? 'Actualizar' : 'Criar Motorista'}
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
                        Tem certeza que deseja eliminar este motorista? Esta acção não pode ser revertida.
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
