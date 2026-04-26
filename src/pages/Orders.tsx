import { logger } from '../utils/logger';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useOrders } from '../hooks/useData';
import { useAuthStore } from '../stores/useAuthStore';
import { useStore } from '../stores/useStore';
import { Modal, Button, Textarea, ConfirmationModal } from '../components/ui';
import { ordersAPI } from '../services/api';
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
import { formatCurrency } from '../utils/helpers';

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
    productWeight?: number;
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

interface OrdersProps {
    originModule?: string;
}

export default function Orders({ originModule }: OrdersProps) {
    const { user } = useAuthStore();
    const { companySettings } = useStore();
    const navigate = useNavigate();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const ivaRate = (companySettings.ivaRate ?? 16) / 100;
    const responsibleName = user?.name || 'Sistema';

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Use real orders from API with pagination
    const {
        orders: rawOrders,
        pagination,
        isLoading,
        addOrder,
        updateOrderStatus
    } = useOrders({
        page,
        limit: pageSize,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        originModule,
    });

    const [showWizard, setShowWizard] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showCompletion, setShowCompletion] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Transform API orders to local Order type
    const orders: Order[] = useMemo(() => {
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
                    weight: item.productWeight || undefined,
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
            logger.error('Error creating order:', error);
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
                responsibleName,
            });
            setShowPrintPreview(false);
            setSelectedOrder(null);
        } catch (error) {
            logger.error('Error updating order status:', error);
        }
    };

    // Handle separate order (mark items as separated/picked)
    const handleSeparateOrder = async (order: { id: string }) => {
        try {
            await updateOrderStatus(order.id, {
                status: 'separated',
                responsibleName,
            });
            toast.success('Encomenda marcada como separada!');
        } catch (error) {
            logger.error('Error separating order:', error);
            toast.error('Erro ao marcar encomenda como separada');
        }
    };

    // Handle complete order
    const handleCompleteOrderClick = (order: { id: string }) => {
        const fullOrder = orders.find((o) => o.id === order.id);
        if (fullOrder) {
            setSelectedOrder(fullOrder);
            setShowCompletion(true);
        }
    };

    // Handle order completion
    const handleOrderCompletion = async (_checkedItems: string[], notes: string) => {
        if (!selectedOrder) return;

        // Update order status via API
        try {
            await updateOrderStatus(selectedOrder.id, {
                status: 'completed',
                responsibleName,
                notes: notes,
            });
            setShowCompletion(false);
            setSelectedOrder(null);
        } catch (error) {
            logger.error('Error completing order:', error);
        }
    };

    // Handle generate invoice - call backend directly to convert order to invoice
    const handleGenerateInvoice = async (order: { id: string; orderNumber: string }) => {
        try {
            const invoice = await ordersAPI.convertToInvoice(order.id);
            toast.success(`Fatura ${invoice.invoiceNumber} criada com sucesso!`);
            navigate('/commercial/invoices');
        } catch (error) {
            logger.error('Error generating invoice from order:', error);
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

        // Update order status via API
        try {
            await updateOrderStatus(selectedOrder.id, {
                status: 'cancelled',
                responsibleName,
                notes: cancelReason,
            });
            setShowCancel(false);
            setSelectedOrder(null);
            toast.success('Encomenda cancelada com sucesso! Estoque recomposto.');
        } catch (error) {
            logger.error('Error canceling order:', error);
        }
    };

    return (
        <div>
            {/* Dashboard */}
            <OrdersDashboard
                orders={dashboardOrders}
                pagination={pagination}
                page={page}
                pageSize={pageSize}
                setPage={setPage}
                setPageSize={setPageSize}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onNewOrder={() => setShowWizard(true)}
                onViewOrder={handleViewOrder}
                onPrintOrder={handlePrintOrder}
                onSeparateOrder={handleSeparateOrder}
                onCompleteOrder={handleCompleteOrderClick}
                onGenerateInvoice={handleGenerateInvoice}
                onCancelOrder={handleCancelOrderClick}
                isLoading={isLoading}
                isAdmin={isAdmin}
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
                        status: selectedOrder.status,
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
                title=""
                size="xl"
            >
                {selectedOrder && (
                    <div>
                        {/* ── Order Form Document (matches reference image) ── */}
                        <div className="bg-white text-black rounded-lg border border-gray-200 overflow-hidden shadow-2xl"
                            style={{ fontFamily: "'Inter', Arial, sans-serif", colorScheme: 'light', backgroundColor: '#ffffff' }}>

                            {/* ── TOP: Logo + Title ── */}
                            <div className="flex items-start justify-between px-8 py-5 border-b-2 border-gray-900">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 border border-gray-200 rounded-lg flex items-center justify-center bg-transparent">
                                        <span className="text-gray-400 font-black text-2xl">M</span>
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-gray-900 uppercase tracking-tight leading-tight">
                                            {responsibleName}
                                        </p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-0.5">Sistema de Gestão</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">
                                        FORMULÁRIO DE ENCOMENDA
                                    </h1>
                                    <p className="text-xs font-mono text-gray-500 mt-1">
                                        DOC REFA: {selectedOrder.orderNumber}
                                    </p>
                                </div>
                            </div>

                            {/* ── Status Tracker (Compact) ── */}
                            <div className="px-8 py-3 bg-white border-b border-gray-100">
                                <OrderStatusTracker
                                    currentStatus={selectedOrder.status}
                                    transitions={selectedOrder.transitions}
                                />
                            </div>

                            {/* ── SECTION: DADOS DO CLIENTE ── */}
                            <div className="px-8 py-2 border-b border-gray-100 mt-4">
                                <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">A. DADOS DO CLIENTE E ENTREGA</h3>
                            </div>
                            <div className="px-8 py-3">
                                <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase w-20">Nome:</span>
                                        <span className="flex-1 text-sm text-gray-900 font-semibold border-b border-gray-100 pb-0.5">
                                            {selectedOrder.customerName}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase w-20">Telefone:</span>
                                        <span className="flex-1 text-sm text-gray-900 font-semibold border-b border-gray-100 pb-0.5">
                                            {selectedOrder.customerPhone}
                                        </span>
                                    </div>
                                    {selectedOrder.customerEmail && (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase w-20">Email:</span>
                                            <span className="flex-1 text-sm text-gray-900 border-b border-gray-100 pb-0.5">
                                                {selectedOrder.customerEmail}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase w-20">Entrega:</span>
                                        <span className="flex-1 text-sm text-gray-900 font-semibold border-b border-gray-100 pb-0.5">
                                            {format(new Date(selectedOrder.deliveryDate), 'dd/MM/yyyy')}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase w-20">Prioridade:</span>
                                        <span className={`text-sm font-black border-b border-gray-100 flex-1 ${selectedOrder.priority === 'urgent' ? 'text-red-600' :
                                            selectedOrder.priority === 'high' ? 'text-orange-600' : 'text-gray-900'
                                            }`}>
                                            {selectedOrder.priority.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase w-20">Pagamento:</span>
                                        <span className="flex-1 text-sm text-gray-900 font-semibold border-b border-gray-100 pb-0.5">
                                            {(selectedOrder.paymentMethod || '').toUpperCase()}
                                        </span>
                                    </div>
                                    {selectedOrder.customerAddress && (
                                        <div className="flex items-baseline gap-2 col-span-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase w-20">Endereço:</span>
                                            <span className="flex-1 text-sm text-gray-900 border-b border-gray-100 pb-0.5">
                                                {selectedOrder.customerAddress}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── SECTION: DETALHES DOS PRODUTOS ── */}
                            <div className="px-8 py-2 border-b border-gray-100 mt-4">
                                <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">B. DETALHES DOS PRODUTOS (PEDIDOS)</h3>
                            </div>
                            <div className="px-8 py-3">
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-white border-b border-gray-100" style={{ backgroundColor: 'white' }}>
                                            <th className="px-3 py-2 text-left font-black text-gray-900 uppercase tracking-tighter" style={{ backgroundColor: 'white' }}>
                                                Descrição do Item
                                            </th>
                                            <th className="px-3 py-2 text-center font-black text-gray-900 uppercase w-16" style={{ backgroundColor: 'white' }}>
                                                Qtd
                                            </th>
                                            <th className="px-3 py-2 text-right font-black text-gray-900 uppercase w-28" style={{ backgroundColor: 'white' }}>
                                                V. Unitário
                                            </th>
                                            <th className="px-3 py-2 text-right font-black text-gray-900 uppercase w-28" style={{ backgroundColor: 'white' }}>
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrder.items.map((item, index) => (
                                            <tr key={index} className="border-b border-gray-200 bg-white">
                                                <td className="px-3 py-2 text-gray-900 font-medium">
                                                    {item.product.name}
                                                </td>
                                                <td className="px-3 py-2 text-center font-bold text-gray-900">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-700">
                                                    {formatCurrency(item.product.price)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-900 font-black">
                                                    {formatCurrency(item.product.price * item.quantity)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── SECTION: TOTAIS ── */}
                            <div className="px-8 py-2 border-b border-gray-100 mt-2">
                                <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">C. RESUMO FINANCEIRO</h3>
                            </div>
                            <div className="px-8 py-4">
                                <div className="flex justify-between items-start gap-12">
                                    {/* Left side: Notes/Terms */}
                                    <div className="flex-1">
                                        {selectedOrder.notes && (
                                            <div className="mb-4 p-3 bg-white border border-gray-200 border-l-4 border-l-gray-400 rounded-r-lg">
                                                <p className="text-[9px] font-black text-gray-500 mb-1 uppercase tracking-widest">Observações:</p>
                                                <p className="text-xs text-gray-800 leading-tight italic">{selectedOrder.notes}</p>
                                            </div>
                                        )}
                                        <div className="text-[10px] text-gray-400 font-medium leading-relaxed uppercase tracking-tighter">
                                            Este documento é uma encomenda comercial. Os produtos foram
                                            reservados e a entrega será confirmada após processamento logístico.
                                        </div>
                                    </div>

                                    {/* Right side: Totals table */}
                                    <div className="w-56 bg-white p-4 rounded-lg border border-gray-200">
                                        {(() => {
                                            const total = selectedOrder.total;
                                            // total already includes IVA: subtotal = total / (1 + ivaRate)
                                            const subtotal = total / (1 + ivaRate);
                                            const iva = total - subtotal;
                                            return (
                                                <>
                                                    <div className="flex justify-between py-1 text-xs">
                                                        <span className="font-bold text-gray-400 uppercase tracking-widest text-[8px]">SUBTOTAL (S/IVA)</span>
                                                        <span className="text-gray-900 font-semibold">{formatCurrency(subtotal)}</span>
                                                    </div>
                                                    <div className="flex justify-between py-1 text-xs">
                                                        <span className="font-bold text-gray-400 uppercase tracking-widest text-[8px]">IVA ({(ivaRate * 100).toFixed(0)}%)</span>
                                                        <span className="text-gray-900 font-semibold">{formatCurrency(iva)}</span>
                                                    </div>
                                                    <div className="flex justify-between pt-3 mt-3 border-t border-gray-200">
                                                        <span className="text-gray-900 font-black uppercase tracking-tighter text-xs">TOTAL C/IVA</span>
                                                        <span className="text-xl font-black text-primary-600 leading-none">{formatCurrency(total)}</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* ── SIGNATURE ── */}
                            <div className="px-8 pt-4 pb-6 border-t border-gray-200">
                                <div className="flex justify-end">
                                    <div className="w-56 text-center">
                                        <div className="border-b border-gray-200 mt-10 mb-1.5" />
                                        <p className="text-xs text-gray-600 italic">Assinatura Autorizada</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="ghost" onClick={() => setShowDetails(false)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            {/* Cancel Confirmation Modal */}
            <ConfirmationModal
                isOpen={showCancel}
                onClose={() => {
                    setShowCancel(false);
                    setSelectedOrder(null);
                }}
                onConfirm={handleConfirmCancel}
                title="Cancelar Encomenda"
                message={`Tem certeza que deseja cancelar a encomenda "${selectedOrder?.orderNumber}"? Esta ação recomporá o stock dos itens.`}
                confirmText="Confirmar Cancelamento"
                cancelText="Voltar"
                variant="danger"
                isLoading={false}
            >
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Motivo do Cancelamento
                    </label>
                    <Textarea
                        rows={3}
                        placeholder="Informe o motivo..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                    />
                </div>
            </ConfirmationModal>
        </div>
    );
}
