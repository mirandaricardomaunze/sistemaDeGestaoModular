import { useState, useMemo, useEffect } from 'react';
import {
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineTruck,
    HiOutlineEye
} from 'react-icons/hi';
import { Card, Button, Input, Select, Badge, Pagination, usePagination, Modal, LoadingOverlay, ConfirmationModal } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { format, parseISO } from 'date-fns';
import CreatePurchaseOrderModal from './CreatePurchaseOrderModal';
import PurchaseOrderPrint from './PurchaseOrderPrint';
import type { PurchaseOrder, PurchaseOrderStatus } from '../../types';
import { suppliersAPI } from '../../services/api';

import toast from 'react-hot-toast';

const statusConfig: Record<PurchaseOrderStatus, { label: string; color: string; bgColor: string }> = {
    draft: { label: 'Rascunho', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    ordered: { label: 'Encomendado', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    received: { label: 'Recebido', color: 'text-green-600', bgColor: 'bg-green-100' },
    cancelled: { label: 'Cancelado', color: 'text-red-600', bgColor: 'bg-red-100' },
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
            const response = await suppliersAPI.getAll();
            const suppliersData = Array.isArray(response) ? response : (response.data || []);

            const ordersPromises = suppliersData.map(async (s: any) => {
                const orders = await suppliersAPI.getPurchaseOrders(s.id);
                // Ensure orders is also an array
                const ordersData = Array.isArray(orders) ? orders : (orders.data || []);
                return ordersData.map((o: any) => ({ ...o, supplierName: s.name }));
            });

            const allOrders = (await Promise.all(ordersPromises)).flat();
            setPurchaseOrders(allOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Erro ao buscar encomendas');
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => { // eslint-disable-next-line
        fetchOrders();
    }, []);

    const handleReceiveOrder = async () => {
        if (selectedOrder) {
            try {
                // Auto receive all items for now (simple flow)
                const itemsToReceive = selectedOrder.items.map(item => ({
                    itemId: item.id,
                    receivedQty: item.quantity
                }));

                await suppliersAPI.receivePurchaseOrder(selectedOrder.id, itemsToReceive);

                toast.success('Encomenda recebida! Estoque atualizado.');
                setShowReceiveModal(false);
                setSelectedOrder(null);
                fetchOrders(); // Refresh list
            } catch (error) {
                console.error('Error receiving order:', error);
                toast.error('Erro ao receber encomenda');
            }
        }
    };

    // Filtered orders
    const filteredOrders = useMemo(() => {
        return purchaseOrders.filter((order) => {
            const matchesSearch =
                order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
                order.supplierName.toLowerCase().includes(search.toLowerCase());

            const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [purchaseOrders, search, statusFilter]);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedOrders,
        totalItems,
    } = usePagination(filteredOrders, 10);



    const handleCancelOrder = (order: PurchaseOrder) => {
        setOrderToCancel(order);
        setCancelConfirmOpen(true);
    };

    const performCancelOrder = async () => {
        if (!orderToCancel) return;
        // updatePurchaseOrder(orderToCancel.id, { status: 'cancelled' });
        toast.error('Cancelamento não implementado no backend ainda.');
        setCancelConfirmOpen(false);
        setOrderToCancel(null);
    };

    return (
        <div className="space-y-6 relative">
            {isLoading && <LoadingOverlay />}
            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex flex-1 gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por número ou fornecedor..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                            />
                        </div>
                        <div className="w-48">
                            <Select
                                options={[
                                    { value: 'all', label: 'Todos os Status' },
                                    { value: 'ordered', label: 'Encomendado' },
                                    { value: 'received', label: 'Recebido' },
                                    { value: 'cancelled', label: 'Cancelado' },
                                ]}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <Button onClick={() => setShowCreateModal(true)}>
                            <HiOutlinePlus className="w-5 h-5 mr-2" />
                            Nova Encomenda
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Orders Table */}
            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-800">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Número</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Entrega Prevista</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Nenhuma encomenda entrada
                                    </td>
                                </tr>
                            ) : (
                                paginatedOrders.map((order) => (
                                    <tr key={order.id} className="bg-white dark:bg-dark-900 hover:bg-gray-50 dark:hover:bg-dark-800">
                                        <td className="px-6 py-4 font-mono text-sm font-medium text-gray-900 dark:text-white">
                                            {order.orderNumber}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                            {order.supplierName}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {format(parseISO(order.createdAt), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={
                                                order.status === 'ordered' ? 'info' :
                                                    order.status === 'received' ? 'success' :
                                                        order.status === 'cancelled' ? 'danger' : 'gray'
                                            }>
                                                {statusConfig[order.status].label}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {order.expectedDeliveryDate ?
                                                format(parseISO(order.expectedDeliveryDate), 'dd/MM/yyyy') :
                                                '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(order.total)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setOrderToPrint(order);
                                                        setShowPrintModal(true);
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 hover:text-blue-600"
                                                    title="Visualizar/Imprimir"
                                                >
                                                    <HiOutlineEye className="w-4 h-4" />
                                                </button>

                                                {/* Actions based on status */}
                                                {order.status === 'ordered' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedOrder(order);
                                                            setShowReceiveModal(true);
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-500 hover:text-green-600"
                                                        title="Receber Encomenda"
                                                    >
                                                        <HiOutlineCheck className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {(order.status === 'ordered' || order.status === 'draft') && (
                                                    <button
                                                        onClick={() => handleCancelOrder(order)}
                                                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600"
                                                        title="Cancelar Encomenda"
                                                    >
                                                        <HiOutlineX className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
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

            {/* Receive Confirmation Modal */}
            <Modal
                isOpen={showReceiveModal}
                onClose={() => setShowReceiveModal(false)}
                title="Receber Encomenda"
                size="sm"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-green-600 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <HiOutlineTruck className="w-6 h-6" />
                        <div>
                            <p className="font-semibold">Confirmar Recebimento</p>
                            <p className="text-sm">Isso irá adicionar os itens ao estoque.</p>
                        </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">
                        Confirmar recebimento da encomenda <strong>{selectedOrder?.orderNumber}</strong> de <strong>{selectedOrder?.supplierName}</strong>?
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setShowReceiveModal(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white focus:ring-green-500"
                            onClick={handleReceiveOrder}
                        >
                            Confirmar e Atualizar Estoque
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Cancel Order Confirmation Modal */}
            <ConfirmationModal
                isOpen={cancelConfirmOpen}
                onClose={() => {
                    setCancelConfirmOpen(false);
                    setOrderToCancel(null);
                }}
                onConfirm={performCancelOrder}
                title="Cancelar Encomenda?"
                message={`Tem certeza que deseja cancelar a encomenda ${orderToCancel?.orderNumber}? Esta ação não pode ser desfeita.`}
                confirmText="Sim, Cancelar"
                cancelText="Não Cancelar"
                variant="danger"
            />
        </div>
    );
}
