import React from 'react';
import { cn } from '../../utils/helpers';

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'size'> {
    label?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    leftIcon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, placeholder, className, size, leftIcon, ...props }, ref) => {
        return (
            <div className="w-full group">
                {label && (
                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 transition-colors group-focus-within:text-primary-600">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-gray-400">
                            {leftIcon}
                        </div>
                    )}
                    <select
                        ref={ref}
                        className={cn(
                            'w-full rounded-xl border bg-white dark:bg-dark-800 text-slate-950 dark:text-gray-100 transition-all duration-200 appearance-none cursor-pointer shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] dark:shadow-none outline-none',
                            size === 'xs' ? 'px-3 h-11 sm:h-8 text-base sm:text-[10px]' :
                                size === 'sm' ? 'px-4 h-11 sm:h-10 text-base sm:text-xs' :
                                    size === 'lg' ? 'px-6 h-14 text-lg' :
                                        'px-4 h-12 text-base sm:text-sm',
                            error
                                ? 'border-red-500 ring-4 ring-red-500/10 focus:border-red-500'
                                : 'border-slate-300 dark:border-dark-700 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500',
                            leftIcon ? 'pl-10' : '',
                            className
                        )}
                        {...props}
                    >
                        {placeholder && (
                            <option value="" disabled>
                                {placeholder}
                            </option>
                        )}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-500 dark:text-gray-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
            </div>
        );
    }
);
Select.displayName = 'Select';
