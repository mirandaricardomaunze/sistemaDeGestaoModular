import { logger } from '../../utils/logger';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Button, Input, Badge, LoadingSpinner, EmptyState, Modal, ConfirmationModal } from '../../components/ui';
import ThermalReceiptPreview from '../../components/pos/ThermalReceiptPreview';
import { useProducts, useSales, useCustomers } from '../../hooks/useData';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playScanSound } from '../../utils/audio';
import { useDebounce } from '../../hooks/useDebounce';
import toast from 'react-hot-toast';
import {
    HiOutlineShoppingCart,
    HiOutlineSearch,
    HiOutlineCube,
    HiOutlineTrash,
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineMinus,
    HiOutlineUserCircle,
    HiOutlineScale,
    HiOutlineX
} from 'react-icons/hi';
import { salesAPI } from '../../services/api';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import { useScale } from '../../hooks/useScale';
import { PrinterService } from '../../services/printer.service';
import { searchCustomersForPOS } from '../../utils/crmIntegration';
import { formatCurrency } from '../../utils/helpers';

export default function BottleStorePOS() {
    // Pagination State for POS
    const [prodPage] = useState(1);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);

    const {
        products,
        isLoading,
        refetch: refetchProducts
    } = useProducts({
        origin_module: 'bottle_store',
        search: debouncedSearch,
        page: prodPage,
        limit: 100 // More items for POS view
    });

    const { sales, refetch: refetchSales } = useSales({ limit: 100 });
    const { customers } = useCustomers();

    // Hardware Hooks
    const { connect: connectScale, weight: scaleWeight, isConnected: isScaleConnected } = useScale();

    // POS State
    const [cart, setCart] = useState<any[]>([]);
    const [customerMoney, setCustomerMoney] = useState('');
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [processingSale, setProcessingSale] = useState(false);
    const [lastSale, setLastSale] = useState<any>(null);
    const [thermalPreviewOpen, setThermalPreviewOpen] = useState(false);
    const [clearCartModalOpen, setClearCartModalOpen] = useState(false);
    const [globalDiscount, setGlobalDiscount] = useState('0');

    // Price tier cache: productId -> sorted tiers[]
    const priceTiersCache = useRef<Record<string, any[]>>({});

    const getTiersForProduct = async (productId: string): Promise<any[]> => {
        if (priceTiersCache.current[productId] !== undefined) {
            return priceTiersCache.current[productId];
        }
        try {
            const res = await bottleStoreAPI.getPriceTiers(productId);
            const tiers = (res || []).sort((a: any, b: any) => b.minQty - a.minQty); // highest threshold first
            priceTiersCache.current[productId] = tiers;
            return tiers;
        } catch {
            priceTiersCache.current[productId] = [];
            return [];
        }
    };

    // Given product base price + current total units quantity, return the best price from tiers (or base price)
    const getBestPrice = (tiers: any[], basePrice: number, totalQty: number): { price: number; tier: any | null } => {
        for (const tier of tiers) { // already sorted highest minQty first
            if (totalQty >= tier.minQty) {
                return { price: tier.price, tier };
            }
        }
        return { price: basePrice, tier: null };
    };

    // Customer Selection State
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);
    const productSearchRef = useRef<HTMLInputElement>(null);

    // Calculate customer purchase history
    const customerHistory = useMemo(() => {
        if (!selectedCustomer || !sales) return null;

        const customerSales = sales
            .filter(sale => sale.customerId === selectedCustomer.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        const totalSpent = sales
            .filter(sale => sale.customerId === selectedCustomer.id)
            .reduce((sum, sale) => sum + Number(sale.total || 0), 0);

        return {
            recentPurchases: customerSales,
            totalSpent,
            purchaseCount: sales.filter(sale => sale.customerId === selectedCustomer.id).length
        };
    }, [selectedCustomer, sales]);

    const customerSearchResults = useMemo(() => {
        if (!customerSearchQuery || !showCustomerSearch) return [];
        return searchCustomersForPOS(customerSearchQuery, customers || []);
    }, [customerSearchQuery, customers, showCustomerSearch]);

    // Close customer dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setShowCustomerSearch(false);
            }
        };

        if (showCustomerSearch) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showCustomerSearch]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                productSearchRef.current?.focus();
            }
            if (e.key === 'F4') {
                e.preventDefault();
                if (cart.length > 0) {
                    setIsCheckoutModalOpen(true);
                }
            }
            if (e.key === 'Escape' && cart.length > 0 && !isCheckoutModalOpen) {
                setClearCartModalOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, isCheckoutModalOpen]);

    // Universal Barcode Scanner Integration
    useBarcodeScanner({
        onScan: (barcode) => {
            const found = products.find(p => p.code === barcode || p.barcode === barcode);
            if (found) {
                addToCart(found, 'unit', false);
                playScanSound();
                toast.success(`Adicionado: ${found.name}`);
            } else {
                toast.error('Bebida não encontrada');
            }
        },
        enabled: !isCheckoutModalOpen && !clearCartModalOpen && !thermalPreviewOpen
    });

    // Cart Logic
    const clearCart = () => {
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchQuery('');
        setGlobalDiscount('0');
    };

    const addToCart = async (product: any, mode: 'unit' | 'crate' = 'unit', withReturn: boolean = false) => {
        const packSize = product.packSize || 1;
        const existingIndex = cart.findIndex(item =>
            item.id === product.id && item.mode === mode && item.withReturn === withReturn
        );

        const tiers = await getTiersForProduct(product.id);

        if (existingIndex > -1) {
            const newCart = [...cart];
            const nextQuantity = newCart[existingIndex].quantity + 1;
            const totalUnitsNeeded = nextQuantity * (mode === 'crate' ? packSize : 1);

            if (product.currentStock < totalUnitsNeeded) {
                toast.error(`Stock insuficiente! Disponível: ${product.currentStock} unidades`);
                return;
            }

            // Re-evaluate price tiers for new quantity
            const baseUnitPrice = mode === 'crate' ? product.price * packSize : product.price;
            const { price: bestPrice, tier } = getBestPrice(tiers, baseUnitPrice, nextQuantity);
            const returnDiscount = withReturn ? (product.returnPrice * (mode === 'crate' ? packSize : 1)) : 0;
            const prevFinalPrice = newCart[existingIndex].finalPrice;
            newCart[existingIndex].quantity = nextQuantity;
            newCart[existingIndex].finalPrice = bestPrice - returnDiscount;

            if (tier && bestPrice < prevFinalPrice) {
                toast.success(`Desconto por volume aplicado! ${tier.label || `â‰¥${tier.minQty} un`} → ${formatCurrency(bestPrice)}/un`, { icon: '' });
            }
            setCart(newCart);
        } else {
            const totalUnitsNeeded = mode === 'crate' ? packSize : 1;
            if (product.currentStock < totalUnitsNeeded) {
                toast.error(`Stock insuficiente!`);
                return;
            }

            const baseUnitPrice = mode === 'crate' ? product.price * packSize : product.price;
            const { price: bestPrice, tier } = getBestPrice(tiers, baseUnitPrice, 1);
            const returnDiscount = withReturn ? (product.returnPrice * (mode === 'crate' ? packSize : 1)) : 0;

            if (tier) {
                toast.success(`Desconto por volume: ${tier.label || `â‰¥${tier.minQty} un`} → ${formatCurrency(bestPrice)}/un`, { icon: '' });
            }

            setCart(prev => [...prev, {
                ...product,
                quantity: 1,
                mode,
                withReturn,
                basePrice: baseUnitPrice,
                finalPrice: bestPrice - returnDiscount,
                activeTier: tier,
            }]);
        }
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.finalPrice * item.quantity), 0), [cart]);
    const discountAmount = parseFloat(globalDiscount) || 0;
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    
    const IVA_RATE = 0.16;
    const totalTax = afterDiscount * IVA_RATE;
    const totalWithTax = afterDiscount + totalTax;

    const handleCheckout = async () => {
        setProcessingSale(true);
        try {
            const saleItems = cart.map(item => {
                const quantity = item.mode === 'crate' ? item.quantity * (item.packSize || 1) : item.quantity;
                const unitPrice = item.finalPrice / (item.mode === 'crate' ? (item.packSize || 1) : 1);

                return {
                    productId: item.id,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    discount: 0,
                    total: quantity * unitPrice
                };
            });

            const savedSale = await salesAPI.create({
                customerId: selectedCustomer?.id,
                items: saleItems,
                paymentMethod: 'cash',
                amountPaid: parseFloat(customerMoney) || totalWithTax,
                subtotal: subtotal,
                total: totalWithTax,
                tax: totalTax,
                discount: discountAmount,
                notes: selectedCustomer ? `Cliente: ${selectedCustomer.name} (Garrafeira)` : 'Venda Garrafeira'
            });

            // Trigger Cash Drawer
            PrinterService.openDrawer().catch(err => logger.error('Auto-drawer failed:', err));

            toast.success('Venda realizada!');
            setLastSale(savedSale);
            clearCart();
            setCustomerMoney('');
            setIsCheckoutModalOpen(false);
            setThermalPreviewOpen(true);
            refetchProducts();
            refetchSales();
        } catch (error) {
            toast.error('Erro ao processar venda');
        } finally {
            setProcessingSale(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 h-full">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-dark-800 p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                        <HiOutlineShoppingCart className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold dark:text-white">POS Garrafeira</h1>
                        <p className="text-xs text-gray-500">Venda directa ao cliente</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Hardware Controls */}
                    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-dark-700 rounded-lg border border-gray-200 dark:border-dark-600">
                        <HiOutlineScale className={`w-5 h-5 ${isScaleConnected ? 'text-green-500' : 'text-gray-400'}`} />
                        <span className="text-sm font-bold dark:text-white">
                            {isScaleConnected ? `${scaleWeight.toFixed(3)} kg` : 'Balança OFF'}
                        </span>
                        <Button
                            size="sm"
                            variant={isScaleConnected ? 'ghost' : 'primary'}
                            onClick={connectScale}
                            className="h-7 text-[10px]"
                        >
                            {isScaleConnected ? 'Reconectar' : 'Ligar Balança'}
                        </Button>
                    </div>

                    <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">F2</kbd> Busca</span>
                        <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">F4</kbd> Pagar</span>
                        <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">ESC</kbd> Limpar</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                {/* Left Panel: Product Selection */}
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    <Card padding="md" className="flex-shrink-0">
                        <Input
                            ref={productSearchRef}
                            placeholder="Escaneie o código ou busque bebida, marca..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                            className="py-3 text-lg"
                            autoFocus
                        />
                    </Card>

                    <div className="flex-1 overflow-y-auto pb-4 scrollbar-thin">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>
                        ) : products.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                                <EmptyState
                                    icon={<HiOutlineCube className="w-12 h-12 text-gray-300" />}
                                    title="Nenhum produto"
                                    description="Não encontramos bebidas com este critrio."
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {products.map(product => (
                                    <BottleProductCard
                                        key={product.id}
                                        product={product}
                                        onAdd={addToCart}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Cart Sidebar */}
                <div className="w-full md:w-[400px] flex flex-col gap-4">
                    <Card padding="none" className="flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Carrinho</h2>
                                {cart.length > 0 && (
                                    <button onClick={() => setClearCartModalOpen(true)} className="text-sm text-red-600 hover:text-red-700">Limpar</button>
                                )}
                            </div>
                            <p className="text-sm text-gray-500">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>

                            <div className="mt-3 relative" ref={customerDropdownRef}>
                                {selectedCustomer ? (
                                    <div className="flex items-center justify-between p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineUserCircle className="w-5 h-5 text-primary-600" />
                                            <div>
                                                <p className="text-sm font-medium text-primary-700">{selectedCustomer.name}</p>
                                                {customerHistory && (
                                                    <p className="text-[10px] text-primary-600">{customerHistory.purchaseCount} compras | {formatCurrency(customerHistory.totalSpent)}</p>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedCustomer(null)} className="p-1 text-primary-400 hover:text-red-500"><HiOutlineX className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <Input
                                            placeholder="Selecionar cliente..."
                                            value={customerSearchQuery}
                                            onChange={(e) => { setCustomerSearchQuery(e.target.value); setShowCustomerSearch(true); }}
                                            onFocus={() => setShowCustomerSearch(true)}
                                            leftIcon={<HiOutlineUserCircle className="w-5 h-5 text-gray-400" />}
                                        />
                                        {showCustomerSearch && customerSearchResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 max-h-48 overflow-y-auto">
                                                {customerSearchResults.map((customer: any) => (
                                                    <button
                                                        key={customer.id}
                                                        onClick={() => { setSelectedCustomer(customer); setShowCustomerSearch(false); setCustomerSearchQuery(''); }}
                                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-dark-700"
                                                    >
                                                        <p className="text-sm font-medium">{customer.name}</p>
                                                        <p className="text-xs text-gray-500">{customer.phone || 'Sem telefone'}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                                    <HiOutlineShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-base font-medium">Carrinho vazio</p>
                                </div>
                            ) : (
                                cart.map((item, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-dark-600 flex items-center justify-center flex-shrink-0">
                                            <span>{item.mode === 'crate' ? '🍾' : '🍺'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                                            <div className="flex items-center gap-1">
                                                <p className="text-xs text-primary-600">{formatCurrency(item.finalPrice)}</p>
                                                {item.basePrice && item.finalPrice < item.basePrice && (
                                                    <span className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-bold"> VOL</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={async () => {
                                                const newCart = [...cart];
                                                if (newCart[index].quantity > 1) {
                                                    const nextQty = newCart[index].quantity - 1;
                                                    const tiers = await getTiersForProduct(newCart[index].id);
                                                    const basePrice = newCart[index].basePrice ?? newCart[index].finalPrice;
                                                    const returnDiscount = newCart[index].withReturn ? (newCart[index].returnPrice * (newCart[index].mode === 'crate' ? (newCart[index].packSize || 1) : 1)) : 0;
                                                    const { price: bestPrice } = getBestPrice(tiers, basePrice, nextQty);
                                                    newCart[index].quantity = nextQty;
                                                    newCart[index].finalPrice = bestPrice - returnDiscount;
                                                    setCart(newCart);
                                                } else { removeFromCart(index); }
                                            }} className="w-6 h-6 rounded bg-gray-200 dark:bg-dark-600 flex items-center justify-center hover:bg-gray-300"><HiOutlineMinus className="w-3 h-3" /></button>
                                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                            <button onClick={async () => {
                                                const newCart = [...cart];
                                                const nextQty = newCart[index].quantity + 1;
                                                const tiers = await getTiersForProduct(newCart[index].id);
                                                const basePrice = newCart[index].basePrice ?? newCart[index].finalPrice;
                                                const returnDiscount = newCart[index].withReturn ? (newCart[index].returnPrice * (newCart[index].mode === 'crate' ? (newCart[index].packSize || 1) : 1)) : 0;
                                                const { price: bestPrice, tier } = getBestPrice(tiers, basePrice, nextQty);
                                                const prevPrice = newCart[index].finalPrice;
                                                newCart[index].quantity = nextQty;
                                                newCart[index].finalPrice = bestPrice - returnDiscount;
                                                if (tier && bestPrice < prevPrice) {
                                                    toast.success(`Desconto por volume aplicado! ${tier.label || `â‰¥${tier.minQty} un`}`, { icon: '' });
                                                }
                                                setCart(newCart);
                                            }} className="w-6 h-6 rounded bg-gray-200 dark:bg-dark-600 flex items-center justify-center hover:bg-gray-300"><HiOutlinePlus className="w-3 h-3" /></button>
                                        </div>
                                        <button onClick={() => removeFromCart(index)} className="p-1 text-gray-400 hover:text-red-500"><HiOutlineTrash className="w-4 h-4" /></button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Subtotal</span>
                                <span className="font-medium">{formatCurrency(subtotal)}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-sm text-red-600">
                                    <span>Desconto</span>
                                    <span className="font-medium">- {formatCurrency(discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">IVA (16%)</span>
                                <span className="font-medium">{formatCurrency(totalTax)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-dark-700">
                                <span>Total</span>
                                <span className="text-primary-600">{formatCurrency(totalWithTax)}</span>
                            </div>
                            <Button variant="primary" size="lg" className="w-full" onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0}>Finalizar Venda (F4)</Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modals */}
            {lastSale && <ThermalReceiptPreview isOpen={thermalPreviewOpen} onClose={() => setThermalPreviewOpen(false)} sale={lastSale} />}

            <Modal isOpen={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} title="Finalizar Venda" size="md">
                <div className="space-y-6">
                    <div className="text-center py-6 bg-gray-50 dark:bg-dark-800 rounded-lg border-2 border-primary-100">
                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Total Final com IVA</p>
                        <p className="text-5xl font-black text-primary-600">{formatCurrency(totalWithTax)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Desconto (MT)" type="number" placeholder="0.00" value={globalDiscount} onChange={(e) => setGlobalDiscount(e.target.value)} />
                        <Input label="Valor Recebido (Opcional)" type="number" placeholder="0.00" value={customerMoney} onChange={(e) => setCustomerMoney(e.target.value)} className="text-lg font-bold" />
                    </div>
                    {customerMoney && parseFloat(customerMoney) >= totalWithTax && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 text-center">
                            <p className="text-xs text-green-700 font-bold uppercase mb-1">Troco a Devolver</p>
                            <p className="text-3xl font-black text-green-600">{formatCurrency(parseFloat(customerMoney) - totalWithTax)}</p>
                        </div>
                    )}
                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" fullWidth onClick={() => setIsCheckoutModalOpen(false)}>Cancelar</Button>
                        <Button fullWidth onClick={handleCheckout} isLoading={processingSale}>Confirmar Venda</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={clearCartModalOpen}
                onClose={() => setClearCartModalOpen(false)}
                onConfirm={() => { clearCart(); setClearCartModalOpen(false); }}
                title="Limpar Carrinho?"
                message="Tem certeza que deseja remover todos os itens do carrinho?"
                variant="warning"
            />
        </div>
    );
}

function BottleProductCard({ product, onAdd }: { product: any, onAdd: (p: any, mode: 'unit' | 'crate', ret: boolean) => void }) {
    const isOut = product.currentStock <= 0;
    const isLow = product.currentStock <= (product.minStock || 10);
    const hasCrate = product.packSize > 1;

    return (
        <div className={`flex flex-col rounded-lg border-2 transition-all hover:shadow-lg group overflow-hidden ${isOut
                ? 'opacity-75 grayscale border-gray-200 dark:border-dark-700'
                : 'border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800'
                }`}>
            <div className="p-3">
                <div className="w-full h-16 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center mb-2 flex-shrink-0">
                    <span className="text-2xl">{product.category === 'beverages' ? '🍺' : '🍾'}</span>
                </div>
                <p className="text-[10px] text-primary-600 dark:text-primary-400 font-mono mb-0.5 truncate">{product.code}</p>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{product.name}</h3>
                <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(product.price)}</span>
                    <Badge variant={isOut ? 'danger' : isLow ? 'warning' : 'success'} size="sm">{isOut ? 'OUT' : product.currentStock}</Badge>
                </div>
            </div>

            <div className="mt-auto grid grid-cols-1 gap-px bg-gray-200 dark:bg-dark-700 border-t border-gray-200 dark:border-dark-700">
                <button
                    onClick={() => onAdd(product, 'unit', false)}
                    disabled={isOut}
                    className="flex justify-center items-center py-2 bg-white dark:bg-dark-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase transition-colors disabled:cursor-not-allowed"
                >
                    + Unidade
                </button>
                
                {product.isReturnable && (
                    <button
                        onClick={() => onAdd(product, 'unit', true)}
                        disabled={isOut}
                        className="flex justify-center items-center py-2 bg-white dark:bg-dark-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 border-t border-gray-100 dark:border-dark-700 uppercase transition-colors disabled:cursor-not-allowed"
                    >
                        <HiOutlineRefresh className="w-3 h-3 mr-1" />
                        Com Devolução
                    </button>
                )}

                {hasCrate && (
                    <button
                        onClick={() => onAdd(product, 'crate', false)}
                        disabled={isOut}
                        className="flex justify-center items-center py-2 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 text-[10px] font-bold text-amber-600 dark:text-amber-400 border-t border-gray-100 dark:border-dark-700 uppercase transition-colors disabled:cursor-not-allowed"
                    >
                        + Caixa ({product.packSize})
                    </button>
                )}
            </div>
        </div>
    );
}
