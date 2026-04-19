import { z } from 'zod';

/**
 * Shared Query Parameter Schemas
 */

export const paginationSchema = z.object({
    page: z.string().optional().transform(v => parseInt(v || '1')),
    limit: z.string().optional().transform(v => parseInt(v || '20')),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const searchSchema = z.object({
    search: z.string().optional(),
});

export const dateRangeSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

export const statusFilterSchema = z.object({
    status: z.string().optional(),
    isActive: z.string().optional().transform(v => v === 'true'),
});

export const baseQuerySchema = paginationSchema
    .merge(searchSchema)
    .merge(dateRangeSchema)
    .merge(statusFilterSchema);

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type SearchQuery = z.infer<typeof searchSchema>;
export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type BaseQuery = z.infer<typeof baseQuerySchema>;
