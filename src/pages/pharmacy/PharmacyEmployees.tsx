import { useState } from 'react';
import {
    HiOutlineCalendar,
    HiOutlineUsers,
    HiOutlineChartBar,
    HiOutlineBanknotes,
    HiOutlineShieldCheck,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineSun,
    HiOutlineCurrencyDollar,
} from 'react-icons/hi2';
import EmployeeList from '../../components/employees/EmployeeList';
import EmployeeForm from '../../components/employees/EmployeeForm';
import { Button, Card, LoadingSpinner, PageHeader } from '../../components/ui';
import { PharmacyHRDashboard } from '../../components/pharmacy/hr/PharmacyHRDashboard';
import { PharmacyAttendanceControl } from '../../components/pharmacy/hr/PharmacyAttendanceControl';
import { PharmacyPayrollManager } from '../../components/pharmacy/hr/PharmacyPayrollManager';
import { PharmacyDocumentCenter } from '../../components/pharmacy/hr/PharmacyDocumentCenter';
import { VacationsPanel, BonusConfigPanel } from '../../components/employees/ModuleHRPage';
import { useEmployees } from '../../hooks/useData';
import { cn } from '../../utils/helpers';
import type { Employee } from '../../types';

const PHARMACY_CONFIG = {
    department: 'FarmÃ¡cia',
    moduleName: 'FarmÃ¡cia',
    accentColor: 'green',
    icon: null,
    showCommissions: false,
    documentTypes: [
        { id: 'bi', label: 'Bilhete de Identidade', required: true },
        { id: 'nuit', label: 'NUIT', required: true },
        { id: 'inss', label: 'CartÃ£o INSS', required: true },
        { id: 'contract', label: 'Contrato de Trabalho', required: true },
        { id: 'ordem', label: 'Ordem dos FarmacÃªuticos', required: true },
        { id: 'license', label: 'LicenÃ§a Profissional', required: true },
        { id: 'narcotic', label: 'HabilitaÃ§Ã£o para Medicamentos Controlados' },
    ],
};

type Tab = 'dashboard' | 'staff' | 'attendance' | 'payroll' | 'compliance' | 'vacations' | 'config';

export default function PharmacyEmployees() {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    // Lightweight â€” EmployeeList manages its own paginated fetching
    const { refetch, isLoading } = useEmployees({ page: 1, limit: 1 });

    const handleAddEmployee = () => {
        setEditingEmployee(null);
        setShowEmployeeForm(true);
    };

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        setShowEmployeeForm(true);
    };

    const handleCloseForm = () => {
        setShowEmployeeForm(false);
        setEditingEmployee(null);
    };

    const tabs = [
        { id: 'dashboard', label: 'VisÃ£o Geral', icon: <HiOutlineChartBar className="w-5 h-5" /> },
        { id: 'staff', label: 'Equipe TÃ©cnica', icon: <HiOutlineUsers className="w-5 h-5" /> },
        { id: 'attendance', label: 'Controle de Ponto', icon: <HiOutlineCalendar className="w-5 h-5" /> },
        { id: 'payroll', label: 'Processamento Salarial', icon: <HiOutlineBanknotes className="w-5 h-5" /> },
        { id: 'vacations', label: 'FÃ©rias', icon: <HiOutlineSun className="w-5 h-5" /> },
        { id: 'compliance', label: 'Conformidade Legal', icon: <HiOutlineShieldCheck className="w-5 h-5" /> },
        { id: 'config', label: 'ConfiguraÃ§Ãµes', icon: <HiOutlineCurrencyDollar className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader
                title="Recursos Humanos - FarmÃ¡cia"
                subtitle="GestÃ£o completa de funcionÃ¡rios, assiduidade e conformidade farmacÃªutica"
                icon={<HiOutlineUsers />}
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-10 px-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-teal-600 transition-all bg-slate-50/50 dark:bg-dark-800"
                            leftIcon={<HiOutlineArrowPath className="w-4 h-4 text-teal-600" />}
                            onClick={() => refetch()}
                        >
                            Actualizar
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="h-10 px-6 bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest border-none"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                            onClick={() => { setEditingEmployee(null); setShowEmployeeForm(true); }}
                        >
                            Adicionar Colaborador
                        </Button>
                    </div>
                }
            />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-lg overflow-x-auto scroller-hidden">
                {tabs.map((tab) => (
                    <Button variant="ghost"
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 flex-1 justify-center",
                            activeTab === tab.id
                                ? "bg-white dark:bg-dark-700 text-primary-600 shadow-sm border border-primary-50 dark:border-primary-900/30"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </Button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[600px] animate-fade-in transition-all duration-300">
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <LoadingSpinner size="xl" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && <PharmacyHRDashboard />}
                        
                        {activeTab === 'staff' && (
                            <Card variant="glass" padding="none" className="overflow-hidden border border-gray-100 dark:border-dark-700/50">
                                <EmployeeList
                                    onEdit={handleEdit}
                                    onAddEmployee={handleAddEmployee}
                                    hideHeader
                                />
                            </Card>
                        )}

                        {activeTab === 'attendance' && <PharmacyAttendanceControl />}

                        {activeTab === 'payroll' && <PharmacyPayrollManager />}

                        {activeTab === 'vacations' && <VacationsPanel config={PHARMACY_CONFIG} employees={[]} />}

                        {activeTab === 'compliance' && <PharmacyDocumentCenter />}

                        {activeTab === 'config' && <BonusConfigPanel config={PHARMACY_CONFIG} />}
                    </>
                )}
            </div>

            {/* Employee Form Modal */}
            <EmployeeForm
                isOpen={showEmployeeForm}
                onClose={handleCloseForm}
                employee={editingEmployee}
            />
        </div>
    );
}
