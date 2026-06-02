import { logger } from '../../utils/logger';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, ConfirmationModal, Input, SmartTable } from '../ui';
import {
    HiOutlinePlus,
    HiOutlinePrinter,
    HiOutlineEye,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineArrowDownTray,
    HiOutlineEnvelope,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/helpers';
import type { Invoice, DebitNote } from '../../types';
import { invoicesAPI } from '../../services/api';
import CreateDebitNoteModal from './CreateDebitNoteModal';
import DebitNotePrint from './DebitNotePrint';
import toast from 'react-hot-toast';

interface DebitNoteManagerProps {
    invoices: Invoice[];
}

export default function DebitNoteManager({ invoices }: DebitNoteManagerProps) {
    const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedNote, setSelectedNote] = useState<DebitNote | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pendingAction, setPendingAction] = useState<{ note: DebitNote; type: 'cancel' | 'settle' } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [emailPromptNote, setEmailPromptNote] = useState<DebitNote | null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const fetchDebitNotes = async () => {
        try {
            setIsLoading(true);
            const data = await invoicesAPI.getDebitNotes();
            setDebitNotes(data);
        } catch (error) {
            logger.error('Error fetching debit notes:', error);
            toast.error('Erro ao buscar notas de débito');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDebitNotes();
    }, []);

    const filteredNotes = useMemo(() => {
        const term = search.trim().toLowerCase();
        const sorted = [...debitNotes].sort(
            (a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
        );
        if (!term) return sorted;
        return sorted.filter(
            (note) =>
                note.number.toLowerCase().includes(term) ||
                note.customerName.toLowerCase().includes(term) ||
                (note.originalInvoiceNumber || '').toLowerCase().includes(term),
        );
    }, [debitNotes, search]);

    const paginatedNotes = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredNotes.slice(start, start + pageSize);
    }, [filteredNotes, page, pageSize]);

    const handleCreated = (note: DebitNote) => {
        setDebitNotes((prev) => [note, ...prev]);
    };

    const handlePrint = (note: DebitNote) => {
        setSelectedNote(note);
        setShowPrintModal(true);
    };

    const handleCancel = (note: DebitNote) => {
        if (note.status !== 'issued') {
            toast.error(`Só é possível cancelar notas emitidas (estado: ${note.status})`);
            return;
        }
        setPendingAction({ note, type: 'cancel' });
    };

    const handleDownloadPdf = async (note: DebitNote) => {
        try {
            const blob = await invoicesAPI.downloadDebitNotePdf(note.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `NotaDebito-${note.number}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            logger.error('Error downloading debit note PDF:', error);
            toast.error('Erro ao gerar PDF');
        }
    };

    const handleSendEmail = (note: DebitNote) => {
        setEmailInput('');
        setEmailPromptNote(note);
    };

    const confirmSendEmail = async () => {
        if (!emailPromptNote) return;
        try {
            setIsSendingEmail(true);
            const result = await invoicesAPI.sendDebitNoteByEmail(emailPromptNote.id, emailInput.trim() || undefined);
            toast.success(result.message);
            setEmailPromptNote(null);
        } catch (error) {
            logger.error('Error sending debit note email:', error);
            toast.error('Erro ao enviar email');
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleSettle = (note: DebitNote) => {
        if (note.status !== 'issued') {
            toast.error(`Só é possível liquidar notas emitidas (estado: ${note.status})`);
            return;
        }
        setPendingAction({ note, type: 'settle' });
    };

    const confirmPendingAction = async () => {
        if (!pendingAction) return;
        const { note, type } = pendingAction;
        try {
            setIsProcessing(true);
            const updated = type === 'cancel'
                ? await invoicesAPI.cancelDebitNote(note.id)
                : await invoicesAPI.settleDebitNote(note.id);
            setDebitNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
            toast.success(type === 'cancel' ? 'Nota de débito cancelada' : 'Nota de débito liquidada');
            setPendingAction(null);
        } catch (error) {
            logger.error(`Error ${type === 'cancel' ? 'cancelling' : 'settling'} debit note:`, error);
            toast.error(type === 'cancel' ? 'Erro ao cancelar nota de débito' : 'Erro ao liquidar nota de débito');
        } finally {
            setIsProcessing(false);
        }
    };

    const statusBadge = (status: DebitNote['status']) => {
        const map: Record<DebitNote['status'], { label: string; cls: string }> = {
            draft: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
            issued: { label: 'Emitida', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
            settled: { label: 'Liquidada', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
            cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
        };
        const { label, cls } = map[status] || map.draft;
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
                {label}
            </span>
        );
    };

    const columns = useMemo<ColumnDef<DebitNote, unknown>[]>(
        () => [
            {
                header: 'Número',
                cell: ({ row }) => (
                    <span className="font-mono font-medium text-gray-900 dark:text-white">
                        {row.original.number}
                    </span>
                ),
            },
            {
                header: 'Fatura Orig.',
                cell: ({ row }) => (
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                        {row.original.originalInvoiceNumber}
                    </span>
                ),
            },
            {
                header: 'Cliente',
                cell: ({ row }) => (
                    <span className="font-medium text-gray-900 dark:text-white">
                        {row.original.customerName}
                    </span>
                ),
            },
            {
                header: 'Motivo',
                cell: ({ row }) => (
                    <span className="text-gray-600 dark:text-gray-400 line-clamp-1">
                        {row.original.reason}
                    </span>
                ),
            },
            {
                header: 'Data',
                cell: ({ row }) => (
                    <span className="text-gray-600 dark:text-gray-400">
                        {format(new Date(row.original.issueDate), 'dd/MM/yyyy')}
                    </span>
                ),
            },
            {
                header: 'Estado',
                cell: ({ row }) => statusBadge(row.original.status),
            },
            {
                header: 'Total Adicional',
                cell: ({ row }) => {
                    const isCancelled = row.original.status === 'cancelled';
                    return (
                        <div
                            className={`text-right font-bold ${
                                isCancelled ? 'text-gray-400 line-through' : 'text-amber-600'
                            }`}
                        >
                            +{formatCurrency(row.original.total)}
                        </div>
                    );
                },
            },
            {
                header: 'Acções',
                cell: ({ row }) => {
                    const note = row.original;
                    const isIssued = note.status === 'issued';
                    return (
                        <div className="flex justify-end gap-1">
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handlePrint(note)}
                                title="Ver"
                                className="h-8 w-8 px-0 rounded active:scale-95"
                            >
                                <HiOutlineEye className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handlePrint(note)}
                                title="Imprimir"
                                className="h-8 w-8 px-0 rounded active:scale-95"
                            >
                                <HiOutlinePrinter className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleDownloadPdf(note)}
                                title="Descarregar PDF"
                                className="h-8 w-8 px-0 rounded active:scale-95"
                            >
                                <HiOutlineArrowDownTray className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleSendEmail(note)}
                                title="Enviar por email"
                                className="h-8 w-8 px-0 rounded active:scale-95"
                            >
                                <HiOutlineEnvelope className="w-4 h-4 text-gray-500" />
                            </Button>
                            {isIssued && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => handleSettle(note)}
                                        title="Marcar como liquidada"
                                        className="h-8 w-8 px-0 rounded active:scale-95"
                                    >
                                        <HiOutlineCheckCircle className="w-4 h-4 text-emerald-600" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => handleCancel(note)}
                                        title="Cancelar"
                                        className="h-8 w-8 px-0 rounded active:scale-95"
                                    >
                                        <HiOutlineXCircle className="w-4 h-4 text-red-500" />
                                    </Button>
                                </>
                            )}
                        </div>
                    );
                },
            },
        ],
        [],
    );

    return (
        <div className="space-y-6">
            <SmartTable
                data={paginatedNotes}
                columns={columns}
                isLoading={isLoading}
                search={{
                    value: search,
                    onChange: (value) => {
                        setSearch(value);
                        setPage(1);
                    },
                    placeholder: 'Buscar por número, cliente ou fatura...',
                }}
                actions={
                    <Button onClick={() => setShowCreateModal(true)} size="sm" leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                        Emitir Nota de Débito
                    </Button>
                }
                pagination={{
                    currentPage: page,
                    totalItems: filteredNotes.length,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                    onItemsPerPageChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                    },
                }}
                emptyTitle="Nenhuma nota de débito emitida"
                emptyDescription="Emita notas de débito para cobrar juros, multas ou correções de valor sobre faturas existentes."
                minHeight="420px"
            />

            <CreateDebitNoteModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                invoices={invoices}
                onCreate={handleCreated}
            />

            {selectedNote && (
                <DebitNotePrint
                    isOpen={showPrintModal}
                    onClose={() => {
                        setShowPrintModal(false);
                        setSelectedNote(null);
                    }}
                    debitNote={selectedNote}
                />
            )}

            <ConfirmationModal
                isOpen={!!pendingAction}
                onClose={() => !isProcessing && setPendingAction(null)}
                onConfirm={confirmPendingAction}
                title={pendingAction?.type === 'cancel' ? 'Cancelar nota de débito?' : 'Liquidar nota de débito?'}
                message={
                    pendingAction?.type === 'cancel'
                        ? `Cancelar a Nota de Débito ${pendingAction?.note.number}? Esta acção reduz o saldo em dívida da fatura.`
                        : `Marcar a Nota de Débito ${pendingAction?.note.number} como liquidada?`
                }
                confirmText={pendingAction?.type === 'cancel' ? 'Sim, cancelar' : 'Sim, liquidar'}
                cancelText="Voltar"
                variant={pendingAction?.type === 'cancel' ? 'danger' : 'primary'}
                isLoading={isProcessing}
            />

            <ConfirmationModal
                isOpen={!!emailPromptNote}
                onClose={() => !isSendingEmail && setEmailPromptNote(null)}
                onConfirm={confirmSendEmail}
                title="Enviar nota de débito por email"
                message="Deixe em branco para enviar para o email do cliente registado na fatura."
                confirmText="Enviar"
                cancelText="Cancelar"
                variant="primary"
                isLoading={isSendingEmail}
            >
                <Input
                    type="email"
                    label="Email do destinatário (opcional)"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="exemplo@empresa.com"
                    autoFocus
                />
            </ConfirmationModal>
        </div>
    );
}
