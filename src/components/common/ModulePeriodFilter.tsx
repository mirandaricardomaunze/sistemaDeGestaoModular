/**
 * ModulePeriodFilter - filtro de período reutilizável para dashboards de módulos.
 */

import { SegmentedControl } from './SegmentedControl';

export type TimePeriod = '1m' | '3m' | '6m' | '1y';

export const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

interface ModulePeriodFilterProps {
    value: TimePeriod;
    onChange: (period: TimePeriod) => void;
    options?: { value: string; label: string }[];
    className?: string;
}

export function ModulePeriodFilter({ value, onChange, options = PERIOD_OPTIONS, className }: ModulePeriodFilterProps) {
    return (
        <SegmentedControl
            options={options}
            value={value}
            onChange={(val) => onChange(val as TimePeriod)}
            className={className}
        />
    );
}
