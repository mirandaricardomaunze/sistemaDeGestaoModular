import { useState, useEffect } from 'react';
import { 
    HiOutlineFire, HiOutlineCheckCircle, HiOutlineClock,
    HiOutlineArrowPath, HiOutlineHandThumbUp,
    HiOutlineInformationCircle
} from 'react-icons/hi2';
import { Card, Button, Badge, LoadingSpinner } from '../../components/ui';
import { useKitchenOrders, useUpdateOrderStatus } from '../../hooks/useRestaurant';
import type { RestaurantOrder, OrderStatus } from '../../services/api/restaurant.api';
import { cn } from '../../utils';

// ============================================================================
// KITCHEN ORDER CARD
// ============================================================================

function KitchenOrderCard({ order, onUpdateStatus, isUpdating }: { 
    order: RestaurantOrder; 
    onUpdateStatus: (id: string, status: OrderStatus) => void;
    isUpdating: boolean;
}) {
    // Calculate minutes since creation
    const [minutesElapsed, setMinutesElapsed] = useState(0);

    useEffect(() => {
        const calculate = () => {
            const diff = Date.now() - new Date(order.createdAt).getTime();
            setMinutesElapsed(Math.floor(diff / 60000));
        };
        calculate();
        const interval = setInterval(calculate, 60000);
        return () => clearInterval(interval);
    }, [order.createdAt]);

    const isUrgent = minutesElapsed >= 15 && order.status !== 'ready' && order.status !== 'served';
    return (
        <Card className={cn(
            "flex flex-col h-full border-t-4 transition-all hover:shadow-lg",
            order.status === 'pending' ? "border-t-orange-500" : 
            order.status === 'preparing' ? "border-t-primary-500" :
            order.status === 'ready' ? "border-t-emerald-500 shadow-emerald-500/10" : "border-t-gray-300"
        )}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-black text-xl text-gray-900 dark:text-white">
                            #{order.orderNumber.slice(-4)}
                        </span>
                        {order.table && (
                            <Badge variant="primary" className="font-bold">
                                MESA {order.table.number}
                            </Badge>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Criado às {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className={cn(
                    "flex flex-col items-end gap-1 px-3 py-1 rounded-lg",
                    isUrgent ? "bg-red-50 dark:bg-red-900/20 text-red-600" : "bg-gray-50 dark:bg-dark-700 text-gray-500"
                )}>
                    <div className="flex items-center gap-1 font-black text-lg">
                        <HiOutlineClock className={cn("w-4 h-4", isUrgent && "animate-pulse")} />
                        {minutesElapsed}m
                    </div>
                </div>
            </div>

            {/* Items List */}
            <div className="flex-1 p-4 space-y-3">
                {order.items.map((item: any, i: number) => (
                    <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center font-black text-gray-600 dark:text-gray-300 flex-shrink-0">
                            {item.quantity}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                {item.name}
                            </p>
                            {item.notes && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium italic mt-0.5 flex items-center gap-1">
                                    <HiOutlineInformationCircle className="w-3 h-3" />
                                    {item.notes}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="p-4 bg-gray-50 dark:bg-dark-700/50 flex gap-2">
                {order.status === 'pending' && (
                    <Button 
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        leftIcon={<HiOutlineFire className="w-4 h-4" />}
                        onClick={() => onUpdateStatus(order.id, 'preparing')}
                        isLoading={isUpdating}
                    >
                        Iniciar Preparo
                    </Button>
                )}
                {order.status === 'preparing' && (
                    <Button 
                        className="w-full bg-primary-600 hover:bg-primary-700"
                        leftIcon={<HiOutlineCheckCircle className="w-4 h-4" />}
                        onClick={() => onUpdateStatus(order.id, 'ready')}
                        isLoading={isUpdating}
                    >
                        Pronto para Servir
                    </Button>
                )}
                {order.status === 'ready' && (
                    <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        leftIcon={<HiOutlineHandThumbUp className="w-4 h-4" />}
                        onClick={() => onUpdateStatus(order.id, 'served')}
                        isLoading={isUpdating}
                    >
                        Pedido Entregue
                    </Button>
                )}
            </div>
        </Card>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RestaurantKitchenPage() {
    const [activeTab, setActiveTab] = useState<'active' | 'ready' | 'all'>('active');
    
    // Status parameters based on tab
    const statusParam: OrderStatus | undefined = activeTab === 'ready' ? 'ready' : undefined;

    const { data: orders, isLoading, refetch } = useKitchenOrders(statusParam);
    const updateStatus = useUpdateOrderStatus();

    const handleUpdateStatus = (id: string, status: OrderStatus) => {
        updateStatus.mutate({ id, status });
    };

    return (
        <div className="space-y-6 pb-12 animate-fade-in flex flex-col h-[calc(100vh-6rem)]">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
                <div>
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-1">
                        <HiOutlineFire className="w-3 h-3" />
                        KDS - Kitchen Display System
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Cozinha</h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white dark:bg-dark-800 p-1 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                        <button 
                            onClick={() => setActiveTab('active')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                activeTab === 'active' ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-50"
                            )}
                        >
                            Em Preparo
                        </button>
                        <button 
                            onClick={() => setActiveTab('ready')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                activeTab === 'ready' ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-50"
                            )}
                        >
                            Prontos
                        </button>
                        <button 
                            onClick={() => setActiveTab('all')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                activeTab === 'all' ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"
                            )}
                        >
                            Todos
                        </button>
                    </div>
                    <Button variant="ghost" onClick={() => { refetch(); }} className="p-2.5">
                        <HiOutlineArrowPath className={cn("w-5 h-5", isLoading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {isLoading && !orders ? (
                    <div className="h-full flex items-center justify-center">
                        <LoadingSpinner size="xl" />
                    </div>
                ) : (orders || []).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-24 opacity-50">
                        <HiOutlineCheckCircle className="w-20 h-20 text-gray-300 mb-4" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cozinha Limpa!</h2>
                        <p className="text-gray-500">Nenhum pedido activo de momento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-6">
                        {(orders || []).map(order => (
                            <KitchenOrderCard 
                                key={order.id} 
                                order={order} 
                                onUpdateStatus={handleUpdateStatus}
                                isUpdating={updateStatus.isLoading}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer / Stats bar */}
            <div className="flex-shrink-0 bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-4 rounded-lg flex justify-around">
                <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pendentes</p>
                    <p className="text-xl font-black text-orange-600">
                        {(orders || []).filter(o => o.status === 'pending').length}
                    </p>
                </div>
                <div className="w-px h-8 bg-gray-100 dark:bg-dark-700" />
                <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Em Preparo</p>
                    <p className="text-xl font-black text-primary-600">
                        {(orders || []).filter(o => o.status === 'preparing').length}
                    </p>
                </div>
                <div className="w-px h-8 bg-gray-100 dark:bg-dark-700" />
                <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prontos</p>
                    <p className="text-xl font-black text-emerald-600">
                        {(orders || []).filter(o => o.status === 'ready').length}
                    </p>
                </div>
            </div>
        </div>
    );
}
