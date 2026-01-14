import NodeCache from 'node-cache';

/**
 * Cache Service for frequently accessed data
 * 
 * Default TTL: 5 minutes
 * Check period: 10 minutes
 */
class CacheService {
    private cache: NodeCache;

    constructor() {
        this.cache = new NodeCache({
            stdTTL: 300, // 5 minutes default
            checkperiod: 600, // Check for expired keys every 10 minutes
            useClones: false, // Better performance
        });

        this.cache.on('set', (key, value) => {
            console.log(`Cache SET: ${key}`);
        });

        this.cache.on('del', (key, value) => {
            console.log(`Cache DEL: ${key}`);
        });

        this.cache.on('expired', (key, value) => {
            console.log(`Cache EXPIRED: ${key}`);
        });
    }

    /**
     * Get value from cache
     */
    get<T>(key: string): T | undefined {
        return this.cache.get<T>(key);
    }

    /**
     * Set value in cache
     */
    set<T>(key: string, value: T, ttl?: number): boolean {
        return this.cache.set(key, value, ttl || 0);
    }

    /**
     * Delete value from cache
     */
    del(key: string | string[]): number {
        return this.cache.del(key);
    }

    /**
     * Check if key exists in cache
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Clear all cache
     */
    flush(): void {
        this.cache.flushAll();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return this.cache.getStats();
    }

    /**
     * Get or set pattern - fetch from cache or execute callback and cache result
     */
    async getOrSet<T>(
        key: string,
        callback: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        const cached = this.get<T>(key);

        if (cached !== undefined) {
            return cached;
        }

        const result = await callback();
        this.set(key, result, ttl);
        return result;
    }

    /**
     * Invalidate cache with pattern
     */
    invalidatePattern(pattern: string): void {
        const keys = this.cache.keys();
        const matchingKeys = keys.filter(key => key.includes(pattern));
        this.cache.del(matchingKeys);
    }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export cache key builders for consistency
export const CacheKeys = {
    // Dashboard
    dashboardMetrics: (companyId: string) => `dashboard:metrics:${companyId}`,
    dashboardSales: (companyId: string, period: string) => `dashboard:sales:${companyId}:${period}`,
    dashboardTopProducts: (companyId: string, limit: number, period: number) =>
        `dashboard:top-products:${companyId}:${limit}:${period}`,

    // Products
    productList: (companyId: string, page: number, filters: string) =>
        `products:list:${companyId}:${page}:${filters}`,
    productById: (companyId: string, id: string) => `product:${companyId}:${id}`,
    productsLowStock: (companyId: string) => `products:low-stock:${companyId}`,
    productsExpiring: (companyId: string, days: number) => `products:expiring:${companyId}:${days}`,

    // Customers
    customerList: (companyId: string, page: number, filters: string) =>
        `customers:list:${companyId}:${page}:${filters}`,
    customerById: (companyId: string, id: string) => `customer:${companyId}:${id}`,

    // Sales
    salesList: (companyId: string, page: number, filters: string) =>
        `sales:list:${companyId}:${page}:${filters}`,
    salesStats: (companyId: string, period: string) => `sales:stats:${companyId}:${period}`,

    // General
    list: (entity: string, page: number, filters?: any) =>
        `${entity}:list:${page}:${JSON.stringify(filters || {})}`,
};

export default cacheService;
