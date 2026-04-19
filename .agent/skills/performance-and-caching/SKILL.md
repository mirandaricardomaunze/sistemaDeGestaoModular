---
name: performance-and-caching
description: "Guidelines and rules for Performance Optimization, Caching, and Database Efficiency in the Multicore system."
---

# ⚡ Performance & Caching Standards

> 🤖 **AI INSTRUCTION (MANDATORY)**: You MUST ensure that all database queries are efficient. Prevent N+1 queries, mandate pagination, and suggest Redis caching for heavy reads. 

This skill ensures the Multicore system remains fast and responsive, capable of safely managing large-scale data and concurrent requests without degrading the user experience.

## 1. Database Queries & Prisma (Efficiency)

- **Avoid N+1 Problems**: 
  - Never run a query inside a `for` or `map` loop.
  - Always use Prisma's `include` to fetch relations, but be cautious of fetching massive trees. Break down massive includes into separate indexed queries if needed.
- **Pagination Required**: 
  - Endpoints that list data (e.g., `GET /products`, `GET /sales`) MUST implement pagination (using `skip`/`take` in Prisma) and receive parameters validated by Zod.
  - No endpoint should ever return "all" rows of a table without safeguards.
- **Indexes (`@@index`)**:
  - Fields used frequently in `where` clauses (like `companyId`, `createdAt`, `status`, `sku`) must be indexed in `schema.prisma`. 

## 2. Caching Strategy (Redis)

- **When to Cache**:
  - Cache reading heavy, slowly changing data (e.g., Tenant Settings, Product Categories, Roles & Permissions).
  - Cache results of complex aggregate reports/dashboards that don't need real-time accuracy.
- **Cache Invalidation**:
  - A cache is only as good as its invalidation strategy. When a mutation (Create/Update/Delete) occurs on a cached entity, the Service MUST clear or update the relevant Redis keys immediately.
- **TTL (Time to Live)**:
  - All cached items MUST have a TTL. Do not store eternal keys unless absolutely required by the business logic.

## 3. Frontend Caching (TanStack Query)

- **Standardization**: Use `useQuery` for all data retrieval and `useMutation` for data modifications.
- **Keys Management**: Use structured and consistent `queryKeys` (e.g., `['products', companyId, filters]`).
- **Optimized Loading**: 
  - Use `staleTime` and `cacheTime` (gcTime) to minimize redundant network requests.
  - Implement **Optimistic Updates** for high-priority actions (e.g., ticking a checkbox, toggling status) to make the UI feel instantaneous.
- **Background Sync**: Leverage `refetchOnWindowFocus` and `refetchInterval` for critical dashboards (like Real-time Sales or Logistics Tracking).

## 3. Asynchronous & Background Jobs

- **Non-Blocking Operations**:
  - Heavy operations (e.g., generating large PDFs, sending bulk emails, calculating end-of-month financial reports) MUST NOT block the main HTTP thread.
  - Offload these tasks to BullMQ (Background Workers) using Redis.
- **Webhooks & External APIs**:
  - When communicating with external APIs (like M-Pesa or integrations), handle timeouts defensively. Fail gracefully and queue retries if needed.

## 4. Performance Enforcement Checklist

1. [ ] Is the list endpoint paginated?
2. [ ] Are there any hidden N+1 queries in loops?
3. [ ] Are frequently accessed tables/columns indexed properly in Prisma?
4. [ ] Should this heavy read query be cached in Redis? If yes, is the invalidation logic correct?
5. [ ] Does this operation block the HTTP thread unnecessarily?
