---
name: multicore
description: "Senior-level development standards and architectural guide for the Multicore modular management system."
---

# Multicore System Skill

This skill defines the high-level architecture, professional coding standards, and performance rules for the Multicore project. Every interaction with this codebase MUST follow these principles to ensure a professional, clean, and high-performance system.

## 🏗️ Architecture Overview

The system is a modular multi-tenant ERP/Management platform.

- **Backend**: Node.js/Express with TypeScript. 
  - **ORM**: Prisma (PostgreSQL).
  - **Pattern**: Modular Services. Controllers are thin; logic resides in `src/services/`.
  - **Auth**: JWT-based with Tenant (Company) isolation. Every query MUST filter by `companyId`.
- **Frontend**: React (Vite) with TypeScript.
  - **State**: Zustand for global state management.
  - **Styling**: TailwindCSS for a premium, responsive UI.
  - **Optimization**: Lazy loading of all route-level components.

## 👑 Senior & Professional Rules

### 1. Clean Code & SOLID
- **Thin Controllers**: Controllers only handle request validation and response formatting.
- **Fat Services**: All business logic, DB interactions, and calculations live in Services.
- **Meaningful Naming**: Constants, variables, and functions must be descriptive (e.g., `calculateTotalProfit` not `calcTot`).
- **DRY (Don't Repeat Yourself)**: Extract common logic to `utils` or shared service methods.

### 2. Performance First (Speed)
- **Aggregations at DB Level**: Never fetch all records to sum or count them in JS. Use Prisma's `aggregate`, `groupBy`, and `count`.
- **Pagination**: All list endpoints MUST implement server-side pagination (`skip`, `take`).
- **Efficient Indexing**: Ensure foreign keys and search columns are indexed in Prisma schema.
- **Lazy Loading**: Use `Suspense` and `lazy` for all frontend modules to keep the initial bundle small.

### 3. Atomic & Robust Operations
- **Transactions**: Use `prisma.$transaction` for any operation involving financial records or stock movements to ensure data integrity.
- **Validation**: Strict Zod validation for all incoming API data.
- **Error Handling**: Use the global error handler middleware. Never leave `try-catch` blocks empty.

### 4. Technical Conventions
- **Naming**: `camelCase` for variables/functions, `PascalCase` for classes/types, `UPPER_SNAKE_CASE` for constants.
- **Directory Structure**:
  - `backend/src/services/`: Business logic.
  - `backend/src/routes/`: API endpoint definitions.
  - `src/components/ui/`: Reusable primitive components.
  - `src/pages/[module]/`: Feature-specific pages.

## 💊 Module Specific Rules

- **Pharmacy**: Handle batches and expiry dates strictly. Any sale must decrement stock at the batch level.
- **Bottle Store**: Manage returnables and specific tax rules.
- **Fiscal**: Ensure compliance with local tax regulations (Mozambique/IVA).
- **Logistics**: Focus on route optimization and real-time tracking (Socket.io).

## 🚀 Speed Checklist
1. Is it paginated?
2. Are filters applied at the DB level?
3. Is history/audit trail recorded?
4. Is it mobile-responsive?
