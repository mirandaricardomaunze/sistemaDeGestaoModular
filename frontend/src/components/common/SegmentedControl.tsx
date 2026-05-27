import React from 'react';
import { cn } from '../../utils/helpers';
import { Button } from '../ui/Button';

interface Option {
    label: string;
    value: string | number;
    icon?: React.ElementType;
}

interface SegmentedControlProps<V extends string | number = string | number> {
    options: Option[];
    value: V;
    onChange: (value: V) => void;
    className?: string;
    size?: 'sm' | 'md';
}

export function SegmentedControl<V extends string | number = string | number>({
    options,
    value,
    onChange,
    className,
    size = 'sm'
}: SegmentedControlProps<V>) {
    return (
        <div className={cn(
            "flex max-w-full items-center overflow-x-auto overscroll-x-contain bg-slate-100/90 dark:bg-dark-800 rounded-xl p-1 border border-slate-300/80 dark:border-white/5 shadow-inner scrollbar-none",
            size === 'sm' ? "min-h-11 sm:min-h-10" : "min-h-12 sm:min-h-11",
            className
        )}>
            {options.map((opt) => (
                <Button variant="ghost"
                    size="xs"
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value as V)}
                    className={cn(
                        "transition-all duration-300 flex min-w-max max-w-[14rem] items-center justify-center font-black uppercase tracking-widest gap-2 flex-1 h-full whitespace-nowrap",
                        size === 'sm' ? "px-3 sm:px-4 text-[10px] rounded-lg" : "px-4 sm:px-6 text-xs rounded-lg",
                        value === opt.value
                            ? "bg-white dark:bg-dark-700 text-primary-700 dark:text-primary-400 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.7)] scale-[1.02]"
                            : "text-slate-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400"
                    )}
                >
                    {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                    {opt.label}
                </Button>
            ))}
        </div>
    );
}
