import { useState } from 'react';
import { PageHeader, Button } from '../../components/ui';
import EmployeeList from '../../components/employees/EmployeeList';
import EmployeeForm from '../../components/employees/EmployeeForm';
import { CommercialHRDashboard } from '../../components/commercial/hr/CommercialHRDashboard';
import { CommercialAttendanceControl } from '../../components/commercial/hr/CommercialAttendanceControl';
import { CommercialPayrollManager } from '../../components/commercial/hr/CommercialPayrollManager';
import { CommercialDocumentCenter } from '../../components/commercial/hr/CommercialDocumentCenter';
import { CommercialPerformanceTracker } from '../../components/commercial/hr/CommercialPerformanceTracker';
import { CommercialVacationManager } from '../../components/commercial/hr/CommercialVacationManager';
import { CommercialBonusConfig } from '../../components/commercial/hr/CommercialBonusConfig';
import {
    HiOutlineUsers,
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineChartPie,
    HiOutlineClock,
    HiOutlineBanknotes,
    HiOutlineShieldCheck,
    HiOutlineChartBar,
    HiOutlineSun,
    HiOutlineAdjustmentsHorizontal,
} from 'react-icons/hi2';
import type { Employee } from '../../types';

const TABS = [
    { id: 'dashboard', label: 'dashboard', icon: HiOutlineChartPie },
    { id: 'performance', label: 'Performance', icon: HiOutlineChartBar },
    { id: 'team', label: 'Equipa', icon: HiOutlineUsers },
    { id: 'payroll', label: 'Processamento', icon: HiOutlineBanknotes },
    { id: 'vacations', label: 'Férias', icon: HiOutlineSun },
    { id: 'attendance', label: 'Assiduidade', icon: HiOutlineClock },
    { id: 'config', label: 'Configurações', icon: HiOutlineAdjustmentsHorizontal },
    { id: 'compliance', label: 'Conformidade', icon: HiOutlineShieldCheck },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CommercialEmployees() {
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        setShowForm(true);
    };

    const handleAdd = () => {
        setEditingEmployee(null);
        setShowForm(true);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Component imports will be added when created */}
            <PageHeader
                title="RH Comercial &amp; Professional"
                subtitle="Gestão avançada de talentos, performance e comissões"
                icon={<HiOutlineUsers />}
                actions={
                    <div className="flex gap-2">
                        {activeTab === 'team' && (
                            <Button
                                variant="primary"
                                leftIcon={<HiOutlinePlus />}
                                onClick={handleAdd}
                            >
                                Adicionar Colaborador
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlineArrowPath />}
                            onClick={() => window.location.reload()}
                        >
                            Sincronizar
                        </Button>
                    </div>
                }
            />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-lg overflow-x-auto scroller-hidden">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 flex-1 justify-center
                                ${activeTab === tab.id
                                    ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm border border-primary-50 dark:border-primary-900/30'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px] animate-fade-in transition-all duration-300">
                {activeTab === 'dashboard' && <CommercialHRDashboard />}

                {activeTab === 'team' && (
                    <EmployeeList
                        department="Comercial"
                        onEdit={handleEdit}
                        onAddEmployee={handleAdd}
                    />
                )}

                {activeTab === 'attendance' && <CommercialAttendanceControl />}

                {activeTab === 'payroll' && <CommercialPayrollManager />}

                {activeTab === 'compliance' && <CommercialDocumentCenter />}

                {activeTab === 'performance' && <CommercialPerformanceTracker />}

                {activeTab === 'vacations' && <CommercialVacationManager />}

                {activeTab === 'config' && <CommercialBonusConfig />}
            </div>

            <EmployeeForm
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditingEmployee(null); }}
                employee={editingEmployee}
            />
        </div>
    );
}
