/**
 * ModulePeriodFilter - filtro de período reutilizável para dashboards de módulos.
 *
 * Elimina duplicação do bloco de botões de período que aparecia identicamente
 * em Farmácia, Hotel, Logística e Bottle Store.
 */

import { cn } from '../../utils/helpers';

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
        <div className={cn('flex items-center gap-2 bg-gray-100 dark:bg-dark-700 rounded-lg p-1', className)}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value as TimePeriod)}
                    className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                        value === opt.value
                            ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
