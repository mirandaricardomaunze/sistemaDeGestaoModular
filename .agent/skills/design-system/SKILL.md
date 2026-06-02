---
name: design-system
description: "Referência operacional curta do design system Multicore: componentes disponíveis em frontend/src/components/ui/, regras de uso e processo para adicionar componente novo. Complementa a skill ui-ux-design (esta é o cheat-sheet; a outra é o guia visual completo)."
---

# 🧩 Design System

> 🤖 **AI INSTRUCTION (MANDATORY)**: Antes de escrever JSX numa página ou componente de domínio, verificar se o que precisas já existe em [frontend/src/components/ui/](../../../frontend/src/components/ui/). Importar de `@/components/ui`, nunca redesenhar.

**Relação com outras skills**:
- [[ui-ux-design]] — guia visual completo: glassmorphism, 8px grid, copywriting, print, charts. Lê antes de tarefas estéticas pesadas.
- [[responsive-layouts]] / [[responsive-mobile]] — regras de breakpoint e teste mobile.
- Esta skill (`design-system`) — **inventário** dos componentes prontos e **processo** para adicionar um novo. Mais curta, para consulta diária.

## Regras

1. **Cores hardcoded só no par light/dark documentado.** Sempre via Tailwind tokens (`bg-primary-600`, `text-slate-900 dark:text-white`) ou CSS vars (`var(--tooltip-bg)`). A **excepção** documentada em [[ui-ux-design]] §2 — backgrounds de cards/modais usam `bg-white dark:bg-[#111214]`, `bg-white dark:bg-[#12141a]`, `bg-slate-50 dark:bg-[#0a0b0d]` — está validada e é o canónico do sistema (ver [Card.tsx](../../../frontend/src/components/ui/Card.tsx#L23) e [PageHeader.tsx](../../../frontend/src/components/ui/PageHeader.tsx#L16)). **Nunca** usar `bg-[#...]` sem o par light correspondente — fica invisível ou ilegível em tema claro.
2. **Sem HTML cru para UI interactiva.** Nunca `<button>`, `<input>`, `<select>`, `<textarea>` directos. Usar `<Button>`, `<Input>`, `<Select>`, `<Textarea>` do sistema. Excepções: elementos **semânticos não interactivos** (`<main>`, `<nav>`, `<section>`) e formulários internos onde `<form>` é necessário para `onSubmit`.
3. **Mobile-first.** Sem prefixo = mobile. `sm:` ≥ 640px, `md:` ≥ 768px, `lg:` ≥ 1024px, `xl:` ≥ 1280px. Nunca escrever `lg:flex-col md:flex-row flex-row` (lê-se mal); preferir `flex-row md:flex-col`.
4. **Dark mode em paralelo.** Cada classe de cor (`bg-*`, `text-*`, `border-*`) tem variante `dark:`. Testar visualmente nos dois modos antes de marcar tarefa completa.
5. **Confirmar destrutivos via `ConfirmationModal`.** Nunca `window.confirm/prompt/alert`. Ver [[ui-ux-design]] §4 e [CLAUDE.md](../../../CLAUDE.md#padr%C3%B5es-de-ui).
6. **Listas > 200 linhas → `VirtualTable` / `VirtualList`.** Por defeito é `DataTable`/`SmartTable`; só virtualizar quando o tamanho real justifica.
7. **Iconografia: só Heroicons v2** (`react-icons/hi2`). Aliases v1→v2 em [[ui-ux-design]] §9.
8. **Skeleton de página inteira só na primeira carga.** Quando gates uma página inteira com `if (isLoading) return <Skeleton ... />`, **adiciona sempre o teste de dados**: `if (isLoading && !primaryData) return <Skeleton ... />`. Caso contrário, ao premir "Actualizar" / refetch a página desaparece e volta a aparecer com placeholders brancos — flash mau e percebido como bug. **Why**: React Query v5 mantém `isLoading=false` após primeira carga (só `isFetching` fica true em refetch), portanto este padrão funciona naturalmente para queries RQ. Mas se misturares `useState` manual no flag agregado (como acontecia em [CommercialDashboard.tsx:129](../../../frontend/src/pages/commercial/CommercialDashboard.tsx#L129) antes do fix de 2026-06-01) o refresh força full-page skeleton. **How to apply**: padrão correcto em [PharmacyDashboard.tsx:177](../../../frontend/src/pages/pharmacy/PharmacyDashboard.tsx#L177) e [LogisticsDashboard.tsx:240](../../../frontend/src/pages/logistics/LogisticsDashboard.tsx#L240) — `if (isLoading && !summary)`. Em refresh queremos manter dados antigos à vista com feedback no botão (icon a rodar + label "Actualizando..."), não tapar tudo.

## Componentes disponíveis (inventário real)

Pasta: [frontend/src/components/ui/](../../../frontend/src/components/ui/). Barrel: [`ui/index.tsx`](../../../frontend/src/components/ui/index.tsx). Importar **sempre** via barrel:

```tsx
import { Button, Card, Input, Modal, ConfirmationModal } from '@/components/ui';
```

### Acção
| Componente | Variantes / props chave | Usar para |
|---|---|---|
| `Button` | `variant`: `primary` \| `secondary` \| `outline` \| `ghost` \| `danger` \| `success` \| `warning` \| `premium`. `size`: `xs` \| `sm` \| `md` \| `lg` \| `action`. `isLoading`, `leftIcon`, `rightIcon`, `fullWidth` | Toda interacção. Mapear intenção, não cor. |

### Formulário
| Componente | Notas |
|---|---|
| `Input`     | Mesma altura que `Select`/`Button` na mesma toolbar (`h-11` desktop / `h-12` mobile, `size="sm"` em filtros densos). |
| `Select`    | Aceita `options: SelectOption[]`. Para combobox/searchable, ver `SmartTable` filters. |
| `Textarea`  | Mesmas regras que Input. |
| `SignaturePad` | Captura assinatura em entregas/POs assinadas. |

### Estrutura / Layout
| Componente | Notas |
|---|---|
| `Card`        | Container padrão. `p-4` ou `p-6`. **Não há `Container`** no sistema — usar `Card` ou Tailwind (`max-w-7xl mx-auto p-6`) consoante o contexto. |
| `PageHeader`  | Cabeçalho de página: título, subtítulo, slot `actions`. Obrigatório no topo de cada página de domínio. |
| `Tabs`        | Abas principais. Ver também `Stepper` exportado do mesmo ficheiro para fluxos sequenciais. |
| `SegmentedControl` | Em [`components/common/SegmentedControl`](../../../frontend/src/components/common/SegmentedControl.tsx). Substitui grupos de toggle/filter buttons (períodos, categorias). |

### Feedback / estado
| Componente | Notas |
|---|---|
| `Modal`              | Diálogo genérico. |
| `ConfirmationModal`  | **Obrigatório** para destrutivos. Substitui `window.confirm`. |
| `Badge`              | Estados, tags. `variant` mapeia para cores semânticas. |
| `EmptyState` + variantes (`NoDataFound`, `NoResultsFound`, `ErrorState`, `ComingSoon`, `NoItems`) | Mensagens de lista vazia, erro, recurso futuro. |
| `LoadingSpinner`, `Spinner`, `LoadingOverlay`, `LoadingDots`, `ProgressBar` (de `Loading.tsx`) | Estados de carregamento curtos. |
| `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonAvatar`, `SkeletonButton` | **Preferir Skeleton em dashboards e listas iniciais** — não Spinner. |
| `PageTransitionLoader` | Transição entre páginas via `React.lazy`. |

### Tabelas
| Componente | Quando |
|---|---|
| `DataTable` + `SimpleTable` + `TableContainer` + `TableLoadingState` | Tabela padrão tipada, sem virtualização. |
| `SmartTable` | Tabela com filtros, search, ordenação, exportação. Default para listas de domínio (`Customers`, `Invoices`, ...). |
| `VirtualTable` | Listas com **> 200 linhas** renderizadas. Mantém props compatíveis com `DataTable`. |
| `VirtualList`  | Para listas não-tabulares (cards verticais) com > 200 linhas. |

### Helpers
| Componente | Notas |
|---|---|
| `ResponsiveValue` | Componente utilitário para alternar children por breakpoint sem `className` ginástica. |
| `Pagination` + hook `usePagination` | Paginação cliente. |

> ⚠️ Mantém esta tabela em sincronia com [`ui/index.tsx`](../../../frontend/src/components/ui/index.tsx). Quando adicionares um componente, exporta no barrel **e** documenta aqui — sem isso o próximo agente reinventa.

> ⚠️ **Antes de consolidar imports `from '../ui/X'` para `from '../ui'`**, confirma com grep que o símbolo está mesmo exportado em [`ui/index.tsx`](../../../frontend/src/components/ui/index.tsx). TypeScript pode não apanhar a ausência (avaliação lazy) e o erro só aparece em runtime no browser como `does not provide an export named 'X'`.

## Bom vs mau — referência rápida

❌ **Mau**
```tsx
<button className="bg-blue-600 text-white px-4 py-2 rounded">Guardar</button>
<div style={{ background: '#111214' }}>...</div>
<div className="bg-[#111214]">...</div>            {/* sem par light → invisível em claro */}
<input type="text" className="border p-2" />
{confirm('Apagar?') && handleDelete()}
```

✅ **Bom**
```tsx
<Button variant="primary" onClick={handleSave}>Guardar</Button>
<Card className="p-6">...</Card>
<div className="bg-white dark:bg-[#111214]">...</div>   {/* par documentado em ui-ux-design §2 */}
<Input value={value} onChange={onChange} placeholder="..." />
<ConfirmationModal
    isOpen={open}
    onConfirm={handleDelete}
    onClose={() => setOpen(false)}
    title="Apagar registo?"
    variant="danger"
/>
```

## Para adicionar um componente novo

A pasta é `frontend/src/components/ui/` (**não** `design-system/components/`). Processo:

1. **Justificar.** Antes de criar, confirmar que nenhum existente cobre o caso. Se cobre com pequena variação → adicionar `variant`/`size` ao existente, não criar novo.
2. **Criar ficheiro único** `frontend/src/components/ui/NomeComponente.tsx` (não pasta — convenção actual do projecto é um `.tsx` por componente, exporta nomeado). Estrutura mínima:
   ```tsx
   import React from 'react';
   import { cn } from '@/utils/helpers';

   export type NomeComponenteVariant = 'a' | 'b';
   export interface NomeComponenteProps {
       variant?: NomeComponenteVariant;
       // ... props tipadas, sem any
   }

   export function NomeComponente({ variant = 'a', ...props }: NomeComponenteProps) {
       return (
           <div className={cn('base-classes', variant === 'a' && 'a-classes')} {...props} />
       );
   }
   ```
3. **Exportar no barrel** [`frontend/src/components/ui/index.tsx`](../../../frontend/src/components/ui/index.tsx) — tanto o componente como o `type`.
4. **Cobrir dark mode** em todas as classes de cor (`bg-*`, `text-*`, `border-*` ⇒ `dark:bg-* dark:text-* dark:border-*`).
5. **Adicionar à tabela "Componentes disponíveis"** acima, na secção correcta.
6. **Verificar checklist** de [[ui-ux-design]] §14 (premium look, 8px grid, hover/focus/active, responsivo, a11y).
7. **Testar nos dois temas** + mobile real (não só dev tools).
8. **TypeScript estrito** — sem `any`. Ver [[clean-architecture]] e a memória [[project_no_explicit_any_refactor]].

## Tokens / cores

Definidos em [tailwind.config.js](../../../frontend/tailwind.config.js) (paleta `primary`, `dark`, etc.). CSS vars complementares em [`frontend/src/index.css`](../../../frontend/src/index.css) — usar quando Tailwind variants `dark:` não chegam (Recharts tooltips, 3rd party widgets). Lista detalhada em [[ui-ux-design]] §2.

## Anti-padrões

- ❌ Criar componente novo a duplicar variante já existente. **Adicionar variant ao existente.**
- ❌ Importar componente directamente do ficheiro (`from '@/components/ui/Button'`) em vez do barrel (`from '@/components/ui'`).
- ❌ `className="text-white"` sem `dark:text-*` (no claro fica invisível).
- ❌ `lg:flex-row` sem definir o estado mobile primeiro.
- ❌ Estado de loading com spinner gigante em vez de `Skeleton` em dashboards.
- ❌ `if (isLoading) return <Skeleton ... />` num gate de página inteira — em refresh tapa os dados antigos com placeholders brancos. Usar `if (isLoading && !primaryData)`.
- ❌ Misturar `useState(loading)` manual com flags de `useQuery` no mesmo `isLoading` agregado — o manual reseta a `true` em cada refresh e força o full-page skeleton mesmo quando os hooks RQ não pediam.
- ❌ Documentar componente novo só no PR e esquecer a tabela acima (fica órfão da próxima sessão).

## Checklist antes de PR

- [ ] Componentes vêm de `@/components/ui` (barrel), não HTML cru.
- [ ] Cores hardcoded só no par `bg-white dark:bg-[#...]` (canónico — ver `ui-ux-design` §2). Nunca `bg-[#...]` sem par light.
- [ ] Dark mode testado nos dois lados.
- [ ] Mobile testado (375px width mínimo).
- [ ] Heroicons v2.
- [ ] `ConfirmationModal` em destrutivos, não `window.confirm`.
- [ ] Lista > 200 linhas usa `VirtualTable`/`VirtualList`.
- [ ] Skeleton de página inteira só dispara quando ainda não há dados (`isLoading && !primaryData`). Refresh não tapa a vista actual.
- [ ] Se adicionei componente novo: exportado no barrel **e** documentado na tabela acima.
