---
name: sistema-responsive-ui
description: Maintain professional responsive UI standards in the Sistema React/Tailwind frontend. Use when working on tabs, buttons, inputs, selects, textareas, tables, SmartTable, cards, modals, page headers, toolbars, dashboards, POS screens, or any issue where text/content overflows cards or mobile/tablet layouts break.
---

# Sistema Responsive UI

Apply these rules to every non-trivial frontend change in `frontend/src`.

## Core Standard

Build mobile-first. The interface must work at `360px`, `640px`, `768px`, `1024px`, and desktop widths without unintended horizontal page scroll, clipped text, or controls escaping cards.

Prefer fixing shared UI components before patching individual pages.

## Component Rules

- Tabs: keep tab lists horizontally scrollable on small screens; tab labels must truncate inside the button, not stretch the card.
- Buttons: keep touch targets at least `44px` high on mobile; use `max-w-full`, `min-w-0`, and truncation for long labels.
- Inputs/selects/textareas: keep mobile font size at least `16px` to avoid iOS zoom; align filter rows with explicit heights.
- Tables: wrap in `overflow-x-auto`; use a mobile card fallback for operational lists when practical; never allow the table to widen the page.
- Cards: add `min-w-0`, `max-w-full`, and safe text wrapping. Do not rely on clipping to hide broken layout.
- Text: long names, references, emails, IDs, and currency labels must use `break-words`, `truncate`, or `overflow-wrap:anywhere` depending on context.
- Page actions/toolbars: stack on mobile and wrap on tablet; use full-width buttons only on narrow screens.
- Modals: full-screen on mobile, centered cards on `sm` and above, with scrollable bodies and safe-area padding.

## Tailwind Patterns

- Use `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for cards/KPIs.
- Use `flex flex-col sm:flex-row` for headers and action rows.
- Use `w-full sm:w-auto` for action buttons in mobile toolbars.
- Use `min-w-0` on flex/grid children that contain text.
- Use `overflow-x-auto overscroll-x-contain scrollbar-thin` around wide data.
- Use `text-base sm:text-sm` for mobile inputs when the visual size is small.

## Validation

Before finishing, run the narrowest practical check:

```powershell
npm.cmd run typecheck -w frontend
```

If touching shared components, prefer:

```powershell
npm.cmd run build -w frontend
```

Report any environment blocker separately from code failures.
