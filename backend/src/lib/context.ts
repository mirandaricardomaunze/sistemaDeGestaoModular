import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
    companyId: string;
    userId?: string;
    userName?: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

export const getTenantId = () => tenantContext.getStore()?.companyId;
export const getUserId = () => tenantContext.getStore()?.userId;
export const getUserName = () => tenantContext.getStore()?.userName;
