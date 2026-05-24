---
name: sistema-ai-decision-panel
description: Maintain and extend the Sistema commercial AI decision panel. Use when Codex works on automatic AI suggestions, commercial dashboard recommendations, decision cards, predictive stock suggestions, Gemini/AI fallback behaviour, /api/commercial/ai-suggestions, or professional context for this feature in c:\Users\miran\Desktop\sistemas.
---

# Sistema AI Decision Panel

## Purpose

Preserve the professional context for the commercial AI decision panel in the local Sistema project. Use this together with `sistema-maintenance`; when touching dashboard UI, also use `frontend-ui-consistency`.

## Current Shape

Read `references/current-implementation.md` before continuing feature work, debugging, or refactoring this panel.

The feature is intentionally a thin decision layer over existing data:

- Backend service: `backend/src/services/commercial/decisionSuggestions.service.ts`
- Backend route: `GET /api/commercial/ai-suggestions`
- Route file: `backend/src/routes/commercial.ts`
- Frontend API: `frontend/src/services/api/commercial.api.ts`
- Frontend hook: `useAIDecisionSuggestions` in `frontend/src/hooks/useCommercial.ts`
- UI location: `frontend/src/pages/commercial/CommercialDashboard.tsx`

## Product Principles

- Make suggestions automatic and actionable, not decorative.
- Prefer short cards with: title, summary, reasoning, priority, confidence, impact, and an action button.
- Use IA/Gemini to refine and rank suggestions when configured.
- Always provide a deterministic rules fallback when IA is unavailable, slow, or returns invalid JSON.
- Never let AI invent dangerous routes or cross-tenant data. Action URLs must come from allowed local suggestions.
- Keep the commercial dashboard clean; do not move reports, margins, or heavy analysis into dashboard tabs.

## Data Signals

Prioritise signals already present in the system:

- Sales: daily/monthly revenue and count.
- Inventory: predictive forecast, low/critical stock, suggested purchase quantity.
- Expiry: product batches expiring within 30 days.
- Finance: overdue customer invoices, pending receivables, supplier invoices due/overdue.
- Operations: cash sessions open too long.
- Suppliers: overdue purchase orders.

## Backend Rules

- Derive `companyId` only from authenticated request context.
- Keep `warehouseId` optional and validated with `commercialWarehouseQuerySchema`.
- Use existing services where useful, especially `predictiveService.getInventoryForecast`.
- Bound AI latency with a timeout.
- Parse AI output as JSON defensively; if parsing fails, return rule suggestions.
- Avoid schema changes unless the user explicitly wants saved/dismissible suggestions.

## Frontend Rules

- Load suggestions automatically on dashboard mount.
- Refresh suggestions with React Query; current interval is 10 minutes.
- Include suggestions in “Actualizar Tudo”.
- Show `IA activa` only when at least one returned card has `source: 'ai'`.
- Show `Regras + fallback` when cards are generated locally.
- Keep cards compact, scan-friendly, and aligned with existing dashboard cards.

## Validation

Use narrow checks first, then broader checks:

```powershell
npm.cmd run build:check --prefix backend
npm.cmd run typecheck --prefix frontend
npm.cmd run build
```

If `npm.cmd run build` fails in sandbox with Vite access errors, rerun with escalation. Treat Vite chunk-size/circular-chunk messages as warnings unless they become hard failures.
