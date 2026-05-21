import React, { useMemo } from 'react';
import {
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineXMark,
    HiOutlineExclamationCircle,
} from 'react-icons/hi2';
import { useEmployees } from '../../../hooks/useData';
import { MetricCard } from '../../common/ModuleMetricCard';
import { isBefore, addDays } from 'date-fns';
import type { Employee } from '../../../types';

type DocStatus = 'valid' | 'expiring' | 'expired' | 'missing';

function overallStatus(emp: Employee): DocStatus {
    if (!emp.contractExpiry) return 'missing';
    const exp = new Date(emp.contractExpiry);
    const today = new Date();
    if (isBefore(exp, today)) return 'expired';
    if (isBefore(exp, addDays(today, 30))) return 'expiring';
    return 'valid';
}

export const HRSummaryPanel: React.FC = () => {
    const { employees: allEmp, isLoading } = useEmployees({ limit: 200 });

    const employees = useMemo(() =>
        (allEmp || []).filter(e => !e.department || e.department === 'Comercial'),
        [allEmp]);

    const summary = useMemo(() => ({
        valid: employees.filter(e => overallStatus(e) === 'valid').length,
        expiring: employees.filter(e => overallStatus(e) === 'expiring').length,
        expired: employees.filter(e => overallStatus(e) === 'expired').length,
        missing: employees.filter(e => overallStatus(e) === 'missing').length,
    }), [employees]);

    if (isLoading) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <MetricCard
                label="Válidos"
                value={summary.valid}
                color="emerald"
                icon={<HiOutlineCheckCircle className="w-6 h-6" />}
            />
            <MetricCard
                label="A Expirar"
                value={summary.expiring}
                color="amber"
                icon={<HiOutlineExclamationTriangle className="w-6 h-6" />}
            />
            <MetricCard
                label="Expirados"
                value={summary.expired}
                color="red"
                icon={<HiOutlineXMark className="w-6 h-6" />}
            />
            <MetricCard
                label="Em Falta"
                value={summary.missing}
                color="slate"
                icon={<HiOutlineExclamationCircle className="w-6 h-6" />}
            />
        </div>
    );
};
