export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}

/**
 * Extract pagination parameters from request query
 */
export function getPaginationParams(query: any): { page: number; limit: number; skip: number } {
    const pageRaw = parseInt(query.page as string);
    const limitRaw = parseInt(query.limit as string);
    const page = isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
    const limit = isNaN(limitRaw) ? 50 : Math.min(2000, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
}

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(
    page: number,
    limit: number,
    total: number
): PaginationMeta {
    const totalPages = Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
): PaginatedResponse<T> {
    return {
        data,
        pagination: buildPaginationMeta(page, limit, total),
    };
}

/**
 * Parse comma-separated `fields` query param into a Prisma select object.
 * Returns null when the caller did not request specific fields, signalling
 * "use the default include/select".
 *
 * Example:
 *   ?fields=id,name,price       -> { id: true, name: true, price: true }
 *   ?fields=id,supplier.name    -> { id: true, supplier: { select: { name: true } } }
 *
 * The `allowed` set is mandatory: any field outside the allowlist is dropped
 * to prevent clients from probing private columns. The primary key is always
 * forced into the projection so React Query can keep stable cache entries.
 */
export function parseFields(
    raw: unknown,
    allowed: ReadonlyArray<string>,
    primaryKey: string = 'id'
): Record<string, any> | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;

    const allowSet = new Set(allowed);
    const select: Record<string, any> = {};

    for (const token of raw.split(',').map(s => s.trim()).filter(Boolean)) {
        if (!allowSet.has(token)) continue;
        if (token.includes('.')) {
            const [parent, child] = token.split('.', 2);
            if (!select[parent] || select[parent] === true) {
                select[parent] = { select: {} };
            }
            select[parent].select[child] = true;
        } else {
            select[token] = true;
        }
    }

    if (Object.keys(select).length === 0) return null;
    select[primaryKey] = true;
    return select;
}

