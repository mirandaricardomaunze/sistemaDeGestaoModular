import { useAuthStore } from '../stores/useAuthStore';
import type { Permission } from '../utils/permissions';
import { hasPermission, canViewPage } from '../utils/permissions';


export const usePermissions = () => {
    const { user } = useAuthStore();

    return {
        hasPermission: (permission: Permission | string) => hasPermission(user, permission),
        canViewPage: (path: string) => canViewPage(user, path),
        role: user?.role,
        isAdmin: user?.role === 'admin',
        isManager: user?.role === 'manager' || user?.role === 'admin',
    };
};
