import React, { useMemo } from 'react';
import {
    HiOutlineUsers,
    HiOutlineClock,
    HiOutlineBanknotes,
    HiOutlineExclamationTriangle,
    HiOutlineCalendar,
    HiOutlineChartBar,
    HiOutlineCurrencyDollar,
    HiOutlineTrophy,
} from 'react-icons/hi2';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { Card, Badge, LoadingSpinner } from '../../ui';
import { formatCurrency } from '../../../utils/helpers';
import { useEmployees, useAttendance, usePayroll } from '../../../hooks/useData';
import { MetricCard, CHART_COLORS } from '../../../components/common/ModuleMetricCard';
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
    if (isLoading) return <div className="h-96 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={<HiOutlineUsers />}
                    color="blue"
                    value={metrics.total}
                    label="Equipa Comercial"
                    badge={<Badge variant="success" size="sm">{metrics.active} ACTIVOS</Badge>}
                />
                <MetricCard
                    icon={<HiOutlineClock />}
                    color="emerald"
                    value={metrics.attendanceRate > 0 ? `${metrics.attendanceRate.toFixed(1)}%` : '0%'}
                    label="Taxa de Assiduidade"
                    badge={<span className="text-[10px] font-black uppercase text-emerald-600">{metrics.presentToday} PRESENTES</span>}
                />
                <MetricCard
                    icon={<HiOutlineBanknotes />}
                    color="violet"
                    value={metrics.monthlyCost}
                    label="Massa Salarial"
                    isCurrency
                    badge={<span className="text-[10px] font-black uppercase text-violet-600">{payroll?.length || 0} REGISTOS</span>}
                />
                <MetricCard
                    icon={<HiOutlineCurrencyDollar />}
                    color="amber"
                    value={metrics.totalCommissions}
                    label="Comissões do Mês"
                    isCurrency
                    badge={<span className="text-[10px] font-black uppercase text-amber-600">{topPerformers.length} VENDEDORES</span>}
                />
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
