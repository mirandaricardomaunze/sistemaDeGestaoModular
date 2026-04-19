import React, { useState } from 'react';
import { 
    HiOutlineMagnifyingGlass, 
    HiOutlineClock,
    HiOutlineCalendar
} from 'react-icons/hi2';
import { HiOutlineLogin, HiOutlineLogout } from 'react-icons/hi';
import { Card, Button, Input, Badge, LoadingSpinner } from '../../ui';
import { useDrivers, useStaffAttendance, useRecordStaffTime } from '../../../hooks/useLogistics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const LogisticsAttendanceControl: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const { data: staff, isLoading: isLoadingStaff } = useDrivers({ limit: 100 });
    const { data: attendance, refetch } = useStaffAttendance({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    });

    const recordMutation = useRecordStaffTime();

    const handleRecord = async (staffId: string, type: 'checkIn' | 'checkOut') => {
        await recordMutation.mutateAsync({ staffId, type });
        refetch();
    };

    const filteredStaff = staff?.data.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    if (isLoadingStaff) return <LoadingSpinner size="lg" className="h-64" />;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-md relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                        placeholder="Pesquisar colaborador por nome ou código..."
                        className="pl-10 h-11"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                    <HiOutlineCalendar className="w-5 h-5" />
                    {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </div>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card variant="glass" className="p-4 border-l-4 border-l-green-500 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600">
                        <HiOutlineLogin className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Presentes</p>
                        <h4 className="text-xl font-bold">{attendance?.filter(a => a.checkIn && !a.checkOut).length || 0}</h4>
                    </div>
                </Card>
                <Card variant="glass" className="p-4 border-l-4 border-l-blue-500 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <HiOutlineLogout className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Finalizados</p>
                        <h4 className="text-xl font-bold">{attendance?.filter(a => a.checkOut).length || 0}</h4>
                    </div>
                </Card>
                <Card variant="glass" className="p-4 border-l-4 border-l-orange-500 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600">
                        <HiOutlineClock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Em Espera</p>
                        <h4 className="text-xl font-bold">{filteredStaff.length - (attendance?.length || 0)}</h4>
                    </div>
                </Card>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.map((person) => {
                    const record = attendance?.find(a => a.staffId === person.id);
                    return (
                        <Card key={person.id} variant="glass" className="relative group overflow-hidden border-t-2 border-t-primary-500/30">
                            <div className="p-5 space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-black text-lg">
                                        {person.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 dark:text-white truncate">{person.name}</h4>
                                        <p className="text-xs text-gray-500">{person.category.toUpperCase()} • {person.code}</p>
                                    </div>
                                    {record?.checkIn && !record?.checkOut && (
                                        <Badge variant="success" className="animate-pulse">EM SERVIÇO</Badge>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Entrada:</span>
                                        <span className="font-bold">{record?.checkIn || '--:--'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Saída:</span>
                                        <span className="font-bold">{record?.checkOut || '--:--'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant={record?.checkIn ? "outline" : "primary"}
                                        size="sm"
                                        className="flex-1 rounded-lg font-black text-[10px] uppercase"
                                        disabled={!!record?.checkIn || recordMutation.isLoading}
                                        leftIcon={<HiOutlineLogin className="w-4 h-4" />}
                                        onClick={() => handleRecord(person.id, 'checkIn')}
                                    >
                                        Check-In
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 rounded-lg font-black text-[10px] uppercase border-orange-200 text-orange-600"
                                        disabled={!record?.checkIn || !!record?.checkOut || recordMutation.isLoading}
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
        </div>
    );
};
