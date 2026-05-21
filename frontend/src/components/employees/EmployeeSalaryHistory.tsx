import { logger } from '../../utils/logger';
/**
 * Displays the complete salary payment history for a specific employee.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { HiOutlineCurrencyDollar } from 'react-icons/hi2';
import { usePayroll } from '../../hooks/useData';
import { Card, Badge, Button, SmartTable } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import type { PayrollRecord, Employee } from '../../types';
import PayslipGenerator from './PayslipGenerator';

interface EmployeeSalaryHistoryProps {
    employee: Employee;
    onClose?: () => void;
}

const months = [
    '', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function EmployeeSalaryHistory({ employee, onClose }: EmployeeSalaryHistoryProps) {
    const { getEmployeeHistory } = usePayroll();
    const [history, setHistory] = useState<PayrollRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const records = await getEmployeeHistory(employee.id);
                records.sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                });
                setHistory(records);
            } catch (error) {
                logger.error('Error fetching salary history:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [employee.id, getEmployeeHistory]);

    const paginatedHistory = useMemo(() => {
        const start = (page - 1) * pageSize;
        return history.slice(start, start + pageSize);
    }, [history, page, pageSize]);

    const getStatusBadge = (status: PayrollRecord['status']) => {
        switch (status) {
            case 'paid':
                return <Badge variant="success">Pago</Badge>;
            case 'processed':
                return <Badge variant="warning">Processado</Badge>;
            default:
                return <Badge variant="gray">Rascunho</Badge>;
        }
    };

    const columns = useMemo<ColumnDef<PayrollRecord, unknown>[]>(() => [
        {
            header: 'Periodo',
            cell: ({ row }) => (
                <span className="font-medium">
                    {months[row.original.month]} {row.original.year}
                </span>
            ),
        },
        {
            header: 'Sal. Base',
            cell: ({ row }) => (
                <span className="block text-right text-gray-600 dark:text-gray-400">
                    {formatCurrency(row.original.baseSalary)}
                </span>
            ),
        },
        {
            header: 'Descontos',
            cell: ({ row }) => (
                <span className="block text-right text-red-500">
                    -{formatCurrency(row.original.totalDeductions)}
                </span>
            ),
        },
        {
            header: 'Liquido',
            cell: ({ row }) => (
                <span className="block text-right font-bold text-gray-900 dark:text-white">
                    {formatCurrency(row.original.netSalary)}
                </span>
            ),
        },
        {
            header: 'Estado',
            cell: ({ row }) => <div className="text-center">{getStatusBadge(row.original.status)}</div>,
        },
        {
            header: 'Accoes',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <PayslipGenerator record={{ ...row.original, employee }} />
                </div>
            ),
        },
    ], [employee]);

    return (
        <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <HiOutlineCurrencyDollar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Historico Salarial
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-dark-800">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total de Registos</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">{history.length}</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <p className="text-xs text-green-600 uppercase font-bold">Pagos</p>
                    <p className="text-xl font-black text-green-700 dark:text-green-400">
                        {history.filter(r => r.status === 'paid').length}
                    </p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-xs text-amber-600 uppercase font-bold">Processados</p>
                    <p className="text-xl font-black text-amber-700 dark:text-amber-400">
                        {history.filter(r => r.status === 'processed').length}
                    </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-xs text-blue-600 uppercase font-bold">Valor Total Acumulado</p>
                    <p className="text-xl font-black text-blue-700 dark:text-blue-400">
                        {formatCurrency(history.reduce((sum, r) => sum + r.netSalary, 0))}
                    </p>
                </div>
            </div>

            <SmartTable
                data={paginatedHistory}
                columns={columns}
                isLoading={isLoading}
                hideToolbar
                emptyTitle="Sem registos salariais"
                emptyDescription="Sem registos salariais para este colaborador."
                pagination={{
                    currentPage: page,
                    totalItems: history.length,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                    onItemsPerPageChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                    },
                }}
            />
        </Card>
    );
}
