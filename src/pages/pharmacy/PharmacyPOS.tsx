import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, LoadingSpinner, Input, Skeleton, Card } from '../../components/ui';
import { usePharmacyPartners } from '../../hooks/usePharmacyPartners';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playScanSound } from '../../utils/audio';
import { shiftAPI, pharmacyAPI } from '../../services/api';
import type { ShiftData } from '../../components/pharmacy/pos/PharmacyShiftModal';
import { useCustomers } from '../../hooks/useData';
import toast from 'react-hot-toast';
import {
    HiOutlineArrowPath as HiOutlineRefresh,
    HiOutlineExclamationCircle,
    HiOutlineShieldExclamation,
} from 'react-icons/hi2';
import { usePagination } from '../../components/ui/Pagination';
import { useStore } from '../../stores/useStore';
import { generatePOSReceipt } from '../../utils/documentGenerator';
import { 
    useMedications, 
    useCreatePharmacySale,
    usePatientProfile,
    usePatientControlledHistory,
    usePharmacyDashboard
} from '../../hooks/usePharmacy';

// Atomic Components
import { POSProductGrid } from '../../components/pharmacy/pos/POSProductGrid';
import { POSCartPanel } from '../../components/pharmacy/pos/POSCartPanel';
import { POSPatientHistoryModal } from '../../components/pharmacy/pos/POSPatientHistoryModal';
import { PharmacyShiftModal } from '../../components/pharmacy/pos/PharmacyShiftModal';
import type { Medication } from '../../types/pharmacy';

interface CartItem {
    batchId: string;
    medicationId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    maxQuantity: number;
    posologyLabel?: string;
    expiryDate?: string;
    requiresPrescription?: boolean;
    isControlled?: boolean;
}

export default function PharmacyPOS() {
    const queryClient = useQueryClient();
    const { companySettings } = useStore();
    const { partners } = usePharmacyPartners();
    const { customers } = useCustomers();

    // Replaced manual useQuery with revamped hook
    const { data: medsResponse, isLoading, refetch: fetchMedications } = useMedications();
    const medications = medsResponse?.data || [];

    // Shift State
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');

    // Fetch active shift & summary
    const activeShift = queryClient.getQueryData<any>(['pharmacy', 'shift']);
    const shiftSummary = queryClient.getQueryData<any>(['pharmacy', 'shift', 'summary']);
    
    const shift = useMemo(() => {
        if (!activeShift) return null;
        return {
            ...activeShift,
            totalSales: shiftSummary?.totalSales || 0,
            saleCount: shiftSummary?.saleCount || 0,
            openedAt: new Date(activeShift.openedAt)
        } as ShiftData;
    }, [activeShift, shiftSummary]);

    // Mutations
    const createSaleMutation = useCreatePharmacySale();
    const { refetch: refetchDashboard } = usePharmacyDashboard();

    // State
    const [posSearch, setPosSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
    const [manualCustomerName, setManualCustomerName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [lastSale, setLastSale] = useState<any>(null);
    const [discount, setDiscount] = useState(0);
    const [insuranceEntity, setInsuranceEntity] = useState<string | null>(null);
    const [insuranceCoverage, setInsuranceCoverage] = useState(0);
    const [prescriptionNumber, setPrescriptionNumber] = useState('');
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const [_validatedRx, setValidatedRx] = useState<any>(null);

    // Drug interaction warning
    const [interactionWarnings, setInteractionWarnings] = useState<any[]>([]);
    const [showInteractionWarning, setShowInteractionWarning] = useState(false);
    const [pendingCheckoutCart, setPendingCheckoutCart] = useState<CartItem[] | null>(null);

    // Allergy warning
    const [allergyWarnings, setAllergyWarnings] = useState<string[]>([]);
    
    // Refund state
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundSaleNumber, setRefundSaleNumber] = useState('');
    const [refundReason, setRefundReason] = useState('');
    const [refundSaleId, setRefundSaleId] = useState('');
    const [isRefunding, setIsRefunding] = useState(false);

    // Revamped hooks for patient profile and history
    const { data: patientProfile } = usePatientProfile(selectedCustomer);
    const { data: patientHistory = [] } = usePatientControlledHistory(selectedCustomer);

    // Check allergies whenever cart changes and customer is selected
    useEffect(() => {
        if (!patientProfile?.allergies?.length || !cart.length) {
            setAllergyWarnings([]);
            return;
        }
        const allAllergies: string[] = patientProfile.allergies.map((a: string) => a.toLowerCase());
        const warnings: string[] = [];
        cart.forEach(item => {
            const medData = medications.find((m: any) => m.id === item.medicationId);
            if (medData) {
                const contraindications = (medData.description || '').toLowerCase(); 
                const activeIngredient = (medData.activeIngredients?.join(' ') || '').toLowerCase();
                allAllergies.forEach(allergy => {
                    if (contraindications.includes(allergy) || activeIngredient.includes(allergy)) {
                        warnings.push(`⚠️ ALERGIA: "${item.productName}" - paciente tem alergia a "${allergy.toUpperCase()}"`);
                    }
                });
            }
        });
        setAllergyWarnings([...new Set(warnings)]);
    }, [cart, patientProfile, medications]);

    const filteredMedications = useMemo(() => {
        if (!posSearch) return medications.filter((m: any) => m.stock > 0);
        return medications.filter((m: any) =>
            m.stock > 0 &&
            (m.name.toLowerCase().includes(posSearch.toLowerCase()) ||
                m.code.toLowerCase().includes(posSearch.toLowerCase()) ||
                (m.activeIngredient && m.activeIngredient.toLowerCase().includes(posSearch.toLowerCase())))
        );
    }, [medications, posSearch]);

    const posPagination = usePagination(filteredMedications, 12);

    useBarcodeScanner({
        onScan: (barcode) => {
            const found = medications.find((m: any) => m.code === barcode || (m as any).barcode === barcode);
            if (found) {
                addToCart(found);
                playScanSound();
                toast.success(`Adicionado: ${found.name}`);
            } else {
                toast.error('Produto não encontrado');
            }
        },
        enabled: !isLoading
    });

    const handleViewPatientHistory = () => {
        if (!selectedCustomer) return;
        setIsHistoryModalOpen(true);
    };

    const addToCart = (medication: Medication) => {
        const batch = (medication as any).batches?.[0]; 
        if (!batch) {
            toast.error('Sem stock disponível');
            return;
        }
        
        const existing = cart.find(item => item.batchId === batch.id);

        if (existing) {
            if (existing.quantity >= batch.currentStock) {
                toast.error('Stock máximo atingido');
                return;
            }
            setCart(cart.map(item =>
                item.batchId === batch.id
                    ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice - item.discount }
                    : item
            ));
        } else {
            setCart([...cart, {
                batchId: batch.id,
                medicationId: medication.id,
                productName: (medication as any).name || 'Produto',
                quantity: 1,
                unitPrice: Number(batch.sellingPrice),
                discount: 0,
                total: Number(batch.sellingPrice),
                maxQuantity: batch.currentStock,
                expiryDate: batch.expiryDate,
                requiresPrescription: medication.requiresPrescription,
                isControlled: (medication as any).isControlled
            }]);
        }
    };

    const updateCartItem = (batchId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(cart.filter(item => item.batchId !== batchId));
        } else {
            setCart(cart.map(item =>
                item.batchId === batchId
                    ? { ...item, quantity, total: quantity * item.unitPrice - item.discount }
                    : item
            ));
        }
    };

    const removeFromCart = (batchId: string) => setCart(cart.filter(item => item.batchId !== batchId));

    const cartTotal = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
        return subtotal - discount - (subtotal * (insuranceCoverage / 100));
    }, [cart, discount, insuranceCoverage]);

    const insuranceAmount = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
        return subtotal * (insuranceCoverage / 100);
    }, [cart, insuranceCoverage]);

    const cartHasControlledItems = useMemo(() => cart.some(item => item.requiresPrescription || item.isControlled), [cart]);

    const handleCheckout = async () => {
        if (!shift) { toast.error('Turno de caixa encerrado.'); return; }
        if (cart.length === 0) { toast.error('Carrinho vazio'); return; }
        
        if (cartHasControlledItems && !prescriptionNumber.trim()) {
            toast.error('Obrigatório Nº de Receita para medicamentos controlados.');
            return;
        }

        if (cart.length >= 2) {
             try {
                const medIds = cart.map(i => i.medicationId);
                const interactions = await pharmacyAPI.checkCartInteractions(medIds);
                if (interactions?.length > 0) {
                    setInteractionWarnings(interactions);
                    setShowInteractionWarning(true);
                    setPendingCheckoutCart(cart);
                    return;
                }
             } catch { /* Silent */ }
        }

        await doCheckout(cart);
    };

    const doCheckout = async (cartItems: CartItem[]) => {
        try {
            const customer = customers.find(c => c.id === selectedCustomer);
            const sale = await createSaleMutation.mutateAsync({
                customerId: selectedCustomer,
                customerName: selectedCustomer ? (customer?.name || 'Cliente Balcão') : (manualCustomerName || 'Cliente Balcão'),
                items: cartItems.map(item => ({
                    batchId: item.batchId,
                    quantity: item.quantity,
                    discount: item.discount,
                    posologyLabel: item.posologyLabel
                })),
                discount,
                partnerId: insuranceEntity,
                insuranceAmount,
                prescriptionNumber,
                paymentMethod
            });

            setLastSale(sale);
            toast.success('Venda concluída com sucesso!');
            refetchDashboard();
            
            // Reset state
            setCart([]);
            setDiscount(0);
            setInsuranceEntity(null);
            setInsuranceCoverage(0);
            setPrescriptionNumber('');
            setSelectedCustomer(null);
            setManualCustomerName('');
            setValidatedRx(null);
            
            fetchMedications();
        } catch (error) {
            // Already handled by mutation onError
        }
    };

    const handlePrintLastReceipt = () => {
        if (!lastSale) { toast.error('Nenhuma venda recente'); return; }
        generatePOSReceipt(lastSale, companySettings);
    };

    const handleRefund = async () => {
        if (!refundSaleId || !refundReason.trim()) { toast.error('Preencha os campos obrigatórios'); return; }
        setIsRefunding(true);
        try {
            await pharmacyAPI.refundSale(refundSaleId, { reason: refundReason });
            toast.success('Venda devolvida com sucesso');
            queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
            setShowRefundModal(false);
            setRefundSaleNumber(''); setRefundReason(''); setRefundSaleId('');
            fetchMedications();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao processar devolução');
        } finally {
            setIsRefunding(false);
        }
    };

    const handleOpenShift = async (openingBalance: number, warehouseId?: string) => {
        try {
            await shiftAPI.open(openingBalance, warehouseId);
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'shift'] });
            toast.success('Turno aberto com sucesso');
            setShowShiftModal(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao abrir turno');
        }
    };

    const handleCloseShift = async (countedCash: number) => {
        try {
            const closed = await shiftAPI.close(countedCash);
            toast.success(`Turno fechado com diferença de ${closed.difference} MTn`);
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'shift'] });
            setShowShiftModal(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao fechar turno');
        }
    };

    const lookupSaleForRefund = async () => {
        if (!refundSaleNumber.trim()) return;
        try {
            const data = await pharmacyAPI.getSales({ search: refundSaleNumber, page: 1, limit: 1 });
            const found = (data as any)?.data?.[0];
            if (!found) { toast.error('Venda não encontrada'); return; }
            setRefundSaleId(found.id);
            toast.success(`Venda encontrada: ${found.customerName}`);
        } catch { toast.error('Erro na procura'); }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-full">
                {/* Header Skeleton */}
                <div className="h-24 bg-white dark:bg-dark-900 rounded-lg p-4 flex gap-4 animate-pulse">
                    <Skeleton className="w-64 h-full" />
                    <Skeleton className="flex-1 h-full" />
                    <Skeleton className="w-32 h-full" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Products Grid Skeleton */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <Card key={i} className="h-48 flex flex-col gap-2 p-2">
                                    <Skeleton className="flex-1 w-full rounded-md" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-6 w-1/2" />
                                </Card>
                            ))}
                        </div>
                    </div>
                    {/* Cart Section Skeleton */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="h-[600px] flex flex-col p-4 space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <div className="flex-1 space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-2">
                                        <Skeleton className="h-12 w-12 rounded-lg" />
                                        <div className="flex-1 space-y-1">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 p-4 bg-white dark:bg-dark-900 rounded-lg border border-gray-100 dark:border-dark-700 shadow-sm relative overflow-visible transition-all z-20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                
                <div className="relative z-10 flex items-center justify-between md:justify-start">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none mb-1">
                            PDV Farmácia
                        </h1>
                        <p className="text-gray-400 dark:text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                            Sistema Clínico de Dispensação
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center gap-3 relative z-10 border-t md:border-t-0 md:border-l border-gray-100 dark:border-dark-700 pt-3 md:pt-0 md:pl-4">
                    {shift ? (
                        <div className="flex-1 min-w-[200px] flex items-center gap-4 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-dark-800">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Turno Activo</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white">
                                    {new Date(shift.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <p className="text-xs font-black text-red-600 uppercase tracking-widest">Turno Fechado</p>
                        </div>
                    )}

                    <div className="flex gap-2 w-full md:w-auto">
                        {shift ? (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => { setShiftModalMode('close'); setShowShiftModal(true); }} 
                                className="flex-1 md:flex-none rounded-lg font-bold uppercase tracking-widest text-[10px] h-10 px-4"
                            >
                                Encerrar Turno
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => { setShiftModalMode('open'); setShowShiftModal(true); }} 
                                className="flex-1 md:flex-none rounded-lg font-bold uppercase tracking-widest text-[10px] h-10 px-4"
                            >
                                Abrir Turno
                            </Button>
                        )}
                        <Button 
                            variant="danger" 
                            size="sm" 
                            leftIcon={<HiOutlineRefresh className="w-4 h-4" />} 
                            onClick={() => setShowRefundModal(true)} 
                            className="rounded-lg font-bold uppercase tracking-widest text-[10px] h-10 px-3"
                        />
                    </div>
                </div>
            </div>

            {/* Allergy Warning Banner */}
            {allergyWarnings.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4 animate-bounce">
                    <div className="flex items-start gap-3">
                        <HiOutlineShieldExclamation className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-bold text-red-700 dark:text-red-400 mb-1 uppercase tracking-tighter">🚨 ALERTA DE SEGURANÇA - CONTRA-INDICAÇÃO</p>
                            {allergyWarnings.map((w, i) => <p key={i} className="text-sm text-red-600 font-medium">{w}</p>)}
                        </div>
                    </div>
                </div>
            )}

            {/* POS Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start relative z-10">
                <div className="lg:col-span-3">
                    <POSProductGrid
                        posSearch={posSearch}
                        setPosSearch={setPosSearch}
                        filteredMedications={filteredMedications}
                        posPagination={posPagination}
                        addToCart={addToCart}
                    />
                </div>
                <div className="lg:col-span-2">
                    <POSCartPanel
                        cart={cart}
                        setCart={setCart}
                        updateCartItem={updateCartItem}
                        removeFromCart={removeFromCart}
                        cartTotal={cartTotal}
                        insuranceAmount={insuranceAmount}
                        discount={discount}
                        setDiscount={setDiscount}
                        cartHasControlledItems={cartHasControlledItems}
                        prescriptionNumber={prescriptionNumber}
                        setPrescriptionNumber={setPrescriptionNumber}
                        selectedCustomer={selectedCustomer}
                        setSelectedCustomer={setSelectedCustomer}
                        manualCustomerName={manualCustomerName}
                        setManualCustomerName={setManualCustomerName}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        handleCheckout={handleCheckout}
                        lastSale={lastSale}
                        handlePrintLastReceipt={handlePrintLastReceipt}
                        customers={customers}
                        partners={partners}
                        insuranceEntity={insuranceEntity}
                        setInsuranceEntity={setInsuranceEntity}
                        setInsuranceCoverage={setInsuranceCoverage}
                        handleViewPatientHistory={handleViewPatientHistory}
                        onPrescriptionValidated={(rx: any) => setValidatedRx(rx)}
                    />
                </div>
            </div>

            <POSPatientHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                patientHistory={patientHistory}
            />

            {/* Interaction Warning Modal */}
            {showInteractionWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg p-8 border-4 border-amber-500 transform scale-110">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 animate-pulse">
                                <HiOutlineExclamationCircle className="w-8 h-8 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-xl text-amber-900 dark:text-amber-400 tracking-tighter">RISCO DE INTERAÇÃO</h3>
                                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Protocolo de Segurança Ativado</p>
                            </div>
                        </div>
                        <div className="space-y-4 mb-8">
                            {interactionWarnings.map((interaction: any, i: number) => (
                                <div key={i} className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                                    <p className="font-bold text-amber-800 dark:text-amber-200 mb-1">{interaction.description}</p>
                                    <p className="text-xs text-amber-600 font-medium">Recomendação: {interaction.management}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <Button
                                variant="danger"
                                className="flex-1 font-black uppercase tracking-widest"
                                onClick={() => { setShowInteractionWarning(false); setPendingCheckoutCart(null); }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 font-black uppercase tracking-widest"
                                onClick={() => {
                                    setShowInteractionWarning(false);
                                    if (pendingCheckoutCart) doCheckout(pendingCheckoutCart);
                                    setPendingCheckoutCart(null);
                                }}
                            >
                                Ignorar Risco
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {showRefundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-dark-800 rounded-lg shadow-2xl w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <HiOutlineRefresh className="w-5 h-5 text-red-500" />
                            Devolução
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nº da Venda</label>
                                <div className="flex gap-2">
                                    <Input value={refundSaleNumber} onChange={e => setRefundSaleNumber(e.target.value)} placeholder="Ex: PH-123" className="flex-1" />
                                    <Button variant="outline" onClick={lookupSaleForRefund}>Procurar</Button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Motivo</label>
                                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={refundReason} onChange={e => setRefundReason(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button variant="danger" onClick={handleRefund} isLoading={isRefunding} disabled={!refundSaleId} className="flex-1 font-bold">Confirmar</Button>
                            <Button variant="outline" onClick={() => setShowRefundModal(false)} className="font-bold">Sair</Button>
                        </div>
                    </div>
                </div>
            )}

            <PharmacyShiftModal 
                isOpen={showShiftModal}
                mode={shiftModalMode}
                shift={shift}
                onOpenShift={handleOpenShift}
                onCloseShift={handleCloseShift}
                onClose={() => setShowShiftModal(false)}
            />
        </div>
    );
}
