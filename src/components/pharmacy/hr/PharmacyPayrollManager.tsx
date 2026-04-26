import React, { useState, useMemo } from 'react';
import {
    HiOutlineBanknotes,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineArrowPath,
    HiOutlinePrinter,
    HiOutlineCalculator
} from 'react-icons/hi2';
import { Card, Button, Select, Badge, LoadingSpinner, Modal, ConfirmationModal } from '../../ui';
import { useEmployees, usePayroll } from '../../../hooks/useData';
import { formatCurrency, formatDate } from '../../../utils/helpers';
import toast from 'react-hot-toast';

// IRT Mozambique 2024 - matches backend calculateIRT()
const calculateIRT = (income: number): number => {
    if (income <= 42500) return 0;
    if (income <= 100000) return (income - 42500) * 0.10;
    if (income <= 250000) return 5750 + (income - 100000) * 0.15;
    if (income <= 500000) return 28250 + (income - 250000) * 0.20;
    return 78250 + (income - 500000) * 0.25;
};

// INSS employee contribution: 3%
const calculateINSS = (baseSalary: number) => baseSalary * 0.03;

export const PharmacyPayrollManager: React.FC = () => {
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
    const [isPayslipOpen, setIsPayslipOpen] = useState(false);
    const [processingAll, setProcessingAll] = useState(false);
    const [showProcessConfirm, setShowProcessConfirm] = useState(false);

    const { employees } = useEmployees({ limit: 100 });
    const { payroll: payrollData, isLoading, refetch, updatePayroll, processPayroll } = usePayroll({
        month,
        year,
        status: statusFilter || undefined,
    });

    const handleUpdateStatus = async (id: string, status: 'processed' | 'paid') => {
        try {
            if (status === 'processed') {
                await processPayroll(id);
            } else {
                await updatePayroll(id, { status });
            }
            toast.success(`Pagamento marcado como ${status === 'paid' ? 'pago' : 'processado'}`);
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
        const draftIds = payrollData?.filter(p => p.status === 'draft').map(p => p.id) || [];
        if (draftIds.length === 0) {
            toast('Não h rascunhos por processar');
            return;
        }
        setProcessingAll(true);
        let ok = 0;
        for (const id of draftIds) {
            try {
                await processPayroll(id);
                ok++;
            } catch {
                // continue
            }
        }
        setProcessingAll(false);
        toast.success(`${ok} de ${draftIds.length} registos processados`);
        refetch();
    };

    const openPayslip = (p: any) => {
        const employee = employees?.find(e => e.id === p.employeeId);
        setSelectedPayroll({ ...p, employee });
        setIsPayslipOpen(true);
    };

    const months = [
        { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
        { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
        { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
        { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
        { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
        { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
    ];

    // Aggregate stats from real data
    const stats = useMemo(() => ({
        totalNet: payrollData?.reduce((a, p) => a + Number(p.netSalary || 0), 0) || 0,
        totalPaid: payrollData?.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.netSalary || 0), 0) || 0,
        totalINSS: payrollData?.reduce((a, p) => a + Number(p.inssDeduction || 0), 0) || 0,
        totalBonus: payrollData?.reduce((a, p) => a + Number(p.bonus || 0), 0) || 0,
    }), [payrollData]);

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="flex flex-col md:flex-row items-end justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
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
                                { value: '2026', label: '2026' },
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
                                { value: 'paid', label: 'Pago' },
                            ]}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                            onClick={() => refetch()}
                            className="h-11 font-black text-[10px] uppercase tracking-widest text-gray-500"
                        >
                            Refrescar
                        </Button>
                        <Button
                            variant="primary"
                            leftIcon={processingAll ? <HiOutlineClock className="w-5 h-5 animate-spin" /> : <HiOutlineCalculator className="w-5 h-5" />}
                            onClick={handleProcessAll}
                            disabled={processingAll}
                            className="h-11 font-black text-[10px] uppercase tracking-widest"
                        >
                            {processingAll ? 'A processar...' : 'Processar Todos'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Stats from real data */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card variant="glass" className="p-5 border-l-4 border-l-blue-500">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 italic">Total Líquido</p>
                    <h3 className="text-2xl font-black tracking-tighter">{formatCurrency(stats.totalNet)}</h3>
                </Card>
                <Card variant="glass" className="p-5 border-l-4 border-l-green-500">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1 italic">Total Pago</p>
                    <h3 className="text-2xl font-black tracking-tighter text-green-600">{formatCurrency(stats.totalPaid)}</h3>
                </Card>
                <Card variant="glass" className="p-5 border-l-4 border-l-red-500">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 italic">Retenção INSS (3%)</p>
                    <h3 className="text-2xl font-black tracking-tighter text-red-600">{formatCurrency(stats.totalINSS)}</h3>
                </Card>
                <Card variant="glass" className="p-5 border-l-4 border-l-teal-500">
                    <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1 italic">Comissões Totais</p>
                    <h3 className="text-2xl font-black tracking-tighter text-teal-600">{formatCurrency(stats.totalBonus)}</h3>
                </Card>
            </div>

            {/* Payroll Table */}
            <Card variant="glass" padding="none" className="overflow-hidden border border-gray-100 dark:border-dark-700/50 shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-dark-900/50 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b border-gray-100 dark:border-dark-700/50 whitespace-nowrap">
                                <th className="px-6 py-4 text-left">Colaborador</th>
                                <th className="px-6 py-4 text-right">Salário Base</th>
                                <th className="px-6 py-4 text-right italic">Comissão/Bónus</th>
                                <th className="px-6 py-4 text-right text-red-500 italic">Dedução (INSS+IRT)</th>
                                <th className="px-6 py-4 text-right font-black">Líquido a Receber</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-right">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700/50">
                            {isLoading ? (
                                <tr><td colSpan={7} className="py-20 text-center"><LoadingSpinner size="lg" /></td></tr>
                            ) : !payrollData || payrollData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-gray-400 font-medium italic">
                                        Nenhum registo disponível para {months.find(m => m.value === month.toString())?.label} / {year}
                                    </td>
                                </tr>
                            ) : (
                                payrollData.map((p) => {
                                    const employee = employees?.find(e => e.id === p.employeeId);
                                    // Use stored values from backend; fallback to local calculation only if missing
                                    const inss = Number(p.inssDeduction) || calculateINSS(Number(p.baseSalary));
                                    const irt = Number(p.irtDeduction) || calculateIRT(Number(p.totalEarnings || p.baseSalary));
                                    const totalDeds = inss + irt + Number(p.advances || 0);
                                    const net = Number(p.netSalary) || (Number(p.baseSalary) + Number(p.bonus || 0) + Number(p.allowances || 0) + Number(p.otAmount || 0) - totalDeds);

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/30 dark:hover:bg-dark-700/20 transition-all group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 font-black text-xs shadow-inner">
                                                        {employee?.name?.charAt(0) ?? '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 dark:text-white uppercase text-xs">{employee?.name ?? ''}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">{employee?.department || 'Farmácia'} • {employee?.code ?? ''}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-xs font-bold text-gray-600">{formatCurrency(Number(p.baseSalary))}</td>
                                            <td className="px-6 py-4 text-right font-mono text-xs text-teal-600 font-black">+{formatCurrency(Number(p.bonus || 0))}</td>
                                            <td className="px-6 py-4 text-right font-mono text-xs text-red-500 font-bold">-{formatCurrency(totalDeds)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tighter underline decoration-double decoration-indigo-200">
                                                    {formatCurrency(net)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge
                                                    variant={p.status === 'paid' ? 'success' : p.status === 'processed' ? 'primary' : 'gray'}
                                                    className="font-black text-[9px] tracking-tight"
                                                >
                                                    {p.status.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {p.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(p.id, 'processed')}
                                                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                                            title="Processar"
                                                        >
                                                            <HiOutlineCheckCircle className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    {p.status === 'processed' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(p.id, 'paid')}
                                                            className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                                                            title="Marcar como Pago"
                                                        >
                                                            <HiOutlineBanknotes className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openPayslip(p)}
                                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                                        title="Ver Recibo"
                                                    >
                                                        <HiOutlinePrinter className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Payslip Modal */}
            <Modal
                isOpen={isPayslipOpen}
                onClose={() => setIsPayslipOpen(false)}
                title="Recibo de Salário (Payslip)"
                size="lg"
            >
                {selectedPayroll && (() => {
                    const inss = Number(selectedPayroll.inssDeduction) || calculateINSS(Number(selectedPayroll.baseSalary));
                    const irt = Number(selectedPayroll.irtDeduction) || calculateIRT(Number(selectedPayroll.totalEarnings || selectedPayroll.baseSalary));
                    return (
                        <div className="p-2 space-y-6">
                            <div className="flex justify-between items-start border-b-2 border-dashed border-gray-100 pb-6">
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 uppercase">FARMÁCIA MULTICORE</h1>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Recibo de Remuneração</p>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline">{months[month - 1].label} {year}</Badge>
                                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-black">ID: {selectedPayroll.id.slice(-8)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 text-sm">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Colaborador</p>
                                    <p className="font-black text-gray-900 uppercase">{selectedPayroll.employee?.name}</p>
                                    <p className="text-xs text-gray-500">{selectedPayroll.employee?.role}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Detalhes do Contrato</p>
                                    <p className="font-bold text-gray-700">NUIT: {selectedPayroll.employee?.nuit || ''}</p>
                                    <p className="text-xs text-gray-500">INSS: {selectedPayroll.employee?.socialSecurityNumber || ''}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-2">
                                        <span>DESCRIÇÃO</span>
                                        <span>VALOR (MT)</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Salário Base</span>
                                        <span className="font-mono font-bold">{formatCurrency(Number(selectedPayroll.baseSalary))}</span>
                                    </div>
                                    {Number(selectedPayroll.bonus) > 0 && (
                                        <div className="flex justify-between text-sm text-teal-600">
                                            <span className="font-medium italic">Comissões / Bónus</span>
                                            <span className="font-mono font-black">+{formatCurrency(Number(selectedPayroll.bonus))}</span>
                                        </div>
                                    )}
                                    {Number(selectedPayroll.allowances) > 0 && (
                                        <div className="flex justify-between text-sm text-teal-600">
                                            <span className="font-medium italic">Subsídios (Transp./Alim.)</span>
                                            <span className="font-mono font-black">+{formatCurrency(Number(selectedPayroll.allowances))}</span>
                                        </div>
                                    )}
                                    {Number(selectedPayroll.otAmount) > 0 && (
                                        <div className="flex justify-between text-sm text-teal-600">
                                            <span className="font-medium italic">Horas Extra ({selectedPayroll.otHours}h)</span>
                                            <span className="font-mono font-black">+{formatCurrency(Number(selectedPayroll.otAmount))}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm text-red-500">
                                        <span className="font-medium italic">Retenção INSS (3%)</span>
                                        <span className="font-mono font-black">-{formatCurrency(inss)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-red-500">
                                        <span className="font-medium italic">Retenção IRT</span>
                                        <span className="font-mono font-black">-{formatCurrency(irt)}</span>
                                    </div>
                                    {Number(selectedPayroll.advances) > 0 && (
                                        <div className="flex justify-between text-sm text-red-500">
                                            <span className="font-medium italic">Adiantamentos</span>
                                            <span className="font-mono font-black">-{formatCurrency(Number(selectedPayroll.advances))}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center p-6 bg-primary-600 rounded-lg text-white shadow-xl shadow-primary-500/20">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Líquido a Receber</p>
                                        <p className="text-xs italic opacity-80">
                                            {selectedPayroll.paidAt
                                                ? `Pago em ${formatDate(selectedPayroll.paidAt)}`
                                                : `Emitido em ${formatDate(new Date().toISOString())}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black tracking-tighter italic">
                                            {formatCurrency(Number(selectedPayroll.netSalary))}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between gap-4 pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1 rounded-lg uppercase font-black text-[10px] tracking-widest"
                                    onClick={() => window.print()}
                                    leftIcon={<HiOutlinePrinter className="w-5 h-5" />}
                                >
                                    Imprimir
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="flex-1 rounded-lg uppercase font-black text-[10px] tracking-widest"
                                    onClick={() => setIsPayslipOpen(false)}
                                >
                                    Fechar
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Process All Confirmation */}
            <ConfirmationModal
                isOpen={showProcessConfirm}
                onClose={() => setShowProcessConfirm(false)}
                onConfirm={confirmProcessAll}
                title="Processar Salários"
                message={`Deseja processar todos os rascunhos de salários para o período de ${months.find(m => m.value === month.toString())?.label} / ${year}?`}
                confirmText="Sim, Processar Todos"
                cancelText="Cancelar"
                variant="primary"
            />
        </div>
    );
};
