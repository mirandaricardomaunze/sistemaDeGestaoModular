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

## 4. Dynamic Interactions & Animations
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

## 5. Component Architecture
- **Atomic Design Principles**:
  - Break down UIs into the smallest reusable parts possible (Atoms: Buttons, Inputs -> Molecules: Forms, Search Bars -> Organisms: Navbars, Modals).
  - All shared UI primitives should reside in `src/components/ui/` and should be strictly typed with TypeScript.
- **Separation of Logic and UI**:
  - Keep components "dumb" where possible. Pass data via `props`.
  - Move complex state management and API calls into custom hooks (`src/hooks/`) or global stores (Zustand).

## 6. Responsive Design & Accessibility (a11y)
- **Mobile-First Approach**:
  - Ensure every page and component looks great and functions perfectly on mobile devices (`sm:`, `md:`, `lg:` breakpoints).
  - Avoid horizontal scrolling issues. Tables on mobile should be scrollable horizontally or converted to a card layout.
- **Accessibility**:
  - Use semantic HTML (`<button>`, `<nav>`, `<main>`).
  - Ensure proper contrast ratios between text and backgrounds.
  - Add `aria-labels` and `alt` tags to non-text content. Ensure the application is navigable via keyboard (visible focus states).

## 7. Iconography Standards
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

## 8. UI/UX Enforcement Checklist
1. [ ] Does this component look premium and professional (colors, spacing, typography)?
2. [ ] Does it follow the 8px grid system for spacing and alignment?
3. [ ] Are component sizes uniform (standard heights for inputs and buttons)?
4. [ ] Are there proper hover, focus, and loading states?
5. [ ] Is the component fully responsive on mobile and desktop?
6. [ ] Is the logic separated from the presentation?
7. [ ] Is it accessible (contrast, semantic HTML, keyboard navigation)?
8. [ ] Are all icons sourced from `react-icons/hi2` with correct v2 names?
