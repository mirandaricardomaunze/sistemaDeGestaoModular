import { useMemo, useState } from 'react';
import {
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineShieldCheck,
    HiOutlineXCircle,
} from 'react-icons/hi2';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    PageHeader,
    Select,
    Textarea,
} from '../components/ui';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { useApprovals, useApprovalActions } from '../hooks/useApprovals';
import {
    APPROVAL_REQUEST_LABELS,
    APPROVAL_REQUEST_STATUSES,
    APPROVAL_REQUEST_TYPES,
    type ApprovalRequest,
    type ApprovalRequestStatus,
    type ApprovalRequestType,
} from '../types/approvals';
import { formatCurrency } from '../utils/helpers';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../stores/useAuthStore';

const STATUS_VARIANT: Record<ApprovalRequestStatus, 'gray' | 'info' | 'warning' | 'success' | 'danger'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    expired: 'gray',
    cancelled: 'gray',
};

const STATUS_LABEL: Record<ApprovalRequestStatus, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    expired: 'Expirado',
    cancelled: 'Cancelado',
};

function safeFormatDate(value: string | null): string {
    if (!value) return '—';
    try {
        return format(parseISO(value), 'dd/MM/yyyy HH:mm');
    } catch {
        return value;
    }
}

function ApprovalRow({ item, canDecide }: { item: ApprovalRequest; canDecide: boolean }) {
    const { approve, reject } = useApprovalActions();
    const [decisionNotes, setDecisionNotes] = useState('');
    const [showNotes, setShowNotes] = useState(false);

    const handleDecide = (action: 'approve' | 'reject') => {
        const payload = decisionNotes.trim() ? { decisionNotes: decisionNotes.trim() } : undefined;
        if (action === 'approve') approve.mutate({ id: item.id, payload });
        else reject.mutate({ id: item.id, payload });
    };

    const isPending = item.status === 'pending';
    const busy = approve.isPending || reject.isPending;

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                        <span className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                            {APPROVAL_REQUEST_LABELS[item.requestType]}
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.reason}</p>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                        <span>Por: <strong>{item.requestedByName ?? '—'}</strong></span>
                        <span>{safeFormatDate(item.createdAt)}</span>
                        {item.amount !== null && (
                            <span>Valor: <strong>{formatCurrency(Number(item.amount))}</strong></span>
                        )}
                    </div>
                </div>
                {item.status === 'approved' && <HiOutlineCheckCircle className="w-6 h-6 text-emerald-500" />}
                {item.status === 'rejected' && <HiOutlineXCircle className="w-6 h-6 text-red-500" />}
                {item.status === 'pending' && <HiOutlineClock className="w-6 h-6 text-amber-500" />}
            </div>

            {item.decidedAt && (
                <div className="text-xs text-gray-500 border-t border-gray-100 dark:border-dark-700 pt-2">
                    Decidido por <strong>{item.decidedByName ?? '—'}</strong> em {safeFormatDate(item.decidedAt)}
                    {item.decisionNotes && <p className="mt-1 italic">"{item.decisionNotes}"</p>}
                </div>
            )}

            {isPending && canDecide && (
                <div className="space-y-2">
                    {showNotes && (
                        <Textarea
                            placeholder="Notas (opcional)"
                            value={decisionNotes}
                            onChange={(e) => setDecisionNotes(e.target.value)}
                            rows={2}
                        />
                    )}
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() => handleDecide('approve')}
                        >
                            Aprovar
                        </Button>
                        <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => handleDecide('reject')}
                        >
                            Rejeitar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowNotes(p => !p)}>
                            {showNotes ? 'Ocultar notas' : 'Adicionar notas'}
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

export default function Approvals() {
    const { user } = useAuthStore();
    const role = user?.role ?? '';
    const canDecide = ['super_admin', 'admin', 'manager'].includes(role);

    const [statusFilter, setStatusFilter] = useState<ApprovalRequestStatus | ''>('pending');
    const [typeFilter, setTypeFilter] = useState<ApprovalRequestType | ''>('');

    const { items, pagination, isLoading } = useApprovals({
        status: statusFilter || undefined,
        requestType: typeFilter || undefined,
        limit: 50,
    });

    const counts = useMemo(() => {
        const acc: Record<ApprovalRequestStatus, number> = {
            pending: 0, approved: 0, rejected: 0, expired: 0, cancelled: 0,
        };
        for (const item of items) acc[item.status]++;
        return acc;
    }, [items]);

    const statusOptions = [
        { value: '', label: 'Todos os estados' },
        ...APPROVAL_REQUEST_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] })),
    ];

    const typeOptions = [
        { value: '', label: 'Todos os tipos' },
        ...APPROVAL_REQUEST_TYPES.map(t => ({ value: t, label: APPROVAL_REQUEST_LABELS[t] })),
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader
                title="Aprovações"
                subtitle="Pedidos de aprovação que requerem decisão de gestor"
                icon={<HiOutlineShieldCheck className="text-primary-600 dark:text-primary-400" />}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    label="Pendentes"
                    value={counts.pending}
                    icon={<HiOutlineClock className="w-6 h-6" />}
                    color="amber"
                    isLoading={isLoading}
                />
                <MetricCard
                    label="Aprovados"
                    value={counts.approved}
                    icon={<HiOutlineCheckCircle className="w-6 h-6" />}
                    color="emerald"
                    isLoading={isLoading}
                />
                <MetricCard
                    label="Rejeitados"
                    value={counts.rejected}
                    icon={<HiOutlineXCircle className="w-6 h-6" />}
                    color="red"
                    isLoading={isLoading}
                />
            </div>

            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ApprovalRequestStatus | '')}
                        options={statusOptions}
                    />
                    <Select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as ApprovalRequestType | '')}
                        options={typeOptions}
                    />
                </div>
            </Card>

            {isLoading ? (
                <Card className="p-12 text-center text-gray-500">A carregar...</Card>
            ) : items.length === 0 ? (
                <EmptyState
                    title={statusFilter === 'pending' && typeFilter === '' ? 'Sem pedidos pendentes' : 'Sem pedidos'}
                    description={
                        statusFilter === 'pending' && typeFilter === ''
                            ? 'Quando um operador solicitar uma aprovação, o pedido aparecerá aqui.'
                            : 'Não existem pedidos de aprovação com os filtros actuais.'
                    }
                    icon={<HiOutlineShieldCheck className="w-12 h-12" />}
                />
            ) : (
                <div className="space-y-3">
                    {items.map(item => (
                        <ApprovalRow key={item.id} item={item} canDecide={canDecide} />
                    ))}
                </div>
            )}

            {pagination && pagination.total > 0 && (
                <p className="text-xs text-gray-500 text-center">
                    {items.length} de {pagination.total} pedidos
                </p>
            )}
        </div>
    );
}
