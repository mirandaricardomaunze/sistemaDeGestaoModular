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

interface ModulePeriodFilterProps<T extends string = TimePeriod> {
    value: T;
    onChange: (period: T) => void;
    options?: { value: T; label: string }[];
    className?: string;
}

export function ModulePeriodFilter<T extends string = TimePeriod>({
    value,
    onChange,
    options = PERIOD_OPTIONS as unknown as { value: T; label: string }[],
    className,
}: ModulePeriodFilterProps<T>) {
    return (
        <SegmentedControl
            options={options}
            value={value}
            onChange={(val) => onChange(val as T)}
            className={className}
        />
    );
}
