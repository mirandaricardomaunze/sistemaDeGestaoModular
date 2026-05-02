import React from 'react';
import { cn } from '../../utils/helpers';

interface Option {
    label: string;
    value: string | number;
    icon?: React.ElementType;
}

interface SegmentedControlProps {
    options: Option[];
    value: string | number;
    onChange: (value: any) => void;
    className?: string;
    size?: 'sm' | 'md';
}

export function SegmentedControl({
    options,
    value,
    onChange,
    className,
    size = 'sm'
}: SegmentedControlProps) {
    return (
        <div className={cn(
            "flex items-center bg-slate-100 dark:bg-dark-800 rounded-xl p-1 border border-slate-200 dark:border-white/5 shadow-inner",
            className
        )}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "transition-all duration-300 flex items-center justify-center font-black uppercase tracking-widest gap-2",
                        size === 'sm' ? "px-4 h-8 text-[10px] rounded-lg" : "px-6 h-10 text-[11px] rounded-xl",
                        value === opt.value
                            ? "bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm scale-[1.02]"
                            : "text-slate-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                    )}
                >
                    {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
