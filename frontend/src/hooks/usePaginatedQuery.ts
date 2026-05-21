import {
    keepPreviousData,
    useInfiniteQuery,
    useQuery,
    type UseQueryOptions,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '../services/api/client';

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    hasMore?: boolean;
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: PaginationMeta;
}

interface UsePaginatedQueryOptions<T, R> {
    /** REST path, e.g. `products` or `customers`. */
    endpoint: string;
    /** Stable key prefix for the query cache. */
    queryKey: readonly unknown[];
    /** Filters and pagination params (already debounced upstream). */
    params?: Record<string, unknown>;
    /** Comma-separated field projection, e.g. `'id,name,price'`. */
    fields?: string;
    enabled?: boolean;
    staleTime?: number;
    /** Optional transform applied to the page data inside React Query. */
    select?: (page: PaginatedResult<T>) => R;
}

function normalizeResponse<T>(raw: unknown, fallbackPage: number, fallbackLimit: number): PaginatedResult<T> {
    const r = raw as { data?: T[]; pagination?: PaginationMeta } | T[] | undefined;
    if (r && !Array.isArray(r) && Array.isArray(r.data) && r.pagination) {
        const p = r.pagination;
        return {
            data: r.data as T[],
            pagination: {
                ...p,
                hasMore: p.hasMore ?? p.hasNext ?? p.page < p.totalPages,
            },
        };
    }
    const data: T[] = Array.isArray(r) ? r : (r?.data ?? []);
    return {
        data,
        pagination: {
            page: fallbackPage,
            limit: fallbackLimit,
            total: data.length,
            totalPages: 1,
            hasMore: false,
        },
    };
}

/**
 * Page-by-page React Query hook with `keepPreviousData` so pagination doesn't
 * flash the loading state. Filters/sort/pagination params go into both the
 * URL and the queryKey, so React Query dedupes identical requests across
 * components on the same page.
 */
export function usePaginatedQuery<T = unknown, R = PaginatedResult<T>>(
    opts: UsePaginatedQueryOptions<T, R>
) {
    const { endpoint, queryKey, params, fields, enabled = true, staleTime, select } = opts;

    const finalParams = useMemo(() => {
        const merged: Record<string, unknown> = { ...params };
        if (fields) merged.fields = fields;
        // Strip undefined/empty so cache key is stable
        for (const k of Object.keys(merged)) {
            const v = merged[k];
            if (v === undefined || v === null || v === '' || v === 'all') delete merged[k];
        }
        return merged;
    }, [params, fields]);

    const page = (finalParams.page as number | undefined) ?? 1;
    const limit = (finalParams.limit as number | undefined) ?? 20;

    const query = useQuery<PaginatedResult<T>, Error, R>({
        queryKey: [...queryKey, finalParams],
        queryFn: async () => {
            const res = await api.get(`/${endpoint}`, { params: finalParams });
            return normalizeResponse<T>(res.data, page, limit);
        },
        enabled,
        staleTime,
        placeholderData: keepPreviousData,
        select: select as UseQueryOptions<PaginatedResult<T>, Error, R>['select'],
    });

    return query;
}

/**
 * Infinite-scroll variant. Pair with `<VirtualList onEndReached={fetchNextPage}>`
 * for endless lists (audit log, sales history) without loading the full table
 * into memory.
 */
export function useInfiniteList<T>(opts: Omit<UsePaginatedQueryOptions<T, never>, 'select'>) {
    const { endpoint, queryKey, params, fields, enabled = true, staleTime } = opts;

    const baseParams = useMemo(() => {
        const merged: Record<string, unknown> = { ...params };
        if (fields) merged.fields = fields;
        for (const k of Object.keys(merged)) {
            const v = merged[k];
            if (v === undefined || v === null || v === '' || v === 'all') delete merged[k];
        }
        delete merged.page;
        return merged;
    }, [params, fields]);

    return useInfiniteQuery({
        queryKey: [...queryKey, 'infinite', baseParams],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            const res = await api.get(`/${endpoint}`, {
                params: { ...baseParams, page: pageParam },
            });
            return normalizeResponse<T>(res.data, pageParam as number, (baseParams.limit as number) || 20);
        },
        getNextPageParam: (last) =>
            last.pagination.hasMore || (last.pagination.page < last.pagination.totalPages)
                ? last.pagination.page + 1
                : undefined,
        enabled,
        staleTime,
    });
}
