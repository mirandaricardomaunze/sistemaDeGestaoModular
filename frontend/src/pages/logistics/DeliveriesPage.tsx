/**
 * Deliveries Management Page
 * List, create, track, and manage deliveries
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, PageHeader } from '../../components/ui';
import type { BadgeVariant } from '../../components/ui/Badge';
import { SmartTable } from '../../components/ui/SmartTable';
import {
    HiOutlineTruck,
    HiOutlinePlus,
    HiOutlineEye,
    HiOutlineArrowPath,
    HiOutlineMapPin,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineArrowsRightLeft
} from 'react-icons/hi2';
import { useDeliveries, useCreateDelivery, useUpdateDeliveryStatus, useDrivers, useVehicles, useDeliveryRoutes, usePayDelivery, useDeliveryStatusTimeline } from '../../hooks/useLogistics';
import { useWarehouses } from '../../hooks/useWarehouses';
import { useProducts } from '../../hooks/useProducts';
import type { Delivery, Vehicle, Driver, DeliveryRoute } from '../../services/api/logistics.api';
import { ExportDeliveriesButton } from '../../components/common/ExportButton';
import { DeliveryStatusTimeline } from '../../components/logistics/DeliveryStatusTimeline';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStore } from '../../stores/useStore';
import { addProfessionalHeader, addProfessionalFooter } from '../../utils/documentGenerator';
import toast from 'react-hot-toast';
import { cn } from '../../utils/helpers';

const getStatusBadge = (status: string, t: TFunction) => {
    const variants: Record<string, BadgeVariant> = {
        pending: 'warning',
        scheduled: 'primary',
        in_transit: 'info',
        out_for_delivery: 'primary',
        delivered: 'success',
        failed: 'danger',
        returned: 'gray',
        cancelled: 'danger'
    };
    return <Badge variant={variants[status] || 'gray'}>{t(`logistics_module.deliveries.status.${status}`)}</Badge>;
};

const TRANSFER_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
    draft: { label: 'Rascunho', variant: 'gray' },
    pending: { label: 'Aguarda aprovação', variant: 'warning' },
    approved: { label: 'Aprovada', variant: 'primary' },
    in_transit: { label: 'Em trânsito', variant: 'info' },
    received: { label: 'Recebida', variant: 'success' },
    completed: { label: 'Concluída', variant: 'success' },
    rejected: { label: 'Rejeitada', variant: 'danger' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
};

const getTransferBadge = (status?: string) => {
    if (!status) return null;
    const meta = TRANSFER_STATUS_META[status] ?? { label: status, variant: 'gray' as BadgeVariant };
    return <Badge variant={meta.variant} size="sm">{meta.label}</Badge>;
};

const getPriorityBadge = (priority: string, t: TFunction) => {
    const variants: Record<string, BadgeVariant> = {
        low: 'gray',
        normal: 'primary',
        high: 'warning',
        urgent: 'danger'
    };
    return <Badge variant={variants[priority] || 'gray'} size="sm">{t(`logistics_module.deliveries.priorities.${priority}`)}</Badge>;
};

export default function DeliveriesPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');

    const deliveryStatuses = [
        { value: 'pending', label: t('logistics_module.deliveries.status.pending'), color: 'warning', icon: HiOutlineClock },
        { value: 'scheduled', label: t('logistics_module.deliveries.status.scheduled'), color: 'primary', icon: HiOutlineClock },
        { value: 'in_transit', label: t('logistics_module.deliveries.status.in_transit'), color: 'info', icon: HiOutlineTruck },
        { value: 'out_for_delivery', label: t('logistics_module.deliveries.status.out_for_delivery'), color: 'primary', icon: HiOutlineMapPin },
        { value: 'delivered', label: t('logistics_module.deliveries.status.delivered'), color: 'success', icon: HiOutlineCheckCircle },
        { value: 'failed', label: t('logistics_module.deliveries.status.failed'), color: 'danger', icon: HiOutlineXCircle },
        { value: 'returned', label: t('logistics_module.deliveries.status.returned'), color: 'gray', icon: HiOutlineArrowPath },
        { value: 'cancelled', label: t('logistics_module.deliveries.status.cancelled'), color: 'danger', icon: HiOutlineXCircle }
    ];

    const priorityOptions = [
        { value: 'low', label: t('logistics_module.deliveries.priorities.low'), color: 'gray' },
        { value: 'normal', label: t('logistics_module.deliveries.priorities.normal'), color: 'primary' },
        { value: 'high', label: t('logistics_module.deliveries.priorities.high'), color: 'warning' },
        { value: 'urgent', label: t('logistics_module.deliveries.priorities.urgent'), color: 'danger' }
    ];
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusUpdate, setStatusUpdate] = useState({ status: '', failureReason: '' });
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentData, setPaymentData] = useState({ paymentMethod: 'cash', amount: 0 });

    const { companySettings } = useStore();
    const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);
    const [manifestDriverId, setManifestDriverId] = useState('');

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
    const { warehouses } = useWarehouses();
    // 'all' + high limit so the transfer picker sees products from every module.
    const { products } = useProducts({ originModule: 'all', limit: 2000 });

    const createMutation = useCreateDelivery();
    const updateStatusMutation = useUpdateDeliveryStatus();
    const payMutation = usePayDelivery();

    type DeliveryFormItem = { description: string; quantity: number; productId?: string };
    const emptyForm = {
        kind: 'shipment' as 'shipment' | 'warehouse_transfer',
        sourceWarehouseId: '',
        targetWarehouseId: '',
        reason: '',
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
        items: [{ description: '', quantity: 1 }] as DeliveryFormItem[]
    };
    const [formData, setFormData] = useState(emptyForm);
    const isTransferForm = formData.kind === 'warehouse_transfer';

    const resetForm = () => setFormData(emptyForm);

    const openModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.kind === 'warehouse_transfer') {
            if (!formData.sourceWarehouseId || !formData.targetWarehouseId) {
                return toast.error('Selecione armazém de origem e destino');
            }
            if (formData.sourceWarehouseId === formData.targetWarehouseId) {
                return toast.error('Origem e destino devem ser diferentes');
            }
            const transferItems = formData.items.filter(i => i.productId && i.quantity > 0);
            if (transferItems.length === 0) {
                return toast.error('Adicione pelo menos um produto à transferência');
            }
            const sourceName = warehouses.find(w => w.id === formData.sourceWarehouseId)?.name ?? 'Origem';
            const targetName = warehouses.find(w => w.id === formData.targetWarehouseId)?.name ?? 'Destino';
            await createMutation.mutateAsync({
                kind: 'warehouse_transfer',
                sourceWarehouseId: formData.sourceWarehouseId,
                targetWarehouseId: formData.targetWarehouseId,
                reason: formData.reason || undefined,
                deliveryAddress: `${sourceName} → ${targetName}`,
                recipientName: targetName,
                driverId: formData.driverId || undefined,
                vehicleId: formData.vehicleId || undefined,
                priority: formData.priority as Delivery['priority'],
                scheduledDate: formData.scheduledDate || undefined,
                notes: formData.notes || undefined,
                items: transferItems.map(i => ({
                    productId: i.productId,
                    description: products.find(p => p.id === i.productId)?.name ?? i.description,
                    quantity: i.quantity
                }))
            });
            setIsModalOpen(false);
            resetForm();
            return;
        }

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
            }))
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

    const generateLoadManifest = async () => {
        if (!manifestDriverId) return toast.error(t('logistics_module.deliveries.selectDriver'));
        
        const driverDeliveries = data?.deliveries.filter((d: Delivery) => 
            d.driverId === manifestDriverId && 
            ['pending', 'scheduled', 'in_transit'].includes(d.status)
        ) || [];

        if (driverDeliveries.length === 0) {
            return toast.error(t('logistics_module.deliveries.noPending'));
        }

        const driver = driversData?.data.find((d: Driver) => d.id === manifestDriverId);
        
        const doc = new jsPDF();
        addProfessionalHeader(doc, t('logistics_module.deliveries.manifest').toUpperCase(), {
            name: companySettings.companyName,
            companyName: companySettings.companyName,
            address: companySettings.address,
            phone: companySettings.phone,
            email: companySettings.email,
            logo: companySettings.logo,
            nuit: companySettings.taxId,
            taxId: companySettings.taxId
        }, `${t('common.date')}: ${new Date().toLocaleDateString()}`);

        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text(`${t('logistics_module.drivers.add').replace('Novo ', '')}: ${driver?.name || t('common.unknown')}`, 15, 52);
        doc.text(`Total ${t('logistics_module.deliveries.title')}: ${driverDeliveries.length}`, 15, 58);

        const tableData = driverDeliveries.map((tr: Delivery) => [
            tr.number,
            tr.route?.name || '-',
            tr.deliveryAddress,
            tr.recipientName || '-',
            tr.items?.length?.toString() || '0',
            '-' // Assinatura column
        ]);

        autoTable(doc, {
            startY: 65,
            head: [[t('logistics_module.deliveries.number'), t('logistics_module.deliveries.route'), t('logistics_module.deliveries.address'), t('logistics_module.deliveries.recipient'), t('common.items'), t('common.signature')]],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, minCellHeight: 15 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 15, right: 15 },
            didDrawCell: (_data) => {
                // Add a placeholder for QR code in the first column if we were to add it per row
                // For now, we'll add a main manifest QR at the top right
            }
        });

        // Add a global manifest QR code for tracking this manifest in a future iteration

        addProfessionalFooter(doc, {
            name: companySettings.companyName,
            companyName: companySettings.companyName,
            address: companySettings.address,
            phone: companySettings.phone,
            email: companySettings.email,
            logo: companySettings.logo,
            nuit: companySettings.taxId,
            taxId: companySettings.taxId
        });
        doc.save(`${t('logistics_module.deliveries.manifest')}_${driver?.name}_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success(t('common.success'));
        setIsManifestModalOpen(false);
    };

    // Derives the status timeline for the currently selected delivery.
    // Re-computed on every render - pure derivation, no side effects.
    const selectedDeliveryTimeline = useDeliveryStatusTimeline(selectedDelivery ?? null);

    const deliveryColumns = useMemo<ColumnDef<Delivery, unknown>[]>(() => [
        {
            header: t('logistics_module.deliveries.number'),
            cell: ({ row }) => (
                <div className="space-y-1">
                    <span className="font-bold text-primary-600 font-mono text-sm">
                        {row.original.number}
                    </span>
                    {row.original.kind === 'warehouse_transfer' && (
                        <div className="flex items-center gap-1">
                            <HiOutlineArrowsRightLeft className="w-3.5 h-3.5 text-primary-500" />
                            {getTransferBadge(row.original.transfer?.status)}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: t('logistics_module.deliveries.recipient'),
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.recipientName || '-'}</div>
                    <div className="text-sm text-gray-500">{row.original.recipientPhone}</div>
                </div>
            ),
        },
        {
            header: t('logistics_module.deliveries.address'),
            cell: ({ row }) => (
                <span className="block max-w-xs truncate text-sm" title={row.original.deliveryAddress}>
                    {row.original.deliveryAddress}
                </span>
            ),
        },
        {
            header: t('logistics_module.deliveries.driver'),
            cell: ({ row }) => (
                <span className="text-sm">{row.original.driver?.name || '-'}</span>
            ),
        },
        {
            header: t('common.status'),
            cell: ({ row }) => getStatusBadge(row.original.status, t),
        },
        {
            header: t('logistics_module.deliveries.priority'),
            cell: ({ row }) => getPriorityBadge(row.original.priority, t),
        },
        {
            header: t('logistics_module.deliveries.scheduled'),
            cell: ({ row }) => (
                <span className="text-sm text-gray-500">
                    {row.original.scheduledDate ? new Date(row.original.scheduledDate).toLocaleDateString() : '-'}
                </span>
            ),
        },
        {
            header: t('common.actions'),
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelectedDelivery(row.original)}
                        className="h-9 w-9 px-0 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm"
                        title={t('common.view')}
                    >
                        <HiOutlineEye className="w-5 h-5" />
                    </Button>
                    {row.original.status === 'pending' && (
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openStatusModal(row.original, 'in_transit')}
                            className="h-9 w-9 px-0 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-100/50 dark:border-blue-500/20 shadow-sm"
                            title={t('logistics_module.deliveries.status.in_transit')}
                        >
                            <HiOutlineTruck className="w-5 h-5" />
                        </Button>
                    )}
                    {row.original.status === 'in_transit' && (
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openStatusModal(row.original, 'delivered')}
                            className="h-9 w-9 px-0 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-100/50 dark:border-emerald-500/20 shadow-sm"
                            title={t('logistics_module.deliveries.status.delivered')}
                        >
                            <HiOutlineCheckCircle className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            ),
        },
    ], [t]);

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
            <PageHeader
                title={t('logistics_module.deliveries.title')}
                subtitle={t('logistics_module.deliveries.subtitle')}
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
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineMapPin className="w-5 h-5" />}
                            onClick={() => setIsManifestModalOpen(true)}
                            className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            {t('logistics_module.deliveries.manifest')}
                        </Button>
                        <ExportDeliveriesButton data={data?.deliveries || []} key="export" />
                        <Button
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            onClick={() => openModal()}
                        >
                            {t('logistics_module.deliveries.add')}
                        </Button>
                    </div>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {deliveryStatuses.slice(0, 5).map((status) => {
                    const count = data?.deliveries.filter((d: Delivery) => d.status === status.value).length || 0;
                    const Icon = status.icon;
                    return (
                        <Card 
                            key={status.value} 
                            variant="glass" 
                            className={cn(
                                "p-4 cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden group",
                                status.value === statusFilter ? 'ring-2 ring-primary-500' : ''
                            )}
                            onClick={() => setStatusFilter(status.value === statusFilter ? '' : status.value)}
                        >
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-current opacity-[0.03] rounded-full blur-xl group-hover:opacity-[0.06] transition-opacity" />
                            <div className="flex items-center gap-3 relative z-10">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3",
                                    status.color === 'primary' && "bg-primary-50/50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400",
                                    status.color === 'warning' && "bg-amber-50/50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                    status.color === 'info' && "bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
                                    status.color === 'success' && "bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                    status.color === 'danger' && "bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
                                    status.color === 'gray' && "bg-gray-50/50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400"
                                )}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black tracking-tight">{count}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{status.label}</p>
                                </div>
                            </div>
                            <div className={cn(
                                "absolute bottom-0 left-0 h-1 w-6 transition-all group-hover:w-full",
                                status.color === 'primary' && "bg-primary-500/30",
                                status.color === 'warning' && "bg-amber-500/30",
                                status.color === 'info' && "bg-blue-500/30",
                                status.color === 'success' && "bg-emerald-500/30",
                                status.color === 'danger' && "bg-red-500/30",
                                status.color === 'gray' && "bg-gray-500/30"
                            )} />
                        </Card>
                    );
                })}
            </div>

            <SmartTable
                data={data?.deliveries || []}
                columns={deliveryColumns}
                search={{
                    value: search,
                    onChange: (value) => {
                        setSearch(value);
                        setPage(1);
                    },
                    placeholder: t('logistics_module.deliveries.searchPlaceholder'),
                }}
                renderFilters={(
                    <>
                        <div className="w-full lg:w-48">
                            <Select
                                options={[{ value: '', label: t('common.all') }, ...deliveryStatuses.map(s => ({ value: s.value, label: s.label }))]}
                                value={statusFilter}
                                onChange={(event) => {
                                    setStatusFilter(event.target.value);
                                    setPage(1);
                                }}
                                size="sm"
                            />
                        </div>
                        <div className="w-full lg:w-48">
                            <Select
                                options={[{ value: '', label: t('common.all') }, ...priorityOptions.map(p => ({ value: p.value, label: p.label }))]}
                                value={priorityFilter}
                                onChange={(event) => {
                                    setPriorityFilter(event.target.value);
                                    setPage(1);
                                }}
                                size="sm"
                            />
                        </div>
                        <div className="h-10 flex items-center text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {data?.pagination.total || 0} {t('common.results_found')}
                        </div>
                    </>
                )}
                pagination={data && data.pagination.total > 0 ? {
                    currentPage: page,
                    totalItems: data.pagination.total,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                    onItemsPerPageChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                    },
                    itemsPerPageOptions: [10, 20, 50, 100],
                } : undefined}
                onRefresh={() => refetch()}
                emptyTitle={t('logistics_module.deliveries.noDeliveries')}
                emptyDescription={t('messages.start_creating')}
                minHeight="500px"
            />

            {/* Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={isTransferForm ? 'Nova Guia de Transferência' : t('logistics_module.deliveries.add')}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Tipo de Guia: entrega a cliente vs. transferência entre armazéns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, kind: 'shipment' })}
                            className={cn(
                                'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
                                !isTransferForm
                                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                    : 'border-gray-200 dark:border-dark-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-800'
                            )}
                        >
                            <HiOutlineTruck className="w-5 h-5" /> Entrega a cliente
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, kind: 'warehouse_transfer' })}
                            className={cn(
                                'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
                                isTransferForm
                                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                    : 'border-gray-200 dark:border-dark-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-800'
                            )}
                        >
                            <HiOutlineArrowsRightLeft className="w-5 h-5" /> Transferência entre armazéns
                        </button>
                    </div>

                    {isTransferForm && (
                        <div className="space-y-4 rounded-lg border border-primary-100 dark:border-primary-900/40 bg-primary-50/40 dark:bg-primary-900/10 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select
                                    label="Armazém de Origem *"
                                    options={[{ value: '', label: t('common.select') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))]}
                                    value={formData.sourceWarehouseId}
                                    onChange={(e) => setFormData({ ...formData, sourceWarehouseId: e.target.value })}
                                />
                                <Select
                                    label="Armazém de Destino *"
                                    options={[{ value: '', label: t('common.select') }, ...warehouses.filter(w => w.id !== formData.sourceWarehouseId).map(w => ({ value: w.id, label: w.name }))]}
                                    value={formData.targetWarehouseId}
                                    onChange={(e) => setFormData({ ...formData, targetWarehouseId: e.target.value })}
                                />
                            </div>
                            <Input
                                label="Motivo da transferência"
                                placeholder="Ex: reposição de stock da filial"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                A transferência fica a aguardar aprovação. O stock só sai da origem quando a Guia parte e entra no destino na confirmação de entrega.
                            </p>
                        </div>
                    )}

                    {!isTransferForm && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                            label={t('common.country')}
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        />
                        <Select
                            label={t('common.province')}
                            options={[
                                { value: '', label: t('common.select') },
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
                            label={t('common.city')}
                            placeholder="Ex: Matola, Beira"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                    </div>
                    )}

                    {!isTransferForm && (
                    <Input
                        label={`${t('logistics_module.deliveries.address')} *`}
                        placeholder="Rua, número, bairro, referências"
                        value={formData.deliveryAddress}
                        onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                        required
                    />
                    )}

                    {!isTransferForm && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label={t('logistics_module.deliveries.recipient')}
                            placeholder="Nome completo"
                            value={formData.recipientName}
                            onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.drivers.phone')}
                            placeholder="+258 84 000 0000"
                            value={formData.recipientPhone}
                            onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                        />
                    </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Select
                            label={t('logistics_module.deliveries.route')}
                            options={[{ value: '', label: t('logistics_module.deliveries.selectDriver').replace('motorista', 'rota') }, ...(routesData?.data.map((r: DeliveryRoute) => ({ value: r.id, label: `${r.name} (${r.origin} → ${r.destination})` })) || [])]}
                            value={formData.routeId}
                            onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                        />
                        <Select
                            label={t('logistics_module.deliveries.vehicle')}
                            options={[{ value: '', label: t('logistics_module.deliveries.selectDriver').replace('motorista', 'veículo') }, ...(vehiclesData?.data.filter((v: Vehicle) => v.status === 'available').map((v: Vehicle) => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })) || [])]}
                            value={formData.vehicleId}
                            onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                        />
                        <Select
                            label={t('logistics_module.deliveries.driver')}
                            options={[{ value: '', label: t('logistics_module.deliveries.selectDriver') }, ...(driversData?.data.filter((d: Driver) => d.status === 'available').map((d: Driver) => ({ value: d.id, label: d.name })) || [])]}
                            value={formData.driverId}
                            onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <Select
                            label={t('logistics_module.deliveries.priority')}
                            options={priorityOptions.map(p => ({ value: p.value, label: p.label }))}
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.deliveries.scheduled')}
                            type="date"
                            value={formData.scheduledDate}
                            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                        />
                        {!isTransferForm && (
                        <Input
                            label={t('logistics_module.deliveries.shippingCost')}
                            type="number"
                            value={formData.shippingCost}
                            onChange={(e) => setFormData({ ...formData, shippingCost: e.target.value })}
                        />
                        )}
                        {!isTransferForm && (
                        <div className="flex items-end pb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isPaid}
                                    onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <span className="text-sm font-medium">{t('logistics_module.deliveries.paid')}</span>
                            </label>
                        </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {isTransferForm ? 'Produtos a transferir' : 'Itens para Entregar'}
                        </label>
                        {formData.items.map((item, index) => (
                            <div key={index} className="flex gap-2">
                                {isTransferForm ? (
                                    <Select
                                        className="flex-1"
                                        options={[{ value: '', label: 'Selecionar produto...' }, ...products.map(p => ({ value: p.id, label: `${p.name}${p.code ? ` (${p.code})` : ''}` }))]}
                                        value={item.productId ?? ''}
                                        onChange={(e) => {
                                            const newItems = [...formData.items];
                                            newItems[index] = { ...newItems[index], productId: e.target.value };
                                            setFormData({ ...formData, items: newItems });
                                        }}
                                    />
                                ) : (
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
                                )}
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
                                        x
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button variant="ghost" size="sm" onClick={addItem}>
                            <HiOutlinePlus className="w-4 h-4 mr-1" /> {isTransferForm ? 'Adicionar Produto' : 'Adicionar Item'}
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
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading}>
                            {t('logistics_module.deliveries.add')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Status Update Modal */}
            <Modal
                isOpen={isStatusModalOpen}
                onClose={() => { setIsStatusModalOpen(false); setStatusUpdate({ status: '', failureReason: '' }); }}
                title={t('logistics_module.deliveries.status.pending').replace('Pendente', t('common.status'))}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Entrega: <strong>{selectedDelivery?.number}</strong>
                    </p>

                    <Select
                        label={t('common.status')}
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
                            {t('common.cancel')}
                        </Button>
                        <Button className="flex-1" onClick={handleStatusUpdate} isLoading={updateStatusMutation.isLoading} disabled={!statusUpdate.status}>
                            {t('common.confirm')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delivery Details Modal */}
            <Modal
                isOpen={!!selectedDelivery && !isStatusModalOpen}
                onClose={() => setSelectedDelivery(null)}
                title={`${t('common.details')} ${selectedDelivery?.number}`}
                size="lg"
            >
                {selectedDelivery && (
                    <div className="space-y-4">
                        <div className="flex items-start justify-between bg-primary-50 dark:bg-primary-900/10 p-4 rounded-lg border border-primary-100 dark:border-primary-900/50">
                            <div>
                                <label className="text-[10px] font-bold text-primary-600 uppercase tracking-widest">{t('logistics_module.deliveries.number')}</label>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white font-mono">{selectedDelivery.number}</h3>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {getStatusBadge(selectedDelivery.status, t)}
                                    {getPriorityBadge(selectedDelivery.priority, t)}
                                    {selectedDelivery.kind === 'warehouse_transfer' && getTransferBadge(selectedDelivery.transfer?.status)}
                                </div>
                            </div>
                            <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                                <QRCodeSVG 
                                    value={selectedDelivery.number} 
                                    size={80} 
                                    level="H"
                                    includeMargin={false}
                                />
                                <p className="text-[10px] text-center mt-1 font-bold text-gray-400">SCAN ME</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.deliveries.address')}</label>
                                <p className="font-medium">{selectedDelivery.deliveryAddress}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">{t('common.location')}</label>
                                <p className="font-medium">
                                    {[selectedDelivery.city, selectedDelivery.province, selectedDelivery.country].filter(Boolean).join(', ') || '-'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.deliveries.shippingCost')}</label>
                                <p className="font-bold text-lg text-primary-600">
                                    {selectedDelivery.shippingCost ? `${Number(selectedDelivery.shippingCost).toLocaleString()} MZN` : t('common.free')}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.deliveries.paid')}</label>
                                <div className="mt-1">
                                    <Badge variant={selectedDelivery.isPaid ? 'success' : 'warning'}>
                                        {selectedDelivery.isPaid ? t('logistics_module.deliveries.paid') : t('logistics_module.deliveries.status.pending')}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.deliveries.recipient')}</label>
                                <p className="font-medium">{selectedDelivery.recipientName || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.drivers.phone')}</label>
                                <p className="font-medium">{selectedDelivery.recipientPhone || '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.deliveries.driver')}</label>
                                <p className="font-medium">{selectedDelivery.driver?.name || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.deliveries.vehicle')}</label>
                                <p className="font-medium">{selectedDelivery.vehicle?.plate || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">{t('logistics_module.deliveries.route')}</label>
                                <p className="font-medium">{selectedDelivery.route?.name || '-'}</p>
                            </div>
                        </div>

                        {/* Status Timeline */}
                        <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                                {t('logistics_module.deliveries.timeline')}
                            </h4>
                            <DeliveryStatusTimeline events={selectedDeliveryTimeline} />
                        </div>

                        {selectedDelivery.items && selectedDelivery.items.length > 0 && (
                            <div>
                                <label className="text-sm text-gray-500">{t('common.items')}</label>
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
                                <label className="text-gray-500">{t('common.created_at')}</label>
                                <p>{new Date(selectedDelivery.createdAt).toLocaleString()}</p>
                            </div>
                            {selectedDelivery.deliveredDate && (
                                <div>
                                    <label className="text-gray-500">{t('logistics_module.deliveries.status.delivered')}</label>
                                    <p>{new Date(selectedDelivery.deliveredDate).toLocaleString()}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3 pt-4 border-t dark:border-dark-700">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedDelivery(null)}>
                                {t('common.close')}
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-primary-500 text-primary-600 hover:bg-primary-50"
                                onClick={async () => {
                                    try {
                                        const { logisticsAPI } = await import('../../services/api/logistics.api');
                                        const blob = await logisticsAPI.downloadDeliveryPDF(selectedDelivery.id);
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Guia-Transporte-${selectedDelivery.number}.pdf`;
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        toast.success(t('common.success'));
                                    } catch (err) {
                                        const apiErr = err as Error & { response?: { status?: number; data?: { message?: string; error?: string } } };
                                        const message = apiErr?.response?.data?.message ?? apiErr?.message ?? t('common.unknown');
                                        toast.error(`${t('messages.error')}: ${message}`);
                                    }
                                }}
                            >
                                {t('logistics_module.deliveries.printGuide')}
                            </Button>
                            {!selectedDelivery.isPaid && (selectedDelivery.shippingCost || 0) > 0 && (
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => openPaymentModal(selectedDelivery)}
                                >
                                    {t('logistics_module.deliveries.registerPayment')}
                                </Button>
                            )}
                            <Button className="flex-1" onClick={() => openStatusModal(selectedDelivery)}>
                                {t('logistics_module.deliveries.updateStatus')}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title={t('logistics_module.deliveries.registerPayment')}
                size="sm"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('common.total_to_pay')}</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                            {Number(paymentData.amount).toLocaleString()} MZN
                        </p>
                    </div>

                    <Select
                        label={t('common.payment_method')}
                        options={[
                            { value: 'cash', label: t('common.cash') },
                            { value: 'mpesa', label: 'M-Pesa' },
                            { value: 'card', label: t('common.card') },
                            { value: 'transfer', label: t('common.transfer') }
                        ]}
                        value={paymentData.paymentMethod}
                        onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setIsPaymentModalOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handlePayment}
                            isLoading={payMutation.isLoading}
                        >
                            {t('common.confirm_payment')}
                        </Button>
                    </div>
                </div>
            </Modal>
            {/* Manifest Modal */}
            <Modal
                isOpen={isManifestModalOpen}
                onClose={() => setIsManifestModalOpen(false)}
                title={t('logistics_module.deliveries.manifest')}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('logistics_module.deliveries.manifestHelp')}
                    </p>
                    
                    <Select
                        label={t('logistics_module.deliveries.driver')}
                        options={[{ value: '', label: t('logistics_module.deliveries.selectDriver') }, ...(driversData?.data.map((d: Driver) => ({ value: d.id, label: d.name })) || [])]}
                        value={manifestDriverId}
                        onChange={(e) => setManifestDriverId(e.target.value)}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setIsManifestModalOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={generateLoadManifest}>
                            {t('logistics_module.deliveries.printManifest')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
