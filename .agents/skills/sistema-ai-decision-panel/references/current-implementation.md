# Current Implementation

Last captured: 2026-05-22.

## Goal

The user wants the commercial dashboard to use AI to generate automatic management suggestions. The panel should feel professional and useful for a business manager, not like a static demo widget.

## Implemented Files

- `backend/src/services/commercial/decisionSuggestions.service.ts`
  - Builds real commercial context from Prisma.
  - Creates rule-based candidate suggestions.
  - Calls `aiService.generateResponse` with module `commercial`.
  - Requires JSON array output from AI.
  - Falls back to rule suggestions when AI is unavailable, times out, or returns invalid JSON.

- `backend/src/routes/commercial.ts`
  - Imports `commercialDecisionSuggestionsService`.
  - Adds `GET /api/commercial/ai-suggestions`.
  - Uses existing auth/module middleware and staff roles.
  - Parses `warehouseId` with `commercialWarehouseQuerySchema`.

- `frontend/src/services/api/commercial.api.ts`
  - Adds `AIDecisionSuggestion`.
  - Adds `commercialAPI.getAIDecisionSuggestions(warehouseId?)`.

- `frontend/src/services/api/index.ts`
  - Re-exports `AIDecisionSuggestion`.

- `frontend/src/hooks/useCommercial.ts`
  - Adds `useAIDecisionSuggestions`.
  - React Query key: `['commercial', 'ai-suggestions', warehouseId ?? 'all']`.
  - `staleTime`: 5 minutes.
  - `refetchInterval`: 10 minutes.

- `frontend/src/pages/commercial/CommercialDashboard.tsx`
  - Adds `Painel de Sugestões IA` after quick actions and before KPIs.
  - Shows loading skeletons, IA/fallback badge, priority styles, confidence, impact, and action button.
  - Calls `refetchAISuggestions()` in the dashboard refresh handler.

## Suggestion Shape

```ts
type AIDecisionSuggestion = {
  id: string;
  title: string;
  summary: string;
  reasoning: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'stock' | 'sales' | 'finance' | 'operations' | 'customers' | 'suppliers';
  impact: string;
  confidence: number;
  actionLabel: string;
  actionUrl: string;
  source: 'ai' | 'rules';
}
```

## Current Rule Suggestions

- Stock forecast risk: action `/commercial/purchase-orders`.
- Overdue receivables: action `/commercial/finance`.
- Expiring batches: action `/commercial/inventory`.
- Overdue purchase orders: action `/commercial/purchase-orders`.
- Long open cash shift: action `/commercial/history?tab=shifts`.
- Supplier invoices due/overdue: action `/commercial/supplier-invoices`.
- Stable state fallback: action `/commercial/reports`.

## Important Constraints

- The system already had many unrelated dirty files before this feature. Do not revert them.
- The commercial dashboard should remain clean and simple.
- `GEMINI_API_KEY` may be missing; fallback must remain first-class.
- Use Portuguese UI copy.
- Keep tenant isolation: never accept `companyId` from the request body.

## Validation Already Run

- `npm.cmd run build:check --prefix backend`: passed.
- `npm.cmd run typecheck --prefix frontend`: passed.
- `npm.cmd run build`: passed when rerun outside sandbox after a Vite access-denied sandbox failure.

Build warnings observed:

- Vite circular/manual chunk warnings.
- Some chunks larger than 500 kB.

These were warnings, not hard failures.
