/**
 * Delivery Routes Management Page
 * List, create, edit, and delete delivery routes
 */

import { useState } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, Pagination } from '../../components/ui';
import {
    HiOutlineMap,
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineArrowRight,
    HiOutlineClock,
    HiOutlineExclamationCircle
} from 'react-icons/hi2';
import { useDeliveryRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute } from '../../hooks/useLogistics';
import type { DeliveryRoute } from '../../services/api/logistics.api';

export default function RoutesPage() {
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoute, setEditingRoute] = useState<DeliveryRoute | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data, isLoading, refetch } = useDeliveryRoutes({
        search: search || undefined,
        active: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        limit: pageSize
    });

    const createMutation = useCreateRoute();
    const updateMutation = useUpdateRoute();
    const deleteMutation = useDeleteRoute();

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        origin: '',
        destination: '',
        distance: '',
        estimatedTime: '',
        tollCost: '',
        fuelEstimate: '',
        isActive: true,
        notes: ''
    });

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            origin: '',
            destination: '',
            distance: '',
            estimatedTime: '',
            tollCost: '',
            fuelEstimate: '',
            isActive: true,
            notes: ''
        });
        setEditingRoute(null);
    };

    const openModal = (route?: DeliveryRoute) => {
        if (route) {
            setEditingRoute(route);
            setFormData({
                code: route.code,
                name: route.name,
                origin: route.origin,
                destination: route.destination,
                distance: route.distance?.toString() || '',
                estimatedTime: route.estimatedTime?.toString() || '',
                tollCost: route.tollCost?.toString() || '',
                fuelEstimate: route.fuelEstimate?.toString() || '',
                isActive: route.isActive,
                notes: route.notes || ''
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
            origin: formData.origin,
            destination: formData.destination,
            distance: formData.distance ? parseFloat(formData.distance) : null,
            estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime) : null,
            tollCost: formData.tollCost ? parseFloat(formData.tollCost) : null,
            fuelEstimate: formData.fuelEstimate ? parseFloat(formData.fuelEstimate) : null,
            isActive: formData.isActive,
            notes: formData.notes || null
        };

        if (editingRoute) {
            await updateMutation.mutateAsync({ id: editingRoute.id, data });
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

    const formatDuration = (minutes?: number) => {
        if (!minutes) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}min`;
        }
        return `${mins}min`;
    };

    if (isLoading) {
        return <LoadingSpinner size="xl" className="h-96" />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Rotas</h1>
                    <p className="text-gray-500 dark:text-gray-400">Definir rotas de entrega e estimativas</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetch()}>
                        Actualizar
                    </Button>
                    <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => openModal()}>
                        Nova Rota
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Pesquisar por nome, código, origem, destino..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[
                            { value: '', label: 'Todas as Rotas' },
                            { value: 'true', label: 'Activas' },
                            { value: 'false', label: 'Inactivas' }
                        ]}
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(e.target.value)}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {data?.pagination.total || 0} rota(s) encontrada(s)
                    </div>
                </div>
            </Card>

            {/* Routes Table */}
            <Card variant="glass" padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                <th className="p-4 font-semibold">Código</th>
                                <th className="p-4 font-semibold">Nome</th>
                                <th className="p-4 font-semibold">Trajecto</th>
                                <th className="p-4 font-semibold text-center">Distância</th>
                                <th className="p-4 font-semibold text-center">Tempo Est.</th>
                                <th className="p-4 font-semibold text-center">Custos</th>
                                <th className="p-4 font-semibold text-center">Estado</th>
                                <th className="p-4 font-semibold text-center">Entregas</th>
                                <th className="p-4 font-semibold text-center">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-dark-700">
                            {data?.data.map((route: DeliveryRoute) => (
                                <tr key={route.id} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                    <td className="p-4 font-mono text-sm font-bold text-primary-600">{route.code}</td>
                                    <td className="p-4 font-medium">{route.name}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-medium">{route.origin}</span>
                                            <HiOutlineArrowRight className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium">{route.destination}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {route.distance ? `${route.distance} km` : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
                                            <HiOutlineClock className="w-4 h-4" />
                                            {formatDuration(route.estimatedTime)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-sm">
                                        {(route.tollCost || route.fuelEstimate) ? (
                                            <div className="space-y-1">
                                                {route.tollCost && <div>Portagem: {route.tollCost} MZN</div>}
                                                {route.fuelEstimate && <div>Combustível: {route.fuelEstimate} MZN</div>}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <Badge variant={route.isActive ? 'success' : 'danger'}>
                                            {route.isActive ? 'Activa' : 'Inactiva'}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Badge variant="gray" size="sm">{route._count?.deliveries || 0}</Badge>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => openModal(route)}>
                                                <HiOutlinePencil className="w-5 h-5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteConfirm(route.id)}>
                                                <HiOutlineTrash className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {data?.data.length === 0 && (
                    <div className="p-12 text-center">
                        <HiOutlineMap className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma rota encontrada</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Crie rotas para organizar as entregas.</p>
                        <Button onClick={() => openModal()}>
                            <HiOutlinePlus className="w-5 h-5 mr-2" /> Criar Rota
                        </Button>
                    </div>
                )}

                {/* Pagination Controls */}
                {data?.pagination && data.pagination.totalPages > 1 && (
                    <div className="p-4 border-t dark:border-dark-700">
                        <Pagination
                            currentPage={page}
                            totalItems={data.pagination.total}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                            itemsPerPageOptions={[10, 20, 50]}
                        />
                    </div>
                )}
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingRoute ? 'Editar Rota' : 'Nova Rota'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Código *"
                            placeholder="RT001"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            required
                            disabled={!!editingRoute}
                        />
                        <Input
                            label="Nome da Rota *"
                            placeholder="Maputo Centro - Matola"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Origem *"
                            placeholder="Cidade/Local de partida"
                            value={formData.origin}
                            onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                            required
                        />
                        <Input
                            label="Destino *"
                            placeholder="Cidade/Local de chegada"
                            value={formData.destination}
                            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Distância (km)"
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={formData.distance}
                            onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                        />
                        <Input
                            label="Tempo Estimado (minutos)"
                            type="number"
                            placeholder="60"
                            value={formData.estimatedTime}
                            onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Custo de Portagem (MZN)"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.tollCost}
                            onChange={(e) => setFormData({ ...formData, tollCost: e.target.value })}
                        />
                        <Input
                            label="Estimativa de Combustível (MZN)"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.fuelEstimate}
                            onChange={(e) => setFormData({ ...formData, fuelEstimate: e.target.value })}
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span>Rota activa</span>
                    </label>

                    <Input
                        label="Observações"
                        placeholder="Notas adicionais sobre a rota..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isPending || updateMutation.isPending}>
                            {editingRoute ? 'Actualizar' : 'Criar Rota'}
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
                        Tem certeza que deseja eliminar esta rota? Esta acção não pode ser revertida.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteConfirm!)} isLoading={deleteMutation.isPending}>
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
