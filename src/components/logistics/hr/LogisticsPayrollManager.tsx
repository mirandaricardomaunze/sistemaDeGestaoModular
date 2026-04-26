import React, { useState } from 'react';
import {
    HiOutlineBanknotes,
    HiOutlineDocumentArrowDown,
    HiOutlineCheckCircle,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import { Card, Button, Select, Badge, LoadingSpinner } from '../../ui';
import { useStaffPayroll, useUpdateStaffPayrollStatus } from '../../../hooks/useLogistics';
import { formatCurrency } from '../../../utils/helpers';

export const LogisticsPayrollManager: React.FC = () => {
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState<string>('');

    const { data: payroll, isLoading, refetch } = useStaffPayroll({
        month,
        year,
        status: statusFilter || undefined
    });

    const updateMutation = useUpdateStaffPayrollStatus();

    const handleUpdateStatus = async (id: string, status: 'processed' | 'paid') => {
        await updateMutation.mutateAsync({ id, status });
        refetch();
    };

    const months = [
        { value: '1', label: 'Janeiro' },
        { value: '2', label: 'Fevereiro' },
        { value: '3', label: 'Março' },
        { value: '4', label: 'Abril' },
        { value: '5', label: 'Maio' },
        { value: '6', label: 'Junho' },
        { value: '7', label: 'Julho' },
        { value: '8', label: 'Agosto' },
        { value: '9', label: 'Setembro' },
        { value: '10', label: 'Outubro' },
        { value: '11', label: 'Novembro' },
        { value: '12', label: 'Dezembro' }
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <Select
                        label="Mês de Referência"
                        options={months}
                        value={month.toString()}
                        onChange={(e) => setMonth(Number(e.target.value))}
                    />
                    <Select
                        label="Ano"
                        options={[
                            { value: '2024', label: '2024' },
                            { value: '2025', label: '2025' },
                            { value: '2026', label: '2026' }
                        ]}
                        value={year.toString()}
                        onChange={(e) => setYear(Number(e.target.value))}
                    />
                    <Select
                        label="Estado"
                        options={[
                            { value: '', label: 'Todos os Estados' },
                            { value: 'draft', label: 'Rascunho' },
                            { value: 'processed', label: 'Processado' },
                            { value: 'paid', label: 'Pago' }
                        ]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    />
                    <Button 
                        variant="outline" 
                        leftIcon={<HiOutlineArrowPath />}
                        onClick={() => refetch()}
                        className="h-11"
                    >
                        Actualizar
                    </Button>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card variant="glass" className="p-5 bg-gradient-to-br from-indigo-500/10 to-transparent border-l-4 border-indigo-500">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Total Previsto</p>
                    <h3 className="text-2xl font-black tracking-tighter">
                        {formatCurrency(payroll?.reduce((acc, p) => acc + p.totalEarnings, 0) || 0)}
                    </h3>
                </Card>
                <Card variant="glass" className="p-5 bg-gradient-to-br from-green-500/10 to-transparent border-l-4 border-green-500">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Total Pago</p>
                    <h3 className="text-2xl font-black tracking-tighter text-green-600">
                        {formatCurrency(payroll?.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.netSalary, 0) || 0)}
                    </h3>
                </Card>
                <Card variant="glass" className="p-5 bg-gradient-to-br from-orange-500/10 to-transparent border-l-4 border-orange-500">
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Pendente</p>
                    <h3 className="text-2xl font-black tracking-tighter text-orange-600">
                        {formatCurrency(payroll?.filter(p => p.status !== 'paid').reduce((acc, p) => acc + p.netSalary, 0) || 0)}
                    </h3>
                </Card>
                <Card variant="glass" className="p-5 bg-gradient-to-br from-purple-500/10 to-transparent border-l-4 border-purple-500">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Colaboradores</p>
                    <h3 className="text-2xl font-black tracking-tighter text-purple-600">{payroll?.length || 0}</h3>
                </Card>
            </div>

            {/* Payroll Table */}
            <Card variant="glass" padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-900/50 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b border-gray-100 dark:border-dark-700">
                                <th className="px-6 py-4 text-left">Colaborador</th>
                                <th className="px-6 py-4 text-right">Base</th>
                                <th className="px-6 py-4 text-right">Comissões</th>
                                <th className="px-6 py-4 text-right">Deduções</th>
                                <th className="px-6 py-4 text-right">Líquido</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-right">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {isLoading ? (
                                <tr><td colSpan={7} className="py-20 text-center"><LoadingSpinner size="lg" /></td></tr>
                            ) : payroll?.length === 0 ? (
                                <tr><td colSpan={7} className="py-20 text-center text-gray-400 font-medium">Nenhum registo para este período</td></tr>
                            ) : (
                                payroll?.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-all">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs uppercase">
                                                    {p.staff?.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white uppercase text-xs">{p.staff?.name}</p>
                                                    <p className="text-[10px] text-gray-400">{p.staff?.code}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs">{formatCurrency(p.baseSalary)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-xs text-green-600 font-bold">+{formatCurrency(p.commissions)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-xs text-red-500">-{formatCurrency(p.deductions)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(p.netSalary)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={p.status === 'paid' ? 'success' : p.status === 'processed' ? 'primary' : 'gray'}>
                                                {p.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {p.status === 'draft' && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(p.id, 'processed')}>
                                                        <HiOutlineCheckCircle className="w-5 h-5 text-blue-500" />
                                                    </Button>
                                                )}
                                                {p.status === 'processed' && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(p.id, 'paid')}>
                                                        <HiOutlineBanknotes className="w-5 h-5 text-green-600" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" title="Baixar Recibo">
                                                    <HiOutlineDocumentArrowDown className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
