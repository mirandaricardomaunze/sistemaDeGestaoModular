/**
 * Parcels Management Page
 * List, receive, and manage parcels for pickup
 */

import { useState } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, Pagination } from '../../components/ui';
import {
    HiOutlineCube,
    HiOutlinePlus,
    HiOutlineEye,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlinePhone,
    HiOutlineBell,
    HiOutlineCheckCircle,
    HiOutlineQrCode
} from 'react-icons/hi2';
import { useParcels, useCreateParcel, useRegisterParcelPickup, useSendParcelNotification } from '../../hooks/useLogistics';
import { useWarehouses } from '../../hooks/useData';
import type { Parcel } from '../../services/api/logistics.api';
import toast from 'react-hot-toast';

const parcelStatuses = [
    { value: 'received', label: 'Recebida', color: 'primary' },
    { value: 'awaiting_pickup', label: 'Aguardando Levantamento', color: 'warning' },
    { value: 'picked_up', label: 'Levantada', color: 'success' },
    { value: 'overdue', label: 'Atrasada', color: 'danger' },
    { value: 'returned_to_sender', label: 'Devolvida ao Remetente', color: 'gray' },
    { value: 'lost', label: 'Extraviada', color: 'danger' }
];

const getStatusBadge = (status: string) => {
    const s = parcelStatuses.find(ps => ps.value === status);
    return <Badge variant={s?.color as any || 'gray'}>{s?.label || status}</Badge>;
};

export default function ParcelsPage() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState('');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
    const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);

    const { data, isLoading, refetch } = useParcels({
        search: search || undefined,
        status: statusFilter || undefined,
        warehouseId: warehouseFilter || undefined,
        page,
        limit: 20
    });

    const { warehouses } = useWarehouses();
    const createMutation = useCreateParcel();
    const pickupMutation = useRegisterParcelPickup();
    const notifyMutation = useSendParcelNotification();

    const [formData, setFormData] = useState({
        senderName: '',
        senderPhone: '',
        senderEmail: '',
        senderAddress: '',
        recipientName: '',
        recipientPhone: '',
        recipientEmail: '',
        recipientAddress: '',
        recipientDocument: '',
        description: '',
        weight: '',
        dimensions: '',
        warehouseId: '',
        storageLocation: '',
        expectedPickup: '',
        fees: '0',
        isPaid: false,
        paymentMethod: 'cash',
        notes: ''
    });

    const [pickupData, setPickupData] = useState({
        pickedUpBy: '',
        pickedUpDocument: '',
        receiverRelationship: '',
        paymentMethod: 'cash',
        isPaid: true,
        paidAmount: ''
    });

    const [notifyMessage, setNotifyMessage] = useState('');

    const resetForm = () => {
        setFormData({
            senderName: '',
            senderPhone: '',
            senderEmail: '',
            senderAddress: '',
            recipientName: '',
            recipientPhone: '',
            recipientEmail: '',
            recipientAddress: '',
            recipientDocument: '',
            description: '',
            weight: '',
            dimensions: '',
            warehouseId: '',
            storageLocation: '',
            expectedPickup: '',
            fees: '0',
            isPaid: false,
            paymentMethod: 'cash',
            notes: ''
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        await createMutation.mutateAsync({
            senderName: formData.senderName,
            senderPhone: formData.senderPhone,
            senderEmail: formData.senderEmail || undefined,
            senderAddress: formData.senderAddress || undefined,
            recipientName: formData.recipientName,
            recipientPhone: formData.recipientPhone,
            recipientEmail: formData.recipientEmail || undefined,
            recipientAddress: formData.recipientAddress || undefined,
            recipientDocument: formData.recipientDocument || undefined,
            description: formData.description || undefined,
            weight: formData.weight ? parseFloat(formData.weight) : undefined,
            dimensions: formData.dimensions || undefined,
            warehouseId: formData.warehouseId || undefined,
            storageLocation: formData.storageLocation || undefined,
            expectedPickup: formData.expectedPickup || undefined,
            fees: parseFloat(formData.fees) || 0,
            notes: formData.notes || undefined
        });

        setIsModalOpen(false);
        resetForm();
    };

    const handlePickup = async () => {
        if (!selectedParcel) return;

        await pickupMutation.mutateAsync({
            id: selectedParcel.id,
            ...pickupData,
            paidAmount: pickupData.paidAmount ? parseFloat(pickupData.paidAmount) : undefined
        });

        setIsPickupModalOpen(false);
        setSelectedParcel(null);
        setPickupData({
            pickedUpBy: '',
            pickedUpDocument: '',
            receiverRelationship: '',
            paymentMethod: 'cash',
            isPaid: true,
            paidAmount: ''
        });
    };

    const handleNotify = async () => {
        if (!selectedParcel || !notifyMessage) return;

        await notifyMutation.mutateAsync({
            id: selectedParcel.id,
            type: 'sms',
            message: notifyMessage
        });

        setIsNotifyModalOpen(false);
        setNotifyMessage('');
    };

    const copyTrackingNumber = (trackingNumber: string) => {
        navigator.clipboard.writeText(trackingNumber);
        toast.success('Número de rastreio copiado!');
    };

    if (isLoading) {
        return <LoadingSpinner size="xl" className="h-96" />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Encomendas</h1>
                    <p className="text-gray-500 dark:text-gray-400">Receber e gerir encomendas para levantamento</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetch()}>
                        Actualizar
                    </Button>
                    <Button leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => setIsModalOpen(true)}>
                        Nova Encomenda
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['received', 'awaiting_pickup', 'picked_up', 'overdue'].map((status) => {
                    const statusInfo = parcelStatuses.find(s => s.value === status);
                    const count = data?.parcels.filter((p: Parcel) => p.status === status).length || 0;
                    return (
                        <Card key={status} variant="glass" className={`p-4 cursor-pointer hover:shadow-lg transition-shadow ${status === statusFilter ? 'ring-2 ring-primary-500' : ''}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-2xl font-bold">{count}</p>
                                    <p className="text-xs text-gray-500">{statusInfo?.label}</p>
                                </div>
                                <Badge variant={statusInfo?.color as any} size="sm">
                                    {statusInfo?.label}
                                </Badge>
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
                            placeholder="Pesquisar por tracking, nome, telefone..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[{ value: '', label: 'Todos os Estados' }, ...parcelStatuses.map(s => ({ value: s.value, label: s.label }))]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <Select
                        options={[{ value: '', label: 'Todos os Armazéns' }, ...(warehouses?.map(w => ({ value: w.id, label: w.name })) || [])]}
                        value={warehouseFilter}
                        onChange={(e) => setWarehouseFilter(e.target.value)}
                    />
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 self-center">
                        {data?.pagination.total || 0} encomenda(s) encontrada(s)
                    </div>
                </div>
            </Card>

            {/* Parcels Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.parcels.map((parcel: Parcel) => (
                    <Card key={parcel.id} variant="glass" className="p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <HiOutlineQrCode className="w-5 h-5 text-primary-600" />
                                    <span
                                        className="font-mono font-bold text-lg cursor-pointer hover:text-primary-600"
                                        onClick={() => copyTrackingNumber(parcel.trackingNumber)}
                                        title="Clique para copiar"
                                    >
                                        {parcel.trackingNumber}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500">
                                    Recebida: {new Date(parcel.receivedAt).toLocaleDateString()}
                                </p>
                            </div>
                            {getStatusBadge(parcel.status)}
                        </div>

                        <div className="space-y-3 mb-4">
                            <div className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase mb-1">Destinatário</p>
                                <p className="font-medium">{parcel.recipientName}</p>
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                    <HiOutlinePhone className="w-4 h-4" />
                                    {parcel.recipientPhone}
                                </div>
                            </div>

                            {parcel.description && (
                                <div className="text-sm">
                                    <span className="text-gray-500">Descrição: </span>
                                    <span>{parcel.description}</span>
                                </div>
                            )}

                            {parcel.storageLocation && (
                                <div className="text-sm">
                                    <span className="text-gray-500">Local: </span>
                                    <Badge variant="gray" size="sm">{parcel.storageLocation}</Badge>
                                </div>
                            )}

                            {parcel.fees > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Taxa</span>
                                    <span className="font-bold">{Number(parcel.fees).toLocaleString()} MZN</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-4 border-t dark:border-dark-700">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedParcel(parcel)}>
                                <HiOutlineEye className="w-4 h-4 mr-1" /> Ver
                            </Button>
                            {parcel.status !== 'picked_up' && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => { setSelectedParcel(parcel); setIsNotifyModalOpen(true); }}>
                                        <HiOutlineBell className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => { setSelectedParcel(parcel); setIsPickupModalOpen(true); }}>
                                        <HiOutlineCheckCircle className="w-4 h-4 mr-1" /> Levantar
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {data?.parcels.length === 0 && (
                <Card variant="glass" className="p-12 text-center">
                    <HiOutlineCube className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma encomenda encontrada</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Registre uma nova encomenda para começar.</p>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <HiOutlinePlus className="w-5 h-5 mr-2" /> Registar Encomenda
                    </Button>
                </Card>
            )}

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
                <Pagination
                    currentPage={page}
                    totalItems={data.pagination.total}
                    itemsPerPage={data.pagination.limit}
                    onPageChange={setPage}
                    showInfo={true}
                />
            )}

            {/* Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title="Registar Nova Encomenda"
                size="xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Sender Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b dark:border-dark-700 pb-2">Dados do Remetente</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Nome do Remetente *"
                                placeholder="Nome completo"
                                value={formData.senderName}
                                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                                required
                            />
                            <Input
                                label="Telefone do Remetente *"
                                placeholder="+258 84 000 0000"
                                value={formData.senderPhone}
                                onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Email"
                                type="email"
                                placeholder="email@exemplo.com"
                                value={formData.senderEmail}
                                onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                            />
                            <Input
                                label="Morada"
                                placeholder="Endereço do remetente"
                                value={formData.senderAddress}
                                onChange={(e) => setFormData({ ...formData, senderAddress: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Recipient Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b dark:border-dark-700 pb-2">Dados do Destinatário</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Nome do Destinatário *"
                                placeholder="Nome completo"
                                value={formData.recipientName}
                                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                                required
                            />
                            <Input
                                label="Telefone do Destinatário *"
                                placeholder="+258 84 000 0000"
                                value={formData.recipientPhone}
                                onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Email"
                                type="email"
                                placeholder="email@exemplo.com"
                                value={formData.recipientEmail}
                                onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                            />
                            <Input
                                label="Documento (BI/NUIT)"
                                placeholder="Número do documento"
                                value={formData.recipientDocument}
                                onChange={(e) => setFormData({ ...formData, recipientDocument: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Parcel Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b dark:border-dark-700 pb-2">Dados da Encomenda</h3>
                        <Input
                            label="Descrição"
                            placeholder="Descrição do conteúdo da encomenda"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                        <div className="grid grid-cols-3 gap-4">
                            <Input
                                label="Peso (kg)"
                                type="number"
                                step="0.1"
                                placeholder="0.0"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                            />
                            <Input
                                label="Dimensões"
                                placeholder="30x20x10 cm"
                                value={formData.dimensions}
                                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                            />
                            <Input
                                label="Taxa (MZN)"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.fees}
                                onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <Select
                                label="Armazém"
                                options={[{ value: '', label: 'Seleccionar' }, ...(warehouses?.map(w => ({ value: w.id, label: w.name })) || [])]}
                                value={formData.warehouseId}
                                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                            />
                            <Input
                                label="Local de Armazenamento"
                                placeholder="Prateleira A1"
                                value={formData.storageLocation}
                                onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                            />
                            <Input
                                label="Data Prevista de Levantamento"
                                type="date"
                                value={formData.expectedPickup}
                                onChange={(e) => setFormData({ ...formData, expectedPickup: e.target.value })}
                            />
                        </div>
                        <Input
                            label="Observações"
                            placeholder="Notas adicionais..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading}>
                            Registar Encomenda
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Pickup Modal */}
            <Modal
                isOpen={isPickupModalOpen}
                onClose={() => {
                    setIsPickupModalOpen(false);
                    setPickupData({
                        pickedUpBy: '',
                        pickedUpDocument: '',
                        receiverRelationship: '',
                        paymentMethod: 'cash',
                        isPaid: true,
                        paidAmount: ''
                    });
                }}
                title="Registar Levantamento"
                size="md"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                        <p className="text-sm text-gray-500">Encomenda</p>
                        <p className="font-mono font-bold text-lg">{selectedParcel?.trackingNumber}</p>
                        <p className="text-sm">Para: {selectedParcel?.recipientName}</p>
                    </div>

                    <Input
                        label="Nome de Quem Levanta *"
                        placeholder="Nome completo"
                        value={pickupData.pickedUpBy}
                        onChange={(e) => setPickupData({ ...pickupData, pickedUpBy: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Documento (BI/NUIT)"
                            placeholder="Número do documento"
                            value={pickupData.pickedUpDocument}
                            onChange={(e) => setPickupData({ ...pickupData, pickedUpDocument: e.target.value })}
                        />
                        <Input
                            label="Parentesco/Relação"
                            placeholder="Ex: Próprio, Irmão, etc"
                            value={pickupData.receiverRelationship}
                            onChange={(e) => setPickupData({ ...pickupData, receiverRelationship: e.target.value })}
                        />
                    </div>

                    {selectedParcel && selectedParcel.fees > 0 && (
                        <>
                            <div className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                <div className="flex justify-between">
                                    <span>Taxa a Pagar:</span>
                                    <span className="font-bold text-lg">{Number(selectedParcel.fees).toLocaleString()} MZN</span>
                                </div>
                            </div>
                            <Select
                                label="Método de Pagamento"
                                options={[
                                    { value: 'cash', label: 'Dinheiro' },
                                    { value: 'mpesa', label: 'M-Pesa' },
                                    { value: 'card', label: 'Cartão' },
                                    { value: 'transfer', label: 'Transferência' }
                                ]}
                                value={pickupData.paymentMethod}
                                onChange={(e) => setPickupData({ ...pickupData, paymentMethod: e.target.value })}
                            />
                            <Input
                                label="Valor Pago (MZN)"
                                type="number"
                                placeholder={selectedParcel.fees.toString()}
                                value={pickupData.paidAmount}
                                onChange={(e) => setPickupData({ ...pickupData, paidAmount: e.target.value })}
                            />
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={pickupData.isPaid}
                                    onChange={(e) => setPickupData({ ...pickupData, isPaid: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <span>Pagamento recebido</span>
                            </label>
                        </>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => {
                            setIsPickupModalOpen(false);
                            setPickupData({
                                pickedUpBy: '',
                                pickedUpDocument: '',
                                receiverRelationship: '',
                                paymentMethod: 'cash',
                                isPaid: true,
                                paidAmount: ''
                            });
                        }}>
                            Cancelar
                        </Button>
                        <Button className="flex-1" onClick={handlePickup} isLoading={pickupMutation.isLoading} disabled={!pickupData.pickedUpBy}>
                            Confirmar Levantamento
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Notify Modal */}
            <Modal
                isOpen={isNotifyModalOpen}
                onClose={() => { setIsNotifyModalOpen(false); setNotifyMessage(''); }}
                title="Enviar Notificação"
                size="md"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                        <p className="text-sm text-gray-500">Encomenda</p>
                        <p className="font-mono font-bold">{selectedParcel?.trackingNumber}</p>
                        <p className="text-sm">Destinatário: {selectedParcel?.recipientName} ({selectedParcel?.recipientPhone})</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem *</label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={4}
                            placeholder="Escreva a mensagem para o destinatário..."
                            value={notifyMessage}
                            onChange={(e) => setNotifyMessage(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setIsNotifyModalOpen(false); setNotifyMessage(''); }}>
                            Cancelar
                        </Button>
                        <Button className="flex-1" onClick={handleNotify} isLoading={notifyMutation.isLoading} disabled={!notifyMessage}>
                            <HiOutlineBell className="w-4 h-4 mr-1" /> Enviar SMS
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Details Modal */}
            <Modal
                isOpen={!!selectedParcel && !isPickupModalOpen && !isNotifyModalOpen}
                onClose={() => setSelectedParcel(null)}
                title={`Detalhes da Encomenda`}
                size="lg"
            >
                {selectedParcel && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-500">Número de Rastreio</p>
                                <p className="font-mono font-bold text-xl">{selectedParcel.trackingNumber}</p>
                            </div>
                            {getStatusBadge(selectedParcel.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="font-semibold text-gray-500 uppercase text-xs">Remetente</h4>
                                <p className="font-medium">{selectedParcel.senderName}</p>
                                <p className="text-sm text-gray-500">{selectedParcel.senderPhone}</p>
                                {selectedParcel.senderEmail && <p className="text-sm text-gray-500">{selectedParcel.senderEmail}</p>}
                            </div>
                            <div className="space-y-3">
                                <h4 className="font-semibold text-gray-500 uppercase text-xs">Destinatário</h4>
                                <p className="font-medium">{selectedParcel.recipientName}</p>
                                <p className="text-sm text-gray-500">{selectedParcel.recipientPhone}</p>
                                {selectedParcel.recipientDocument && <p className="text-sm text-gray-500">Doc: {selectedParcel.recipientDocument}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-gray-500 uppercase text-xs">Detalhes</h4>
                            {selectedParcel.description && (
                                <p><span className="text-gray-500">Descrição:</span> {selectedParcel.description}</p>
                            )}
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                {selectedParcel.weight && (
                                    <p><span className="text-gray-500">Peso:</span> {selectedParcel.weight} kg</p>
                                )}
                                {selectedParcel.dimensions && (
                                    <p><span className="text-gray-500">Dimensões:</span> {selectedParcel.dimensions}</p>
                                )}
                                {selectedParcel.storageLocation && (
                                    <p><span className="text-gray-500">Local:</span> {selectedParcel.storageLocation}</p>
                                )}
                            </div>
                        </div>

                        {selectedParcel.fees > 0 && (
                            <div className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg flex justify-between">
                                <span>Taxa</span>
                                <span className="font-bold">{Number(selectedParcel.fees).toLocaleString()} MZN</span>
                            </div>
                        )}

                        {selectedParcel.status === 'picked_up' && (
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-2">
                                <h4 className="font-semibold text-green-800 dark:text-green-200">Levantado</h4>
                                <p className="text-sm"><span className="text-gray-500">Por:</span> {selectedParcel.pickedUpBy}</p>
                                {selectedParcel.pickedUpDocument && (
                                    <p className="text-sm"><span className="text-gray-500">Doc:</span> {selectedParcel.pickedUpDocument}</p>
                                )}
                                <p className="text-sm"><span className="text-gray-500">Data:</span> {selectedParcel.pickedUpAt ? new Date(selectedParcel.pickedUpAt).toLocaleString() : '-'}</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4 border-t dark:border-dark-700">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedParcel(null)}>
                                Fechar
                            </Button>
                            {selectedParcel.status !== 'picked_up' && (
                                <Button className="flex-1" onClick={() => setIsPickupModalOpen(true)}>
                                    <HiOutlineCheckCircle className="w-4 h-4 mr-1" /> Registar Levantamento
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
