import React, { useMemo } from 'react';
import {
    HiOutlineUsers,
    HiOutlineClock,
    HiOutlineBanknotes,
    HiOutlineArrowTrendingUp,
    HiOutlineExclamationTriangle,
    HiOutlineCalendar,
    HiOutlineChartBar,
    HiOutlineCurrencyDollar,
    HiOutlineTrophy,
} from 'react-icons/hi2';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts';
import { Card, Badge, LoadingSpinner } from '../../ui';
import { formatCurrency } from '../../../utils/helpers';
import { useEmployees, useAttendance, usePayroll } from '../../../hooks/useData';
import { CHART_COLORS } from '../../../components/common/ModuleMetricCard';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const CommercialHRDashboard: React.FC = () => {
    const { employees, isLoading: loadingEmp } = useEmployees({ limit: 200 });
    const { attendance, isLoading: loadingAtt } = useAttendance({
        startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    const { payroll, isLoading: loadingPay } = usePayroll({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
    });

    const isLoading = loadingEmp || loadingAtt || loadingPay;

    const deptEmployees = useMemo(() =>
        (employees || []).filter(e => !e.department || e.department === 'Comercial'),
        [employees]);

    const metrics = useMemo(() => {
        const total = deptEmployees.length;
        const active = deptEmployees.filter(e => e.isActive !== false).length;
        const today = format(new Date(), 'yyyy-MM-dd');
        const presentToday = (attendance || []).filter(a => a.date === today && a.status === 'present').length;
        const attendanceRate = total > 0 ? (presentToday / total) * 100 : 0;
        const monthlyCost = (payroll || []).reduce((acc, p) => acc + (Number(p.netSalary) || 0), 0);
        const totalCommissions = (payroll || []).reduce((acc, p) => acc + (Number(p.bonus) || 0), 0);
        const contractAlerts = deptEmployees.filter(e => {
            if (!e.contractExpiry) return true;
            const diff = Math.ceil((new Date(e.contractExpiry).getTime() - Date.now()) / 86400000);
            return diff < 30;
        }).length;
        return { total, active, attendanceRate, monthlyCost, totalCommissions, contractAlerts, presentToday };
    }, [deptEmployees, attendance, payroll]);

    const attendanceTrend = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => {
            const day = subDays(new Date(), 6 - i);
            const dateStr = format(day, 'yyyy-MM-dd');
            const recs = (attendance || []).filter(a => a.date === dateStr);
            return {
                name: format(day, 'EEE', { locale: ptBR }),
                presente: recs.filter(a => a.status === 'present').length,
                atraso: recs.filter(a => a.status === 'late').length,
            };
        }), [attendance]);

    const payrollDist = useMemo(() => {
        if (!payroll || payroll.length === 0) return [
            { name: 'Salário Base', value: 60 },
            { name: 'Comissões', value: 25 },
            { name: 'Subsídios', value: 10 },
            { name: 'Horas Extra', value: 5 },
        ];
        const t = payroll.reduce((acc, p) => ({
            base: acc.base + Number(p.baseSalary || 0),
            bonus: acc.bonus + Number(p.bonus || 0),
            allowances: acc.allowances + Number(p.allowances || 0),
            ot: acc.ot + Number(p.otAmount || 0),
        }), { base: 0, bonus: 0, allowances: 0, ot: 0 });
        const total = t.base + t.bonus + t.allowances + t.ot || 1;
        return [
            { name: 'Salário Base', value: Math.round((t.base / total) * 100) },
            { name: 'Comissões', value: Math.round((t.bonus / total) * 100) },
            { name: 'Subsídios', value: Math.round((t.allowances / total) * 100) },
            { name: 'Horas Extra', value: Math.round((t.ot / total) * 100) },
        ];
    }, [payroll]);

    // Top performers by commission
    const topPerformers = useMemo(() => {
        return (payroll || [])
            .map(p => {
                const emp = deptEmployees.find(e => e.id === p.employeeId);
                return { name: emp?.name || '', commission: Number(p.bonus || 0), role: emp?.role || '' };
            })
            .filter(p => p.commission > 0)
            .sort((a, b) => b.commission - a.commission)
            .slice(0, 5);
    }, [payroll, deptEmployees]);

    const recentActivity = useMemo(() => {
        const items: { user: string; action: string; time: string; type: string }[] = [];
        const today = format(new Date(), 'yyyy-MM-dd');
        (attendance || []).filter(a => a.date === today && a.checkIn).slice(0, 2).forEach(rec => {
            const emp = deptEmployees.find(e => e.id === rec.employeeId);
            if (emp) items.push({ user: emp.name, action: `Check-in às ${rec.checkIn}`, time: 'Hoje', type: 'attendance' });
        });
        (payroll || []).filter(p => p.status === 'paid').slice(0, 2).forEach(p => {
            const emp = deptEmployees.find(e => e.id === p.employeeId);
            if (emp) items.push({ user: emp.name, action: 'Salário pago', time: 'Este mês', type: 'payroll' });
        });
        deptEmployees.filter(e => {
            if (!e.contractExpiry) return false;
            const diff = Math.ceil((new Date(e.contractExpiry).getTime() - Date.now()) / 86400000);
            return diff > 0 && diff <= 30;
        }).slice(0, 1).forEach(e => {
            items.push({ user: e.name, action: 'Contrato expira em breve', time: new Date(e.contractExpiry!).toLocaleDateString('pt-MZ'), type: 'compliance' });
        });
        return items.slice(0, 5);
    }, [attendance, deptEmployees, payroll]);

    const stats = [
        {
            label: 'Equipa Comercial', value: metrics.total.toString(),
            sub: `${metrics.active} activos`, icon: HiOutlineUsers,
            color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', badge: 'success',
            cardBg: 'bg-blue-50/60 dark:bg-blue-950/30',
            cardBorder: 'border border-blue-200/70 dark:border-blue-800/40',
            accent: 'bg-blue-500',
        },
        {
            label: 'Taxa de Assiduidade', value: metrics.attendanceRate > 0 ? `${metrics.attendanceRate.toFixed(1)}%` : '',
            sub: `${metrics.presentToday} presentes hoje`, icon: HiOutlineClock,
            color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', badge: 'success',
            cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/30',
            cardBorder: 'border border-emerald-200/70 dark:border-emerald-800/40',
            accent: 'bg-emerald-500',
        },
        {
            label: 'Massa Salarial Mensal', value: metrics.monthlyCost > 0 ? formatCurrency(metrics.monthlyCost) : '',
            sub: `${payroll?.length || 0} registos`, icon: HiOutlineBanknotes,
            color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20', badge: 'success',
            cardBg: 'bg-violet-50/60 dark:bg-violet-950/30',
            cardBorder: 'border border-violet-200/70 dark:border-violet-800/40',
            accent: 'bg-violet-500',
        },
        {
            label: 'Comissões do Mês', value: metrics.totalCommissions > 0 ? formatCurrency(metrics.totalCommissions) : '',
            sub: `${topPerformers.length} vendedores c/ comissão`, icon: HiOutlineCurrencyDollar,
            color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', badge: metrics.totalCommissions > 0 ? 'success' : 'gray',
            cardBg: 'bg-amber-50/60 dark:bg-amber-950/30',
            cardBorder: 'border border-amber-200/70 dark:border-amber-800/40',
            accent: 'bg-amber-500',
        },
    ];

    if (isLoading) return <div className="h-96 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, i) => (
                    <div
                        key={i}
                        className={`relative group overflow-hidden rounded-xl ${s.cardBg} ${s.cardBorder} shadow-sm hover:shadow-md transition-all duration-300`}
                    >
                        {/* Top accent bar */}
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-xl ${s.bg} ${s.color} transition-transform group-hover:scale-110 duration-300`}>
                                    <s.icon className="w-6 h-6" />
                                </div>
                                <Badge variant={s.badge as any} size="sm">
                                    {i === 3 && metrics.totalCommissions === 0 ? 'SEM DADOS' : 'ACTIVO'}
                                </Badge>
                            </div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                            <p className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white mb-2">{s.value || '—'}</p>
                            <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                <HiOutlineArrowTrendingUp className="w-3 h-3 text-green-500" />
                                {s.sub}
                            </p>
                        </div>

                        {/* Bottom hover bar */}
                        <div className={`absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-8 ${s.accent}`} />
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card variant="glass" padding="md">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <HiOutlineCalendar className="w-4 h-4 text-primary-500" />
                            Assiduidade da Equipa
                        </h4>
                        <Badge variant="outline">Últimos 7 dias</Badge>
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
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <HiOutlineChartBar className="w-4 h-4 text-indigo-500" />
                            Distribuição de Custos
                        </h4>
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
                {/* Recent Activity */}
                <Card variant="glass" className="lg:col-span-2">
                    <div className="p-6 border-b border-gray-100 dark:border-dark-700/50">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-500" />
                            Actividade Recente
                        </h4>
                    </div>
                    <div className="p-6 space-y-4">
                        {recentActivity.length === 0 ? (
                            <p className="text-center py-8 text-gray-400 text-xs italic">Nenhuma actividade recente registada</p>
                        ) : recentActivity.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-dark-700/30 transition-all cursor-pointer">
                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-bold text-primary-600">
                                    {item.user.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.user}</p>
                                    <p className="text-xs text-gray-500">{item.action}</p>
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium">{item.time}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Top Performers */}
                <Card variant="glass" className="border-l-4 border-l-teal-500">
                    <div className="p-6 border-b border-gray-100 dark:border-dark-700/50">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-teal-600">
                            <HiOutlineTrophy className="w-4 h-4" />
                            Top Comissões
                        </h4>
                    </div>
                    <div className="p-6 space-y-4">
                        {topPerformers.length === 0 ? (
                            <p className="text-center py-8 text-gray-400 text-xs italic">Sem dados de comissões este mês</p>
                        ) : topPerformers.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                                    idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500'
                                }`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-gray-900 dark:text-white truncate">{p.name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{p.role}</p>
                                </div>
                                <span className="text-xs font-black text-teal-600 font-mono">{formatCurrency(p.commission)}</span>
                            </div>
                        ))}
                        {metrics.contractAlerts > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700/50">
                                <div className="flex items-center gap-2 text-amber-600">
                                    <HiOutlineExclamationTriangle className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{metrics.contractAlerts} contrato(s) a expirar</span>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
