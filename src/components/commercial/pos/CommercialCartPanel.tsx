import { useState } from 'react';
import { Card, Button, Input, Select } from '../../ui';
import {
    HiOutlineShoppingCart, HiOutlineTrash,
    HiOutlinePlus, HiOutlineMinus,
    HiOutlineScale, HiOutlineLockOpen, HiOutlineLockClosed, HiOutlineBanknotes,
    HiOutlinePause, HiOutlinePlay, HiOutlineTag, HiOutlineReceiptPercent
} from 'react-icons/hi2';
import { formatCurrency, cn } from '../../../utils/helpers';
import type { DiscountInfo } from './CommercialDiscountModal';
import type { Customer } from '../../../types';

export interface CartPanelProduct {
    id: string;
    code: string;
    name: string;
    price: number | string;
    currentStock: number;
    unit?: string;
}

export interface CartPanelItem {
    productId: string;
    product: CartPanelProduct;
    packSize: number;
    unitMode: 'box' | 'unit';
    quantity: number;
    unitPrice: number;
    discountPct: number;
    discount: DiscountInfo | null;
    total: number;
}

export type CartPanelCustomer = Customer;

export interface HeldSale {
    id: string;
    label: string;
    cart: CartPanelItem[];
    customerName: string;
    selectedCustomer: CartPanelCustomer | null;
    createdAt: Date;
    globalDiscount?: DiscountInfo | null;
}

interface CommercialCartPanelProps {
    cart: CartPanelItem[];
    setCart: (v: CartPanelItem[]) => void;
    updateQuantity: (id: string, q: number) => void;
    removeFromCart: (id: string) => void;
    cartTotal: number;
    cartSubtotal: number;
    cartTax: number;
    ivaRate: number;
    cartDiscount: number;
    selectedCustomer: CartPanelCustomer | null;
    setSelectedCustomer: (v: CartPanelCustomer | null) => void;
    customerName: string;
    setCustomerName: (v: string) => void;
    onCheckout: () => void;
    checkoutLoading?: boolean;
    customers: CartPanelCustomer[];
    cashDrawerOpen: boolean;
    handleToggleCashDrawer: () => void;
    cashDrawerBalance: number;
    handleScaleAction: () => void;
    heldSales: HeldSale[];
    onResumeSale: (sale: HeldSale) => void;
    onDeleteHeld: (id: string) => void;
    onCashMovement: (type: 'cash_in' | 'cash_out') => void;
    processingActions?: Record<string, boolean>;
    onOpenLineDiscount: (productId: string) => void;
    onOpenGlobalDiscount: () => void;
    globalDiscount?: DiscountInfo | null;
    crmDiscount: number;
}

export function CommercialCartPanel({
    cart, setCart,
    updateQuantity, removeFromCart,
    cartTotal, cartSubtotal, cartTax, ivaRate, cartDiscount,
    selectedCustomer, setSelectedCustomer,
    customerName, setCustomerName,
    onCheckout, checkoutLoading = false, customers,
    cashDrawerOpen, handleToggleCashDrawer, cashDrawerBalance, handleScaleAction,
    heldSales, onResumeSale, onDeleteHeld,
    onCashMovement,
    processingActions = {},
    onOpenLineDiscount, onOpenGlobalDiscount,
    globalDiscount, crmDiscount,
}: CommercialCartPanelProps) {

    const [showHeld, setShowHeld] = useState(false);



    return (
        <div className="flex flex-col h-full transition-all duration-500">
            <Card padding="none" className="flex flex-col flex-1 overflow-hidden border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl bg-white dark:bg-[#111214] rounded-2xl relative">
                {/* Header - Professional & Clean */}
                <div className="bg-white dark:bg-[#111214] px-4 py-4 text-slate-900 dark:text-white flex items-center justify-between flex-shrink-0 relative z-20 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-baseline gap-2">
                            <h3 className="font-bold text-sm uppercase tracking-wider">Carrinho de Venda</h3>
                            {cart.length > 0 && (
                                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={showHeld ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setShowHeld(v => !v)}
                            title="Vendas suspensas"
                            className="relative"
                        >
                            <HiOutlinePause className="w-3.5 h-3.5" />
                            {heldSales.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-black text-[9px] font-black rounded-full flex items-center justify-center shadow-lg">
                                    {heldSales.length}
                                </span>
                            )}
                        </Button>
                        {cart.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCart([])}
                                title="Limpar carrinho"
                                className="text-rose-500 hover:text-rose-600"
                            >
                                <HiOutlineTrash className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Held Sales Panel */}
                {showHeld && (
                    <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30 p-3 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Vendas Suspensas</p>
                        {heldSales.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-1">Nenhuma venda suspensa</p>
                        ) : (
                            <div className="space-y-1.5">
                                {heldSales.map(held => (
                                    <div key={held.id} className="flex items-center justify-between bg-white dark:bg-dark-800 rounded-lg px-2.5 py-1.5 border border-amber-100 dark:border-dark-700 gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-gray-800 dark:text-white truncate">{held.label}</p>
                                            <p className="text-[9px] text-gray-400">{held.cart.length} itens · {(held.createdAt instanceof Date ? held.createdAt : new Date(held.createdAt)).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                onClick={() => { onResumeSale(held); setShowHeld(false); }}
                                                variant="ghost"
                                                size="xs"
                                                className="h-7 w-7 p-0 bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border border-transparent dark:border-blue-500/30 rounded backdrop-blur-sm"
                                                title="Retomar"
                                            >
                                                <HiOutlinePlay className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                onClick={() => onDeleteHeld(held.id)}
                                                variant="ghost"
                                                size="xs"
                                                className="h-7 w-7 p-0 bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300 border border-transparent dark:border-red-500/30 rounded backdrop-blur-sm"
                                                title="Remover"
                                            >
                                                <HiOutlineTrash className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Customer & Promo - Re-styled for Dark */}
                <div className="flex-shrink-0 bg-slate-50/50 dark:bg-[#0a0b0d] border-b border-slate-200 dark:border-white/5 p-4 space-y-3 relative z-10">
                    <div className="grid grid-cols-1 gap-2">
                        <div className="flex flex-col gap-2">
                            <Select
                                value={selectedCustomer?.id || ''}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    const found = customers.find((c) => c.id === e.target.value);
                                    setSelectedCustomer(found || null);
                                }}
                                size="md"
                                className="w-full h-10 rounded-xl bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-900 dark:text-white font-semibold focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                                options={[
                                    { value: '', label: 'Selecionar Cliente' },
                                    ...customers.map((c) => ({ value: c.id, label: c.name }))
                                ]}
                            />
                            <Input
                                placeholder="Nome do cliente (opcional)..."
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                size="md"
                                className="w-full h-10 rounded-xl bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Cart items container - Fits at least 3 items before scroll */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-slate-50/30 dark:bg-[#0a0b0d] min-h-[280px]">
                    {cart.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center gap-4">
                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10 shadow-inner">
                                <HiOutlineShoppingCart className="w-12 h-12 text-slate-200 dark:text-white/10" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-black uppercase text-xs tracking-[0.2em] text-slate-300 dark:text-white/30 italic">Aguardando Produtos</p>
                                <p className="text-[10px] text-slate-200 dark:text-white/10 font-bold uppercase tracking-widest">Clique num produto para começar</p>
                            </div>
                        </div>
                    ) : (
                        cart.map((item) => {
                            const isProcessing = processingActions[item.productId];
                            return (
                                <div key={item.productId} className={cn(
                                    "group px-4 py-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all relative overflow-hidden shadow-sm",
                                    isProcessing && "opacity-60 pointer-events-none"
                                )}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-900 dark:text-white text-[11px] truncate uppercase tracking-wide mb-2">
                                                {item.product.name}
                                            </h4>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-black/20 px-2 py-1 rounded-lg border border-slate-200 dark:border-white/5 leading-none">
                                                    <Button variant="ghost" size="xs" onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="h-7 w-7 p-0 rounded-md">
                                                        <HiOutlineMinus className="w-2.5 h-2.5 text-slate-400 dark:text-white/20 hover:text-rose-500" />
                                                    </Button>
                                                    <span className="w-5 text-center font-bold text-slate-900 dark:text-white text-[11px]">{item.quantity}</span>
                                                    <Button variant="ghost" size="xs" onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="h-7 w-7 p-0 rounded-md">
                                                        <HiOutlinePlus className="w-2.5 h-2.5 text-slate-400 dark:text-white/20 hover:text-blue-500" />
                                                    </Button>
                                                </div>
                                                
                                                <Button
                                                    onClick={() => onOpenLineDiscount(item.productId)}
                                                    title={item.discount?.reason ? `Motivo: ${item.discount.reason}` : 'Aplicar desconto'}
                                                    variant="ghost"
                                                    size="xs"
                                                    className={cn(
                                                        "h-7 px-2 rounded-lg border text-[8px]",
                                                        item.discountPct > 0
                                                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                                                            : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/20 border-transparent hover:text-rose-500 hover:border-rose-500/20'
                                                    )}
                                                >
                                                    <HiOutlineTag className="w-2.5 h-2.5" />
                                                    {item.discountPct > 0 ? `${Number(item.discountPct).toFixed(item.discountPct % 1 ? 1 : 0)}% DESC.` : 'DESC.'}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <p className="font-bold text-blue-400 text-sm tracking-tight">
                                                {formatCurrency(item.total)}
                                            </p>
                                            <Button variant="ghost" size="xs" onClick={() => removeFromCart(item.productId)} className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-slate-300 dark:text-white/10 hover:text-rose-500">
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Hardware bar */}
                <div className="px-3 py-1 bg-gray-50/5 dark:bg-dark-900/5 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="xs" onClick={handleScaleAction} className="h-7 w-7 p-0 bg-white dark:bg-dark-800 text-gray-400 rounded hover:text-blue-500 border border-gray-100 dark:border-dark-700 shadow-sm">
                            <HiOutlineScale className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="xs" onClick={handleToggleCashDrawer} className={cn('h-7 w-7 p-0 rounded border shadow-sm', cashDrawerOpen ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-dark-800 text-gray-400 border-gray-100 dark:border-dark-700')}>
                            {cashDrawerOpen ? <HiOutlineLockOpen className="w-3 h-3" /> : <HiOutlineLockClosed className="w-3 h-3" />}
                        </Button>
                    </div>
                    <div className="flex bg-green-500/5 dark:bg-emerald-500/15 border border-green-500/10 dark:border-emerald-500/30 rounded overflow-hidden shadow-sm backdrop-blur-sm">
                        <div className="px-1.5 py-0.5 text-green-600 dark:text-emerald-300 text-[8px] font-black uppercase flex items-center gap-1">
                            <HiOutlineBanknotes className="w-2.5 h-2.5" />
                            {formatCurrency(cashDrawerBalance)}
                        </div>
                        <div className="flex border-l border-green-500/10 dark:border-emerald-500/30">
                            <Button variant="ghost" size="xs" onClick={() => onCashMovement('cash_in')} className="h-7 w-7 p-0 hover:bg-green-500/10 text-green-600">
                                <HiOutlinePlus className="w-2.5 h-2.5" />
                            </Button>
                            <Button variant="ghost" size="xs" onClick={() => onCashMovement('cash_out')} className="h-7 w-7 p-0 hover:bg-orange-500/10 text-orange-600">
                                <HiOutlineMinus className="w-2.5 h-2.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Footer totals - Compact & Clean */}
                <div className="flex-shrink-0 bg-white dark:bg-[#111214] px-5 py-4 border-t border-slate-200 dark:border-white/5 shadow-sm relative z-20">
                    {cart.length > 0 && (
                        <Button
                            variant={globalDiscount ? 'danger' : 'ghost'}
                            size="sm"
                            onClick={onOpenGlobalDiscount}
                            className="w-full justify-between"
                            title={globalDiscount?.reason ? `${globalDiscount.reason} · ${globalDiscount.appliedBy}` : 'Aplicar desconto global'}
                        >
                            <span className="flex items-center gap-2">
                                <HiOutlineReceiptPercent className="w-4 h-4" />
                                {globalDiscount
                                    ? `Desc. global: ${globalDiscount.kind === 'percent' ? `${globalDiscount.value}%` : formatCurrency(globalDiscount.value)}`
                                    : 'Aplicar Desconto Global'}
                            </span>
                            {globalDiscount && (
                                <span className="text-[9px] font-bold opacity-80 truncate max-w-[160px]">
                                    {globalDiscount.reason}
                                </span>
                            )}
                        </Button>
                    )}

                    <div className="flex justify-between items-center mb-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner">
                        <div className="space-y-2">
                            <div className="flex justify-between gap-6 text-[10px] text-slate-400 dark:text-white/30 uppercase font-bold tracking-wider leading-none">
                                <span>Subtotal</span>
                                <span className="text-slate-900 dark:text-white">{formatCurrency(cartSubtotal)}</span>
                            </div>
                            {cartDiscount > 0 && (
                                <div className="flex justify-between gap-6 text-[10px] text-rose-600 dark:text-rose-500 uppercase font-bold tracking-wider leading-none">
                                    <span>{crmDiscount > 0 ? 'Descontos (linha+global+CRM)' : 'Descontos'}</span>
                                    <span>-{formatCurrency(cartDiscount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between gap-6 text-[10px] text-slate-400 dark:text-white/30 uppercase font-bold tracking-wider leading-none">
                                <span>IVA ({ivaRate}%)</span>
                                <span className="text-slate-900 dark:text-white">{formatCurrency(cartTax)}</span>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">TOTAL</span>
                            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                {formatCurrency(cartTotal)}
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="primary"
                        isLoading={checkoutLoading}
                        size="lg"
                        className="w-full"
                        onClick={onCheckout}
                        disabled={cart.length === 0}
                    >
                        {cart.length === 0 ? 'LISTA VAZIA' : 'PAGAR AGORA · F4'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
