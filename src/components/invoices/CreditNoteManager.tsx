import { logger } from '../../utils/logger';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../ui';
import { SmartTable } from '../ui/SmartTable';
import {
    HiOutlinePlus,
    HiOutlinePrinter,
    HiOutlineEye,
    HiOutlineArrowDownTray,
    HiOutlineEnvelope,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/helpers';
import type { Invoice, CreditNote } from '../../types';
import { invoicesAPI } from '../../services/api';
import CreateCreditNoteModal from './CreateCreditNoteModal';
import CreditNotePrint from './CreditNotePrint';
import toast from 'react-hot-toast';

interface CreditNoteManagerProps {
    invoices: Invoice[];
}

export default function CreditNoteManager({ invoices }: CreditNoteManagerProps) {
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedNote, setSelectedNote] = useState<CreditNote | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchCreditNotes = async () => {
        try {
            setIsLoading(true);
            const data = await invoicesAPI.getCreditNotes();
            setCreditNotes(data);
        } catch (error) {
            logger.error('Error fetching credit notes:', error);
            toast.error('Erro ao buscar notas de credito');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCreditNotes();
    }, []);

    const filteredNotes = useMemo(() => {
        const term = search.trim().toLowerCase();
        const sorted = [...creditNotes].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

        if (!term) return sorted;

        return sorted.filter((note) =>
            note.number.toLowerCase().includes(term) ||
            note.customerName.toLowerCase().includes(term) ||
            (note.originalInvoiceNumber || '').toLowerCase().includes(term)
        );
    }, [creditNotes, search]);

    const paginatedNotes = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredNotes.slice(start, start + pageSize);
    }, [filteredNotes, page, pageSize]);

    const handleCreateCreditNote = (creditNote: CreditNote) => {
        setCreditNotes((prev) => [creditNote, ...prev]);
    };

    const handlePrint = (note: CreditNote) => {
        setSelectedNote(note);
        setShowPrintModal(true);
    };

    const handleDownloadPdf = async (note: CreditNote) => {
        try {
            const blob = await invoicesAPI.downloadCreditNotePdf(note.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `NotaCredito-${note.number}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            logger.error('Error downloading credit note PDF:', error);
            toast.error('Erro ao gerar PDF');
        }
    };

    const handleSendEmail = async (note: CreditNote) => {
        const email = window.prompt('Email do destinatário (deixe em branco para usar o do cliente):');
        if (email === null) return;
        try {
            const result = await invoicesAPI.sendCreditNoteByEmail(note.id, email || undefined);
            toast.success(result.message);
        } catch (error) {
            logger.error('Error sending credit note email:', error);
            toast.error('Erro ao enviar email');
        }
    };

    const creditNoteColumns = useMemo<ColumnDef<CreditNote, unknown>[]>(() => [
        {
            header: 'Numero',
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
            header: 'Data',
            cell: ({ row }) => (
                <span className="text-gray-600 dark:text-gray-400">
                    {format(new Date(row.original.issueDate), 'dd/MM/yyyy')}
                </span>
            ),
        },
        {
            header: 'Total Reembolsado',
            cell: ({ row }) => (
                <div className="text-right font-bold text-red-600">
                    -{formatCurrency(row.original.total)}
                </div>
            ),
        },
        {
            header: 'Accoes',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handlePrint(row.original)}
                        title="Ver/Imprimir"
                        className="h-8 w-8 px-0 rounded active:scale-95"
                    >
                        <HiOutlineEye className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handlePrint(row.original)}
                        title="Imprimir"
                        className="h-8 w-8 px-0 rounded active:scale-95"
                    >
                        <HiOutlinePrinter className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDownloadPdf(row.original)}
                        title="Descarregar PDF"
                        className="h-8 w-8 px-0 rounded active:scale-95"
                    >
                        <HiOutlineArrowDownTray className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSendEmail(row.original)}
                        title="Enviar por email"
                        className="h-8 w-8 px-0 rounded active:scale-95"
                    >
                        <HiOutlineEnvelope className="w-4 h-4 text-gray-500" />
                    </Button>
                </div>
            ),
        },
    ], []);

    return (
        <div className="space-y-6">
            <SmartTable
                data={paginatedNotes}
                columns={creditNoteColumns}
                isLoading={isLoading}
                search={{
                    value: search,
                    onChange: (value) => {
                        setSearch(value);
                        setPage(1);
                    },
                    placeholder: 'Buscar por numero, cliente ou fatura...',
                }}
                actions={
                    <Button onClick={() => setShowCreateModal(true)} size="sm">
                        <HiOutlinePlus className="w-5 h-5 mr-2" />
                        Emitir Nota de Credito
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
                emptyTitle="Nenhuma nota de credito emitida"
                emptyDescription="Emita notas de credito a partir das faturas disponiveis."
                minHeight="420px"
            />

            <CreateCreditNoteModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                invoices={invoices}
                onCreate={handleCreateCreditNote}
            />

            {selectedNote && (
                <CreditNotePrint
                    isOpen={showPrintModal}
                    onClose={() => { setShowPrintModal(false); setSelectedNote(null); }}
                    creditNote={selectedNote}
                />
            )}
        </div>
    );
}
