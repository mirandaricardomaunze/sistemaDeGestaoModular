import React, { useState, useMemo } from 'react';
import {
    HiOutlineMagnifyingGlass,
    HiOutlineClock,
    HiOutlineCalendar,
    HiOutlineDocumentMagnifyingGlass,
} from 'react-icons/hi2';
import { HiOutlineLogin, HiOutlineLogout } from 'react-icons/hi';
import { Card, Button, Input, Badge, LoadingSpinner, Modal } from '../../ui';
import { useEmployees, useAttendance } from '../../../hooks/useData';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const CommercialAttendanceControl: React.FC = () => {
    const [search, setSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const { employees: allStaff, isLoading } = useEmployees({ limit: 200 });

    const staff = useMemo(() =>
        (allStaff || []).filter(e => !e.department || e.department === 'Comercial'),
        [allStaff]);

    const { attendance, refetch, recordAttendance } = useAttendance({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });

    const { attendance: history, isLoading: loadingHistory } = useAttendance({
        employeeId: selectedEmployee?.id,
        startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });

    const handleRecord = async (employeeId: string, type: 'checkIn' | 'checkOut') => {
        await recordAttendance({
            employeeId,
            date: format(new Date(), 'yyyy-MM-dd'),
            [type]: format(new Date(), 'HH:mm'),
            status: type === 'checkIn' ? 'present' : undefined,
        });
        refetch();
    };

    const filtered = staff.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code?.toLowerCase().includes(search.toLowerCase())
    );

    const historySummary = useMemo(() => {
        if (!history || history.length === 0) return { present: 0, late: 0, hours: 0 };
        return {
            present: history.filter(h => h.status === 'present').length,
            late: history.filter(h => h.status === 'late').length,
            hours: history.reduce((acc, h) => acc + (h.hoursWorked || 0), 0),
        };
    }, [history]);

    const presentCount = (attendance || []).filter(a => a.checkIn && !a.checkOut).length;
    const exitCount = (attendance || []).filter(a => a.checkOut).length;
    const absentCount = Math.max(0, filtered.length - (attendance?.length || 0));

    if (isLoading) return <LoadingSpinner size="lg" className="h-64" />;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-md relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                        placeholder="Pesquisar colaborador..."
                        className="pl-10 h-11"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                    <HiOutlineCalendar className="w-5 h-5" />
                    {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card variant="glass" className="p-4 border-l-4 border-l-teal-500 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600">
                        <HiOutlineLogin className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Presentes Hoje</p>
                        <h4 className="text-xl font-black font-mono">{presentCount}</h4>
                    </div>
                </Card>
                <Card variant="glass" className="p-4 border-l-4 border-l-blue-500 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <HiOutlineLogout className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Saídas Registadas</p>
                        <h4 className="text-xl font-black font-mono">{exitCount}</h4>
                    </div>
                </Card>
                <Card variant="glass" className="p-4 border-l-4 border-l-amber-500 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600">
                        <HiOutlineClock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Ausentes</p>
                        <h4 className="text-xl font-black font-mono">{absentCount}</h4>
                    </div>
                </Card>
            </div>

            {/* Staff Cards */}
            {filtered.length === 0 ? (
                <Card variant="glass" className="p-12 text-center text-gray-400 italic">
                    Nenhum colaborador encontrado na equipa comercial
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(person => {
                        const record = (attendance || []).find(a => a.employeeId === person.id);
                        return (
                            <Card key={person.id} variant="glass" className="relative group overflow-hidden border-t-2 border-t-primary-500/10 hover:border-t-primary-500 transition-all duration-300">
                                <div className="p-5 space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-black text-lg">
                                            {person.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 dark:text-white truncate">{person.name}</h4>
                                            <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                                                {person.role || person.department || 'Comercial'} • {person.code}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedEmployee(person); setIsHistoryOpen(true); }}
                                            className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-dark-700/50 text-gray-400 hover:text-primary-500 transition-colors"
                                            title="Ver Histórico"
                                        >
                                            <HiOutlineDocumentMagnifyingGlass className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-gray-100 dark:border-dark-700/50">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entrada</span>
                                            <p className={`text-xs font-black font-mono italic ${record?.checkIn ? 'text-teal-600' : 'text-gray-400'}`}>
                                                {record?.checkIn || '--:--'}
                                            </p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Saída</span>
                                            <p className={`text-xs font-black font-mono italic ${record?.checkOut ? 'text-blue-600' : 'text-gray-400'}`}>
                                                {record?.checkOut || '--:--'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            variant={record?.checkIn ? 'outline' : 'primary'}
                                            size="sm"
                                            className="flex-1 rounded-lg font-black text-[10px] uppercase tracking-widest h-10"
                                            disabled={!!record?.checkIn}
                                            leftIcon={<HiOutlineLogin className="w-4 h-4" />}
                                            onClick={() => handleRecord(person.id, 'checkIn')}
                                        >
                                            Check-In
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 rounded-lg font-black text-[10px] uppercase tracking-widest h-10 border-orange-200 text-orange-600 hover:bg-orange-50"
                                            disabled={!record?.checkIn || !!record?.checkOut}
                                            leftIcon={<HiOutlineLogout className="w-4 h-4" />}
                                            onClick={() => handleRecord(person.id, 'checkOut')}
                                        >
                                            Check-Out
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* History Modal */}
            <Modal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                title={`Histórico - ${selectedEmployee?.name}`}
                size="lg"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-900/10 border border-teal-100">
                            <p className="text-[10px] font-black uppercase text-teal-600 mb-1">Presenças</p>
                            <p className="text-xl font-black text-teal-700">{historySummary.present}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100">
                            <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Atrasos</p>
                            <p className="text-xl font-black text-amber-700">{historySummary.late}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100">
                            <p className="text-[10px] font-black uppercase text-indigo-600 mb-1">Horas Total</p>
                            <p className="text-xl font-black text-indigo-700">{historySummary.hours.toFixed(1)}h</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h5 className="text-xs font-black uppercase tracking-widest text-gray-500">Registos - Últimos 30 dias</h5>
                        {loadingHistory ? <LoadingSpinner size="md" /> :
                            !history?.length ? (
                                <p className="text-center py-8 text-gray-400 italic">Nenhum registo encontrado</p>
                            ) : (
                                <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                                    {[...history].sort((a, b) => b.date.localeCompare(a.date)).map((h, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-700">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-dark-800 flex items-center justify-center text-[10px] font-black">
                                                    {format(new Date(h.date), 'dd')}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold">{format(new Date(h.date), 'dd/MM/yyyy')}</p>
                                                    <Badge variant={h.status === 'present' ? 'success' : 'warning'} size="sm">
                                                        {h.status?.toUpperCase()}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black font-mono">{h.checkIn || '--:--'} → {h.checkOut || '--:--'}</p>
                                                <p className="text-[10px] text-gray-400">{(h.hoursWorked || 0).toFixed(1)}h</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>

                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(false)}>Fechar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
