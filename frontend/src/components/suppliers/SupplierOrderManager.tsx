import { logger } from '../../utils/logger';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
    HiOutlinePlus,
    HiOutlineCheck,
    HiOutlineXMark as HiOutlineXMark,
    HiOutlineEye,
} from 'react-icons/hi2';
import { Button, Select, Badge, usePagination, ConfirmationModal, SmartTable } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { format, parseISO } from 'date-fns';
import CreatePurchaseOrderModal from './CreatePurchaseOrderModal';
import PurchaseOrderPrint from './PurchaseOrderPrint';
import type { PurchaseOrder, PurchaseOrderStatus, Supplier } from '../../types';
import { suppliersAPI } from '../../services/api';
import toast from 'react-hot-toast';

type ListResponse<T> = T[] | { data?: T[] };

const statusConfig: Record<PurchaseOrderStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' | 'gray' }> = {
    draft: { label: 'Rascunho', variant: 'gray' },
    ordered: { label: 'Encomendado', variant: 'info' },
    partial: { label: 'Parcial', variant: 'warning' },
    received: { label: 'Recebido', variant: 'success' },
    cancelled: { label: 'Cancelado', variant: 'danger' },
};

const toArray = <T,>(value: ListResponse<T>): T[] => {
    return Array.isArray(value) ? value : value.data ?? [];
};

export default function SupplierOrderManager() {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [orderToPrint, setOrderToPrint] = useState<PurchaseOrder | null>(null);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState<PurchaseOrder | null>(null);

    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            const response = await suppliersAPI.getAll() as ListResponse<Supplier>;
            const suppliersData = toArray(response);

            const ordersPromises = suppliersData.map(async (supplier) => {
                const orders = await suppliersAPI.getPurchaseOrders(supplier.id) as ListResponse<PurchaseOrder>;
                return toArray(orders).map((order) => ({
                    ...order,
                    supplierName: supplier.name,
                }));
            });

            setPurchaseOrders((await Promise.all(ordersPromises)).flat());
        } catch (error) {
            logger.error('Error fetching orders:', error);
            toast.error('Erro ao buscar encomendas');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        return purchaseOrders.filter((order) => {
            const normalizedSearch = search.toLowerCase();
            const matchesSearch =
                order.orderNumber.toLowerCase().includes(normalizedSearch) ||
                order.supplierName.toLowerCase().includes(normalizedSearch);

            const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [purchaseOrders, search, statusFilter]);

    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedOrders,
        totalItems,
    } = usePagination(filteredOrders, 10);

    const handleReceiveOrder = async () => {
        if (!selectedOrder) return;

        try {
            const itemsToReceive = selectedOrder.items.map(item => ({
                itemId: item.id,
                receivedQty: item.quantity,
            }));

            await suppliersAPI.receivePurchaseOrder(selectedOrder.id, itemsToReceive);

            toast.success('Encomenda recebida! Estoque atualizado.');
            setShowReceiveModal(false);
            setSelectedOrder(null);
            fetchOrders();
        } catch (error) {
            logger.error('Error receiving order:', error);
            toast.error('Erro ao receber encomenda');
        }
    };

    const handleCancelOrder = (order: PurchaseOrder) => {
        setOrderToCancel(order);
        setCancelConfirmOpen(true);
    };

    const performCancelOrder = async () => {
        if (!orderToCancel) return;

        try {
            await suppliersAPI.cancelPurchaseOrder(orderToCancel.id);
            toast.success('Encomenda cancelada com sucesso.');
            setCancelConfirmOpen(false);
            setOrderToCancel(null);
            fetchOrders();
        } catch (error) {
            logger.error('Error cancelling order:', error);
            toast.error('Erro ao cancelar encomenda');
        }
    };

    const columns = useMemo<ColumnDef<PurchaseOrder, unknown>[]>(() => [
        {
            header: 'Numero',
            accessorKey: 'orderNumber',
            cell: ({ row }) => (
                <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                    {row.original.orderNumber}
                </span>
            ),
        },
        {
            header: 'Fornecedor',
            accessorKey: 'supplierName',
        },
        {
            header: 'Data',
            cell: ({ row }) => format(parseISO(row.original.createdAt), 'dd/MM/yyyy'),
        },
        {
            header: 'Status',
            cell: ({ row }) => (
                <Badge variant={statusConfig[row.original.status].variant}>
                    {statusConfig[row.original.status].label}
                </Badge>
            ),
        },
        {
            header: 'Entrega Prevista',
            cell: ({ row }) => row.original.expectedDeliveryDate
                ? format(parseISO(row.original.expectedDeliveryDate), 'dd/MM/yyyy')
                : '-',
        },
        {
            header: 'Total',
            cell: ({ row }) => (
                <span className="block text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(row.original.total)}
                </span>
            ),
        },
        {
            header: 'Accoes',
            cell: ({ row }) => {
                const order = row.original;

                return (
                    <div className="flex justify-center gap-1">
                        <Button variant="ghost"
                            onClick={() => {
                                setOrderToPrint(order);
                                setShowPrintModal(true);
                            }}
                            className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 hover:text-blue-600"
                            title="Visualizar/Imprimir"
                        >
                            <HiOutlineEye className="w-4 h-4" />
                        </Button>

                        {order.status === 'ordered' && (
                            <Button variant="ghost"
                                onClick={() => {
                                    setSelectedOrder(order);
                                    setShowReceiveModal(true);
                                }}
                                className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-500 hover:text-green-600"
                                title="Receber Encomenda"
                            >
                                <HiOutlineCheck className="w-4 h-4" />
                            </Button>
                        )}

                        {(order.status === 'ordered' || order.status === 'draft') && (
                            <Button variant="ghost"
                                onClick={() => handleCancelOrder(order)}
                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600"
                                title="Cancelar Encomenda"
                            >
                                <HiOutlineXMark className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ], []);

    return (
        <div className="space-y-6 relative">
            <SmartTable
                data={paginatedOrders}
                columns={columns}
                isLoading={isLoading}
                search={{
                    value: search,
                    onChange: (value) => {
                        setSearch(value);
                        setCurrentPage(1);
                    },
                    placeholder: 'Buscar por numero ou fornecedor...',
                }}
                renderFilters={(
                    <Select
                        options={[
                            { value: 'all', label: 'Todos os Status' },
                            { value: 'ordered', label: 'Encomendado' },
                            { value: 'partial', label: 'Parcial' },
                            { value: 'received', label: 'Recebido' },
                            { value: 'cancelled', label: 'Cancelado' },
                        ]}
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        size="sm"
                        className="w-48 bg-white dark:bg-dark-800"
                    />
                )}
                actions={(
                    <Button onClick={() => setShowCreateModal(true)} size="sm">
                        <HiOutlinePlus className="w-5 h-5 mr-2" />
                        Nova Encomenda
                    </Button>
                )}
                emptyTitle="Nenhuma encomenda encontrada"
                emptyDescription="Nenhuma encomenda corresponde aos filtros atuais."
                pagination={{
                    currentPage,
                    totalItems,
                    itemsPerPage,
                    onPageChange: setCurrentPage,
                    onItemsPerPageChange: setItemsPerPage,
                }}
            />

            <CreatePurchaseOrderModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />

            {orderToPrint && (
                <PurchaseOrderPrint
                    isOpen={showPrintModal}
                    onClose={() => {
                        setShowPrintModal(false);
                        setOrderToPrint(null);
                    }}
                    order={orderToPrint}
                />
            )}

            <ConfirmationModal
                isOpen={showReceiveModal}
                onClose={() => setShowReceiveModal(false)}
                onConfirm={handleReceiveOrder}
                title="Receber Encomenda"
                message={`Deseja confirmar o recebimento da encomenda ${selectedOrder?.orderNumber} de ${selectedOrder?.supplierName}? Isso ira adicionar os itens ao estoque.`}
                confirmText="Confirmar e Atualizar Estoque"
                cancelText="Cancelar"
                variant="success"
            />

            <ConfirmationModal
                isOpen={cancelConfirmOpen}
                onClose={() => {
                    setCancelConfirmOpen(false);
                    setOrderToCancel(null);
                }}
                onConfirm={performCancelOrder}
                title="Cancelar Encomenda?"
                message={`Tem certeza que deseja cancelar a encomenda ${orderToCancel?.orderNumber}? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`}
                confirmText="Sim, Cancelar"
                cancelText="Nao Cancelar"
                variant="danger"
            />
        </div>
    );
}
