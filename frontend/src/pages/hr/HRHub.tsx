import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { PageHeader, Button, Card, Badge } from '../../components/ui';
import EmployeeList from '../../components/employees/EmployeeList';
import EmployeeForm from '../../components/employees/EmployeeForm';
import EmployeesDashboard from '../../components/employees/EmployeesDashboard';
import AttendanceControl from '../../components/employees/AttendanceControl';
import PayrollManager from '../../components/employees/PayrollManager';
import VacationManager from '../../components/employees/VacationManager';
import BonusConfigManager from '../../components/employees/BonusConfigManager';
import { useAttendance, useEmployees, usePayroll } from '../../hooks/useData';
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
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineAcademicCap,
    HiOutlineDocumentText,
} from 'react-icons/hi2';
import type { Employee } from '../../types';
import { cn, formatDate } from '../../utils/helpers';

const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: HiOutlineChartPie },
    { id: 'performance', label: 'Performance', icon: HiOutlineChartBar },
    { id: 'team', label: 'Equipa', icon: HiOutlineUsers },
    { id: 'payroll', label: 'Processamento', icon: HiOutlineBanknotes },
    { id: 'vacations', label: 'Ferias', icon: HiOutlineSun },
    { id: 'attendance', label: 'Assiduidade', icon: HiOutlineClock },
    { id: 'config', label: 'Configuracoes', icon: HiOutlineAdjustmentsHorizontal },
    { id: 'compliance', label: 'Conformidade', icon: HiOutlineShieldCheck },
] as const;

type TabId = typeof TABS[number]['id'];

function daysUntil(date?: string) {
    if (!date) return null;

    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
}

function GlobalHRSummaryPanel() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { employees } = useEmployees({ limit: 500 });
    const { attendance } = useAttendance({ startDate: today, endDate: today });
    const { payroll } = usePayroll({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        originModule: 'hr',
        limit: 500,
    });

    const metrics = useMemo(() => {
        const active = employees.filter((employee) => employee.isActive);
        const presentToday = attendance.filter((record) => record.status === 'present' || record.status === 'late').length;
        const contractAlerts = active.filter((employee) => {
            const days = daysUntil(employee.contractExpiry);
            return days !== null && days >= 0 && days <= 30;
        }).length;
        const missingDocuments = active.filter((employee) =>
            !employee.documentNumber || !employee.nuit || !employee.socialSecurityNumber || !employee.bankNib
        ).length;
        const payrollPending = payroll.filter((record) => record.status !== 'paid').length;

        return {
            active: active.length,
            presentToday,
            attendanceRate: active.length > 0 ? Math.round((presentToday / active.length) * 100) : 0,
            payrollPending,
            contractAlerts,
            missingDocuments,
        };
    }, [attendance, employees, payroll]);

    const items = [
        {
            label: 'Colaboradores ativos',
            value: metrics.active,
            detail: 'Equipa registada',
            icon: HiOutlineUsers,
            color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20',
            badge: 'RH',
        },
        {
            label: 'Presentes hoje',
            value: metrics.presentToday,
            detail: `${metrics.attendanceRate}% de assiduidade`,
            icon: HiOutlineClock,
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
            badge: 'PONTO',
        },
        {
            label: 'Payroll pendente',
            value: metrics.payrollPending,
            detail: 'Registos por fechar/pagar',
            icon: HiOutlineBanknotes,
            color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
            badge: 'SALARIOS',
        },
        {
            label: 'Alertas laborais',
            value: metrics.contractAlerts + metrics.missingDocuments,
            detail: `${metrics.contractAlerts} contratos, ${metrics.missingDocuments} documentos`,
            icon: metrics.contractAlerts + metrics.missingDocuments > 0 ? HiOutlineExclamationTriangle : HiOutlineCheckCircle,
            color: metrics.contractAlerts + metrics.missingDocuments > 0
                ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
                : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
            badge: 'COMPLIANCE',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <Card key={item.label} variant="glass" padding="md">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                    {item.label}
                                </p>
                                <p className="text-3xl font-black tracking-tight text-gray-900 dark:text-white mt-2">
                                    {item.value}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                    {item.detail}
                                </p>
                            </div>
                            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', item.color)}>
                                <Icon className="w-6 h-6" />
                            </div>
                        </div>
                        <Badge variant="outline" size="sm" className="mt-4">
                            {item.badge}
                        </Badge>
                    </Card>
                );
            })}
        </div>
    );
}

function GlobalPerformancePanel() {
    const { employees } = useEmployees({ limit: 500 });

    const data = useMemo(() => {
        const active = employees.filter((employee) => employee.isActive);
        const averageScore = active.length
            ? Math.round(active.reduce((sum, employee) => sum + Number(employee.performanceScore || 0), 0) / active.length)
            : 0;
        const highPerformers = active.filter((employee) => Number(employee.performanceScore || 0) >= 80).length;
        const needsReview = active.filter((employee) => Number(employee.performanceScore || 0) > 0 && Number(employee.performanceScore || 0) < 50).length;
        const qualified = active.filter((employee) => (employee.qualifications?.length || 0) > 0 || (employee.skills?.length || 0) > 0).length;

        const topEmployees = [...active]
            .sort((a, b) => Number(b.performanceScore || 0) - Number(a.performanceScore || 0))
            .slice(0, 8);

        const departments = Object.entries(
            active.reduce<Record<string, number>>((acc, employee) => {
                const key = employee.department || 'Sem departamento';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {})
        ).sort(([, a], [, b]) => b - a);

        return { averageScore, highPerformers, needsReview, qualified, topEmployees, departments };
    }, [employees]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Score médio', value: `${data.averageScore}%`, icon: HiOutlineChartBar, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' },
                    { label: 'Alta performance', value: data.highPerformers, icon: HiOutlineCheckCircle, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                    { label: 'A rever', value: data.needsReview, icon: HiOutlineExclamationTriangle, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
                    { label: 'Com qualificações', value: data.qualified, icon: HiOutlineAcademicCap, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' },
                ].map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <Card key={metric.label} padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{metric.label}</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-1 tabular-nums">{metric.value}</p>
                                </div>
                                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', metric.color)}>
                                    <Icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]" padding="none">
                    <div className="p-5 border-b border-slate-100/80 dark:border-white/5">
                        <h3 className="font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white">
                            Ranking de performance
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100/70 dark:divide-white/5">
                        {data.topEmployees.length === 0 ? (
                            <p className="p-6 text-sm text-gray-500">Nenhum colaborador ativo encontrado.</p>
                        ) : data.topEmployees.map((employee, index) => (
                            <div key={employee.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-dark-700/20 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 dark:text-white truncate">{employee.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{employee.department || employee.role}</p>
                                    </div>
                                </div>
                                <div className="w-40 max-w-[45%]">
                                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-dark-700 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                                            style={{ width: `${Math.min(Number(employee.performanceScore || 0), 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-right text-xs font-black text-slate-500 mt-1 tabular-nums">
                                        {Number(employee.performanceScore || 0)}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 transition-all duration-300">
                    <h3 className="font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white mb-4">
                        Distribuição por departamento
                    </h3>
                    <div className="space-y-2">
                        {data.departments.length === 0 ? (
                            <p className="text-sm text-gray-500">Sem dados por departamento.</p>
                        ) : data.departments.map(([department, count]) => (
                            <div key={department} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100/60 dark:border-white/5 last:border-0">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{department}</span>
                                <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums flex-shrink-0">{count}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function GlobalCompliancePanel() {
    const { employees } = useEmployees({ limit: 500 });

    const compliance = useMemo(() => {
        return employees
            .filter((employee) => employee.isActive)
            .map((employee) => {
                const missing = [
                    !employee.documentNumber ? 'Documento' : null,
                    !employee.nuit ? 'NUIT' : null,
                    !employee.socialSecurityNumber ? 'INSS' : null,
                    !employee.bankNib ? 'NIB' : null,
                    !employee.contractType ? 'Contrato' : null,
                ].filter(Boolean) as string[];
                const contractDays = daysUntil(employee.contractExpiry);
                const expiringContract = contractDays !== null && contractDays >= 0 && contractDays <= 30;

                return { employee, missing, expiringContract, contractDays };
            })
            .filter((item) => item.missing.length > 0 || item.expiringContract);
    }, [employees]);

    const completeCount = employees.filter((employee) =>
        employee.isActive &&
        employee.documentNumber &&
        employee.nuit &&
        employee.socialSecurityNumber &&
        employee.bankNib &&
        employee.contractType
    ).length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md" className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 shadow-sm backdrop-blur-xl">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Dossiers completos</p>
                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-2 tabular-nums">{completeCount}</p>
                </Card>
                <Card padding="md" className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 shadow-sm backdrop-blur-xl">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Com pendências</p>
                    <p className="text-3xl font-black text-amber-700 dark:text-amber-300 mt-2 tabular-nums">{compliance.length}</p>
                </Card>
                <Card padding="md" className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500">Campos verificados</p>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-2">Documento, NUIT, INSS, NIB e contrato.</p>
                </Card>
            </div>

            <Card padding="none" className="overflow-hidden bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-12px_rgba(148,163,184,0.18)] dark:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.7)]">
                <div className="p-5 border-b border-slate-100/80 dark:border-white/5 flex items-center gap-2">
                    <HiOutlineDocumentText className="w-4 h-4 text-primary-600" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white">
                        Pendências de conformidade
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-dark-900/50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-100/80 dark:border-white/5">
                            <tr>
                                <th className="px-6 py-3 font-black">Colaborador</th>
                                <th className="px-6 py-3 font-black">Pendências</th>
                                <th className="px-6 py-3 font-black">Contrato</th>
                                <th className="px-6 py-3 font-black">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/70 dark:divide-white/5">
                            {compliance.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 text-sm">
                                        Sem pendências de conformidade registadas.
                                    </td>
                                </tr>
                            ) : compliance.map(({ employee, missing, expiringContract, contractDays }) => (
                                <tr key={employee.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-700/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900 dark:text-white">{employee.name}</p>
                                        <p className="text-xs text-gray-500">{employee.code} - {employee.department || employee.role}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-2">
                                            {missing.length === 0 ? (
                                                <Badge variant="success">Completo</Badge>
                                            ) : missing.map((item) => (
                                                <Badge key={item} variant="warning">{item}</Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {employee.contractExpiry ? formatDate(employee.contractExpiry) : 'Sem validade'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={expiringContract ? 'danger' : missing.length > 0 ? 'warning' : 'success'}>
                                            {expiringContract ? `${contractDays} dias` : missing.length > 0 ? 'Pendente' : 'Regular'}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

export default function HRHub() {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';

    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

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

    const handleSync = async () => {
        if (isSyncing) return;

        setIsSyncing(true);
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['employees'] }),
                queryClient.invalidateQueries({ queryKey: ['payroll'] }),
            ]);
            setRefreshKey((current) => current + 1);
            toast.success('Dados de RH sincronizados');
        } catch {
            toast.error('Erro ao sincronizar RH');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader
                title="Recursos Humanos"
                subtitle="Gestao estrategica de talentos, performance e processamento"
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
                            leftIcon={<HiOutlineArrowPath className={cn('text-primary-600', isSyncing && 'animate-spin')} />}
                            onClick={handleSync}
                            isLoading={isSyncing}
                            loadingText="A sincronizar..."
                        >
                            Sincronizar
                        </Button>
                    </div>
                }
            />

            <GlobalHRSummaryPanel key={`summary-${refreshKey}`} />

            <div className="flex p-1 bg-gray-100/80 dark:bg-dark-800/80 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-dark-700/50 shadow-inner overflow-x-auto scroller-hidden">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <Button variant="ghost"
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex-1 justify-center whitespace-nowrap',
                                isActive
                                    ? 'bg-white dark:bg-dark-700 text-primary-600 dark:text-white shadow-lg shadow-black/5 scale-[1.02]'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            )}
                        >
                            <Icon className={cn('w-4 h-4', isActive ? 'text-primary-600 dark:text-primary-400' : 'opacity-50')} />
                            <span>{tab.label}</span>
                        </Button>
                    );
                })}
            </div>

            <div key={`hr-tab-${activeTab}-${refreshKey}`} className="min-h-[600px] animate-fade-in transition-all duration-300">
                {activeTab === 'dashboard' && (
                    <EmployeesDashboard onEditEmployee={handleEdit} onAddEmployee={handleAdd} />
                )}

                {activeTab === 'team' && (
                    <EmployeeList onEdit={handleEdit} onAddEmployee={handleAdd} />
                )}

                {activeTab === 'attendance' && <AttendanceControl />}

                {activeTab === 'payroll' && <PayrollManager />}

                {activeTab === 'compliance' && <GlobalCompliancePanel />}

                {activeTab === 'performance' && <GlobalPerformancePanel />}

                {activeTab === 'vacations' && <VacationManager />}

                {activeTab === 'config' && <BonusConfigManager />}
            </div>

            <EmployeeForm
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditingEmployee(null); }}
                employee={editingEmployee}
            />
        </div>
    );
}
