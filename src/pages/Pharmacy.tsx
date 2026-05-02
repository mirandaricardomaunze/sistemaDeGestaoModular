import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, Badge, Input, Select, Modal, ConfirmationModal, SmartTable, PageHeader } from '../components/ui';
import { pharmacyAPI } from '../services/api';
import { useProducts, useSuppliers, useCategories } from '../hooks/useData';
import toast from 'react-hot-toast';
import {
    HiOutlineBeaker,
    HiOutlineClipboardDocumentList as HiOutlineClipboardList,
    HiOutlineCube,
    HiOutlinePlus,
    HiOutlineShieldCheck,
    HiOutlinePencilSquare as HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineExclamationTriangle as HiOutlineExclamation,
    HiOutlineClock,
    HiOutlineArrowDownTray as HiOutlineDownload,
    HiOutlineArrowPath as HiOutlineRefresh
} from 'react-icons/hi2';
import { formatCurrency, formatDate, cn } from '../utils/helpers';
import { usePharmacy } from '../hooks/usePharmacy';
import { useDebounce } from '../hooks/useDebounce';
import { usePrescriptions } from '../hooks/usePrescriptions';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { useStore } from '../stores/useStore';
import { SegmentedControl } from '../components/common/SegmentedControl';
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
        page, limit: pageSize, search: useDebounce(search, 350),
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
                const prod: any = await addProduct({ name: productForm.name, code: productForm.code, price: parseFloat(productForm.price), costPrice: parseFloat(productForm.costPrice) || 0, unit: productForm.unit, originModule: 'pharmacy' });
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

    // ── Columns: Medications ──────────────────────────────────────────────────
    const medicationColumns = useMemo<ColumnDef<any, any>[]>(() => [
        {
            accessorKey: 'product.name',
            header: 'Medicamento',
            cell: (info: any) => (
                <div>
                    <div className="font-bold text-gray-900 dark:text-white uppercase tracking-tight text-xs">{info.getValue()}</div>
                    <div className="text-[10px] text-gray-400 font-mono tracking-tighter">{info.row.original.product?.code}</div>
                </div>
            )
        },
        {
            accessorKey: 'dci',
            header: 'DCI / Forma',
            cell: (info: any) => (
                <div className="hidden md:block">
                    <div className="text-gray-700 dark:text-gray-300 text-[11px] font-medium">{info.getValue() || ''}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">{info.row.original.pharmaceuticalForm} {info.row.original.dosage}</div>
                </div>
            )
        },
        {
            accessorKey: 'laboratory',
            header: 'Laboratório',
            cell: (info: any) => <span className="hidden lg:block text-gray-500 text-[11px] font-medium">{info.getValue() || ''}</span>
        },
        {
            accessorKey: 'totalStock',
            header: 'Stock',
            cell: (info: any) => (
                <div className="flex justify-center">
                    <span className={cn('inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-black border backdrop-blur-sm', alertColour(info.row.original.alertLevel))}>
                        {info.getValue()}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'nearestExpiry',
            header: 'Validade',
            cell: (info: any) => {
                const med = info.row.original;
                if (!info.getValue()) return <span className="text-gray-300">-</span>;
                return (
                    <div className="hidden sm:block">
                        <span className={cn('text-xs font-bold tracking-tighter', med.daysToExpiry !== null && med.daysToExpiry <= 30 ? 'text-red-500' : med.daysToExpiry !== null && med.daysToExpiry <= 90 ? 'text-amber-500' : 'text-gray-500')}>
                            {formatDate(info.getValue())}
                            {med.daysToExpiry !== null && med.daysToExpiry <= 90 && (
                                <span className="ml-1 text-[9px] opacity-70">({med.daysToExpiry}d)</span>
                            )}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'product.price',
            header: 'Preço',
            cell: (info: any) => <span className="font-black text-xs text-gray-900 dark:text-white tracking-tighter">{formatCurrency(info.getValue() || 0)}</span>
        },
        {
            id: 'flags',
            header: 'Flags',
            cell: ({ row }: any) => {
                const med = row.original;
                return (
                    <div className="flex items-center justify-center gap-1">
                        {med.requiresPrescription && <span title="Requer receita" className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[9px] font-black flex items-center justify-center">Rx</span>}
                        {med.isControlled && <span title="Substância controlada" className="w-5 h-5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-[9px] font-black flex items-center justify-center">C</span>}
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }: any) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)} className="text-gray-400 hover:text-primary-600 p-1.5 h-auto">
                        <HiOutlinePencil className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(row.original); setDeleteModal(true); }} className="text-gray-400 hover:text-red-600 p-1.5 h-auto">
                        <HiOutlineTrash className="w-4 h-4 text-red-500 dark:text-red-400" />
                    </Button>
                </div>
            )
        }
    ], []);

    // ── Columns: Stock ────────────────────────────────────────────────────────
    const movementColumns = useMemo<ColumnDef<any, any>[]>(() => [
        {
            accessorKey: 'createdAt',
            header: 'Data',
            cell: (info: any) => <span className="text-[11px] text-gray-500 font-mono">{formatDate(info.getValue())}</span>
        },
        {
            accessorKey: 'productName',
            header: 'Medicamento',
            cell: (info: any) => <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tight text-[11px]">{info.getValue() || info.row.original.product?.name}</span>
        },
        {
            accessorKey: 'type',
            header: 'Tipo',
            cell: (info: any) => {
                const type = info.getValue() || info.row.original.movementType;
                return (
                    <Badge variant={type === 'IN' ? 'success' : 'danger'} className="text-[9px] px-2 py-0.5">
                        {type === 'IN' ? 'Entrada' : 'Saída'}
                    </Badge>
                );
            }
        },
        {
            accessorKey: 'quantity',
            header: 'Qtd',
            cell: (info: any) => <span className="font-black text-sm text-gray-900 dark:text-white">{info.getValue()}</span>
        },
        {
            accessorKey: 'batchNumber',
            header: 'Lote',
            cell: (info: any) => <span className="font-mono text-[10px] text-gray-500 font-medium">{info.getValue() || ''}</span>
        },
        {
            accessorKey: 'reference',
            header: 'Referência',
            cell: (info: any) => <span className="text-[10px] text-gray-400 italic">{info.getValue() || info.row.original.reason || ''}</span>
        }
    ], []);

    // ── Columns: Prescriptions ───────────────────────────────────────────────
    const prescriptionColumns = useMemo<ColumnDef<any, any>[]>(() => [
        {
            accessorKey: 'prescriptionNumber',
            header: 'Nº Receita',
            cell: (info: any) => <span className="font-mono text-xs font-black text-primary-600 dark:text-primary-400">{info.getValue()}</span>
        },
        {
            accessorKey: 'patientName',
            header: 'Paciente',
            cell: (info: any) => (
                <div>
                    <div className="font-bold text-gray-900 dark:text-white uppercase tracking-tight text-xs">{info.getValue()}</div>
                    {info.row.original.patientPhone && <div className="text-[10px] text-gray-500 font-medium">{info.row.original.patientPhone}</div>}
                </div>
            )
        },
        { accessorKey: 'prescriberName', header: 'Médico', cell: (info: any) => <span className="text-[11px] text-gray-500 font-medium">{info.getValue() || ''}</span> },
        {
            accessorKey: 'prescriptionDate',
            header: 'Data',
            cell: (info: any) => <span className="text-xs text-gray-500 font-mono tracking-tighter">{formatDate(info.getValue())}</span>
        },
        {
            accessorKey: 'status',
            header: 'Estado',
            cell: (info: any) => {
                const status = info.getValue();
                return (
                    <Badge variant={status === 'dispensed' ? 'success' : status === 'expired' ? 'danger' : 'warning'} className="text-[9px] px-2 py-0.5">
                        {status === 'dispensed' ? 'Dispensado' : status === 'expired' ? 'Expirado' : 'Pendente'}
                    </Badge>
                );
            }
        },
        {
            id: 'items',
            header: 'Itens',
            cell: ({ row }: any) => (
                <div className="flex justify-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-dark-700 text-xs font-black text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-600">{row.original.items?.length || 0}</span>
                </div>
            )
        }
    ], []);

    // ── KPI strip ──────────────────────────────────────────────────────────────
    const kpis = [
        { label: 'Medicamentos', value: metrics.totalMedications, icon: HiOutlineBeaker, color: 'primary' },
        { label: 'Stock Baixo', value: metrics.lowStockItems, icon: HiOutlineExclamation, color: 'warning' },
        { label: 'A Expirar (90d)', value: metrics.expiringSoon, icon: HiOutlineClock, color: 'danger' },
        { label: 'Controlados', value: metrics.controlledItems, icon: HiOutlineShieldCheck, color: 'indigo' },
    ];

    const FILTER_TABS = [
        { id: 'all', label: 'Todos' },
        { id: 'lowStock', label: 'Stock Baixo' },
        { id: 'expiring', label: 'A Expirar' },
        { id: 'controlled', label: 'Controlados' },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Gestão de Medicamentos"
                subtitle="Inventário, lotes, stock e receitas médicas"
                icon={<HiOutlineBeaker />}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-10 px-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-primary-600 transition-all bg-slate-50/50 dark:bg-dark-800" leftIcon={<HiOutlineRefresh className={cn("w-4 h-4 text-primary-600", isLoading && "animate-spin")} />}>
                            Actualizar
                        </Button>
                        <Button variant="ghost" size="sm" leftIcon={<HiOutlineDownload className="w-4 h-4 text-primary-600 dark:text-primary-400" />} onClick={exportPDF} className="h-10 rounded-xl border border-gray-100 dark:border-dark-700 font-bold text-xs bg-white dark:bg-dark-900">PDF</Button>
                        {view === 'medications' && (
                            <Button size="sm" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => { resetMedForm(); setMedModal(true); }} className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary-500/20">Novo Medicamento</Button>
                        )}
                        {view === 'stock' && (
                            <Button size="sm" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => setBatchModal(true)} className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary-500/20">Entrada de Lote</Button>
                        )}
                    </div>
                }
            />

            {/* ── KPIs ────────────────────────────────────────────────────────-*/}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(k => (
                    <MetricCard
                        key={k.label}
                        label={k.label}
                        value={k.value ?? 0}
                        icon={<k.icon className="w-5 h-5" />}
                        color={k.color}
                    />
                ))}
            </div>

            {/* ── View toggle ────────────────────────────────────────────────── */}
            <SegmentedControl
                options={[
                    { value: 'medications', label: 'Medicamentos', icon: HiOutlineBeaker },
                    { value: 'stock', label: 'Stock / Lotes', icon: HiOutlineCube },
                    { value: 'prescriptions', label: 'Receitas', icon: HiOutlineClipboardList },
                ]}
                value={view}
                onChange={(val) => { setView(val as View); if (val === 'stock') loadMovements(1); }}
            />

            {/* ─────────────────────────────────────────────────────────────────────────
                VIEW: MEDICATIONS
            ───────────────────────────────────────────────────────────────────────── */}
            {view === 'medications' && (
                <SmartTable
                    data={medications}
                    columns={medicationColumns}
                    isLoading={isLoading}
                    search={{
                        value: search,
                        onChange: (val) => { setSearch(val); setPage(1); },
                        placeholder: "Pesquisar por nome, DCI, laboratório..."
                    }}
                    renderFilters={
                        <SegmentedControl
                            options={FILTER_TABS.map(f => ({ label: f.label, value: f.id }))}
                            value={filter}
                            onChange={(val) => { setFilter(val as any); setPage(1); }}
                            size="sm"
                        />
                    }
                    pagination={{
                        currentPage: page,
                        totalItems: medPag?.total || 0,
                        itemsPerPage: pageSize,
                        onPageChange: setPage
                    }}
                    onRefresh={refetch}
                    exportConfig={{
                        filename: 'medicamentos',
                        title: 'Inventário de Medicamentos',
                        columns: [
                            { key: 'product.code', header: 'Código', width: 15 },
                            { key: 'product.name', header: 'Medicamento', width: 30 },
                            { key: 'dci', header: 'DCI', width: 20 },
                            { key: 'pharmaceuticalForm', header: 'Forma', width: 15 },
                            { key: 'totalStock', header: 'Stock', format: 'number', width: 10, align: 'right' },
                            { key: 'product.price', header: 'Preço', format: 'currency', width: 15 },
                        ]
                    }}
                    emptyTitle="Nenhum medicamento encontrado"
                    onEmptyAction={() => { resetMedForm(); setMedModal(true); }}
                    emptyActionLabel="Novo Medicamento"
                />
            )}

            {/* ─────────────────────────────────────────────────────────────────────────
                VIEW: STOCK / LOTES
            ───────────────────────────────────────────────────────────────────────── */}
            {view === 'stock' && (
                <SmartTable
                    data={movements}
                    columns={movementColumns}
                    isLoading={movLoading}
                    pagination={{
                        currentPage: movPage,
                        totalItems: movPag?.total || 0,
                        itemsPerPage: 15,
                        onPageChange: (p) => { setMovPage(p); loadMovements(p); }
                    }}
                    onRefresh={() => loadMovements(1)}
                    exportConfig={{
                        filename: 'movimentacoes_farmacia',
                        title: 'Movimentações de Stock - Farmácia',
                        columns: [
                            { key: 'createdAt', header: 'Data', format: 'datetime', width: 18 },
                            { key: 'productName', header: 'Medicamento', width: 28 },
                            { key: 'type', header: 'Tipo', width: 12 },
                            { key: 'quantity', header: 'Quantidade', format: 'number', width: 12, align: 'right' },
                            { key: 'batchNumber', header: 'Lote', width: 15 },
                            { key: 'reference', header: 'Referência', width: 20 }
                        ]
                    }}
                />
            )}

            {/* ─────────────────────────────────────────────────────────────────────────
                VIEW: PRESCRIPTIONS
            ───────────────────────────────────────────────────────────────────────── */}
            {view === 'prescriptions' && (
                <SmartTable
                    data={prescriptions}
                    columns={prescriptionColumns}
                    isLoading={prescLoading}
                    search={{
                        value: prescSearch,
                        onChange: setPrescSearch,
                        placeholder: "Pesquisar receita, paciente..."
                    }}
                    pagination={{
                        currentPage: prescPage,
                        totalItems: prescPag?.total || 0,
                        itemsPerPage: 15,
                        onPageChange: setPrescPage
                    }}
                    emptyTitle="Nenhuma receita encontrada"
                />
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
