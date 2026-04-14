const fs = require('fs');
const filePath = 'src/pages/pharmacy/PharmacyPOS.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Imports
code = code.replace(
`import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, LoadingSpinner, Badge, Input } from '../../components/ui';
import { usePharmacyPartners } from '../../hooks/usePharmacyPartners';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';`,
`import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, LoadingSpinner, Badge, Input } from '../../components/ui';
import { usePharmacyPartners } from '../../hooks/usePharmacyPartners';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';`
);

code = code.replace(
`import { pharmacyAPI } from '../../services/api';`,
`import { pharmacyAPI, shiftAPI } from '../../services/api';
import type { ShiftSession, ShiftSummary } from '../../services/api';`
);

code = code.replace(
`    HiOutlineX, HiOutlinePrinter, HiOutlineDocumentText
} from 'react-icons/hi';`,
`    HiOutlineX, HiOutlinePrinter, HiOutlineDocumentText, HiOutlinePlay, HiOutlineStop
} from 'react-icons/hi';`
);

code = code.replace(
`import { POSPatientHistoryModal } from '../../components/pharmacy/pos/POSPatientHistoryModal';`,
`import { POSPatientHistoryModal } from '../../components/pharmacy/pos/POSPatientHistoryModal';
import { CommercialShiftModal } from '../../components/commercial/pos/CommercialShiftModal';
import type { ShiftData } from '../../components/commercial/pos/CommercialShiftModal';
import { CommercialShortcutsHUD, ShortcutsHintBadge } from '../../components/commercial/pos/CommercialShortcutsHUD';`
);


// 2. Add queryClient and states after patientProfile
code = code.replace(
`    const { data: patientProfile } = useQuery({
        queryKey: ['pharmacy', 'patient-profile', selectedCustomer],
        queryFn: () => pharmacyAPI.getPatientProfile(selectedCustomer!),
        enabled: !!selectedCustomer
    });`,
`    const { data: patientProfile } = useQuery({
        queryKey: ['pharmacy', 'patient-profile', selectedCustomer],
        queryFn: () => pharmacyAPI.getPatientProfile(selectedCustomer!),
        enabled: !!selectedCustomer
    });

    const searchInputRef = useRef<HTMLInputElement>(null);
    const [showShortcutsHUD, setShowShortcutsHUD] = useState(false);
    
    const queryClient = useQueryClient();
    const { data: activeShift, isLoading: loadingShift } = useQuery<ShiftSession | null>({
        queryKey: ['pharmacy', 'shift'],
        queryFn: () => shiftAPI.getCurrent(),
        refetchInterval: 60_000,
        retry: false,
    });
    const { data: shiftSummary } = useQuery<ShiftSummary | null>({
        queryKey: ['pharmacy', 'shift', 'summary'],
        queryFn: () => shiftAPI.getSummary(),
        enabled: !!activeShift,
        refetchInterval: 30_000,
    });

    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');

    const shift: ShiftData | null = useMemo(() => {
        if (!activeShift) return null;
        const s = shiftSummary;
        return {
            openedAt: new Date(activeShift.openedAt),
            openingBalance: Number(activeShift.openingBalance),
            cashSales: s?.byPaymentMethod?.cash ?? Number(activeShift.cashSales),
            mpesaSales: s?.byPaymentMethod?.mpesa ?? Number(activeShift.mpesaSales),
            cardSales: s?.byPaymentMethod?.card ?? Number(activeShift.cardSales),
            creditSales: s?.byPaymentMethod?.credit ?? Number(activeShift.creditSales),
            totalSales: s?.totalSales ?? Number(activeShift.totalSales),
            saleCount: s?.salesCount ?? 0,
            withdrawals: Number(activeShift.withdrawals || 0),
            deposits: Number(activeShift.deposits || 0),
        };
    }, [activeShift, shiftSummary]);

    const handleOpenShift = async (openingBalance: number, warehouseId?: string) => {
        try {
            await shiftAPI.open(openingBalance, warehouseId);
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'shift'] });
            setShowShiftModal(false);
            toast.success('Turno aberto!', { icon: '✅' });
        } catch (err: any) {
            toast.error(err.message || 'Erro ao abrir turno');
        }
    };

    const handleCloseShift = async (countedCash: number) => {
        try {
            const closed = await shiftAPI.close(countedCash);
            const diff = Number(closed.difference) || 0;
            const total = Number(closed.totalSales) || 0;
            toast.success(\`Turno fechado. Total: \${total.toLocaleString()} MTn\`);
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'shift'] });
            setShowShiftModal(false);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao fechar turno');
        }
    };

    const handleToggleShift = useCallback(() => {
        if (shift) {
            setShiftModalMode('close');
        } else {
            setShiftModalMode('open');
        }
        setShowShiftModal(true);
    }, [shift]);

    const handlePrintLastReceipt = useCallback(() => {
        if (!lastSale) { toast.error('Nenhuma venda recente'); return; }
        generatePOSReceipt(lastSale, companySettings);
    }, [lastSale, companySettings]);

    const shortcuts = useMemo(() => [
        { key: 'F1', action: () => setShowShortcutsHUD(v => !v), description: 'Atalhos' },
        { key: 'F2', action: () => searchInputRef.current?.focus(), description: 'Busca' },
        { key: 'F4', action: () => document.getElementById('btn-checkout')?.click(), description: 'Pagar' },
        { key: 'F5', action: () => { setCart([]); toast.success('Venda descartada/limpa'); }, description: 'Limpar Venda' },
        { key: 'F9', action: handlePrintLastReceipt, description: 'Reimprimir Última' },
        { key: 'F10', action: handleToggleShift, description: 'Turno' },
        { key: 'Escape', action: () => { setCart([]); setPosSearch(''); }, description: 'Limpar Tudo' }
    ], [handleToggleShift, handlePrintLastReceipt]);

    useKeyboardShortcuts(shortcuts);
`
);

// Remove the old handlePrintLastReceipt declaration
code = code.replace(
`    const handlePrintLastReceipt = () => {
        if (!lastSale) { toast.error('Nenhuma venda recente'); return; }
        generatePOSReceipt(lastSale, companySettings);
    };`,
``
);

// 3. Checkout blocking
code = code.replace(
`    const handleCheckout = async () => {
        if (cart.length === 0) { toast.error('Adicione produtos ao carrinho'); return; }
        if (cartHasControlledItems && !prescriptionNumber.trim()) {`,
`    const handleCheckout = async () => {
        if (cart.length === 0) { toast.error('Adicione produtos ao carrinho'); return; }
        if (!shift) {
            toast('Abra o turno primeiro', { icon: '⚠️' });
            setShiftModalMode('open');
            setShowShiftModal(true);
            return;
        }
        if (cartHasControlledItems && !prescriptionNumber.trim()) {`
);

// 4. Loading indicator change
code = code.replace(
`    if (isLoading) {
        return (`,
`    if (isLoading || loadingShift) {
        return (`
);

// 5. Header change
code = code.replace(
`                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ponto de Venda — Farmácia</h1>
                    <p className="text-gray-500 dark:text-gray-400">Sistema de dispensação de medicamentos</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="danger" leftIcon={<HiOutlineRefresh className="w-4 h-4" />} onClick={() => setShowRefundModal(true)}>
                        Devolver Artigo
                    </Button>`,
`                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ponto de Venda — Farmácia</h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {shift
                            ? \`Turno aberto às \${shift.openedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · \${shift.saleCount} vendas\`
                            : 'Sem turno activo — abra o turno para vender'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {shift ? (
                        <button
                            onClick={() => { setShiftModalMode('close'); setShowShiftModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg"
                        >
                            <HiOutlineStop className="w-4 h-4" />
                            Fechar Turno
                        </button>
                    ) : (
                        <button
                            onClick={() => { setShiftModalMode('open'); setShowShiftModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-green-500/20"
                        >
                            <HiOutlinePlay className="w-4 h-4" />
                            Abrir Turno
                        </button>
                    )}
                    <Button variant="danger" leftIcon={<HiOutlineRefresh className="w-4 h-4" />} onClick={() => setShowRefundModal(true)}>
                        Devolução
                    </Button>`
);

// 6. Pass Ref to Grid
code = code.replace(
`                <POSProductGrid
                    posSearch={posSearch}`,
`                <POSProductGrid
                    searchInputRef={searchInputRef}
                    posSearch={posSearch}`
);

// 7. Modals at the bottom
code = code.replace(
`            {/* Refund Modal */}`,
`            <CommercialShiftModal
                isOpen={showShiftModal}
                mode={shiftModalMode}
                shift={shift}
                onOpenShift={handleOpenShift}
                onCloseShift={handleCloseShift}
                onClose={() => setShowShiftModal(false)}
            />

            <CommercialShortcutsHUD
                isOpen={showShortcutsHUD}
                onClose={() => setShowShortcutsHUD(false)}
            />

            <ShortcutsHintBadge onClick={() => setShowShortcutsHUD(true)} />

            {/* Refund Modal */}`
);

const idRegex = /<POSCartPanel([\s\S]*?)handleCheckout=\{handleCheckout\}/m;
const match = code.match(idRegex);
if(match) {
   code = code.replace("handleCheckout={handleCheckout}", "id=\\"btn-checkout\\" handleCheckout={handleCheckout}");
}

fs.writeFileSync(filePath, code);
console.log('PharmacyPOS patched successfully!');
