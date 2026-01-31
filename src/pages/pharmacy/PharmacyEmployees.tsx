import { useState } from 'react';
import { HiOutlineCalendar, HiOutlineUsers, HiOutlineChartBar, HiOutlineCash } from 'react-icons/hi';
import EmployeeList from '../../components/employees/EmployeeList';
import EmployeeForm from '../../components/employees/EmployeeForm';
import EmployeeAttendance from '../../components/employees/EmployeeAttendance';
import EmployeesDashboard from '../../components/employees/EmployeesDashboard';
import PayrollManager from '../../components/employees/PayrollManager';
import VacationManager from '../../components/employees/VacationManager';
import { Button } from '../../components/ui';
import type { Employee } from '../../types';

type Tab = 'dashboard' | 'list' | 'attendance' | 'vacations' | 'payroll';

/**
 * PharmacyEmployees Component
 * 
 * Complete HR management system for pharmacy module with:
 * - Dashboard with KPIs and metrics
 * - Employee list with CRUD operations
 * - Attendance tracking
 * - Vacation management
 * - Payroll processing
 * 
 * Reuses existing HR components from src/components/employees/
 * maintaining consistency across modules while providing pharmacy-specific context.
 */
export default function PharmacyEmployees() {
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
                        Recursos Humanos - Farmácia
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Gestão completa de funcionários e equipe da farmácia
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={activeTab === 'dashboard' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('dashboard')}
                        leftIcon={<HiOutlineChartBar className="w-4 h-4" />}
                    >
                        Visão Geral
                    </Button>
                    <Button
                        variant={activeTab === 'list' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('list')}
                        leftIcon={<HiOutlineUsers className="w-4 h-4" />}
                    >
                        Colaboradores
                    </Button>
                    <Button
                        variant={activeTab === 'attendance' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('attendance')}
                        leftIcon={<HiOutlineCalendar className="w-4 h-4" />}
                    >
                        Assiduidade
                    </Button>
                    <Button
                        variant={activeTab === 'vacations' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('vacations')}
                        leftIcon={<HiOutlineCalendar className="w-4 h-4" />}
                    >
                        Gestão de Férias
                    </Button>
                    <Button
                        variant={activeTab === 'payroll' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('payroll')}
                        leftIcon={<HiOutlineCash className="w-4 h-4" />}
                    >
                        Salários
                    </Button>
                </div>
            </div>

            {/* Tab Content */}
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

            {activeTab === 'vacations' && <VacationManager />}

            {activeTab === 'payroll' && <PayrollManager />}

            {/* Employee Form Modal */}
            <EmployeeForm
                isOpen={showEmployeeForm}
                onClose={handleCloseForm}
                employee={editingEmployee}
            />
        </div>
    );
}
