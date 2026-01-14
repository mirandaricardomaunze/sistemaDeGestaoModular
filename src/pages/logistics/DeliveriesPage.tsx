/**
 * Deliveries Management Page
 * List, create, track, and manage deliveries
 */

import { useState } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, Pagination } from '../../components/ui';
import {
    HiOutlineTruck,
    HiOutlinePlus,
    HiOutlineEye,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineMapPin,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXCircle
} from 'react-icons/hi2';
import { useDeliveries, useCreateDelivery, useUpdateDeliveryStatus, useDrivers, useVehicles, useDeliveryRoutes, usePayDelivery } from '../../hooks/useLogistics';
import type { Delivery, Vehicle, Driver, DeliveryRoute } from '../../services/api/logistics.api';

const deliveryStatuses = [
    { value: 'pending', label: 'Pendente', color: 'warning', icon: HiOutlineClock },
    { value: 'scheduled', label: 'Agendada', color: 'primary', icon: HiOutlineClock },
    { value: 'in_transit', label: 'Em Trânsito', color: 'info', icon: HiOutlineTruck },
    { value: 'out_for_delivery', label: 'Saiu para Entrega', color: 'primary', icon: HiOutlineMapPin },
    { value: 'delivered', label: 'Entregue', color: 'success', icon: HiOutlineCheckCircle },
    { value: 'failed', label: 'Falhou', color: 'danger', icon: HiOutlineXCircle },
    { value: 'returned', label: 'Devolvida', color: 'gray', icon: HiOutlineArrowPath },
    { value: 'cancelled', label: 'Cancelada', color: 'danger', icon: HiOutlineXCircle }
];

const priorityOptions = [
    { value: 'low', label: 'Baixa', color: 'gray' },
    { value: 'normal', label: 'Normal', color: 'primary' },
    { value: 'high', label: 'Alta', color: 'warning' },
    { value: 'urgent', label: 'Urgente', color: 'danger' }
];

const getStatusBadge = (status: string) => {
    const s = deliveryStatuses.find(ds => ds.value === status);
    return <Badge variant={s?.color as any || 'gray'}>{s?.label || status}</Badge>;
};

const getPriorityBadge = (priority: string) => {
    const p = priorityOptions.find(po => po.value === priority);
    return <Badge variant={p?.color as any || 'gray'} size="sm">{p?.label || priority}</Badge>;
};

export default function DeliveriesPage() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusUpdate, setStatusUpdate] = useState({ status: '', failureReason: '' });
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentData, setPaymentData] = useState({ paymentMethod: 'cash', amount: 0 });

    const { data, isLoading, refetch } = useDeliveries({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        page,
        limit: pageSize
    });

    const { data: driversData } = useDrivers();
    const { data: vehiclesData } = useVehicles();
    const { data: routesData } = useDeliveryRoutes();

    const createMutation = useCreateDelivery();
    const updateStatusMutation = useUpdateDeliveryStatus();
    const payMutation = usePayDelivery();

    const [formData, setFormData] = useState({
        deliveryAddress: '',
        recipientName: '',
        recipientPhone: '',
        routeId: '',
        vehicleId: '',
        driverId: '',
        priority: 'normal',
        scheduledDate: '',
        country: 'Moçambique',
        province: '',
        city: '',
        shippingCost: '0',
        isPaid: false,
        notes: '',
        items: [{ description: '', quantity: 1 }]
    });

    const resetForm = () => {
        setFormData({
            deliveryAddress: '',
            recipientName: '',
            recipientPhone: '',
            routeId: '',
            vehicleId: '',
            driverId: '',
            priority: 'normal',
            scheduledDate: '',
            country: 'Moçambique',
            province: '',
            city: '',
            shippingCost: '0',
            isPaid: false,
            notes: '',
            items: [{ description: '', quantity: 1 }]
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        await createMutation.mutateAsync({
            deliveryAddress: formData.deliveryAddress,
            recipientName: formData.recipientName || undefined,
            recipientPhone: formData.recipientPhone || undefined,
            routeId: formData.routeId || undefined,
            vehicleId: formData.vehicleId || undefined,
            driverId: formData.driverId || undefined,
            priority: formData.priority as Delivery['priority'],
            scheduledDate: formData.scheduledDate || undefined,
            country: formData.country,
            province: formData.province || undefined,
            city: formData.city || undefined,
            shippingCost: parseFloat(formData.shippingCost) || 0,
            isPaid: formData.isPaid,
            notes: formData.notes || undefined,
            items: formData.items.filter(i => i.description).map(i => ({
                description: i.description,
                quantity: i.quantity
            })) as any
        });

        setIsModalOpen(false);
        resetForm();
    };

    const handleStatusUpdate = async () => {
        if (!selectedDelivery || !statusUpdate.status) return;

        await updateStatusMutation.mutateAsync({
            id: selectedDelivery.id,
            status: statusUpdate.status,
            failureReason: statusUpdate.failureReason || undefined
        });

        setIsStatusModalOpen(false);
        setSelectedDelivery(null);
        setStatusUpdate({ status: '', failureReason: '' });
    };

    const openStatusModal = (delivery: Delivery, newStatus?: string) => {
        setSelectedDelivery(delivery);
        setStatusUpdate({ status: newStatus || '', failureReason: '' });
        setIsStatusModalOpen(true);
    };

    const handlePayment = async () => {
        if (!selectedDelivery) return;

        await payMutation.mutateAsync({
            id: selectedDelivery.id,
            paymentMethod: paymentData.paymentMethod,
            amount: paymentData.amount || undefined
        });

        setIsPaymentModalOpen(false);
        setSelectedDelivery(null);
    };

    const openPaymentModal = (delivery: Delivery) => {
        setSelectedDelivery(delivery);
        setPaymentData({ paymentMethod: 'cash', amount: delivery.shippingCost || 0 });
        setIsPaymentModalOpen(true);
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { description: '', quantity: 1 }]
        });
    };

    const removeItem = (index: number) => {
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index)
        });
    };

    if (isLoading) {
        return <LoadingSpinner size="xl" className="h-96" />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Entregas</h1>
                    <p className="text-gray-500 dark:text-gray-400">Acompanhe e gerencie todas as entregas</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetch()}>
                        Actualizar
                    </Button>
                    <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => setIsModalOpen(true)}>
                        Nova Entrega
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {deliveryStatuses.slice(0, 5).map((status) => {
                    const count = data?.deliveries.filter((d: Delivery) => d.status === status.value).length || 0;
                    const Icon = status.icon;
                    return (
                        <Card key={status.value} variant="glass" className={`p-4 cursor-pointer hover:shadow-lg transition-shadow ${status.value === statusFilter ? 'ring-2 ring-primary-500' : ''}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${status.color}-100 dark:bg-${status.color}-900/30`}>
                                    <Icon className={`w-5 h-5 text-${status.color}-600`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{count}</p>
                                    <p className="text-xs text-gray-500">{status.label}</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Pesquisar por número, destinatário..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: 'Todos os Estados' }, ...deliveryStatuses.map(s => ({ value: s.value, label: s.label }))]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <Select
                        options={[{ value: '', label: 'Todas as Prioridades' }, ...priorityOptions.map(p => ({ value: p.value, label: p.label }))]}
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {data?.pagination.total || 0} entrega(s) encontrada(s)
                    </div>
                </div>
            </Card>

            {/* Deliveries Table */}
            <Card variant="glass" padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                <th className="p-4 font-semibold">Número</th>
                                <th className="p-4 font-semibold">Destinatário</th>
                                <th className="p-4 font-semibold">Endereço</th>
                                <th className="p-4 font-semibold">Motorista</th>
                                <th className="p-4 font-semibold">Estado</th>
                                <th className="p-4 font-semibold">Prioridade</th>
                                <th className="p-4 font-semibold">Data Agendada</th>
                                <th className="p-4 font-semibold text-center">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-dark-700">
                            {data?.deliveries.map((delivery: Delivery) => (
                                <tr key={delivery.id} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                    <td className="p-4 font-bold text-primary-600 font-mono text-sm">{delivery.number}</td>
                                    <td className="p-4">
                                        <div className="font-medium">{delivery.recipientName || '-'}</div>
                                        <div className="text-sm text-gray-500">{delivery.recipientPhone}</div>
                                    </td>
                                    <td className="p-4 text-sm max-w-xs truncate">{delivery.deliveryAddress}</td>
                                    <td className="p-4 text-sm">{delivery.driver?.name || '-'}</td>
                                    <td className="p-4">{getStatusBadge(delivery.status)}</td>
                                    <td className="p-4">{getPriorityBadge(delivery.priority)}</td>
                                    <td className="p-4 text-sm text-gray-500">
                                        {delivery.scheduledDate ? new Date(delivery.scheduledDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedDelivery(delivery)}>
                                                <HiOutlineEye className="w-5 h-5" />
                                            </Button>
                                            {delivery.status === 'pending' && (
                                                <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => openStatusModal(delivery, 'in_transit')}>
                                                    <HiOutlineTruck className="w-5 h-5" />
                                                </Button>
                                            )}
                                            {delivery.status === 'in_transit' && (
                                                <Button variant="ghost" size="sm" className="text-green-500" onClick={() => openStatusModal(delivery, 'delivered')}>
                                                    <HiOutlineCheckCircle className="w-5 h-5" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {data?.deliveries.length === 0 && (
                    <div className="p-12 text-center">
                        <HiOutlineTruck className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma entrega encontrada</h3>
                        <p className="text-gray-500 dark:text-gray-400">Crie uma nova entrega para começar.</p>
                    </div>
                )}

                {/* Pagination */}
                {data && data.pagination.totalPages > 1 && (
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

            {/* Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title="Nova Entrega"
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="País"
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        />
                        <Select
                            label="Província"
                            options={[
                                { value: '', label: 'Seleccionar' },
                                { value: 'Maputo Cidade', label: 'Maputo Cidade' },
                                { value: 'Maputo Província', label: 'Maputo Província' },
                                { value: 'Gaza', label: 'Gaza' },
                                { value: 'Inhambane', label: 'Inhambane' },
                                { value: 'Sofala', label: 'Sofala' },
                                { value: 'Manica', label: 'Manica' },
                                { value: 'Tete', label: 'Tete' },
                                { value: 'Zambézia', label: 'Zambézia' },
                                { value: 'Nampula', label: 'Nampula' },
                                { value: 'Niassa', label: 'Niassa' },
                                { value: 'Cabo Delgado', label: 'Cabo Delgado' }
                            ]}
                            value={formData.province}
                            onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                        />
                        <Input
                            label="Cidade/Distrito"
                            placeholder="Ex: Matola, Beira"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Endereço Completo *"
                        placeholder="Rua, número, bairro, referências"
                        value={formData.deliveryAddress}
                        onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Nome do Destinatário"
                            placeholder="Nome completo"
                            value={formData.recipientName}
                            onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                        />
                        <Input
                            label="Telefone do Destinatário"
                            placeholder="+258 84 000 0000"
                            value={formData.recipientPhone}
                            onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Select
                            label="Rota"
                            options={[{ value: '', label: 'Seleccionar rota' }, ...(routesData?.data.map((r: DeliveryRoute) => ({ value: r.id, label: `${r.name} (${r.origin} → ${r.destination})` })) || [])]}
                            value={formData.routeId}
                            onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                        />
                        <Select
                            label="Veículo"
                            options={[{ value: '', label: 'Seleccionar veículo' }, ...(vehiclesData?.data.filter((v: Vehicle) => v.status === 'available').map((v: Vehicle) => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })) || [])]}
                            value={formData.vehicleId}
                            onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                        />
                        <Select
                            label="Motorista"
                            options={[{ value: '', label: 'Seleccionar motorista' }, ...(driversData?.data.filter((d: Driver) => d.status === 'available').map((d: Driver) => ({ value: d.id, label: d.name })) || [])]}
                            value={formData.driverId}
                            onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <Select
                            label="Prioridade"
                            options={priorityOptions.map(p => ({ value: p.value, label: p.label }))}
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        />
                        <Input
                            label="Data Agendada"
                            type="date"
                            value={formData.scheduledDate}
                            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                        />
                        <Input
                            label="Custo de Envio (MZN)"
                            type="number"
                            value={formData.shippingCost}
                            onChange={(e) => setFormData({ ...formData, shippingCost: e.target.value })}
                        />
                        <div className="flex items-end pb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isPaid}
                                    onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <span className="text-sm font-medium">Pago</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Itens para Entregar</label>
                        {formData.items.map((item, index) => (
                            <div key={index} className="flex gap-2">
                                <Input
                                    placeholder="Descrição do item"
                                    className="flex-1"
                                    value={item.description}
                                    onChange={(e) => {
                                        const newItems = [...formData.items];
                                        newItems[index].description = e.target.value;
                                        setFormData({ ...formData, items: newItems });
                                    }}
                                />
                                <Input
                                    type="number"
                                    min="1"
                                    className="w-20"
                                    value={item.quantity}
                                    onChange={(e) => {
                                        const newItems = [...formData.items];
                                        newItems[index].quantity = parseInt(e.target.value) || 1;
                                        setFormData({ ...formData, items: newItems });
                                    }}
                                />
                                {formData.items.length > 1 && (
                                    <Button variant="outline" className="text-red-500" onClick={() => removeItem(index)}>
                                        ×
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button variant="ghost" size="sm" onClick={addItem}>
                            <HiOutlinePlus className="w-4 h-4 mr-1" /> Adicionar Item
                        </Button>
                    </div>

                    <Input
                        label="Observações"
                        placeholder="Notas adicionais sobre a entrega..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading}>
                            Criar Entrega
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Status Update Modal */}
            <Modal
                isOpen={isStatusModalOpen}
                onClose={() => { setIsStatusModalOpen(false); setStatusUpdate({ status: '', failureReason: '' }); }}
                title="Actualizar Estado da Entrega"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Entrega: <strong>{selectedDelivery?.number}</strong>
                    </p>

                    <Select
                        label="Novo Estado"
                        options={deliveryStatuses.map(s => ({ value: s.value, label: s.label }))}
                        value={statusUpdate.status}
                        onChange={(e) => setStatusUpdate({ ...statusUpdate, status: e.target.value })}
                    />

                    {statusUpdate.status === 'failed' && (
                        <Input
                            label="Motivo da Falha"
                            placeholder="Explique por que a entrega falhou..."
                            value={statusUpdate.failureReason}
                            onChange={(e) => setStatusUpdate({ ...statusUpdate, failureReason: e.target.value })}
                            required
                        />
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsStatusModalOpen(false); setStatusUpdate({ status: '', failureReason: '' }); }}>
                            Cancelar
                        </Button>
                        <Button className="flex-1" onClick={handleStatusUpdate} isLoading={updateStatusMutation.isLoading} disabled={!statusUpdate.status}>
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delivery Details Modal */}
            <Modal
                isOpen={!!selectedDelivery && !isStatusModalOpen}
                onClose={() => setSelectedDelivery(null)}
                title={`Detalhes da Entrega ${selectedDelivery?.number}`}
                size="lg"
            >
                {selectedDelivery && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">Estado</label>
                                <div className="mt-1">{getStatusBadge(selectedDelivery.status)}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Prioridade</label>
                                <div className="mt-1">{getPriorityBadge(selectedDelivery.priority)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">Endereço de Entrega</label>
                                <p className="font-medium">{selectedDelivery.deliveryAddress}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Localização</label>
                                <p className="font-medium">
                                    {[selectedDelivery.city, selectedDelivery.province, selectedDelivery.country].filter(Boolean).join(', ') || '-'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">Custo de Envio</label>
                                <p className="font-bold text-lg text-primary-600">
                                    {selectedDelivery.shippingCost ? `${Number(selectedDelivery.shippingCost).toLocaleString()} MZN` : 'Grátis'}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Estado do Pagamento</label>
                                <div className="mt-1">
                                    <Badge variant={selectedDelivery.isPaid ? 'success' : 'warning'}>
                                        {selectedDelivery.isPaid ? 'Pago' : 'Pendente'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">Destinatário</label>
                                <p className="font-medium">{selectedDelivery.recipientName || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Telefone</label>
                                <p className="font-medium">{selectedDelivery.recipientPhone || '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">Motorista</label>
                                <p className="font-medium">{selectedDelivery.driver?.name || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Veículo</label>
                                <p className="font-medium">{selectedDelivery.vehicle?.plate || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Rota</label>
                                <p className="font-medium">{selectedDelivery.route?.name || '-'}</p>
                            </div>
                        </div>

                        {selectedDelivery.items && selectedDelivery.items.length > 0 && (
                            <div>
                                <label className="text-sm text-gray-500">Itens</label>
                                <ul className="mt-2 space-y-1">
                                    {selectedDelivery.items.map((item, idx) => (
                                        <li key={idx} className="flex justify-between text-sm">
                                            <span>{item.description}</span>
                                            <span className="font-medium">x{item.quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="text-gray-500">Criada em</label>
                                <p>{new Date(selectedDelivery.createdAt).toLocaleString()}</p>
                            </div>
                            {selectedDelivery.deliveredDate && (
                                <div>
                                    <label className="text-gray-500">Entregue em</label>
                                    <p>{new Date(selectedDelivery.deliveredDate).toLocaleString()}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3 pt-4 border-t dark:border-dark-700">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedDelivery(null)}>
                                Fechar
                            </Button>
                            {!selectedDelivery.isPaid && (selectedDelivery.shippingCost || 0) > 0 && (
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => openPaymentModal(selectedDelivery)}
                                >
                                    Registar Pagamento
                                </Button>
                            )}
                            <Button className="flex-1" onClick={() => openStatusModal(selectedDelivery)}>
                                Alterar Estado
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Registar Pagamento de Entrega"
                size="sm"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">Total a Pagar</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                            {Number(paymentData.amount).toLocaleString()} MZN
                        </p>
                    </div>

                    <Select
                        label="Método de Pagamento"
                        options={[
                            { value: 'cash', label: 'Dinheiro' },
                            { value: 'mpesa', label: 'M-Pesa' },
                            { value: 'card', label: 'Cartão' },
                            { value: 'transfer', label: 'Transferência' }
                        ]}
                        value={paymentData.paymentMethod}
                        onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setIsPaymentModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handlePayment}
                            isLoading={payMutation.isLoading}
                        >
                            Confirmar Pagamento
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
