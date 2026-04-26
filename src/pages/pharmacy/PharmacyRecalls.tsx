import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Badge, LoadingSpinner, Select, Textarea } from '../../components/ui';
import {
    HiOutlineExclamationCircle, HiOutlinePlus, HiOutlineCheckCircle,
    HiOutlineUsers, HiOutlinePhone
} from 'react-icons/hi';
import { pharmacyAPI } from '../../services/api';
import { usePharmacy } from '../../hooks/usePharmacy';
import toast from 'react-hot-toast';
import { formatDate, cn } from '../../utils/helpers';

const SEVERITY_LABELS: Record<string, { label: string; variant: any }> = {
    voluntary: { label: 'Voluntria', variant: 'warning' },
    mandatory: { label: 'Obrigatória', variant: 'danger' },
    urgent: { label: 'URGENTE', variant: 'danger' }
};

export default function PharmacyRecalls() {
    const queryClient = useQueryClient();
    const { medications } = usePharmacy({ limit: 500 });
    const [showForm, setShowForm] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedRecall, setSelectedRecall] = useState<any>(null);
    const [resolveModal, setResolveModal] = useState<any>(null);
    const [resolveForm, setResolveForm] = useState({ recoveredUnits: 0, actionTaken: '' });
    const [batchInput, setBatchInput] = useState('');
    const [form, setForm] = useState({
        medicationId: '',
        batchNumbers: [] as string[],
        reason: '',
        severity: 'voluntary',
        issuedBy: '',
        recallDate: new Date().toISOString().slice(0, 10),
        notes: ''
    });

    const { data, isLoading } = useQuery({
        queryKey: ['pharmacy', 'recalls', statusFilter, page],
        queryFn: () => pharmacyAPI.getRecalls({ status: statusFilter || undefined, page, limit: 20 })
    });

    const { data: affectedSales, isLoading: loadingAffected } = useQuery({
        queryKey: ['pharmacy', 'recall-affected', selectedRecall?.id],
        queryFn: () => pharmacyAPI.getRecallAffectedSales(selectedRecall.id),
        enabled: !!selectedRecall?.id
    });

    const createMutation = useMutation({
        mutationFn: () => pharmacyAPI.createRecall(form),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'recalls'] });
            setShowForm(false);
            setForm({ medicationId: '', batchNumbers: [], reason: '', severity: 'voluntary', issuedBy: '', recallDate: new Date().toISOString().slice(0, 10), notes: '' });
            toast.success('Recall registado com sucesso');
        },
        onError: () => toast.error('Erro ao registar recall')
    });

    const resolveMutation = useMutation({
        mutationFn: () => pharmacyAPI.resolveRecall(resolveModal.id, resolveForm),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'recalls'] });
            setResolveModal(null);
            toast.success('Recall resolvido');
        },
        onError: () => toast.error('Erro ao resolver recall')
    });

    const records = data?.data || [];
    const addBatch = () => {
        const v = batchInput.trim();
        if (v && !form.batchNumbers.includes(v)) setForm(f => ({ ...f, batchNumbers: [...f.batchNumbers, v] }));
        setBatchInput('');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Recalls</h1>
                    <p className="text-gray-500 dark:text-gray-400">Recolha de lotes do mercado e rastreabilidade de pacientes afectados</p>
                </div>
                <Button onClick={() => setShowForm(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Registar Recall</Button>
            </div>

            {/* New Recall Form */}
            {showForm && (
                <Card padding="md" className="border-2 border-red-200 dark:border-red-800">
                    <h3 className="font-bold mb-4 text-red-700 dark:text-red-400 flex items-center gap-2">
                        <HiOutlineExclamationCircle className="w-5 h-5" />
                        Registar Novo Recall
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Select
                            label="Medicamento *"
                            value={form.medicationId}
                            onChange={e => setForm(f => ({ ...f, medicationId: e.target.value }))}
                            options={medications.map((m: any) => ({
                                value: m.id,
                                label: m.product?.name || 'S/ N'
                            }))}
                            placeholder="Seleccionar medicamento..."
                        />
                        <Select
                            label="Gravidade *"
                            value={form.severity}
                            onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                            options={[
                                { value: 'voluntary', label: 'Voluntária' },
                                { value: 'mandatory', label: 'Obrigatória' },
                                { value: 'urgent', label: 'Urgente' }
                            ]}
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Números de Lote Afectados *</label>
                            <div className="flex gap-2 mb-2">
                                <Input value={batchInput} onChange={e => setBatchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBatch()} placeholder="Ex: LT-2024-001" className="flex-1" />
                                <Button size="sm" onClick={addBatch}>Adicionar</Button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {form.batchNumbers.map(b => (
                                    <span key={b} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-mono">
                                        {b} <button onClick={() => setForm(f => ({ ...f, batchNumbers: f.batchNumbers.filter(x => x !== b) }))} className="ml-1">x</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <Input label="Entidade Emissora" value={form.issuedBy} onChange={e => setForm(f => ({ ...f, issuedBy: e.target.value }))} placeholder="INFARMED / Fabricante..." />
                        <Input label="Data do Recall" type="date" value={form.recallDate} onChange={e => setForm(f => ({ ...f, recallDate: e.target.value }))} />
                    </div>
                    <div className="mb-4">
                        <Textarea 
                            label="Motivo do Recall *"
                            rows={3}
                            value={form.reason}
                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            placeholder="Descreva o motivo do recall..."
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} variant="danger">Registar Recall</Button>
                        <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                    </div>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-2">
                {['', 'active', 'monitoring', 'resolved'].map(s => (
                    <Button 
                        key={s} 
                        variant={statusFilter === s ? 'primary' : 'secondary'}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        size="sm"
                        className={cn("rounded-lg", statusFilter === s ? "shadow-md" : "")}
                    >
                        {s === '' ? 'Todos' : s === 'active' ? 'Activos' : s === 'monitoring' ? 'Monitorização' : 'Resolvidos'}
                    </Button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recall List */}
                <Card padding="none">
                    {isLoading ? <div className="p-8 flex justify-center"><LoadingSpinner /></div> : (
                        <div className="divide-y dark:divide-dark-700">
                            {records.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <HiOutlineCheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>Nenhum recall registado</p>
                                </div>
                            ) : records.map((r: any) => (
                                <div key={r.id} className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors ${selectedRecall?.id === r.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                                    onClick={() => setSelectedRecall(r)}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <span className="font-mono text-xs text-gray-500">{r.recallNumber}</span>
                                            <p className="font-semibold">{r.medication?.product?.name}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Badge variant={SEVERITY_LABELS[r.severity]?.variant || 'default'}>{SEVERITY_LABELS[r.severity]?.label}</Badge>
                                            <Badge variant={r.status === 'resolved' ? 'success' : r.status === 'monitoring' ? 'warning' : 'danger'}>
                                                {r.status === 'resolved' ? 'Resolvido' : r.status === 'monitoring' ? 'Monitorização' : 'Activo'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2">{r.reason}</p>
                                    <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                                        <span>Lotes: {r.batchNumbers.join(', ')}</span>
                                        <span>{formatDate(r.recallDate)}</span>
                                    </div>
                                    {r.status === 'active' && (
                                        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={e => { e.stopPropagation(); setResolveModal(r); setResolveForm({ recoveredUnits: 0, actionTaken: '' }); }}>
                                            Marcar como Resolvido
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Affected Sales */}
                <Card padding="md">
                    {!selectedRecall ? (
                        <div className="flex items-center justify-center h-48 text-gray-400">
                            <div className="text-center">
                                <HiOutlineUsers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p>Seleccione um recall para ver os pacientes afectados</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <HiOutlineUsers className="w-5 h-5 text-primary-600" />
                                Pacientes Afectados - {selectedRecall.recallNumber}
                            </h3>
                            {loadingAffected ? <LoadingSpinner /> : (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {(affectedSales || []).length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <HiOutlineCheckCircle className="w-8 h-8 mx-auto mb-1" />
                                            <p>Nenhuma venda afectada encontrada</p>
                                        </div>
                                    ) : (affectedSales || []).map((sale: any) => (
                                        <div key={sale.id} className="border border-gray-200 dark:border-dark-700 rounded-lg p-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-sm">{sale.customer?.name || sale.customerName || 'Cliente Balcão'}</p>
                                                    {sale.customer?.phone && (
                                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <HiOutlinePhone className="w-3 h-3" /> {sale.customer.phone}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400">{formatDate(sale.createdAt)}</span>
                                            </div>
                                            <div className="mt-2 space-y-0.5">
                                                {sale.items.map((item: any) => (
                                                    <p key={item.id} className="text-xs text-gray-600">{item.quantity}x {item.productName}</p>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Card>
            </div>

            {/* Resolve Modal */}
            {resolveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-4">Resolver Recall {resolveModal.recallNumber}</h3>
                        <Input label="Unidades Recuperadas" type="number" value={resolveForm.recoveredUnits} onChange={e => setResolveForm(f => ({ ...f, recoveredUnits: Number(e.target.value) }))} min={0} className="mb-4" />
                        <div className="mb-4">
                            <Textarea 
                                label="Acção Tomada"
                                rows={3}
                                value={resolveForm.actionTaken}
                                onChange={e => setResolveForm(f => ({ ...f, actionTaken: e.target.value }))}
                                placeholder="Descreva as acções tomadas..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => resolveMutation.mutate()} isLoading={resolveMutation.isPending} leftIcon={<HiOutlineCheckCircle className="w-4 h-4" />}>Confirmar Resolução</Button>
                            <Button variant="outline" onClick={() => setResolveModal(null)}>Cancelar</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
