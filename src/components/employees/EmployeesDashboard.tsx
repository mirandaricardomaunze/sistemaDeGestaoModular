import { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    type SortingState,
} from '@tanstack/react-table';
import {
    HiOutlineUsers,
    HiOutlineUserAdd,
    HiOutlineClock,
    HiOutlineCheck,
    HiOutlineFilter,
    HiOutlinePencil,
    HiOutlineMail,
    HiOutlinePhone,
    HiOutlineCurrencyDollar,
    HiOutlineAcademicCap,
    HiOutlineCalendar,
    HiOutlineExclamation,
} from 'react-icons/hi';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import { Card, Button, Badge, Input, Select, Pagination } from '../ui';
import { useEmployees, useAttendance } from '../../hooks/useData';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../common/SmartInsightCard';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { formatCurrency, cn } from '../../utils/helpers';
import type { Employee, EmployeeRole, EducationLevel } from '../../types';

const columnHelper = createColumnHelper<Employee>();

interface EmployeesDashboardProps {
    onEditEmployee: (employee: Employee) => void;
    onAddEmployee: () => void;
}

const roleConfig: Record<EmployeeRole, { label: string; color: string }> = {
    super_admin: { label: 'Super Admin', color: 'danger' },
    admin: { label: 'Administrador', color: 'primary' },
    manager: { label: 'Gerente', color: 'info' },
    operator: { label: 'Operador', color: 'success' },
    cashier: { label: 'Caixa', color: 'warning' },
    stock_keeper: { label: 'Estoquista', color: 'gray' },
};

const educationLevelLabels: Record<EducationLevel, string> = {
    ensino_fundamental: 'Fundamental',
    ensino_medio: 'Médio',
    tecnico: 'Técnico',
    graduacao: 'Graduação',
    pos_graduacao: 'Pós-Grad',
    mestrado: 'Mestrado',
    doutorado: 'Doutorado',
};

const educationLevelOrder: EducationLevel[] = [
    'ensino_fundamental',
    'ensino_medio',
    'tecnico',
    'graduacao',
    'pos_graduacao',
    'mestrado',
    'doutorado',
];

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// Time period options
type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

export default function EmployeesDashboard({ onEditEmployee, onAddEmployee }: EmployeesDashboardProps) {
    // Use data hooks instead of store
    const { employees: employeesData } = useEmployees();
    const { attendance: attendanceData } = useAttendance();
    const { insights } = useSmartInsights();

    // Ensure arrays are never undefined
    const employees = Array.isArray(employeesData) ? employeesData : [];
    const attendance = Array.isArray(attendanceData) ? attendanceData : [];

    const [sorting, setSorting] = useState<SortingState>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [qualificationFilter, setQualificationFilter] = useState<string>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');

    // Get highest qualification for an employee
    const getHighestQualification = (employee: Employee): EducationLevel | null => {
        if (!employee.qualifications || employee.qualifications.length === 0) {
            return null;
        }
        const completed = employee.qualifications.filter(q => q.isCompleted);
        if (completed.length === 0) {
            // Get highest from all if none completed
            return employee.qualifications.reduce((highest, q) => {
                const currentIndex = educationLevelOrder.indexOf(q.level);
                const highestIndex = educationLevelOrder.indexOf(highest);
                return currentIndex > highestIndex ? q.level : highest;
            }, employee.qualifications[0].level);
        }
        return completed.reduce((highest, q) => {
            const currentIndex = educationLevelOrder.indexOf(q.level);
            const highestIndex = educationLevelOrder.indexOf(highest);
            return currentIndex > highestIndex ? q.level : highest;
        }, completed[0].level);
    };

    // Calculate metrics including qualification stats and HR metrics
    const metrics = useMemo(() => {
        const active = employees.filter((e) => e.isActive);
        const inactive = employees.filter((e) => !e.isActive);
        const todayRecords = attendance.filter((a) => a.date === format(new Date(), 'yyyy-MM-dd'));
        const presentToday = todayRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
        const totalSalary = active.reduce((sum, e) => sum + e.salary, 0);

        // Period multiplier for salary projection
        const periodMultiplier = selectedPeriod === '1m' ? 1 : selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12;

        // Qualification stats
        const withQualifications = active.filter(e => e.qualifications && e.qualifications.length > 0);
        const withHigherEd = active.filter(e => {
            const highest = getHighestQualification(e);
            if (!highest) return false;
            return educationLevelOrder.indexOf(highest) >= educationLevelOrder.indexOf('graduacao');
        });

        // Age calculations - Young (<30) and Senior (>50)
        const now = new Date();
        const getAge = (birthDate: string | undefined) => {
            if (!birthDate) return null;
            const birth = new Date(birthDate);
            let age = now.getFullYear() - birth.getFullYear();
            const m = now.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        };

        const employeesWithAge = active.filter(e => e.birthDate);
        const youngEmployees = employeesWithAge.filter(e => {
            const age = getAge(e.birthDate);
            return age !== null && age < 30;
        });
        const seniorEmployees = employeesWithAge.filter(e => {
            const age = getAge(e.birthDate);
            return age !== null && age >= 50;
        });

        // Years of service calculation
        const getYearsOfService = (hireDate: string) => {
            const hire = new Date(hireDate);
            let years = now.getFullYear() - hire.getFullYear();
            const m = now.getMonth() - hire.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < hire.getDate())) {
                years--;
            }
            return Math.max(0, years);
        };

        const totalYearsOfService = active.reduce((sum, e) => sum + getYearsOfService(e.hireDate), 0);
        const avgYearsOfService = active.length > 0 ? (totalYearsOfService / active.length).toFixed(1) : '0';

        // Attendance stats - Punctual (no late arrivals) and Absent employees in period
        const periodMonths = selectedPeriod === '1m' ? 1 : selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12;
        const periodStart = new Date();
        periodStart.setMonth(periodStart.getMonth() - periodMonths);

        const periodAttendance = attendance.filter(a => new Date(a.date) >= periodStart);

        // Group attendance by employee
        const attendanceByEmployee: Record<string, { late: number; absent: number }> = {};
        periodAttendance.forEach(a => {
            if (!attendanceByEmployee[a.employeeId]) {
                attendanceByEmployee[a.employeeId] = { late: 0, absent: 0 };
            }
            if (a.status === 'late') attendanceByEmployee[a.employeeId].late++;
            if (a.status === 'absent') attendanceByEmployee[a.employeeId].absent++;
        });

        const punctualEmployees = active.filter(e => {
            const record = attendanceByEmployee[e.id];
            return !record || record.late === 0;
        });

        const absentEmployees = active.filter(e => {
            const record = attendanceByEmployee[e.id];
            return record && record.absent > 0;
        });

        return {
            total: employees.length,
            active: active.length,
            inactive: inactive.length,
            presentToday,
            totalSalary: totalSalary * periodMultiplier,
            withQualifications: withQualifications.length,
            withHigherEd: withHigherEd.length,
            // New HR metrics
            youngEmployees: youngEmployees.length,
            seniorEmployees: seniorEmployees.length,
            avgYearsOfService,
            punctualEmployees: punctualEmployees.length,
            absentEmployees: absentEmployees.length,
        };
    }, [employees, attendance, selectedPeriod]);

    // Role distribution for pie chart
    const roleDistribution = useMemo(() => {
        const distribution: Record<string, number> = {};
        employees.filter(e => e.isActive).forEach((employee) => {
            distribution[employee.role] = (distribution[employee.role] || 0) + 1;
        });
        return Object.entries(distribution).map(([role, count]) => ({
            name: roleConfig[role as EmployeeRole]?.label || role,
            value: count,
        }));
    }, [employees]);

    // Qualification distribution for bar chart
    const qualificationDistribution = useMemo(() => {
        const distribution: Record<string, number> = {};
        employees.filter(e => e.isActive).forEach((employee) => {
            const highest = getHighestQualification(employee);
            const level = highest ? educationLevelLabels[highest] : 'Sem formação';
            distribution[level] = (distribution[level] || 0) + 1;
        });
        return Object.entries(distribution).map(([level, count]) => ({
            nivel: level,
            funcionarios: count,
        }));
    }, [employees]);

    // Get unique departments for filter
    const departments = useMemo(() => {
        const depts = new Set(employees.map((e) => e.department).filter(Boolean));
        return Array.from(depts);
    }, [employees]);

    // Filtered employees
    const filteredEmployees = useMemo(() => {
        return employees.filter((employee) => {
            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (
                    !employee.name.toLowerCase().includes(search) &&
                    !employee.email.toLowerCase().includes(search) &&
                    !employee.code.toLowerCase().includes(search)
                ) {
                    return false;
                }
            }

            // Role filter
            if (roleFilter !== 'all' && employee.role !== roleFilter) {
                return false;
            }

            // Status filter
            if (statusFilter !== 'all') {
                if (statusFilter === 'active' && !employee.isActive) return false;
                if (statusFilter === 'inactive' && employee.isActive) return false;
            }

            // Department filter
            if (departmentFilter !== 'all' && employee.department !== departmentFilter) {
                return false;
            }

            // Qualification filter
            if (qualificationFilter !== 'all') {
                const highest = getHighestQualification(employee);
                if (qualificationFilter === 'none' && highest) return false;
                if (qualificationFilter === 'has_any' && !highest) return false;
                if (qualificationFilter === 'higher_ed') {
                    if (!highest) return false;
                    if (educationLevelOrder.indexOf(highest) < educationLevelOrder.indexOf('graduacao')) return false;
                }
                if (educationLevelOrder.includes(qualificationFilter as EducationLevel)) {
                    if (highest !== qualificationFilter) return false;
                }
            }

            return true;
        });
    }, [employees, searchTerm, roleFilter, statusFilter, departmentFilter, qualificationFilter]);

    // Define table columns
    const columns = useMemo(
        () => [
            columnHelper.accessor('name', {
                header: 'Funcionário',
                cell: (info) => (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                {info.getValue().split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </span>
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">{info.getValue()}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{info.row.original.code}</p>
                        </div>
                    </div>
                ),
            }),
            columnHelper.accessor('role', {
                header: 'Cargo',
                cell: (info) => (
                    <Badge variant={roleConfig[info.getValue()]?.color as any || 'gray'}>
                        {roleConfig[info.getValue()]?.label || info.getValue()}
                    </Badge>
                ),
            }),
            columnHelper.display({
                id: 'qualification',
                header: 'Qualificação',
                cell: ({ row }) => {
                    const highestQualification = getHighestQualification(row.original);
                    const qualificationCount = row.original.qualifications?.length || 0;

                    return highestQualification ? (
                        <div className="flex items-center gap-2">
                            <HiOutlineAcademicCap className="w-4 h-4 text-purple-500 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {educationLevelLabels[highestQualification]}
                                </p>
                                {qualificationCount > 1 && (
                                    <p className="text-xs text-gray-500">
                                        +{qualificationCount - 1} formação
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <span className="text-gray-400 text-sm">Não informada</span>
                    );
                },
            }),
            columnHelper.display({
                id: 'contact',
                header: 'Contato',
                cell: ({ row }) => (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <HiOutlineMail className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">{row.original.email}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <HiOutlinePhone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{row.original.phone}</span>
                        </div>
                    </div>
                ),
            }),
            columnHelper.accessor('isActive', {
                header: 'Status',
                cell: (info) => (
                    <Badge variant={info.getValue() ? 'success' : 'danger'} size="sm">
                        {info.getValue() ? 'Ativo' : 'Inativo'}
                    </Badge>
                ),
            }),
            columnHelper.accessor('salary', {
                header: 'Salário',
                cell: (info) => (
                    <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(info.getValue())}
                    </span>
                ),
            }),
            columnHelper.display({
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex justify-center">
                        <button
                            onClick={() => onEditEmployee(row.original)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-primary-600 transition-colors"
                            title="Editar funcionário"
                        >
                            <HiOutlinePencil className="w-4 h-4" />
                        </button>
                    </div>
                ),
            }),
        ],
        [onEditEmployee]
    );

    // React Table instance
    const table = useReactTable({
        data: filteredEmployees,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageSize: 10 },
        },
    });

    const roleOptions = [
        { value: 'all', label: 'Todos os Cargos' },
        ...Object.entries(roleConfig).map(([value, config]) => ({
            value,
            label: config.label,
        })),
    ];

    const statusOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'active', label: 'Ativos' },
        { value: 'inactive', label: 'Inativos' },
    ];

    const departmentOptions = [
        { value: 'all', label: 'Todos os Departamentos' },
        ...departments.map((dept) => ({ value: dept!, label: dept! })),
    ];

    const qualificationOptions = [
        { value: 'all', label: 'Todas as Qualificações' },
        { value: 'none', label: 'Sem Formação' },
        { value: 'has_any', label: 'Com Qualificação' },
        { value: 'higher_ed', label: 'Ensino Superior+' },
        { value: '', label: 'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€' },
        ...educationLevelOrder.map(level => ({
            value: level,
            label: educationLevelLabels[level],
        })),
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Dashboard de Funcionários
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Visão geral da equipe e qualificações
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Period Filter */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        {periodOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedPeriod(option.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                                    selectedPeriod === option.value
                                        ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <Button onClick={onAddEmployee}>
                        <HiOutlineUserAdd className="w-5 h-5 mr-2" />
                        Novo Funcionário
                    </Button>
                </div>
            </div>

            {/* Smart Insights / Intelligent Advisor */}
            {insights.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conselheiro Inteligente</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Padrões de assiduidade e performance da equipa</p>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                        {insights.map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />
                        ))}
                    </div>
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
                <Card padding="md" className="border-l-4 border-l-primary-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Total</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                {metrics.total}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineUsers className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-green-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Ativos</p>
                            <p className="text-2xl sm:text-3xl font-bold text-green-600">
                                {metrics.active}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-blue-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Presentes</p>
                            <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                                {metrics.presentToday}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineClock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-purple-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Qualificados</p>
                            <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                                {metrics.withQualifications}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineAcademicCap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-indigo-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Ens.Superior</p>
                            <p className="text-2xl sm:text-3xl font-bold text-indigo-600">
                                {metrics.withHigherEd}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineAcademicCap className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-yellow-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Folha</p>
                            <p className="text-lg sm:text-xl font-bold text-yellow-600 truncate">
                                {formatCurrency(metrics.totalSalary)}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineCurrencyDollar className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Second Row - HR Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
                <Card padding="md" className="border-l-4 border-l-cyan-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Jovens (&lt;30)</p>
                            <p className="text-2xl sm:text-3xl font-bold text-cyan-600">
                                {metrics.youngEmployees}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineUsers className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-orange-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Veteranos (&gt;50)</p>
                            <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                                {metrics.seniorEmployees}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineUsers className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-teal-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Tempo Médio</p>
                            <p className="text-2xl sm:text-3xl font-bold text-teal-600">
                                {metrics.avgYearsOfService}<span className="text-sm">anos</span>
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineCalendar className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-emerald-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Pontuais</p>
                            <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                                {metrics.punctualEmployees}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-rose-500 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Com Faltas</p>
                            <p className="text-2xl sm:text-3xl font-bold text-rose-600">
                                {metrics.absentEmployees}
                            </p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                            <HiOutlineExclamation className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Role Distribution */}
                <Card padding="md">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Distribuição por Cargo
                    </h3>
                    <div className="h-64">
                        {roleDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={roleDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {roleDistribution.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                Nenhum dado disponível
                            </div>
                        )}
                    </div>
                </Card>

                {/* Qualification Distribution */}
                <Card padding="md">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Distribuição por Qualificação
                    </h3>
                    <div className="h-64">
                        {qualificationDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={qualificationDistribution} layout="vertical">
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis dataKey="nivel" type="category" width={100} />
                                    <Tooltip />
                                    <Bar dataKey="funcionarios" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                Nenhum dado disponível
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Filters and Table */}
            <Card padding="none">
                <div className="p-6 space-y-4 border-b border-gray-200 dark:border-dark-700">
                    {/* Filters */}
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por nome, email ou código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                leftIcon={<HiOutlineFilter className="w-5 h-5" />}
                            />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Select
                                options={roleOptions}
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                            />
                            <Select
                                options={statusOptions}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            />
                            <Select
                                options={departmentOptions}
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                            />
                            <Select
                                options={qualificationOptions}
                                value={qualificationFilter}
                                onChange={(e) => setQualificationFilter(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-dark-800 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            <div className="flex items-center gap-2">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {header.column.getIsSorted() && (
                                                    <span className="text-primary-500">
                                                        {header.column.getIsSorted() === 'asc' ? 'â†‘' : 'â†“'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        Nenhum funcionário encontrado
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="bg-white dark:bg-dark-900 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 pb-4">
                    <Pagination
                        currentPage={table.getState().pagination.pageIndex + 1}
                        totalItems={filteredEmployees.length}
                        itemsPerPage={table.getState().pagination.pageSize}
                        onPageChange={(page) => table.setPageIndex(page - 1)}
                        onItemsPerPageChange={(size) => table.setPageSize(size)}
                        itemsPerPageOptions={[5, 10, 25, 50]}
                        showInfo={true}
                        showItemsPerPage={true}
                    />
                </div>
            </Card>
        </div>
    );
}
