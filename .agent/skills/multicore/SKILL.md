---
name: multicore
description: "Senior-level development standards and architectural guide for the Multicore modular management system."
---

# Multicore System Skill

> 🤖 **AI INSTRUCTION (MANDATORY)**: You must analyze this skill file and the following core skill files **BEFORE** suggesting, generating, or modifying any code in this project:
> 1. `clean-architecture` (Architecture & Core Principles)
> 2. `security-and-auth` (Authentication, AuthZ, Data Integrity)
> 3. `testing-standards` (Unit Testing, Mocks, Coverage)
> 4. `performance-and-caching` (DB Efficiency, Redis, Background Jobs)
> 5. `observability-and-logs` (Audit Trails, Structured Logging)
> 6. `ui-ux-design` (Premium Layouts, TailwindCSS, Responsiveness)

All code you produce MUST comply with the rules defined across these skills. If a user requests something that violates these rules, you must politely decline and offer the compliant alternative.

This skill defines the high-level architecture, professional coding standards, and performance rules for the Multicore project. Every interaction with this codebase MUST follow these principles to ensure a professional, clean, and high-performance system.

## 🏗️ Architecture Overview

The system is a modular multi-tenant ERP/Management platform.

- **Backend**: Node.js/Express with TypeScript. 
  - **ORM**: Prisma (Postgres/MySQL). Always use transactions for critical operations.
  - **Pattern**: Modular Services. Controllers in `src/routes/` are thin; logic resides in `src/services/`.
  - **Auth**: JWT-based with Tenant (Company) isolation via `tenant.ts` middleware. Every query MUST filter by `companyId`.
  - **Async Processing**: Redis + BullMQ for background tasks (queues/workers).
  - **Integrations**: M-Pesa API, Telegram Bot, Google Drive (backups), and SMTP (emails).
- **Frontend**: React (Vite) with TypeScript.
  - **State**: Zustand for global stores (`src/stores/`).
  - **Styling**: TailwindCSS with premium aesthetics (glassmorphism, modern gradients).
  - **I18n**: Multilingual support using `i18next`.
  - **Persistence**: Dexie.js for local database if needed.

## 👑 Senior & Professional Rules

*Note: Always apply the principles defined in the `clean-architecture` skill (Clean Code, DRY, Separation of Concerns, Layered Architecture) in conjunction with these rules.*

### 1. Multi-Tenancy (Tenant Isolation)
- **Primary Rule**: No data from Company A should EVER be visible to Company B.
- **Implementation**: The `req.tenantId` (or `companyId`) set by the `tenant` middleware MUST be used in every Prisma query.
- **Data Scoping (originModule)**: For metrics and documents (Orders, Invoices, Stock), always support and pass the `originModule` parameter to ensure data is correctly scoped to the active module (e.g., 'commercial', 'pharmacy', 'hospitality').
- **Audit Trail**: Every action that modifies data must be recorded using the `audit` middleware/service.

### 2. Modular Specialization (Wrapper Pattern)
- **Shared Components**: When using components shared across modules (e.g., Clientes, Encomendas), prefer the **Specialized Wrapper** pattern.
- **Implementation**: Create a module-specific file (e.g., `CommercialInvoices.tsx`) that renders the shared component (e.g., `Invoices.tsx`) with pre-configured props like `originModule`. Register these specialized routes in `main.tsx`.

### 2. Backend Design Patterns
- **Validation**: All incoming requests MUST be validated with **Zod** schemas in `src/validation/`.
- **Services**: All business logic goes into services (e.g., `sales.service.ts`). Services should be stateless where possible.
- **Error Handling**: Use the central `error.middleware.ts`. Throw custom errors with appropriate HTTP status codes.
- **Logging**: Use the implemented `winston` logger for all production logs.

### 3. Backend Response Standards (Result Pattern)
- **Standardized Output**: All backend services and controllers SHOULD return a consistent result pattern to simplify frontend handling:
  ```typescript
  { success: boolean; data?: T; error?: string; message?: string }
  ```
- **Prisma Transactions**: Use `prisma.$transaction` for any operation involving financial records or stock movements. Avoid large nested `include` blocks; prefer targeted queries.

### 4. Frontend Conventions (Strict SRP)
- **File Naming**: All files and folders MUST use camelCase (e.g., `inventoryList.tsx`).
- **Hooks (Logic Layer)**: Custom hooks MUST handle all API interactions, data transformations, and local state.
- **Components (UI Layer)**: Components should be "pure" UI. NO direct API calls or complex logic inside the JSX file. If a component grows too complex, extract child components (Atoms/Molecules).
- **Optimization**: Use `Suspense` and `lazy` for page-level imports. Keep components small.

### 5. CI/CD & Automated Enforcement
- **Linting & Formatting**: Ensure code is completely free of ESLint errors and is formatted correctly (Prettier) before considering a task "done". No `console.log` in production code.
- **Strict Type Safety**: The project must build without any TypeScript (`tsc`) errors. Fixed any `any` types by providing proper interfaces. **Explicit use of `as any` is forbidden** unless documented with a `@ts-ignore` and a valid reason.
- **Frontend State Management (TanStack Query v5)**:
  - All server-side data fetching MUST use **TanStack Query v5** hooks.
  - **Single Hook File per Module**: Business logic MUST be centralized in a dedicated hook file (e.g., `src/hooks/useLogistics.ts`).
  - **No Manual Data Fetching**: `useEffect` and `useState` for API data fetching are strictly forbidden.
  - **Centralized Types**: Every module MUST have its types defined in a dedicated file (e.g., `src/types/logistics.ts`) consumed by both the API service and the hooks.
  - **Loading Boundaries**: Mandatory use of **Skeleton Loaders** for all initial dashboard loading states.
  - **Integrated Refetching**: Dashboards must provide a manual "Refresh" button that triggers `queryClient.invalidateQueries` or hook-level `refetch`.

## 💊 Module Specific Rules

- **Commercial (Retail/PDV)**:
  - **POS Shift Binding**: Every POS terminal MUST be bound to a warehouse upon opening a shift to ensure accurate stock deduction.
  - **Quote-to-Sale**: Support seamless conversion of Quotations to POS sales by passing state via `location.state`.
  - **Pricing**: Implement bulk price adjustment tools (percentage/fixed) with category filtering.
  - **Cash Management**: Every PDV must support cash movements (Sangria/Suprimento) tracked within the shift session.
- **Pharmacy**: Handle batches and expiry dates strictly. Sales must decrement stock at the batch level.
- **Hospitality (Hotel)**: Manage rooms, reservations, and public booking states. Integration with finance for invoicing.
- **Bottle Store**: Handle returnables (garrafas vazias) and inventory specific to beverages.
- **Fiscal/Financial**: Ensure compliance with local regulations (IVA, Invoicing). All calculations must be precision-safe.
- **Logistics**: Manage routes, drivers, and delivery statuses.

## 🚀 Quality Checklist
1. **Tenant ID**: Is the query filtered by `companyId`?
2. **Validation**: Is there a Zod schema for this request?
3. **Audit**: Is this action tracked in the audit trail?
4. **Performance**: Is the query paginated and indexed?
5. **UI**: Does it maintain the premium design system and responsiveness?
6. **I18n**: Are all strings localized in the translation files?
7. **Clean Code**: Is the code DRY, using guard clauses, and following single responsibility?
8. **Layered Architecture**: Is business logic strictly in services and out of controllers?
