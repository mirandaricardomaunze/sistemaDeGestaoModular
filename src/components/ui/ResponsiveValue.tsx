import React from 'react';
import { formatCurrency, formatNumber, cn } from '../../utils/helpers';

interface ResponsiveValueProps {
    value: number;
    type?: 'currency' | 'number' | 'percent';
    currency?: string;
    decimals?: number;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ResponsiveValue({
    value,
    type = 'currency',
    currency = 'MZN',
    decimals = 0,
    className,
    size = 'md',
}: ResponsiveValueProps) {
    const formattedValue = React.useMemo(() => {
        if (type === 'currency') return formatCurrency(value, currency);
        if (type === 'percent') return `${formatNumber(value, 1)}%`;
        return formatNumber(value, decimals);
    }, [value, type, currency, decimals]);

    // Responsive font sizes using tailwind classes (can also use clamp if needed in CSS)
    const sizeClasses = {
        sm: 'text-sm sm:text-base font-medium',
        md: 'text-base sm:text-lg lg:text-xl font-bold',
        lg: 'text-xl sm:text-2xl lg:text-3xl font-bold',
        xl: 'text-2xl sm:text-3xl lg:text-4xl font-extrabold',
    };

    return (
        <span
            className={cn(
                'block truncate transition-all duration-200',
                sizeClasses[size],
                className
            )}
            title={formattedValue} // Show full value on hover
        >
            {formattedValue}
        </span>
    );
}
