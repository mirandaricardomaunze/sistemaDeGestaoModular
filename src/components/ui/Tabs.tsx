import { useState, type ReactNode } from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (tabId: string) => void;
    variant?: 'default' | 'pills' | 'underline';
    className?: string;
}

interface TabPanelProps {
    children: ReactNode;
    className?: string;
}

interface TabContentProps {
    children: ReactNode;
    tabId: string;
    activeTab: string;
}

export function Tabs({ tabs, activeTab, onChange, variant = 'default', className = '' }: TabsProps) {
    const baseClasses = 'flex gap-1';

    const getTabClasses = (tab: Tab, isActive: boolean) => {
        const base = 'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/50';
        const disabled = tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

        if (variant === 'pills') {
            return `${base} ${disabled} rounded-lg ${isActive
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
                }`;
        }

        if (variant === 'underline') {
            return `${base} ${disabled} border-b-2 -mb-px ${isActive
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
                }`;
        }

        // Default style
        return `${base} ${disabled} rounded-t-lg border border-b-0 ${isActive
                ? 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-600 text-primary-600'
                : 'bg-gray-50 dark:bg-dark-700 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-600'
            }`;
    };

    return (
        <div className={`${baseClasses} ${variant === 'underline' ? 'border-b border-gray-200 dark:border-dark-600' : ''} ${className}`}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => !tab.disabled && onChange(tab.id)}
                    className={getTabClasses(tab, activeTab === tab.id)}
                    disabled={tab.disabled}
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export function TabPanel({ children, className = '' }: TabPanelProps) {
    return (
        <div className={`p-4 ${className}`}>
            {children}
        </div>
    );
}

export function TabContent({ children, tabId, activeTab }: TabContentProps) {
    if (tabId !== activeTab) return null;
    return <>{children}</>;
}

// Stepper variant for multi-step forms
interface Step {
    id: string;
    label: string;
    description?: string;
    icon?: ReactNode;
}

interface StepperProps {
    steps: Step[];
    currentStep: number;
    className?: string;
}

export function Stepper({ steps, currentStep, className = '' }: StepperProps) {
    return (
        <div className={`flex items-center justify-between ${className}`}>
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                        <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                            transition-all duration-300
                            ${index < currentStep
                                ? 'bg-green-500 text-white'
                                : index === currentStep
                                    ? 'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900'
                                    : 'bg-gray-200 dark:bg-dark-600 text-gray-500 dark:text-gray-400'
                            }
                        `}>
                            {index < currentStep ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : step.icon || (
                                <span>{index + 1}</span>
                            )}
                        </div>
                        <div className="mt-2 text-center">
                            <p className={`text-xs font-medium ${index <= currentStep
                                    ? 'text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                {step.label}
                            </p>
                            {step.description && (
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    {step.description}
                                </p>
                            )}
                        </div>
                    </div>
                    {index < steps.length - 1 && (
                        <div className={`
                            flex-1 h-0.5 mx-4 mt-[-1.5rem]
                            ${index < currentStep
                                ? 'bg-green-500'
                                : 'bg-gray-200 dark:bg-dark-600'
                            }
                        `} />
                    )}
                </div>
            ))}
        </div>
    );
}

// Hook for managing tab state
export function useTabs(defaultTab: string) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    return { activeTab, setActiveTab };
}

// Hook for managing stepper state
export function useStepper(totalSteps: number) {
    const [currentStep, setCurrentStep] = useState(0);

    const next = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
    const prev = () => setCurrentStep(prev => Math.max(prev - 1, 0));
    const reset = () => setCurrentStep(0);
    const goTo = (step: number) => setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));

    return { currentStep, next, prev, reset, goTo, isFirst: currentStep === 0, isLast: currentStep === totalSteps - 1 };
}
