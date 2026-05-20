---
name: sistema-maintenance
description: Maintain, debug, audit, and safely refactor the local Sistema project in c:\Users\miran\Desktop\sistemas. Use for requests in Portuguese or English such as "resolve erros", "analisa o sistema todo", "corrige ate ao fim", commercial module/dashboard changes, build/lint/test failures, Prisma/backend multi-tenant work, auth token issues, mojibake cleanup, and broad repo stabilization.
---

# Sistema Maintenance

## Mission

Work as the project maintainer for this local React/Vite + Express/Prisma system. Prefer finishing concrete fixes end to end: inspect, patch, validate, and explain what remains blocked by environment.

## Start Every Session

1. Check the working tree with `git status --short`; it is often dirty. Never revert user changes unless explicitly requested.
2. Read only the relevant files before editing. Use `rg` first, then targeted `Get-Content`.
3. Keep changes scoped. Avoid broad rewrites unless the user explicitly asks to clean the whole system.
4. Reply in Portuguese unless the user switches language.

## Known Project Commands

Use Windows commands:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run build:check --prefix backend
npm.cmd run test --prefix backend
npx.cmd vitest run src
```

Notes:

- `npm run ...` may fail in PowerShell due execution policy; use `npm.cmd`.
- Backend tests may fail without access to the configured Supabase/Postgres host. Treat DNS/connection failures as environment blockers, not code proof.
- Vitest currently picks backend Jest tests if run too broadly; prefer targeted frontend tests or fix config before trusting it.
- If an important command fails from sandbox/network restrictions, rerun with escalation.

## Current Architecture

- Frontend: React, Vite, TypeScript, Tailwind, React Query, Zustand.
- Backend: Express, Prisma, Socket.IO, BullMQ/Redis, Winston.
- Prisma schema: `backend/prisma/schema.prisma`.
- Tenant guard: `backend/src/lib/prisma.ts`.
- Backend routes: `backend/src/routes`.
- API client/auth token usage: `src/services/api/client.ts`, `src/stores/useAuthStore.ts`.
- Commercial UI entry: `src/pages/commercial/CommercialInsightHub.tsx`.
- Commercial reports: `src/pages/commercial/CommercialReports.tsx`.
- Sidebar navigation: `src/components/layout/Sidebar.tsx`.

## High Priority Fix Order

1. Build/typecheck failures.
2. Authentication inconsistencies, especially stale `localStorage.getItem('token')` instead of `auth_token`.
3. Multi-tenant isolation in `backend/src/lib/prisma.ts`; compare all Prisma models with `companyId` against the tenant-scoped allowlist.
4. Lint errors that indicate real defects: unused variables in active code, empty catch blocks, no-require-imports, irregular whitespace, unused expressions.
5. Test configuration: keep backend Jest and frontend Vitest separate.
6. Mojibake/encoding cleanup after inspecting `scripts/check-mojibake.mjs` and `scripts/fix-mojibake.mjs`; do not blindly bulk-rewrite text.

## Commercial Module Preference

The commercial dashboard must stay clean and simple. Do not put "Relatorios & IA" or "Margens & Lucro" tabs inside the commercial dashboard/painel. Put report and margin links in the reports area or sidebar navigation.

Existing intended shape:

- `/commercial/dashboard` renders the clean dashboard.
- `/commercial/reports` renders commercial reports.
- `/commercial/margins` opens commercial reports with the margins tab selected.

## Editing Rules

- Use `apply_patch` for manual edits.
- Do not create scripts in the repo root unless they are intended to remain. Temporary scripts should be removed or placed clearly.
- Do not remove dirty files or untracked files unless the user asks.
- For frontend UI changes, keep controls aligned and compact; use existing UI components and Tailwind patterns.
- For backend validation, prefer existing Zod/validation helpers.

## Validation Pattern

After fixes, run the narrowest relevant command first, then broader checks:

1. Targeted eslint on touched files.
2. `npm.cmd run build`.
3. `npm.cmd run build:check --prefix backend`.
4. Backend tests only if DB connectivity is available.
5. Frontend tests only if there are real Vitest tests or after excluding backend Jest suites.

Report warnings separately from hard failures.

## Reference

Read `references/known-findings.md` when resuming the broad cleanup or when the user asks to continue from the last full-system analysis.
