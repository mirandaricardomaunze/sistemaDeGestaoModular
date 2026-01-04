import React, { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useStore, MODULE_TO_BUSINESS_TYPE } from '../stores/useStore';

interface Company {
    id: string;
    name: string;
    status: string;
    settings?: any;
}

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
        // Commercial is the base module for many things, but we check strictly
        return activeModules.includes(moduleCode.toUpperCase());
    };

    // Sync businessType in useStore with activeModules
    const { setBusinessType } = useStore();

    useEffect(() => {
        if (user && activeModules.length > 0) {
            // Primary module (usually the first one after registration)
            const primaryModule = activeModules[0];
            const mappedType = MODULE_TO_BUSINESS_TYPE[primaryModule];
            if (mappedType) {
                setBusinessType(mappedType);
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
