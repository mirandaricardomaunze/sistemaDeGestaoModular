import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
    HiOutlineNoSymbol,
    HiOutlineCheck,
    HiOutlineXMark,
    HiOutlineUser,
    HiOutlineClock,
} from 'react-icons/hi2';
import { Card, Badge, Button, Textarea, EmptyState, LoadingSpinner, ConfirmationModal } from '../../components/ui';
import { usePendingVoids, useSales } from '../../hooks/useSales';
import { formatCurrency } from '../../utils/helpers';

type PendingSale = {
    id: string;
    receiptNumber?: string;
    total: number | string;
    voidReason?: string;
    voidRequestedAt?: string;
    voidRequestedBy?: string;
    createdAt: string;
    customer?: { id: string; name: string; code?: string } | null;
    user?: { id: string; name: string } | null;
    items?: Array<{ id: string; quantity: number; unitPrice: number | string; total: number | string }>;
};

export default function CommercialPendingVoids() {
    const { data, isLoading, refetch } = usePendingVoids();
    const { approveVoid, rejectVoid } = useSales();

    const [confirmTarget, setConfirmTarget] = useState<{ sale: PendingSale; action: 'approve' | 'reject' } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [busy, setBusy] = useState(false);

    const handleConfirm = async () => {
        if (!confirmTarget) return;
        setBusy(true);
        try {
            if (confirmTarget.action === 'approve') {
                await approveVoid(confirmTarget.sale.id);
            } else {
                await rejectVoid(confirmTarget.sale.id, rejectReason);
            }
            setConfirmTarget(null);
            setRejectReason('');
            refetch();
        } catch {
            // toast handled in hook
        } finally {
            setBusy(false);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <div className="flex items-center justify-center py-16">
                    <LoadingSpinner size="lg" />
                </div>
            </Card>
        );
    }

    const sales = (data ?? []) as PendingSale[];

    if (sales.length === 0) {
        return (
            <Card>
                <EmptyState
                    icon={<HiOutlineNoSymbol className="w-12 h-12" />}
                    title="Sem pedidos pendentes"
                    description="Quando um operador solicitar a anulação de uma venda, o pedido aparecerá aqui para aprovação."
                />
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Pedidos de Anulação Pendentes
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Reveja e aprove ou rejeite. Aprovações restauram stock e revertem fidelização.
                    </p>
                </div>
                <Badge variant="warning" size="md">
                    {sales.length} pendente{sales.length > 1 ? 's' : ''}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sales.map((sale) => {
                    const requestedAt = sale.voidRequestedAt ? parseISO(sale.voidRequestedAt) : null;
                    const createdAt = parseISO(sale.createdAt);
                    return (
                        <Card key={sale.id} className="border-l-4 border-amber-500">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-black text-gray-900 dark:text-white">
                                                {sale.receiptNumber || `SALE-${sale.id.slice(-6)}`}
                                            </span>
                                            <Badge variant="warning" size="sm">PENDENTE</Badge>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Venda emitida {format(createdAt, 'dd/MM/yyyy HH:mm')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-gray-900 dark:text-white">
                                            {formatCurrency(Number(sale.total))}
                                        </p>
                                        <p className="text-[10px] uppercase font-bold text-gray-400">
                                            {sale.items?.length ?? 0} item(s)
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 dark:bg-dark-800 rounded-lg p-3">
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase tracking-wider">Cliente</p>
                                        <p className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                            <HiOutlineUser className="w-3.5 h-3.5" />
                                            {sale.customer?.name || 'Consumidor Final'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase tracking-wider">Vendedor</p>
                                        <p className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                            <HiOutlineUser className="w-3.5 h-3.5" />
                                            {sale.user?.name || '-'}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/10 pl-3 py-2 rounded-r">
                                    <p className="text-[10px] uppercase font-black text-amber-700 dark:text-amber-300 tracking-wider">
                                        Motivo do pedido
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-200 italic">
                                        "{sale.voidReason || '—'}"
                                    </p>
                                    {requestedAt && (
                                        <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                            <HiOutlineClock className="w-3 h-3" />
                                            Solicitado {format(requestedAt, 'dd/MM/yyyy HH:mm')}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        className="flex-1"
                                        leftIcon={<HiOutlineXMark className="w-4 h-4" />}
                                        onClick={() => setConfirmTarget({ sale, action: 'reject' })}
                                    >
                                        Rejeitar
                                    </Button>
                                    <Button
                                        variant="success"
                                        size="sm"
                                        className="flex-1"
                                        leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                                        onClick={() => setConfirmTarget({ sale, action: 'approve' })}
                                    >
                                        Aprovar Anulação
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <ConfirmationModal
                isOpen={!!confirmTarget}
                onClose={() => !busy && (setConfirmTarget(null), setRejectReason(''))}
                onConfirm={handleConfirm}
                title={confirmTarget?.action === 'approve' ? 'Aprovar Anulação' : 'Rejeitar Pedido'}
                message={
                    confirmTarget?.action === 'approve'
                        ? `Confirmar a anulação da venda ${confirmTarget.sale.receiptNumber || confirmTarget.sale.id.slice(-6)}? O stock será devolvido e os pontos de fidelização revertidos. A acção não pode ser desfeita.`
                        : `Rejeitar o pedido de anulação da venda ${confirmTarget?.sale.receiptNumber || confirmTarget?.sale.id.slice(-6)}? A venda permanece activa.`
                }
                confirmText={confirmTarget?.action === 'approve' ? 'Aprovar' : 'Rejeitar'}
                cancelText="Cancelar"
                variant={confirmTarget?.action === 'approve' ? 'success' : 'danger'}
                isLoading={busy}
                disabled={confirmTarget?.action === 'reject' && rejectReason.trim().length < 5}
            >
                {confirmTarget?.action === 'reject' && (
                    <div className="mt-4">
                        <Textarea
                            label="Motivo da rejeição (mín. 5 caracteres)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            placeholder="Ex: motivo insuficiente, comprovativo não anexado..."
                        />
                    </div>
                )}
            </ConfirmationModal>
        </div>
    );
}
