import { useState, useMemo } from 'react';
import {
    HiOutlineSave,
    HiOutlineRefresh,
    HiOutlineCash,
    HiOutlineLibrary,
    HiOutlineDocumentText,
} from 'react-icons/hi';
import { useEmployees, usePayroll } from '../../hooks/useData';
import { useFiscalStore } from '../../stores/useFiscalStore';
import { Button, Card, Pagination, usePagination } from '../ui';
import { formatCurrency, generateId } from '../../utils/helpers';
import type { PayrollRecord, Employee } from '../../types';
import toast from 'react-hot-toast';
import PayslipGenerator from './PayslipGenerator.tsx';

export default function PayrollManager() {
    const { employees: employeesData } = useEmployees();
    const { payroll: payrollData, createPayroll: addPayroll, updatePayroll } = usePayroll();
    const employees = Array.isArray(employeesData) ? employeesData : [];
    const payroll = Array.isArray(payrollData) ? payrollData : [];
    const { calculateIRPS, taxConfigs } = useFiscalStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Active employees
    const activeEmployees = useMemo(() => employees.filter(e => e.isActive), [employees]);

    // Get current INSS rate from fiscal configuration
    const inssEmployeeRate = useMemo(() => {
        const config = taxConfigs.find(c => c.type === 'inss_employee' && c.isActive);
        return config?.rate || 3;
    }, [taxConfigs]);

    // Helper for calculations - now uses dynamic rates
    const calculatePayroll = (base: number, bonus: number, ot: number, allowances: number, irps: number, adv: number) => {
        const inss = base * (inssEmployeeRate / 100); // Dynamic INSS rate
        const gross = base + ot + bonus + allowances;
        const deductions = inss + irps + adv;
        return {
            inssDeduction: inss,
            totalEarnings: gross,
            totalDeductions: deductions,
            netSalary: gross - deductions
        };
    };

    // Calculate IRPS dynamically using fiscal store brackets
    const calculateDynamicIRPS = (grossSalary: number) => {
        const result = calculateIRPS(grossSalary);
        return result.irps;
    };

    // Get or Create Draft Records for current view
    const currentPayrollData = useMemo(() => {
        return activeEmployees.map(employee => {
            const existing = payroll.find(
                p => p.employeeId === employee.id &&
                    p.month === selectedMonth + 1 &&
                    p.year === selectedYear
            );

            // Dynamic Update: If existing draft has outdated base salary
            const currentSalary = Number(employee.baseSalary || employee.salary || 0);

            if (existing && existing.status === 'draft' && existing.baseSalary !== currentSalary) {
                const newBase = currentSalary;
                // Recalculate IRPS with new salary
                const dynamicIRPS = calculateDynamicIRPS(newBase);
                const calcs = calculatePayroll(
                    newBase,
                    existing.bonus,
                    existing.otAmount,
                    existing.allowances,
                    dynamicIRPS,
                    existing.advances
                );

                return {
                    ...existing,
                    ...calcs,
                    irtDeduction: dynamicIRPS,
                    baseSalary: newBase,
                    employee
                };
            }

            if (existing) return { ...existing, employee };

            // New Draft - Calculate IRPS automatically based on fiscal configuration
            const baseSalary = currentSalary;
            const allowances = (employee.subsidyFood || 0) + (employee.subsidyTransport || 0);
            const grossForTax = baseSalary; // IRPS calculated on base salary
            const dynamicIRPS = calculateDynamicIRPS(grossForTax);
            const calcs = calculatePayroll(baseSalary, 0, 0, allowances, dynamicIRPS, 0);

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
                irtDeduction: dynamicIRPS, // Auto-calculated IRPS
                advances: 0,
                inssDeduction: calcs.inssDeduction,
                totalEarnings: calcs.totalEarnings,
                totalDeductions: calcs.totalDeductions,
                netSalary: calcs.netSalary,
                status: 'draft',
            } as PayrollRecord & { employee: Employee };
        });
    }, [activeEmployees, payroll, selectedMonth, selectedYear, calculateDynamicIRPS, calculatePayroll]);

    // Force Recalculate ALL drafts for current view
    const handleRecalculate = () => {
        let updatedCount = 0;

        currentPayrollData.forEach(record => {
            // Only update if it's a draft
            if (record.status === 'draft' || record.id.startsWith('draft-')) {
                const currentSalary = Number(record.employee.baseSalary || record.employee.salary || 0);
                const allowances = (record.employee.subsidyFood || 0) + (record.employee.subsidyTransport || 0);

                // Preserve user inputs (bonus, ot, etc)
                const bonus = record.bonus || 0;
                const otAmount = record.otAmount || 0;
                const advances = record.advances || 0;

                // Recalculate IRPS dynamically based on current fiscal brackets
                const dynamicIRPS = calculateDynamicIRPS(currentSalary);

                const calcs = calculatePayroll(currentSalary, bonus, otAmount, allowances, dynamicIRPS, advances);

                const updatedRecord = {
                    ...record,
                    baseSalary: currentSalary,
                    allowances,
                    irtDeduction: dynamicIRPS, // Updated IRPS
                    ...calcs
                };

                if (record.id.startsWith('draft-')) {
                    // It's a virtual draft, we can 'save' it as a real draft now?
                    // Or just rely on visual update? 
                    // Since `currentPayrollData` handles visual, we need to save to store to persist the "recalculate"
                    const newId = generateId();
                    const { employee, id, ...cleanRecord } = updatedRecord;
                    addPayroll({ ...cleanRecord, id: newId, status: 'draft' } as PayrollRecord);
                } else {
                    updatePayroll(record.id, updatedRecord);
                }
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            toast.success(`Valores recalculados! IRPS e INSS actualizados (INSS: ${inssEmployeeRate}%)`);
        } else {
            toast('Nenhum rascunho para atualizar', { icon: 'ℹ️' });
        }
    };

    // Handle Input Change for Drafts
    const handleUpdateValues = (record: PayrollRecord & { employee: Employee }, field: keyof PayrollRecord, value: number) => {
        const updatedRecord = { ...record, [field]: value };

        // Recalculate Totals
        const calcs = calculatePayroll(
            updatedRecord.baseSalary,
            updatedRecord.bonus,
            updatedRecord.otAmount,
            updatedRecord.allowances,
            updatedRecord.irtDeduction,
            updatedRecord.advances
        );

        Object.assign(updatedRecord, calcs);

        // If it's real record, update store. If draft, we might need to create it first?
        if (!record.id.startsWith('draft-')) {
            updatePayroll(record.id, updatedRecord);
        } else {
            // It's a draft, so we need to Create it if user edits? 
            // Since we map from store, directly updating store is best.
            const newId = generateId();
            // Removing 'employee' prop before saving
            const { employee, id, ...cleanRecord } = updatedRecord;
            addPayroll({ ...cleanRecord, id: newId, status: 'draft' } as PayrollRecord);
        }
    };

    const handleSaveMonth = () => {
        // Save all drafts
        currentPayrollData.forEach(record => {
            if (record.id.startsWith('draft-')) {
                const newId = generateId();
                const { employee, id, ...cleanRecord } = record;
                addPayroll({ ...cleanRecord, id: newId, status: 'processed' } as PayrollRecord);
            } else {
                updatePayroll(record.id, { status: 'processed' });
            }
        });
        toast.success('Folha processada com sucesso!');
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
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <select
                            className="p-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 font-medium"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        >
                            {months.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <select
                            className="p-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 font-medium"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                        >
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleRecalculate}>
                            <HiOutlineRefresh className="w-4 h-4 mr-2" />
                            Recalcular Valores
                        </Button>
                        <Button onClick={handleSaveMonth}>
                            <HiOutlineSave className="w-4 h-4 mr-2" />
                            Fechar Processamento Mensal
                        </Button>
                    </div>
                </div>

                {/* Fiscal Rates Indicator */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Taxas Fiscais Activas:</span>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-medium">
                            INSS Trabalhador: {inssEmployeeRate}%
                        </span>
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg font-medium">
                            IRPS: Tabela Progressiva
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            (Configurado em Gestão Fiscal)
                        </span>
                    </div>
                </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md" className="bg-primary-50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">Total Líquido a Pagar</p>
                            <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{formatCurrency(totals.totalNet)}</p>
                        </div>
                        <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl backdrop-blur-sm">
                            <HiOutlineCash className="w-8 h-8 text-primary-500" />
                        </div>
                    </div>
                </Card>
                <Card padding="md" className="bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total INSS Retido ({inssEmployeeRate}%)</p>
                            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{formatCurrency(totals.totalINSS)}</p>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-xl">
                            <HiOutlineLibrary className="w-8 h-8 text-gray-500" />
                        </div>
                    </div>
                </Card>
                <Card padding="md" className="bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total IRPS Retido</p>
                            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{formatCurrency(totals.totalIRPS)}</p>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-xl">
                            <HiOutlineDocumentText className="w-8 h-8 text-gray-500" />
                        </div>
                    </div>
                </Card>
            </div>


            {/* Table */}
            <Card padding="none" className="overflow-hidden">
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
                                        <input
                                            type="number"
                                            className="w-20 p-1 text-right text-sm border rounded bg-transparent"
                                            value={record.irtDeduction}
                                            onChange={(e) => handleUpdateValues(record, 'irtDeduction', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(record.netSalary)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <PayslipGenerator record={record} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalPayrollItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>
        </div >
    );
}
