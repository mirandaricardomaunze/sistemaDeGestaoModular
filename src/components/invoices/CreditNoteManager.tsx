import { useState, useEffect } from 'react';
import { Card, Button, Input, Pagination, usePagination } from '../ui';
import { HiOutlineSearch, HiOutlinePlus, HiOutlinePrinter, HiOutlineEye } from 'react-icons/hi';
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

    const fetchCreditNotes = async () => {
        try {
            setIsLoading(true);
            const data = await invoicesAPI.getCreditNotes();
            setCreditNotes(data);
        } catch (error) {
            console.error('Error fetching credit notes:', error);
            toast.error('Erro ao buscar notas de crédito');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCreditNotes();
    }, []);

    const addCreditNote = (note: CreditNote) => {
        setCreditNotes(prev => [note, ...prev]);
    };

    // Filtered Notes
    const filteredNotes = creditNotes.filter(note =>
        note.number.toLowerCase().includes(search.toLowerCase()) ||
        note.customerName.toLowerCase().includes(search.toLowerCase()) ||
        note.originalInvoiceNumber.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedNotes,
        totalItems,
    } = usePagination(filteredNotes, 10);

    const handleCreateCreditNote = (creditNote: CreditNote) => {
        addCreditNote(creditNote);
        // toast.success("Nota de Crédito emitida com sucesso!"); // Already shown in modal
    };

    const handlePrint = (note: CreditNote) => {
        setSelectedNote(note);
        setShowPrintModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1 max-w-md">
                    <Input
                        placeholder="Buscar por número, cliente ou fatura..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                    />
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                    <HiOutlinePlus className="w-5 h-5 mr-2" />
                    Emitir Nota de Crédito
                </Button>
            </div>

            {/* List */}
            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="bg-gray-50 dark:bg-dark-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Número</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fatura Orig.</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Reembolsado</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {paginatedNotes.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Nenhuma nota de crédito emitida</td></tr>
                            ) : (
                                paginatedNotes.map((note) => (
                                    <tr key={note.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                        <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{note.number}</td>
                                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400">{note.originalInvoiceNumber}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{note.customerName}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{format(new Date(note.issueDate), 'dd/MM/yyyy')}</td>
                                        <td className="px-4 py-3 text-right font-bold text-red-600">-{formatCurrency(note.total)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handlePrint(note)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded" title="Ver/Imprimir">
                                                    <HiOutlineEye className="w-4 h-4 text-gray-500" />
                                                </button>
                                                <button onClick={() => handlePrint(note)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded" title="Imprimir">
                                                    <HiOutlinePrinter className="w-4 h-4 text-gray-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Pagination */}
            <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
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
