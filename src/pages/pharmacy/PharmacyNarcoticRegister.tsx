import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Select, Badge, LoadingSpinner, Pagination, PageHeader } from '../../components/ui';
import {
    HiOutlineClipboardDocumentList, HiOutlinePlus, HiOutlineExclamationCircle,
    HiOutlineShieldCheck, HiOutlineArrowDownTray as HiOutlineDownload, HiOutlineClipboardDocumentCheck
} from 'react-icons/hi2';
import { pharmacyAPI } from '../../services/api';
import { usePharmacy } from '../../hooks/usePharmacy';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/helpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStore } from '../../stores/useStore';

export default function PharmacyNarcoticRegister() {
    const queryClient = useQueryClient();
    const { companySettings } = useStore();
    const { medications } = usePharmacy({ isControlled: true, limit: 200 });
    const [showForm, setShowForm] = useState(false);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [page, setPage] = useState(1);
    const [form, setForm] = useState({
        registerDate: new Date().toISOString().slice(0, 10),
        medicationId: '',
        batchNumber: '',
        openingBalance: 0,
        received: 0,
        dispensed: 0,
        returned: 0,
        destroyed: 0,
        notes: ''
    });

    const { data, isLoading } = useQuery({
        queryKey: ['pharmacy', 'narcotic-register', dateRange, page],
        queryFn: () => pharmacyAPI.getNarcoticRegister({
            startDate: dateRange.start || undefined,
            endDate: dateRange.end || undefined,
            page, limit: 20
        })
    });

    const createMutation = useMutation({
        mutationFn: () => pharmacyAPI.createNarcoticEntry(form),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'narcotic-register'] });
            setShowForm(false);
            setForm({ registerDate: new Date().toISOString().slice(0, 10), medicationId: '', batchNumber: '', openingBalance: 0, received: 0, dispensed: 0, returned: 0, destroyed: 0, notes: '' });
            toast.success('Registo adicionado com sucesso');
        },
        onError: () => toast.error('Erro ao adicionar registo')
    });

    const records = data?.data || [];
    const closingPreview = form.openingBalance + form.received - form.dispensed + form.returned - form.destroyed;
    const discrepancyPreview = closingPreview < 0 ? Math.abs(closingPreview) : 0;

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text('Registo de Substâncias Psicotrópicas e Estupefacientes', 14, 20);
        doc.setFontSize(10);
        doc.text(`${companySettings?.companyName || ''}`, 14, 28);
        doc.text(`Período: ${dateRange.start || 'Início'} a ${dateRange.end || 'Hoje'}`, 14, 34);
        autoTable(doc, {
            startY: 40,
            head: [['Data', 'Medicamento', 'Lote', 'Saldo Inicial', 'Entrada', 'Saída', 'Devol.', 'Destr.', 'Saldo Final', 'Discrep.', 'Verificado por']],
            body: records.map((r: any) => [
                formatDate(r.registerDate), r.medicationName, r.batchNumber,
                r.openingBalance, r.received, r.dispensed, r.returned, r.destroyed,
                r.closingBalance, r.discrepancy > 0 ? `⚠️ ${r.discrepancy}` : '0',
                r.verifiedBy
            ]),
            styles: { fontSize: 7 },
            headStyles: { fillColor: [13, 148, 136] }
        });
        doc.save(`registo-narcoticos-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Registo de Narcóticos"
                subtitle="Controlo diário de substâncias psicotrópicas e estupefacientes"
                icon={<HiOutlineClipboardDocumentCheck />}
                actions={
                    <>
                        <Button variant="outline" onClick={exportPDF} leftIcon={<HiOutlineDownload className="w-4 h-4" />}>Exportar PDF</Button>
                        <Button onClick={() => setShowForm(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Novo Registo</Button>
                    </>
                }
            />

            {/* New Entry Form */}
            {showForm && (
                <Card padding="md" className="border-2 border-teal-200 dark:border-teal-800">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <HiOutlineClipboardDocumentList className="w-5 h-5 text-teal-600" />
                        Novo Registo Diário
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <Input label="Data do Registo" type="date" value={form.registerDate} onChange={e => setForm(f => ({ ...f, registerDate: e.target.value }))} />
                        <Select
                            label="Medicamento Controlado *"
                            value={form.medicationId}
                            onChange={e => setForm(f => ({ ...f, medicationId: e.target.value }))}
                            options={medications.filter((m: any) => m.isControlled).map((m: any) => ({
                                value: m.id,
                                label: `${m.product.name} (${m.controlLevel || 'Controlado'})`
                            }))}
                            placeholder="Seleccionar..."
                        />
                        <Input label="Nº Lote" value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} placeholder="Ex: LT-2024-001" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <Input label="Saldo Inicial" type="number" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: Number(e.target.value) }))} min={0} />
                        <Input label="Entradas (+)" type="number" value={form.received} onChange={e => setForm(f => ({ ...f, received: Number(e.target.value) }))} min={0} />
                        <Input label="Saídas (-)" type="number" value={form.dispensed} onChange={e => setForm(f => ({ ...f, dispensed: Number(e.target.value) }))} min={0} />
                        <Input label="Devoluções (+)" type="number" value={form.returned} onChange={e => setForm(f => ({ ...f, returned: Number(e.target.value) }))} min={0} />
                        <Input label="Destruídos (-)" type="number" value={form.destroyed} onChange={e => setForm(f => ({ ...f, destroyed: Number(e.target.value) }))} min={0} />
                    </div>
                    <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-dark-700">
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Saldo Final Previsto</p>
                            <p className={`text-2xl font-black ${closingPreview < 0 ? 'text-red-600' : 'text-green-600'}`}>{Math.max(0, closingPreview)}</p>
                        </div>
                        {discrepancyPreview > 0 && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                                <HiOutlineExclamationCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm font-medium">Discrepância de {discrepancyPreview} unidades detectada! Requer justificação.</p>
                            </div>
                        )}
                    </div>
                    <Input label="Observações / Justificação" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas obrigatórias em caso de discrepância..." />
                    <div className="flex gap-2 mt-4">
                        <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} leftIcon={<HiOutlineShieldCheck className="w-4 h-4" />}>Assinar e Guardar</Button>
                        <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                    </div>
                </Card>
            )}

            {/* Filters */}
            <Card padding="md">
                <div className="flex gap-4 items-end flex-wrap">
                    <Input
                        label="De"
                        type="date"
                        size="md"
                        value={dateRange.start}
                        onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))}
                    />
                    <Input
                        label="Até"
                        type="date"
                        size="md"
                        value={dateRange.end}
                        onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))}
                    />
                    <Button variant="outline" onClick={() => setDateRange({ start: '', end: '' })}>Limpar</Button>
                </div>
            </Card>

            {/* Records Table */}
            <Card padding="none">
                {isLoading ? <div className="p-8 flex justify-center"><LoadingSpinner /></div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                                <tr>
                                    {['Data', 'Medicamento', 'Lote', 'S.Inicial', 'Entradas', 'Saídas', 'Devol.', 'Destr.', 'S.Final', 'Discrep.', 'Verificado por'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {records.length === 0 ? (
                                    <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Nenhum registo encontrado</td></tr>
                                ) : records.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.registerDate)}</td>
                                        <td className="px-4 py-3 font-medium">{r.medicationName}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{r.batchNumber}</td>
                                        <td className="px-4 py-3 text-center">{r.openingBalance}</td>
                                        <td className="px-4 py-3 text-center text-green-600 font-medium">{r.received > 0 ? `+${r.received}` : ''}</td>
                                        <td className="px-4 py-3 text-center text-red-600 font-medium">{r.dispensed > 0 ? `-${r.dispensed}` : ''}</td>
                                        <td className="px-4 py-3 text-center text-blue-600">{r.returned > 0 ? `+${r.returned}` : ''}</td>
                                        <td className="px-4 py-3 text-center text-amber-600">{r.destroyed > 0 ? `-${r.destroyed}` : ''}</td>
                                        <td className="px-4 py-3 text-center font-bold">{r.closingBalance}</td>
                                        <td className="px-4 py-3 text-center">
                                            {r.discrepancy > 0 ? (
                                                <Badge variant="danger" className="font-bold">⚠️ {r.discrepancy}</Badge>
                                            ) : <Badge variant="success">OK</Badge>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{r.verifiedBy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {data && data.pagination.total > 0 && (
                    <div className="px-4 pb-2">
                        <Pagination
                            currentPage={page}
                            totalItems={data.pagination.total}
                            itemsPerPage={20}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
