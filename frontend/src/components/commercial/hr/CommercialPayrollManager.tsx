import { useState, useMemo } from 'react';
import {
    HiOutlineBanknotes,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineArrowPath,
    HiOutlineCalculator,
} from 'react-icons/hi2';
import { Card, Button, Select, Badge, ConfirmationModal, Pagination, SimpleTable, usePagination } from '../../ui';
import { MetricCard } from '../../common/ModuleMetricCard';
import { useEmployees, usePayroll } from '../../../hooks/useData';
import { formatCurrency } from '../../../utils/helpers';
import PayslipGenerator from '../../employees/PayslipGenerator';
import toast from 'react-hot-toast';

const MONTHS = [
    { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

export const CommercialPayrollManager = () => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState('');
    const [processingAll, setProcessingAll] = useState(false);
    const [showProcessConfirm, setShowProcessConfirm] = useState(false);

    const { employees: allEmployees } = useEmployees({ limit: 200 });
    const employees = useMemo(() =>
        (allEmployees || []).filter(e => !e.department || e.department === 'Comercial'),
        [allEmployees]);

    const { payroll: payrollData, isLoading, refetch, processPayroll, markAsPaid } = usePayroll({
        month, year, status: statusFilter || undefined, originModule: 'commercial',
    });

    // Filter payroll to commercial team only
    const data = useMemo(() =>
        (payrollData || []).filter(p => employees.some(e => e.id === p.employeeId)),
        [payrollData, employees]);

    const stats = useMemo(() => ({
        totalNet: data.reduce((a, p) => a + Number(p.netSalary || 0), 0),
        totalPaid: data.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.netSalary || 0), 0),
        totalINSS: data.reduce((a, p) => a + Number(p.inssDeduction || 0), 0),
        totalCommissions: data.reduce((a, p) => a + Number(p.bonus || 0), 0),
    }), [data]);

    const {
        paginatedItems: paginatedData,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        totalItems,
    } = usePagination(data, 10);

    const handleUpdateStatus = async (id: string, status: 'processed' | 'paid') => {
        try {
            if (status === 'processed') {
                await processPayroll(id);
            } else {
                await markAsPaid(id, 'commercial-hr');
            }
            toast.success(`Marcado como ${status === 'paid' ? 'pago' : 'processado'}`);
            refetch();
        } catch {
            toast.error('Erro ao actualizar estado');
        }
    };

    const handleProcessAll = async () => {
        setShowProcessConfirm(true);
    };

    const confirmProcessAll = async () => {
        setShowProcessConfirm(false);
        const drafts = data.filter(p => p.status === 'draft').map(p => p.id);
        if (!drafts.length) { toast('Sem rascunhos por processar'); return; }
        setProcessingAll(true);
        let ok = 0;
        for (const id of drafts) { try { await processPayroll(id); ok++; } catch { /**/ } }
        setProcessingAll(false);
        toast.success(`${ok}/${drafts.length} registos processados`);
        refetch();
    };

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="flex flex-col md:flex-row items-end justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        <Select label="Mês" options={MONTHS} value={month.toString()} onChange={e => setMonth(Number(e.target.value))} />
                        <Select label="Ano" options={[{ value: '2024', label: '2024' }, { value: '2025', label: '2025' }, { value: '2026', label: '2026' }]} value={year.toString()} onChange={e => setYear(Number(e.target.value))} />
                        <Select label="Estado" options={[
                            { value: '', label: 'Todos' },
                            { value: 'draft', label: 'Rascunho' },
                            { value: 'processed', label: 'Processado' },
                            { value: 'paid', label: 'Pago' },
                        ]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} onClick={() => refetch()} className="h-11 font-black text-[10px] uppercase tracking-widest text-gray-500">
                            Refrescar
                        </Button>
                        <Button variant="primary" onClick={handleProcessAll} disabled={processingAll}
                            leftIcon={processingAll ? <HiOutlineClock className="w-5 h-5 animate-spin" /> : <HiOutlineCalculator className="w-5 h-5" />}
                            className="h-11 font-black text-[10px] uppercase tracking-widest">
                            {processingAll ? 'A processar...' : 'Processar Todos'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    label="Total Líquido"
                    value={stats.totalNet}
                    color="blue"
                    isCurrency
                    icon={<HiOutlineBanknotes className="w-6 h-6 opacity-20" />}
                />
                <MetricCard
                    label="Total Pago"
                    value={stats.totalPaid}
                    color="green"
                    isCurrency
                    icon={<HiOutlineCheckCircle className="w-6 h-6 opacity-20" />}
                />
                <MetricCard
                    label="Retenção INSS (3%)"
                    value={stats.totalINSS}
                    color="red"
                    isCurrency
                    icon={<HiOutlineCalculator className="w-6 h-6 opacity-20" />}
                />
                <MetricCard
                    label="Comissões de Vendas"
                    value={stats.totalCommissions}
                    color="teal"
                    isCurrency
                    icon={<HiOutlineArrowPath className="w-6 h-6 opacity-20" />}
                />
            </div>

            {/* Payroll Table */}
            <Card variant="glass" padding="none" className="overflow-hidden border border-gray-100 dark:border-dark-700/50 shadow-xl">
                <SimpleTable
                    columns={[
                        { key: 'employee', label: 'Colaborador' },
                        { key: 'base', label: 'Base', className: 'text-right' },
                        { key: 'commission', label: 'Comissão', className: 'text-right' },
                        { key: 'allowances', label: 'Subsídios', className: 'text-right' },
                        { key: 'deductions', label: 'Deduções', className: 'text-right' },
                        { key: 'net', label: 'Líquido', className: 'text-right' },
                        { key: 'status', label: 'Estado', className: 'text-center' },
                        { key: 'actions', label: 'Acções', className: 'text-right' },
                    ]}
                    isLoading={isLoading}
                    isEmpty={!isLoading && paginatedData.length === 0}
                    emptyTitle="Sem registos salariais"
                    emptyDescription={`Nenhum registo para ${MONTHS[month - 1]?.label} / ${year}.`}
                    minHeight="420px"
                    loadingRows={8}
                    loadingMessage="A carregar salários..."
                    tableClassName="w-full text-sm"
                    headerRowClassName="bg-slate-50/80 dark:bg-dark-800/80 text-slate-400 tracking-widest border-slate-100 dark:border-dark-700/50 whitespace-nowrap"
                    tbodyClassName="divide-y divide-gray-100 dark:divide-dark-700/50"
                >
                            {!isLoading && paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-gray-400 italic">
                                        Nenhum registo para {MONTHS[month - 1]?.label} / {year}
                                    </td>
                                </tr>
                            ) : !isLoading && paginatedData.map(p => {
                                const emp = employees.find(e => e.id === p.employeeId);
                                const deds = Number(p.totalDeductions || 0);
                                const net = Number(p.netSalary || 0);

                                return (
                                    <tr key={p.id} className="hover:bg-gray-50/30 dark:hover:bg-dark-700/20 transition-all">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 font-black text-xs">
                                                    {emp?.name?.charAt(0) ?? '?'}
                                                </div>
                                                <div>
                                                    <p className="font-black text-gray-900 dark:text-white uppercase text-xs">{emp?.name ?? ''}</p>
                                                    <p className="text-[10px] text-gray-400">{emp?.role || 'Comercial'} • {emp?.code ?? ''}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs font-bold text-gray-600">{formatCurrency(Number(p.baseSalary))}</td>
                                        <td className="px-6 py-4 text-right font-mono text-xs text-teal-600 font-black">
                                            {Number(p.bonus) > 0 ? `+${formatCurrency(Number(p.bonus))}` : ''}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs text-gray-500">
                                            {Number(p.allowances) > 0 ? formatCurrency(Number(p.allowances)) : ''}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs text-red-500 font-bold">-{formatCurrency(deds)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{formatCurrency(net)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={p.status === 'paid' ? 'success' : p.status === 'processed' ? 'primary' : 'gray'} className="font-black text-[9px]">
                                                {p.status?.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                {p.status === 'draft' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleUpdateStatus(p.id, 'processed')}
                                                        title="Processar"
                                                        className="p-2 text-blue-500 hover:bg-blue-50 hover:border-blue-100 active:scale-95"
                                                    >
                                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                                    </Button>
                                                )}
                                                {p.status === 'processed' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleUpdateStatus(p.id, 'paid')}
                                                        title="Marcar como Pago"
                                                        className="p-2 text-green-600 hover:bg-green-50 hover:border-green-100 active:scale-95"
                                                    >
                                                        <HiOutlineBanknotes className="w-5 h-5" />
                                                    </Button>
                                                )}
                                                {emp && <PayslipGenerator record={{ ...p, employee: emp }} variant="ghost" />}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                </SimpleTable>
                {!isLoading && data.length > 0 && (
                    <div className="p-4 border-t border-gray-100 dark:border-dark-700/50 bg-white/50 dark:bg-dark-900/50">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    </div>
                )}
            </Card>

            {/* Process All Confirmation */}
            <ConfirmationModal
                isOpen={showProcessConfirm}
                onClose={() => setShowProcessConfirm(false)}
                onConfirm={confirmProcessAll}
                title="Processar Salários (Comercial)"
                message={`Deseja processar todos os rascunhos de salários da equipa comercial para ${MONTHS[month - 1]?.label} / ${year}?`}
                confirmText="Confirmar Processamento"
                cancelText="Voltar"
                variant="primary"
            />
        </div>
    );
};
