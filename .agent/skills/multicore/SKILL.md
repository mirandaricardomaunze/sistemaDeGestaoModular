---
name: multicore
description: "Senior-level development standards and architectural guide for the Multicore modular management system."
---

# Multicore System Skill

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

### 1. Multi-Tenancy (Tenant Isolation)
- **Primary Rule**: No data from Company A should EVER be visible to Company B.
- **Implementation**: The `req.tenantId` (or `companyId`) set by the `tenant` middleware MUST be used in every Prisma query.
- **Audit Trail**: Every action that modifies data must be recorded using the `audit` middleware/service.

### 2. Backend Design Patterns
- **Validation**: All incoming requests MUST be validated with **Zod** schemas in `src/validation/`.
- **Services**: All business logic goes into services (e.g., `sales.service.ts`). Services should be stateless where possible.
- **Error Handling**: Use the central `error.middleware.ts`. Throw custom errors with appropriate HTTP status codes.
- **Logging**: Use the implemented `winston` logger for all production logs.

### 3. Performance & Scalability
- **Pagination**: All list endpoints MUST implement pagination via `queryParams.ts` validation and Prisma `skip`/`take`.
- **Caching**: Use the `cache.service.ts` (Redis) for frequently accessed, slow-changing data.
- **Database**: Use `prisma.$transaction` for any operation involving financial records or stock movements. Avoid large nested `include` blocks; prefer targeted queries.

### 4. Frontend Conventions
- **Components**: Reusable UI primitives in `src/components/ui/`. Modular features in `src/pages/[Module]`.
- **Hooks**: Business logic in components should be moved to custom hooks (`src/hooks/`).
- **Optimization**: Use `Suspense` and `lazy` for page-level imports. Keep components small.

## 💊 Module Specific Rules

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
