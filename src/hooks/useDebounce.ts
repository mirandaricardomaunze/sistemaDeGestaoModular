import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para debounce de valores
 * Útil para evitar requisições excessivas em campos de busca
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook para debounce de callbacks
 * Útil para funções que devem ser executadas com delay
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 300
): (...args: Parameters<T>) => void {
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        const newTimeoutId = setTimeout(() => {
            callback(...args);
        }, delay);

        setTimeoutId(newTimeoutId);
    };
}

/**
 * Search-input pair: a `term` you bind to the input and a `debounced` value
 * you feed into a query. Avoids firing one network request per keystroke.
 *
 *   const { term, setTerm, debounced } = useDebouncedSearch('', 350);
 *   const { data } = useQuery({ queryKey: ['x', debounced], ... });
 */
export function useDebouncedSearch(initial: string = '', delay: number = 350) {
    const [term, setTerm] = useState(initial);
    const debounced = useDebounce(term, delay);
    const reset = useCallback(() => setTerm(''), []);
    return { term, setTerm, debounced, reset };
}
