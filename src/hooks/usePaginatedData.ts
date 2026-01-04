import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UsePaginatedDataOptions<T> {
    endpoint: string;
    initialPage?: number;
    initialLimit?: number;
    filters?: Record<string, any>;
    debounceMs?: number;
    enabled?: boolean;
    onSuccess?: (data: T[]) => void;
    onError?: (error: any) => void;
}

interface UsePaginatedDataReturn<T> {
    data: T[];
    isLoading: boolean;
    isFetching: boolean;
    error: string | null;
    pagination: PaginationMeta | null;
    page: number;
    setPage: (page: number) => void;
    limit: number;
    setLimit: (limit: number) => void;
    sortBy: string;
    setSortBy: (sortBy: string) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    refetch: () => void;
    hasMore: boolean;
    loadMore: () => void;
}

export function usePaginatedData<T = any>({
    endpoint,
    initialPage = 1,
    initialLimit = 20,
    filters = {},
    debounceMs = 300,
    enabled = true,
    onSuccess,
    onError,
}: UsePaginatedDataOptions<T>): UsePaginatedDataReturn<T> {
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);

    const [page, setPage] = useState(initialPage);
    const [limit, setLimit] = useState(initialLimit);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const abortControllerRef = useRef<AbortController | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async () => {
        if (!enabled) return;

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        const isInitialLoad = data.length === 0;
        if (isInitialLoad) {
            setIsLoading(true);
        } else {
            setIsFetching(true);
        }
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                sortBy,
                sortOrder,
                ...filters,
            });

            const response = await axios.get(`${API_URL}/${endpoint}?${params}`, {
                signal: abortControllerRef.current.signal,
            });

            const responseData = response.data;

            // Handle both paginated and non-paginated responses
            if (responseData.data && responseData.pagination) {
                setData(responseData.data);
                setPagination(responseData.pagination);
            } else {
                // Fallback for non-paginated endpoints
                setData(Array.isArray(responseData) ? responseData : [responseData]);
                setPagination({
                    page: 1,
                    limit: responseData.length,
                    total: responseData.length,
                    totalPages: 1,
                    hasMore: false,
                });
            }

            if (onSuccess) {
                onSuccess(responseData.data || responseData);
            }
        } catch (err: any) {
            if (err.name === 'CanceledError') {
                // Request was cancelled, ignore
                return;
            }

            const errorMessage = err.response?.data?.error || err.message || 'Erro ao carregar dados';
            setError(errorMessage);

            if (onError) {
                onError(err);
            }
        } finally {
            setIsLoading(false);
            setIsFetching(false);
        }
    }, [endpoint, page, limit, sortBy, sortOrder, JSON.stringify(filters), enabled]);

    // Debounced fetch
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            fetchData();
        }, debounceMs);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchData, debounceMs]);

    const loadMore = useCallback(() => {
        if (pagination?.hasMore) {
            setPage(prev => prev + 1);
        }
    }, [pagination]);

    const refetch = useCallback(() => {
        setPage(1);
        fetchData();
    }, [fetchData]);

    return {
        data,
        isLoading,
        isFetching,
        error,
        pagination,
        page,
        setPage,
        limit,
        setLimit,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        refetch,
        hasMore: pagination?.hasMore || false,
        loadMore,
    };
}

// Hook específico para produtos com paginação
export function usePaginatedProducts(filters: Record<string, any> = {}) {
    return usePaginatedData({
        endpoint: 'products',
        filters,
        initialLimit: 20,
    });
}

// Hook específico para clientes com paginação
export function usePaginatedCustomers(filters: Record<string, any> = {}) {
    return usePaginatedData({
        endpoint: 'customers',
        filters,
        initialLimit: 20,
    });
}

// Hook específico para funcionários com paginação
export function usePaginatedEmployees(filters: Record<string, any> = {}) {
    return usePaginatedData({
        endpoint: 'employees',
        filters,
        initialLimit: 20,
    });
}
