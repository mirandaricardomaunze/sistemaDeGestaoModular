import { useState } from 'react';
import { 
    HiOutlineCalendar, 
    HiOutlineUsers, 
    HiOutlineChartBar, 
    HiOutlineBanknotes,
    HiOutlineShieldCheck,
    HiOutlinePlus,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import EmployeeList from '../../components/employees/EmployeeList';
import EmployeeForm from '../../components/employees/EmployeeForm';
import { Button, Card, PageHeader, LoadingSpinner } from '../../components/ui';
import { PharmacyHRDashboard } from '../../components/pharmacy/hr/PharmacyHRDashboard';
import { PharmacyAttendanceControl } from '../../components/pharmacy/hr/PharmacyAttendanceControl';
import { PharmacyPayrollManager } from '../../components/pharmacy/hr/PharmacyPayrollManager';
import { PharmacyDocumentCenter } from '../../components/pharmacy/hr/PharmacyDocumentCenter';
import { useEmployees } from '../../hooks/useData';
import { cn } from '../../utils/helpers';
import type { Employee } from '../../types';

type Tab = 'dashboard' | 'staff' | 'attendance' | 'payroll' | 'compliance';

export default function PharmacyEmployees() {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    const { refetch, isLoading } = useEmployees();

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
        { id: 'dashboard', label: 'Visão Geral', icon: <HiOutlineChartBar className="w-5 h-5" /> },
        { id: 'staff', label: 'Equipe Técnica', icon: <HiOutlineUsers className="w-5 h-5" /> },
        { id: 'attendance', label: 'Controle de Ponto', icon: <HiOutlineCalendar className="w-5 h-5" /> },
        { id: 'payroll', label: 'Processamento Salarial', icon: <HiOutlineBanknotes className="w-5 h-5" /> },
        { id: 'compliance', label: 'Conformidade Legal', icon: <HiOutlineShieldCheck className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader
                title="Recursos Humanos - Farmácia"
                subtitle="Gestão completa de funcionários, assiduidade e conformidade farmacêutica"
                icon={<HiOutlineUsers />}
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => refetch()}
                            leftIcon={<HiOutlineArrowPath />}
                            className="rounded-xl"
                        >
                            Actualizar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleAddEmployee}
                            leftIcon={<HiOutlinePlus />}
                            className="rounded-xl shadow-lg shadow-primary-500/20"
                        >
                            Adicionar Colaborador
                        </Button>
                    </div>
                }
            />

            {/* Premium Tab Navigation */}
            <div className="flex gap-1 p-1 bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700/50 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap uppercase tracking-widest italic font-mono",
                            activeTab === tab.id
                                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white"
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
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

                        {activeTab === 'compliance' && <PharmacyDocumentCenter />}
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
