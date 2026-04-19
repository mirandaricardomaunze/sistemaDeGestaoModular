import React, { useState, useMemo } from 'react';
import {
    HiOutlineUsers, HiOutlineClock, HiOutlineBanknotes,
    HiOutlineShieldCheck, HiOutlineArrowTrendingUp, HiOutlineExclamationTriangle,
    HiOutlineCalendar, HiOutlineChartBar, HiOutlineCurrencyDollar,
    HiOutlineTrophy, HiOutlinePlus, HiOutlineArrowPath,
    HiOutlineMagnifyingGlass, HiOutlineDocumentMagnifyingGlass,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineSun,
    HiOutlineCalculator, HiOutlinePrinter,
    HiOutlineArrowRightOnRectangle as HiOutlineLogin,
    HiOutlineArrowLeftOnRectangle as HiOutlineLogout,
} from 'react-icons/hi2';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts';
import { Card, Button, Badge, Input, Select, Modal, PageHeader, LoadingSpinner } from '../ui';
import EmployeeList from './EmployeeList';
import EmployeeForm from './EmployeeForm';
import PayslipGenerator from './PayslipGenerator';
import { useEmployees, useAttendance, usePayroll } from '../../hooks/useData';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { employeesAPI } from '../../services/api';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Employee, VacationRequest } from '../../types';

// â”€â”€-Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ModuleHRConfig {
    department: string;
    moduleName: string;
    accentColor: string; // tailwind color key e.g. "blue", "rose", "orange", "teal"
    icon: React.ReactNode;
    showCommissions?: boolean;
    documentTypes?: { id: string; label: string; required?: boolean }[];
}

type Tab = 'dashboard' | 'staff' | 'attendance' | 'payroll' | 'vacations' | 'compliance' | 'config';

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CHART_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const calcIRT = (income: number): number => {
    if (income <= 42500) return 0;
    if (income <= 100000) return (income - 42500) * 0.10;
    if (income <= 250000) return 5750 + (income - 100000) * 0.15;
    if (income <= 500000) return 28250 + (income - 250000) * 0.20;
    return 78250 + (income - 500000) * 0.25;
};
const calcINSS = (base: number) => base * 0.03;

// â”€â”€-Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€-

function HRDashboard({ config, employees: allEmp }: { config: ModuleHRConfig; employees: Employee[] }) {
    const employees = useMemo(
        () => allEmp.filter(e => !e.department || e.department === config.department),
        [allEmp, config.department]
    );

    const { attendance } = useAttendance({
        startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    const { payroll } = usePayroll({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

    const metrics = useMemo(() => {
        const total = employees.length;
        const active = employees.filter(e => e.isActive !== false).length;
        const today = format(new Date(), 'yyyy-MM-dd');
        const presentToday = (attendance || []).filter(a => a.date === today && a.status === 'present').length;
        const monthlyCost = (payroll || []).reduce((acc, p) => acc + (Number(p.netSalary) || 0), 0);
        const totalCommissions = (payroll || []).reduce((acc, p) => acc + (Number(p.bonus) || 0), 0);
        const contractAlerts = employees.filter(e => {
            if (!e.contractExpiry) return false;
            const diff = Math.ceil((new Date(e.contractExpiry).getTime() - Date.now()) / 86400000);
            return diff > 0 && diff < 30;
        }).length;
        return { total, active, attendanceRate: total > 0 ? (presentToday / total) * 100 : 0, monthlyCost, totalCommissions, contractAlerts, presentToday };
    }, [employees, attendance, payroll]);

    const attendanceTrend = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => {
            const day = subDays(new Date(), 6 - i);
            const dateStr = format(day, 'yyyy-MM-dd');
            const recs = (attendance || []).filter(a => a.date === dateStr);
            return { name: format(day, 'EEE', { locale: ptBR }), presente: recs.filter(a => a.status === 'present').length, atraso: recs.filter(a => a.status === 'late').length };
        }), [attendance]);

    const payrollDist = useMemo(() => {
        if (!payroll?.length) return [{ name: 'Salário Base', value: 70 }, { name: 'Subsídios', value: 20 }, { name: 'Horas Extra', value: 10 }];
        const t = payroll.reduce((a, p) => ({ base: a.base + Number(p.baseSalary || 0), allow: a.allow + Number(p.allowances || 0), ot: a.ot + Number(p.otAmount || 0) }), { base: 0, allow: 0, ot: 0 });
        const total = t.base + t.allow + t.ot || 1;
        return [{ name: 'Salário Base', value: Math.round((t.base / total) * 100) }, { name: 'Subsídios', value: Math.round((t.allow / total) * 100) }, { name: 'Horas Extra', value: Math.round((t.ot / total) * 100) }];
    }, [payroll]);

    const recentActivity = useMemo(() => {
        const items: { user: string; action: string; time: string }[] = [];
        const today = format(new Date(), 'yyyy-MM-dd');
        (attendance || []).filter(a => a.date === today && a.checkIn).slice(0, 3).forEach(rec => {
            const emp = employees.find(e => e.id === rec.employeeId);
            if (emp) items.push({ user: emp.name, action: `Check-in às ${rec.checkIn}`, time: 'Hoje' });
        });
        (payroll || []).filter(p => p.status === 'paid').slice(0, 2).forEach(p => {
            const emp = employees.find(e => e.id === p.employeeId);
            if (emp) items.push({ user: emp.name, action: 'Salário pago', time: 'Este mês' });
        });
        return items.slice(0, 5);
    }, [attendance, employees, payroll]);

    const c = config.accentColor;

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: `Equipa ${config.moduleName}`, value: metrics.total.toString(), sub: `${metrics.active} activos`, icon: HiOutlineUsers, color: `text-${c}-600`, bg: `bg-${c}-50 dark:bg-${c}-900/20` },
                    { label: 'Taxa de Assiduidade', value: metrics.attendanceRate > 0 ? `${metrics.attendanceRate.toFixed(1)}%` : '', sub: `${metrics.presentToday} presentes hoje`, icon: HiOutlineClock, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'Massa Salarial Mensal', value: metrics.monthlyCost > 0 ? formatCurrency(metrics.monthlyCost) : '', sub: `${payroll?.length || 0} registos`, icon: HiOutlineBanknotes, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                    { label: 'Contratos a Expirar', value: metrics.contractAlerts.toString(), sub: metrics.contractAlerts > 0 ? 'Próximos 30 dias' : 'Tudo em ordem', icon: HiOutlineExclamationTriangle, color: metrics.contractAlerts > 0 ? 'text-amber-600' : 'text-gray-400', bg: metrics.contractAlerts > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-900/20' },
                ].map((s, i) => (
                    <Card key={i} variant="glass" className="relative group overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg ${s.bg} ${s.color} transition-transform group-hover:scale-110 duration-300`}>
                                    <s.icon className="w-6 h-6" />
                                </div>
                                <Badge variant={i === 3 && metrics.contractAlerts > 0 ? 'warning' : 'success'} size="sm">
                                    {i === 3 && metrics.contractAlerts > 0 ? 'ATENÇÃO' : 'ACTIVO'}
                                </Badge>
                            </div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                            <p className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white mb-2">{s.value}</p>
                            <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1"><HiOutlineArrowTrendingUp className="w-3 h-3 text-green-500" />{s.sub}</p>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:w-full w-12 ${s.color.replace('text', 'bg')}`} />
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card variant="glass" padding="md">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2"><HiOutlineCalendar className={`w-4 h-4 text-${c}-500`} />Assiduidade - 7 dias</h4>
                        <Badge variant="outline">Ãšltimos 7 dias</Badge>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attendanceTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="presente" fill="#0d9488" radius={[4, 4, 0, 0]} name="Presentes" />
                                <Bar dataKey="atraso" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Atrasos" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card variant="glass" padding="md">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2"><HiOutlineChartBar className="w-4 h-4 text-indigo-500" />Distribuição Salarial</h4>
                        <Badge variant="outline">Mês Corrente</Badge>
                    </div>
                    <div className="grid grid-cols-2 items-center">
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={payrollDist} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                                        {payrollDist.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => `${v}%`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                            {payrollDist.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx] }} />
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-gray-900 dark:text-white">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card variant="glass" className="lg:col-span-2">
                    <div className="p-6 border-b border-gray-100 dark:border-dark-700/50">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2"><span className={`w-2 h-2 rounded-full bg-${c}-500`} />Actividade Recente</h4>
                    </div>
                    <div className="p-6 space-y-4">
                        {recentActivity.length === 0 ? (
                            <p className="text-center py-8 text-gray-400 text-xs italic">Nenhuma actividade recente registada</p>
                        ) : recentActivity.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-dark-700/30 transition-all">
                                <div className={`w-10 h-10 rounded-full bg-${c}-100 dark:bg-${c}-900/30 flex items-center justify-center font-bold text-${c}-600`}>{item.user.charAt(0)}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.user}</p>
                                    <p className="text-xs text-gray-500">{item.action}</p>
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium">{item.time}</p>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card variant="glass" className={`border-l-4 border-l-${c}-500`}>
                    <div className="p-6 border-b border-gray-100 dark:border-dark-700/50">
                        <h4 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 text-${c}-600`}><HiOutlineTrophy className="w-4 h-4" />Alertas & Conformidade</h4>
                    </div>
                    <div className="p-6 space-y-4">
                        {metrics.contractAlerts === 0 ? (
                            <p className="text-center py-8 text-gray-400 text-xs italic">Sem alertas activos</p>
                        ) : (
                            employees.filter(e => {
                                if (!e.contractExpiry) return false;
                                const diff = Math.ceil((new Date(e.contractExpiry).getTime() - Date.now()) / 86400000);
                                return diff > 0 && diff < 30;
                            }).map((e, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3">
                                    <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
                                    <div>
                                        <p className="text-xs font-black">{e.name}</p>
                                        <p className="text-[10px]">Contrato expira: {formatDate(e.contractExpiry!)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function AttendancePanel({ config, employees: allEmp }: { config: ModuleHRConfig; employees: Employee[] }) {
    const [search, setSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const staff = useMemo(() => allEmp.filter(e => !e.department || e.department === config.department), [allEmp, config.department]);

    const { attendance, refetch, recordAttendance } = useAttendance({ startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') });
    const { attendance: history, isLoading: loadingHistory } = useAttendance({
        employeeId: selectedEmployee?.id,
        startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });

    const handleRecord = async (employeeId: string, type: 'checkIn' | 'checkOut') => {
        await recordAttendance({ employeeId, date: format(new Date(), 'yyyy-MM-dd'), [type]: format(new Date(), 'HH:mm'), status: type === 'checkIn' ? 'present' : undefined });
        refetch();
    };

    const filtered = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));
    const presentCount = (attendance || []).filter(a => a.checkIn && !a.checkOut).length;
    const exitCount = (attendance || []).filter(a => a.checkOut).length;
    const historySummary = useMemo(() => ({
        present: (history || []).filter(h => h.status === 'present').length,
        late: (history || []).filter(h => h.status === 'late').length,
        hours: (history || []).reduce((acc, h) => acc + (h.hoursWorked || 0), 0),
    }), [history]);

    const c = config.accentColor;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-md relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input placeholder="Pesquisar colaborador..." className="pl-10 h-11" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                    <HiOutlineCalendar className="w-5 h-5" />
                    {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Presentes Hoje', value: presentCount, icon: HiOutlineLogin, color: 'teal' },
                    { label: 'Saídas Registadas', value: exitCount, icon: HiOutlineLogout, color: 'blue' },
                    { label: 'Ausentes', value: Math.max(0, filtered.length - (attendance?.length || 0)), icon: HiOutlineClock, color: 'amber' },
                ].map((s, i) => (
                    <Card key={i} variant="glass" className={`p-4 border-l-4 border-l-${s.color}-500 flex items-center gap-4`}>
                        <div className={`p-3 rounded-lg bg-${s.color}-50 dark:bg-${s.color}-900/20 text-${s.color}-600`}><s.icon className="w-6 h-6" /></div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{s.label}</p>
                            <h4 className="text-xl font-black font-mono">{s.value}</h4>
                        </div>
                    </Card>
                ))}
            </div>

            {filtered.length === 0 ? (
                <Card variant="glass" className="p-12 text-center text-gray-400 italic">Nenhum colaborador encontrado</Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(person => {
                        const record = (attendance || []).find(a => a.employeeId === person.id);
                        return (
                            <Card key={person.id} variant="glass" className={`relative group overflow-hidden border-t-2 border-t-${c}-500/10 hover:border-t-${c}-500 transition-all duration-300`}>
                                <div className="p-5 space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-lg bg-${c}-100 dark:bg-${c}-900/30 flex items-center justify-center text-${c}-600 font-black text-lg`}>{person.name.charAt(0)}</div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 dark:text-white truncate">{person.name}</h4>
                                            <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">{person.role || config.moduleName} • {person.code}</p>
                                        </div>
                                        <button onClick={() => { setSelectedEmployee(person); setIsHistoryOpen(true); }} className="p-2 rounded-lg hover:bg-white/50 text-gray-400 hover:text-primary-500 transition-colors" title="Ver Histórico">
                                            <HiOutlineDocumentMagnifyingGlass className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-gray-100 dark:border-dark-700/50">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entrada</span>
                                            <p className={`text-xs font-black font-mono italic ${record?.checkIn ? 'text-teal-600' : 'text-gray-400'}`}>{record?.checkIn || '--:--'}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Saída</span>
                                            <p className={`text-xs font-black font-mono italic ${record?.checkOut ? 'text-blue-600' : 'text-gray-400'}`}>{record?.checkOut || '--:--'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button variant={record?.checkIn ? 'outline' : 'primary'} size="sm" className="flex-1 rounded-lg font-black text-[10px] uppercase tracking-widest h-10" disabled={!!record?.checkIn} leftIcon={<HiOutlineLogin className="w-4 h-4" />} onClick={() => handleRecord(person.id, 'checkIn')}>Check-In</Button>
                                        <Button variant="outline" size="sm" className="flex-1 rounded-lg font-black text-[10px] uppercase tracking-widest h-10 border-orange-200 text-orange-600 hover:bg-orange-50" disabled={!record?.checkIn || !!record?.checkOut} leftIcon={<HiOutlineLogout className="w-4 h-4" />} onClick={() => handleRecord(person.id, 'checkOut')}>Check-Out</Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title={`Histórico - ${selectedEmployee?.name}`} size="lg">
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        {[{ label: 'Presenças', value: historySummary.present, color: 'teal' }, { label: 'Atrasos', value: historySummary.late, color: 'amber' }, { label: 'Horas Total', value: `${historySummary.hours.toFixed(1)}h`, color: 'indigo' }].map((s, i) => (
                            <div key={i} className={`p-4 rounded-lg bg-${s.color}-50 dark:bg-${s.color}-900/10 border border-${s.color}-100`}>
                                <p className={`text-[10px] font-black uppercase text-${s.color}-600 mb-1`}>{s.label}</p>
                                <p className={`text-xl font-black text-${s.color}-700`}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                    <h5 className="text-xs font-black uppercase tracking-widest text-gray-500">Registos - Ãšltimos 30 dias</h5>
                    {loadingHistory ? <LoadingSpinner size="md" /> : !history?.length ? (
                        <p className="text-center py-8 text-gray-400 italic">Nenhum registo encontrado</p>
                    ) : (
                        <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                            {[...history].sort((a, b) => b.date.localeCompare(a.date)).map((h, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-dark-800 flex items-center justify-center text-[10px] font-black">{format(new Date(h.date), 'dd')}</div>
                                        <div>
                                            <p className="text-xs font-bold">{format(new Date(h.date), 'dd/MM/yyyy')}</p>
                                            <Badge variant={h.status === 'present' ? 'success' : 'warning'} size="sm">{h.status?.toUpperCase()}</Badge>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black font-mono">{h.checkIn || '--:--'} â†’ {h.checkOut || '--:--'}</p>
                                        <p className="text-[10px] text-gray-400">{(h.hoursWorked || 0).toFixed(1)}h</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(false)}>Fechar</Button></div>
                </div>
            </Modal>
        </div>
    );
}

function PayrollPanel({ config, employees: allEmp }: { config: ModuleHRConfig; employees: Employee[] }) {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
    const [processing, setProcessing] = useState(false);

    const employees = useMemo(() => allEmp.filter(e => !e.department || e.department === config.department), [allEmp, config.department]);
    const { payroll: allPayroll, isLoading, refetch, updatePayroll, processPayroll } = usePayroll({ month, year, status: statusFilter || undefined });
    const data = useMemo(() => (allPayroll || []).filter(p => employees.some(e => e.id === p.employeeId)), [allPayroll, employees]);

    const stats = useMemo(() => ({
        totalNet: data.reduce((a, p) => a + Number(p.netSalary || 0), 0),
        totalPaid: data.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.netSalary || 0), 0),
        totalINSS: data.reduce((a, p) => a + Number(p.inssDeduction || 0), 0),
        totalBonus: data.reduce((a, p) => a + Number(p.bonus || 0), 0),
    }), [data]);

    const handleStatus = async (id: string, status: 'processed' | 'paid') => {
        try {
            status === 'processed' ? await processPayroll(id) : await updatePayroll(id, { status });
            toast.success(`Marcado como ${status === 'paid' ? 'pago' : 'processado'}`);
            refetch();
        } catch { toast.error('Erro ao actualizar estado'); }
    };

    const handleProcessAll = async () => {
        if (!window.confirm('Processar todos os rascunhos?')) return;
        const drafts = data.filter(p => p.status === 'draft').map(p => p.id);
        if (!drafts.length) { toast('Sem rascunhos'); return; }
        setProcessing(true);
        let ok = 0;
        for (const id of drafts) { try { await processPayroll(id); ok++; } catch { /**/ } }
        setProcessing(false);
        toast.success(`${ok}/${drafts.length} processados`);
        refetch();
    };

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            <Card variant="glass" className="p-4">
                <div className="flex flex-col md:flex-row items-end justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        <Select label="Mês" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} value={month.toString()} onChange={e => setMonth(Number(e.target.value))} />
                        <Select label="Ano" options={['2024', '2025', '2026'].map(y => ({ value: y, label: y }))} value={year.toString()} onChange={e => setYear(Number(e.target.value))} />
                        <Select label="Estado" options={[{ value: '', label: 'Todos' }, { value: 'draft', label: 'Rascunho' }, { value: 'processed', label: 'Processado' }, { value: 'paid', label: 'Pago' }]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={refetch} className="h-11 font-black text-[10px] uppercase tracking-widest">Refrescar</Button>
                        <Button variant="primary" onClick={handleProcessAll} disabled={processing} leftIcon={processing ? <HiOutlineClock className="w-5 h-5 animate-spin" /> : <HiOutlineCalculator className="w-5 h-5" />} className="h-11 font-black text-[10px] uppercase tracking-widest">{processing ? 'A processar...' : 'Processar Todos'}</Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Líquido', value: stats.totalNet, color: 'border-l-blue-500' },
                    { label: 'Total Pago', value: stats.totalPaid, color: 'border-l-green-500' },
                    { label: 'Retenção INSS (3%)', value: stats.totalINSS, color: 'border-l-red-500' },
                    { label: 'Bónus / Comissões', value: stats.totalBonus, color: 'border-l-teal-500' },
                ].map((s, i) => (
                    <Card key={i} variant="glass" className={`p-5 border-l-4 ${s.color}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1 italic text-gray-500">{s.label}</p>
                        <h3 className="text-2xl font-black tracking-tighter">{formatCurrency(s.value)}</h3>
                    </Card>
                ))}
            </div>

            <Card variant="glass" padding="none" className="overflow-hidden border border-gray-100 dark:border-dark-700/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-dark-800/80 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-dark-700/50 whitespace-nowrap">
                                <th className="px-6 py-4 text-left">Colaborador</th>
                                <th className="px-6 py-4 text-right">Base</th>
                                {config.showCommissions && <th className="px-6 py-4 text-right">Comissão</th>}
                                <th className="px-6 py-4 text-right">Subsídios</th>
                                <th className="px-6 py-4 text-right">Deduções</th>
                                <th className="px-6 py-4 text-right">Líquido</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700/50">
                            {isLoading ? (
                                <tr><td colSpan={8} className="py-20 text-center"><LoadingSpinner size="lg" /></td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={8} className="py-20 text-center text-gray-400 italic">Nenhum registo para {MONTHS[month - 1]} / {year}</td></tr>
                            ) : data.map(p => {
                                const emp = employees.find(e => e.id === p.employeeId);
                                const inss = Number(p.inssDeduction) || calcINSS(Number(p.baseSalary));
                                const irt = Number(p.irtDeduction) || calcIRT(Number(p.totalEarnings || p.baseSalary));
                                const deds = inss + irt + Number(p.advances || 0);
                                const net = Number(p.netSalary) || (Number(p.baseSalary) + Number(p.bonus || 0) + Number(p.allowances || 0) - deds);
                                return (
                                    <tr key={p.id} className="hover:bg-gray-50/30 dark:hover:bg-dark-700/20 transition-all">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-black text-xs">{emp?.name?.charAt(0) ?? '?'}</div>
                                                <div>
                                                    <p className="font-black text-gray-900 dark:text-white uppercase text-xs">{emp?.name ?? ''}</p>
                                                    <p className="text-[10px] text-gray-400">{emp?.role || config.moduleName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs font-bold">{formatCurrency(Number(p.baseSalary))}</td>
                                        {config.showCommissions && <td className="px-6 py-4 text-right font-mono text-xs text-teal-600 font-black">{Number(p.bonus) > 0 ? `+${formatCurrency(Number(p.bonus))}` : ''}</td>}
                                        <td className="px-6 py-4 text-right font-mono text-xs text-gray-500">{Number(p.allowances) > 0 ? formatCurrency(Number(p.allowances)) : ''}</td>
                                        <td className="px-6 py-4 text-right font-mono text-xs text-red-500 font-bold">-{formatCurrency(deds)}</td>
                                        <td className="px-6 py-4 text-right"><span className="text-sm font-black text-indigo-600">{formatCurrency(net)}</span></td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={p.status === 'paid' ? 'success' : p.status === 'processed' ? 'primary' : 'gray'} className="font-black text-[9px]">{p.status?.toUpperCase()}</Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                {p.status === 'draft' && <button onClick={() => handleStatus(p.id, 'processed')} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors border border-transparent hover:border-blue-100" title="Processar"><HiOutlineCheckCircle className="w-5 h-5" /></button>}
                                                {p.status === 'processed' && <button onClick={() => handleStatus(p.id, 'paid')} className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors border border-transparent hover:border-green-100" title="Marcar como Pago"><HiOutlineBanknotes className="w-5 h-5" /></button>}
                                                <PayslipGenerator record={{ ...p, employee: emp! }} variant="ghost" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={!!selectedPayroll} onClose={() => setSelectedPayroll(null)} title="Recibo de Salário" size="lg">
                {selectedPayroll && (() => {
                    const inss = Number(selectedPayroll.inssDeduction) || calcINSS(Number(selectedPayroll.baseSalary));
                    const irt = Number(selectedPayroll.irtDeduction) || calcIRT(Number(selectedPayroll.totalEarnings || selectedPayroll.baseSalary));
                    return (
                        <div className="p-2 space-y-6">
                            <div className="flex justify-between items-start border-b-2 border-dashed border-gray-100 pb-6">
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 uppercase">Dept. {config.moduleName}</h1>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Recibo de Remuneração</p>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline">{MONTHS[month - 1]} {year}</Badge>
                                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-black">ID: {selectedPayroll.id?.slice(-8)}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8 text-sm">
                                <div><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Colaborador</p><p className="font-black text-gray-900 uppercase">{selectedPayroll.employee?.name}</p><p className="text-xs text-gray-500">{selectedPayroll.employee?.role || config.moduleName}</p></div>
                                <div className="text-right"><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Dados Fiscais</p><p className="font-bold text-gray-700">NUIT: {selectedPayroll.employee?.nuit || ''}</p><p className="text-xs text-gray-500">INSS: {selectedPayroll.employee?.socialSecurityNumber || ''}</p></div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-2"><span>DESCRIÇÃO</span><span>VALOR (MT)</span></div>
                                <div className="flex justify-between text-sm"><span className="text-gray-600">Salário Base</span><span className="font-mono font-bold">{formatCurrency(Number(selectedPayroll.baseSalary))}</span></div>
                                {Number(selectedPayroll.bonus) > 0 && <div className="flex justify-between text-sm text-teal-600"><span className="font-medium italic">Bónus / Comissão</span><span className="font-mono font-black">+{formatCurrency(Number(selectedPayroll.bonus))}</span></div>}
                                {Number(selectedPayroll.allowances) > 0 && <div className="flex justify-between text-sm text-teal-600"><span className="font-medium italic">Subsídios</span><span className="font-mono font-black">+{formatCurrency(Number(selectedPayroll.allowances))}</span></div>}
                                <div className="flex justify-between text-sm text-red-500 border-t border-gray-100 pt-2"><span className="italic">INSS (3%)</span><span className="font-mono font-black">-{formatCurrency(inss)}</span></div>
                                <div className="flex justify-between text-sm text-red-500"><span className="italic">IRT</span><span className="font-mono font-black">-{formatCurrency(irt)}</span></div>
                            </div>
                            <div className="flex justify-between items-center p-6 bg-primary-600 rounded-lg text-white shadow-xl shadow-primary-500/20">
                                <div><p className="text-[10px] font-black uppercase tracking-widest opacity-80">Líquido a Receber</p><p className="text-xs italic opacity-80">{selectedPayroll.paidAt ? `Pago em ${formatDate(selectedPayroll.paidAt)}` : 'Pendente'}</p></div>
                                <p className="text-3xl font-black tracking-tighter italic">{formatCurrency(Number(selectedPayroll.netSalary))}</p>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <Button variant="outline" className="flex-1 rounded-lg uppercase font-black text-[10px] tracking-widest" onClick={() => window.print()} leftIcon={<HiOutlinePrinter className="w-5 h-5" />}>Imprimir</Button>
                                <Button variant="ghost" className="flex-1 rounded-lg uppercase font-black text-[10px] tracking-widest" onClick={() => setSelectedPayroll(null)}>Fechar</Button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}

export function VacationsPanel({ config, employees: allEmp }: { config: ModuleHRConfig; employees: Employee[] }) {
    const [requests, setRequests] = useState<VacationRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newReq, setNewReq] = useState({ employeeId: '', startDate: '', endDate: '', notes: '' });

    const employees = useMemo(() => allEmp.filter(e => !e.department || e.department === config.department), [allEmp, config.department]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await employeesAPI.getVacations();
            setRequests(data?.data || data || []);
        } catch { /**/ }
        finally { setIsLoading(false); }
    };

    React.useEffect(() => { fetchData(); }, []);

    const handleApprove = async (id: string) => {
        try { await employeesAPI.updateVacation(id, { status: 'approved' }); toast.success('Férias aprovadas!'); fetchData(); } catch { toast.error('Erro ao aprovar'); }
    };
    const handleReject = async (id: string) => {
        try { await employeesAPI.updateVacation(id, { status: 'rejected' }); toast.success('Pedido rejeitado'); fetchData(); } catch { toast.error('Erro ao rejeitar'); }
    };
    const handleSubmit = async () => {
        if (!newReq.employeeId || !newReq.startDate || !newReq.endDate) { toast.error('Preencha todos os campos'); return; }
        try { await employeesAPI.requestVacation(newReq); toast.success('Pedido submetido!'); setShowModal(false); setNewReq({ employeeId: '', startDate: '', endDate: '', notes: '' }); fetchData(); } catch { toast.error('Erro ao submeter pedido'); }
    };

    const c = config.accentColor;
    const deptRequests = requests.filter(r => employees.some(e => e.id === r.employeeId));

    if (isLoading) return <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2"><HiOutlineSun className={`text-${c}-500`} />Gestãor de Férias & Ausências</h2>
                    <p className="text-sm text-gray-500">Controlo de escalas, saldos e pedidos de folga</p>
                </div>
                <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => setShowModal(true)}>Solicitar Férias</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Pendentes', value: deptRequests.filter(r => r.status === 'pending').length, color: 'blue' },
                    { label: 'Aprovados', value: deptRequests.filter(r => r.status === 'approved').length, color: 'green' },
                    { label: 'Rejeitados', value: deptRequests.filter(r => r.status === 'rejected').length, color: 'red' },
                    { label: 'Total Equipa', value: employees.length, color: 'purple' },
                ].map((s, i) => (
                    <Card key={i} className={`p-4 bg-${s.color}-50 dark:bg-${s.color}-900/10 border-${s.color}-100 dark:border-${s.color}-800`}>
                        <p className={`text-xs font-bold text-${s.color}-600 dark:text-${s.color}-400 uppercase tracking-wider`}>{s.label}</p>
                        <p className={`text-3xl font-black text-${s.color}-800 dark:text-${s.color}-200 mt-1`}>{s.value}</p>
                    </Card>
                ))}
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 dark:bg-dark-800/80 border-b border-slate-100 dark:border-dark-700">
                            <tr>
                                {['Colaborador', 'Período', 'Dias', 'Estado', 'Ações'].map(h => (
                                    <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                            {deptRequests.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">Nenhum pedido de férias registado.</td></tr>
                            ) : deptRequests.map(req => (
                                <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4"><p className="font-bold text-gray-900 dark:text-white">{employees.find(e => e.id === req.employeeId)?.name || ''}</p></td>
                                    <td className="px-6 py-4"><div className="flex items-center gap-2 text-sm text-gray-500"><HiOutlineCalendar /><span>{new Date(req.startDate).toLocaleDateString('pt-MZ')}</span><span>â†’</span><span>{new Date(req.endDate).toLocaleDateString('pt-MZ')}</span></div></td>
                                    <td className="px-6 py-4"><span className="font-mono font-bold bg-gray-100 dark:bg-dark-800 px-2 py-1 rounded">{req.days}d</span></td>
                                    <td className="px-6 py-4"><Badge variant={req.status === 'approved' ? 'success' : req.status === 'pending' ? 'warning' : 'danger'}>{req.status.toUpperCase()}</Badge></td>
                                    <td className="px-6 py-4">
                                        {req.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprove(req.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><HiOutlineCheckCircle className="w-5 h-5" /></button>
                                                <button onClick={() => handleReject(req.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><HiOutlineXCircle className="w-5 h-5" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Pedido de Férias">
                <div className="p-4 space-y-4">
                    <Select label="Colaborador" options={employees.map(e => ({ value: e.id, label: e.name }))} value={newReq.employeeId} onChange={e => setNewReq(p => ({ ...p, employeeId: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Data Início" type="date" value={newReq.startDate} onChange={e => setNewReq(p => ({ ...p, startDate: e.target.value }))} />
                        <Input label="Data Fim" type="date" value={newReq.endDate} onChange={e => setNewReq(p => ({ ...p, endDate: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSubmit}>Submeter Pedido</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function CompliancePanel({ config }: { config: ModuleHRConfig }) {
    const defaultDocs = config.documentTypes || [
        { id: 'bi', label: 'Bilhete de Identidade', required: true },
        { id: 'nuit', label: 'NUIT', required: true },
        { id: 'inss', label: 'Cartão de Beneficiário INSS', required: true },
        { id: 'contract', label: 'Contrato de Trabalho', required: true },
        { id: 'cv', label: 'Currículo Vitae' },
        { id: 'health', label: 'Certificado de Saúde' },
    ];
    const c = config.accentColor;
    return (
        <div className="space-y-6 animate-fade-in">
            <Card variant="glass" padding="md">
                <h3 className={`font-black text-sm uppercase tracking-widest text-${c}-600 flex items-center gap-2 mb-4`}><HiOutlineShieldCheck className="w-5 h-5" />Documentos Obrigatórios - {config.moduleName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {defaultDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-700">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white text-sm">{doc.label}</p>
                                {doc.required && <Badge variant="warning" size="sm">Obrigatório</Badge>}
                            </div>
                            <Badge variant="outline" size="sm">A Verificar</Badge>
                        </div>
                    ))}
                </div>
            </Card>
            <Card variant="glass" padding="md">
                <div className="flex items-center gap-3 text-amber-600 mb-4">
                    <HiOutlineExclamationTriangle className="w-5 h-5" />
                    <h4 className="font-black text-xs uppercase tracking-widest">Nota de Conformidade</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Certifique-se de que todos os colaboradores do departamento de <strong>{config.moduleName}</strong> têm os documentos actualizados e dentro da validade. Documentos em falta podem gerar multas em auditorias laborais.</p>
            </Card>
        </div>
    );
}

export function BonusConfigPanel({ config }: { config: ModuleHRConfig }) {
    const [rules, setRules] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        employeesAPI.getCommissionRules().then(data => setRules(data || [])).catch(() => {}).finally(() => setIsLoading(false));
    }, []);

    if (isLoading) return <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <Card variant="glass" padding="md">
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
                    <HiOutlineCurrencyDollar className="w-5 h-5 text-teal-500" />Regras de Comissão & Bónus - {config.moduleName}
                </h3>
                {rules.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <HiOutlineCurrencyDollar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm italic">Nenhuma regra de comissão configurada.</p>
                        <p className="text-xs mt-1">Configure regras globais em RH â†’ Configurações.</p>
                    </div>
                ) : rules.map((rule, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-700 mb-3">
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{rule.type === 'fixed' ? 'Taxa Fixa' : rule.type === 'tiered' ? 'Por Escalões' : 'Por Lucro'}</p>
                            <p className="text-xs text-gray-500">Taxa: {rule.rate ? `${rule.rate}%` : 'N/A'} • {rule.employeeId ? 'Individual' : `Função: ${rule.role || 'Global'}`}</p>
                        </div>
                        <Badge variant={rule.isActive ? 'success' : 'gray'}>{rule.isActive ? 'ACTIVO' : 'INACTIVO'}</Badge>
                    </div>
                ))}
            </Card>
        </div>
    );
}

// â”€â”€-Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€-

export function ModuleHRPage({ config }: { config: ModuleHRConfig }) {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const { employees: allEmployees, refetch, isLoading } = useEmployees({ limit: 500 });

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'dashboard', label: 'dashboard', icon: <HiOutlineChartBar className="w-5 h-5" /> },
        { id: 'staff', label: 'Equipa', icon: <HiOutlineUsers className="w-5 h-5" /> },
        { id: 'attendance', label: 'Assiduidade', icon: <HiOutlineClock className="w-5 h-5" /> },
        { id: 'payroll', label: 'Processamento', icon: <HiOutlineBanknotes className="w-5 h-5" /> },
        { id: 'vacations', label: 'Férias', icon: <HiOutlineSun className="w-5 h-5" /> },
        { id: 'compliance', label: 'Conformidade', icon: <HiOutlineShieldCheck className="w-5 h-5" /> },
        { id: 'config', label: 'Configurações', icon: <HiOutlineCurrencyDollar className="w-5 h-5" /> },
    ];

    const c = config.accentColor;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader
                title={`Recursos Humanos - ${config.moduleName}`}
                subtitle={`Gestão completa de colaboradores e conformidade laboral`}
                icon={config.icon}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" leftIcon={<HiOutlineArrowPath />} onClick={() => refetch()}>Actualizar</Button>
                        <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => { setEditingEmployee(null); setShowEmployeeForm(true); }}>Adicionar Colaborador</Button>
                    </div>
                }
            />

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-dark-700 overflow-x-auto pb-px">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all duration-200 ${
                            activeTab === tab.id
                                ? `border-${c}-500 text-${c}-600 dark:text-${c}-400`
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div>
                {isLoading && activeTab === 'dashboard' ? (
                    <div className="h-96 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
                ) : activeTab === 'dashboard' ? (
                    <HRDashboard config={config} employees={allEmployees || []} />
                ) : activeTab === 'staff' ? (
                    <EmployeeList department={config.department} onEdit={(emp) => { setEditingEmployee(emp); setShowEmployeeForm(true); }} onAddEmployee={() => { setEditingEmployee(null); setShowEmployeeForm(true); }} />
                ) : activeTab === 'attendance' ? (
                    <AttendancePanel config={config} employees={allEmployees || []} />
                ) : activeTab === 'payroll' ? (
                    <PayrollPanel config={config} employees={allEmployees || []} />
                ) : activeTab === 'vacations' ? (
                    <VacationsPanel config={config} employees={allEmployees || []} />
                ) : activeTab === 'compliance' ? (
                    <CompliancePanel config={config} />
                ) : (
                    <BonusConfigPanel config={config} />
                )}
            </div>

            <EmployeeForm
                isOpen={showEmployeeForm}
                onClose={() => { setShowEmployeeForm(false); setEditingEmployee(null); refetch(); }}
                employee={editingEmployee}
            />
        </div>
    );
}

