/**
 * EmployeeSalaryHistory.tsx
 * 
 * Displays the complete salary payment history for a specific employee.
 * Shows all payroll records with status, dates, and allows printing past slips.
 * Implements professional-grade patterns: clean hooks, strict typing, and audit trails.
 */

import { useState, useEffect } from 'react';
import { HiOutlineCurrencyDollar, HiOutlineDocumentReport } from 'react-icons/hi';
import { usePayroll } from '../../hooks/useData';
import { Card, Badge, LoadingSpinner, TableContainer, Button } from '../ui';
import { Pagination, usePagination } from '../ui/Pagination';
import { formatCurrency, formatDate } from '../../utils/helpers';
import type { PayrollRecord, Employee } from '../../types';
import PayslipGenerator from './PayslipGenerator';

interface EmployeeSalaryHistoryProps {
    employee: Employee;
    onClose?: () => void;
}

export default function EmployeeSalaryHistory({ employee, onClose }: EmployeeSalaryHistoryProps) {
    const { getEmployeeHistory } = usePayroll();
    const [history, setHistory] = useState<PayrollRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const records = await getEmployeeHistory(employee.id);
                // Sort by year and month descending (most recent first)
                records.sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                });
                setHistory(records);
            } catch (error) {
                console.error('Error fetching salary history:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [employee.id, getEmployeeHistory]);

    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems,
        totalItems,
    } = usePagination(history, 10);

    const getStatusBadge = (status: PayrollRecord['status']) => {
        switch (status) {
            case 'paid':
                return <Badge variant="success">Pago</Badge>;
            case 'processed':
                return <Badge variant="warning">Processado</Badge>;
            default:
                return <Badge variant="default">Rascunho</Badge>;
        }
    };

    const months = [
        '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    return (
        <Card padding="md" className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <HiOutlineCurrencyDollar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Histórico Salarial
                        </h2>
                        <p className="text-sm text-gray-500">{employee.name} ({employee.code})</p>
                    </div>
                </div>
                {onClose && (
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Fechar
                    </Button>
                )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-800">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total de Registos</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">{history.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                    <p className="text-xs text-green-600 uppercase font-bold">Pagos</p>
                    <p className="text-xl font-black text-green-700 dark:text-green-400">
                        {history.filter(r => r.status === 'paid').length}
                    </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-xs text-amber-600 uppercase font-bold">Processados</p>
                    <p className="text-xl font-black text-amber-700 dark:text-amber-400">
                        {history.filter(r => r.status === 'processed').length}
                    </p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-xs text-blue-600 uppercase font-bold">Valor Total Acumulado</p>
                    <p className="text-xl font-black text-blue-700 dark:text-blue-400">
                        {formatCurrency(history.reduce((sum, r) => sum + r.netSalary, 0))}
                    </p>
                </div>
            </div>

            {/* Table */}
            <TableContainer isLoading={isLoading} isEmpty={history.length === 0} emptyMessage="Sem registos salariais para este colaborador.">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-dark-800">
                        <tr>
                            <th className="px-6 py-3">Período</th>
                            <th className="px-6 py-3 text-right">Sal. Base</th>
                            <th className="px-6 py-3 text-right">Descontos</th>
                            <th className="px-6 py-3 text-right">Líquido</th>
                            <th className="px-6 py-3 text-center">Estado</th>
                            <th className="px-6 py-3 text-center">Acções</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                        {paginatedItems.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                <td className="px-6 py-4 font-medium">
                                    {months[record.month]} {record.year}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                    {formatCurrency(record.baseSalary)}
                                </td>
                                <td className="px-6 py-4 text-right text-red-500">
                                    -{formatCurrency(record.totalDeductions)}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(record.netSalary)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {getStatusBadge(record.status)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <PayslipGenerator record={{ ...record, employee }} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableContainer>

            {/* Pagination */}
            {totalItems > 10 && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                />
            )}
        </Card>
    );
}
