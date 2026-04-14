import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { formatCurrency } from '../../utils/helpers';
import { 
    HiOutlineXMark, 
    HiOutlineBriefcase, 
    HiOutlineMapPin, 
    HiOutlinePhone, 
    HiOutlineEnvelope,
    HiOutlineStar,
    HiOutlineCurrencyDollar,
    HiOutlineShoppingCart,
    HiOutlineClock,
    HiOutlineArrowTrendingUp,
    HiOutlineExclamationCircle,
    HiOutlineReceiptPercent
} from 'react-icons/hi2';
import type { Customer } from '../../types';
import { useSales } from '../../hooks/useSales';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Customer360ModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
}

export function Customer360Modal({ isOpen, onClose, customer }: Customer360ModalProps) {
    // Carrega o histórico dinamicamente se o modal abrir e houver cliente
    const { sales, isLoading } = useSales({ 
        customerId: customer?.id,
        limit: 5 // Last 5 sales for quick view
    });

    if (!customer) return null;

    const isRisky = customer.currentBalance > 50000; // Mock: se o saldo devido > 50.000 MT, consideramos risco de dívida
    const isVIP = customer.totalPurchases > 100000;

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                {/* Backdrop com glassmorphism */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 backdrop-blur-none"
                    enterTo="opacity-100 backdrop-blur-md"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 backdrop-blur-md"
                    leaveTo="opacity-0 backdrop-blur-none"
                >
                    <div className="fixed inset-0 bg-slate-900/60 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
                            {/* Slide-over panel */}
                            <Transition.Child
                                as={Fragment}
                                enter="transform transition ease-in-out duration-500 sm:duration-700"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-500 sm:duration-700"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                                    <div className="flex h-full flex-col bg-white dark:bg-dark-900 shadow-2xl">
                                        
                                        {/* Header do Perfil (Hero) */}
                                        <div className="relative px-6 py-10 bg-gradient-to-br from-primary-900 to-primary-700 overflow-hidden">
                                            {/* Decorative Background */}
                                            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
                                            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 rounded-full bg-primary-400/20 blur-2xl pointer-events-none"></div>
                                            
                                            <div className="absolute top-4 right-4">
                                                <button
                                                    type="button"
                                                    className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition-all outline-none"
                                                    onClick={onClose}
                                                >
                                                    <span className="sr-only">Fechar painel</span>
                                                    <HiOutlineXMark className="h-6 w-6" aria-hidden="true" />
                                                </button>
                                            </div>

                                            <div className="relative flex items-center gap-6 mt-4">
                                                <div className="flex-shrink-0 w-24 h-24 rounded-3xl bg-white/20 border border-white/30 backdrop-blur-xl flex items-center justify-center shadow-2xl">
                                                    <span className="text-4xl font-black text-white capitalize shadow-sm">
                                                        {customer.name.charAt(0)}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <h2 className="text-3xl font-black text-white leading-tight mb-1">
                                                        {customer.name}
                                                    </h2>
                                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/20">
                                                            <HiOutlineBriefcase className="w-3.5 h-3.5" />
                                                            {customer.type === 'company' ? 'Empresa B2B' : 'Particular B2C'}
                                                        </span>
                                                        
                                                        {isVIP && (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg shadow-amber-500/30">
                                                                <HiOutlineStar className="w-3.5 h-3.5" />
                                                                Conta VIP
                                                            </span>
                                                        )}

                                                        {isRisky && (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg shadow-red-500/30">
                                                                <HiOutlineExclamationCircle className="w-3.5 h-3.5" />
                                                                Dívida Alta
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content Scrollable */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                                            
                                            {/* Top KPIs */}
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {/* LTV */}
                                                <div className="bg-slate-50 dark:bg-dark-800 rounded-3xl p-5 border border-slate-100 dark:border-dark-700">
                                                    <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                                                        <HiOutlineCurrencyDollar className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Vendas Totais</p>
                                                    <p className="text-xl font-black text-slate-900 dark:text-white truncate">
                                                        {formatCurrency(customer.totalPurchases)}
                                                    </p>
                                                </div>
                                                {/* Dívida */}
                                                <div className="bg-slate-50 dark:bg-dark-800 rounded-3xl p-5 border border-slate-100 dark:border-dark-700">
                                                    <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                                                        <HiOutlineArrowTrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Dívida Atual</p>
                                                    <p className={`text-xl font-black truncate ${customer.currentBalance > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                                        {formatCurrency(customer.currentBalance)}
                                                    </p>
                                                </div>
                                                {/* Pontos Fidelidade */}
                                                <div className="bg-slate-50 dark:bg-dark-800 rounded-3xl p-5 border border-slate-100 dark:border-dark-700 col-span-2 md:col-span-1">
                                                    <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
                                                        <HiOutlineStar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Fidelização</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <p className="text-xl font-black text-slate-900 dark:text-white truncate">
                                                            {customer.loyaltyPoints || 0}
                                                        </p>
                                                        <span className="text-[10px] font-bold text-amber-500">PONTOS</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detalhes de Contacto */}
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <HiOutlineMapPin className="w-5 h-5 text-primary-500" />
                                                    Detalhes de Acesso
                                                </h3>
                                                <div className="bg-slate-50 dark:bg-dark-800 rounded-3xl border border-slate-100 dark:border-dark-700 divide-y divide-slate-100 dark:divide-dark-700 overflow-hidden">
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4">
                                                        <div className="w-32 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                                                            <HiOutlinePhone className="w-4 h-4" /> Telefone
                                                        </div>
                                                        <div className="flex-1 text-sm font-bold text-slate-900 dark:text-white">
                                                            {customer.phone || '—'}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4">
                                                        <div className="w-32 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                                                            <HiOutlineEnvelope className="w-4 h-4" /> Email
                                                        </div>
                                                        <div className="flex-1 text-sm font-bold text-slate-900 dark:text-white">
                                                            {customer.email || '—'}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4">
                                                        <div className="w-32 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                                                            <HiOutlineMapPin className="w-4 h-4" /> Endereço
                                                        </div>
                                                        <div className="flex-1 text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                                                            {customer.address ? `${customer.address}, ${customer.city || ''} ${customer.province || ''}` : '—'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Histórico Recente */}
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <HiOutlineShoppingCart className="w-5 h-5 text-primary-500" />
                                                    Últimas Interações
                                                </h3>
                                                
                                                {isLoading ? (
                                                    <div className="p-8 text-center bg-slate-50 dark:bg-dark-800 rounded-3xl border border-slate-100 dark:border-dark-700">
                                                        <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mx-auto mb-3"></div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Carregando Histórico...</p>
                                                    </div>
                                                ) : sales && sales.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {sales.map((sale) => (
                                                            <div key={sale.id} className="group relative bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-2xl p-4 hover:border-primary-500 dark:hover:border-primary-500 transition-all flex items-center gap-4 shadow-sm hover:shadow-lg hover:shadow-primary-500/10 cursor-pointer">
                                                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-dark-900 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                                                                    <HiOutlineReceiptPercent className="w-5 h-5 text-slate-400 group-hover:text-primary-500" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                                        {sale.receiptNumber || `SALE-${sale.id.slice(-6)}`}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <HiOutlineClock className="w-3.5 h-3.5 text-slate-400" />
                                                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                                            {format(parseISO(sale.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right flex-shrink-0">
                                                                    <span className="block text-sm font-black text-primary-600 dark:text-primary-400">
                                                                        {formatCurrency(sale.total)}
                                                                    </span>
                                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                                        sale.status === 'voided' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                                                    }`}>
                                                                        {sale.status === 'voided' ? 'Anulado' : sale.paymentMethod}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center bg-slate-50 dark:bg-dark-800 rounded-3xl border border-slate-100 dark:border-dark-700">
                                                        <HiOutlineShoppingCart className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Nenhum histórico comercial.</p>
                                                        <p className="text-xs text-slate-500 mt-1">Este cliente ainda não efetuou compras no sistema.</p>
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                        
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
