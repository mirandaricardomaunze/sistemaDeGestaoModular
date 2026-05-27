import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import { LoadingOverlay } from './Loading';

const SHOW_GRACE_MS = 150;
const SAFETY_TIMEOUT_MS = 20000;

export function PageTransitionLoader() {
    const location = useLocation();
    const isFetching = useIsFetching();
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

    return <LoadingOverlay message="A carregar dados..." fullScreen />;
}
