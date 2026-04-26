import { useState, useMemo } from 'react';
import { Card, Button, Badge, Input, Select, Modal, ConfirmationModal, Pagination, Skeleton } from '../components/ui';
import { pharmacyAPI } from '../services/api';
import { useProducts, useSuppliers, useCategories } from '../hooks/useData';
import toast from 'react-hot-toast';
import {
    HiOutlineBeaker, HiOutlineClipboardList, HiOutlineCube, HiOutlinePlus,
    HiOutlineShieldCheck, HiOutlinePencil, HiOutlineTrash,
    HiOutlineExclamation, HiOutlineClock, HiOutlineDownload,
    HiOutlineRefresh, HiOutlineSwitchHorizontal,
} from 'react-icons/hi';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { formatCurrency, formatDate, cn } from '../utils/helpers';
import { usePharmacy } from '../hooks/usePharmacy';
import { usePrescriptions } from '../hooks/usePrescriptions';
import { useStore } from '../stores/useStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type View = 'medications' | 'stock' | 'prescriptions';

// ──-Helper: Alert colour ──────────────────────────────────────────────────────
function alertColour(level: string) {
    if (level === 'critical') return 'text-red-600 bg-red-50 dark:bg-red-900/20';
    if (level === 'warning') return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
    return 'text-green-600 bg-green-50 dark:bg-green-900/20';
}

// ──-Main Page ────────────────────────────────────────────────────────────────-
export default function Pharmacy() {
    const { companySettings } = useStore();
    const [view, setView] = useState<View>('medications');

    // Medications
    const [page, setPage] = useState(1);
    const [pageSize] = useState(15);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'lowStock' | 'expiring' | 'controlled'>('all');

    const {
        medications: rawMeds, metrics, pagination: medPag,
        isLoading, addMedication, updateMedication, refetch, addBatch,
    } = usePharmacy({
        page, limit: pageSize, search,
        lowStock: filter === 'lowStock',
        expiringDays: filter === 'expiring' ? 90 : undefined,
        isControlled: filter === 'controlled' ? true : undefined,
    });

    const medications = useMemo(() => rawMeds, [rawMeds]);

    // Stock / Batch entry
    const [batchModal, setBatchModal] = useState(false);
    const [batchForm, setBatchForm] = useState({ medicationId: '', batchNumber: '', quantity: '', expiryDate: '', costPrice: '', sellingPrice: '' });

    // Add / Edit medication
    const [medModal, setMedModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selected, setSelected] = useState<any>(null);
    const [deleteModal, setDeleteModal] = useState(false);

    const [medForm, setMedForm] = useState({
        productId: '', dci: '', dosage: '', pharmaceuticalForm: 'Comprimido',
        laboratory: '', requiresPrescription: false, isControlled: false,
        storageTemp: 'Ambiente', storageLocation: '', atcCode: '',
        controlLevel: '', contraindications: '', sideEffects: '',
        activeIngredient: '', concentration: '',
    });
    const [productForm, setProductForm] = useState({ name: '', code: '', price: '', costPrice: '', unit: 'un' });

    const { addProduct } = useProducts();
    useSuppliers({ limit: 100 });
    useCategories();

    // Prescriptions
    const [prescPage, setPrescPage] = useState(1);
    const [prescSearch, setPrescSearch] = useState('');
    const { prescriptions, pagination: prescPag, isLoading: prescLoading } = usePrescriptions({ page: prescPage, limit: 15, search: prescSearch });

    // Movements (stock)
    const [movPage, setMovPage] = useState(1);
    const [movements, setMovements] = useState<any[]>([]);
    const [movPag, setMovPag] = useState<any>(null);
    const [movLoading, setMovLoading] = useState(false);

    const loadMovements = async (p = movPage) => {
        setMovLoading(true);
        try {
            const data = await pharmacyAPI.getStockMovements({ page: p, limit: 15 });
            setMovements(Array.isArray(data.data) ? data.data : []);
            setMovPag(data.pagination);
        } catch { toast.error('Erro ao carregar movimentos'); }
        finally { setMovLoading(false); }
    };

    // PDF export
    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text(companySettings?.companyName || 'Farmácia', 14, 15);
        doc.setFontSize(10);
        doc.text('Inventário de Medicamentos', 14, 22);
        autoTable(doc, {
            startY: 28,
            head: [['Código', 'Medicamento', 'DCI', 'Forma', 'Stock', 'Preço', 'Validade']],
            body: medications.map(m => [
                m.product?.code || '',
                m.product?.name || '',
                m.dci || '',
                m.pharmaceuticalForm || '',
                m.totalStock ?? 0,
                formatCurrency(m.product?.price || 0),
                m.nearestExpiry ? formatDate(m.nearestExpiry) : '',
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [99, 102, 241] },
        });
        doc.save(`medicamentos_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const openEdit = (med: any) => {
        setSelected(med);
        setMedForm({
            productId: med.productId, dci: med.dci || '', dosage: med.dosage || '',
            pharmaceuticalForm: med.pharmaceuticalForm || 'Comprimido', laboratory: med.laboratory || '',
            requiresPrescription: med.requiresPrescription, isControlled: med.isControlled,
            storageTemp: med.storageTemp || 'Ambiente', storageLocation: med.storageLocation || '',
            atcCode: med.atcCode || '', controlLevel: med.controlLevel || '',
            contraindications: med.contraindications || '', sideEffects: med.sideEffects || '',
            activeIngredient: med.activeIngredient || '', concentration: med.concentration || '',
        });
        setIsEditing(true);
        setMedModal(true);
    };

    const resetMedForm = () => {
        setMedForm({ productId: '', dci: '', dosage: '', pharmaceuticalForm: 'Comprimido', laboratory: '', requiresPrescription: false, isControlled: false, storageTemp: 'Ambiente', storageLocation: '', atcCode: '', controlLevel: '', contraindications: '', sideEffects: '', activeIngredient: '', concentration: '' });
        setProductForm({ name: '', code: '', price: '', costPrice: '', unit: 'un' });
        setIsEditing(false); setSelected(null);
    };

    const saveMedication = async () => {
        try {
            if (isEditing && selected) {
                await updateMedication(selected.id, medForm);
            } else {
                if (!productForm.name || !productForm.price) { toast.error('Nome e preço são obrigatórios'); return; }
                const prod: any = await addProduct({ name: productForm.name, code: productForm.code, price: parseFloat(productForm.price), costPrice: parseFloat(productForm.costPrice) || 0, unit: productForm.unit, origin_module: 'pharmacy' });
                await addMedication({ ...medForm, productId: prod.id });
            }
            setMedModal(false); resetMedForm();
        } catch (err: any) { toast.error(err?.message || 'Erro ao guardar medicamento'); }
    };

    const deleteMedication = async () => {
        if (!selected) return;
        try {
            await pharmacyAPI.deleteMedication(selected.id);
            toast.success('Medicamento eliminado');
            setDeleteModal(false); setSelected(null); refetch();
        } catch { toast.error('Erro ao eliminar'); }
    };

    const saveBatch = async () => {
        try {
            await addBatch({ ...batchForm, quantity: parseInt(batchForm.quantity), costPrice: parseFloat(batchForm.costPrice) || 0, sellingPrice: parseFloat(batchForm.sellingPrice) || 0 });
            setBatchModal(false);
            setBatchForm({ medicationId: '', batchNumber: '', quantity: '', expiryDate: '', costPrice: '', sellingPrice: '' });
            refetch();
        } catch (err: any) { /* error handled in hook */ }
    };

    // ── KPI strip ──────────────────────────────────────────────────────────────
    const kpis = [
        { label: 'Medicamentos', value: metrics.totalMedications, icon: HiOutlineBeaker, colour: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' },
        { label: 'Stock Baixo', value: metrics.lowStockItems, icon: HiOutlineExclamation, colour: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
        { label: 'A Expirar (90d)', value: metrics.expiringSoon, icon: HiOutlineClock, colour: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
        { label: 'Controlados', value: metrics.controlledItems, icon: HiOutlineShieldCheck, colour: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
    ];

    const FILTER_TABS = [
        { id: 'all', label: 'Todos' },
        { id: 'lowStock', label: 'Stock Baixo' },
        { id: 'expiring', label: 'A Expirar' },
        { id: 'controlled', label: 'Controlados' },
    ];

    return (
        <div className="space-y-5">
            {/* ── Header ──────────────────────────────────────────────────────-*/}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineBeaker className="w-6 h-6 text-primary-600 dark:text-primary-400" /> Gestão de Medicamentos
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Inventário, lotes, stock e receitas médicas</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" leftIcon={<HiOutlineDownload className="w-4 h-4 text-primary-600 dark:text-primary-400" />} onClick={exportPDF}>PDF</Button>
                    <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-4 h-4 text-primary-600 dark:text-primary-400" />} onClick={() => refetch()} />
                    {view === 'medications' && (
                        <Button size="sm" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => { resetMedForm(); setMedModal(true); }}>Novo Medicamento</Button>
                    )}
                    {view === 'stock' && (
                        <Button size="sm" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => setBatchModal(true)}>Entrada de Lote</Button>
                    )}
                </div>
            </div>

            {/* ── KPIs ────────────────────────────────────────────────────────-*/}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map(k => {
                    const Icon = k.icon;
                    return (
                        <Card key={k.label} padding="md">
                            <div className="flex items-center gap-3">
                                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', k.colour)}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{k.label}</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">{k.value ?? 0}</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* ── View toggle ────────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1 w-fit">
                {([
                    { id: 'medications', label: 'Medicamentos', icon: HiOutlineBeaker },
                    { id: 'stock', label: 'Stock / Lotes', icon: HiOutlineCube },
                    { id: 'prescriptions', label: 'Receitas', icon: HiOutlineClipboardList },
                ] as { id: View; label: string; icon: any }[]).map(t => {
                    const Icon = t.icon;
                    return (
                        <Button 
                            key={t.id} 
                            onClick={() => { setView(t.id); if (t.id === 'stock') loadMovements(1); }}
                            variant={view === t.id ? 'primary' : 'ghost'}
                            size="sm"
                            className={cn('flex items-center gap-2 rounded-lg text-sm font-medium transition-all px-4 py-2', view === t.id ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-400')}
                        >
                            <Icon className={cn("w-4 h-4", view === t.id ? "text-primary-600 dark:text-primary-400" : "text-gray-400")} />{t.label}
                        </Button>
                    );
                })}
            </div>

            {/* ─────────────────────────────────────────────────────────────────────────
                VIEW: MEDICATIONS
            ───────────────────────────────────────────────────────────────────────── */}
            {view === 'medications' && (
                <div className="space-y-4">
                    {/* Search + filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            placeholder="Pesquisar por nome, DCI, laboratório..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                            className="bg-white dark:bg-dark-800"
                        />
                        <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                            {FILTER_TABS.map(f => (
                                <button key={f.id} onClick={() => { setFilter(f.id as any); setPage(1); }}
                                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap', filter === f.id ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm' : 'text-gray-500')}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <Card padding="none">
                        {isLoading ? (
                            <div className="p-4 space-y-4 animate-pulse">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex gap-4 items-center">
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-1/4" />
                                            <Skeleton className="h-3 w-1/6" />
                                        </div>
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-8 w-8 rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Medicamento</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">DCI / Forma</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Laboratório</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Stock</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Validade</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Preço</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Flags</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-dark-700">
                                            {medications.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-12 text-center">
                                                        <HiOutlineBeaker className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                                        <p className="text-gray-400">Nenhum medicamento encontrado</p>
                                                        <button onClick={() => { resetMedForm(); setMedModal(true); }} className="mt-3 text-sm text-primary-600 hover:underline">+ Adicionar medicamento</button>
                                                    </td>
                                                </tr>
                                            ) : medications.map((med: any) => (
                                                <tr key={med.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-gray-900 dark:text-white">{med.product?.name}</div>
                                                        <div className="text-xs text-gray-500 font-mono">{med.product?.code}</div>
                                                    </td>
                                                    <td className="px-4 py-3 hidden md:table-cell">
                                                        <div className="text-gray-700 dark:text-gray-300">{med.dci || ''}</div>
                                                        <div className="text-xs text-gray-400">{med.pharmaceuticalForm} {med.dosage}</div>
                                                    </td>
                                                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">{med.laboratory || ''}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={cn('inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-bold', alertColour(med.alertLevel))}>
                                                            {med.totalStock}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 hidden sm:table-cell">
                                                        {med.nearestExpiry ? (
                                                            <span className={cn('text-xs font-medium', med.daysToExpiry !== null && med.daysToExpiry <= 30 ? 'text-red-600' : med.daysToExpiry !== null && med.daysToExpiry <= 90 ? 'text-amber-600' : 'text-gray-500')}>
                                                                {formatDate(med.nearestExpiry)}
                                                                {med.daysToExpiry !== null && med.daysToExpiry <= 90 && (
                                                                    <span className="ml-1 text-[10px]">({med.daysToExpiry}d)</span>
                                                                )}
                                                            </span>
                                                        ) : <span className="text-gray-400 text-xs">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                                        {formatCurrency(med.product?.price || 0)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {med.requiresPrescription && (
                                                                <span title="Requer receita" className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[9px] font-black flex items-center justify-center">Rx</span>
                                                            )}
                                                            {med.isControlled && (
                                                                <span title="Substância controlada" className="w-5 h-5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-[9px] font-black flex items-center justify-center">C</span>
                                                            )}
                                                            {med.alertLevel === 'critical' && (
                                                                <span title="Stock crítico" className="w-5 h-5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 text-[9px] font-black flex items-center justify-center">!</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => openEdit(med)} 
                                                                className="text-gray-400 hover:text-primary-600" 
                                                                title="Editar"
                                                            >
                                                                <HiOutlinePencil className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => { setSelected(med); setDeleteModal(true); }} 
                                                                className="text-gray-400 hover:text-red-600" 
                                                                title="Eliminar"
                                                            >
                                                                <HiOutlineTrash className="w-4 h-4 text-red-500 dark:text-red-400" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {medPag && medPag.total > 0 && (
                                    <div className="px-4 pb-2">
                                        <Pagination currentPage={page} totalItems={medPag.total} itemsPerPage={pageSize} onPageChange={setPage} />
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────
                VIEW: STOCK / LOTES
            ───────────────────────────────────────────────────────────────────────── */}
            {view === 'stock' && (
                <Card padding="none">
                    {movLoading ? (
                        <div className="p-4 space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <div className="space-y-2">
                                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                                        <tr>
                                            {['Data', 'Medicamento', 'Tipo', 'Quantidade', 'Lote', 'Referência'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {movements.length === 0 ? (
                                            <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                                <HiOutlineSwitchHorizontal className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                                <p>Nenhum movimento registado</p>
                                                <button onClick={() => setBatchModal(true)} className="mt-2 text-sm text-primary-600 hover:underline">+ Entrada de Lote</button>
                                            </td></tr>
                                        ) : movements.map((m: any) => (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                                                <td className="px-4 py-3 font-medium">{m.product?.name || m.productName || ''}</td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={m.type === 'IN' || m.movementType === 'IN' ? 'success' : 'danger'}>
                                                        {m.type === 'IN' || m.movementType === 'IN' ? 'Entrada' : 'Saída'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 font-bold">{m.quantity}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.batchNumber || ''}</td>
                                                <td className="px-4 py-3 text-xs text-gray-400">{m.reference || m.reason || ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {movPag && movPag.total > 0 && (
                                <div className="px-4 pb-2">
                                    <Pagination currentPage={movPage} totalItems={movPag.total} itemsPerPage={15}
                                        onPageChange={p => { setMovPage(p); loadMovements(p); }} />
                                </div>
                            )}
                        </>
                    )}
                </Card>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────
                VIEW: PRESCRIPTIONS
            ───────────────────────────────────────────────────────────────────────── */}
            {view === 'prescriptions' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Input
                            placeholder="Pesquisar receita, paciente..."
                            value={prescSearch}
                            onChange={e => setPrescSearch(e.target.value)}
                            leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                            className="max-w-sm bg-white dark:bg-dark-800"
                        />
                    </div>
                    <Card padding="none">
                        {prescLoading ? (
                            <div className="p-4 space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                                            <tr>
                                                {['Nº Receita', 'Paciente', 'Médico', 'Data', 'Estado', 'Itens'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-dark-700">
                                            {prescriptions.length === 0 ? (
                                                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                                    <HiOutlineClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                                    <p>Nenhuma receita encontrada</p>
                                                </td></tr>
                                            ) : prescriptions.map((p: any) => (
                                                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                                    <td className="px-4 py-3 font-mono text-xs font-bold">{p.prescriptionNumber}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{p.patientName}</div>
                                                        {p.patientPhone && <div className="text-xs text-gray-400">{p.patientPhone}</div>}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500">{p.prescriberName || ''}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(p.prescriptionDate)}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={p.status === 'dispensed' ? 'success' : p.status === 'expired' ? 'danger' : 'warning'}>
                                                            {p.status === 'dispensed' ? 'Dispensado' : p.status === 'expired' ? 'Expirado' : 'Pendente'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-dark-700 text-xs font-bold">{p.items?.length || 0}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {prescPag && prescPag.total > 0 && (
                                    <div className="px-4 pb-2">
                                        <Pagination currentPage={prescPage} totalItems={prescPag.total} itemsPerPage={15} onPageChange={setPrescPage} />
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────
                MODAL: Novo/Editar Medicamento
            ───────────────────────────────────────────────────────────────────────── */}
            <Modal isOpen={medModal} onClose={() => { setMedModal(false); resetMedForm(); }} title={isEditing ? 'Editar Medicamento' : 'Novo Medicamento'} size="xl">
                <div className="space-y-5">
                    {!isEditing && (
                        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                            <p className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase mb-3">Dados do Produto</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <Input label="Nome do Medicamento *" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Amoxicilina 500mg" />
                                </div>
                                <Input label="Código" value={productForm.code} onChange={e => setProductForm(f => ({ ...f, code: e.target.value }))} placeholder="Ex: MED-001" />
                                <Input label="Preço de Venda *" type="number" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} />
                                <Input label="Preço de Custo" type="number" value={productForm.costPrice} onChange={e => setProductForm(f => ({ ...f, costPrice: e.target.value }))} />
                                <Select label="Unidade" value={productForm.unit} onChange={e => setProductForm(f => ({ ...f, unit: e.target.value }))} options={[{ value: 'un', label: 'Unidade' }, { value: 'cx', label: 'Caixa' }, { value: 'fr', label: 'Frasco' }, { value: 'am', label: 'Ampola' }]} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input label="DCI (Substância Activa)" value={medForm.dci} onChange={e => setMedForm(f => ({ ...f, dci: e.target.value }))} placeholder="Ex: Amoxicilina" />
                        <Input label="Dosagem" value={medForm.dosage} onChange={e => setMedForm(f => ({ ...f, dosage: e.target.value }))} placeholder="Ex: 500mg" />
                        <Select label="Forma Farmacêutica" value={medForm.pharmaceuticalForm} onChange={e => setMedForm(f => ({ ...f, pharmaceuticalForm: e.target.value }))} options={[
                            'Comprimido', 'Cápsula', 'Xarope', 'Injectável', 'Pomada', 'Creme',
                            'Supositório', 'Gotas', 'Spray', 'Patch', 'Solução', 'Pó para Solução'
                        ].map(v => ({ value: v, label: v }))} />
                        <Input label="Laboratório" value={medForm.laboratory} onChange={e => setMedForm(f => ({ ...f, laboratory: e.target.value }))} />
                        <Input label="Princípio Activo" value={medForm.activeIngredient} onChange={e => setMedForm(f => ({ ...f, activeIngredient: e.target.value }))} />
                        <Input label="Concentração" value={medForm.concentration} onChange={e => setMedForm(f => ({ ...f, concentration: e.target.value }))} />
                        <Select label="Armazenamento" value={medForm.storageTemp} onChange={e => setMedForm(f => ({ ...f, storageTemp: e.target.value }))} options={[
                            { value: 'Ambiente', label: 'Temperatura Ambiente' },
                            { value: 'Refrigerado', label: 'Refrigerado (2 - 8°C)' },
                            { value: 'Congelado', label: 'Congelado' },
                            { value: 'Protegido da Luz', label: 'Protegido da Luz' },
                        ]} />
                        <Input label="Localização (prateleira)" value={medForm.storageLocation} onChange={e => setMedForm(f => ({ ...f, storageLocation: e.target.value }))} placeholder="Ex: A3-P2" />
                        <Input label="Código ATC" value={medForm.atcCode} onChange={e => setMedForm(f => ({ ...f, atcCode: e.target.value }))} placeholder="Ex: J01CA04" />
                    </div>

                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={medForm.requiresPrescription} onChange={e => setMedForm(f => ({ ...f, requiresPrescription: e.target.checked }))} className="w-4 h-4 rounded text-primary-600" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Requer Receita Médica</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={medForm.isControlled} onChange={e => setMedForm(f => ({ ...f, isControlled: e.target.checked }))} className="w-4 h-4 rounded text-primary-600" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Substância Controlada</span>
                        </label>
                    </div>

                    {medForm.isControlled && (
                        <Input label="Nível de Controlo" value={medForm.controlLevel} onChange={e => setMedForm(f => ({ ...f, controlLevel: e.target.value }))} placeholder="Ex: Psicotrópico Lista II" />
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                        <Button variant="ghost" onClick={() => { setMedModal(false); resetMedForm(); }}>Cancelar</Button>
                        <Button onClick={saveMedication}>{isEditing ? 'Actualizar' : 'Adicionar Medicamento'}</Button>
                    </div>
                </div>
            </Modal>

            {/* ─────────────────────────────────────────────────────────────────────────
                MODAL: Entrada de Lote
            ───────────────────────────────────────────────────────────────────────── */}
            <Modal isOpen={batchModal} onClose={() => setBatchModal(false)} title="Entrada de Lote" size="md">
                <div className="space-y-4">
                    <div>
                        <Select
                            label="Medicamento *"
                            value={batchForm.medicationId}
                            onChange={e => setBatchForm(f => ({ ...f, medicationId: e.target.value }))}
                            options={[
                                { value: '', label: 'Seleccionar medicamento...' },
                                ...medications.map((m: any) => ({
                                    value: m.id,
                                    label: `${m.product?.name} (${m.dosage})`
                                }))
                            ]}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nº Lote *" value={batchForm.batchNumber} onChange={e => setBatchForm(f => ({ ...f, batchNumber: e.target.value }))} placeholder="Ex: LT-2024-001" />
                        <Input label="Quantidade *" type="number" value={batchForm.quantity} onChange={e => setBatchForm(f => ({ ...f, quantity: e.target.value }))} min="1" />
                        <Input label="Data de Validade *" type="date" value={batchForm.expiryDate} onChange={e => setBatchForm(f => ({ ...f, expiryDate: e.target.value }))} />
                        <Input label="Preço de Custo" type="number" value={batchForm.costPrice} onChange={e => setBatchForm(f => ({ ...f, costPrice: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                        <Button variant="ghost" onClick={() => setBatchModal(false)}>Cancelar</Button>
                        <Button onClick={saveBatch} disabled={!batchForm.medicationId || !batchForm.batchNumber || !batchForm.quantity || !batchForm.expiryDate}>
                            Confirmar Entrada
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ─────────────────────────────────────────────────────────────────────────
                MODAL: Confirmar Eliminação
            ───────────────────────────────────────────────────────────────────────── */}
            <ConfirmationModal
                isOpen={deleteModal}
                onClose={() => { setDeleteModal(false); setSelected(null); }}
                onConfirm={deleteMedication}
                title="Eliminar Medicamento"
                message={`Tem a certeza que deseja eliminar "${selected?.product?.name}"? Esta acção não pode ser revertida.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </div>
    );
}
