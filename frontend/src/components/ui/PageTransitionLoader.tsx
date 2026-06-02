import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { LoadingOverlay } from './Loading';
import { labelForQueryKey, formatResourceList } from '../../utils/queryLabels';

const SHOW_GRACE_MS = 150;
const SAFETY_TIMEOUT_MS = 20000;

export function PageTransitionLoader() {
    const location = useLocation();
    const isFetching = useIsFetching();
    const queryClient = useQueryClient();
    const [show, setShow] = useState(false);
    const isFetchingRef = useRef(isFetching);

    useEffect(() => {
        isFetchingRef.current = isFetching;
    }, [isFetching]);

    useEffect(() => {
        setShow(false);
        const graceTimer = setTimeout(() => {
            if (isFetchingRef.current > 0) setShow(true);
        }, SHOW_GRACE_MS);
        return () => clearTimeout(graceTimer);
    }, [location.pathname]);

    useEffect(() => {
        if (isFetching === 0 && show) setShow(false);
    }, [isFetching, show]);

    useEffect(() => {
        if (!show) return;
        const safetyTimer = setTimeout(() => setShow(false), SAFETY_TIMEOUT_MS);
        return () => clearTimeout(safetyTimer);
    }, [show]);

    if (!show) return null;

    // Inspect the cache for queries currently in flight and convert each one
    // to a human label. Re-runs on every render — and useIsFetching above
    // re-triggers renders whenever a fetch starts/finishes, so the subtitle
    // stays current as queries resolve.
    const fetchingQueries = queryClient.getQueryCache().findAll({ fetchStatus: 'fetching' });
    const labels = Array.from(
        new Set(
            fetchingQueries
                .map((q) => labelForQueryKey(q.queryKey))
                .filter((l): l is string => l !== null),
        ),
    );

    return (
        <LoadingOverlay
            message="A carregar"
            subtext={labels.length > 0 ? formatResourceList(labels) : undefined}
            fullScreen
        />
    );
}
