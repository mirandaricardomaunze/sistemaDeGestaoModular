import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import { LoadingOverlay } from './Loading';

export function PageTransitionLoader() {
    const location = useLocation();
    const isFetching = useIsFetching();

    const [isTransitioning, setIsTransitioning] = useState(true);
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    const sawFetchRef = useRef(false);
    const graceElapsedRef = useRef(false);
    const [, forceTick] = useState(0);

    useEffect(() => {
        setIsTransitioning(true);
        setMinTimeElapsed(false);
        sawFetchRef.current = false;
        graceElapsedRef.current = false;

        const minTimer = setTimeout(() => setMinTimeElapsed(true), 400);

        const graceTimer = setTimeout(() => {
            graceElapsedRef.current = true;
            forceTick(x => x + 1);
        }, 600);

        return () => {
            clearTimeout(minTimer);
            clearTimeout(graceTimer);
        };
    }, [location.pathname]);

    useEffect(() => {
        if (isFetching > 0) sawFetchRef.current = true;
    }, [isFetching]);

    useEffect(() => {
        if (!minTimeElapsed) return;

        const noFetchActivity = isFetching === 0 && !sawFetchRef.current && graceElapsedRef.current;
        const fetchesFinished = sawFetchRef.current && isFetching === 0;

        if (noFetchActivity || fetchesFinished) {
            setIsTransitioning(false);
        }
    }, [minTimeElapsed, isFetching]);

    useEffect(() => {
        if (isTransitioning) {
            const safetyTimer = setTimeout(() => {
                setIsTransitioning(false);
            }, 30000);
            return () => clearTimeout(safetyTimer);
        }
    }, [isTransitioning]);

    if (!isTransitioning) return null;

    return <LoadingOverlay message="A carregar dados..." fullScreen />;
}
