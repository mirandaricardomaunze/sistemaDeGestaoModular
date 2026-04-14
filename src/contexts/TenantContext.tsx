import React, { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useStore, MODULE_TO_BUSINESS_TYPE } from '../stores/useStore';
import type { Company } from '../types';


interface TenantContextType {
    company: Company | null;
    activeModules: string[];
    isLoading: boolean;
    hasModule: (moduleCode: string) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isLoading: authLoading } = useAuthStore();

    const company = useMemo(() => user?.company || null, [user]);

    const activeModules = useMemo(() => {
        if (!user) return [];
        return user.activeModules || [];
    }, [user]);

    const hasModule = (moduleCode: string) => {
        if (!user) return false;
        // Super Admin has access to all modules
        if (user.role === 'super_admin') return true;

        // Case-insensitive comparison to handle both lowercase and uppercase module codes
        const normalizedCode = moduleCode.toLowerCase();
        return activeModules.some(m => m.toLowerCase() === normalizedCode);
    };

    // Sync businessType in useStore with activeModules
    const { setBusinessType } = useStore();

    useEffect(() => {
        if (user && activeModules.length > 0) {
            // Find the first optional (non-core) module that has a business type mapping
            // Core modules (POS, CRM, HR, FISCAL, INVOICES, FINANCIAL) have no mapping,
            // so skip them and find the first optional module like PHARMACY, COMMERCIAL, etc.
            const coreModuleCodes = ['POS', 'CRM', 'HR', 'FISCAL', 'INVOICES', 'FINANCIAL'];
            const primaryModule = activeModules.find(m =>
                !coreModuleCodes.includes(m.toUpperCase()) && MODULE_TO_BUSINESS_TYPE[m]
            ) || activeModules.find(m => MODULE_TO_BUSINESS_TYPE[m]);
            if (primaryModule) {
                const mappedType = MODULE_TO_BUSINESS_TYPE[primaryModule];
                if (mappedType) setBusinessType(mappedType);
            }
        }
    }, [user, activeModules, setBusinessType]);

    return (
        <TenantContext.Provider value={{
            company,
            activeModules,
            isLoading: authLoading,
            hasModule
        }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant deve ser usado dentro de um TenantProvider');
    }
    return context;
};
