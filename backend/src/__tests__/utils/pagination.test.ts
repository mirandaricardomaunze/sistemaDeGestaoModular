import { getPaginationParams, createPaginatedResponse, buildPaginationMeta } from '../../utils/pagination';

describe('getPaginationParams()', () => {
    it('uses defaults when no params given', () => {
        const { page, limit, skip } = getPaginationParams({});
        expect(page).toBe(1);
        expect(limit).toBe(50);
        expect(skip).toBe(0);
    });

    it('parses page and limit from query', () => {
        const { page, limit, skip } = getPaginationParams({ page: '3', limit: '20' });
        expect(page).toBe(3);
        expect(limit).toBe(20);
        expect(skip).toBe(40);
    });

    it('clamps page to minimum 1', () => {
        const { page } = getPaginationParams({ page: '0' });
        expect(page).toBe(1);
        const { page: neg } = getPaginationParams({ page: '-5' });
        expect(neg).toBe(1);
    });

    it('clamps limit to minimum 1', () => {
        const { limit } = getPaginationParams({ limit: '0' });
        expect(limit).toBe(1);
    });

    it('clamps limit to maximum 100', () => {
        const { limit } = getPaginationParams({ limit: '500' });
        expect(limit).toBe(100);
    });

    it('handles non-numeric strings gracefully', () => {
        const { page, limit } = getPaginationParams({ page: 'abc', limit: 'xyz' });
        expect(page).toBe(1);
        expect(limit).toBe(50);
    });

    it('calculates skip correctly for page 2', () => {
        const { skip } = getPaginationParams({ page: '2', limit: '15' });
        expect(skip).toBe(15);
    });

    it('supports default override via pre-set object properties', () => {
        // logisticsService passes { limit: 20, ...query } to override default
        const { limit } = getPaginationParams({ limit: '20' });
        expect(limit).toBe(20);
    });
});

describe('buildPaginationMeta()', () => {
    it('calculates totalPages correctly', () => {
        const meta = buildPaginationMeta(1, 10, 25);
        expect(meta.totalPages).toBe(3);
    });

    it('hasNext is true when more pages exist', () => {
        const meta = buildPaginationMeta(1, 10, 25);
        expect(meta.hasNext).toBe(true);
    });

    it('hasNext is false on last page', () => {
        const meta = buildPaginationMeta(3, 10, 25);
        expect(meta.hasNext).toBe(false);
    });

    it('hasPrev is false on first page', () => {
        const meta = buildPaginationMeta(1, 10, 25);
        expect(meta.hasPrev).toBe(false);
    });

    it('hasPrev is true on page > 1', () => {
        const meta = buildPaginationMeta(2, 10, 25);
        expect(meta.hasPrev).toBe(true);
    });

    it('handles total=0', () => {
        const meta = buildPaginationMeta(1, 10, 0);
        expect(meta.totalPages).toBe(0);
        expect(meta.hasNext).toBe(false);
        expect(meta.hasPrev).toBe(false);
    });

    it('returns correct meta structure', () => {
        const meta = buildPaginationMeta(2, 5, 12);
        expect(meta).toMatchObject({ page: 2, limit: 5, total: 12, totalPages: 3, hasNext: true, hasPrev: true });
    });
});

describe('createPaginatedResponse()', () => {
    it('wraps data with pagination metadata', () => {
        const data = [{ id: 1 }, { id: 2 }];
        const response = createPaginatedResponse(data, 1, 10, 2);
        expect(response.data).toBe(data);
        expect(response.pagination.total).toBe(2);
        expect(response.pagination.page).toBe(1);
    });

    it('returns empty array when no items', () => {
        const response = createPaginatedResponse([], 1, 10, 0);
        expect(response.data).toHaveLength(0);
        expect(response.pagination.totalPages).toBe(0);
    });
});
