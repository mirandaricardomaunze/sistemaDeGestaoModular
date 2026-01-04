import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineDownload,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineCalendar,
    HiOutlineViewList,
    HiOutlineUsers,
} from 'react-icons/hi';
import { useEmployees, useAttendance } from '../../hooks/useData';
import { Button, Card, Pagination, usePagination } from '../ui';
import { cn, exportToCSV } from '../../utils/helpers';
import type { AttendanceRecord } from '../../types';
import toast from 'react-hot-toast';

export default function EmployeeAttendance() {
    const { employees: employeesData } = useEmployees();
    const { attendance: attendanceData, recordAttendance } = useAttendance();
    const employees = Array.isArray(employeesData) ? employeesData : [];
    const attendance = Array.isArray(attendanceData) ? attendanceData : [];
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [listFilter, setListFilter] = useState<'all' | 'present' | 'absent' | 'vacation'>('all');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Get active employees only
    const activeEmployees = useMemo(() => {
        return employees.filter((e) => e.isActive);
    }, [employees]);

    // Filtered employees based on list filter
    const filteredEmployees = useMemo(() => {
        return activeEmployees.filter(emp => {
            if (listFilter === 'all') return true;
            const status = getStatus(emp.id, selectedDate);
            return status === listFilter;
        });
    }, [activeEmployees, listFilter, selectedDate, attendance]);

    // Pagination for employee list
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedEmployees,
        totalItems,
    } = usePagination(filteredEmployees, 10);

    // Get attendance for a specific employee on selected date
    const getEmployeeAttendance = (employeeId: string, date: Date): AttendanceRecord | undefined => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return attendance.find(
            (a) => a.employeeId === employeeId && a.date === dateStr
        );
    };

    // Check if employee is present
    const getStatus = (employeeId: string, date: Date): 'present' | 'absent' | 'vacation' => {
        const record = getEmployeeAttendance(employeeId, date);
        if (record?.status === 'present') return 'present';
        if (record?.status === 'vacation') return 'vacation';
        return 'absent';
    };

    // Toggle attendance for employee
    const toggleAttendance = (employeeId: string, type: 'present' | 'vacation' = 'present') => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const existingRecord = getEmployeeAttendance(employeeId, selectedDate);

        if (existingRecord) {
            // If clicking same type, toggle off (remove record or mark absent)
            // If clicking different type, switch to that type
            let newStatus: any = 'absent';

            if (type === 'present') {
                newStatus = existingRecord.status === 'present' ? 'absent' : 'present';
            } else if (type === 'vacation') {
                newStatus = existingRecord.status === 'vacation' ? 'absent' : 'vacation';
            }

            // Use recordAttendance to update (backend handles update vs create)
            recordAttendance({
                employeeId,
                date: dateStr,
                status: newStatus,
                checkIn: newStatus === 'present' ? format(new Date(), 'HH:mm') : undefined,
            });

            if (newStatus === 'present') toast.success('Registo de presença efetuado com sucesso!');
            else if (newStatus === 'vacation') toast.success('Colaborador marcado em férias!');
            else toast.success('Registo removido!');

        } else {
            // Create new attendance record
            recordAttendance({
                employeeId,
                date: dateStr,
                status: type,
                checkIn: type === 'present' ? format(new Date(), 'HH:mm') : undefined,
            });
            if (type === 'present') toast.success('Registo de presença efetuado com sucesso!');
            else toast.success('Colaborador marcado em férias!');
        }
    };

    // Navigate dates (List Mode)
    const goToPreviousDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() - 1);
        setSelectedDate(newDate);
    };

    const goToNextDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + 1);
        setSelectedDate(newDate);
    };

    const goToToday = () => {
        const today = new Date();
        setSelectedDate(today);
        setCurrentMonth(today);
    };

    // Navigate Month (Calendar Mode)
    const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Calculate summary for a specific date
    const getSummary = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayRecords = attendance.filter((a) => a.date === dateStr);
        const presentCount = dayRecords.filter((a) => a.status === 'present').length;
        const vacationCount = dayRecords.filter((a) => a.status === 'vacation').length;

        return {
            total: activeEmployees.length,
            present: presentCount,
            vacation: vacationCount,
            absent: activeEmployees.length - presentCount - vacationCount,
        };
    };

    const currentSummary = useMemo(() => getSummary(selectedDate), [attendance, selectedDate, activeEmployees]);

    // Export attendance
    const handleExport = () => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const exportData = activeEmployees.map((emp) => {
            const status = getStatus(emp.id, selectedDate);
            const record = getEmployeeAttendance(emp.id, selectedDate);
            let statusLabel = 'Ausente';
            if (status === 'present') statusLabel = 'Presente';
            if (status === 'vacation') statusLabel = 'Férias';

            return {
                Nome: emp.name,
                Cargo: emp.role,
                Departamento: emp.department,
                Status: statusLabel,
                Entrada: record?.checkIn || '-',
            };
        });

        exportToCSV(exportData, `presenca-${dateStr}`);
        toast.success('Relatório exportado!');
    };

    // Calendar Generation
    const calendarDays = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const days = eachDayOfInterval({ start, end });

        // Add padding days for start of week if needed
        const startDay = getDay(start); // 0 = Sunday
        const paddingDays = Array(startDay).fill(null);

        return [...paddingDays, ...days];
    }, [currentMonth]);

    const isToday = isSameDay(selectedDate, new Date());

    return (
        <div className="space-y-6">
            {/* Header / Navigation */}
            <Card padding="md">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {viewMode === 'list' ? (
                            <>
                                <button onClick={goToPreviousDay} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                                    <HiOutlineChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
                                    {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                </h2>
                                <button onClick={goToNextDay} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                                    <HiOutlineChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={goToPreviousMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                                    <HiOutlineChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white min-w-[200px] text-center capitalize">
                                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                                </h2>
                                <button onClick={goToNextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                                    <HiOutlineChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <div className="flex bg-gray-100 dark:bg-dark-700 rounded-lg p-1 mr-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    "p-1.5 rounded-md transition-all flex items-center gap-1 text-sm font-medium",
                                    viewMode === 'list'
                                        ? "bg-white dark:bg-dark-600 text-primary-600 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                )}
                            >
                                <HiOutlineViewList className="w-4 h-4" />
                                Diário
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={cn(
                                    "p-1.5 rounded-md transition-all flex items-center gap-1 text-sm font-medium",
                                    viewMode === 'calendar'
                                        ? "bg-white dark:bg-dark-600 text-primary-600 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                )}
                            >
                                <HiOutlineCalendar className="w-4 h-4" />
                                Mensal
                            </button>
                        </div>

                        {!isToday && (
                            <Button variant="outline" size="sm" onClick={goToToday}>
                                Hoje
                            </Button>
                        )}
                        {viewMode === 'list' && (
                            <Button variant="outline" size="sm" onClick={handleExport}>
                                <HiOutlineDownload className="w-4 h-4 mr-2" />
                                Exportar
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {viewMode === 'list' ? (
                <>
                    {/* List Mode Content */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card padding="md" className="relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                                        {currentSummary.total}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                                </div>
                                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                                    <HiOutlineUsers className="w-6 h-6 text-primary-500" />
                                </div>
                            </div>
                        </Card>
                        <Card padding="md" className="relative overflow-hidden border-l-4 border-l-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-3xl font-bold text-green-600">
                                        {currentSummary.present}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Presentes</p>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                                    <HiOutlineCheck className="w-6 h-6 text-green-500" />
                                </div>
                            </div>
                        </Card>
                        <Card padding="md" className="relative overflow-hidden border-l-4 border-l-orange-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-3xl font-bold text-orange-600">
                                        {currentSummary.vacation}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Em Férias</p>
                                </div>
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                                    <HiOutlineCalendar className="w-6 h-6 text-orange-500" />
                                </div>
                            </div>
                        </Card>
                        <Card padding="md" className="relative overflow-hidden border-l-4 border-l-red-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-3xl font-bold text-red-600">
                                        {currentSummary.absent}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Ausentes</p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                    <HiOutlineX className="w-6 h-6 text-red-500" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700 pb-2 overflow-x-auto">
                        <button
                            onClick={() => setListFilter('all')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                listFilter === 'all'
                                    ? "bg-gray-100 text-gray-900 dark:bg-dark-700 dark:text-white"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setListFilter('present')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                listFilter === 'present'
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            Presentes
                        </button>
                        <button
                            onClick={() => setListFilter('vacation')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                listFilter === 'vacation'
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            Em Férias
                        </button>
                        <button
                            onClick={() => setListFilter('absent')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                listFilter === 'absent'
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            Ausentes
                        </button>
                    </div>

                    <Card padding="none">
                        <div className="divide-y divide-gray-200 dark:divide-dark-700 max-h-[600px] overflow-y-auto">
                            {paginatedEmployees.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    Nenhum funcionário encontrado
                                </div>
                            ) : (
                                paginatedEmployees.map((employee) => {
                                    const status = getStatus(employee.id, selectedDate);
                                    const record = getEmployeeAttendance(employee.id, selectedDate);

                                    return (
                                        <div
                                            key={employee.id}
                                            className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                                                        {employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {employee.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {employee.department}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {status === 'present' && record?.checkIn && (
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">Entrada</p>
                                                        <p className="font-medium text-gray-900 dark:text-white">
                                                            {record.checkIn}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Vacation Toggle */}
                                                <button
                                                    onClick={() => toggleAttendance(employee.id, 'vacation')}
                                                    className={cn(
                                                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                                                        status === 'vacation'
                                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-dark-800'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600 dark:bg-dark-700 dark:text-gray-400 dark:hover:bg-dark-600'
                                                    )}
                                                    title={status === 'vacation' ? 'Remover Férias' : 'Marcar Férias'}
                                                >
                                                    Férias
                                                </button>

                                                {/* Presence Toggle */}
                                                <button
                                                    onClick={() => toggleAttendance(employee.id, 'present')}
                                                    className={cn(
                                                        'w-14 h-14 rounded-xl flex items-center justify-center transition-all transform hover:scale-105',
                                                        status === 'present'
                                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                                            : 'bg-gray-100 dark:bg-dark-700 text-gray-400 hover:bg-green-100 hover:text-green-500 dark:hover:bg-green-900/20'
                                                    )}
                                                    title={status === 'present' ? 'Remover Presença' : 'Marcar Presença'}
                                                >
                                                    {status === 'present' ? <HiOutlineCheck className="w-7 h-7" /> : <HiOutlineCheck className="w-7 h-7 opacity-20" />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="px-6">
                            <Pagination
                                currentPage={currentPage}
                                totalItems={totalItems}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        </div>
                    </Card>
                </>
            ) : (
                /* Calendar Mode Content */
                <Card padding="md">
                    <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-dark-600 rounded-lg overflow-hidden border border-gray-200 dark:border-dark-600">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                            <div key={day} className="bg-gray-50 dark:bg-dark-700 p-2 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                                {day}
                            </div>
                        ))}

                        {calendarDays.map((date, i) => {
                            if (!date) return <div key={`pad-${i}`} className="bg-white dark:bg-dark-800 min-h-[100px]" />;

                            const summary = getSummary(date);
                            const isSelected = isSameDay(date, selectedDate);
                            const isTodayDate = isSameDay(date, new Date());

                            return (
                                <button
                                    key={date.toISOString()}
                                    onClick={() => {
                                        setSelectedDate(date);
                                        setViewMode('list');
                                    }}
                                    className={cn(
                                        "bg-white dark:bg-dark-800 min-h-[100px] p-2 flex flex-col items-start justify-between hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-left",
                                        isSelected && "ring-2 ring-inset ring-primary-500",
                                        isTodayDate && "bg-blue-50 dark:bg-blue-900/10"
                                    )}
                                >
                                    <span className={cn(
                                        "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                        isTodayDate ? "bg-primary-600 text-white" : "text-gray-700 dark:text-gray-300"
                                    )}>
                                        {format(date, 'd')}
                                    </span>

                                    {summary.present > 0 && (
                                        <div className="mt-2 w-full">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                {summary.present} Presentes
                                            </span>
                                        </div>
                                    )}
                                    {summary.absent > 0 && summary.present === 0 && (
                                        <div className="mt-2 w-full">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                -
                                            </span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
}
