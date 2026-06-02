import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db, type PendingOperation, type PendingSale } from '../../db/offlineDB';
import {
    retryFailed,
    discardFailed,
    purgeSynced,
} from '../../services/offline/offlineQueue';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import {
    HiOutlineXMark,
    HiArrowPath,
    HiOutlineTrash,
    HiOutlineExclamationTriangle,
    HiOutlineClock,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { ConfirmationModal, Button } from '../ui';

interface Props {
    open: boolean;
    onClose: () => void;
}

type Row =
    | (PendingSale & { _kind: 'sale' })
    | (PendingOperation & { _kind: 'op' });

export default function SyncQueuePanel({ open, onClose }: Props) {
    const { isOnline, isSyncing, syncAll, refreshCounts } = useOfflineSync();
    const [rows, setRows] = useState<Row[]>([]);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const reload = useCallback(async () => {
        const [sales, ops] = await Promise.all([
            db.pendingSales.orderBy('timestamp').reverse().toArray(),
            db.pendingOperations.orderBy('timestamp').reverse().toArray(),
        ]);
        const merged: Row[] = [
            ...sales.map((s) => ({ ...s, _kind: 'sale' as const })),
            ...ops.map((o) => ({ ...o, _kind: 'op' as const })),
        ].sort((a, b) => b.timestamp - a.timestamp);
        setRows(merged);
    }, []);

    useEffect(() => {
        if (!open) return;
        reload();
        const i = setInterval(reload, 3000);
        return () => clearInterval(i);
    }, [open, reload]);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    const handleRetryAll = async () => {
        const count = await retryFailed();
        toast.success(`${count} operações reenfileiradas`);
        await syncAll();
        await reload();
        await refreshCounts();
    };

    const handleDiscardFailed = async () => {
        const count = await discardFailed();
        toast(`${count} operações descartadas`, { icon: '🗑️' });
        setConfirmDiscard(false);
        await reload();
        await refreshCounts();
    };

    const handlePurge = async () => {
        const count = await purgeSynced();
        if (count > 0) toast.success(`${count} registos limpos`);
        await reload();
    };

    const failedCount = rows.filter((r) => r.status === 'failed').length;

    const portal = !open ? null : createPortal(
        <div
            className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="w-full max-h-[90vh] bg-white dark:bg-dark-900 sm:max-w-3xl sm:rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-dark-700 flex flex-col"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="sync-queue-title"
            >
                <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-700">
                    <div>
                        <h2 id="sync-queue-title" className="text-base font-bold text-gray-900 dark:text-white">
                            Fila de sincronização
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isOnline ? 'Online' : 'Offline'} •{' '}
                            {rows.length} {rows.length === 1 ? 'item' : 'itens'}
                        </p>
                    </div>
                    <Button variant="ghost"
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 text-gray-500"
                        aria-label="Fechar"
                    >
                        <HiOutlineXMark className="w-5 h-5" />
                    </Button>
                </header>

                <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50">
                    <Button variant="ghost"
                        onClick={() => syncAll()}
                        disabled={!isOnline || isSyncing}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <HiArrowPath className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sincronizar agora
                    </Button>
                    {failedCount > 0 && (
                        <>
                            <Button variant="ghost"
                                onClick={handleRetryAll}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                            >
                                <HiArrowPath className="w-4 h-4" />
                                Repetir falhadas ({failedCount})
                            </Button>
                            <Button variant="ghost"
                                onClick={() => setConfirmDiscard(true)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                            >
                                <HiOutlineTrash className="w-4 h-4" />
                                Descartar falhadas
                            </Button>
                        </>
                    )}
                    <Button variant="ghost"
                        onClick={handlePurge}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-800 dark:text-gray-300"
                    >
                        Limpar concluídos
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {rows.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500">
                            Nenhuma operação pendente. Tudo sincronizado.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-dark-700">
                            {rows.map((r) => (
                                <QueueRow key={`${r._kind}-${r.id}`} row={r} />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <>
            {portal}
            <ConfirmationModal
                isOpen={confirmDiscard}
                onClose={() => setConfirmDiscard(false)}
                onConfirm={handleDiscardFailed}
                title="Descartar operações falhadas"
                message={`Tens a certeza que queres descartar ${failedCount} operação${failedCount !== 1 ? 'ões' : ''} falhada${failedCount !== 1 ? 's' : ''}? Esta acção é irreversível e os dados não serão sincronizados.`}
                confirmText="Descartar"
                cancelText="Cancelar"
                variant="danger"
            />
        </>
    );
}

function QueueRow({ row }: { row: Row }) {
    const label =
        row._kind === 'sale'
            ? `Venda • ${formatMoney(row.data?.total as number | undefined)}`
            : `${row.method} ${row.endpoint}`;
    const sublabel = new Date(row.timestamp).toLocaleString('pt-PT');
    const statusColor: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        syncing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
    return (
        <li className="px-5 py-3 flex items-start gap-3">
            <div className="mt-0.5">
                {row.status === 'failed' ? (
                    <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500" />
                ) : (
                    <HiOutlineClock className="w-5 h-5 text-gray-400" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {label}
                    </p>
                    <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusColor[row.status] ?? statusColor.pending}`}
                    >
                        {row.status}
                    </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>
                {row.attempts > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Tentativas: {row.attempts}
                        {row.lastError && ` • ${row.lastError}`}
                    </p>
                )}
            </div>
        </li>
    );
}

function formatMoney(value: number | undefined): string {
    if (typeof value !== 'number') return '—';
    return new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN',
        maximumFractionDigits: 2,
    }).format(value);
}
