# Known Findings For Sistema

Last broad analysis context:

- Root build passed previously with `npm.cmd run build`.
- Backend typecheck passed previously with `npm.cmd run build:check --prefix backend`.
- Global lint had many errors and warnings, mostly unused variables, empty blocks, irregular whitespace, Node script globals, and hook dependency warnings.
- Backend tests failed because the configured Supabase/Postgres host was unreachable from the environment.
- Frontend Vitest was not useful when run broadly because it picked up backend Jest tests and failed on missing Jest globals.

Important risks:

- `backend/src/lib/prisma.ts` uses a manual `tenantModels` allowlist. It can drift from Prisma models that contain `companyId`; compare against `backend/prisma/schema.prisma` before changing tenant-sensitive code.
- Some frontend code previously used `localStorage.getItem('token')` while the main auth flow uses `auth_token`; check socket and print/export components.
- The repo contains mojibake in user-facing Portuguese strings and documentation. Inspect before bulk-fixing.
- There are production-ish `console.log` calls in backend files and many logs in scripts/tests.

Recent commercial-module intent:

- Commercial dashboard/painel should not show tabs for "Relatorios & IA" or "Margens & Lucro".
- Reports and margins belong in reports navigation or `/commercial/reports`.

Useful searches:

```powershell
rg -n "localStorage\.getItem\(['\""]token['\""]\)" src
rg -n "tenantModels|companyId" backend/src/lib/prisma.ts backend/prisma/schema.prisma
rg -n "console\.log|catch \(.*\) \{\}|catch \{\}" backend/src src
rg -n "Gest..|Relat..rios|n..o|A..o|Ã|Â" src backend CLAUDE.md
```
