import React, { useState, useMemo } from 'react';
import {
    HiOutlineDocumentCheck,
    HiOutlineExclamationTriangle,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineShieldCheck,
    HiOutlineExclamationCircle,
    HiOutlineXMark,
    HiOutlineCheckCircle,
    HiOutlinePencilSquare,
    HiOutlineIdentification,
    HiOutlineClipboardDocumentList,
    HiOutlineBriefcase,
} from 'react-icons/hi2';
import { Card, Button, Input, Badge, LoadingSpinner, Modal } from '../../ui';
import { useEmployees } from '../../../hooks/useData';
import { cn } from '../../../utils/helpers';
import { isBefore, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import type { Employee } from '../../../types';

type DocStatus = 'valid' | 'expiring' | 'expired' | 'missing';

interface CommercialDocs {
    bi?: { number?: string; expiry?: string };
    nuit?: { number?: string };
    contrato?: { type?: string; expiry?: string };
    cartaMotor?: { number?: string; expiry?: string };
    atestadoMedico?: { expiry?: string };
}

function parseDocs(notes?: string): CommercialDocs {
    if (!notes) return {};
    try { return JSON.parse(notes)?.commercialDocs ?? {}; } catch { return {}; }
}

function serializeDocs(notes?: string, docs?: CommercialDocs): string {
    let existing: Record<string, unknown> = {};
    try { existing = notes ? JSON.parse(notes) : {}; } catch { existing = {}; }
    return JSON.stringify({ ...existing, commercialDocs: docs });
}

function getStatus(expiry?: string): DocStatus {
    if (!expiry) return 'missing';
    const exp = new Date(expiry);
    const today = new Date();
    if (isBefore(exp, today)) return 'expired';
    if (isBefore(exp, addDays(today, 30))) return 'expiring';
    return 'valid';
}

function overallStatus(emp: Employee): DocStatus {
    if (!emp.contractExpiry) return 'missing';
    const exp = new Date(emp.contractExpiry);
    if (isBefore(exp, new Date())) return 'expired';
    if (isBefore(exp, addDays(new Date(), 30))) return 'expiring';
    return 'valid';
}

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: React.ReactNode; badge: any }> = {
    valid: { label: 'Válido', color: 'text-green-600', icon: <HiOutlineCheckCircle className="w-4 h-4" />, badge: 'success' },
    expiring: { label: 'A Expirar', color: 'text-amber-600', icon: <HiOutlineExclamationTriangle className="w-4 h-4" />, badge: 'warning' },
    expired: { label: 'Expirado', color: 'text-red-600', icon: <HiOutlineXMark className="w-4 h-4" />, badge: 'danger' },
    missing: { label: 'Em Falta', color: 'text-gray-400', icon: <HiOutlineExclamationCircle className="w-4 h-4" />, badge: 'gray' },
};

export const CommercialDocumentCenter: React.FC = () => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<DocStatus | 'all'>('all');
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editDocs, setEditDocs] = useState<CommercialDocs>({});
    const [saving, setSaving] = useState(false);

    const { employees: allEmp, isLoading, updateEmployee, refetch } = useEmployees({ limit: 200 });
    const employees = useMemo(() =>
        (allEmp || []).filter(e => !e.department || e.department === 'Comercial'),
        [allEmp]);

    const filtered = useMemo(() => {
        let list = employees.filter(e =>
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.code?.toLowerCase().includes(search.toLowerCase())
        );
        if (filter !== 'all') list = list.filter(e => overallStatus(e) === filter);
        return list;
    }, [employees, search, filter]);

    const summary = useMemo(() => ({
        valid: employees.filter(e => overallStatus(e) === 'valid').length,
        expiring: employees.filter(e => overallStatus(e) === 'expiring').length,
        expired: employees.filter(e => overallStatus(e) === 'expired').length,
        missing: employees.filter(e => overallStatus(e) === 'missing').length,
    }), [employees]);

    const openEdit = (emp: Employee) => {
        setSelectedEmp(emp);
        setEditDocs(parseDocs((emp as any).notes));
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedEmp) return;
        setSaving(true);
        try {
            await updateEmployee(selectedEmp.id, {
                notes: serializeDocs((selectedEmp as any).notes, editDocs)
            } as any);
            toast.success('Documentos actualizados');
            refetch();
            setIsModalOpen(false);
        } catch {
            toast.error('Erro ao guardar');
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) return <LoadingSpinner size="lg" className="h-64" />;

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* Summary Chips */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {([
                    { key: 'valid', label: 'Válidos', bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-700', border: 'border-green-200' },
                    { key: 'expiring', label: 'A Expirar', bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-700', border: 'border-amber-200' },
                    { key: 'expired', label: 'Expirados', bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-700', border: 'border-red-200' },
                    { key: 'missing', label: 'Em Falta', bg: 'bg-gray-50 dark:bg-gray-900/10', text: 'text-gray-700', border: 'border-gray-200' },
                ] as const).map(s => (
                    <button key={s.key}
                        onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
                        className={cn('p-4 rounded-lg border transition-all text-left', s.bg, s.border, filter === s.key ? 'ring-2 ring-offset-2 ring-primary-500' : '')}>
                        <p className={`text-2xl font-black ${s.text}`}>{summary[s.key]}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${s.text}`}>{s.label}</p>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input placeholder="Pesquisar colaborador..." className="pl-10 h-11" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={refetch} className="h-11 font-black text-[10px] uppercase tracking-widest">
                    Actualizar
                </Button>
            </div>

            {/* Employee Cards */}
            {filtered.length === 0 ? (
                <Card variant="glass" className="p-12 text-center text-gray-400 italic">Nenhum colaborador encontrado</Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(emp => {
                        const docs = parseDocs((emp as any).notes);
                        const status = overallStatus(emp);
                        const sc = STATUS_CONFIG[status];
                        const docItems = [
                            { label: 'BI / Passaporte', status: getStatus(docs.bi?.expiry), icon: <HiOutlineIdentification className="w-4 h-4" /> },
                            { label: 'Contrato', status: emp.contractExpiry ? getStatus(emp.contractExpiry) : 'missing' as DocStatus, icon: <HiOutlineClipboardDocumentList className="w-4 h-4" /> },
                            { label: 'Carta de Condução', status: getStatus(docs.cartaMotor?.expiry), icon: <HiOutlineBriefcase className="w-4 h-4" /> },
                            { label: 'Atestado Médico', status: getStatus(docs.atestadoMedico?.expiry), icon: <HiOutlineDocumentCheck className="w-4 h-4" /> },
                        ];

                        return (
                            <Card key={emp.id} variant="glass" className={cn('relative group overflow-hidden border-t-4 transition-all duration-300', {
                                'border-t-green-500': status === 'valid',
                                'border-t-amber-500': status === 'expiring',
                                'border-t-red-500': status === 'expired',
                                'border-t-gray-300': status === 'missing',
                            })}>
                                <div className="p-5 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-black text-lg flex-shrink-0">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-gray-900 dark:text-white truncate uppercase text-sm">{emp.name}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{emp.role || 'Comercial'} • {emp.code}</p>
                                        </div>
                                        <Badge variant={sc.badge} size="sm" className="flex-shrink-0">{sc.label.toUpperCase()}</Badge>
                                    </div>

                                    <div className="space-y-2">
                                        {docItems.map((d, i) => {
                                            const dsc = STATUS_CONFIG[d.status];
                                            return (
                                                <div key={i} className="flex items-center justify-between py-1">
                                                    <div className={cn('flex items-center gap-2 text-xs font-bold', dsc.color)}>
                                                        {d.icon}
                                                        <span>{d.label}</span>
                                                    </div>
                                                    <div className={cn('flex items-center gap-1 text-[10px] font-black uppercase tracking-wide', dsc.color)}>
                                                        {dsc.icon}
                                                        {dsc.label}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {emp.contractExpiry && (
                                        <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100 dark:border-dark-700/50">
                                            Contrato expira: <span className="font-black text-gray-600 dark:text-gray-300">{new Date(emp.contractExpiry).toLocaleDateString('pt-MZ')}</span>
                                        </div>
                                    )}

                                    <Button variant="outline" size="sm" className="w-full rounded-lg font-black text-[10px] uppercase tracking-widest mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        leftIcon={<HiOutlinePencilSquare className="w-4 h-4" />}
                                        onClick={() => openEdit(emp)}>
                                        Editar Documentos
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Documentos - ${selectedEmp?.name}`} size="lg">
                <div className="space-y-6 p-2">
                    {/* BI */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-dark-700/30 space-y-3">
                        <h5 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <HiOutlineIdentification className="w-4 h-4" /> BI / Passaporte
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Número</label>
                                <Input value={editDocs.bi?.number || ''} onChange={e => setEditDocs(d => ({ ...d, bi: { ...d.bi, number: e.target.value } }))} placeholder="Ex: 123456789B" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Validade</label>
                                <Input type="date" value={editDocs.bi?.expiry || ''} onChange={e => setEditDocs(d => ({ ...d, bi: { ...d.bi, expiry: e.target.value } }))} />
                            </div>
                        </div>
                    </div>

                    {/* NUIT */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-dark-700/30 space-y-3">
                        <h5 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <HiOutlineDocumentCheck className="w-4 h-4" /> NUIT
                        </h5>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Número NUIT</label>
                            <Input value={editDocs.nuit?.number || ''} onChange={e => setEditDocs(d => ({ ...d, nuit: { number: e.target.value } }))} placeholder="Ex: 123456789" />
                        </div>
                    </div>

                    {/* Carta de Condução */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-dark-700/30 space-y-3">
                        <h5 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <HiOutlineBriefcase className="w-4 h-4" /> Carta de Condução
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Número</label>
                                <Input value={editDocs.cartaMotor?.number || ''} onChange={e => setEditDocs(d => ({ ...d, cartaMotor: { ...d.cartaMotor, number: e.target.value } }))} placeholder="Ex: CC-12345" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Validade</label>
                                <Input type="date" value={editDocs.cartaMotor?.expiry || ''} onChange={e => setEditDocs(d => ({ ...d, cartaMotor: { ...d.cartaMotor, expiry: e.target.value } }))} />
                            </div>
                        </div>
                    </div>

                    {/* Atestado Médico */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-dark-700/30 space-y-3">
                        <h5 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <HiOutlineShieldCheck className="w-4 h-4" /> Atestado Médico
                        </h5>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Validade</label>
                            <Input type="date" value={editDocs.atestadoMedico?.expiry || ''} onChange={e => setEditDocs(d => ({ ...d, atestadoMedico: { expiry: e.target.value } }))} />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button variant="primary" className="flex-1 rounded-lg uppercase font-black text-[10px] tracking-widest" onClick={handleSave} disabled={saving}>
                            {saving ? 'A guardar"¦' : 'Guardar Alterações'}
                        </Button>
                        <Button variant="outline" className="flex-1 rounded-lg uppercase font-black text-[10px] tracking-widest" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
