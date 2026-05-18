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
            const coreModuleCodes = ['pos', 'crm', 'HR', 'FISCAL', 'INVOICES', 'FINANCIAL'];
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

// Safe fallback for transient render paths where the provider is not yet mounted
// (lazy-loaded chunks during HMR, ErrorBoundary fallbacks, etc). The provider is
// always present in production at the route layer; this stub just prevents a
// hard crash if a consumer renders ahead of provider mount.
const TENANT_FALLBACK: TenantContextType = {
    company: null,
    activeModules: [],
    isLoading: true,
    hasModule: () => false,
};

export const useTenant = (): TenantContextType => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
            console.warn('useTenant called outside <TenantProvider> — using fallback. Check component tree.');
        }
        return TENANT_FALLBACK;
    }
    return context;
};
