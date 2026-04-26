import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    HiOutlineUsers,
    HiOutlineIdentification,
    HiOutlineCalendar,
    HiOutlineBanknotes,
    HiOutlineChartBar,
    HiOutlineShieldCheck,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineExclamationTriangle,
    HiOutlineFingerPrint,
    HiOutlineCurrencyDollar,
    HiOutlineFolderOpen,
    HiOutlineMagnifyingGlass
} from 'react-icons/hi2';
import {
    Card,
    Button,
    Badge,
    Input,
    Select,
    Modal,
    DataTable,
    PageHeader,
    LoadingSpinner,
    Pagination
} from '../../components/ui';
import { 
    useDrivers, 
    useCreateDriver, 
    useUpdateDriver, 
    useDeleteDriver
} from '../../hooks/useLogistics';
import { LogisticsAttendanceControl } from '../../components/logistics/hr/LogisticsAttendanceControl';
import { LogisticsPayrollManager } from '../../components/logistics/hr/LogisticsPayrollManager';
import { LogisticsDocumentCenter } from '../../components/logistics/hr/LogisticsDocumentCenter';
import { VacationsPanel, BonusConfigPanel } from '../../components/employees/ModuleHRPage';
import type { Driver, StaffCategory } from '../../services/api/logistics.api';
import { cn } from '../../utils/helpers';
import { 
    createColumnHelper, 
    useReactTable, 
    getCoreRowModel, 
    getSortedRowModel,
    type SortingState 
} from '@tanstack/react-table';

const columnHelper = createColumnHelper<Driver>();

const LOGISTICS_CONFIG = {
    department: 'Logística',
    moduleName: 'Logística',
    accentColor: 'violet',
    icon: null,
    showCommissions: false,
    documentTypes: [
        { id: 'bi', label: 'Bilhete de Identidade', required: true },
        { id: 'nuit', label: 'NUIT', required: true },
        { id: 'inss', label: 'Cartão INSS', required: true },
        { id: 'contract', label: 'Contrato de Trabalho', required: true },
        { id: 'license', label: 'Carta de Condução', required: true },
        { id: 'medical', label: 'Exame Médico / Aptidão', required: true },
        { id: 'safety', label: 'Certificado de Segurança Rodoviária' },
        { id: 'criminal', label: 'Registo Criminal' },
    ],
};

type HRTab = 'dashboard' | 'staff' | 'attendance' | 'payroll' | 'compliance' | 'vacations' | 'config';

export default function LogisticsHRPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<HRTab>('dashboard');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sorting, setSorting] = useState<SortingState>([]);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Driver | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const createMutation = useCreateDriver();
    const updateMutation = useUpdateDriver();
    const deleteMutation = useDeleteDriver();

    const [formData, setFormData] = useState<Partial<Driver>>({
        code: '',
        name: '',
        phone: '',
        email: '',
        category: 'driver',
        licenseNumber: '',
        licenseType: '',
        licenseExpiry: '',
        medicalExamExpiry: '',
        safetyTrainingDate: '',
        status: 'available',
        baseSalary: 0,
        subsidyTransport: 0,
        subsidyFood: 0,
        commissionRate: 0,
        address: '',
        bankName: '',
        bankAccountNumber: '',
        bankNib: '',
        socialSecurityNumber: '',
        nuit: '',
        birthDate: ''
    });

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            phone: '',
            email: '',
            category: 'driver',
            licenseNumber: '',
            licenseType: '',
            licenseExpiry: '',
            medicalExamExpiry: '',
            safetyTrainingDate: '',
            status: 'available',
            baseSalary: 0,
            subsidyTransport: 0,
            subsidyFood: 0,
            commissionRate: 0,
            address: '',
            bankName: '',
            bankAccountNumber: '',
            bankNib: '',
            socialSecurityNumber: '',
            nuit: '',
            birthDate: ''
        });
        setEditingStaff(null);
    };

    const openForm = (staff?: Driver) => {
        if (staff) {
            setEditingStaff(staff);
            setFormData({
                ...staff,
                licenseExpiry: staff.licenseExpiry?.split('T')[0] || '',
                medicalExamExpiry: staff.medicalExamExpiry?.split('T')[0] || '',
                safetyTrainingDate: staff.safetyTrainingDate?.split('T')[0] || '',
                hireDate: staff.hireDate?.split('T')[0] || ''
            });
        } else {
            resetForm();
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingStaff) {
                await updateMutation.mutateAsync({ id: editingStaff.id, data: formData });
            } else {
                await createMutation.mutateAsync(formData);
            }
            setIsFormOpen(false);
            resetForm();
        } catch (error) {
            // Error handled by mutation toast
        }
    };

    const handleDelete = async (id: string) => {
        await deleteMutation.mutateAsync(id);
        setDeleteConfirm(null);
    };

    const getCategoryBadge = (category: StaffCategory) => {
        const colors: Record<StaffCategory, any> = {
            driver: 'primary',
            mechanic: 'warning',
            warehouse: 'info',
            manager: 'success',
            admin: 'gray',
            other: 'gray'
        };
        return <Badge variant={colors[category] || 'gray'}>{t(`logistics_module.hr.categories.${category}`)}</Badge>;
    };

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: t('logistics_module.drivers.name'),
            cell: (info) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-bold text-primary-700">
                        {info.getValue().charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium">{info.getValue()}</p>
                        <p className="text-xs text-gray-500 font-mono">{info.row.original.code}</p>
                    </div>
                </div>
            )
        }),
        columnHelper.accessor('category', {
            header: t('common.category'),
            cell: (info) => getCategoryBadge(info.getValue())
        }),
        columnHelper.accessor('phone', {
            header: t('logistics_module.drivers.phone')
        }),
        columnHelper.accessor('status', {
            header: t('common.status'),
            cell: (info) => (
                <Badge variant={info.getValue() === 'available' ? 'success' : info.getValue() === 'on_delivery' ? 'primary' : 'gray'}>
                    {t(`logistics_module.drivers.statuses.${info.getValue()}`)}
                </Badge>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: t('common.actions'),
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openForm(row.original)}>
                        <HiOutlinePencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteConfirm(row.original.id)}>
                        <HiOutlineTrash className="w-4 h-4" />
                    </Button>
                </div>
            )
        })
    ], [t]);

    const { data, isLoading, refetch } = useDrivers({
        page,
        limit: pageSize,
        search: searchTerm,
        category: categoryFilter || undefined
    });

    const table = useReactTable({
        data: data?.data || [],
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        manualSorting: true,
    });

    if (isLoading && !data) return <LoadingSpinner size="xl" className="h-96" />;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader
                title={t('logistics_module.hr.title')}
                subtitle={t('logistics_module.hr.subtitle')}
                icon={<HiOutlineUsers />}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" leftIcon={<HiOutlineArrowPath />} onClick={() => refetch()}>
                            {t('common.refresh')}
                        </Button>
                        <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => openForm()}>
                            {t('logistics_module.drivers.add')}
                        </Button>
                    </div>
                }
            />

            {/* Tabs Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-lg overflow-x-auto scroller-hidden">
                {([
                    { id: 'dashboard', label: t('logistics_module.hr.tabs.dashboard'), icon: HiOutlineChartBar },
                    { id: 'staff', label: t('logistics_module.hr.tabs.staff'), icon: HiOutlineUsers },
                    { id: 'attendance', label: t('logistics_module.hr.tabs.attendance'), icon: HiOutlineFingerPrint },
                    { id: 'payroll', label: t('logistics_module.hr.tabs.payroll'), icon: HiOutlineBanknotes },
                    { id: 'compliance', label: t('logistics_module.hr.tabs.compliance'), icon: HiOutlineFolderOpen },
                    { id: 'vacations', label: t('logistics_module.hr.tabs.vacations'), icon: HiOutlineCalendar },
                    { id: 'config', label: t('logistics_module.hr.tabs.config.title'), icon: HiOutlineChartBar },
                ] as { id: HRTab; label: string; icon: React.ElementType }[]).map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 flex-1 justify-center",
                                activeTab === tab.id
                                    ? "bg-white dark:bg-dark-700 text-primary-600 shadow-sm border border-primary-50 dark:border-primary-900/30"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px] animate-fade-in transition-all duration-300">
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title={t('logistics_module.hr.stats.attendance')}
                            value="94.2%"
                            trend="+2.1%"
                            icon={<HiOutlineCalendar className="text-blue-500" />}
                            color="blue"
                        />
                        <StatCard
                            title={t('logistics_module.hr.stats.efficiency')}
                            value="87.5%"
                            trend="+5.4%"
                            icon={<HiOutlineChartBar className="text-green-500" />}
                            color="green"
                        />
                        <StatCard
                            title={t('logistics_module.hr.stats.safety')}
                            value="98/100"
                            trend="Estvel"
                            trendColor="gray"
                            icon={<HiOutlineShieldCheck className="text-purple-500" />}
                            color="purple"
                        />
                        <StatCard
                            title={t('logistics_module.hr.stats.productivity')}
                            value="12.4 dep/dia"
                            trend="+0.8"
                            icon={<HiOutlinePlus className="text-orange-500" />}
                            color="orange"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card variant="glass" className="lg:col-span-2 p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <HiOutlineUsers className="w-5 h-5 text-primary-500" />
                                {t('logistics_module.hr.dashboard.teamDistribution')}
                            </h3>
                            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-dark-700 rounded-lg">
                                <p className="text-gray-400">{t('logistics_module.hr.dashboard.chartPlaceholder')}</p>
                            </div>
                        </Card>
                        <Card variant="glass" className="p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <HiOutlineExclamationTriangle className="w-5 h-5 text-orange-500" />
                                {t('logistics_module.hr.dashboard.complianceAlerts')}
                            </h3>
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700/50 shadow-sm transition-all hover:border-orange-500/30 group">
                                        <div className="w-10 h-10 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 backdrop-blur-sm group-hover:scale-110 transition-transform">
                                            <HiOutlineIdentification className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">Expiração em 5 dias</p>
                                            <p className="text-[10px] text-gray-500 font-medium italic uppercase tracking-wider">Carta de Condução - João Silva</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'staff' && (
                <div className="space-y-4 animate-fade-in">
                    <Card variant="glass" className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder={t('logistics_module.drivers.searchPlaceholder')}
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select
                                options={[
                                    { value: '', label: t('logistics_module.hr.categories.all') },
                                    { value: 'driver', label: t('logistics_module.hr.categories.driver') },
                                    { value: 'mechanic', label: t('logistics_module.hr.categories.mechanic') },
                                    { value: 'warehouse', label: t('logistics_module.hr.categories.warehouse') },
                                    { value: 'manager', label: t('logistics_module.hr.categories.manager') },
                                    { value: 'admin', label: t('logistics_module.hr.categories.admin') }
                                ]}
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            />
                            <div className="flex items-center justify-end text-sm text-gray-500">
                                {data?.pagination.total || 0} {t('common.results_found')}
                            </div>
                        </div>
                    </Card>

                    <Card variant="glass" padding="none">
                        <DataTable
                            table={table}
                            isLoading={isLoading}
                        />
                    </Card>

                    <Pagination
                        currentPage={page}
                        totalItems={data?.pagination.total || 0}
                        itemsPerPage={pageSize}
                        onPageChange={setPage}
                        onItemsPerPageChange={setPageSize}
                    />
                </div>
            )}

            {activeTab === 'attendance' && <LogisticsAttendanceControl />}
            {activeTab === 'payroll' && <LogisticsPayrollManager />}
            {activeTab === 'compliance' && <LogisticsDocumentCenter />}
            {activeTab === 'vacations' && <VacationsPanel config={LOGISTICS_CONFIG as any} employees={[]} />}
            {activeTab === 'config' && <BonusConfigPanel config={LOGISTICS_CONFIG as any} />}
            </div>

            {/* Staff Form Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); resetForm(); }}
                title={editingStaff ? t('common.edit') : t('common.add')}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={`${t('common.code')} *`}
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            required
                            disabled={!!editingStaff}
                        />
                        <Select
                            label={`${t('common.category')} *`}
                            options={[
                                { value: 'driver', label: t('logistics_module.hr.categories.driver') },
                                { value: 'mechanic', label: t('logistics_module.hr.categories.mechanic') },
                                { value: 'warehouse', label: t('logistics_module.hr.categories.warehouse') },
                                { value: 'manager', label: t('logistics_module.hr.categories.manager') },
                                { value: 'admin', label: t('logistics_module.hr.categories.admin') }
                            ]}
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value as StaffCategory })}
                            required
                        />
                    </div>
                    
                    <Input
                        label={`${t('common.fullName')} *`}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={`${t('common.phone')} *`}
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            required
                        />
                        <Input
                            label={t('common.email')}
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-lg space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <HiOutlineIdentification className="w-4 h-4 text-primary-500" />
                            {t('logistics_module.hr.tabs.compliance')}
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={t('logistics_module.drivers.expiry')}
                                type="date"
                                value={formData.licenseExpiry}
                                onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                            />
                            <Input
                                label={t('logistics_module.drivers.medicalExam')}
                                type="date"
                                value={formData.medicalExamExpiry}
                                onChange={(e) => setFormData({ ...formData, medicalExamExpiry: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-lg space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <HiOutlineBanknotes className="w-4 h-4 text-green-500" />
                            {t('logistics_module.hr.tabs.payroll')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label={t('common.bank')}
                                value={formData.bankName}
                                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                            />
                            <Input
                                label={t('common.account')}
                                value={formData.bankAccountNumber}
                                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                            />
                            <Input
                                label={t('common.nib')}
                                value={formData.bankNib}
                                onChange={(e) => setFormData({ ...formData, bankNib: e.target.value })}
                            />
                            <Input
                                label="NUIT"
                                value={formData.nuit}
                                onChange={(e) => setFormData({ ...formData, nuit: e.target.value })}
                            />
                            <Input
                                label={t('common.socialSecurity')}
                                value={formData.socialSecurityNumber}
                                onChange={(e) => setFormData({ ...formData, socialSecurityNumber: e.target.value })}
                            />
                             <Input
                                label={t('common.birthDate')}
                                type="date"
                                value={formData.birthDate?.split('T')[0] || ''}
                                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-lg space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <HiOutlineCurrencyDollar className="w-4 h-4 text-indigo-500" />
                            {t('common.salary')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label={t('common.baseSalary')}
                                type="number"
                                value={formData.baseSalary}
                                onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                            />
                            <Input
                                label={t('logistics_module.hr.payroll.subsidyTransport')}
                                type="number"
                                value={formData.subsidyTransport}
                                onChange={(e) => setFormData({ ...formData, subsidyTransport: Number(e.target.value) })}
                            />
                            <Input
                                label={t('logistics_module.hr.payroll.subsidyFood')}
                                type="number"
                                value={formData.subsidyFood}
                                onChange={(e) => setFormData({ ...formData, subsidyFood: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setIsFormOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" className="flex-1" isLoading={createMutation.isLoading || updateMutation.isLoading}>
                            {editingStaff ? t('common.save') : t('common.add')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={t('common.confirmDelete')}
                size="sm"
            >
                <div className="text-center py-4">
                    <HiOutlineExclamationTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 mb-6">{t('messages.confirmDelete')}</p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
                        <Button variant="danger" className="flex-1" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>{t('common.delete')}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function StatCard({ title, value, trend, trendColor = 'green', icon, color }: any) {
    const bgColors: Record<string, string> = {
        blue: 'bg-blue-500/15 border-blue-500/20 text-blue-600 dark:text-blue-300',
        green: 'bg-green-500/15 border-green-500/20 text-green-600 dark:text-green-300',
        purple: 'bg-purple-500/15 border-purple-500/20 text-purple-600 dark:text-purple-300',
        orange: 'bg-orange-500/15 border-orange-500/20 text-orange-600 dark:text-orange-400'
    };
    
    return (
        <Card variant="default" className="group overflow-hidden transition-all hover:shadow-premium-hover border-none bg-white dark:bg-dark-900 shadow-premium">
            <div className="flex items-center justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-sm border group-hover:scale-110 transition-transform", bgColors[color])}>
                    {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-6 h-6' })}
                </div>
                <Badge variant={trendColor === 'green' ? 'success' : 'gray'} className="font-black text-[9px] px-2 py-0.5 rounded-full">
                    {trend}
                </Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{title}</p>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{value}</h4>
        </Card>
    );
}
