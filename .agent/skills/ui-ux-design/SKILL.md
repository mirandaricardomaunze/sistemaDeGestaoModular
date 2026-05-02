---
name: ui-ux-design
description: "Premium UI/UX, Design Consistency, and Frontend Component standards for the Multicore system."
---

# 🎨 UI/UX & Frontend Design Standards

> 🤖 **AI INSTRUCTION (MANDATORY)**: You MUST ensure that any frontend code you generate or modify aligns with these visual and structural design standards. Prioritize premium aesthetics, responsiveness, and accessibility in every component.

This skill ensures the Multicore system not only works flawlessly on the backend but also provides an exceptional, modern, and professional experience to the end-users. A system is judged heavily by its interface.

## 1. Visual Aesthetics & "Premium" Feel
- **Modern Styling (TailwindCSS)**:
  - Utilize TailwindCSS for all styling, but avoid scattered utility classes. Extract repetitive patterns into reusable class strings or small components.
  - Implement modern design trends where appropriate: subtle glassmorphism (backdrop-blur), soft drop-shadows, and clean borders.
- **Color Palettes & Gradients**:
  - Avoid generic primary colors (e.g., pure red `#FF0000`). Use customized, harmonious HSL/Hex palettes in the `tailwind.config.ts`.
  - Use subtle gradients for key call-to-action (CTA) buttons or header backgrounds to create depth.
- **Typography**:
  - Emphasize readability and hierarchy. Use a consistent, modern sans-serif font family (e.g., Inter, Roboto, or Outfit).
  - Use distinct font weights (bold for headers, medium for subheaders, regular for body text).

## 2. Theme Consistency (Light & Dark Mode)
- **Mandatory Tailwind Variants**:
  - Every component MUST be designed to work in both Light and Dark modes. Use the `dark:` variant for all background, text, and border changes.
  - **Prohibition of Hardcoded Theme Colors**: NEVER use hardcoded hex colors for general theme backgrounds (e.g., `bg-[#111214]`) or text. Always use theme-aware utility classes (e.g., `bg-white dark:bg-dark-900`, `text-slate-900 dark:text-white`).
- **Semantic Color Mapping**:
  - *Base Backgrounds*: `bg-slate-100/40` (Light) / `bg-dark-900` (Dark).
  - *Card/Container Backgrounds*: `bg-white` (Light) / `bg-dark-800` or `bg-[#111214]` (Dark).
  - *Secondary Backgrounds*: `bg-slate-50` (Light) / `bg-black/20` (Dark).
- **CSS Variables for Complex Components**:
  - For components that don't easily support Tailwind variants (like *Recharts* tooltips or 3rd party widgets), use CSS variables defined in `index.css` (e.g., `var(--tooltip-bg)`).
- **Glassmorphism in Both Modes**:
  - Ensure `backdrop-blur` effects maintain legibility. In Light mode, use a white tint (`bg-white/70`); in Dark mode, use a dark tint (`bg-dark-900/70`).
- **Dynamic Color Logic**:
  - KPIs and MetricCards MUST implement logic to change variants/colors based on value sign. For example, a "Profit" card should be `success` (green) if positive and `danger` (red) if negative.

## 2. Layout & High-Density Standards
- **High-Density (POS/PDV)**:
  - Interfaces like the Point of Sale must prioritize speed. Use compact grid layouts with maximum item visibility.
  - Pin key identification fields (Customer, Promo Code) to fixed headers to prevent scrolling of critical context.
  - Cart panels should have a sticky total/action section at the bottom.
- **Alignment & Baselines**:
  - Horizontal filter bars MUST maintain a consistent vertical baseline.
  - If any input has a label, ALL inputs in that row should have a label (or a placeholder label space) to prevent "staircase" effects. Use `items-end` on grid containers for consistent alignment.

## 3. Standard Sizing & Uniform Layouts
- **8px Grid System**:
  - All spacing (margins, padding, gaps) must follow an 8px (0.5rem) baseline increments (`2`, `4`, `6`, `8`, `10`, `12`, `16`, `20`, `24`, `32`).
  - *Standard Padding*: Layout containers should use `p-6` (24px) or `p-8` (32px). Cards should use `p-4` (16px) or `p-6`.
- **Component Sizing (Height Hierarchy)**:
  - **Inputs & Selects**: Use a standard height of `h-11` (44px) for desktop and `h-12` (48px) for mobile-friendly touch targets.
  - **Buttons**:
    - `xs`: 28px height (`px-2 py-1`)
    - `sm`: 36px height (`px-3 py-1.5`)
    - `md`: 44px height (`px-4 py-2`)
    - `lg`: 56px height (`px-6 py-3`)
- **Consistent Rounding**:
  - Use `rounded-lg` (8px) for buttons, cards, and inputs by default.
  - Use `rounded-xl` (12px) for larger modal containers or featured cards.

## 4. Minimalist Premium Design System (Standardized Components)

The Multicore system uses a centralized component-based design system. **Direct HTML tags like `<button>` are strictly prohibited for UI actions.**

- **Button Component (`src/components/ui/Button.tsx`)**:
  - **Mandatory Usage**: All interactive actions MUST use the `Button` component.
  - **Variants**:
    - `primary`: Use for main CTAs (Save, Confirm, Checkout).
    - `outline`: Use for secondary actions or secondary filters.
    - `ghost`: Use for subtle utility actions (Refresh, Edit/Delete in lists).
    - `danger`: Use for destructive actions (Delete, Cancel).
  - **Premium Styling**: The system enforces `font-black`, `uppercase`, and `tracking-widest` for a high-end fintech look.
  - **Tactile Feedback**: Every interactive component MUST implement `active:scale-95` to provide immediate physical feedback.

- **SegmentedControl (`src/components/common/SegmentedControl.tsx`)**:
  - **Mandatory for Toggles**: Replaces groups of manual buttons for:
    - View/Tab switching (e.g., Operational vs. Management).
    - Category filtering (e.g., Product categories).
    - Period selection (e.g., 30d, 90d, 1y).
  - **Premium Experience**: It uses a glassmorphism sliding effect and consistent heights (`sm` for filters, `md` for main tabs).

## 5. Dynamic Interactions & Animations
- **Micro-Animations**:
  - Interfaces should feel alive. Add subtle `hover:`, `focus:`, and `active:` states to all interactive elements (buttons, inputs, cards).
  - Use smooth transitions (`transition-all duration-200 ease-in-out`).
- **Premium Dashboard Architecture**:
  - **Modular PageHeader**: Every dashboard MUST use a unified `PageHeader` component with clear titles, subtitles, and an `actions` slot.
  - **Manual Refetching**: Include a "Refresh" button in the `actions` slot of the `PageHeader` that provides manual data synchronization.
  - **Responsive Layouts**: Use the `MetricCard` system for consistent KPI display, ensuring the design feels "rich" and information-dense without being cluttered.
- **Loading States (Skeleton First)**:
  - Never leave the user guessing. Always provide visual feedback during asynchronous actions.
  - **Dashboards**: Mandatory use of **Skeleton Loaders** for the initial `isLoading` state. This prevents content shifting and provides a high-end "feel" compared to generic spinners.
  - **Actions**: Use Spinner icons inside buttons ONLY during active submission (`isPending`).
- **Toast Notifications**:
  - Use elegant, non-intrusive toast notifications for success/error messages rather than blocking `alert()` dialogues.

## 6. Component Architecture
- **Atomic Design Principles**:
  - Break down UIs into the smallest reusable parts possible (Atoms: Buttons, Inputs -> Molecules: Forms, Search Bars -> Organisms: Navbars, Modals).
  - All shared UI primitives should reside in `src/components/ui/` and should be strictly typed with TypeScript.
- **Separation of Logic and UI**:
  - Keep components "dumb" where possible. Pass data via `props`.
  - Move complex state management and API calls into custom hooks (`src/hooks/`) or global stores (Zustand).

## 7. Responsive Design & Accessibility (a11y)
- **Mobile-First Approach**:
  - Ensure every page and component looks great and functions perfectly on mobile devices (`sm:`, `md:`, `lg:` breakpoints).
  - Avoid horizontal scrolling issues. Tables on mobile should be scrollable horizontally or converted to a card layout.
- **Accessibility**:
  - Use semantic HTML (`<button>`, `<nav>`, `<main>`).
  - Ensure proper contrast ratios between text and backgrounds.
  - Add `aria-labels` and `alt` tags to non-text content. Ensure the application is navigable via keyboard (visible focus states).

## 8. Dashboard & Data Visualization Standards
- **Symmetrical Grid Layouts**: 
  - For complex analytical dashboards, use a **3-column symmetrical grid** (`lg:grid-cols-3`) for secondary charts and operational cards to ensure perfect height alignment.
  - Avoid mixed-height rows that create visual gaps. If a row has 3 columns, all cards in that row should be of the same type or have consistent padding/height.
- **Heatmap Data Sensitivity**:
  - When visualizing sparse data (e.g., a new system with few sales), implement a **minimum visibility floor** (typically 25% intensity) for any cell with non-zero values. This prevents the chart from appearing "empty" or "broken" during initial operation.
- **Visual Hierarchy**:
  - Top: Quick Action Buttons (6 cols)
  - Mid-Top: Hero MetricCards (4 cols)
  - Center: Full-Width Visual Patterns (e.g., Sales Heatmap)
  - Base: Detailed Analytics & Operations (Grid 3x3 or 2/3-1/3 split).
- **Chart Theme Integration**:
  - Recharts tooltips MUST be customized to match the system theme (glassmorphism in dark/light mode) using global CSS variables.

## 9. Iconography Standards
- **React Icons Standard Engine**:
  - The Multicore system strictly uses **Heroicons v2** (`react-icons/hi2`) for all new UI components and refactoring efforts. DO NOT use `react-icons/hi` (v1) in updated components.
- **Known v1 to v2 Migrations/Aliases**:
  - `HiOutlineDownload` -> `HiOutlineArrowDownTray`
  - `HiOutlineClipboardList` -> `HiOutlineClipboardDocumentList`
  - `HiOutlineClipboardCheck` -> `HiOutlineClipboardDocumentCheck`
  - `HiOutlineRefresh` -> `HiOutlineArrowPath`
  - `HiOutlineTrendingUp` -> `HiOutlineArrowTrendingUp`
  - `HiOutlineDocumentReport` -> `HiOutlineDocumentChartBar`
  - `HiOutlineArchive` -> `HiOutlineArchiveBox`
  - `HiOutlineX` -> `HiOutlineXMark`
  - If a component requires the exact v1 names to prevent refactoring props, use aliases in imports: `import { HiOutlineArrowDownTray as HiOutlineDownload } from 'react-icons/hi2';`

## 10. Professional Reporting & Print Standards
- **Aesthetic & Ink Efficiency**:
  - Print documents MUST use a **pure white background** (`bg-white`) for all elements. Avoid dark headers or large solid fills to ensure professional appearance and printer ink efficiency.
  - Use high-contrast typography (Black text on White background) with modern fonts like **Inter**.
- **Header Structure**:
  - Reports MUST include a clear corporate header with: Company Logo, Company Name, Detailed Address/Contacts, and a "Document Info" box (Date, Document ID, Totals).
- **Table Design**:
  - Tables should use **bold column headers** with a solid bottom border (e.g., `2px solid #e2e8f0`) instead of background colors.
  - Maintain clear alignment: **Right-aligned** for numbers and currency; **Left-aligned** for text and references.
  - Column Order Standard: `Referência` -> `Código` -> `Produto` -> `Qtd` -> `Valor`.
- **Totals & Validation**:
  - Include a highlighted "Totals Box" at the bottom right with clear labels (Total Unidades, Total Valor).
  - Formal reports MUST have a **Signature Area** at the footer for "Responsável" and "Aprovação".
- **Modal Preview (Dark Mode Handling)**:
  - When displaying a print preview inside a modal, use **inline styles** for background and text colors to bypass global dark mode overrides. The preview must always look like "white paper".

## 11. PDF Generation Pattern (Transactional Documents)

> Whenever a screen prints or exports a transactional document (cotação, fatura, guia, recibo, relatório), use the shared engine in `src/utils/documentGenerator.ts` — **not** browser-print HTML and **not** `exportToPDF` from `src/utils/exportUtils.ts`. `exportUtils` is reserved for generic table dumps.

- **Mandatory helpers**: every generator must call `addProfessionalHeader(doc, title, normalizedCompany)` and `addProfessionalFooter(doc, normalizedCompany)`. The body uses `jspdf-autotable` (`autoTable`) for tables.
- **Company normalization (always)**: company settings come from `useCompanySettings` and use `nuit`, but the header reads `taxId`. Normalize before passing:
  ```ts
  const normalizedCompany = {
      ...companyInfo,
      taxId: companyInfo?.taxId || companyInfo?.nuit,
      address: [companyInfo?.address, companyInfo?.city, companyInfo?.province]
          .filter(Boolean).join(', ') || companyInfo?.address,
  };
  ```
  Without this the NUIT renders as "N/A" and the address loses city/province.
- **`action: 'save' | 'print'` parameter**: every generator accepts this. `'save'` calls `doc.save(filename)`. `'print'` calls `doc.autoPrint()` then `window.open(doc.output('bloburl'), '_blank')`.
- **Per-row vs above-table scope** (lists with both):
  - **Per-row buttons** (printer + download icons next to "Ver detalhes") act on a single record: full items table (Código, Designação, Qtd, Preço Unit., Total) + bottom-right card with Subtotal / IVA / Total Final.
  - **Above-table buttons** (`Imprimir` + `Exportar PDF`, both `variant="primary"`) act on the listed records: one row per record (Nº, Data, Cliente, Itens, Estado, Total) + "Total Geral" card. Use `landscape` orientation for these.
- **Items table column order for documents**: `Código (barcode)` → `Descrição` → `Qtd` → `Preço Unit.` → `Total`. The product `code` field is intentionally omitted — barcode is the user-facing reference.
- **Caixa vs Unidade pricing** (per memory `project_box_unit_pricing.md`): when a line is sold per unit, the price shown/saved is `product.price / packSize` (`product.price` is the box price). Append "(un)" to the line description so the document differentiates it.

## 12. Action Button Standards (Workflow Transitions)

Workflow transition buttons in a row's action cell (e.g., "Marcar Enviada", "Cancelar", "Converter em Venda") must look like real buttons, not flat text:

- Use the proper `Button` variant for the intent:
  - `primary` → progressive (Converter, Vender)
  - `outline` → neutral non-CTA (Marcar Enviada). Map `ghost` from `WorkflowTransition` to `outline`, never render flat `text-gray-500`.
  - `success` → positive terminal state (Marcar Aceite, Gerar Factura)
  - `danger` → cancel/destroy (Cancelar)
- Always pass a `leftIcon` (Heroicons v2). Suggested mapping:
  - `HiOutlineArrowRight` → Converter / Vender
  - `HiOutlinePaperAirplane` → Marcar Enviada
  - `HiOutlineCheckCircle` → Marcar Aceite
  - `HiOutlineDocumentText` → Gerar Factura
  - `HiOutlineXCircle` → Cancelar
- `size="xs"` keeps them compact in a row. Add `text-[10px] font-black uppercase tracking-widest` for the project's micro-CTA look.

## 13. UI/UX Enforcement Checklist
1. [ ] Does this component look premium and professional (colors, spacing, typography)?
2. [ ] Does it use the `Button` component instead of raw `<button>` tags?
3. [ ] Does it use `SegmentedControl` for tab/filter switching?
4. [ ] Does it follow the 8px grid system for spacing and alignment?
5. [ ] Are component sizes uniform (standard heights for inputs and buttons)?
6. [ ] Are there proper hover, focus, and tactile (`scale-95`) feedback states?
7. [ ] Is the component fully responsive on mobile and desktop?
8. [ ] Is the logic separated from the presentation?
9. [ ] Is it accessible (contrast, semantic HTML, keyboard navigation)?
10. [ ] Are all icons sourced from `react-icons/hi2` with correct v2 names?
11. [ ] (Theming) Does the component support both Light and Dark modes correctly?
12. [ ] (Theming) Are all theme colors dynamic (no hardcoded hex for backgrounds/text)?
13. [ ] (Reports) Is the background 100% white and ink-efficient?
14. [ ] (Reports) Does the preview modal bypass dark mode styles?
15. [ ] (Dashboards) Is the layout symmetrical and aligned in height?
16. [ ] (Dashboards) Does the heatmap show a minimum intensity for sparse data?
17. [ ] (KPIs) Do colors change dynamically (success/danger) based on value signs?
