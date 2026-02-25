import { Navigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { useAuthStore } from '../stores/useAuthStore';
import { LoadingSpinner } from '../components/ui';

export default function Home() {
    const { isLoading, hasModule } = useTenant();
    const { user } = useAuthStore();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner size="xl" />
            </div>
        );
    }

    // Redirect Super Admin to system dashboard
    if (user?.role === 'super_admin') {
        return <Navigate to="/super-admin" replace />;
    }

    // Standardized Redirects by Module
    if (hasModule('PHARMACY')) {
        return <Navigate to="/pharmacy/dashboard" replace />;
    }

    if (hasModule('HOTEL') || hasModule('HOSPITALITY')) {
        return <Navigate to="/hotel/dashboard" replace />;
    }

    if (hasModule('LOGISTICS')) {
        return <Navigate to="/logistics/dashboard" replace />;
    }

    if (hasModule('BOTTLE_STORE')) {
        return <Navigate to="/bottle-store/dashboard" replace />;
    }

    // COMMERCIAL module and fallback both use the main dashboard
    // which includes the "Desempenho por Módulo" overview
    return <Navigate to="/dashboard" replace />;
}
