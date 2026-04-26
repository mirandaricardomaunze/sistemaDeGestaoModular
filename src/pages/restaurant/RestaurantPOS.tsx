import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button, Input, Badge, Modal } from '../../components/ui';
import { useProducts } from '../../hooks/useData';
import { useRestaurantTables, useUpdateTableStatus } from '../../hooks/useRestaurant';
import { useDebounce } from '../../hooks/useDebounce';
import { salesAPI } from '../../services/api';
import { formatCurrency } from '../../utils/helpers';
import { cn } from '../../utils';
import toast from 'react-hot-toast';
import {
    HiOutlineShoppingCart, 
    HiOutlineMagnifyingGlass as HiOutlineSearch, 
    HiOutlineTrash,
    HiOutlinePlus, 
    HiOutlineMinus, 
    HiOutlineXMark as HiOutlineX, 
    HiOutlineArrowPath as HiOutlineRefresh,
    HiOutlineCake
} from 'react-icons/hi2';

// ============================================================================
// TYPES
// ============================================================================

interface CartItem { productId: string; name: string; price: number; quantity: number; total: number; notes?: string }

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Numerário' },
    { value: 'mpesa', label: 'M-Pesa' },
    { value: 'emola', label: 'e-Mola' },
    { value: 'card', label: 'Cartão' },
];

// ============================================================================
// CHECKOUT MODAL
// ============================================================================

function CheckoutModal({ cart, tableId, tableName, onClose, onSuccess }: {
    cart: CartItem[]; tableId?: string; tableName: string; onClose: () => void; onSuccess: () => void;
}) {
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [processing, setProcessing] = useState(false);

    const subtotal = cart.reduce((s, i) => s + i.total, 0);
    const paid = parseFloat(amountPaid) || 0;
    const change = Math.max(0, paid - subtotal);

    const handleConfirm = async () => {
        if (paymentMethod === 'cash' && paid < subtotal) {
            toast.error('Valor recebido insuficiente');
            return;
        }
        setProcessing(true);
        try {
            const sanitizedItems = cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: Number(item.price.toFixed(2)),
                total: Number(item.total.toFixed(2))
            }));
            const validSubtotal = Number(sanitizedItems.reduce((acc, item) => acc + item.total, 0).toFixed(2));
            const validTotal = validSubtotal; // No tax/discount logic here yet, but rounding anyway

            await salesAPI.create({
                items: sanitizedItems,
                subtotal: validSubtotal,
                total: validTotal,
                paymentMethod,
                amountPaid: paymentMethod === 'cash' ? Number(paid.toFixed(2)) : validTotal,
                change: paymentMethod === 'cash' ? Number(change.toFixed(2)) : 0,
                tableId: tableId || undefined,
                originModule: 'restaurant',
                notes: tableId ? `Mesa: ${tableName}` : undefined,
            } as any);
            toast.success('Pedido registado com sucesso!');
            onSuccess();
        } catch (err: any) {
            const errorResponse = err.response?.data;
            const errorMessage = errorResponse?.message || errorResponse?.error || err.message || 'Erro ao registar pedido';
            
            if (errorResponse?.errors && Array.isArray(errorResponse.errors)) {
                const validationErrors = errorResponse.errors
                    .map((detail: any) => `• ${detail.label || detail.field || 'campo'}: ${detail.message}`)
                    .join('\n');
                toast.error(`Erro de Validação\n\n${validationErrors}`, { duration: 8000 });
            } else {
                toast.error(errorMessage, { duration: 6000 });
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title={`Checkout - ${tableName}`}>
            <div className="space-y-4">
                {/* Order Summary */}
                <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 space-y-2 max-h-52 overflow-y-auto">
                    {cart.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{item.quantity}x {item.name}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.total)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-dark-600 pt-3">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-red-600">{formatCurrency(subtotal)}</span>
                </div>

                {/* Payment Method */}
                <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(m => (
                        <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                            className={cn('rounded-lg p-3 text-sm font-medium border-2 transition-all', paymentMethod === m.value ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700' : 'border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-300')}>
                            {m.label}
                        </button>
                    ))}
                </div>

                {paymentMethod === 'cash' && (
                    <div className="space-y-2">
                        <Input label="Valor Recebido (MZN)" type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" autoFocus />
                        {paid >= subtotal && (
                            <div className="flex justify-between text-sm font-medium">
                                <span className="text-gray-500">Troco</span>
                                <span className="text-emerald-600">{formatCurrency(change)}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button onClick={handleConfirm} isLoading={processing} className="flex-1 bg-red-600 hover:bg-red-700">
                        Confirmar Pagamento
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ============================================================================
// MAIN POS PAGE
// ============================================================================

export default function RestaurantPOS() {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const debouncedSearch = useDebounce(search, 400);
    const updateTableStatus = useUpdateTableStatus();

    const { products, isLoading } = useProducts({ search: debouncedSearch, category: selectedCategory || undefined, limit: 100, origin_module: 'restaurant' });
    const { data: tablesData, refetch: refetchTables } = useRestaurantTables({ status: undefined });
    const tables = tablesData?.data || [];

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setCart([]); setSelectedTable(null); }
            if (e.key === 'F4' && cart.length > 0) setCheckoutOpen(true);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [cart]);

    const categories = useMemo(() => {
        const cats = new Set((products || []).map((p: any) => p.category).filter(Boolean));
        return Array.from(cats) as string[];
    }, [products]);

    const addToCart = useCallback((product: any) => {
        setCart(prev => {
            const idx = prev.findIndex(i => i.productId === product.id);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1, total: (updated[idx].quantity + 1) * updated[idx].price };
                return updated;
            }
            return [...prev, { productId: product.id, name: product.name, price: Number(product.price), quantity: 1, total: Number(product.price) }];
        });
    }, []);

    const updateQty = (productId: string, delta: number) => {
        setCart(prev => {
            const updated = prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta, total: (i.quantity + delta) * i.price } : i);
            return updated.filter(i => i.quantity > 0);
        });
    };

    const removeItem = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));

    const subtotal = cart.reduce((s, i) => s + i.total, 0);

    const handleCheckoutSuccess = async () => {
        setCheckoutOpen(false);
        setCart([]);
        if (selectedTable) {
            await updateTableStatus.mutateAsync({ id: selectedTable.id, status: 'available' });
            setSelectedTable(null);
            refetchTables();
        }
    };

    const handleSelectTable = (table: any) => {
        setSelectedTable(table);
        if (table.status === 'available') {
            updateTableStatus.mutate({ id: table.id, status: 'occupied' });
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden">
            {/* LEFT: Products Panel */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-dark-900 overflow-hidden">
                {/* Top bar */}
                <div className="p-4 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 space-y-3">
                    <div className="flex items-center gap-3">
                        <Input
                            className="flex-1"
                            placeholder="Pesquisar menu... (F2)"
                            leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {categories.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hidden">
                            <Button
                                variant={!selectedCategory ? 'primary' : 'secondary'}
                                onClick={() => setSelectedCategory('')}
                                size="sm"
                                className={cn('rounded-full whitespace-nowrap', !selectedCategory ? 'bg-red-600' : '')}
                            >
                                Todos
                            </Button>
                            {categories.map(cat => (
                                <Button
                                    key={cat}
                                    variant={selectedCategory === cat ? 'primary' : 'secondary'}
                                    onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                                    size="sm"
                                    className={cn('rounded-full whitespace-nowrap', selectedCategory === cat ? 'bg-red-600' : '')}
                                >
                                    {cat}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Table Selector */}
                <div className="p-3 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mesa</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hidden">
                        <button onClick={() => setSelectedTable(null)}
                            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border-2 whitespace-nowrap transition-all', !selectedTable ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300')}>
                            Balcão
                        </button>
                        {tables.map((t: any) => (
                            <button key={t.id} onClick={() => handleSelectTable(t)}
                                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border-2 whitespace-nowrap transition-all',
                                    selectedTable?.id === t.id ? 'border-red-500 bg-red-50 text-red-700' :
                                    t.status === 'occupied' ? 'border-red-300 bg-red-50/50 text-red-500' :
                                    'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300')}>
                                M{t.number}{t.name ? ` • ${t.name}` : ''}
                                {t.status === 'occupied' && <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />}
                            </button>
                        ))}
                        <Button variant="ghost" size="xs" onClick={() => refetchTables()} className="px-2">
                            <HiOutlineRefresh className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Products Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-28 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />)}
                        </div>
                    ) : (products || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                            <HiOutlineCake className="w-12 h-12 opacity-40" />
                            <p className="text-sm">
                                {search ? 'Nenhum item encontrado' : 'Sem itens no menu. Adicione produtos com categoria "restaurant".'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {(products || []).map((product: any) => {
                                const inCart = cart.find(i => i.productId === product.id);
                                return (
                                    <button key={product.id} onClick={() => addToCart(product)}
                                        className={cn(
                                            'relative rounded-lg p-3 text-left transition-all border-2 hover:shadow-md active:scale-95',
                                            inCart ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-transparent bg-white dark:bg-dark-800 hover:border-red-200'
                                        )}>
                                        {inCart && (
                                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">{inCart.quantity}</div>
                                        )}
                                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                                            <HiOutlineCake className="w-6 h-6 text-red-500" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{product.name}</p>
                                        <p className="text-xs text-red-600 font-bold mt-1">{formatCurrency(product.price)}</p>
                                        {product.currentStock <= 0 && <Badge variant="danger" className="mt-1 text-[10px]">Esgotado</Badge>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Cart Panel */}
            <div className="w-80 xl:w-96 flex flex-col bg-white dark:bg-dark-800 border-l border-gray-200 dark:border-dark-700">
                {/* Cart Header */}
                <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                            <HiOutlineShoppingCart className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold dark:text-white">POS Restaurante</h1>
                            <p className="text-xs text-gray-500">Venda directa ao cliente e gestão de mesas</p>
                        </div>
                        {cart.length > 0 && (
                            <button onClick={() => setCart([])} className="ml-auto text-gray-400 hover:text-red-500 transition-colors">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{cart.length} {cart.length === 1 ? 'item' : 'itens'} • ESC limpa • F4 paga</p>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <HiOutlineShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Selecione itens do menu</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.productId} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-dark-700">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(item.price)} / un</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="secondary"
                                        size="xs"
                                        onClick={() => updateQty(item.productId, -1)}
                                        className="h-7 w-7 p-0 flex items-center justify-center hover:bg-red-50 hover:text-red-600"
                                    >
                                        <HiOutlineMinus className="w-3.5 h-3.5" />
                                    </Button>
                                    <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-white">{item.quantity}</span>
                                    <Button
                                        variant="secondary"
                                        size="xs"
                                        onClick={() => updateQty(item.productId, 1)}
                                        className="h-7 w-7 p-0 flex items-center justify-center hover:bg-green-50 hover:text-green-600"
                                    >
                                        <HiOutlinePlus className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => removeItem(item.productId)}
                                        className="h-7 w-7 ml-1 p-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-dark-700 space-y-3">
                    <div className="flex justify-between items-center text-lg font-bold">
                        <span className="text-gray-900 dark:text-white">Total</span>
                        <span className="text-red-600">{formatCurrency(subtotal)}</span>
                    </div>
                    <Button
                        onClick={() => setCheckoutOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        leftIcon={<HiOutlineShoppingCart className="w-5 h-5" />}
                    >
                        Cobrar (F4)
                    </Button>
                </div>
            </div>

            {/* Checkout Modal */}
            {checkoutOpen && (
                <CheckoutModal
                    cart={cart}
                    tableId={selectedTable?.id}
                    tableName={selectedTable ? `Mesa ${selectedTable.number}` : 'Balcão'}
                    onClose={() => setCheckoutOpen(false)}
                    onSuccess={handleCheckoutSuccess}
                />
            )}
        </div>
    );
}
