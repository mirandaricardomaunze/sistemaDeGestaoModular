import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

import { Skeleton } from '../../components/ui';

const CommercialDashboard = lazy(() => import('./CommercialDashboard'));
const CommercialReports = lazy(() => import('./CommercialReports'));

function PageFallback() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-1/4 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-80 rounded-xl" />
        </div>
    );
}

export default function CommercialInsightHub() {
    const { pathname } = useLocation();
    const isReportsRoute = pathname.includes('/reports');
    const isMarginsRoute = pathname.includes('/margins');

    return (
        <Suspense fallback={<PageFallback />}>
            {isReportsRoute && <CommercialReports />}
            {isMarginsRoute && <CommercialReports initialTab="margins" />}
            {!isReportsRoute && !isMarginsRoute && <CommercialDashboard />}
        </Suspense>
    );
}
