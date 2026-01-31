import { useState, useMemo } from 'react';
import { format, getYear, differenceInDays } from 'date-fns';
import {
    HiOutlineCalendar,
    HiOutlinePlus,
    HiOutlineClock,
    HiOutlineTrash,
    HiOutlineSun
} from 'react-icons/hi';
import { useEmployees, useVacations } from '../../hooks/useData';
import { Button, Card, Input, Modal, Select, Pagination, usePagination, ConfirmationModal } from '../ui';
import { generateId } from '../../utils/helpers';
import type { VacationRequest } from '../../types';
import toast from 'react-hot-toast';

export default function VacationManager() {
    const { employees: employeesData } = useEmployees();
    const { vacations: vacationsData, requestVacation: addVacation, updateVacation } = useVacations();
    const employees = Array.isArray(employeesData) ? employeesData : [];
    const vacations = Array.isArray(vacationsData) ? vacationsData : [];
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedYear] = useState(() => new Date().getFullYear());
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [vacationToCancel, setVacationToCancel] = useState<{ id: string, employeeId: string, days: number } | null>(null);

    // Form State
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');

    const activeEmployees = useMemo(() => employees.filter(e => e.isActive), [employees]);

    // Calculate vacation stats per employee
    const employeeVacationStats = useMemo(() => {
        return activeEmployees.map(emp => {
            const total = emp.vacationDaysTotal || 22;
            const used = emp.vacationDaysUsed || 0;
            const remaining = total - used;
            return {
                ...emp,
                stats: { total, used, remaining }
            };
        });
    }, [activeEmployees]);

    const activeVacations = useMemo(() => {
        const year = selectedYear;
        return vacations.filter(v => getYear(new Date(v.startDate)) === year);
    }, [vacations, selectedYear]);

    const vacationsTodayCount = useMemo(() => {
        const today = new Date();
        return vacations.filter(v => {
            return new Date(v.startDate) <= today && new Date(v.endDate) >= today;
        }).length;
    }, [vacations]);

    const employeeNextVacations = useMemo(() => {
        const today = new Date();
        const nextVacationsMap: Record<string, any> = {};

        activeEmployees.forEach(emp => {
            const next = vacations
                .filter(v => v.employeeId === emp.id && new Date(v.startDate) > today)
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
            if (next) nextVacationsMap[emp.id] = next;
        });

        return nextVacationsMap;
    }, [activeEmployees, vacations]);

    // Pagination for employee stats table
    const {
        currentPage: empPage,
        setCurrentPage: setEmpPage,
        itemsPerPage: empPerPage,
        setItemsPerPage: setEmpPerPage,
        paginatedItems: paginatedEmployeeStats,
        totalItems: totalEmpStats,
    } = usePagination(employeeVacationStats, 10);

    // Pagination for vacation history
    const {
        currentPage: vacPage,
        setCurrentPage: setVacPage,
        itemsPerPage: vacPerPage,
        setItemsPerPage: setVacPerPage,
        paginatedItems: paginatedVacations,
        totalItems: totalVacations,
    } = usePagination(activeVacations, 6);

    const handleCreateRequest = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedEmployee || !startDate || !endDate) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = differenceInDays(end, start) + 1;

        if (days <= 0) {
            toast.error('Data de fim deve ser após data de início');
            return;
        }

        const employee = employees.find(e => e.id === selectedEmployee);
        if (!employee) return;

        const currentUsed = employee.vacationDaysUsed || 0;
        const total = employee.vacationDaysTotal || 22;

        if (currentUsed + days > total) {
            toast.error(`Saldo insuficiente. Restam apenas ${total - currentUsed} dias.`);
            return;
        }

        const newRequest: VacationRequest = {
            id: generateId(),
            employeeId: selectedEmployee,
            startDate,
            endDate,
            days,
            status: 'approved', // Auto-approving for now as requested
            notes,
            createdAt: new Date().toISOString()
        };

        addVacation(newRequest);

        // Note: Employee vacation balance is handled by backend

        toast.success('Férias agendadas com sucesso!');
        setShowRequestModal(false);
        resetForm();
    };

    const handleDeleteVacation = async (id: string, employeeId: string, days: number) => {
        setVacationToCancel({ id, employeeId, days });
        setCancelConfirmOpen(true);
    };

    const performCancelVacation = async () => {
        if (!vacationToCancel) return;
        try {
            await updateVacation(vacationToCancel.id, { status: 'rejected' });
            toast.success('Férias canceladas. O saldo foi devolvido.');
            setCancelConfirmOpen(false);
            setVacationToCancel(null);
        } catch (error) {
            toast.error('Erro ao cancelar férias');
        }
    };

    const resetForm = () => {
        setSelectedEmployee('');
        setStartDate('');
        setEndDate('');
        setNotes('');
    };

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Férias Agendadas ({selectedYear})</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                {activeVacations.length}
                            </p>
                        </div>
                        <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl backdrop-blur-sm">
                            <HiOutlineCalendar className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>
                </Card>
                <Card padding="md" className="bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Colaboradores em Férias Hoje</p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                {vacationsTodayCount}
                            </p>
                        </div>
                        <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl backdrop-blur-sm">
                            <HiOutlineSun className="w-8 h-8 text-green-500" />
                        </div>
                    </div>
                </Card>
                <Card padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Dias Gozados</p>
                            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                                {activeEmployees.reduce((acc, curr) => acc + (curr.vacationDaysUsed || 0), 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                            <HiOutlineClock className="w-8 h-8 text-gray-500" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Actions */}
            <Card padding="md">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Mapa de Férias</h3>
                    <Button onClick={() => setShowRequestModal(true)} leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                        Agendar Férias
                    </Button>
                </div>
            </Card>

            {/* Employee Balance List */}
            <Card padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-dark-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Colaborador</th>
                                <th className="px-4 py-3 text-center">Direito Anual</th>
                                <th className="px-4 py-3 text-center">Gozados</th>
                                <th className="px-4 py-3 text-center">Saldo Restante</th>
                                <th className="px-4 py-3">Próximas Férias</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {paginatedEmployeeStats.map((emp) => {
                                const nextVacation = employeeNextVacations[emp.id];

                                return (
                                    <tr key={emp.id} className="bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                            {emp.name}
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                            {emp.stats.total} dias
                                        </td>
                                        <td className="px-4 py-3 text-center text-orange-600 font-medium">
                                            {emp.stats.used} dias
                                        </td>
                                        <td className="px-4 py-3 text-center text-green-600 font-bold">
                                            {emp.stats.remaining} dias
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {nextVacation ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                    {format(new Date(nextVacation.startDate), 'dd/MM/yyyy')}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedEmployee(emp.id);
                                                    setShowRequestModal(true);
                                                }}
                                                className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 font-medium text-sm"
                                            >
                                                Agendar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="px-6">
                    <Pagination
                        currentPage={empPage}
                        totalItems={totalEmpStats}
                        itemsPerPage={empPerPage}
                        onPageChange={setEmpPage}
                        onItemsPerPageChange={setEmpPerPage}
                    />
                </div>
            </Card>

            {/* Recent Vacations List */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white px-1">Histórico de Agendamentos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedVacations.length === 0 && (
                        <p className="col-span-full text-center text-gray-500 py-8">Nenhum agendamento encontrado para este ano.</p>
                    )}
                    {paginatedVacations.map(vacation => {
                        const employee = employees.find(e => e.id === vacation.employeeId);
                        return (
                            <Card key={vacation.id} padding="md" className="relative group">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDeleteVacation(vacation.id, vacation.employeeId, vacation.days)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">
                                        {employee?.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{employee?.name}</p>
                                        <p className="text-xs text-gray-500">{vacation.days} dias</p>
                                    </div>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex justify-between">
                                        <span>Início:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{format(new Date(vacation.startDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Fim:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{format(new Date(vacation.endDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                    {vacation.notes && (
                                        <p className="pt-2 text-xs italic border-t border-gray-100 dark:border-dark-700 mt-2">
                                            "{vacation.notes}"
                                        </p>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>

                <Pagination
                    currentPage={vacPage}
                    totalItems={totalVacations}
                    itemsPerPage={vacPerPage}
                    onPageChange={setVacPage}
                    onItemsPerPageChange={setVacPerPage}
                    itemsPerPageOptions={[6, 12, 24]}
                />
            </div>

            {/* Add Vacation Modal */}
            <Modal
                isOpen={showRequestModal}
                onClose={() => {
                    setShowRequestModal(false);
                    resetForm();
                }}
                title="Agendar Férias"
                size="md"
            >
                <form onSubmit={handleCreateRequest} className="space-y-4">
                    <Select
                        label="Colaborador"
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        options={activeEmployees.map(e => ({ value: e.id, label: `${e.name} (Restam ${((e.vacationDaysTotal || 22) - (e.vacationDaysUsed || 0))} dias)` }))}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data Início"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                        <Input
                            label="Data Fim"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </div>

                    <Input
                        label="Observações"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Viagem familiar"
                    />

                    <div className="flex gap-4 pt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setShowRequestModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1">
                            Confirmar Agendamento
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Cancel Vacation Confirmation Modal */}
            <ConfirmationModal
                isOpen={cancelConfirmOpen}
                onClose={() => {
                    setCancelConfirmOpen(false);
                    setVacationToCancel(null);
                }}
                onConfirm={performCancelVacation}
                title="Cancelar Férias?"
                message="Tem certeza que deseja cancelar estas férias? O saldo de dias será devolvido ao colaborador."
                confirmText="Sim, Cancelar Férias"
                cancelText="Não Cancelar"
                variant="warning"
            />
        </div>
    );
}
