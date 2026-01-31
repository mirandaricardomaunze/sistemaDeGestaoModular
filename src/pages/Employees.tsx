import { useState } from 'react';
import {
    HiOutlineCalendar,
    HiOutlineUsers,
    HiOutlineChartBar,
    HiOutlineCash,
    HiOutlineCheckCircle,
    HiOutlineShieldCheck,
} from 'react-icons/hi';
import EmployeeList from '../components/employees/EmployeeList';
import EmployeeForm from '../components/employees/EmployeeForm';
import EmployeeAttendance from '../components/employees/EmployeeAttendance';
import EmployeesDashboard from '../components/employees/EmployeesDashboard';
import PayrollManager from '../components/employees/PayrollManager';
import VacationManager from '../components/employees/VacationManager';
import AttendanceControl from '../components/employees/AttendanceControl';
import PermissionMatrix from '../components/employees/PermissionMatrix';
import { cn } from '../utils/helpers';
import type { Employee } from '../types';
import { ExportEmployeesButton } from '../components/common/ExportButton';
import { useEmployees } from '../hooks/useData';

type Tab = 'dashboard' | 'list' | 'attendance' | 'ponto' | 'vacations' | 'payroll' | 'permissions';

export default function Employees() {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Funcionários
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Gerencie sua equipe e recursos humanos
                    </p>
                </div>
                <div className="flex gap-2">
                    <ExportEmployeesButton data={useEmployees().employees} />
                </div>
            </div>

            {/* Responsive Tabs */}
            <div className="border-b border-gray-200 dark:border-dark-700 overflow-x-auto">
                <div className="flex -mb-px min-w-max">
                    {[
                        { id: 'dashboard', label: 'Visão Geral', icon: <HiOutlineChartBar className="w-5 h-5" /> },
                        { id: 'list', label: 'Colaboradores', icon: <HiOutlineUsers className="w-5 h-5" /> },
                        { id: 'attendance', label: 'Assiduidade', icon: <HiOutlineCalendar className="w-5 h-5" /> },
                        { id: 'vacations', label: 'Gestão de Férias', icon: <HiOutlineCalendar className="w-5 h-5" /> },
                        { id: 'ponto', label: 'Área de Ponto', icon: <HiOutlineCheckCircle className="w-5 h-5" /> },
                        { id: 'payroll', label: 'Salários', icon: <HiOutlineCash className="w-5 h-5" /> },
                        { id: 'permissions', label: 'Permissões', icon: <HiOutlineShieldCheck className="w-5 h-5" /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={cn(
                                "px-4 md:px-6 py-4 text-xs md:text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2",
                                activeTab === tab.id
                                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                            )}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {activeTab === 'dashboard' && (
                <EmployeesDashboard
                    onEditEmployee={handleEdit}
                    onAddEmployee={handleAddEmployee}
                />
            )}

            {activeTab === 'list' && (
                <EmployeeList
                    onEdit={handleEdit}
                    onAddEmployee={handleAddEmployee}
                />
            )}

            {activeTab === 'attendance' && <EmployeeAttendance />}
            {activeTab === 'ponto' && <AttendanceControl />}
            {activeTab === 'vacations' && <VacationManager />}
            {activeTab === 'payroll' && <PayrollManager />}
            {activeTab === 'permissions' && <PermissionMatrix />}

            {/* Employee Form Modal */}
            <EmployeeForm
                isOpen={showEmployeeForm}
                onClose={handleCloseForm}
                employee={editingEmployee}
            />
        </div>
    );
}
