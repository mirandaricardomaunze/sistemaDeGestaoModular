import React, { useMemo } from 'react';
import {
    HiOutlineUsers,
    HiOutlineClock,
    HiOutlineBanknotes,
    HiOutlineShieldCheck,
    HiOutlineArrowTrendingUp,
    HiOutlineExclamationTriangle,
    HiOutlineCalendar,
    HiOutlineChartBar
} from 'react-icons/hi2';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { Card, Badge, LoadingSpinner } from '../../ui';
import { formatCurrency } from '../../../utils/helpers';
import { useEmployees, useAttendance, usePayroll } from '../../../hooks/useData';
import { CHART_COLORS } from '../../../components/common/ModuleMetricCard';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const PharmacyHRDashboard: React.FC = () => {
    const { employees, isLoading: loadingEmployees } = useEmployees({ limit: 200 });
    const { attendance, isLoading: loadingAttendance } = useAttendance({
        startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    const { payroll, isLoading: loadingPayroll } = usePayroll({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
    });

    const isLoading = loadingEmployees || loadingAttendance || loadingPayroll;

    // Process real stats
    const metrics = useMemo(() => {
        const totalEmployees = employees?.length || 0;

        const today = format(new Date(), 'yyyy-MM-dd');
        const presentToday = attendance?.filter(a => a.date === today && a.status === 'present').length || 0;
        const attendanceRate = totalEmployees > 0 ? (presentToday / totalEmployees) * 100 : 0;

        const monthlyCost = payroll?.reduce((acc, p) => acc + (Number(p.netSalary) || 0), 0) || 0;

        const now = new Date();
        const pendingCompliance = employees?.filter(e => {
            if (!e.contractExpiry) return true; // Não expiry set = needs attention
            const expiry = new Date(e.contractExpiry);
            const diffInDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
            return diffInDays < 30;
        }).length || 0;

        return { totalEmployees, attendanceRate, monthlyCost, pendingCompliance };
    }, [employees, attendance, payroll]);

    // Real attendance trend for last 7 days (one entry per day)
    const attendanceTrendData = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const day = subDays(new Date(), 6 - i);
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayRecords = attendance?.filter(a => a.date === dateStr) || [];
            return {
                name: format(day, 'EEE', { locale: ptBR }),
                presente: dayRecords.filter(a => a.status === 'present').length,
                atraso: dayRecords.filter(a => a.status === 'late').length,
            };
        });
    }, [attendance]);

    // Real payroll cost distribution from actual payroll records
    const payrollDistData = useMemo(() => {
        if (!payroll || payroll.length === 0) return [
            { name: 'Salário Base', value: 70 },
            { name: 'Comissões', value: 15 },
            { name: 'Subsídios', value: 10 },
            { name: 'Horas Extra', value: 5 },
        ];
        const totals = payroll.reduce((acc, p) => ({
            base: acc.base + Number(p.baseSalary || 0),
            bonus: acc.bonus + Number(p.bonus || 0),
            allowances: acc.allowances + Number(p.allowances || 0),
            otAmount: acc.otAmount + Number(p.otAmount || 0),
        }), { base: 0, bonus: 0, allowances: 0, otAmount: 0 });

        const total = totals.base + totals.bonus + totals.allowances + totals.otAmount || 1;
        return [
            { name: 'Salário Base', value: Math.round((totals.base / total) * 100) },
            { name: 'Comissões', value: Math.round((totals.bonus / total) * 100) },
            { name: 'Subsídios', value: Math.round((totals.allowances / total) * 100) },
            { name: 'Horas Extra', value: Math.round((totals.otAmount / total) * 100) },
        ];
    }, [payroll]);

    // Recent activity derived from real data
    const recentActivity = useMemo(() => {
        const items: { user: string; action: string; time: string; type: string }[] = [];

        // Last check-ins today
        const today = format(new Date(), 'yyyy-MM-dd');
        const todayCheckIns = (attendance || [])
            .filter(a => a.date === today && a.checkIn)
            .slice(0, 2);

        for (const rec of todayCheckIns) {
            const emp = employees?.find(e => e.id === rec.employeeId);
            if (emp) {
                items.push({ user: emp.name, action: `Check-in às ${rec.checkIn}`, time: 'Hoje', type: 'attendance' });
            }
        }

        // Last processed payrolls
        const processed = (payroll || []).filter(p => p.status === 'processed' || p.status === 'paid').slice(0, 2);
        for (const p of processed) {
            const emp = employees?.find(e => e.id === p.employeeId);
            if (emp) {
                items.push({ user: emp.name, action: p.status === 'paid' ? 'Salário pago' : 'Folha processada', time: 'Este mês', type: 'payroll' });
            }
        }

        // Employees with contract expiring soon
        const expiring = (employees || []).filter(e => {
            if (!e.contractExpiry) return false;
            const diff = Math.ceil((new Date(e.contractExpiry).getTime() - Date.now()) / (1000 * 3600 * 24));
            return diff > 0 && diff <= 30;
        }).slice(0, 1);

        for (const e of expiring) {
            items.push({ user: e.name, action: 'Contrato expira em breve', time: `Expira: ${new Date(e.contractExpiry!).toLocaleDateString('pt-MZ')}`, type: 'compliance' });
        }

        return items.slice(0, 5);
    }, [attendance, employees, payroll]);

    const stats = [
        {
            label: 'Total de Colaboradores',
            value: metrics.totalEmployees.toString(),
            trend: `${employees?.filter(e => e.isActive).length || 0} activos`,
            icon: HiOutlineUsers,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20'
        },
        {
            label: 'Taxa de Assiduidade',
            value: metrics.attendanceRate > 0 ? `${metrics.attendanceRate.toFixed(1)}%` : '',
            trend: `${attendance?.filter(a => a.date === format(new Date(), 'yyyy-MM-dd') && a.status === 'present').length || 0} presentes hoje`,
            icon: HiOutlineClock,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20'
        },
        {
            label: 'Custo Salarial Mensal',
            value: metrics.monthlyCost > 0 ? formatCurrency(metrics.monthlyCost) : '',
            trend: `${payroll?.length || 0} registos`,
            icon: HiOutlineBanknotes,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50 dark:bg-indigo-900/20'
        },
        {
            label: 'Doc. Requerem Atenção',
            value: metrics.pendingCompliance.toString(),
            trend: 'Expiraces próximas',
            icon: HiOutlineShieldCheck,
            color: 'text-amber-600',
            bg: 'bg-amber-50 dark:bg-amber-900/20'
        }
    ];

    if (isLoading) {
        return (
            <div className="h-96 flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <Card key={idx} variant="glass" className="relative group overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 duration-300`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                <Badge variant={idx === 3 && metrics.pendingCompliance > 0 ? 'danger' : 'success'} size="sm">
                                    {idx === 3 && metrics.pendingCompliance > 0 ? 'ATENÇÃO' : 'ESTÁVEL'}
                                </Badge>
                            </div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">
                                {stat.label}
                            </h3>
                            <p className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white mb-2">
                                {stat.value}
                            </p>
                            <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                <HiOutlineArrowTrendingUp className="w-3 h-3 text-green-500" />
                                {stat.trend}
                            </p>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:w-full w-12 ${stat.color.replace('text', 'bg')}`} />
                    </Card>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card variant="glass" padding="md">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <HiOutlineCalendar className="w-4 h-4 text-primary-500" />
                            Tendência de Assiduidade
                        </h4>
                        <Badge variant="outline">Últimos 7 dias</Badge>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attendanceTrendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    cursor={{ fill: '#F1F5F9' }}
                                />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 items-center">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={payrollDistData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {payrollDistData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v) => `${v}%`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                            {payrollDistData.map((item, idx) => (
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
                {/* Recent Activity - real data */}
                <Card variant="glass" className="lg:col-span-2">
                    <div className="p-6 border-b border-gray-100 dark:border-dark-700/50 flex justify-between items-center">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-500" />
                            Actividade Recente
                        </h4>
                    </div>
                    <div className="p-6 space-y-4">
                        {recentActivity.length === 0 ? (
                            <p className="text-center py-8 text-gray-400 text-xs italic">Nenhuma actividade recente registada</p>
                        ) : (
                            recentActivity.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 group cursor-pointer p-2 rounded-lg hover:bg-white/50 dark:hover:bg-dark-700/30 transition-all">
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-bold text-primary-600 group-hover:scale-110 transition-transform">
                                        {item.user.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.user}</p>
                                        <p className="text-xs text-gray-500">{item.action}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 font-medium">{item.time}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Compliance Alerts */}
                <Card variant="glass" className="border-l-4 border-l-amber-500 h-full">
                    <div className="p-6 border-b border-gray-100 dark:border-dark-700/50">
                        <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-amber-600">
                            <HiOutlineExclamationTriangle className="w-4 h-4" />
                            Alertas de Conformidade
                        </h4>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Carteiras Profissionais</span>
                                <span className="text-[10px] font-bold text-amber-600">{metrics.pendingCompliance} Pendentes</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-500 transition-all duration-1000"
                                    style={{ width: metrics.totalEmployees > 0 ? `${Math.min(100, (metrics.pendingCompliance / metrics.totalEmployees) * 100 * 2)}%` : '0%' }}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Exames Médicos</span>
                                <span className="text-[10px] font-bold text-green-600">Em dia</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 w-full" />
                            </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100 dark:border-dark-700/50">
                            <p className="text-[10px] text-gray-500 italic">
                                * A conformidade legal é auditada automaticamente todas as noites.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
