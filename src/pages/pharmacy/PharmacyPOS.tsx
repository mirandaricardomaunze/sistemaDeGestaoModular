import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, LoadingSpinner, Badge, Input } from '../../components/ui';
import { usePharmacyPartners } from '../../hooks/usePharmacyPartners';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playScanSound } from '../../utils/audio';
import { pharmacyAPI, shiftAPI } from '../../services/api';
import type { ShiftSession as ShiftData, ShiftSummary } from '../../services/api';
import { useCustomers } from '../../hooks/useData';
import toast from 'react-hot-toast';
import {
    HiOutlineRefresh, HiOutlineExclamationCircle, HiOutlineShieldExclamation,
    HiOutlineX, HiOutlinePrinter, HiOutlineDocumentText
} from 'react-icons/hi';
import { usePagination } from '../../components/ui/Pagination';
import { useStore } from '../../stores/useStore';
import { generatePOSReceipt } from '../../utils/documentGenerator';

// Atomic Components
import { POSProductGrid } from '../../components/pharmacy/pos/POSProductGrid';
import { POSCartPanel } from '../../components/pharmacy/pos/POSCartPanel';
import { POSPatientHistoryModal } from '../../components/pharmacy/pos/POSPatientHistoryModal';
import { PharmacyShiftModal } from '../../components/pharmacy/pos/PharmacyShiftModal';

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

// Generate Rx label HTML and print
function printRxLabel(sale: any, companySettings: any) {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    const items = sale.items || [];
    w.document.write(`
        <html><head><title>Rótulo Farmácia</title>
        <style>
            body{font-family:Arial,sans-serif;font-size:11px;margin:0;padding:8px;}
            .label{border:1px solid #333;padding:10px;max-width:340px;margin:auto;}
            .header{text-align:center;border-bottom:1px solid #333;padding-bottom:6px;margin-bottom:6px;}
            .company{font-weight:bold;font-size:13px;}
            .rx-title{font-weight:bold;font-size:12px;margin:6px 0 4px;}
            .item{margin:4px 0;padding:4px 0;border-bottom:1px dashed #ccc;}
            .item-name{font-weight:bold;}
            .posology{font-style:italic;color:#555;}
            .footer{margin-top:8px;font-size:10px;color:#666;text-align:center;}
            .warning{background:#FFF3CD;border:1px solid #FFC107;padding:4px;margin:4px 0;font-size:10px;}
        </style></head><body>
        <div class="label">
            <div class="header">
                <div class="company">${companySettings?.companyName || 'Farmácia'}</div>
                <div>${companySettings?.address || ''}</div>
                <div>Tel: ${companySettings?.phone || ''}</div>
            </div>
            <div><strong>Paciente:</strong> ${sale.customerName || 'Cliente Balcão'}</div>
            <div><strong>Data:</strong> ${new Date(sale.createdAt || Date.now()).toLocaleDateString('pt-BR')}</div>
            <div><strong>Venda:</strong> ${sale.saleNumber || ''}</div>
            ${sale.prescription ? `<div><strong>Receita:</strong> ${sale.prescription.prescriptionNo} — Dr. ${sale.prescription.prescriberName}</div>` : ''}
            <div class="rx-title">MEDICAMENTOS DISPENSADOS</div>
            ${items.map((item: any) => `
                <div class="item">
                    <div class="item-name">${item.productName}</div>
                    <div>Qtd: ${item.quantity}</div>
                    ${item.posologyLabel ? `<div class="posology">Posologia: ${item.posologyLabel}</div>` : ''}
                    ${item.batch?.expiryDate ? `<div>Validade: ${new Date(item.batch.expiryDate).toLocaleDateString('pt-BR')}</div>` : ''}
                </div>
            `).join('')}
            <div class="warning">⚠ Guardar longe do alcance de crianças. Cumprir a posologia prescrita.</div>
            <div class="footer">Conserve este rótulo com o medicamento</div>
        </div>
        </body></html>
    `);
    w.document.close();
    w.print();
}

export default function PharmacyPOS() {
    const queryClient = useQueryClient();
    const { companySettings } = useStore();
    const { partners } = usePharmacyPartners();
    const { customers } = useCustomers();

    const {
        data: medicationsData,
        isLoading,
        refetch: fetchMedications
    } = useQuery({
        queryKey: ['pharmacy', 'medications'],
        queryFn: async () => {
            const data = await pharmacyAPI.getMedications({});
            return Array.isArray(data) ? data : (data?.data || []);
        },
        staleTime: 5 * 60 * 1000
    });

    const medications = medicationsData || [];

    // Shift State
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');

    // Fetch active shift
    const { data: activeShift } = useQuery<ShiftData | null>({
        queryKey: ['pharmacy', 'shift'],
        queryFn: () => shiftAPI.getCurrent(),
        refetchInterval: 60000,
    });

    const { data: shiftSummary } = useQuery<ShiftSummary | null>({
        queryKey: ['pharmacy', 'shift', 'summary'],
        queryFn: () => shiftAPI.getSummary(),
        enabled: !!activeShift,
        refetchInterval: 60000,
    });

    const shift: ShiftData | null = useMemo(() => {
        if (!activeShift) return null;
        const s = shiftSummary;
        return {
            ...activeShift,
            cashSales: s?.cashSales || 0,
            mpesaSales: s?.mpesaSales || 0,
            cardSales: s?.cardSales || 0,
            creditSales: s?.creditSales || 0,
            totalSales: s?.totalSales || 0,
            saleCount: s?.saleCount || 0,
            withdrawals: s?.withdrawals || 0,
            deposits: s?.deposits || 0,
            openedAt: new Date(activeShift.openedAt)
        } as ShiftData;
    }, [activeShift, shiftSummary]);

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
    const [patientHistory, setPatientHistory] = useState<any[]>([]);

    // Validated prescription from POS lookup
    const [validatedRx, setValidatedRx] = useState<any>(null);

    // Drug interaction warning
    const [interactionWarnings, setInteractionWarnings] = useState<any[]>([]);
    const [showInteractionWarning, setShowInteractionWarning] = useState(false);
    const [pendingCheckoutCart, setPendingCheckoutCart] = useState<CartItem[] | null>(null);

    // Allergy warning
    const [allergyWarnings, setAllergyWarnings] = useState<string[]>([]);
    const [showAllergyWarning, setShowAllergyWarning] = useState(false);

    // Refund modal
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundSaleNumber, setRefundSaleNumber] = useState('');
    const [refundReason, setRefundReason] = useState('');
    const [refundSaleId, setRefundSaleId] = useState('');
    const [isRefunding, setIsRefunding] = useState(false);

    // Patient profile (for allergy checking)
    const { data: patientProfile } = useQuery({
        queryKey: ['pharmacy', 'patient-profile', selectedCustomer],
        queryFn: () => pharmacyAPI.getPatientProfile(selectedCustomer!),
        enabled: !!selectedCustomer
    });

    // Check allergies whenever cart changes and customer is selected
    useEffect(() => {
        if (!patientProfile?.allergies?.length || !cart.length) {
            setAllergyWarnings([]);
            return;
        }
        const allAllergies: string[] = patientProfile.allergies.map((a: string) => a.toLowerCase());
        const warnings: string[] = [];
        cart.forEach(item => {
            const medData = medications.find((m: any) => m.batches?.some((b: any) => b.id === item.batchId));
            if (medData) {
                const contraindications = (medData.contraindications || '').toLowerCase();
                const activeIngredient = (medData.activeIngredient || '').toLowerCase();
                const dci = (medData.dci || '').toLowerCase();
                allAllergies.forEach(allergy => {
                    if (contraindications.includes(allergy) || activeIngredient.includes(allergy) || dci.includes(allergy)) {
                        warnings.push(`⚠ ALERGIA: "${item.productName}" — paciente tem alergia a "${allergy.toUpperCase()}"`);
                    }
                });
            }
        });
        setAllergyWarnings([...new Set(warnings)]);
    }, [cart, patientProfile, medications]);

    const filteredMedications = useMemo(() => {
        if (!posSearch) return medications.filter((m: any) => m.totalStock > 0);
        return medications.filter((m: any) =>
            m.totalStock > 0 &&
            (m.product.name.toLowerCase().includes(posSearch.toLowerCase()) ||
                m.product.code.toLowerCase().includes(posSearch.toLowerCase()) ||
                (m.dci && m.dci.toLowerCase().includes(posSearch.toLowerCase())))
        );
    }, [medications, posSearch]);

    const posPagination = usePagination(filteredMedications, 12);

    useBarcodeScanner({
        onScan: (barcode) => {
            const found = medications.find((m: any) => m.product.code === barcode || (m.product as any).barcode === barcode);
            if (found) {
                addToCart(found);
                playScanSound();
                toast.success(`Adicionado: ${found.product.name}`);
            } else {
                toast.error('Produto não encontrado');
            }
        },
        enabled: !isLoading
    });

    const handleViewPatientHistory = async () => {
        if (!selectedCustomer) return;
        try {
            const history = await pharmacyAPI.getPatientControlledHistory(selectedCustomer);
            setPatientHistory(history);
            setIsHistoryModalOpen(true);
        } catch {
            toast.error('Erro ao buscar histórico do paciente');
        }
    };

    const addToCart = (medication: any) => {
        if (!medication.batches || medication.batches.length === 0) {
            toast.error('Medicamento sem stock disponível');
            return;
        }
        const batch = medication.batches[0];
        const existing = cart.find(item => item.batchId === batch.id);

        if (existing) {
            if (existing.quantity >= batch.quantityAvailable) {
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
                productName: medication.product.name,
                quantity: 1,
                unitPrice: Number(batch.sellingPrice),
                discount: 0,
                total: Number(batch.sellingPrice),
                maxQuantity: batch.quantityAvailable,
                expiryDate: batch.expiryDate,
                requiresPrescription: medication.requiresPrescription,
                isControlled: medication.isControlled
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

    // Check drug interactions before checkout
    const checkInteractions = async (cartItems: CartItem[]): Promise<boolean> => {
        if (cartItems.length < 2) return true;
        const medicationIds = [...new Set(cartItems.map(i => i.medicationId).filter(Boolean))];
        if (medicationIds.length < 2) return true;
        try {
            const interactions = await pharmacyAPI.checkCartInteractions(medicationIds);
            if (interactions && interactions.length > 0) {
                setInteractionWarnings(interactions);
                setShowInteractionWarning(true);
                setPendingCheckoutCart(cartItems);
                return false;
            }
        } catch { /* ignore interaction check errors */ }
        return true;
    };

    const handleCheckout = async () => {
        if (!shift) { toast.error('Precisa de abrir um turno de caixa para realizar vendas.'); return; }
        if (cart.length === 0) { toast.error('Adicione produtos ao carrinho'); return; }
        if (cartHasControlledItems && !prescriptionNumber.trim()) {
            toast.error('Obrigatório inserir Nº de Receita Médica para medicamentos controlados.');
            return;
        }
        // Warn if dispensing already-dispensed prescription
        if (validatedRx && validatedRx.status === 'dispensed') {
            const confirmed = window.confirm('Esta receita já foi dispensada anteriormente. Tem a certeza que deseja continuar?');
            if (!confirmed) return;
        }
        // Check controlled medication limits for registered patient
        if (cartHasControlledItems && selectedCustomer) {
            try {
                const history = await pharmacyAPI.getPatientControlledHistory(selectedCustomer);
                const recentControlled = (history || []).filter((h: any) => {
                    const date = new Date(h.createdAt || h.registerDate);
                    const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
                    return daysDiff <= 30;
                });
                if (recentControlled.length >= 3) {
                    const confirmed = window.confirm(`Atenção: Este paciente recebeu medicamentos controlados ${recentControlled.length} vez(es) nos últimos 30 dias. Confirmar dispensação?`);
                    if (!confirmed) return;
                }
            } catch { /* ignore if history unavailable */ }
        }
        // Check drug interactions first
        const canProceed = await checkInteractions(cart);
        if (!canProceed) return;
        await doCheckout(cart);
    };

    const doCheckout = async (cartItems: CartItem[]) => {
        try {
            const customer = customers.find(c => c.id === selectedCustomer);
            const sale = await pharmacyAPI.createSale({
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

            toast.success(
                (t) => (
                    <div className="flex flex-col gap-2">
                        <span>Venda <strong>{sale.saleNumber}</strong> realizada!</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => {
                                    generatePOSReceipt(sale, companySettings);
                                    toast.dismiss(t.id);
                                }}
                                className="bg-white text-teal-600 px-2 py-1 rounded text-xs font-medium border border-teal-200 hover:bg-teal-50 hover:border-teal-300 transition-colors"
                            >
                                <HiOutlinePrinter className="inline w-3 h-3 mr-1" />Recibo
                            </button>
                            <button
                                onClick={() => { printRxLabel(sale, companySettings); toast.dismiss(t.id); }}
                                className="bg-white text-green-600 px-2 py-1 rounded text-xs font-medium border border-green-200 hover:bg-gray-50"
                            >
                                <HiOutlineDocumentText className="inline w-3 h-3 mr-1" />Rótulo Rx
                            </button>
                        </div>
                    </div>
                ),
                { duration: 8000 }
            );

            // Mark prescription as dispensed if it was validated
            if (validatedRx?.id && validatedRx.status !== 'dispensed') {
                try {
                    await pharmacyAPI.updatePrescriptionStatus(validatedRx.id, 'dispensed');
                } catch { /* don't block sale for this */ }
            }

            // Reset
            setCart([]); setDiscount(0); setInsuranceEntity(null);
            setInsuranceCoverage(0); setPrescriptionNumber('');
            setSelectedCustomer(null); setManualCustomerName('');
            setValidatedRx(null);
            fetchMedications();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error.message || 'Erro ao realizar venda');
        }
    };

    const handlePrintLastReceipt = () => {
        if (!lastSale) { toast.error('Nenhuma venda recente'); return; }
        generatePOSReceipt(lastSale, companySettings);
    };

    const handleRefund = async () => {
        if (!shift) { toast.error('Abra o turno para processar devoluções.'); return; }
        if (!refundSaleId || !refundReason.trim()) { toast.error('Preencha todos os campos'); return; }
        setIsRefunding(true);
        try {
            await pharmacyAPI.refundSale(refundSaleId, { reason: refundReason });
            toast.success('Venda devolvida com sucesso');
            // Refresh shift metrics
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'shift', 'summary'] });
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
            toast.success(`Turno fechado. Diferença: ${closed.difference > 0 ? '+' : ''}${closed.difference} MTn`);
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'shift'] });
            setShowShiftModal(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Erro ao fechar turno');
        }
    };

    // Lookup sale by number for refund
    const lookupSaleForRefund = async () => {
        if (!refundSaleNumber.trim()) return;
        try {
            const data = await pharmacyAPI.getSales({ page: 1, limit: 100 });
            const sales = data?.data || [];
            const found = sales.find((s: any) => s.saleNumber.toLowerCase() === refundSaleNumber.toLowerCase());
            if (!found) { toast.error('Venda não encontrada'); return; }
            if (found.status === 'refunded') { toast.error('Esta venda já foi devolvida'); return; }
            setRefundSaleId(found.id);
            toast.success(`Venda encontrada: ${found.customerName} — ${new Date(found.createdAt).toLocaleDateString()}`);
        } catch { toast.error('Erro ao procurar venda'); }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="xl" />
                <p className="mt-4 text-sm text-gray-400">A carregar ponto de venda...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 p-4 bg-white dark:bg-dark-900 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm relative overflow-visible transition-all z-20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                
                {/* Brand / Title section */}
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

                {/* Shift Metrics & Actions */}
                <div className="flex flex-wrap md:flex-nowrap items-center gap-3 relative z-10 border-t md:border-t-0 md:border-l border-gray-100 dark:border-dark-700 pt-3 md:pt-0 md:pl-4">
                    {shift ? (
                        <div className="flex-1 min-w-[200px] flex items-center gap-4 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-dark-800">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Turno Activo</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white">
                                    {shift.openedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {shift.saleCount} vendas
                                </p>
                            </div>
                            <div className="h-8 w-px bg-gray-200 dark:bg-dark-700 hidden sm:block" />
                            <div className="hidden sm:block">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Caixa</p>
                                <p className="text-sm font-black text-teal-600">{(shift.totalSales || 0).toLocaleString()} MTn</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20">
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
                                className="flex-1 md:flex-none rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-4 border-gray-200 dark:border-dark-600 hover:bg-slate-700 hover:text-white hover:border-slate-700"
                            >
                                Encerrar Turno
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => { setShiftModalMode('open'); setShowShiftModal(true); }} 
                                className="flex-1 md:flex-none rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-4 shadow-lg shadow-teal-500/20"
                            >
                                Abrir Turno
                            </Button>
                        )}
                        <Button 
                            variant="danger" 
                            size="sm" 
                            leftIcon={<HiOutlineRefresh className="w-4 h-4" />} 
                            onClick={() => setShowRefundModal(true)} 
                            className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-3"
                            title="Devoluções"
                        />
                    </div>
                </div>
            </div>

            {/* Allergy Warning Banner */}
            {allergyWarnings.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <HiOutlineShieldExclamation className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-bold text-red-700 dark:text-red-400 mb-1">ALERTA DE SEGURANÇA — ALERGIA DO PACIENTE</p>
                            {allergyWarnings.map((w, i) => <p key={i} className="text-sm text-red-600">{w}</p>)}
                        </div>
                    </div>
                </div>
            )}

            {/* POS Layout - Hyper Compact */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start relative z-10">
                {!shift && (
                    <div className="absolute inset-0 z-20 bg-white/40 dark:bg-dark-900/40 backdrop-blur-sm rounded-2xl flex items-center justify-center pointer-events-none">
                        <div className="bg-white/90 dark:bg-dark-800/90 p-4 rounded-xl shadow-lg border border-red-200 dark:border-red-900/50">
                            <p className="text-sm font-black text-red-600 uppercase tracking-widest text-center">Caixa Encerrado</p>
                            <p className="text-xs text-gray-500 mt-1">É necessário abrir um turno para processar vendas.</p>
                        </div>
                    </div>
                )}
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

            {/* Drug Interaction Warning Modal */}
            {showInteractionWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 border-2 border-amber-400">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <HiOutlineExclamationCircle className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-amber-800 dark:text-amber-400">INTERACÇÃO MEDICAMENTOSA DETECTADA</h3>
                                <p className="text-sm text-gray-500">Verifique antes de prosseguir com a dispensa</p>
                            </div>
                        </div>
                        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                            {interactionWarnings.map((interaction: any, i: number) => (
                                <div key={i} className={`p-3 rounded-xl border-2 ${interaction.severity === 'contraindicated' ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : interaction.severity === 'major' ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-bold text-sm">
                                            {interaction.medicationA?.product?.name} ↔ {interaction.medicationB?.product?.name}
                                        </p>
                                        <Badge variant={interaction.severity === 'contraindicated' || interaction.severity === 'major' ? 'danger' : 'warning'} className="text-xs uppercase">
                                            {interaction.severity === 'contraindicated' ? 'CONTRAINDICADO' : interaction.severity === 'major' ? 'MAJOR' : interaction.severity === 'moderate' ? 'MODERADO' : 'MINOR'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{interaction.description}</p>
                                    {interaction.management && <p className="text-xs text-blue-600 mt-1">Gestão: {interaction.management}</p>}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={() => {
                                    setShowInteractionWarning(false);
                                    setPendingCheckoutCart(null);
                                }}
                                leftIcon={<HiOutlineX className="w-4 h-4" />}
                            >
                                Cancelar Venda
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setShowInteractionWarning(false);
                                    if (pendingCheckoutCart) doCheckout(pendingCheckoutCart);
                                    setPendingCheckoutCart(null);
                                }}
                            >
                                Prosseguir Mesmo Assim
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Refund Modal */}
            {showRefundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <HiOutlineRefresh className="w-5 h-5 text-red-500" />
                            Devolução de Medicamentos
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nº da Venda</label>
                                <div className="flex gap-2">
                                    <Input value={refundSaleNumber} onChange={e => setRefundSaleNumber(e.target.value)} placeholder="Ex: PH-000123" className="flex-1" onKeyDown={e => e.key === 'Enter' && lookupSaleForRefund()} />
                                    <Button variant="outline" onClick={lookupSaleForRefund}>Procurar</Button>
                                </div>
                                {refundSaleId && <p className="text-xs text-green-600 mt-1">✓ Venda encontrada</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo da Devolução *</label>
                                <textarea className="w-full rounded-xl border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" rows={3}
                                    value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Descreva o motivo da devolução..." />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button variant="danger" onClick={handleRefund} isLoading={isRefunding} disabled={!refundSaleId || !refundReason.trim()} className="flex-1">
                                Confirmar Devolução
                            </Button>
                            <Button variant="outline" onClick={() => { setShowRefundModal(false); setRefundSaleNumber(''); setRefundReason(''); setRefundSaleId(''); }}>
                                Cancelar
                            </Button>
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
