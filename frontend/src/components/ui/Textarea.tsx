import React from 'react';
import { cn } from '../../utils/helpers';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, helperText, className, ...props }, ref) => {
        return (
            <div className="w-full group">
                {label && (
                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 transition-colors group-focus-within:text-primary-600">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    className={cn(
                        'w-full px-4 py-3 rounded-xl border bg-white dark:bg-dark-800 text-slate-950 dark:text-gray-100 placeholder-slate-500 dark:placeholder-gray-500 transition-all duration-300 resize-none shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] dark:shadow-none outline-none',
                        error
                            ? 'border-red-500 ring-4 ring-red-500/10 focus:border-red-500'
                            : 'border-slate-300/80 dark:border-dark-700 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500',
                        className
                    )}
                    {...props}
                />
                {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
                {helperText && !error && (
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-gray-400">{helperText}</p>
                )}
            </div>
        );
    }
);
Textarea.displayName = 'Textarea';
