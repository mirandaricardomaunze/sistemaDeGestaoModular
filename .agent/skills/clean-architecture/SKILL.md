---
name: clean-architecture
description: "Guidelines and rules for Clean Architecture, Clean Code, DRY, Separation of Concerns, and Layered Architecture."
---

# Clean Architecture & Clean Code Principles

This skill enforces high-quality software engineering practices across the codebase. You MUST apply these principles in all code modifications and creations.

## 🏛️ Layered Architecture & Separation of Concerns

A strict separation of concerns is required. Do not mix responsibilities between layers.

1. **Presentation/Route Layer (Controllers/Routes)**:
   - Responsible ONLY for handling HTTP requests, responses, and routing.
   - Parses inputs, calls Services, and formats outputs.
   - **DO NOT** put business logic or direct database calls here.

2. **Business/Domain Layer (Services)**:
   - Contains core business logic, calculations, and rules.
   - Orchestrates data flow but does NOT know about HTTP (req/res).
   - Validation should focus on business rules.

3. **Data Access Layer (Repositories/Prisma)**:
   - Handles all database queries (Prisma).
   - Services should call Prisma to fetch/save data.
   - Keep complex queries contained and well-commented.
   - Do not leak database-specific errors directly to the client.

4. **Cross-Cutting Concerns**:
   - Error handling, logging, caching, and authentication (middlewares) should be cleanly separated from the core business flow.

5. **Shared Calculation & Normalization Utilities**:
   - Money, IVA, percentage, rounding, and numeric normalization rules must live in reusable utilities or domain services, not inline inside JSX components or route handlers.
   - Frontend components may display calculated values, but calculations should come from hooks/utilities with a single shared formula.
   - Backend services remain the final authority for financial calculations and must recalculate totals using trusted database/configuration data.
   - Normalize boundary values once when they enter the calculation layer. Example: convert `companySettings.ivaRate` from `"16"` to `16` before calling percentage helpers.
   - Keep frontend preview formulas aligned with backend formulas: `total = subtotal - discount + tax`.

## 🧼 Clean Code

- **Meaningful Names**: Use descriptive and intention-revealing names for variables, functions, and classes. Avoid abbreviations.
  - *Bad*: `let d = 5;` -> *Good*: `let daysUntilExpiry = 5;`
- **Small Functions**: Functions should do **ONE** thing and do it well (Single Responsibility Principle). If a function is too long, break it down.
- **Fewer Arguments**: Limit function parameters (ideally 0-2). Use an options object if you need more parameters.
- **Fail Fast**: Return early to avoid deep nesting (Guard Clauses).
  - *Bad*: `if (valid) { if (exists) { ... } }` -> *Good*: `if (!valid) return; if (!exists) return; ...`
- **Self-Documenting Code**: Write code that is easy to read. Use comments only to explain *why* something complex is done, not *what* it does. The code itself should explain *what* it is doing.

### 🏷️ Naming Conventions (Strictly Followed)
- **Files & Folders**: Use **camelCase** for ALL files and directories.
  - *Good*: `inventoryList.tsx`, `useInventory.ts`, `authService.ts`.
  - *Bad*: `inventory-list.tsx`, `InventoryList.tsx`.
- **React Components**: Use **PascalCase** for the component name within the file.
  - *Example*: `export function InventoryList() { ... }` in `inventoryList.tsx`.
- **Hooks**: Use **camelCase** starting with `use`.
  - *Example*: `export function useInventory() { ... }` in `useInventory.ts`.
- **API Services**: Use **camelCase** ending with `API`.
  - *Example*: `export const salesAPI = { ... }` in `salesAPI.ts` or `sales.api.ts`.
- **Booleans**: Start with `is`, `has`, `can`, `should`. (e.g., `isValid`, `hasPermission`).
- **Functions**: Use verb-noun pairs. (e.g., `fetchUser`, `calculateTotal`).
- **Classes/Types**: Use **PascalCase** nouns. (e.g., `SalesService`, `UserCredentials`).
- **Constants**: Use **UPPER_SNAKE_CASE**. (e.g., `MAX_RETRY_ATTEMPTS`).

## 🚀 Senior Methodology: Feature Implementation Lifecycle

Every new feature or module MUST follow this 6-step lifecycle to ensure professional architecture and maintainability.

1.  **Step 1: Type Specification**: Define domain models and interfaces in `src/types/[module].ts`. These are the "source of truth".
2.  **Step 2: Backend Domain Logic**:
    - Define Zod schemas in `src/validation/`.
    - Implement the business logic in `src/services/[module].service.ts`.
    - Expose via `src/routes/[module].routes.ts` (keeping the route layer "thin").
3.  **Step 3: API Service Declaration**: Define the frontend client call in `src/services/api/[module].api.ts`.
4.  **Step 4: Business Logic Hook**: Wrap API calls in TanStack Query hooks in `src/hooks/[module].ts`. This hook manages state, caching, and invalidation.
5.  **Step 5: Atomic UI Components**: Build or update Atoms, Molecules, and Organisms in `src/components/ui/` or module-specific card components.
6.  **Step 6: Page Orchestration**: Assemble everything in the main page file in `src/pages/[module]/`.

### Financial Calculation Placement

- Put pure money helpers in `src/utils/` when reusable across modules (`toCents`, `toMoney`, `applyPercent`, rounding, normalization).
- Put UI-facing derived values in hooks/pages only when they compose helpers and state.
- Put authoritative financial rules in backend services, inside transactions when persistence is involved.
- Do not duplicate IVA formulas in multiple components. Components such as cart panels, payment modals, and receipts must receive already-derived `subtotal`, `tax`, and `total` values or call the same helper.
- If a visible label says `IVA (16%)` but the amount is `0`, inspect data type normalization at the calculation boundary before changing UI markup.

---

## ♻️ DRY Code (Don't Repeat Yourself)

- **Rule of Three**: If you write the same logic twice, it's okay. When you write it a third time, you **MUST** refactor it into a reusable helper, hook, or utility.
- Extract repeated logic into helper functions, utilities, or shared services.
- If you find yourself copying and pasting code, refactor it into a reusable and generic component.
- Use constants for magic numbers and strings that appear multiple times.
- Centralize TypeScript types and interfaces in dedicated files (`src/types/[module].ts`) for every module. These types MUST be shared between the API layer and the frontend hooks to ensure end-to-end type safety.

## 🧩 SOLID Principles Focus
- **Single Responsibility Principle (SRP)**: Each class/module/function should have only one reason to change.
  - *Example*: A `PDFGenerator` should only generate PDFs, not calculate the business logic for the data it's printing. Pass the pre-calculated data to it.
- **Open/Closed Principle (OCP)**: Code should be open for extension but closed for modification.
- **Dependency Inversion**: Rely on abstractions/types rather than concrete implementations where possible to decouple modules.

## 🔠 Type Safety (No `any`)

> 🤖 **AI INSTRUCTION (MANDATORY)**: NEVER write `any` in new code. ESLint enforces `@typescript-eslint/no-explicit-any: error`. If you find yourself reaching for `any`, stop and apply one of the patterns below.

### Why this matters
`any` disables type-checking on the value, which in this codebase has repeatedly **hidden real bugs**:
- `where: any` masked a query against a non-existent column (`receiptNumber` vs `saleNumber`).
- `(item as any).costPrice` made it look like a missing field needed a fallback when the field already existed on the Prisma model.
- `data as any` covered up a hook/API type mismatch where the backend returned `{ date, total }` but the hook declared `{ date, amount, count }`.

`any` is not a shortcut — it's a *bug-hiding mechanism*.

### Patterns to use instead

**Backend (Prisma)**:
- `Prisma.<Model>WhereInput` for filter objects, `Prisma.DateTimeFilter` for date ranges.
- `Prisma.<Model>UncheckedCreateInput` / `UncheckedUpdateInput` when you need to pass `companyId` directly.
- Import Prisma enums (`EmployeeRole`, `MaritalStatus`, `InvoiceStatus`, etc.) from `@prisma/client` and cast strings explicitly: `role as EmployeeRole`.
- `Prisma.InputJsonValue` for JSON fields, never `any`.
- In `$transaction(async (tx) => ...)`: let TS infer `tx`. NEVER `tx: any`.

**Backend (Express handlers)**:
- Local `type ListQuery = { page?: string|number; limit?: string|number; search?: string; ... }` for query objects.
- Reuse Zod-inferred types: `import type { CreateInvoiceInput } from '../validation/...'`.
- For catch blocks: `catch (err) { const apiErr = err as Error & { response?: { ... } } }` — never `catch (err: any)`.

**Frontend (React)**:
- Centralize domain types in `src/types/[module].ts` and import them. If a hook returns data with a shape, the type should live in the types module, not be redefined per page.
- For React events: `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent`, or `import type { ChangeEvent } from 'react'`.
- For icon components: `type IconComponent = ComponentType<SVGProps<SVGSVGElement>>`.
- For Badge variants and other UI unions: import the literal-union type (`BadgeVariant`) from the component file.
- For reusable filter/control components that accept literal unions: make them generic `<T extends string>` instead of using `value={x as any}`.

**Last-resort escape hatches** (in order of preference):
1. `unknown` + a type guard or narrow cast at the boundary.
2. `Record<string, unknown>` for opaque JSON blobs.
3. `as SpecificType` cast — but only when you've verified the runtime shape (e.g. just after a Zod parse).
4. `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining the library limitation. Keep the exception to a single line.

### Banned patterns (auto-reject in review)

- `: any` parameter type, return type, or variable annotation.
- `as any` — except when chained as `as unknown as T` to cross unrelated structural types, and even then only at well-justified boundaries.
- `any[]`, `Array<any>`, `Record<string, any>`, `Promise<any>`.
- `(x as any).field` to access a property the type doesn't expose — fix the type instead, the missing field is usually a real bug.
- `catch (e: any)` — use `catch (e)` and narrow `e` with `instanceof Error` or a typed cast.

### When a hook type doesn't match what the backend returns

The fix is **always** in this order:
1. Read the backend service/route and confirm the actual response shape.
2. Update the hook's `useQuery<T>` generic to match reality.
3. Update the page to use the correct fields.
*Never* add `as any` to "make TypeScript shut up" — that's how the next bug ships.

## 🛡️ Reliability & Error Handling

- **Custom Error Classes**: Use standard HTTP error classes (e.g., `NotFoundError`, `BadRequestError`, `UnauthorizedError`) rather than returning generic 500s.
- **Fail Gracefully**: The system must never crash on expected user errors. Catch exceptions at the boundary (Controller/Middleware) and return formatted JSON responses.
- **Do Not Swallow Errors**: If you catch an error (`catch (e)`), you MUST handle it, log it, or rethrow it. Never leave an empty catch block.

## 🔒 Security & Data Integrity

- **Validation First**: Never trust client inputs. Always pass data through strict Zod validators before it reaches the Service layer.
- **No Over-fetching/Mass Assignment**: Never return the entire Prisma model directly to the client if it contains sensitive data (e.g., passwords, internal IDs). Select only needed fields. Never blindly `...req.body` into a database update.

## 🤖 AI SYSTEM INSTRUCTION (MANDATORY ENFORCEMENT)

As an AI Assistant, you are strictly bound to these rules. Every single time you generate, modify, or suggest code for this project, you **MUST** ensure it passes all the rules defined in this file. If the user requests code that violates these rules (e.g., asking to put business logic in a route), you must politely correct the approach and deliver the Clean Architecture version instead. 

## 🚀 Quality Enforcement Checklist

1. [ ] Is the separation of concerns strictly respected? (No business logic in routes/controllers).
2. [ ] Are functions doing more than one thing? (If yes, break them down).
3. [ ] Are there any hardcoded values, magic strings, or duplicated code blocks? (Extract them).
4. [ ] Is the code deeply nested? (Extract logic or use early returns/guard clauses).
5. [ ] Are variables and functions named clearly enough that comments are not necessary to explain what they do?
6. [ ] Are all inputs validated using Zod schemas before being processed?
7. [ ] Are errors being properly caught, handled, and returned with correct HTTP status codes?
8. [ ] Are financial calculations centralized in helpers/services instead of duplicated in UI components?
9. [ ] **Is the code free of `any`?** No `: any`, `as any`, `any[]`, `Record<string, any>`, or `catch (e: any)` in new code. Prisma types / Zod-inferred types / domain interfaces are used at all boundaries.
10. [ ] Has the AI independently verified that this change adheres to the Clean Architecture guidelines before finalizing?
