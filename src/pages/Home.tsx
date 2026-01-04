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

    // Prioritize Pharmacy Dashboard as requested
    if (hasModule('PHARMACY')) {
        return <Navigate to="/pharmacy/dashboard" replace />;
    }

    // Secondary options
    if (hasModule('HOTEL')) {
        return <Navigate to="/hospitality" replace />;
    }

    if (hasModule('LOGISTICS')) {
        return <Navigate to="/logistics" replace />;
    }

    // Fallback to Commercial Dashboard (available via /dashboard path)
    return <Navigate to="/dashboard" replace />;
}
