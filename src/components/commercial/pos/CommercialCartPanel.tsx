import React, { useState } from 'react';
import { Card, Button, Input } from '../../ui';
import {
    HiOutlineShoppingCart, HiOutlineTrash, HiOutlineCheck,
    HiOutlineTag, HiOutlinePlus, HiOutlineMinus,
    HiOutlineScale, HiOutlineLockOpen, HiOutlineLockClosed, HiOutlineCash,
    HiOutlinePause, HiOutlinePlay, HiOutlineDotsHorizontal
} from 'react-icons/hi';
import { formatCurrency, cn } from '../../../utils/helpers';

export interface HeldSale {
    id: string;
    label: string;
    cart: any[];
    customerName: string;
    selectedCustomer: any;
    createdAt: Date;
}

interface CommercialCartPanelProps {
    cart: any[];
    setCart: (v: any[]) => void;
    updateQuantity: (id: string, q: number) => void;
    updateItemDiscount: (id: string, discount: number) => void;
    removeFromCart: (id: string) => void;
    cartTotal: number;
    cartSubtotal: number;
    cartTax: number;
    cartDiscount: number;
    selectedCustomer: any;
    setSelectedCustomer: (v: any) => void;
    customerName: string;
    setCustomerName: (v: string) => void;
    promoCode: string;
    setPromoCode: (v: string) => void;
    promoCodeApplied: boolean;
    handleApplyPromoCode: () => void;
    onCheckout: () => void;
    checkoutLoading?: boolean;
    customers: any[];
    cashDrawerOpen: boolean;
    handleToggleCashDrawer: () => void;
    cashDrawerBalance: number;
    handleScaleAction: () => void;
    // Global discount (desconto global sobre o total da venda)
    globalDiscountPct: number;
    onGlobalDiscountChange: (pct: number) => void;
    // Held sales (parking)
    heldSales: HeldSale[];
    onHoldSale: () => void;
    onResumeSale: (sale: HeldSale) => void;
    onDeleteHeld: (id: string) => void;
    onCashMovement: (type: 'cash_in' | 'cash_out') => void;
}

export function CommercialCartPanel({
    cart, setCart,
    updateQuantity, updateItemDiscount, removeFromCart,
    cartTotal, cartSubtotal, cartTax, cartDiscount,
    selectedCustomer, setSelectedCustomer,
    customerName, setCustomerName,
    promoCode, setPromoCode, promoCodeApplied, handleApplyPromoCode,
    globalDiscountPct, onGlobalDiscountChange,
    onCheckout, checkoutLoading = false, customers,
    cashDrawerOpen, handleToggleCashDrawer, cashDrawerBalance, handleScaleAction,
    heldSales, onHoldSale, onResumeSale, onDeleteHeld,
    onCashMovement
}: CommercialCartPanelProps) {

    const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
    const [showHeld, setShowHeld] = useState(false);
    const [editingGlobalDiscount, setEditingGlobalDiscount] = useState(false);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] sticky top-4 mb-6 transition-all duration-300">
            <Card className="flex flex-col flex-1 overflow-hidden p-0 border-none shadow-2xl shadow-blue-500/10 bg-white dark:bg-dark-900 rounded-3xl relative">
                {/* Header */}
                <div className="bg-slate-900 dark:bg-black px-3 py-2 text-white flex items-center justify-between flex-shrink-0 shadow-sm relative z-20 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <HiOutlineShoppingCart className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <h3 className="font-black text-[10px] uppercase tracking-widest leading-none">Voucher</h3>
                            {cart.length > 0 && (
                                <span className="text-[10px] font-black text-blue-400 leading-none">
                                    #{cart.length}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Held sales button */}
                        <button
                            onClick={() => setShowHeld(v => !v)}
                            className={cn(
                                'relative p-1.5 rounded-lg transition-all active:scale-95 border border-white/5',
                                showHeld ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 hover:bg-white/10 text-gray-400'
                            )}
                            title="Vendas suspensas"
                        >
                            <HiOutlinePause className="w-3 h-3" />
                            {heldSales.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 text-black text-[8px] font-black rounded-full flex items-center justify-center shadow-md">
                                    {heldSales.length}
                                </span>
                            )}
                        </button>
                        {cart.length > 0 && (
                            <>
                                <button
                                    onClick={onHoldSale}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-all border border-white/5"
                                    title="Suspender venda"
                                >
                                    <HiOutlineDotsHorizontal className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => setCart([])}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20"
                                    title="Limpar carrinho"
                                >
                                    <HiOutlineTrash className="w-3 h-3" />
                                </button>
                            </>
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
                                            <p className="text-[9px] text-gray-400">{held.cart.length} itens · {held.createdAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => { onResumeSale(held); setShowHeld(false); }}
                                                className="p-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 transition-colors"
                                                title="Retomar"
                                            >
                                                <HiOutlinePlay className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteHeld(held.id)}
                                                className="p-1 bg-red-50 dark:bg-red-900/20 text-red-400 rounded hover:bg-red-100 transition-colors"
                                                title="Remover"
                                            >
                                                <HiOutlineTrash className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Customer & Promo */}
                <div className="flex-shrink-0 bg-white dark:bg-dark-900 border-b border-gray-100 dark:border-dark-800 p-2 space-y-2 relative z-10">
                    <div className="grid grid-cols-1 gap-2">
                        <div className="flex gap-1.5 items-center">
                            <select
                                value={selectedCustomer?.id || ''}
                                onChange={(e: any) => {
                                    const found = customers.find((c: any) => c.id === e.target.value);
                                    setSelectedCustomer(found || null);
                                }}
                                className="w-1/2 rounded-lg bg-gray-50 dark:bg-dark-800 border-gray-200 dark:border-dark-700 h-7 text-[10px] font-bold shadow-sm text-gray-900 dark:text-gray-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/50 px-2"
                            >
                                <option value="">Consumidor Geral</option>
                                {customers.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <Input
                                placeholder="Nome avulso..."
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-1/2 rounded-lg bg-gray-50 dark:bg-dark-800 border-gray-200 dark:border-dark-700 h-7 text-[10px] font-medium"
                            />
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <div className="relative flex-1">
                                <HiOutlineTag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                <Input
                                    placeholder="PROMO"
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value)}
                                    className="rounded-lg bg-gray-50 dark:bg-dark-800 border-gray-200 dark:border-dark-700 h-7 text-[10px] pl-7 shadow-sm font-black tracking-widest uppercase"
                                    disabled={promoCodeApplied}
                                />
                            </div>
                            <Button
                                variant={promoCodeApplied ? 'success' : 'primary'}
                                onClick={handleApplyPromoCode}
                                disabled={!promoCode.trim()}
                                className="rounded-lg px-3 h-7 text-[9px] font-black uppercase tracking-widest"
                            >
                                {promoCodeApplied ? <HiOutlineCheck className="w-3 h-3" /> : 'OK'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2 scrollbar-thin bg-gray-100/50 dark:bg-dark-950/20">
                    {cart.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center opacity-10">
                            <HiOutlineShoppingCart className="w-16 h-16 mb-2" />
                            <p className="font-black uppercase text-[10px] tracking-widest">Aguardando Produtos</p>
                        </div>
                    ) : (
                        cart.map((item: any) => (
                            <div key={item.productId} className="group px-3 py-2 bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700/50 hover:border-blue-500/50 hover:shadow-xl hover:shadow-black/5 transition-all">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-gray-900 dark:text-white text-xs truncate leading-none mb-2">
                                            {item.product.name}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-dark-900 p-1 rounded-xl border border-gray-100 dark:border-dark-700 leading-none">
                                                <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-dark-800 rounded-lg font-bold transition-all active:scale-95 shadow-sm">
                                                    <HiOutlineMinus className="w-3 h-3 text-gray-400 hover:text-red-500" />
                                                </button>
                                                <span className="w-6 text-center font-black text-gray-900 dark:text-white text-xs">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-dark-800 rounded-lg font-bold transition-all active:scale-95 shadow-sm">
                                                    <HiOutlinePlus className="w-3 h-3 text-gray-400 hover:text-blue-500" />
                                                </button>
                                            </div>
                                            {/* Item discount */}
                                            {editingDiscountId === item.productId ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        autoFocus
                                                        value={item.discountPct || 0}
                                                        onChange={e => updateItemDiscount(item.productId, Math.min(100, Math.max(0, Number(e.target.value))))}
                                                        onBlur={() => setEditingDiscountId(null)}
                                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingDiscountId(null); }}
                                                        className="w-12 text-center text-xs font-black border border-blue-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-dark-800"
                                                    />
                                                    <span className="text-[10px] text-gray-400 font-black">%</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setEditingDiscountId(item.productId)}
                                                    className={cn(
                                                        "flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg transition-all border",
                                                        item.discountPct > 0
                                                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                                            : 'bg-gray-50 dark:bg-dark-900 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 border-transparent'
                                                    )}
                                                    title="Desconto por item"
                                                >
                                                    <HiOutlineTag className="w-3 h-3" />
                                                    {item.discountPct > 0 ? `${item.discountPct}%` : 'DESC.'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <p className="font-black text-blue-600 dark:text-blue-400 text-sm leading-none mb-1.5 tracking-tight">
                                            {formatCurrency(item.total)}
                                        </p>
                                        {item.discountPct > 0 && (
                                            <p className="text-[9px] text-gray-400 line-through leading-none mb-1 opacity-50 font-bold">
                                                {formatCurrency(item.quantity * item.unitPrice)}
                                            </p>
                                        )}
                                        <button onClick={() => removeFromCart(item.productId)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all active:scale-90">
                                            <HiOutlineTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Hardware bar */}
                <div className="px-3 py-1 bg-gray-50/5 dark:bg-dark-900/5 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                        <button onClick={handleScaleAction} className="p-1 bg-white dark:bg-dark-800 text-gray-400 rounded hover:text-blue-500 border border-gray-100 dark:border-dark-700 shadow-sm transition-colors" title="Balança">
                            <HiOutlineScale className="w-3 h-3" />
                        </button>
                        <button onClick={handleToggleCashDrawer} className={`p-1 rounded border shadow-sm transition-all ${cashDrawerOpen ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-dark-800 text-gray-400 border-gray-100 dark:border-dark-700'}`} title="Gaveta">
                            {cashDrawerOpen ? <HiOutlineLockOpen className="w-3 h-3" /> : <HiOutlineLockClosed className="w-3 h-3" />}
                        </button>
                    </div>
                    <div className="flex bg-green-500/5 dark:bg-green-500/10 border border-green-500/10 rounded overflow-hidden shadow-sm">
                        <div className="px-1.5 py-0.5 text-green-600 dark:text-green-400 text-[8px] font-black uppercase flex items-center gap-1">
                            <HiOutlineCash className="w-2.5 h-2.5" />
                            {formatCurrency(cashDrawerBalance)}
                        </div>
                        <div className="flex border-l border-green-500/10">
                            <button
                                onClick={() => onCashMovement('cash_in')}
                                className="p-1 hover:bg-green-500/10 text-green-600 dark:text-green-400 transition-colors"
                                title="Suprimento (Entrada)"
                            >
                                <HiOutlinePlus className="w-2.5 h-2.5" />
                            </button>
                            <button
                                onClick={() => onCashMovement('cash_out')}
                                className="p-1 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 transition-colors"
                                title="Sangria (Saída)"
                            >
                                <HiOutlineMinus className="w-2.5 h-2.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer totals */}
                <div className="flex-shrink-0 bg-white dark:bg-dark-900 p-3 pt-2 pb-3 border-t dark:border-dark-800 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] relative z-20">

                    {/* Global discount row */}
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-1.5 opacity-60">
                            <HiOutlineTag className="w-3 h-3 text-red-500" />
                            <span className="text-[9px] font-black uppercase tracking-tighter text-gray-400">DESC. GLOBAL</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {editingGlobalDiscount ? (
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    autoFocus
                                    value={globalDiscountPct || ''}
                                    onChange={e => onGlobalDiscountChange(Math.min(100, Math.max(0, Number(e.target.value))))}
                                    onBlur={() => setEditingGlobalDiscount(false)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingGlobalDiscount(false); }}
                                    className="w-10 text-center text-[9px] font-black border border-primary-500/50 rounded bg-white dark:bg-dark-800 h-6"
                                />
                            ) : (
                                <button
                                    onClick={() => setEditingGlobalDiscount(true)}
                                    className={cn(
                                        "text-[9px] font-black px-2 py-0.5 rounded transition-all border",
                                        globalDiscountPct > 0 ? 'bg-red-500 text-white' : 'text-gray-400 border-gray-100 hover:border-gray-300'
                                    )}
                                >
                                    {globalDiscountPct > 0 ? `-${globalDiscountPct}%` : '+ ADD'}
                                </button>
                            )}
                            {globalDiscountPct > 0 && !editingGlobalDiscount && (
                                <button onClick={() => onGlobalDiscountChange(0)} className="text-gray-300 hover:text-red-500"><HiOutlineTrash className="w-3 h-3" /></button>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-end mb-3 bg-gray-50/50 dark:bg-dark-800/20 p-2 rounded-xl border border-gray-100 dark:border-dark-700/50">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between gap-4 text-[9px] text-gray-400 uppercase font-black whitespace-nowrap leading-none">
                                <span>Sub</span>
                                <span className="text-gray-900 dark:text-gray-300">{formatCurrency(cartSubtotal)}</span>
                            </div>
                            {cartDiscount > 0 && (
                                <div className="flex justify-between gap-4 text-[9px] text-red-500 uppercase font-black whitespace-nowrap leading-none">
                                    <span>Poupas</span>
                                    <span>-{formatCurrency(cartDiscount)}</span>
                                </div>
                            )}
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="text-[9px] font-black text-primary-500 uppercase tracking-tighter leading-none mb-1">TOTAL</span>
                            <span className="text-xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">
                                {formatCurrency(cartTotal)}
                            </span>
                        </div>
                    </div>

                    <Button
                        className={cn(
                            "w-full py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl",
                            cart.length === 0 || checkoutLoading 
                                ? 'bg-gray-100 text-gray-400' 
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                        )}
                        onClick={onCheckout}
                        disabled={cart.length === 0 || checkoutLoading}
                    >
                        {checkoutLoading ? '...' : cart.length === 0 ? 'LISTA VAZIA' : 'PAGAR AGORA (F4)'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
