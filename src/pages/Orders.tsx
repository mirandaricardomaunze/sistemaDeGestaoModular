import { useState, useMemo } from 'react';
import { HiOutlineTrash } from 'react-icons/hi';
import { format } from 'date-fns';
import { useProducts, useOrders } from '../hooks/useData';
import { Card, Modal, Button } from '../components/ui';
import {
    OrderCreationWizard,
    OrderStatusTracker,
    OrderPrintPreview,
    OrderCompletionModal,
    OrdersDashboard,
} from '../components/orders';
import type { OrderStatus, StatusTransition } from '../components/orders';
import type { Product } from '../types';
import toast from 'react-hot-toast';

interface OrderItem {
    product: Product;
    quantity: number;
}

// Types for API response
interface ApiOrderItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number | string;
    total: number | string;
}

interface ApiTransition {
    id?: string;
    status: string;
    timestamp: string;
    responsibleName?: string;
    notes?: string;
}

interface ApiOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress?: string;
    items?: ApiOrderItem[];
    total: number | string;
    status: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    paymentMethod?: string;
    createdAt: string;
    deliveryDate?: string;
    notes?: string;
    transitions?: ApiTransition[];
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress?: string;
    items: OrderItem[];
    total: number;
    status: OrderStatus;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    paymentMethod: string;
    createdAt: string;
    deliveryDate: string;
    notes?: string;
    transitions: StatusTransition[];
}

export default function Orders() {
    const { products: productsData, updateProduct } = useProducts();
    const products = Array.isArray(productsData) ? productsData : [];

    // Use real orders from API
    const { orders: rawOrders, addOrder, updateOrderStatus } = useOrders();

    const [showWizard, setShowWizard] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showCompletion, setShowCompletion] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Transform API orders to local Order type
    const orders: Order[] = useMemo(() => {
        console.log('Orders Component - rawOrders received:', rawOrders);
        const list = Array.isArray(rawOrders) ? rawOrders : [];
        return list.map((o: ApiOrder) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            customerEmail: o.customerEmail,
            customerAddress: o.customerAddress,
            items: (o.items || []).map((item: ApiOrderItem) => ({
                product: {
                    id: item.productId,
                    name: item.productName,
                    price: Number(item.price),
                    currentStock: 0,
                } as Product,
                quantity: item.quantity,
            })),
            total: Number(o.total),
            status: o.status as OrderStatus,
            priority: o.priority,
            paymentMethod: o.paymentMethod || 'cash',
            createdAt: o.createdAt,
            deliveryDate: o.deliveryDate ? new Date(o.deliveryDate).toISOString().split('T')[0] : '',
            notes: o.notes,
            transitions: (o.transitions || []).map((t: ApiTransition) => ({
                status: t.status as OrderStatus,
                timestamp: t.timestamp,
                responsibleName: t.responsibleName,
                notes: t.notes,
            })),
        }));
    }, [rawOrders]);

    // Convert order for dashboard
    const dashboardOrders = useMemo(() => {
        return orders.map((order) => ({
            ...order,
            items: order.items.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                price: item.product.price,
            })),
        }));
    }, [orders]);

    // Handle new order creation
    const handleOrderComplete = async (orderData: {
        customer: { name: string; phone: string; email?: string; address?: string };
        items: OrderItem[];
        details: { deliveryDate: string; priority: 'low' | 'normal' | 'high' | 'urgent'; notes?: string; paymentMethod: string };
        total: number;
    }) => {
        try {
            await addOrder({
                customerName: orderData.customer.name,
                customerPhone: orderData.customer.phone,
                customerEmail: orderData.customer.email,
                customerAddress: orderData.customer.address,
                items: orderData.items.map(item => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: item.quantity,
                    price: item.product.price,
                })),
                total: orderData.total,
                priority: orderData.details.priority,
                paymentMethod: orderData.details.paymentMethod,
                deliveryDate: orderData.details.deliveryDate,
                notes: orderData.details.notes,
            });
            setShowWizard(false);
        } catch (error) {
            console.error('Error creating order:', error);
        }
    };

    // Handle view order details
    const handleViewOrder = (order: { id: string }) => {
        const fullOrder = orders.find((o) => o.id === order.id);
        if (fullOrder) {
            setSelectedOrder(fullOrder);
            setShowDetails(true);
        }
    };

    // Handle print order
    const handlePrintOrder = (order: { id: string }) => {
        const fullOrder = orders.find((o) => o.id === order.id);
        if (fullOrder) {
            setSelectedOrder(fullOrder);
            setShowPrintPreview(true);
        }
    };

    // Handle mark as printed
    const handleMarkAsPrinted = async () => {
        if (!selectedOrder) return;

        try {
            await updateOrderStatus(selectedOrder.id, {
                status: 'printed',
                responsibleName: 'Admin',
            });
            setShowPrintPreview(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    };

    // Handle complete order
    const handleCompleteOrderClick = (order: { id: string }) => {
        const fullOrder = orders.find((o) => o.id === order.id);
        if (fullOrder) {
            // If order has no items yet (sample data), add some products for demo
            if (fullOrder.items.length === 0 && products.length > 0) {
                fullOrder.items = products.slice(0, 3).map((p) => ({
                    product: p,
                    quantity: Math.floor(Math.random() * 5) + 1,
                }));
            }
            setSelectedOrder(fullOrder);
            setShowCompletion(true);
        }
    };

    // Handle order completion
    const handleOrderCompletion = async (checkedItems: string[], notes: string) => {
        if (!selectedOrder) return;

        // Update stock
        selectedOrder.items.forEach((item) => {
            if (checkedItems.includes(item.product.id)) {
                const newQuantity = item.product.currentStock - item.quantity;
                updateProduct(item.product.id, { currentStock: Math.max(0, newQuantity) });
            }
        });

        // Update order status via API
        try {
            await updateOrderStatus(selectedOrder.id, {
                status: 'completed',
                responsibleName: 'Admin',
                notes: notes,
            });
            setShowCompletion(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Error completing order:', error);
        }
    };

    // Handle cancel order click
    const handleCancelOrderClick = (order: { id: string }) => {
        const fullOrder = orders.find((o) => o.id === order.id);
        if (fullOrder) {
            setSelectedOrder(fullOrder);
            setCancelReason('');
            setShowCancel(true);
        }
    };

    // Handle confirm cancel
    const handleConfirmCancel = async () => {
        if (!selectedOrder) return;

        // Revert stock for items
        selectedOrder.items.forEach((item) => {
            const product = products.find((p) => p.id === item.product.id);
            if (product) {
                updateProduct(product.id, {
                    currentStock: product.currentStock + item.quantity
                });
            }
        });

        // Update order status via API
        try {
            await updateOrderStatus(selectedOrder.id, {
                status: 'cancelled',
                responsibleName: 'Admin',
                notes: cancelReason,
            });
            setShowCancel(false);
            setSelectedOrder(null);
            toast.success('Encomenda cancelada com sucesso! Estoque recomposto.');
        } catch (error) {
            console.error('Error canceling order:', error);
        }
    };

    return (
        <div>
            {/* Dashboard */}
            <OrdersDashboard
                orders={dashboardOrders}
                onNewOrder={() => setShowWizard(true)}
                onViewOrder={handleViewOrder}
                onPrintOrder={handlePrintOrder}
                onCompleteOrder={handleCompleteOrderClick}
                onCancelOrder={handleCancelOrderClick}
            />

            {/* Creation Wizard */}
            <OrderCreationWizard
                isOpen={showWizard}
                onClose={() => setShowWizard(false)}
                onComplete={handleOrderComplete}
            />

            {/* Print Preview */}
            {selectedOrder && (
                <OrderPrintPreview
                    isOpen={showPrintPreview}
                    onClose={() => {
                        setShowPrintPreview(false);
                        setSelectedOrder(null);
                    }}
                    order={{
                        id: selectedOrder.id,
                        orderNumber: selectedOrder.orderNumber,
                        customerName: selectedOrder.customerName,
                        customerPhone: selectedOrder.customerPhone,
                        deliveryDate: selectedOrder.deliveryDate,
                        priority: selectedOrder.priority,
                        items: selectedOrder.items,
                        notes: selectedOrder.notes,
                        total: selectedOrder.total,
                    }}
                    onMarkAsPrinted={handleMarkAsPrinted}
                />
            )}

            {/* Completion Modal */}
            {selectedOrder && (
                <OrderCompletionModal
                    isOpen={showCompletion}
                    onClose={() => {
                        setShowCompletion(false);
                        setSelectedOrder(null);
                    }}
                    orderNumber={selectedOrder.orderNumber}
                    items={selectedOrder.items}
                    onComplete={handleOrderCompletion}
                />
            )}

            {/* Order Details Modal */}
            <Modal
                isOpen={showDetails}
                onClose={() => {
                    setShowDetails(false);
                    setSelectedOrder(null);
                }}
                title={`Detalhes - ${selectedOrder?.orderNumber}`}
                size="lg"
            >
                {selectedOrder && (
                    <div className="space-y-6">
                        {/* Status Tracker */}
                        <OrderStatusTracker
                            currentStatus={selectedOrder.status}
                            transitions={selectedOrder.transitions}
                        />

                        {/* Order Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card padding="sm">
                                <p className="text-sm text-gray-500">Cliente</p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    {selectedOrder.customerName}
                                </p>
                                <p className="text-sm text-gray-500">{selectedOrder.customerPhone}</p>
                            </Card>
                            <Card padding="sm">
                                <p className="text-sm text-gray-500">Entrega</p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    {format(new Date(selectedOrder.deliveryDate), 'dd/MM/yyyy')}
                                </p>
                            </Card>
                        </div>

                        {/* Items */}
                        {selectedOrder.items.length > 0 && (
                            <Card padding="md">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                                    Itens ({selectedOrder.items.length})
                                </h3>
                                <div className="space-y-2">
                                    {selectedOrder.items.map((item, index) => (
                                        <div key={index} className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-300">
                                                {item.quantity}x {item.product.name}
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                R$ {(item.product.price * item.quantity).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Notes */}
                        {selectedOrder.notes && (
                            <Card padding="md" variant="glass">
                                <p className="text-sm text-gray-500 mb-1">Observações</p>
                                <p className="text-gray-900 dark:text-white">{selectedOrder.notes}</p>
                            </Card>
                        )}

                        <Button variant="ghost" className="w-full" onClick={() => setShowDetails(false)}>
                            Fechar
                        </Button>
                    </div>
                )}
            </Modal>
            {/* Cancel Modal */}
            <Modal
                isOpen={showCancel}
                onClose={() => {
                    setShowCancel(false);
                    setSelectedOrder(null);
                }}
                title="Cancelar Encomenda"
                size="md"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
                            <HiOutlineTrash className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-red-900 dark:text-red-300">Atenção!</h3>
                            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                                Tem certeza que deseja cancelar a encomenda <span className="font-bold">{selectedOrder?.orderNumber}</span>?
                                Esta ação não pode ser desfeita.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Motivo do Cancelamento
                        </label>
                        <textarea
                            className="w-full rounded-lg border-gray-300 dark:border-dark-600 dark:bg-dark-800 focus:ring-red-500 focus:border-red-500"
                            rows={3}
                            placeholder="Informe o motivo..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setShowCancel(false);
                                setSelectedOrder(null);
                            }}
                        >
                            Voltar
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleConfirmCancel}
                            disabled={!cancelReason.trim()}
                        >
                            Confirmar Cancelamento
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
