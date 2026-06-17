import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    HiOutlineBookmarkSquare,
    HiOutlineArrowPath,
    HiOutlineBanknotes,
    HiOutlineBuildingLibrary,
    HiOutlineDocumentText,
    HiOutlineCheck,
    HiOutlineCheckBadge,
    HiOutlineArrowDownTray,
} from 'react-icons/hi2';
import { useEmployees, usePayroll } from '../../hooks/useData';
import { useAuthStore } from '../../stores/useAuthStore';
import { useStore } from '../../stores/useStore';
import { Button, Card, Pagination, usePagination, Badge } from '../ui';
import { MetricCard } from '../common/ModuleMetricCard';
import { formatCurrency } from '../../utils/helpers';
import { generateHRPayrollSummaryReport } from '../../utils/documentGenerator';
import type { PayrollRecord, Employee } from '../../types';
import toast from 'react-hot-toast';
import PayslipGenerator from './PayslipGenerator.tsx';
import PaymentConfirmModal from './PaymentConfirmModal';
import { payrollAPI, type PayrollPreviewResult } from '../../services/api';

type PayrollRecordWithEmployee = PayrollRecord & { employee: Employee };

export default function PayrollManager() {
    const { user } = useAuthStore();
    const { companySettings } = useStore();
    const { employees: employeesData } = useEmployees();
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const {
        payroll: payrollData,
        createPayroll: addPayroll,
        updatePayroll,
        processPayroll,
        markAsPaid
    } = usePayroll({
        month: selectedMonth + 1,
        year: selectedYear,
        originModule: 'hr',
        limit: 500
    });
    const employees = useMemo(() => Array.isArray(employeesData) ? employeesData : [], [employeesData]);
    const payroll = useMemo(() => Array.isArray(payrollData) ? payrollData : [], [payrollData]);
    const inssEmployeeRate = 3;
    const [draftPreviews, setDraftPreviews] = useState<Record<string, PayrollPreviewResult>>({});

    // Payment confirmation modal state
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedRecordForPayment, setSelectedRecordForPayment] = useState<PayrollRecordWithEmployee | null>(null);

    // Active employees
    const activeEmployees = useMemo(() => employees.filter(e => e.isActive), [employees]);

    const getEmployeeBaseSalary = useCallback((employee: Employee) =>
        Number(employee.baseSalary || employee.salary || 0), []);

    const getEmployeeAllowances = useCallback((employee: Employee) =>
        Number(employee.subsidyFood || 0) + Number(employee.subsidyTransport || 0), []);

    const previewToPayrollValues = useCallback((preview?: PayrollPreviewResult) => ({
        inssDeduction: Number(preview?.inssEmployee || 0),
        inssEmployer: Number(preview?.inssEmployer || 0),
        irtDeduction: Number(preview?.irt || 0),
        totalEarnings: Number(preview?.grossSalary || 0),
        totalDeductions: Number(preview?.totalDeductions || 0),
        netSalary: Number(preview?.netSalary || 0),
    }), []);

    const getPreviewInput = useCallback((employee: Employee, record?: PayrollRecord) => {
        const baseSalary = getEmployeeBaseSalary(employee);
        const allowances = record?.allowances !== undefined
            ? Number(record.allowances || 0)
            : getEmployeeAllowances(employee);

        return {
            baseSalary,
            overtimeAmount: Number(record?.otAmount || 0),
            bonus: Number(record?.bonus || 0),
            allowances: [{ name: 'Subsidios', amount: allowances, taxable: false }],
            deductions: [{ name: 'Adiantamentos', amount: Number(record?.advances || 0) }],
        };
    }, [getEmployeeAllowances, getEmployeeBaseSalary]);

    useEffect(() => {
        let isMounted = true;
        const loadBackendPreviews = async () => {
            const previewJobs = activeEmployees
                .map(employee => {
                    const existing = payroll.find(
                        p => p.employeeId === employee.id &&
                            p.month === selectedMonth + 1 &&
                            p.year === selectedYear
                    );
                    const salaryChanged = existing?.status === 'draft' &&
                        Number(existing.baseSalary || 0) !== getEmployeeBaseSalary(employee);

                    if (existing && !salaryChanged) return null;
                    return { employee, existing };
                })
                .filter(Boolean) as Array<{ employee: Employee; existing?: PayrollRecord }>;

            if (previewJobs.length === 0) {
                if (isMounted) setDraftPreviews({});
                return;
            }

            const results = await Promise.all(previewJobs.map(async ({ employee, existing }) => {
                const response = await payrollAPI.preview(getPreviewInput(employee, existing));
                const preview = 'data' in response && response.data ? response.data : response as PayrollPreviewResult;
                return [employee.id, preview] as const;
            }));

            if (isMounted) {
                setDraftPreviews(Object.fromEntries(results));
            }
        };

        loadBackendPreviews().catch(() => {
            if (isMounted) setDraftPreviews({});
        });

        return () => {
            isMounted = false;
        };
    }, [activeEmployees, payroll, selectedMonth, selectedYear, getEmployeeBaseSalary, getPreviewInput]);

    // Get or Create Draft Records for current view
    const currentPayrollData = useMemo(() => {
        return activeEmployees.map(employee => {
            const existing = payroll.find(
                p => p.employeeId === employee.id &&
                    p.month === selectedMonth + 1 &&
                    p.year === selectedYear
            );
            const baseSalary = getEmployeeBaseSalary(employee);
            const allowances = getEmployeeAllowances(employee);
            const preview = draftPreviews[employee.id];

            if (existing && existing.status === 'draft' && Number(existing.baseSalary || 0) !== baseSalary) {
                return {
                    ...existing,
                    ...previewToPayrollValues(preview),
                    baseSalary,
                    employee
                };
            }

            if (existing) return { ...existing, employee };

            return {
                id: `draft-${employee.id}`,
                employeeId: employee.id,
                employee,
                month: selectedMonth + 1,
                year: selectedYear,
                baseSalary,
                otHours: 0,
                otAmount: 0,
                bonus: 0,
                allowances,
                advances: 0,
                ...previewToPayrollValues(preview),
                status: 'draft',
            } as PayrollRecordWithEmployee;
        });
    }, [
        activeEmployees,
        payroll,
        selectedMonth,
        selectedYear,
        draftPreviews,
        getEmployeeAllowances,
        getEmployeeBaseSalary,
        previewToPayrollValues
    ]);

    // Force Recalculate ALL drafts for current view
    const handleRecalculate = async () => {
        let updatedCount = 0;

        for (const record of currentPayrollData) {
            if (record.status !== 'draft' && !record.id.startsWith('draft-')) continue;

            if (record.id.startsWith('draft-')) {
                await addPayroll({
                    employeeId: record.employeeId,
                    month: selectedMonth + 1,
                    year: selectedYear,
                    otHours: Number(record.otHours || 0),
                    advances: Number(record.advances || 0),
                    bonus: Number(record.bonus || 0),
                    originModule: 'hr'
                });
            } else {
                await updatePayroll(record.id, {
                    otHours: Number(record.otHours || 0),
                    otAmount: Number(record.otAmount || 0),
                    bonus: Number(record.bonus || 0),
                    allowances: Number(record.allowances || 0),
                    advances: Number(record.advances || 0)
                });
            }
            updatedCount++;
        }

        if (updatedCount > 0) {
            toast.success('Valores recalculados pelo motor salarial unificado!');
        } else {
            toast('Nenhum rascunho para atualizar');
        }
    };

    // Handle Input Change for Drafts
    const handleUpdateValues = async (record: PayrollRecordWithEmployee, field: keyof PayrollRecord, value: number) => {
        if (!record.id.startsWith('draft-')) {
            await updatePayroll(record.id, { [field]: value });
            return;
        }

        await addPayroll({
            employeeId: record.employeeId,
            month: selectedMonth + 1,
            year: selectedYear,
            otHours: Number(record.otHours || 0),
            advances: Number(record.advances || 0),
            bonus: field === 'bonus' ? value : Number(record.bonus || 0),
            originModule: 'hr'
        });
    };

    const handleSaveMonth = async () => {
        const processedRecords = currentPayrollData.filter(
            record => record.status === 'draft' || record.id.startsWith('draft-')
        );

        for (const record of processedRecords) {
            if (record.id.startsWith('draft-')) {
                const created = await addPayroll({
                    employeeId: record.employeeId,
                    month: selectedMonth + 1,
                    year: selectedYear,
                    otHours: Number(record.otHours || 0),
                    advances: Number(record.advances || 0),
                    bonus: Number(record.bonus || 0),
                    originModule: 'hr'
                });
                await processPayroll(created.id);
            } else {
                await processPayroll(record.id);
            }
        }
        toast.success('Folha processada pelo modulo salarial unificado!');
    };

    // Export monthly report to PDF
    const handleExportReport = () => {
        const period = `${months[selectedMonth]} ${selectedYear}`;
        const totalGross = currentPayrollData.reduce((sum, r) => sum + r.totalEarnings, 0);

        generateHRPayrollSummaryReport({
            period,
            month: selectedMonth + 1,
            year: selectedYear,
            employees: currentPayrollData.map(r => ({
                name: r.employee.name,
                role: r.employee.role,
                department: r.employee.department,
                baseSalary: r.baseSalary,
                inssDeduction: r.inssDeduction,
                irtDeduction: r.irtDeduction,
                bonus: r.bonus,
                allowances: r.allowances,
                totalEarnings: r.totalEarnings,
                totalDeductions: r.totalDeductions,
                netSalary: r.netSalary,
                status: r.status as 'draft' | 'processed' | 'paid'
            })),
            totals: {
                totalNet: totals.totalNet,
                totalINSS: totals.totalINSS,
                totalIRPS: totals.totalIRPS,
                totalGross
            },
            inssRate: inssEmployeeRate
        }, companySettings);

        toast.success('Relatório mensal exportado!');
    };

    // Handle payment confirmation via modal
    const handleOpenPaymentModal = (record: PayrollRecordWithEmployee) => {
        setSelectedRecordForPayment(record);
        setPaymentModalOpen(true);
    };

    const handleConfirmPayment = async (paymentData: { method: string; notes?: string }) => {
        if (!selectedRecordForPayment) return;
        const notes = [
            `Metodo: ${paymentData.method}`,
            paymentData.notes,
        ].filter(Boolean).join(' | ');
        await markAsPaid(selectedRecordForPayment.id, user?.id || 'unknown', notes);
    };

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // Calucalate Totals for Summary
    const totals = useMemo(() => {
        return currentPayrollData.reduce((acc, curr) => ({
            totalNet: acc.totalNet + curr.netSalary,
            totalINSS: acc.totalINSS + curr.inssDeduction,
            totalIRPS: acc.totalIRPS + curr.irtDeduction
        }), { totalNet: 0, totalINSS: 0, totalIRPS: 0 });
    }, [currentPayrollData]);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedPayroll,
        totalItems: totalPayrollItems,
    } = usePagination(currentPayrollData, 10);

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card padding="md">
                <div className="flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto">
                        <select
                            className="h-12 w-full rounded-lg border border-gray-300 bg-white p-2 text-base font-medium dark:border-dark-600 dark:bg-dark-700 sm:text-sm lg:w-40"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        >
                            {months.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <select
                            className="h-12 w-full rounded-lg border border-gray-300 bg-white p-2 text-base font-medium dark:border-dark-600 dark:bg-dark-700 sm:text-sm lg:w-32"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                        >
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                        </select>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                        <Button variant="outline" onClick={handleExportReport} className="w-full sm:w-auto" leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />}>
                            Exportar Relatório
                        </Button>
                        <Button variant="outline" onClick={handleRecalculate} className="w-full sm:w-auto" leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}>
                            Recalcular Valores
                        </Button>
                        <Button onClick={handleSaveMonth} className="w-full sm:w-auto" leftIcon={<HiOutlineBookmarkSquare className="w-4 h-4" />}>
                            Fechar Processamento Mensal
                        </Button>
                    </div>
                </div>

                {/* Payroll engine indicator */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
                    <div className="flex flex-col items-start gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                        <span className="text-gray-500 dark:text-gray-400">Motor salarial:</span>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-medium">
                            INSS Trabalhador: {inssEmployeeRate}%
                        </span>
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg font-medium">
                            IRPS: Tabela Progressiva
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            (Calculado pelo modulo salarial unificado)
                        </span>
                    </div>
                </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    label="Total Líquido a Pagar"
                    value={totals.totalNet}
                    icon={<HiOutlineBanknotes className="w-5 h-5" />}
                    color="primary"
                    isCurrency
                />
                <MetricCard
                    label={`Total INSS Retido (${inssEmployeeRate}%)`}
                    value={totals.totalINSS}
                    icon={<HiOutlineBuildingLibrary className="w-5 h-5" />}
                    color="slate"
                    isCurrency
                />
                <MetricCard
                    label="Total IRPS Retido"
                    value={totals.totalIRPS}
                    icon={<HiOutlineDocumentText className="w-5 h-5" />}
                    color="slate"
                    isCurrency
                />
            </div>


            <Card padding="none" className="md:hidden overflow-hidden">
                <div className="divide-y divide-gray-200 dark:divide-dark-700">
                    {paginatedPayroll.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                            Nenhum registo salarial encontrado
                        </div>
                    ) : (
                        paginatedPayroll.map((record) => (
                            <div key={record.employeeId} className="space-y-4 bg-white p-4 dark:bg-dark-900">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 dark:text-white truncate">
                                            {record.employee.name}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{record.employee.role}</p>
                                    </div>
                                    <div className="shrink-0">
                                        {record.status === 'paid' && (
                                            <Badge variant="success" size="sm">
                                                <HiOutlineCheckBadge className="w-3 h-3 mr-1" /> Pago
                                            </Badge>
                                        )}
                                        {record.status === 'processed' && (
                                            <Badge variant="warning" size="sm">Processado</Badge>
                                        )}
                                        {record.status === 'draft' && (
                                            <Badge variant="gray" size="sm">Rascunho</Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Base</p>
                                        <p className="mt-1 font-semibold text-gray-900 dark:text-white truncate">
                                            {formatCurrency(record.baseSalary)}
                                        </p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">INSS</p>
                                        <p className="mt-1 font-semibold text-gray-900 dark:text-white truncate">
                                            {formatCurrency(record.inssDeduction)}
                                        </p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">IRPS</p>
                                        <p className="mt-1 font-semibold text-gray-900 dark:text-white truncate">
                                            {formatCurrency(record.irtDeduction)}
                                        </p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Liquido</p>
                                        <p className="mt-1 font-black text-gray-900 dark:text-white truncate">
                                            {formatCurrency(record.netSalary)}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
                                        Bonus / Outros
                                    </label>
                                    <input
                                        type="number"
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-right text-base dark:border-dark-700"
                                        value={record.bonus}
                                        onChange={(e) => handleUpdateValues(record, 'bonus', Number(e.target.value))}
                                    />
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
                                        <PayslipGenerator record={record} />
                                    </div>
                                    {record.status === 'processed' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full sm:w-auto"
                                            leftIcon={<HiOutlineCheck className="w-4 h-4 text-green-600" />}
                                            title="Confirmar Pagamento"
                                            onClick={() => handleOpenPaymentModal(record)}
                                        >
                                            Confirmar Pagamento
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {/* Table */}
            <Card padding="none" className="hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-dark-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Colaborador</th>
                                <th className="px-4 py-3 text-right">Vencimento Base</th>
                                <th className="px-4 py-3 text-right">INSS (3%)</th>
                                <th className="px-4 py-3 text-right">Bônus / Outros</th>
                                <th className="px-4 py-3 text-right">IRPS</th>
                                <th className="px-4 py-3 text-right">Valor Líquido</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {paginatedPayroll.map((record) => (
                                <tr key={record.employeeId} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                        {record.employee.name}
                                        <span className="block text-xs text-gray-500">{record.employee.role}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {formatCurrency(record.baseSalary)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {formatCurrency(record.inssDeduction)}
                                    </td>
                                    {/* Editable Fields */}
                                    <td className="px-4 py-3 text-right">
                                        <input
                                            type="number"
                                            className="w-20 p-1 text-right text-sm border rounded bg-transparent"
                                            value={record.bonus}
                                            onChange={(e) => handleUpdateValues(record, 'bonus', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {formatCurrency(record.irtDeduction)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(record.netSalary)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {record.status === 'paid' && (
                                            <Badge variant="success" size="sm">
                                                <HiOutlineCheckBadge className="w-3 h-3 mr-1" /> Pago
                                            </Badge>
                                        )}
                                        {record.status === 'processed' && (
                                            <Badge variant="warning" size="sm">Processado</Badge>
                                        )}
                                        {record.status === 'draft' && (
                                            <Badge variant="gray" size="sm">Rascunho</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <PayslipGenerator record={record} />
                                            {record.status === 'processed' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Confirmar Pagamento"
                                                    onClick={() => handleOpenPaymentModal(record)}
                                                >
                                                    <HiOutlineCheck className="w-4 h-4 text-green-600" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 sm:px-6">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalPayrollItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>

            {/* Payment Confirmation Modal */}
            {selectedRecordForPayment && (
                <PaymentConfirmModal
                    isOpen={paymentModalOpen}
                    onClose={() => {
                        setPaymentModalOpen(false);
                        setSelectedRecordForPayment(null);
                    }}
                    record={selectedRecordForPayment}
                    onConfirm={handleConfirmPayment}
                />
            )}
        </div >
    );
}
