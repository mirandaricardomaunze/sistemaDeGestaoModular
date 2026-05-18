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

## 3. Frontend State Management & Caching (TanStack Query vs Zustand)

> 🚫 **STRICT RULE**: NEVER use Zustand (or any global store) to fetch, store, or locally paginate massive lists of data (like Audit Logs, Products, Invoices). 

- **Zustand Responsibilities**:
  - Only use Zustand for **client-side state**: UI preferences, user authentication, side-menu toggles, offline action queues (`pendingSync`), and user configurations.
- **TanStack Query (React Query) Responsibilities**:
  - Use `useQuery`, `useInfiniteQuery`, or `usePaginatedQuery` for ALL database retrievals (`GET`).
  - Use `useMutation` for ALL data modifications (`POST`, `PUT`, `DELETE`).
- **Server-Side Pagination is Mandatory**:
  - Pass `page` and `limit` to `usePaginatedQuery` along with filters. The API must receive these and use Prisma's `skip` and `take`.
  - Deduping requests: React Query naturally handles caching. If 5 components need the same list, they all call `useQuery(sameKey)`, and only 1 network request is made.
- **Keys Management**: Use structured and consistent `queryKeys` (e.g., `['products', filters, pagination]`).
- **Optimized Loading**: 
  - Use the `isPlaceholderData` flag from React Query to keep the UI stable while fetching the next page, preventing layout shifts.
  - Implement **Optimistic Updates** for high-priority actions (e.g., ticking a checkbox, toggling status) to make the UI feel instantaneous.
- **Background Sync**: Leverage `refetchOnWindowFocus` and `refetchInterval` for critical dashboards (like Real-time Sales or Logistics Tracking).

## 3. Asynchronous & Background Jobs

- **Non-Blocking Operations**:
  - Heavy operations (e.g., generating large PDFs, sending bulk emails, calculating end-of-month financial reports) MUST NOT block the main HTTP thread.
  - Offload these tasks to BullMQ (Background Workers) using Redis.
- **Webhooks & External APIs**:
  - When communicating with external APIs (like M-Pesa or integrations), handle timeouts defensively. Fail gracefully and queue retries if needed.

## 4. Catalog Loading, Pagination Caps & Initial Page Load

> 🚫 **STRICT RULE**: Never request `limit > 2000` from a single endpoint. The backend hard-caps requests at 2000 ([backend/src/utils/pagination.ts](../../../backend/src/utils/pagination.ts)). Asking for more is silently truncated and creates phantom bugs (e.g. "POS only shows 100 products").

### 4.1 Backend pagination cap
- The cap lives in `getPaginationParams()`: `Math.min(2000, ...)`. Default page size is **50** when client omits `limit`.
- If a real workload legitimately needs more than 2000 rows in one call, do NOT raise the cap — paginate on the client (loop `page=1,2,…`) or build a dedicated bulk endpoint with streaming.
- Any change to the cap must be co-ordinated with every caller passing `limit: 5000` or similar.

### 4.2 POS / catalog loaders (heavy "near-full catalog" callers)
- POS (`CommercialPOS`, `PharmacyPOS`, `BottleStorePOS`, `RestaurantPOS`) loads catalog with `limit: 2000` and uses **client-side search** + local pagination (12–24 cards/page). This is the documented pattern for stores up to ~2000 SKUs.
- For stores beyond 2000 SKUs, add **server-side debounced search** (`?search=`) — never raise the cap.
- Offline catalog prefetch ([catalogPrefetch.ts](../../../src/services/offline/catalogPrefetch.ts)) keeps the IndexedDB warm: same 2000 cap; if needed, loop pages.

### 4.3 Initial page load (don't block boot)
- Background prefetches (offline catalog, dashboards-on-login) MUST be deferred via `requestIdleCallback` (fallback `setTimeout`). Never run them synchronously inside `useEffect` on app mount — they delay first paint and the login → home transition.
- Code splitting via `React.lazy()` is mandatory for every page. The `main.tsx` route tree already follows this; new pages must too.

### 4.4 Virtualization for long lists
- Any list/table rendering **>200 rows** must use [VirtualTable](../../../src/components/ui/VirtualTable.tsx) / [VirtualList](../../../src/components/ui/VirtualList.tsx). Beyond ~500 DOM rows the browser jank is visible on low-end devices.
- The POS product grid is exempt because it paginates locally to 12/page.

### 4.5 Boot-time bundle (first paint)
- **i18n**: apenas o idioma `fallbackLng` (PT) é embebido eagerly. Restantes locales são chunks dinâmicos carregados pelo `languageChanged` listener em [src/i18n/index.ts](../../../src/i18n/index.ts). NUNCA importar locales adicionais estaticamente.
- **Realtime effects** (`useNotifications`, `useRealtimeSync`): wrapped no componente `AppRealtimeEffects` lazy em [src/components/app/AppRealtimeEffects.tsx](../../../src/components/app/AppRealtimeEffects.tsx). Adicionar novos efeitos globais aqui, não no `AppContainer`.
- **DevTools**: o `ReactQueryDevtools` carrega apenas em `import.meta.env.DEV`. Manter assim.
- **Pre-compressed assets**: o build emite `.gz` + `.br` para tudo ≥ 1KB ([vite.config.ts](../../../vite.config.ts) — `vite-plugin-compression2`). O `nginx.conf` tem `gzip_static on;` e `brotli_static on;` (sob comentário até instalar o módulo `ngx_brotli`). Não desactivar.

### 4.6 List-call audit rules
When reviewing or adding a list call:
1. Does the API support `page` + `limit`?
2. Does the UI expose pagination / infinite scroll, or does it dump everything?
3. If `limit > 100`: is the call **really** needed for the workflow, or could server-side search/filter avoid it?
4. If the response feeds a table, is it virtualized when >200 rows?

## 5. Performance Enforcement Checklist

1. [ ] Is the list endpoint paginated?
2. [ ] Are there any hidden N+1 queries in loops?
3. [ ] Are frequently accessed tables/columns indexed properly in Prisma?
4. [ ] Should this heavy read query be cached in Redis? If yes, is the invalidation logic correct?
5. [ ] Does this operation block the HTTP thread unnecessarily?
