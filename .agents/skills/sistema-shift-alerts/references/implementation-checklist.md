# Shift Alert Implementation Checklist

Use this checklist for each shift-alert change.

## Scope

- Start with one module, preferably commercial POS.
- Confirm whether the current shift payload contains `id`, `openedAt`, `openedBy`, `warehouse`, payment totals, movements, and sales count.
- Avoid schema changes unless the product decision needs company-configurable thresholds persisted in the database.

## Functional Acceptance

- No alert appears before 8 hours.
- Warning appears from 8 hours.
- Strong alert appears from 12 hours.
- Critical state appears from 16 hours.
- Popup actions work:
  - close shift opens the existing close modal
  - continue/snooze hides the popup temporarily
  - history/details route is available when useful
- Banner remains visible for long-open shifts after the popup is dismissed.
- Closing the shift clears future reminders for that shift.

## Professional Copy

- Mention exact opened time and approximate duration.
- Mention operational risk: cash divergence, wrong daily reports, responsibility confusion.
- Use concise Portuguese labels: `Fechar turno`, `Continuar por agora`, `Ver historico`.

## Safety

- Do not auto-close.
- Do not block payment confirmation mid-sale.
- Do not require notes for snooze in the first slice; require notes only when closing with cash difference, matching existing close rules.
- Use localStorage only for UI snooze, not for operational truth.

## Validation

- Build must pass.
- Lint must have no new errors.
- Manual smoke path: open POS with mocked/current shift, verify warning threshold, click close, close modal opens.
