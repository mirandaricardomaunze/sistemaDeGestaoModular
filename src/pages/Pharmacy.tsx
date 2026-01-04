/**
 * Pharmacy Management System
 * Professional pharmacy module with POS, medications, stock, prescriptions, and reports
 */

import { useState, useEffect } from 'react';
import { Card, Button, Badge, LoadingSpinner, Modal, ConfirmationModal, Input, Select, EmptyState } from '../components/ui';
import { pharmacyAPI } from '../services/api';
import { useProducts } from '../hooks/useData';
import toast from 'react-hot-toast';
import {
    HiOutlineBeaker,
    HiOutlineClipboardList,
    HiOutlineDocumentReport,
    HiOutlineCube,
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlineFilter,
    HiOutlineExclamation,
    HiOutlineDownload,
    HiOutlineClock,
    HiOutlineDocumentDownload,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineCalendar,
    HiOutlineHashtag,
    HiOutlineShieldCheck,
    HiOutlineCheck,
    HiOutlineX
} from 'react-icons/hi';
import * as XLSX from 'xlsx';
import { generatePharmacyStockReport, generatePharmacyExpiringReport, generatePharmacySalesReport } from '../utils/documentGenerator';
import { useStore } from '../stores/useStore';
import Pagination, { usePagination } from '../components/ui/Pagination';
import { formatCurrency, formatDate, cn } from '../utils/helpers';

type MainTab = 'medications' | 'stock' | 'prescriptions' | 'reports';

interface Medication {
    id: string;
    productId: string;
    dci: string;
    dosage: string;
    pharmaceuticalForm: string;
    laboratory: string;
    requiresPrescription: boolean;
    isControlled: boolean;
    storageTemp: string;
    atcCode: string;
    controlLevel: string;
    contraindications: string;
    sideEffects: string;
    activeIngredient: string;
    concentration: string;
    product: {
        id: string;
        code: string;
        name: string;
        price: number;
        minStock: number;
    };
    batches: any[];
    totalStock: number;
    nearestExpiry: string | null;
    isLowStock: boolean;
    daysToExpiry: number | null;
    alertLevel: 'critical' | 'warning' | 'normal';
}

export default function Pharmacy() {
    const { companySettings } = useStore();
    const [activeTab, setActiveTab] = useState<MainTab>('medications');
    const [isLoading, setIsLoading] = useState(true);

    // Medications state
    const [medications, setMedications] = useState<Medication[]>([]);
    const [medSearch, setMedSearch] = useState('');
    const [medFilter, setMedFilter] = useState<'all' | 'lowStock' | 'expiring' | 'controlled'>('all');

    // Reports state
    const [expiringReport, setExpiringReport] = useState<any>(null);
    const [stockReport, setStockReport] = useState<any>(null);
    const [reportPeriod, setReportPeriod] = useState<'7days' | '30days' | '90days' | '180days' | '1year'>('30days');

    // Modals
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    const [isNewMedicationModalOpen, setIsNewMedicationModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);

    // Metrics state
    const [metrics, setMetrics] = useState({
        totalMedications: 0,
        lowStockItems: 0,
        expiringSoon: 0,
        controlledItems: 0
    });

    // Pagination Hooks
    const medPagination = usePagination(medications, 10);

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
        notes: ''
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
        atcCode: '',
        controlLevel: '',
        contraindications: '',
        sideEffects: '',
        activeIngredient: '',
        concentration: ''
    });

    // Products for new medication creation
    const { products } = useProducts();



    // Fetch medications
    const fetchMedications = async () => {
        try {
            const params: any = {};
            if (medSearch) params.search = medSearch;
            if (medFilter === 'lowStock') params.lowStock = true;
            if (medFilter === 'expiring') params.expiringDays = 90;
            if (medFilter === 'controlled') params.isControlled = true;

            const data = await pharmacyAPI.getMedications(params);
            setMedications(data);

            // Calculate metrics
            setMetrics({
                totalMedications: data.length,
                lowStockItems: data.filter((m: any) => m.isLowStock).length,
                expiringSoon: data.filter((m: any) => m.daysToExpiry && m.daysToExpiry <= 90).length,
                controlledItems: data.filter((m: any) => m.isControlled).length
            });
        } catch (error) {
            console.error('Error fetching medications:', error);
        }
    };

    // Fetch reports
    const fetchReports = async () => {
        try {
            const [expiring, stock] = await Promise.all([
                pharmacyAPI.getExpiringReport(90),
                pharmacyAPI.getStockReport()
            ]);
            setExpiringReport(expiring);
            setStockReport(stock);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await fetchMedications();
            setIsLoading(false);
        };
        loadData();
    }, []);

    useEffect(() => {
        if (activeTab === 'medications') {
            fetchMedications();
        } else if (activeTab === 'reports') {
            fetchReports();
        }
    }, [activeTab, medFilter]);





    const handleCreateOrUpdateMedication = async () => {
        try {
            if (!medicationForm.productId) {
                toast.error('Selecione um produto base');
                return;
            }

            if (isEditing && selectedMedication) {
                await pharmacyAPI.updateMedication(selectedMedication.id, medicationForm);
                toast.success('Medicamento atualizado com sucesso!');
            } else {
                await pharmacyAPI.createMedication(medicationForm);
                toast.success('Medicamento criado com sucesso!');
            }

            setIsNewMedicationModalOpen(false);
            resetMedicationForm();
            fetchMedications();
        } catch (error: any) {
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
            atcCode: '',
            controlLevel: '',
            contraindications: '',
            sideEffects: '',
            activeIngredient: '',
            concentration: ''
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
            atcCode: medication.atcCode || '',
            controlLevel: medication.controlLevel || '',
            contraindications: medication.contraindications || '',
            sideEffects: medication.sideEffects || '',
            activeIngredient: medication.activeIngredient || '',
            concentration: medication.concentration || ''
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
        } catch (error: any) {
            toast.error(error.message || 'Erro ao eliminar medicamento');
        }
    };


    const handleExportSalesReport = async () => {
        try {
            const days = reportPeriod === '7days' ? 7 :
                reportPeriod === '30days' ? 30 :
                    reportPeriod === '90days' ? 90 :
                        reportPeriod === '180days' ? 180 : 365;

            const periodLabel =
                reportPeriod === '7days' ? 'Últimos 7 Dias' :
                    reportPeriod === '30days' ? 'Últimos 30 Dias' :
                        reportPeriod === '90days' ? 'Últimos 3 Meses' :
                            reportPeriod === '180days' ? 'Últimos 6 Meses' : 'Último Ano';

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const response = await pharmacyAPI.getSales({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                limit: 1000
            });

            if (response && response.items && response.items.length > 0) {
                generatePharmacySalesReport(response.items, periodLabel, companySettings);
                toast.success('Relatório de vendas gerado!');
            } else {
                toast.error('Sem dados de vendas para este período');
            }
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Erro ao gerar relatório');
        }
    };

    // Export functions
    const exportToExcel = (data: any[], filename: string) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
        XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Filtered medications moved up for initialization order

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="xl" />
                <p className="mt-4 text-sm text-gray-400">A carregar sistema de farmácia...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 px-2 pt-6 pb-6 md:px-6">
            {/* Header */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <HiOutlineBeaker className="w-7 h-7 text-primary-600" />
                            Gestão de Farmácia
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Medicamentos, Vendas, Stock e Receitas
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-4 h-4" />}
                            onClick={() => { fetchMedications(); if (activeTab === 'reports') fetchReports(); }}>
                            Actualizar
                        </Button>
                        {activeTab === 'medications' && (
                            <Button size="sm" leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                                onClick={() => setIsNewMedicationModalOpen(true)}
                            >
                                Novo Medicamento
                            </Button>
                        )}
                        {activeTab === 'stock' && (
                            <Button size="sm" leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                                onClick={() => setIsBatchModalOpen(true)}>
                                Entrada de Lote
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700 pb-0 overflow-x-auto">
                {[
                    { id: 'medications', label: 'Medicamentos', icon: HiOutlineBeaker },
                    { id: 'stock', label: 'Stock', icon: HiOutlineCube },
                    { id: 'prescriptions', label: 'Receitas', icon: HiOutlineClipboardList },
                    { id: 'reports', label: 'Relatórios', icon: HiOutlineDocumentReport }
                ].map(tab => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? 'primary' : 'ghost'}
                        onClick={() => setActiveTab(tab.id as MainTab)}
                        leftIcon={<tab.icon className="w-4 h-4" />}
                        size="sm"
                        className="px-4 py-2 rounded-b-none whitespace-nowrap"
                    >
                        {tab.label}
                    </Button>
                ))}
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
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <HiOutlineFilter className="w-5 h-5 text-gray-400" />
                                <Input
                                    placeholder="Pesquisar..."
                                    value={medSearch}
                                    onChange={(e) => setMedSearch(e.target.value)}
                                    leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                    className="w-64"
                                />
                            </div>
                            <div className="flex gap-2">
                                {['all', 'lowStock', 'expiring', 'controlled'].map(filter => (
                                    <Button
                                        key={filter}
                                        variant={medFilter === filter ? 'primary' : 'outline'}
                                        size="sm"
                                        onClick={() => setMedFilter(filter as any)}
                                    >
                                        {filter === 'all' ? 'Todos' :
                                            filter === 'lowStock' ? 'Baixo Stock' :
                                                filter === 'expiring' ? 'A Expirar' : 'Controlados'}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Medications Table */}
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
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
                                        {medPagination.paginatedItems.map(med => (
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
                                        {medications.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-gray-400">
                                                    Nenhum medicamento encontrado
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <Pagination
                                currentPage={medPagination.currentPage}
                                totalItems={medPagination.totalItems}
                                itemsPerPage={medPagination.itemsPerPage}
                                onPageChange={medPagination.setCurrentPage}
                                onItemsPerPageChange={medPagination.setItemsPerPage}
                                className="p-4 bg-white dark:bg-dark-800"
                            />
                        </Card>
                    </div>
                )
                }

                {/* STOCK TAB */}
                {
                    activeTab === 'stock' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Low Stock Alert */}
                                <Card className="p-6 border-l-4 border-amber-500">
                                    <h3 className="font-bold flex items-center gap-2 mb-4">
                                        <HiOutlineExclamation className="w-5 h-5 text-amber-600" />
                                        Alerta de Stock Baixo
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {medications.filter(m => m.isLowStock).map(med => (
                                            <div key={med.id} className="flex justify-between items-center p-2 bg-amber-50 dark:bg-amber-900/10 rounded">
                                                <span className="text-sm font-medium">{med.product.name}</span>
                                                <Badge variant="warning">{med.totalStock} un</Badge>
                                            </div>
                                        ))}
                                        {medications.filter(m => m.isLowStock).length === 0 && (
                                            <p className="text-sm text-gray-400 text-center py-4">Sem alertas</p>
                                        )}
                                    </div>
                                </Card>

                                {/* Expiring Soon */}
                                <Card className="p-6 border-l-4 border-red-500">
                                    <h3 className="font-bold flex items-center gap-2 mb-4">
                                        <HiOutlineClock className="w-5 h-5 text-red-600" />
                                        Próximos a Expirar (90 dias)
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {medications.filter(m => m.daysToExpiry && m.daysToExpiry <= 90).map(med => (
                                            <div key={med.id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/10 rounded">
                                                <div>
                                                    <span className="text-sm font-medium">{med.product.name}</span>
                                                    <p className="text-xs text-gray-500">{med.daysToExpiry} dias</p>
                                                </div>
                                                <Badge variant={med.daysToExpiry && med.daysToExpiry <= 30 ? 'danger' : 'warning'}>
                                                    {med.nearestExpiry && new Date(med.nearestExpiry).toLocaleDateString()}
                                                </Badge>
                                            </div>
                                        ))}
                                        {medications.filter(m => m.daysToExpiry && m.daysToExpiry <= 90).length === 0 && (
                                            <p className="text-sm text-gray-400 text-center py-4">Sem alertas</p>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )
                }

                {/* REPORTS TAB */}
                {
                    activeTab === 'reports' && (
                        <div className="space-y-6">
                            {/* Filter & Period */}
                            <div className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-dark-700/50 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-500">Período:</span>
                                    <div className="flex gap-1">
                                        {[
                                            { id: '7days', label: '7D' },
                                            { id: '30days', label: '1M' },
                                            { id: '90days', label: '3M' },
                                            { id: '180days', label: '6M' },
                                            { id: '1year', label: '1A' }
                                        ].map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setReportPeriod(p.id as any)}
                                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${reportPeriod === p.id
                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                    : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-600'
                                                    }`}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Export Buttons */}
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="outline"
                                    leftIcon={<HiOutlineDownload className="w-4 h-4" />}
                                    onClick={() => expiringReport && exportToExcel(expiringReport.items, 'Relatorio_Validades')}
                                >
                                    Excel Validades
                                </Button>
                                <Button
                                    variant="outline"
                                    leftIcon={<HiOutlineDownload className="w-4 h-4" />}
                                    onClick={() => stockReport && exportToExcel(stockReport.items, 'Relatorio_Stock')}
                                >
                                    Excel Stock
                                </Button>
                                <div className="border-l border-gray-300 dark:border-dark-600 mx-2" />
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    leftIcon={<HiOutlineDocumentDownload className="w-4 h-4" />}
                                    onClick={() => expiringReport && generatePharmacyExpiringReport(expiringReport, companySettings)}
                                >
                                    PDF Validades
                                </Button>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    leftIcon={<HiOutlineDocumentDownload className="w-4 h-4" />}
                                    onClick={() => stockReport && generatePharmacyStockReport(stockReport, companySettings)}
                                >
                                    PDF Stock
                                </Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    leftIcon={<HiOutlineDocumentDownload className="w-4 h-4" />}
                                    onClick={handleExportSalesReport}
                                >
                                    PDF Vendas
                                </Button>
                            </div>

                            {/* Stock Report Summary */}
                            {stockReport && (
                                <Card className="p-6">
                                    <h3 className="font-bold mb-4">Resumo de Inventário Farmacêutico</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Total Produtos</p>
                                            <p className="text-2xl font-bold">{stockReport.summary.totalProducts}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Total Unidades</p>
                                            <p className="text-2xl font-bold">{stockReport.summary.totalStock}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Valor Total</p>
                                            <p className="text-2xl font-bold text-green-600">{formatCurrency(Number(stockReport.summary.totalValue))}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Custo Total</p>
                                            <p className="text-2xl font-bold">{formatCurrency(Number(stockReport.summary.totalCost))}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Baixo Stock</p>
                                            <p className="text-2xl font-bold text-amber-600">{stockReport.summary.lowStockCount}</p>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* Expiring Report */}
                            {expiringReport && (
                                <Card className="p-6">
                                    <h3 className="font-bold mb-4">Medicamentos Próximos do Fim da Validade (90 dias)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                        <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded">
                                            <p className="text-sm text-gray-500">Expirados</p>
                                            <p className="text-xl font-bold text-red-600">{expiringReport.summary.expiredCount}</p>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded">
                                            <p className="text-sm text-gray-500">A Expirar</p>
                                            <p className="text-xl font-bold text-amber-600">{expiringReport.summary.expiringCount}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded">
                                            <p className="text-sm text-gray-500">Total Itens</p>
                                            <p className="text-xl font-bold">{expiringReport.summary.totalItems}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded">
                                            <p className="text-sm text-gray-500">Valor em Risco</p>
                                            <p className="text-xl font-bold text-red-600">{formatCurrency(Number(expiringReport.summary.totalValue))}</p>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    )
                }

                {/* PRESCRIPTIONS TAB */}
                {
                    activeTab === 'prescriptions' && (
                        <div className="space-y-4">
                            <Button
                                leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                                onClick={() => setIsPrescriptionModalOpen(true)}
                            >
                                Nova Receita
                            </Button>
                            <Card className="p-6">
                                <EmptyState
                                    icon={<HiOutlineClipboardList className="w-12 h-12" />}
                                    title="Gestão de Receitas Médicas"
                                    description="Clique em 'Nova Receita' para registar uma prescrição médica. As receitas registadas permitem controlo de medicamentos dispensados."
                                />
                            </Card>
                        </div>
                    )
                }
            </div >

            {/* Batch Entry Modal */}
            < Modal
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
                        if (activeTab === 'reports') fetchReports();
                    } catch (error: any) {
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
            < Modal
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
                        await pharmacyAPI.createPrescription({
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
                            items: []
                        });
                        toast.success('Receita registada com sucesso!');
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
                            notes: ''
                        });
                    } catch (error: any) {
                        toast.error(error.message || 'Erro ao registar receita');
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

                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mt-4">
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Informações Clínicas</p>
                    </div>
                    <Input
                        label="Diagnóstico"
                        value={prescriptionForm.diagnosis}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                        placeholder="CID ou descritivo"
                    />
                    <Input
                        label="Observações"
                        value={prescriptionForm.notes}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                        placeholder="Notas adicionais"
                    />
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={prescriptionForm.isControlled}
                            onChange={(e) => setPrescriptionForm({ ...prescriptionForm, isControlled: e.target.checked })}
                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Receita de Substância Controlada
                        </span>
                    </label>

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
            < Modal
                isOpen={isNewMedicationModalOpen}
                onClose={() => {
                    setIsNewMedicationModalOpen(false);
                    resetMedicationForm();
                }}
                title={isEditing ? "Editar Medicamento" : "Novo Medicamento"}
                size="xl"
            >
                <div className="space-y-6">
                    {!isEditing && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                            Selecione um produto do inventário para converter em medicamento.
                            Se o produto não existir, crie-o primeiro no Inventário.
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section: Basic Data */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 border-b pb-2">Dados Básicos</h4>

                            <Select
                                label="Produto Base *"
                                value={medicationForm.productId}
                                disabled={isEditing}
                                onChange={(e) => setMedicationForm({ ...medicationForm, productId: e.target.value })}
                                options={[
                                    { value: '', label: 'Selecione um produto...' },
                                    ...products
                                        .filter(p => isEditing ? p.id === medicationForm.productId : !medications.some(m => m.productId === p.id))
                                        .map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))
                                ]}
                            />

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
                        </div>

                        {/* Section: Advanced Info */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 border-b pb-2">Informação Clínica</h4>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Código ATC"
                                    value={medicationForm.atcCode}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, atcCode: e.target.value })}
                                />
                                <Select
                                    label="Armazenamento"
                                    value={medicationForm.storageTemp}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, storageTemp: e.target.value })}
                                    options={[
                                        { value: 'Ambiente', label: 'Ambiente (15-30°C)' },
                                        { value: 'Frio', label: 'Frio (2-8°C)' },
                                        { value: 'Congelado', label: 'Congelado (-20°C)' }
                                    ]}
                                />
                            </div>

                            <div className="flex gap-4 items-center h-10 px-2 mt-4 bg-gray-50 dark:bg-dark-700/50 rounded-lg">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={medicationForm.requiresPrescription}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, requiresPrescription: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    <span className="text-sm">Requer Receita</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={medicationForm.isControlled}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, isControlled: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    <span className="text-sm">Controlado</span>
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-dark-700">
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

                    <div className="flex justify-end gap-3 mt-8">
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
                            disabled={!medicationForm.productId}
                            className="px-8"
                            leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                        >
                            {isEditing ? 'Guardar Alterações' : 'Criar Medicamento'}
                        </Button>
                    </div>
                </div>
            </Modal >

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
        </div >
    );
}
