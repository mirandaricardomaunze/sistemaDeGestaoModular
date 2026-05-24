---
name: sistema-shift-alerts
description: Maintain and implement professional shift-forgotten alerts in the local Sistema project. Use when Codex works on POS/commercial/pharmacy/restaurant cash-session warnings, long-open shift popups, shift close reminders, cash-session audit trails, alert thresholds, /commercial/shift APIs, or UX that prevents forgotten open turns.
---

# Sistema Shift Alerts

## Mission

Implement shift alerts that protect cash control without interrupting sales. Prefer a small complete slice first, then extend to other modules once the pattern is validated.

## Product Rules

- Start with commercial POS because it already has `shiftAPI`, `CashSession`, summaries, close modal, and history.
- Treat a shift as forgotten when it is open longer than the configured threshold. Default to warning at 8 hours, strong alert at 12 hours, critical at 16 hours.
- Never auto-close a shift. The user must close it with counted cash and optional notes.
- Avoid interrupting active checkout or sale completion. Show the popup when the POS is idle, on page entry, or after polling refresh.
- Let the cashier dismiss a warning temporarily, but record a local snooze and re-alert later. Strong/critical alerts should keep a visible banner.
- Provide direct actions: close shift, continue for now, view shift history/details.
- Keep auditability: backend actions that affect shifts must write audit logs; frontend-only snooze is acceptable only for reminder dismissal.
- Keep text professional and specific: include opened time, duration, operator if available, and risk.

## Implementation Workflow

1. Inspect existing shift data first:
   - `backend/prisma/schema.prisma` model `CashSession`
   - `backend/src/services/cashSessionService.ts`
   - `backend/src/routes/commercial.ts`
   - `frontend/src/services/api/commercial.api.ts`
   - `frontend/src/pages/commercial/CommercialPOS.tsx`
   - `frontend/src/components/commercial/pos/CommercialShiftModal.tsx`
2. Add shared frontend helpers for duration and severity before adding UI.
3. Add a focused popup/banner component that receives the active shift, summary, and callbacks.
4. Wire the component into POS with existing shift query data and existing close modal flow.
5. Add backend API support only if existing shift payload lacks required data.
6. Validate with targeted TypeScript/build/lint. Run backend tests only when database connectivity is available.
7. Keep pharmacy/restaurant follow-up work behind the same component or copied pattern after commercial is stable.

## UX Standards

- Use existing UI components where practical.
- Use clear hierarchy: title, risk summary, shift facts, then actions.
- Keep the popup modal-sized, not a full page.
- Use warning/amber for 8h, danger/red for 12h+, and critical wording for 16h+.
- Respect dark mode.
- Avoid decorative complexity; this is an operational safety workflow.

## Technical Pattern

- Compute `openedMinutes = now - new Date(activeShift.openedAt)`.
- Severity:
  - `< 8h`: no alert
  - `8h-12h`: `warning`
  - `12h-16h`: `danger`
  - `>= 16h`: `critical`
- Snooze key: `shift_alert_snooze:<shiftId>:<severity>`.
- Suggested snooze durations:
  - warning: 60 minutes
  - danger: 30 minutes
  - critical: 15 minutes or no modal snooze, but keep banner visible.
- Recompute every minute in the POS page.
- Reuse the existing close shift modal by setting `shiftModalMode` to `close` and opening `CommercialShiftModal`.

## Validation

- Run targeted checks first:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `npm.cmd run build:check --prefix backend` if backend changed
- If Vite/esbuild fails with `Access is denied`, rerun the same command with escalation; this is an environment restriction, not necessarily a code failure.
- If backend tests fail with Supabase/Postgres connectivity, report the database blocker separately from code failures.

## References

Read `references/implementation-checklist.md` before implementing or reviewing a shift-alert change.
