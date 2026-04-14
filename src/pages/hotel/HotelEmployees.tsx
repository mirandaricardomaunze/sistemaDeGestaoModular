import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Button } from '../../components/ui';
import EmployeeList from '../../components/employees/EmployeeList';
import EmployeeForm from '../../components/employees/EmployeeForm';
import { HiOutlineUserGroup, HiOutlinePlus } from 'react-icons/hi2';
import type { Employee } from '../../types';

export default function HotelEmployees() {
    const { t } = useTranslation();
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
        <div className="space-y-6">
            <PageHeader
                title={t('nav.employees')}
                subtitle="Equipa e colaboradores afectos à hotelaria"
                icon={<HiOutlineUserGroup />}
                actions={
                    <Button 
                        variant="primary" 
                        leftIcon={<HiOutlinePlus />}
                        onClick={handleAdd}
                    >
                        Adicionar Colaborador
                    </Button>
                }
            />
            
            <EmployeeList 
                department="Hospitalidade"
                onEdit={handleEdit}
            />

            <EmployeeForm
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                employee={editingEmployee}
            />
        </div>
    );
}
