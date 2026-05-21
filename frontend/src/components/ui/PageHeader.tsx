import React from 'react';
import { cn } from '../../utils/helpers';

export interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    tabs?: React.ReactNode;
    className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, tabs, className }: PageHeaderProps) {
    return (
        <div className={cn("mb-6 relative group", className)}>
            <div className="bg-white dark:bg-[#12141a] rounded-2xl p-6 border border-slate-300/70 dark:border-white/5 shadow-card relative overflow-hidden transition-all duration-300 hover:shadow-card-hover">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                        {icon && (
                            <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center shrink-0 border border-primary-600 shadow-md transition-transform group-hover:scale-105 dark:bg-primary-600/10 dark:border-primary-500/10">
                                {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                                    className: cn((icon as React.ReactElement<{ className?: string }>).props?.className, 'w-6 h-6 text-white dark:text-primary-400')
                                })}
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-black text-slate-950 dark:text-white uppercase tracking-normal leading-none mb-1">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-xs text-slate-600 dark:text-gray-400 font-semibold tracking-normal">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
                {tabs && (
                    <div className="mt-6 border-t border-slate-200/80 dark:border-white/5 pt-6 relative z-10">
                        {tabs}
                    </div>
                )}
                
                <div className="absolute bottom-0 left-0 h-0.5 w-12 bg-primary-500/70 transition-all duration-500 group-hover:w-28" />
            </div>
        </div>
    );
}
