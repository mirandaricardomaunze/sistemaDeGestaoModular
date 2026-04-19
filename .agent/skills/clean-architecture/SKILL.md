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
8. [ ] Has the AI independently verified that this change adheres to the Clean Architecture guidelines before finalizing?
