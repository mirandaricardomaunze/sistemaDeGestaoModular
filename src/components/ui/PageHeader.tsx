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
            <div className="bg-white dark:bg-[#12141a] rounded-2xl p-6 border border-slate-200/60 dark:border-white/5 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-card-hover">
                {/* Subtle premium background elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-60" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl -ml-12 -mb-12 transition-opacity group-hover:opacity-100 opacity-40" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                        {icon && (
                            <div className="w-12 h-12 rounded-xl bg-primary-600/10 flex items-center justify-center shrink-0 border border-primary-500/10 shadow-sm transition-transform group-hover:scale-105">
                                {React.cloneElement(icon as React.ReactElement, { 
                                    className: cn('w-6 h-6 text-primary-600 dark:text-primary-400', (icon as any).props?.className) 
                                } as any)}
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none mb-1">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-tight opacity-80">
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
                    <div className="mt-6 border-t border-slate-100 dark:border-white/5 pt-6 relative z-10">
                        {tabs}
                    </div>
                )}
                
                {/* Elegant bottom accent line */}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary-500 transition-all duration-700 group-hover:w-full opacity-50" />
            </div>
        </div>
    );
}
