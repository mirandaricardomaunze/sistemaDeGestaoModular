import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { cn } from '../../utils/helpers';

const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: HiOutlineChartPie },
    { id: 'performance', label: 'Performance', icon: HiOutlineChartBar },
    { id: 'team', label: 'Equipa', icon: HiOutlineUsers },
    { id: 'payroll', label: 'Processamento', icon: HiOutlineBanknotes },
    { id: 'vacations', label: 'Férias', icon: HiOutlineSun },
    { id: 'attendance', label: 'Assiduidade', icon: HiOutlineClock },
    { id: 'config', label: 'Configurações', icon: HiOutlineAdjustmentsHorizontal },
    { id: 'compliance', label: 'Conformidade', icon: HiOutlineShieldCheck },
] as const;

type TabId = typeof TABS[number]['id'];

export default function HRHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';
    
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    const setActiveTab = (tab: TabId) => {
        setSearchParams({ tab });
    };

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
            <PageHeader
                title="Recursos Humanos"
                subtitle="Gestão estratégica de talentos, performance e processamento"
                icon={<HiOutlineUsers className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <div className="flex gap-2">
                        {activeTab === 'team' && (
                            <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<HiOutlinePlus />}
                                onClick={handleAdd}
                            >
                                Adicionar Colaborador
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<HiOutlineArrowPath className="text-primary-600" />}
                            onClick={() => window.location.reload()}
                        >
                            Sincronizar
                        </Button>
                    </div>
                }
            />

            {/* Premium Tab Navigation (Segmented Control style) */}
            <div className="flex p-1 bg-gray-100/80 dark:bg-dark-800/80 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-dark-700/50 shadow-inner overflow-x-auto scroller-hidden">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex-1 justify-center whitespace-nowrap",
                                isActive
                                    ? "bg-white dark:bg-dark-700 text-primary-600 dark:text-white shadow-lg shadow-black/5 scale-[1.02]"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            <Icon className={cn("w-4 h-4", isActive ? "text-primary-600 dark:text-primary-400" : "opacity-50")} />
                            <span>{tab.label}</span>
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
