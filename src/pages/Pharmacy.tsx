/**
 * Pharmacy Management System
 * Professional pharmacy module with POS, medications, stock, prescriptions, and reports
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Badge, LoadingSpinner, Modal, ConfirmationModal, Input, Select, TableContainer } from '../components/ui';
import { pharmacyAPI } from '../services/api';
import { useProducts, useSuppliers, useCategories } from '../hooks/useData';
import toast from 'react-hot-toast';
import {
    HiOutlineBeaker,
    HiOutlineClipboardList,
    HiOutlineCube,
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlineAdjustments,
    HiOutlineExclamation,
    HiOutlineClock,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineCalendar,
    HiOutlineHashtag,
    HiOutlineShieldCheck,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineSwitchHorizontal,
    HiOutlineViewGrid,
    HiOutlinePrinter,
    HiOutlineDownload,
    HiOutlineEye,
    HiOutlineCash,
    HiOutlineDocumentDownload,
    HiOutlineDocumentReport,
    HiOutlineChartBar,
} from 'react-icons/hi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/ui/Pagination';
import { formatCurrency, formatDate, formatDateTime, cn, exportToCSV } from '../utils/helpers';
import { usePharmacySales } from '../hooks/usePharmacySales';
import { useStore } from '../stores/useStore';
import PharmacyPartners from './pharmacy/PharmacyPartners';
import PharmacyAudit from './pharmacy/PharmacyAudit';
import PharmacyReports from './pharmacy/PharmacyReports';

type MainTab = 'medications' | 'stock' | 'prescriptions' | 'sales' | 'movements' | 'partners' | 'suppliers' | 'employees' | 'categories' | 'audit' | 'reports';

interface MedicationProduct {
    id: string;
    code: string;
    name: string;
    price: number;
    minStock: number;
    unit?: string;
    costPrice?: number;
    category?: string;
}

interface Medication {
    id: string;
    productId: string;
    dci: string;
    dosage: string;
    pharmaceuticalForm: string;
    laboratory: string;
    supplier?: string;
    requiresPrescription: boolean;
    isControlled: boolean;
    storageTemp: string;
    storageLocation?: string; // New: Shelf/Drawer
    atcCode: string;
    controlLevel: string;
    contraindications: string;
    sideEffects: string;
    activeIngredient: string;
    concentration: string;
    product: MedicationProduct;
    batches: any[];
    totalStock: number;
    nearestExpiry: string | null;
    isLowStock: boolean;
    daysToExpiry: number | null;
    alertLevel: 'critical' | 'warning' | 'normal';
}

import { usePharmacy } from '../hooks/usePharmacy';
import { usePrescriptions } from '../hooks/usePrescriptions';

export default function Pharmacy() {
    const navigate = useNavigate();
    const { companySettings } = useStore();
    const [activeTab, setActiveTab] = useState<MainTab>('medications');

    // Medications state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [medSearch, setMedSearch] = useState('');
    const [medFilter, setMedFilter] = useState<'all' | 'lowStock' | 'expiring' | 'controlled'>('all');
    const [advFilters, setAdvFilters] = useState({
        laboratory: '',
        category: '',
        requiresPrescription: 'all' as 'all' | 'yes' | 'no'
    });
    const [showFilters, setShowFilters] = useState(false);

    const {
        medications: rawMedications,
        batches,
        pagination: medPaginationMeta,
        metrics,
        isLoading: isPharmacyLoading,
        addMedication,
        updateMedication,
        refetch: fetchMedications
    } = usePharmacy({
        page,
        limit: pageSize,
        search: medSearch,
        lowStock: medFilter === 'lowStock',
        expiringDays: medFilter === 'expiring' ? 90 : undefined,
        isControlled: medFilter === 'controlled' ? true : undefined
    });

    // Apply advanced local filters
    const medications = useMemo(() => {
        return rawMedications.filter(med => {
            if (advFilters.laboratory && !med.laboratory?.toLowerCase().includes(advFilters.laboratory.toLowerCase())) return false;
            if (advFilters.category && med.product.category !== advFilters.category) return false;
            if (advFilters.requiresPrescription === 'yes' && !med.requiresPrescription) return false;
            if (advFilters.requiresPrescription === 'no' && med.requiresPrescription) return false;
            return true;
        });
    }, [rawMedications, advFilters]);

    const handleExportCSV = () => {
        const dataToExport = medications.map(med => ({
            'Nome': med.product.name,
            'DCI': med.dci,
            'Dosagem': med.dosage,
            'Forma': med.pharmaceuticalForm,
            'Laboratório': med.laboratory,
            'Stock': med.totalStock,
            'Preço': med.product.price,
            'Receita': med.requiresPrescription ? 'Sim' : 'Não',
            'Controlado': med.isControlled ? 'Sim' : 'Não'
        }));
        exportToCSV(dataToExport, `inventario_farmacia_${new Date().toISOString().split('T')[0]}`);
    };

    const handleExportExcel = () => {
        const dataToExport = medications.map(med => ({
            'Nome': med.product.name,
            'DCI': med.dci,
            'Dosagem': med.dosage,
            'Forma': med.pharmaceuticalForm,
            'Laboratório': med.laboratory,
            'Stock': med.totalStock,
            'Preço': med.product.price,
            'Receita': med.requiresPrescription ? 'Sim' : 'Não',
            'Controlado': med.isControlled ? 'Sim' : 'Não'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);

        // Add company info at the top
        XLSX.utils.sheet_add_aoa(ws, [
            [companySettings?.companyName || 'Empresa'],
            [`NUIT: ${companySettings?.taxId || ''}`],
            [`Endereço: ${companySettings?.address || ''}`],
            [''], // Spacer
        ], { origin: "A1" });

        // Move the original data down
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventário");
        XLSX.writeFile(wb, `inventario_farmacia_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const date = new Date().toLocaleDateString('pt-PT');
        const pageWidth = doc.internal.pageSize.width;

        doc.setFontSize(14);
        doc.text(companySettings?.companyName || 'Empresa', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`NUIT: ${companySettings?.taxId || ''} | ${companySettings?.address || ''}`, pageWidth / 2, 20, { align: 'center' });
        doc.text(`Email: ${companySettings?.email || ''} | Tel: ${companySettings?.phone || ''}`, pageWidth / 2, 24, { align: 'center' });

        doc.setFontSize(18);
        doc.setTextColor(0);
        doc.text('Inventário de Farmácia', 14, 35);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Data de Emissão: ${date}`, 14, 42);

        const tableData = medications.map(med => [
            med.product.code,
            med.product.name,
            med.laboratory,
            med.totalStock.toString(),
            formatCurrency(med.product.price),
            med.nearestExpiry ? formatDate(med.nearestExpiry) : '-'
        ]);

        autoTable(doc, {
            startY: 50,
            head: [['Código', 'Medicamento', 'Laboratório', 'Stock', 'Preço', 'Validade']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 8 },
        });

        doc.save(`inventario_farmacia_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handlePrintInventory = () => {
        window.print();
    };

    // Sales state
    const [salesPage, setSalesPage] = useState(1);
    const [salesPageSize, setSalesPageSize] = useState(10);

    const {
        sales,
        pagination: salesPagination,
        isLoading: isSalesLoading,
        refetch: fetchSales
    } = usePharmacySales({
        page: salesPage,
        limit: salesPageSize
    });

    // Prescriptions state
    const [prescPage, setPrescPage] = useState(1);
    const [prescPageSize, setPrescPageSize] = useState(10);
    const [prescSearch, setPrescSearch] = useState('');
    const [prescStatus, setPrescStatus] = useState<string | undefined>(undefined);

    const {
        prescriptions,
        pagination: prescPagination,
        isLoading: isPrescLoading,
        refetch: fetchPrescriptions,
        addPrescription
    } = usePrescriptions({
        page: prescPage,
        limit: prescPageSize,
        search: prescSearch,
        status: prescStatus
    });

    // Suppliers for selection
    const { suppliers } = useSuppliers({ limit: 100 });
    const { categories } = useCategories();

    // Movements state
    const [movements, setMovements] = useState<any[]>([]);
    const [isMovementsLoading, setIsMovementsLoading] = useState(false);
    const [movementsPage, setMovementsPage] = useState(1);
    const [movementsPageSize, setMovementsPageSize] = useState(10);
    const [movementsPagination, setMovementsPagination] = useState<any>(null); // Assuming pagination for movements

    const fetchMovements = async () => {
        try {
            setIsMovementsLoading(true);
            const data = await pharmacyAPI.getStockMovements({ page: movementsPage, limit: movementsPageSize });
            setMovements(Array.isArray(data.data) ? data.data : []);
            setMovementsPagination(data.pagination);
        } catch (error) {
            console.error('Error fetching movements:', error);
            toast.error('Erro ao carregar movimentos de stock.');
        } finally {
            setIsMovementsLoading(false);
        }
    };

    const location = useLocation();

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tab = queryParams.get('tab') as MainTab;
        const action = queryParams.get('action');
        const stateAction = (location.state as any)?.action;

        if (tab && ['medications', 'stock', 'prescriptions', 'sales', 'movements'].includes(tab)) {
            setActiveTab(tab);
        }

        // Handle action from state (preferred, doesn't persist on refresh)
        // or from URL (legacy/direct link, will be consumed)
        if (stateAction === 'new' || action === 'new' || action === 'new-medication') {
            setIsNewMedicationModalOpen(true);

            // If it came from URL, consume it
            if (action) {
                queryParams.delete('action');
                const newSearch = queryParams.toString();
                navigate({
                    pathname: location.pathname,
                    search: newSearch ? `?${newSearch}` : ''
                }, { replace: true, state: {} }); // Clear state as well after consuming
            } else if (stateAction) {
                // Clear state after opening to prevent re-opening on internal navigation
                navigate(location.pathname + location.search, { replace: true, state: {} });
            }
        }
    }, [location.search, location.state, navigate, location.pathname]);

    useEffect(() => {
        if (activeTab === 'sales') fetchSales();
        if (activeTab === 'prescriptions') fetchPrescriptions();
        if (activeTab === 'movements') fetchMovements();
    }, [activeTab, salesPage, salesPageSize, prescPage, prescPageSize, movementsPage, movementsPageSize]);


    // Modals
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    const [isNewMedicationModalOpen, setIsNewMedicationModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);

    // Stock Entry Form
    const [batchForm, setBatchForm] = useState({
        medicationId: '',
        batchNumber: '',
        quantity: '',
        expiryDate: '',
        costPrice: '',
        sellingPrice: '',
        supplier: '',
        invoiceNumber: ''
    });

    // Prescription Form
    const [prescriptionForm, setPrescriptionForm] = useState({
        patientName: '',
        patientPhone: '',
        patientBirthDate: '',
        patientAddress: '',
        prescriberName: '',
        prescriberCRM: '',
        facility: '',
        prescriptionDate: new Date().toISOString().split('T')[0],
        diagnosis: '',
        isControlled: false,
        notes: '',
        items: [] as any[]
    });

    const [newPrescItem, setNewPrescItem] = useState({
        medicationId: '',
        quantity: 1,
        dosage: '',
        frequency: '',
        duration: '',
        instructions: ''
    });

    // Medication Form State
    const [medicationForm, setMedicationForm] = useState({
        productId: '',
        dci: '',
        dosage: '',
        pharmaceuticalForm: 'Comprimido',
        laboratory: '',
        requiresPrescription: false,
        isControlled: false,
        storageTemp: 'Ambiente',
        storageLocation: '',
        atcCode: '',
        controlLevel: '',
        contraindications: '',
        sideEffects: '',
        activeIngredient: '',
        concentration: '',
        supplier: '',
        category: ''
    });

    // New Product Form State
    const [newProductForm, setNewProductForm] = useState({
        name: '',
        code: '',
        price: '',
        costPrice: '',
        category: '',
        unit: 'un',
        supplier: ''
    });

    // Products for new medication creation
    const { addProduct } = useProducts();



    const isLoading = isPharmacyLoading;

    const handleCreateOrUpdateMedication = async () => {
        try {
            let finalProductId = medicationForm.productId;

            // In "Professional Mode", if we are not editing, we always create the product first
            if (!isEditing) {
                if (!newProductForm.name || !newProductForm.price) {
                    toast.error('Preencha os campos obrigatórios do produto (Nome e Preço)');
                    return;
                }

                const createdProduct: any = await addProduct({
                    name: newProductForm.name,
                    code: newProductForm.code || '',
                    price: parseFloat(newProductForm.price),
                    costPrice: parseFloat(newProductForm.costPrice) || 0,
                    category: medicationForm.category || medicationForm.pharmaceuticalForm, // User choice or fallback
                    unit: newProductForm.unit,
                    manufacturer: medicationForm.supplier || '', // Use manufacturer for Product type
                    origin_module: 'pharmacy'
                });

                finalProductId = createdProduct.id;
            }

            if (!finalProductId) {
                toast.error('Erro ao identificar ou criar o produto base');
                return;
            }

            if (isEditing && selectedMedication) {
                await updateMedication(selectedMedication.id, medicationForm);
            } else {
                await addMedication({ ...medicationForm, productId: finalProductId });
            }

            setIsNewMedicationModalOpen(false);
            resetMedicationForm();
        } catch (error: unknown) {
            toast.error(error.message || 'Erro ao processar medicamento');
        }
    };

    const resetMedicationForm = () => {
        setMedicationForm({
            productId: '',
            dci: '',
            dosage: '',
            pharmaceuticalForm: 'Comprimido',
            laboratory: '',
            requiresPrescription: false,
            isControlled: false,
            storageTemp: 'Ambiente',
            storageLocation: '',
            atcCode: '',
            controlLevel: '',
            contraindications: '',
            sideEffects: '',
            activeIngredient: '',
            concentration: '',
            supplier: '',
            category: ''
        });
        setNewProductForm({
            name: '',
            code: '',
            price: '',
            costPrice: '',
            category: '',
            unit: 'un',
            supplier: ''
        });
        setIsEditing(false);
        setSelectedMedication(null);
    };

    const handleOpenEditModal = (medication: Medication) => {
        setSelectedMedication(medication);
        setMedicationForm({
            productId: medication.productId,
            dci: medication.dci || '',
            dosage: medication.dosage || '',
            pharmaceuticalForm: medication.pharmaceuticalForm || 'Comprimido',
            laboratory: medication.laboratory || '',
            requiresPrescription: medication.requiresPrescription,
            isControlled: medication.isControlled,
            storageTemp: medication.storageTemp || 'Ambiente',
            storageLocation: medication.storageLocation || '',
            atcCode: medication.atcCode || '',
            controlLevel: medication.controlLevel || '',
            contraindications: medication.contraindications || '',
            sideEffects: medication.sideEffects || '',
            activeIngredient: medication.activeIngredient || '',
            concentration: medication.concentration || '',
            supplier: medication.supplier || '',
            category: medication.product.category || ''
        });
        setIsEditing(true);
        setIsNewMedicationModalOpen(true);
    };

    const handleDeleteMedication = async () => {
        if (!selectedMedication) return;
        try {
            await pharmacyAPI.deleteMedication(selectedMedication.id);
            toast.success('Medicamento eliminado com sucesso!');
            setIsDeleteModalOpen(false);
            setSelectedMedication(null);
            fetchMedications();
        } catch (error: unknown) {
            toast.error(error.message || 'Erro ao eliminar medicamento');
        }
    };






    const tabs = [
        { id: 'medications', label: 'Medicamentos', icon: <HiOutlineBeaker className="w-5 h-5" /> },
        { id: 'stock', label: 'Stock', icon: <HiOutlineCube className="w-5 h-5" /> },
        { id: 'prescriptions', label: 'Receitas', icon: <HiOutlineClipboardList className="w-5 h-5" /> },
        { id: 'sales', label: 'Vendas', icon: <HiOutlineCash className="w-5 h-5" /> },
        { id: 'movements', label: 'Movimentos', icon: <HiOutlineSwitchHorizontal className="w-5 h-5" /> },
        { id: 'partners', label: 'Parceiros/Seguros', icon: <HiOutlineShieldCheck className="w-5 h-5" /> },
        { id: 'reports', label: 'Relatórios', icon: <HiOutlineChartBar className="w-5 h-5" /> },
        { id: 'audit', label: 'Auditoria/SARR', icon: <HiOutlineDocumentReport className="w-5 h-5" /> },
    ];

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                <LoadingSpinner size="xl" />
                <p className="mt-4 text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Iniciando sistema de farmácia...</p>
            </div>
        );
    }



    return (
        <div className="space-y-6 px-2 pt-6 pb-6 md:px-6">
            {/* Header with Responsive Tabs */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <HiOutlineBeaker className="w-7 h-7 text-primary-600" />
                            Gestão de Farmácia
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Controle de Medicamentos, Stock, Receitas e Vendas</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-5 h-5" />} onClick={() => { fetchMedications(); if (activeTab === 'sales') fetchSales(); if (activeTab === 'movements') fetchMovements(); }}>Actualizar</Button>
                        {activeTab === 'medications' && (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<HiOutlineDownload className="w-5 h-5" />}
                                    onClick={handleExportCSV}
                                >
                                    Exportar
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<HiOutlineDocumentDownload className="w-5 h-5" />}
                                    onClick={handleExportExcel}
                                    title="Exportar para Excel"
                                >
                                    Excel
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<HiOutlineDocumentReport className="w-5 h-5 text-red-500" />}
                                    onClick={handleExportPDF}
                                    title="Exportar para PDF"
                                >
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<HiOutlinePrinter className="w-5 h-5" />}
                                    onClick={handlePrintInventory}
                                >
                                    Imprimir
                                </Button>
                                <Button
                                    size="sm"
                                    leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                                    onClick={() => {
                                        setIsEditing(false);
                                        setIsNewMedicationModalOpen(true);
                                    }}
                                >
                                    Novo Medicamento
                                </Button>
                            </div>
                        )}
                        {activeTab === 'stock' && (
                            <Button size="sm" leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => setIsBatchModalOpen(true)}>Entrada de Lote</Button>
                        )}
                        {activeTab === 'prescriptions' && (
                            <Button size="sm" leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => setIsPrescriptionModalOpen(true)}>Nova Receita</Button>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="mt-6 border-b border-gray-100 dark:border-dark-700">
                    <div className="flex flex-wrap -mb-px">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as MainTab)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-2 md:px-6 py-4 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap uppercase tracking-wider",
                                    activeTab === tab.id
                                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                )}
                            >
                                <span className="shrink-0">{tab.icon}</span>
                                <span className="hidden sm:inline-block">{tab.label}</span>
                                <span className="sm:hidden text-[10px]">{tab.label.substring(0, 3)}...</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {/* MEDICATIONS TAB */}
                {activeTab === 'medications' && (
                    <div className="space-y-6">
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="p-4 border-l-4 border-primary-500">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600">
                                        <HiOutlineBeaker className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Medicamentos</p>
                                        <p className="text-xl font-bold">{metrics.totalMedications}</p>
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-4 border-l-4 border-amber-500">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg text-amber-600">
                                        <HiOutlineExclamation className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Baixo Stock</p>
                                        <p className="text-xl font-bold">{metrics.lowStockItems}</p>
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-4 border-l-4 border-red-500">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-lg text-red-600">
                                        <HiOutlineClock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">A Expirar (90D)</p>
                                        <p className="text-xl font-bold">{metrics.expiringSoon}</p>
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-4 border-l-4 border-indigo-500">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600">
                                        <HiOutlineShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Controlados</p>
                                        <p className="text-xl font-bold">{metrics.controlledItems}</p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Search & Filter */}
                        <div className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700 space-y-4 shadow-sm">
                            <div className="flex flex-wrap gap-4 items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                                    <div className="relative flex-1">
                                        <Input
                                            placeholder="Pesquisar por nome, DCI ou código..."
                                            value={medSearch}
                                            onChange={(e) => setMedSearch(e.target.value)}
                                            leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                            className="w-full"
                                        />
                                    </div>
                                    <Button
                                        variant={showFilters ? 'primary' : 'outline'}
                                        size="sm"
                                        leftIcon={<HiOutlineAdjustments className="w-5 h-5" />}
                                        onClick={() => setShowFilters(!showFilters)}
                                    >
                                        Filtros Avancados
                                    </Button>
                                </div>
                                <div className="flex bg-gray-100 dark:bg-dark-700 p-1 rounded-lg">
                                    {['all', 'lowStock', 'expiring', 'controlled'].map(filter => (
                                        <button
                                            key={filter}
                                            onClick={() => setMedFilter(filter as any)}
                                            className={cn(
                                                "px-4 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider",
                                                medFilter === filter
                                                    ? "bg-white dark:bg-dark-800 text-primary-600 shadow-sm"
                                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                            )}
                                        >
                                            {filter === 'all' ? 'Todos' :
                                                filter === 'lowStock' ? 'Stock Baixo' :
                                                    filter === 'expiring' ? 'Validade' : 'Controlados'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Advanced Filters Panel */}
                            {showFilters && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl border border-dashed border-gray-200 dark:border-dark-600 animate-in slide-in-from-top-2 duration-300">
                                    <Input
                                        label="Laboratório"
                                        placeholder="Filtrar por laboratório..."
                                        value={advFilters.laboratory}
                                        onChange={(e) => setAdvFilters({ ...advFilters, laboratory: e.target.value })}
                                        size="sm"
                                    />
                                    <Select
                                        label="Categoria"
                                        value={advFilters.category}
                                        onChange={(e) => setAdvFilters({ ...advFilters, category: e.target.value })}
                                        options={[
                                            { value: '', label: 'Todas as Categorias' },
                                            ...categories.map(c => ({ value: c.name, label: c.name }))
                                        ]}
                                        size="sm"
                                    />
                                    <Select
                                        label="Requer Receita"
                                        value={advFilters.requiresPrescription}
                                        onChange={(e) => setAdvFilters({ ...advFilters, requiresPrescription: e.target.value as any })}
                                        options={[
                                            { value: 'all', label: 'Todos' },
                                            { value: 'yes', label: 'Sim' },
                                            { value: 'no', label: 'Não' }
                                        ]}
                                        size="sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Medications Table */}
                        <Card className="p-0 overflow-hidden">
                            <TableContainer
                                isLoading={isPharmacyLoading}
                                isEmpty={medications.length === 0}
                                emptyTitle="Nenhum medicamento encontrado"
                                emptyDescription="Tente ajustar seus filtros ou termos de busca."
                                minHeight="600px"
                            >
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                        <tr className="text-xs text-gray-500 uppercase">
                                            <th className="px-6 py-3 text-left">Medicamento</th>
                                            <th className="px-6 py-3 text-left">Forma Farmacêutica</th>
                                            <th className="px-6 py-3 text-center">Receita</th>
                                            <th className="px-6 py-3 text-right">Stock</th>
                                            <th className="px-6 py-3 text-center">Validade</th>
                                            <th className="px-6 py-3 text-right">Preço</th>
                                            <th className="px-6 py-3 text-center">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {medications.map(med => (
                                            <tr key={med.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-semibold text-gray-900 dark:text-white">{med.product.name}</p>
                                                    <p className="text-xs text-gray-500">{med.dci} - {med.dosage}</p>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{med.pharmaceuticalForm}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge variant={med.requiresPrescription ? 'danger' : 'success'}>
                                                        {med.requiresPrescription ? 'Requer Receita' : 'Livre'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={cn(
                                                            "font-bold",
                                                            med.isLowStock ? "text-red-500" : "text-gray-700 dark:text-gray-300"
                                                        )}>
                                                            {med.totalStock} un
                                                        </span>
                                                        {med.isLowStock && (
                                                            <span className="text-[10px] text-red-500 font-bold uppercase">Stock Baixo</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {med.nearestExpiry ? (
                                                        <Badge variant="outline">
                                                            {formatDate(med.nearestExpiry)}
                                                        </Badge>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(Number(med.product.price))}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            className="text-primary-600 hover:text-primary-700"
                                                            title="Ver Detalhes"
                                                            onClick={() => {
                                                                setSelectedMedication(med);
                                                                setIsDetailModalOpen(true);
                                                            }}
                                                        >
                                                            <HiOutlineEye className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            className="text-blue-600 hover:text-blue-700"
                                                            onClick={() => handleOpenEditModal(med)}
                                                        >
                                                            <HiOutlinePencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            className="text-red-600 hover:text-red-700"
                                                            onClick={() => {
                                                                setSelectedMedication(med);
                                                                setIsDeleteModalOpen(true);
                                                            }}
                                                        >
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>

                            {/* Pagination Controls */}
                            <Pagination
                                currentPage={page}
                                totalItems={medPaginationMeta?.total || 0}
                                itemsPerPage={pageSize}
                                onPageChange={setPage}
                                onItemsPerPageChange={(size) => {
                                    setPageSize(size);
                                    setPage(1);
                                }}
                                className="p-4 bg-white dark:bg-dark-800"
                            />
                        </Card>
                    </div>
                )
                }

                {/* STOCK TAB - DETAILED BATCH MANAGEMENT */}
                {activeTab === 'stock' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Summary Metrics for Stock */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 border-l-4 border-amber-500 bg-amber-50/30 dark:bg-amber-900/10">
                                <h3 className="font-bold flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-200">
                                    <HiOutlineExclamation className="w-5 h-5" />
                                    Alertas de Stock Crítico
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {medications.filter(m => m.isLowStock).length > 0 ? (
                                        medications.filter(m => m.isLowStock).map(med => (
                                            <div key={med.id} className="flex justify-between items-center p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-amber-100 dark:border-amber-900/30">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{med.product.name}</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Mínimo: {med.product.minStock} un</p>
                                                </div>
                                                <Badge variant="danger" className="text-xs">{med.totalStock} un</Badge>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                                            <HiOutlineCheck className="w-8 h-8 opacity-20 mb-2" />
                                            <p className="text-sm">Stock em níveis normais</p>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <Card className="p-6 border-l-4 border-red-500 bg-red-50/30 dark:bg-red-900/10">
                                <h3 className="font-bold flex items-center gap-2 mb-4 text-red-800 dark:text-red-200">
                                    <HiOutlineClock className="w-5 h-5" />
                                    Produtos a Expirar (90 dias)
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {medications.filter(m => m.daysToExpiry !== null && m.daysToExpiry <= 90).length > 0 ? (
                                        medications.filter(m => m.daysToExpiry !== null && m.daysToExpiry <= 90).map(med => (
                                            <div key={med.id} className="flex justify-between items-center p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-red-100 dark:border-red-900/30">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{med.product.name}</span>
                                                    <p className="text-[10px] text-red-600 font-bold uppercase">{med.daysToExpiry} dias restantes</p>
                                                </div>
                                                <Badge variant={med.daysToExpiry! <= 30 ? 'danger' : 'warning'}>
                                                    {formatDate(med.nearestExpiry!)}
                                                </Badge>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                                            <HiOutlineCheck className="w-8 h-8 opacity-20 mb-2" />
                                            <p className="text-sm">Nenhum produto próximo da validade</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Full Batches Table */}
                        <Card className="p-0 overflow-hidden border border-gray-100 dark:border-dark-700">
                            <div className="bg-gray-50 dark:bg-dark-700/50 px-6 py-4 border-b border-gray-100 dark:border-dark-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <HiOutlineCube className="w-5 h-5 text-primary-600" />
                                        Rastreabilidade de Lotes
                                    </h3>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Controlo individual por validade e quantidade</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="xs" variant="outline" leftIcon={<HiOutlineRefresh className="w-4 h-4" />} onClick={() => fetchMedications()}>Actualizar Lista</Button>
                                    <Button size="xs" leftIcon={<HiOutlinePlus className="w-4 h-4" />} onClick={() => setIsBatchModalOpen(true)}>Nova Entrada</Button>
                                </div>
                            </div>
                            <TableContainer
                                isLoading={isPharmacyLoading}
                                isEmpty={batches.length === 0}
                                emptyTitle="Nenhum lote registrado"
                                emptyDescription="Não há lotes disponíveis no sistema no momento."
                                minHeight="600px"
                            >
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700/30">
                                        <tr className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                            <th className="px-6 py-4 text-left">Número do Lote</th>
                                            <th className="px-6 py-4 text-left">Medicamento</th>
                                            <th className="px-6 py-4 text-center">Data de Validade</th>
                                            <th className="px-6 py-4 text-right">Qtd. Disponível</th>
                                            <th className="px-6 py-4 text-center">Estado</th>
                                            <th className="px-6 py-4 text-left">Localização</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {batches.map(batch => {
                                            const daysLeft = batch.expiryDate ? Math.ceil((new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null;
                                            const isExpired = daysLeft !== null && daysLeft <= 0;
                                            const isWarning = daysLeft !== null && daysLeft <= 90;

                                            return (
                                                <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors text-sm">
                                                    <td className="px-6 py-4 font-mono font-bold text-primary-600">{batch.batchNumber}</td>
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold">{medications.find(m => m.id === batch.medicationId)?.product.name || 'Desconhecido'}</p>
                                                        <p className="text-[10px] text-gray-400">ID: {batch.id.substring(0, 8)}...</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={cn(
                                                            "font-medium",
                                                            isExpired ? "text-red-500 line-through" : isWarning ? "text-amber-500" : "text-gray-700 dark:text-gray-300"
                                                        )}>
                                                            {formatDate(batch.expiryDate)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold tabular-nums">
                                                        {batch.quantityAvailable} un
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <Badge variant={isExpired ? 'danger' : isWarning ? 'warning' : 'success'}>
                                                            {isExpired ? 'Expirado' : isWarning ? 'A Expirar' : 'Válido'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs bg-gray-100 dark:bg-dark-700 px-2 py-1 rounded text-gray-600 dark:text-gray-400 font-mono">
                                                            {medications.find(m => m.id === batch.medicationId)?.storageLocation || 'N/A'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </TableContainer>
                        </Card>
                    </div>
                )}



                {/* SALES TAB */}
                {activeTab === 'sales' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <Card className="p-0 overflow-hidden">
                            <TableContainer
                                isLoading={isSalesLoading}
                                isEmpty={sales.length === 0}
                                emptyTitle="Nenhuma venda encontrada"
                                emptyDescription="Não foram encontradas vendas registradas."
                                minHeight="600px"
                            >
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                        <tr className="text-xs text-gray-500 uppercase">
                                            <th className="px-6 py-3 text-left">Número</th>
                                            <th className="px-6 py-3 text-left">Data</th>
                                            <th className="px-6 py-3 text-left">Cliente</th>
                                            <th className="px-6 py-3 text-right">Itens</th>
                                            <th className="px-6 py-3 text-right">Total</th>
                                            <th className="px-6 py-3 text-center">Status</th>
                                            <th className="px-6 py-3 text-center">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {sales.map(sale => (
                                            <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors text-sm">
                                                <td className="px-6 py-4 font-mono font-medium">{sale.saleNumber}</td>
                                                <td className="px-6 py-4 text-gray-500">{formatDate(sale.createdAt)}</td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium">{sale.customerName || sale.customer?.name || 'Cliente Balcão'}</p>
                                                    {(sale.customer?.phone) && <p className="text-xs text-gray-400">{sale.customer.phone}</p>}
                                                </td>
                                                <td className="px-6 py-4 text-right">{sale.items?.length || 0}</td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(Number(sale.total))}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge variant={sale.status === 'completed' ? 'success' : 'warning'}>
                                                        {sale.status === 'completed' ? 'Concluída' : sale.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="primary"
                                                            size="xs"
                                                            className="text-[10px] uppercase font-bold tracking-tighter"
                                                            onClick={() => {
                                                                navigate(`/invoices?search=${sale.saleNumber}&open=true`);
                                                            }}
                                                        >
                                                            Gerar Fatura
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>

                            <Pagination
                                currentPage={salesPage}
                                totalItems={salesPagination?.total || 0}
                                itemsPerPage={salesPageSize}
                                onPageChange={setSalesPage}
                                onItemsPerPageChange={(size) => {
                                    setSalesPageSize(size);
                                    setSalesPage(1);
                                }}
                                className="p-4 bg-white dark:bg-dark-800"
                            />
                        </Card>
                    </div>
                )}

                {/* PRESCRIPTIONS TAB */}
                {activeTab === 'prescriptions' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4 items-center">
                            <Input
                                placeholder="Pesquisar por paciente, médico ou nº..."
                                value={prescSearch}
                                onChange={(e) => setPrescSearch(e.target.value)}
                                leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                className="w-96"
                            />
                            <Select
                                value={prescStatus || ''}
                                onChange={(e) => setPrescStatus(e.target.value || undefined)}
                                options={[
                                    { value: '', label: 'Todos os Status' },
                                    { value: 'pending', label: 'Pendente' },
                                    { value: 'completed', label: 'Concluída' },
                                    { value: 'cancelled', label: 'Cancelada' }
                                ]}
                                className="w-48"
                            />
                        </div>

                        {/* Table */}
                        <Card className="p-0 overflow-hidden">
                            <TableContainer
                                isLoading={isPrescLoading}
                                isEmpty={prescriptions.length === 0}
                                emptyTitle="Nenhuma receita encontrada"
                                emptyDescription="Não foram encontradas receitas médicas para os filtros selecionados."
                                minHeight="600px"
                            >
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                        <tr className="text-xs text-gray-500 uppercase tracking-wider">
                                            <th className="px-6 py-3 text-left">Nº Receita</th>
                                            <th className="px-6 py-3 text-left">Paciente</th>
                                            <th className="px-6 py-3 text-left">Prescritor</th>
                                            <th className="px-6 py-3 text-center">Data</th>
                                            <th className="px-6 py-3 text-center">Status</th>
                                            <th className="px-6 py-3 text-center">Itens</th>
                                            <th className="px-6 py-3 text-center">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {prescriptions.map(presc => (
                                            <tr key={presc.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors text-sm">
                                                <td className="px-6 py-4 font-mono font-medium text-primary-600">{presc.prescriptionNo}</td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-gray-900 dark:text-white">{presc.patientName}</p>
                                                    {presc.patientPhone && <p className="text-xs text-gray-500">{presc.patientPhone}</p>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium">{presc.prescriberName}</p>
                                                    {presc.prescriberCRM && <p className="text-xs text-gray-400">CRM: {presc.prescriberCRM}</p>}
                                                </td>
                                                <td className="px-6 py-4 text-center text-gray-500">{formatDate(presc.prescriptionDate)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge variant={
                                                        presc.status === 'completed' ? 'success' :
                                                            presc.status === 'pending' ? 'warning' : 'danger'
                                                    }>
                                                        {presc.status === 'completed' ? 'Concluída' :
                                                            presc.status === 'pending' ? 'Pendente' : 'Cancelada'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-center font-medium">{presc.items?.length || 0}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button variant="ghost" size="xs" onClick={() => navigate(`/pharmacy/prescriptions/${presc.id}`)}>
                                                            <HiOutlineSearch className="w-4 h-4" />
                                                        </Button>
                                                        {presc.status === 'pending' && (
                                                            <Button
                                                                variant="primary"
                                                                size="xs"
                                                                onClick={() => {
                                                                    // Logical jump to POS with this prescription
                                                                    toast('Navegando para o PDV com a receita selecionada...', {
                                                                        icon: 'â„¹ï¸',
                                                                    });
                                                                }}
                                                            >
                                                                Vender
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>

                            <Pagination
                                currentPage={prescPage}
                                totalItems={prescPagination?.total || 0}
                                itemsPerPage={prescPageSize}
                                onPageChange={setPrescPage}
                                onItemsPerPageChange={(size) => {
                                    setPrescPageSize(size);
                                    setPrescPage(1);
                                }}
                                className="p-4 bg-white dark:bg-dark-800"
                            />
                        </Card>
                    </div>
                )}

                {/* MOVEMENTS TAB (AUDIT LOG) */}
                {activeTab === 'movements' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <Card className="p-0 overflow-hidden border border-gray-100 dark:border-dark-700">
                            <div className="bg-gray-50 dark:bg-dark-700/50 px-6 py-4 border-b border-gray-100 dark:border-dark-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <HiOutlineSwitchHorizontal className="w-5 h-5 text-indigo-600" />
                                        Histórico de Movimentação de Stock
                                    </h3>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Audit log completo de todas as entradas e saídas</p>
                                </div>
                                <Button size="xs" variant="outline" leftIcon={<HiOutlineRefresh className="w-4 h-4" />} onClick={fetchMovements}>
                                    Actualizar
                                </Button>
                            </div>
                            <TableContainer
                                isLoading={isMovementsLoading}
                                isEmpty={movements.length === 0}
                                emptyTitle="Nenhum movimento registrado"
                                emptyDescription="Não há registros de movimentação de stock para exibir."
                                minHeight="600px"
                            >
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700/30">
                                        <tr className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                            <th className="px-6 py-3 text-left">Data/Hora</th>
                                            <th className="px-6 py-3 text-left">Lote</th>
                                            <th className="px-6 py-3 text-left">Tipo</th>
                                            <th className="px-6 py-3 text-right">Qtd.</th>
                                            <th className="px-6 py-3 text-left">Motivo / Documento</th>
                                            <th className="px-6 py-3 text-left">Utilizador</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {movements.map(mov => (
                                            <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors text-sm">
                                                <td className="px-6 py-4 text-gray-500">{formatDateTime(mov.createdAt)}</td>
                                                <td className="px-6 py-4 font-mono font-bold text-xs">{mov.batch?.batchNumber || 'N/A'}</td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={
                                                        mov.type === 'in' ? 'success' :
                                                            mov.type === 'out' ? 'danger' :
                                                                mov.type === 'adjustment' ? 'warning' : 'info'
                                                    }>
                                                        {mov.type === 'in' ? 'ENTRADA' :
                                                            mov.type === 'out' ? 'SAÍDA' :
                                                                mov.type === 'adjustment' ? 'AJUSTE' : mov.type}
                                                    </Badge>
                                                </td>
                                                <td className={cn(
                                                    "px-6 py-4 text-right font-bold tabular-nums",
                                                    mov.type === 'in' ? "text-green-600" : "text-red-600"
                                                )}>
                                                    {mov.type === 'in' ? '+' : '-'}{Math.abs(mov.quantity)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-xs">{mov.reason || 'Sem descrição'}</p>
                                                    {mov.reference && <p className="text-[10px] text-gray-400">Ref: {mov.reference}</p>}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 text-xs">
                                                    {mov.user?.name || 'Sistema'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>
                            <Pagination
                                currentPage={movementsPage}
                                totalItems={movementsPagination?.total || 0}
                                itemsPerPage={movementsPageSize}
                                onPageChange={setMovementsPage}
                                onItemsPerPageChange={(size) => {
                                    setMovementsPageSize(size);
                                    setMovementsPage(1);
                                }}
                                className="p-4 bg-white dark:bg-dark-800"
                            />
                        </Card>
                    </div>
                )}

                {activeTab === 'partners' && (
                    <div className="animate-in fade-in duration-500">
                        <PharmacyPartners />
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="animate-in fade-in duration-500">
                        <PharmacyReports />
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div className="animate-in fade-in duration-500">
                        <PharmacyAudit />
                    </div>
                )}
            </div >

            {/* Batch Entry Modal */}
            <Modal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                title="Entrada de Lote / Stock"
                size="md"
            >
                <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    if (!batchForm.medicationId || !batchForm.batchNumber || !batchForm.quantity) {
                        toast.error('Preencha os campos obrigatórios');
                        return;
                    }
                    try {
                        await pharmacyAPI.createBatch({
                            medicationId: batchForm.medicationId,
                            batchNumber: batchForm.batchNumber,
                            quantity: parseInt(batchForm.quantity),
                            expiryDate: batchForm.expiryDate,
                            costPrice: parseFloat(batchForm.costPrice) || 0,
                            sellingPrice: parseFloat(batchForm.sellingPrice) || 0,
                            supplier: batchForm.supplier,
                            invoiceNumber: batchForm.invoiceNumber
                        });
                        toast.success('Lote adicionado com sucesso!');
                        setIsBatchModalOpen(false);
                        setBatchForm({ medicationId: '', batchNumber: '', quantity: '', expiryDate: '', costPrice: '', sellingPrice: '', supplier: '', invoiceNumber: '' });
                        fetchMedications();
                        fetchMovements(); // Refetch movements after adding a batch
                    } catch (error: unknown) {
                        toast.error(error.message || 'Erro ao adicionar lote');
                    }
                }}>
                    <Select
                        label="Medicamento *"
                        value={batchForm.medicationId}
                        onChange={(e) => setBatchForm({ ...batchForm, medicationId: e.target.value })}
                        options={[{ value: '', label: 'Selecione...' }, ...medications.map(m => ({ value: m.id, label: m.product.name }))]}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Número do Lote *"
                            value={batchForm.batchNumber}
                            onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                            placeholder="Ex: L-2024-001"
                            leftIcon={<HiOutlineHashtag className="w-4 h-4 text-gray-400" />}
                            required
                        />
                        <Input
                            label="Quantidade *"
                            type="number"
                            value={batchForm.quantity}
                            onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                            min={1}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data de Validade *"
                            type="date"
                            value={batchForm.expiryDate}
                            onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                            leftIcon={<HiOutlineCalendar className="w-4 h-4 text-gray-400" />}
                            required
                        />
                        <Input
                            label="Preço de Custo"
                            type="number"
                            step="0.01"
                            value={batchForm.costPrice}
                            onChange={(e) => setBatchForm({ ...batchForm, costPrice: e.target.value })}
                            placeholder="MT"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Preço de Venda"
                            type="number"
                            step="0.01"
                            value={batchForm.sellingPrice}
                            onChange={(e) => setBatchForm({ ...batchForm, sellingPrice: e.target.value })}
                            placeholder="MT"
                        />
                        <Input
                            label="Fornecedor"
                            value={batchForm.supplier}
                            onChange={(e) => setBatchForm({ ...batchForm, supplier: e.target.value })}
                            placeholder="Nome do fornecedor"
                        />
                    </div>
                    <Input
                        label="Nº Factura/Guia"
                        value={batchForm.invoiceNumber}
                        onChange={(e) => setBatchForm({ ...batchForm, invoiceNumber: e.target.value })}
                        placeholder="Referência do documento"
                    />
                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="outline"
                            className="flex-1"
                            type="button"
                            onClick={() => setIsBatchModalOpen(false)}
                            leftIcon={<HiOutlineX className="w-4 h-4" />}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                        >
                            Guardar Lote
                        </Button>
                    </div>
                </form>
            </Modal >

            {/* Prescription Modal */}
            <Modal
                isOpen={isPrescriptionModalOpen}
                onClose={() => setIsPrescriptionModalOpen(false)}
                title="Nova Receita Médica"
                size="lg"
            >
                <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    if (!prescriptionForm.patientName || !prescriptionForm.prescriberName) {
                        toast.error('Nome do paciente e prescritor são obrigatórios');
                        return;
                    }
                    try {
                        await addPrescription({
                            patientName: prescriptionForm.patientName,
                            patientPhone: prescriptionForm.patientPhone,
                            patientBirthDate: prescriptionForm.patientBirthDate || undefined,
                            patientAddress: prescriptionForm.patientAddress,
                            prescriberName: prescriptionForm.prescriberName,
                            prescriberCRM: prescriptionForm.prescriberCRM,
                            facility: prescriptionForm.facility,
                            prescriptionDate: prescriptionForm.prescriptionDate,
                            diagnosis: prescriptionForm.diagnosis,
                            isControlled: prescriptionForm.isControlled,
                            notes: prescriptionForm.notes,
                            items: prescriptionForm.items
                        });
                        setIsPrescriptionModalOpen(false);
                        setPrescriptionForm({
                            patientName: '',
                            patientPhone: '',
                            patientBirthDate: '',
                            patientAddress: '',
                            prescriberName: '',
                            prescriberCRM: '',
                            facility: '',
                            prescriptionDate: new Date().toISOString().split('T')[0],
                            diagnosis: '',
                            isControlled: false,
                            notes: '',
                            items: []
                        });
                        fetchPrescriptions();
                    } catch (error: unknown) {
                        // Error handled by hook
                    }
                }}>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Dados do Paciente</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Nome do Paciente *"
                            value={prescriptionForm.patientName}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, patientName: e.target.value })}
                            placeholder="Nome completo"
                            required
                        />
                        <Input
                            label="Telefone"
                            value={prescriptionForm.patientPhone}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, patientPhone: e.target.value })}
                            placeholder="+258 84 000 0000"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data de Nascimento"
                            type="date"
                            value={prescriptionForm.patientBirthDate}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, patientBirthDate: e.target.value })}
                        />
                        <Input
                            label="Endereço"
                            value={prescriptionForm.patientAddress}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, patientAddress: e.target.value })}
                            placeholder="Morada do paciente"
                        />
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mt-4">
                        <p className="text-sm text-green-700 dark:text-green-300 font-medium">Dados do Prescritor</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Nome do Médico *"
                            value={prescriptionForm.prescriberName}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, prescriberName: e.target.value })}
                            placeholder="Dr(a). Nome"
                            required
                        />
                        <Input
                            label="Nº de Registo / CRM"
                            value={prescriptionForm.prescriberCRM}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, prescriberCRM: e.target.value })}
                            placeholder="Ordem dos Médicos"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Unidade Sanitária"
                            value={prescriptionForm.facility}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, facility: e.target.value })}
                            placeholder="Hospital/Clínica"
                        />
                        <Input
                            label="Data da Receita"
                            type="date"
                            value={prescriptionForm.prescriptionDate}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, prescriptionDate: e.target.value })}
                            leftIcon={<HiOutlineCalendar className="w-4 h-4 text-gray-400" />}
                        />
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mt-4 flex items-center justify-between">
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Itens da Receita</p>
                        <Button
                            type="button"
                            size="xs"
                            variant="primary"
                            onClick={() => {
                                if (!newPrescItem.medicationId) {
                                    toast.error('Selecione um medicamento');
                                    return;
                                }
                                const med = medications.find(m => m.id === newPrescItem.medicationId);
                                setPrescriptionForm({
                                    ...prescriptionForm,
                                    items: [...prescriptionForm.items, { ...newPrescItem, name: med?.product.name }]
                                });
                                setNewPrescItem({ medicationId: '', quantity: 1, dosage: '', frequency: '', duration: '', instructions: '' });
                            }}
                        >
                            <HiOutlinePlus className="w-4 h-4 mr-1" /> Adicionar Item
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 border dark:border-dark-600 rounded-lg">
                        <Select
                            label="Medicamento"
                            value={newPrescItem.medicationId}
                            onChange={(e) => setNewPrescItem({ ...newPrescItem, medicationId: e.target.value })}
                            options={[{ value: '', label: 'Selecione...' }, ...medications.map(m => ({ value: m.id, label: m.product.name }))]}
                        />
                        <Input
                            label="Quantidade"
                            type="number"
                            value={newPrescItem.quantity}
                            onChange={(e) => setNewPrescItem({ ...newPrescItem, quantity: parseInt(e.target.value) })}
                        />
                        <Input
                            label="Posologia (ex: 12/12h)"
                            value={newPrescItem.frequency}
                            onChange={(e) => setNewPrescItem({ ...newPrescItem, frequency: e.target.value })}
                        />
                    </div>

                    {prescriptionForm.items.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {prescriptionForm.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-700 rounded border dark:border-dark-600 text-xs shadow-sm">
                                    <span className="font-bold flex-1">{item.name}</span>
                                    <span className="px-2 border-x dark:border-dark-600 mx-2">{item.quantity} un</span>
                                    <span className="italic flex-1">{item.frequency}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newItems = [...prescriptionForm.items];
                                            newItems.splice(idx, 1);
                                            setPrescriptionForm({ ...prescriptionForm, items: newItems });
                                        }}
                                        className="text-red-500 hover:text-red-700 ml-2"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mt-4">
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Informações Adicionais</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Diagnóstico"
                            value={prescriptionForm.diagnosis}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                            placeholder="CID ou descritivo"
                        />
                        <div className="flex flex-col justify-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={prescriptionForm.isControlled}
                                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, isControlled: e.target.checked })}
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Substância Controlada
                                </span>
                            </label>
                        </div>
                    </div>
                    <Input
                        label="Observações / Notas do Farmacêutico"
                        value={prescriptionForm.notes}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                        placeholder="Notas adicionais"
                    />

                    <div className="flex gap-3 pt-4 border-t dark:border-dark-600">
                        <Button
                            variant="outline"
                            className="flex-1"
                            type="button"
                            onClick={() => setIsPrescriptionModalOpen(false)}
                            leftIcon={<HiOutlineX className="w-4 h-4" />}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                        >
                            Guardar Receita
                        </Button>
                    </div>
                </form>
            </Modal >

            {/* Medication Modal (New/Edit) */}
            <Modal
                isOpen={isNewMedicationModalOpen}
                onClose={() => {
                    setIsNewMedicationModalOpen(false);
                    resetMedicationForm();
                }}
                title={isEditing ? "Editar Medicamento" : "Novo Medicamento"}
                size="xl"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Section: Identity & Commercial */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-primary-700 dark:text-primary-400 border-b pb-2 flex items-center gap-2">
                                <HiOutlineViewGrid className="w-5 h-5" /> Identificação e Comercial
                            </h4>

                            <Input
                                label="Nome do Medicamento *"
                                value={isEditing ? selectedMedication?.product.name : newProductForm.name}
                                onChange={(e) => isEditing ? null : setNewProductForm({ ...newProductForm, name: e.target.value })}
                                disabled={isEditing}
                                placeholder="Ex: Amoxicilina 500mg"
                                required
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Código (SKU)"
                                    value={isEditing ? selectedMedication?.product.code : newProductForm.code}
                                    onChange={(e) => isEditing ? null : setNewProductForm({ ...newProductForm, code: e.target.value })}
                                    disabled={isEditing}
                                    placeholder="Ex: MED-001"
                                />
                                <Input
                                    label="Unidade"
                                    value={isEditing ? selectedMedication?.product.unit : newProductForm.unit}
                                    onChange={(e) => isEditing ? null : setNewProductForm({ ...newProductForm, unit: e.target.value })}
                                    disabled={isEditing}
                                    placeholder="Ex: un, cx, fco"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Categoria"
                                    value={medicationForm.category}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, category: e.target.value })}
                                    options={[
                                        { value: '', label: 'Auto (Pela Forma)' },
                                        ...categories.map(c => ({ value: c.name, label: c.name }))
                                    ]}
                                />
                                <Select
                                    label="Fornecedor Principal"
                                    value={medicationForm.supplier}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, supplier: e.target.value })}
                                    options={[
                                        { value: '', label: 'Seleccionar...' },
                                        ...suppliers.map(s => ({ value: s.name, label: s.name }))
                                    ]}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Preço de Venda (MT) *"
                                    type="number"
                                    value={isEditing ? selectedMedication?.product.price : newProductForm.price}
                                    onChange={(e) => isEditing ? null : setNewProductForm({ ...newProductForm, price: e.target.value })}
                                    disabled={isEditing}
                                    placeholder="0.00"
                                    required
                                />
                                <Input
                                    label="Preço de Custo (MT)"
                                    type="number"
                                    value={isEditing ? selectedMedication?.product.costPrice : newProductForm.costPrice}
                                    onChange={(e) => isEditing ? null : setNewProductForm({ ...newProductForm, costPrice: e.target.value })}
                                    disabled={isEditing}
                                />
                            </div>
                        </div>

                        {/* Section: Clinical details */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-accent-700 dark:text-accent-400 border-b pb-2 flex items-center gap-2">
                                <HiOutlineBeaker className="w-5 h-5" /> Informação Farmacêutica
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="DCI (Princípio Activo)"
                                    value={medicationForm.dci}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, dci: e.target.value })}
                                    placeholder="Ex: Paracetamol"
                                />
                                <Input
                                    label="Dosagem"
                                    value={medicationForm.dosage}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                                    placeholder="Ex: 500mg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Forma Farmacêutica"
                                    value={medicationForm.pharmaceuticalForm}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, pharmaceuticalForm: e.target.value })}
                                    options={[
                                        { value: 'Comprimido', label: 'Comprimido' },
                                        { value: 'Cápsula', label: 'Cápsula' },
                                        { value: 'Xarope', label: 'Xarope' },
                                        { value: 'Injetável', label: 'Injetável' },
                                        { value: 'Pomada', label: 'Pomada' },
                                        { value: 'Gotas', label: 'Gotas' }
                                    ]}
                                />
                                <Input
                                    label="Laboratório"
                                    value={medicationForm.laboratory}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, laboratory: e.target.value })}
                                />
                            </div>
                            <Input
                                label="Código ATC"
                                value={medicationForm.atcCode}
                                onChange={(e) => setMedicationForm({ ...medicationForm, atcCode: e.target.value })}
                                placeholder="Classificação ATC"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t dark:border-dark-700">
                        {/* Clinical flags */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <HiOutlineShieldCheck className="w-5 h-5" /> Segurança e Controlo
                            </h4>
                            <div className="flex gap-4 items-center h-12 px-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl border border-gray-100 dark:border-dark-600">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={medicationForm.requiresPrescription}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, requiresPrescription: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-medium group-hover:text-primary-600 transition-colors">Requer Receita</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={medicationForm.isControlled}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, isControlled: e.target.checked })}
                                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                    />
                                    <span className="text-sm font-medium group-hover:text-red-600 transition-colors">Controlado / Psicotrópico</span>
                                </label>
                            </div>
                            {medicationForm.isControlled && (
                                <Input
                                    label="Nível de Controlo"
                                    value={medicationForm.controlLevel}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, controlLevel: e.target.value })}
                                    placeholder="Ex: Lista A1, B1..."
                                />
                            )}
                        </div>

                        {/* Storage */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <HiOutlineCube className="w-5 h-5" /> Armazenamento
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Temperatura"
                                    value={medicationForm.storageTemp}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, storageTemp: e.target.value })}
                                    options={[
                                        { value: 'Ambiente', label: 'Ambiente (15-30Â°C)' },
                                        { value: 'Frio', label: 'Frio (2-8Â°C)' },
                                        { value: 'Congelado', label: 'Congelado (-20Â°C)' }
                                    ]}
                                />
                                <Input
                                    label="Localização"
                                    value={medicationForm.storageLocation}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, storageLocation: e.target.value })}
                                    placeholder="Ex: A1-SEC2"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <Input
                            label="Contra-indicações"
                            value={medicationForm.contraindications}
                            onChange={(e) => setMedicationForm({ ...medicationForm, contraindications: e.target.value })}
                            placeholder="Descreva contra-indicações importantes"
                        />
                        <Input
                            label="Efeitos Secundários"
                            value={medicationForm.sideEffects}
                            onChange={(e) => setMedicationForm({ ...medicationForm, sideEffects: e.target.value })}
                            placeholder="Efeitos colaterais comuns"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t dark:border-dark-700">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setIsNewMedicationModalOpen(false);
                                resetMedicationForm();
                            }}
                            leftIcon={<HiOutlineX className="w-4 h-4" />}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateOrUpdateMedication}
                            className="px-10 py-6 text-lg"
                            leftIcon={<HiOutlineCheck className="w-5 h-5" />}
                        >
                            {isEditing ? 'Guardar Alterações' : 'Finalizar Registro'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Medication Details Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title="Detalhes do Medicamento"
                size="xl"
            >
                {selectedMedication && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start border-b dark:border-dark-700 pb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                    {selectedMedication.product.name}
                                </h2>
                                <p className="text-sm text-gray-500 font-medium">
                                    {selectedMedication.product.code} | {selectedMedication.dci} {selectedMedication.dosage}
                                </p>
                            </div>
                            <Badge variant={selectedMedication.requiresPrescription ? 'danger' : 'success'} size="md">
                                {selectedMedication.requiresPrescription ? 'Requer Receita' : 'Venda Livre'}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase text-gray-400 tracking-widest border-l-2 border-primary-500 pl-2">Informação Geral</h3>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                    <div className="text-xs text-gray-500 uppercase">Forma:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.pharmaceuticalForm}</div>

                                    <div className="text-xs text-gray-500 uppercase">Laboratório:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.laboratory || '-'}</div>

                                    <div className="text-xs text-gray-500 uppercase">Princípio Activo:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.activeIngredient || selectedMedication.dci}</div>

                                    <div className="text-xs text-gray-500 uppercase">Concentração:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.concentration || selectedMedication.dosage}</div>

                                    <div className="text-xs text-gray-500 uppercase">Categoria:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.product.category || '-'}</div>

                                    <div className="text-xs text-gray-500 uppercase">Código ATC:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.atcCode || '-'}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase text-gray-400 tracking-widest border-l-2 border-amber-500 pl-2">Stock e Armazenamento</h3>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                    <div className="text-xs text-gray-500 uppercase">Stock Total:</div>
                                    <div className={cn("text-sm font-bold", selectedMedication.isLowStock ? "text-red-500" : "text-green-600")}>
                                        {selectedMedication.totalStock} {selectedMedication.product.unit || 'un'}
                                    </div>

                                    <div className="text-xs text-gray-500 uppercase">Preço Venda:</div>
                                    <div className="text-sm font-bold text-primary-600">{formatCurrency(selectedMedication.product.price)}</div>

                                    <div className="text-xs text-gray-500 uppercase">Localização:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.storageLocation || '-'}</div>

                                    <div className="text-xs text-gray-500 uppercase">Temperatura:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.storageTemp}</div>

                                    <div className="text-xs text-gray-500 uppercase">Próximo Venc:</div>
                                    <div className="text-sm font-semibold">{selectedMedication.nearestExpiry ? formatDate(selectedMedication.nearestExpiry) : '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t dark:border-dark-700">
                            <h3 className="font-bold text-sm uppercase text-gray-400 tracking-widest border-l-2 border-red-500 pl-2">Informações Clínicas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 dark:bg-dark-700/50 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase mb-1">Contra-indicações:</p>
                                    <p className="text-sm italic">{selectedMedication.contraindications || 'Nenhuma informação registrada.'}</p>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-dark-700/50 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase mb-1">Efeitos Secundários:</p>
                                    <p className="text-sm italic">{selectedMedication.sideEffects || 'Nenhuma informação registrada.'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setIsDetailModalOpen(false)}>Fechar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Printable Inventory Report (Hidden from Screen, Visible in Print) */}
            <div id="printable-inventory" className="hidden-screen-only">
                <div className="p-8 space-y-8 bg-white text-black font-serif">
                    {/* Report Header */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-6">
                        <div>
                            <h1 className="text-3xl font-bold uppercase tracking-tight">{companySettings?.companyName || 'Inventário de Farmácia'}</h1>
                            <p className="text-sm mt-1 text-gray-700">{companySettings?.address || 'Módulo de Farmácia'}</p>
                            <p className="text-xs text-gray-500">NUIT: {companySettings?.taxId} | Tel: {companySettings?.phone}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold">Data do Relatório:</p>
                            <p>{new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-xs text-gray-500 mt-1 italic">Emitido por: Sistema Central</p>
                        </div>
                    </div>

                    {/* Report Stats Summary */}
                    <div className="grid grid-cols-4 gap-4 py-4 px-6 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="text-center">
                            <span className="block text-xs uppercase text-gray-500 font-bold">Total Itens</span>
                            <span className="text-xl font-bold">{medications.length}</span>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <span className="block text-xs uppercase text-gray-500 font-bold">Stock Baixo</span>
                            <span className="text-xl font-bold text-red-600">{medications.filter(m => m.isLowStock).length}</span>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <span className="block text-xs uppercase text-gray-500 font-bold">A Expirar</span>
                            <span className="text-xl font-bold text-amber-600">{medications.filter(m => m.daysToExpiry && m.daysToExpiry <= 90).length}</span>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <span className="block text-xs uppercase text-gray-500 font-bold">Controlados</span>
                            <span className="text-xl font-bold text-indigo-600">{medications.filter(m => m.isControlled).length}</span>
                        </div>
                    </div>

                    {/* Inventory Table */}
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b-2 border-black">
                                <th className="py-3 px-2 text-left text-xs font-bold uppercase w-16">Código</th>
                                <th className="py-3 px-2 text-left text-xs font-bold uppercase">Nome do Medicamento / DCI</th>
                                <th className="py-3 px-2 text-left text-xs font-bold uppercase">Lab / Lab</th>
                                <th className="py-3 px-2 text-center text-xs font-bold uppercase w-20">Stock</th>
                                <th className="py-3 px-2 text-right text-xs font-bold uppercase w-24">P. Unit</th>
                                <th className="py-3 px-2 text-center text-xs font-bold uppercase w-28">Validade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {medications.map((med, idx) => (
                                <tr key={med.id} className={cn("border-b border-gray-200", idx % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                                    <td className="py-3 px-2 text-xs font-mono">{med.product.code}</td>
                                    <td className="py-3 px-2">
                                        <div className="font-bold text-sm">{med.product.name}</div>
                                        <div className="text-[10px] text-gray-600 italic leading-tight">{med.dci} {med.dosage}</div>
                                    </td>
                                    <td className="py-3 px-2 text-xs">{med.laboratory || '-'}</td>
                                    <td className="py-3 px-2 text-center text-sm font-bold">
                                        {med.totalStock} <span className="text-[10px] font-normal uppercase">{med.product.unit || 'un'}</span>
                                    </td>
                                    <td className="py-3 px-2 text-right text-sm font-bold font-mono">
                                        {formatCurrency(med.product.price)}
                                    </td>
                                    <td className="py-3 px-2 text-center text-xs">
                                        {med.nearestExpiry ? formatDate(med.nearestExpiry) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Report Footer */}
                    <div className="pt-12 mt-12 border-t-2 border-black flex justify-between items-end">
                        <div className="w-1/3 text-center border-t border-gray-400 pt-2">
                            <p className="text-xs uppercase font-bold">Responsável de Farmácia</p>
                            <p className="text-[10px] text-gray-400 mt-6">(Assinatura e Carimbo)</p>
                        </div>
                        <div className="text-right text-[10px] text-gray-400 italic">
                            Este documento foi gerado automaticamente e serve apenas para fins de gestão interna de stock.
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media screen {
                    .hidden-screen-only { display: none !important; }
                }
                @media print {
                    @page { size: A4; margin: 1cm; }
                    body * { visibility: hidden !important; }
                    #printable-inventory, #printable-inventory * { visibility: visible !important; }
                    #printable-inventory {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        display: block !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteMedication}
                title="Confirmar Eliminação"
                message={`Tem certeza que deseja eliminar o medicamento "${selectedMedication?.product.name}"? Esta ação não pode ser desfeita.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />
        </div>
    );
}
