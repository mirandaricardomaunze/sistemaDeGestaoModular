---
name: responsive-mobile
description: "Mobile-first responsive standards for the Multicore ERP — applies to every page, with a dedicated POS playbook for high-density operator screens on phones and tablets."
---

# Responsividade Mobile — Multicore ERP

> AI INSTRUCTION (MANDATORY): Toda a UI do Multicore tem de funcionar e parecer profissional em telemovel (>=360px), tablet (>=640px), laptop (>=1024px) e desktop largo (>=1440px). Antes de marcar qualquer pagina ou componente como concluido, valida o checklist da seccao 12. Esta skill complementa `ui-ux-design` — em caso de conflito, esta tem precedencia em tudo o que respeita a viewports < lg.

O Multicore e usado em lojas, farmacias, restaurantes e armazens. Operadores trabalham frequentemente em telemoveis ou tablets pequenos (Android baratos, ecra 5"–7"). Uma UI desktop-only e bloqueante para o negocio.

## 1. Breakpoints oficiais (Tailwind default)

Usar **sempre** os breakpoints standard do Tailwind (nao inventar custom):

| Prefixo | Min-width | Alvo                                  |
|---------|-----------|---------------------------------------|
| (none)  | 0px       | Mobile portrait (360–639px)           |
| `sm:`   | 640px     | Mobile landscape / tablet pequeno     |
| `md:`   | 768px     | Tablet portrait                       |
| `lg:`   | 1024px    | Tablet landscape / laptop             |
| `xl:`   | 1280px    | Desktop                               |
| `2xl:`  | 1536px    | Desktop largo / TV ponto de venda     |

**Regra mobile-first**: escrever sempre as classes para mobile **sem prefixo**, e adicionar prefixos (`sm:`, `md:`, `lg:`) para sobrescrever em ecras maiores. Nunca o contrario.

```tsx
// CORRETO — mobile-first
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">

// ERRADO — desktop-first com mobile como "afterthought"
<div className="grid grid-cols-5 max-md:grid-cols-1 gap-6 max-sm:gap-3">
```

## 2. Touch targets e densidade

Operadores usam dedo, nao rato. Toque seguro != hover.

- **Tamanho minimo tocavel**: 44x44px (Apple HIG) / 48x48px (Material) — usar `h-11` (44px) ou `h-12` (48px) em todos os botoes e inputs em ecras < lg.
- **Espacamento entre alvos**: minimo `gap-2` (8px) entre botoes/cartoes clicaveis para evitar mistaps.
- **`Button size`** por viewport:
  - Mobile (< sm): `size="md"` (44px) ou `size="lg"` (56px) para acoes criticas (Finalizar venda, Pagar).
  - Desktop (>= lg): `size="sm"` (36px) ou `size="md"` aceitavel.
- **Inputs**: `h-12` em mobile (`h-11 lg:h-11` ou `h-12 lg:h-11`). Nunca `h-9`/`h-8` em mobile.
- **Eliminar hover-only**: qualquer informacao revelada por `hover:` tem de estar acessivel por tap (long-press, expandir, ou mover para fora do hover).
- **`active:scale-95`** continua obrigatorio — substitui o feedback de hover em mobile.

## 3. Tipografia responsiva

Mobile usa fontes proporcionalmente maiores em relacao ao container para nao parecer "compressed":

| Elemento           | Mobile          | Desktop (lg:)   |
|--------------------|-----------------|-----------------|
| `h1` pagina        | `text-xl`       | `lg:text-2xl`   |
| `h2` seccao        | `text-lg`       | `lg:text-xl`    |
| Texto corpo        | `text-sm`       | `lg:text-base`  |
| Metricas / KPI     | `text-2xl`      | `lg:text-3xl`   |
| Total final POS    | `text-3xl`      | `lg:text-4xl`   |
| Labels / chips     | `text-[10px]`   | `lg:text-xs`    |

Usar o componente `ResponsiveValue` (`frontend/src/components/ui/ResponsiveValue.tsx`) para valores monetarios e KPIs — ja escala automaticamente.

## 4. Layout geral (Sidebar, Header, Main)

O `Layout` em `frontend/src/components/layout/Layout.tsx` define a casca. Regras:

- **Sidebar em mobile**: deve estar **escondida por defeito** (`-translate-x-full`) e abrir como **drawer overlay** com fundo escuro (`bg-black/50 backdrop-blur-sm`), nao empurrar conteudo.
  - Toggle via icone hamburguer no `Header` (visivel apenas em `< lg`).
  - Estado em Zustand (`useStore.sidebarOpen`).
  - Fechar ao: clicar fora, clicar num link, premir ESC.
- **Header em mobile**: compacto (`h-14` em vez de `h-16`). Esconder pesquisa global atras de um icone (`<HiOutlineMagnifyingGlass>`); abrir como overlay full-width.
- **Footer**: nao mostrar em mobile (`hidden lg:flex`) — desperdica vertical real-estate critico.
- **`<main>`**: padding mobile `p-3`, desktop `lg:p-6`. Nunca `p-6` em mobile (corta conteudo util em ~12% do ecra).
- **Bottom-bar opcional**: para POS/operacional, considerar `BottomActionBar` fixa em mobile com `Total + Botao Pagar` (ver seccao 6).

## 5. Padroes mobile para componentes existentes

### 5.1 `SmartTable` / tabelas

Tabelas com >3 colunas **nao** funcionam em portrait < 640px. Duas estrategias aceitaveis:

1. **Scroll horizontal controlado** (default): `overflow-x-auto` + primeira coluna sticky (`sticky left-0 bg-white dark:bg-dark-800`). Aceitavel para listas administrativas raras.
2. **Card-mode em mobile** (preferido para listas operacionais — vendas, stock, clientes):
   - `<table>` em `>= md`, `<div>` empilhado em `< md`.
   - Cada "linha" vira um `Card` com label/valor verticalmente, accoes no fundo.
   - Implementar via prop `mobileCardRender?: (row) => ReactNode` no `SmartTable` ou via componente irmao `<MobileCardList>`.

```tsx
// Padrao card-mode
<div className="md:hidden space-y-2">
    {rows.map(row => (
        <Card key={row.id} className="p-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-bold">{row.client}</p>
                    <p className="text-xs text-slate-500">{row.date}</p>
                </div>
                <ResponsiveValue value={row.total} size="md" />
            </div>
        </Card>
    ))}
</div>
<div className="hidden md:block">
    <SmartTable ... />
</div>
```

### 5.2 Modais

- Em mobile, modais devem ser **full-screen** (`w-full h-full sm:w-auto sm:h-auto sm:max-w-lg sm:rounded-2xl`).
- Header do modal **sticky top**, footer (com botoes Cancelar/Confirmar) **sticky bottom** com `safe-area-inset-bottom`.
- Body do modal scrollavel (`overflow-y-auto`).
- `ConfirmationModal` segue o mesmo padrao.

### 5.3 Formularios

- **1 coluna em mobile, multi-coluna em >= md**: `grid grid-cols-1 md:grid-cols-2 gap-4`.
- Labels **acima** dos inputs em mobile (nunca a esquerda).
- Botoes de submit ocupam largura total em mobile: `w-full md:w-auto`.
- Teclado numerico para campos numericos: `inputMode="decimal"` ou `inputMode="numeric"`.
- Telefone: `inputMode="tel"`.
- NUIT/codigos: `autoComplete="off" autoCapitalize="off"`.

### 5.4 Filtros e toolbars

Em mobile, filtros multiplos viram **bottom-sheet** ou colapsavel:

```tsx
<>
    {/* Mobile: 1 botao "Filtros" que abre sheet */}
    <Button className="md:hidden" leftIcon={<HiOutlineAdjustmentsHorizontal />} onClick={() => setSheet(true)}>
        Filtros {activeCount > 0 && <Badge>{activeCount}</Badge>}
    </Button>
    {/* Desktop: filtros inline */}
    <div className="hidden md:flex items-end gap-3">
        <Input ... /><Select ... /><Button ... />
    </div>
</>
```

### 5.5 KPI / MetricCards

- Mobile: `grid-cols-2` (2 colunas), nao 1 nem 4. 1 ocupa demasiado; 4 fica ilegivel.
- Tablet: `sm:grid-cols-2 md:grid-cols-3`.
- Desktop: `lg:grid-cols-4` ou `xl:grid-cols-6`.

## 6. POS — Playbook dedicado (CRITICO)

O POS e o caso mais hostil para mobile: catalogo + carrinho + pagamento, tudo simultaneamente. Layout desktop `grid-cols-5` (3 catalogo + 2 carrinho) **nao funciona** em mobile.

### 6.1 Estrategia de layout por breakpoint

| Viewport          | Layout                                                                 |
|-------------------|------------------------------------------------------------------------|
| Mobile (< md)     | **Tabs/views**: alternar entre "CATALOGO" e "CARRINHO" via `SegmentedControl` no topo, com **bottom bar fixa** mostrando `[Itens: 3] [Total: 1.250,00 MZN] [Pagar →]`. Tap em "Pagar" abre tela cheia de pagamento. |
| Tablet (md–lg)    | **Split 60/40 vertical**: catalogo em cima (scroll), carrinho colapsado em baixo com expand-to-fullscreen. |
| Desktop (>= lg)   | Layout actual: `grid-cols-5` (3 catalogo + 2 carrinho lado-a-lado). |

### 6.2 Grelha de produtos no POS

- Mobile: `grid-cols-2` (cards grandes, foto + nome + preco + botao "+").
- Tablet: `sm:grid-cols-3 md:grid-cols-4`.
- Desktop: `lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5` (dentro da coluna do catalogo).
- Cada card tem altura minima `h-32` em mobile para ser tocavel sem zoom.
- **Pesquisa de produto** sempre sticky no topo do catalogo, `h-12` em mobile (tap-friendly).
- Scanner de codigo de barras: botao icone `<HiOutlineQrCode>` no campo de pesquisa, opens camera via `BarcodeDetector` API ou input scanner.

### 6.3 Carrinho em mobile

- Header sticky com cliente seleccionado (`<Button variant="outline" leftIcon={<HiOutlineUser>}>`).
- Lista de itens com **swipe-to-delete** (ou tap-and-hold) — usar `react-swipeable` ou `framer-motion` drag.
- Quantidade ajustada por botoes `[−]` e `[+]` grandes (`w-10 h-10`), nao input numerico minusculo.
- Total **sempre visivel** na bottom bar — nunca scrollavel para fora.

### 6.4 Pagamento em mobile

- Tela cheia (full-screen sheet), nao modal central.
- Selector de metodo (`SegmentedControl`: Dinheiro / Mpesa / Emola / Cartao / Misto) em colunas 2x2.
- Teclado numerico **grande** para inserir valor recebido (`text-3xl` botoes `h-14`).
- Botao "FINALIZAR VENDA" sticky no fundo, `w-full size="lg" variant="success"`, altura `h-14`.

### 6.5 Atalhos especificos POS

- `safe-area-inset` no fundo para iOS Safari nao tapar bottom bar (`pb-[env(safe-area-inset-bottom)]`).
- `viewport-fit=cover` na meta tag (`frontend/index.html`).
- Bloquear zoom no input de quantidade: `<input style={{ fontSize: 16 }}>` (iOS faz zoom em <16px).
- `touch-action: manipulation` na grelha de produtos para eliminar delay de 300ms em alguns Androids.
- Modo paisagem para tablets: priorizar split horizontal mesmo em md se `orientation: landscape` (CSS `@media (orientation: landscape) and (max-width: 1024px)`).

### 6.6 Off-line e estado de rede em mobile

POS funciona offline (skill `offline-mode`). Em mobile, expor sempre:

- Indicador de rede (online/offline) **no header POS** ao lado de "Sistema Online" — usar `useOnlineStatus()`.
- Badge de "X vendas por sincronizar" tap-avel que mostra fila.
- Toast persistente quando offline ("Modo offline — vendas guardadas localmente").

## 7. Imagens e media

- `<img loading="lazy" decoding="async">` sempre em mobile (poupa bateria/dados).
- Fotos de produto: servir `srcset` com 2 tamanhos (`@1x` 200px, `@2x` 400px); thumbnails do catalogo POS nunca > 400px.
- Logos e icones SVG inline (zero requests extra).
- Evitar `background-image` com URLs absolutos em CSS — usar `<img>` para tirar partido do lazy-loading do browser.

## 8. Performance em dispositivos low-end

Operadores reais usam Android Go com 2GB RAM. Cuidados especificos:

- **Virtualizacao obrigatoria** em listas > 50 linhas em mobile (vs >200 em desktop). Usar `VirtualList` / `VirtualTable`.
- **Code-splitting agressivo**: cada pagina via `React.lazy()`, ja convencionado em `pages/`.
- **Imagens otimizadas**: WebP/AVIF preferido; cap em 100KB por imagem de produto.
- **Animacoes**: respeitar `prefers-reduced-motion` (`@media (prefers-reduced-motion: reduce)`); desactivar `backdrop-blur` em devices low-end via `@media (max-width: 640px) and (max-resolution: 1.5dppx)` ou feature query.
- **`requestIdleCallback`** para prefetches (ja em uso para boot prefetches, ver memoria `project_data_loading_fixes`).
- **Evitar `box-shadow` complexos** em mobile (pintar shadows custa GPU); preferir `border` + cor subtil.

## 9. Gestos e interaccoes mobile

- **Swipe horizontal**: navegar entre tabs do POS (catalogo <-> carrinho).
- **Swipe vertical down**: fechar bottom-sheets / modais full-screen.
- **Long-press**: menu contextual em items do carrinho (editar quantidade, aplicar desconto, remover).
- **Pull-to-refresh**: nas listas operacionais (Vendas do dia, Stock, Clientes) — implementar via `react-pull-to-refresh` ou nativo.
- **Tap fora**: fecha drawers, sheets, dropdowns.

## 10. Acessibilidade mobile (a11y)

- Contraste WCAG AA (>= 4.5:1) em mobile e ainda mais critico (ecra exposto a luz solar). Validar com `axe-core` no Chrome DevTools.
- `tabindex` correctos para teclados Bluetooth (operadores usam scanners-teclado).
- `aria-label` em todos os botoes-icone (`HiOutlineQrCode`, hamburguer, etc.).
- Tamanho de fonte respeita preferencia do utilizador (`rem`/`em`, nunca `px` para texto corpo).
- `focus-visible` clara em todos os elementos focaveis (ring-2 ring-primary-500 ring-offset-2).

## 11. Testing & validacao

Antes de marcar uma pagina como mobile-ready:

1. **Chrome DevTools — Device Mode**: testar nos perfis `iPhone SE` (375x667), `Pixel 7` (412x915), `iPad Mini` (768x1024).
2. **Throttling**: testar com `Slow 3G` e `Mid-tier mobile` (CPU 4x slowdown). FCP < 2s, LCP < 3s.
3. **Touch emulation activada** — verificar que hover-only states nao escondem informacao.
4. **Lighthouse mobile**: minimo 80 em Performance, 95 em Accessibility, 100 em Best Practices.
5. **Real device sanity-check** sempre que possivel — DevTools mente sobre teclado, scroll momentum, e safe-area.
6. **Rotacao**: girar para landscape e portrait — layout nao pode quebrar.
7. **Teclado virtual aberto**: inputs em formularios longos nao podem ficar tapados pelo teclado (usar `scrollIntoView({ block: 'center' })` em focus).

## 12. Checklist de enforcement (obrigatorio antes de PR merge)

Para qualquer pagina ou componente nao-trivial:

1. [ ] Funciona em viewport 360x640 sem scroll horizontal nao intencional.
2. [ ] Todos os botoes/inputs tocaveis tem >= 44px de altura em mobile.
3. [ ] Hover states nao escondem informacao critica (acessivel por tap).
4. [ ] Sidebar/menu colapsa em drawer em `< lg`.
5. [ ] Tabelas com >3 colunas tem fallback de card-mode ou scroll horizontal sticky.
6. [ ] Modais sao full-screen em `< sm`, com footer sticky de accoes.
7. [ ] Formularios sao single-column em mobile com labels acima.
8. [ ] Tipografia escala (mobile menor, desktop maior) — usar `ResponsiveValue` para metricas.
9. [ ] `inputMode` correcto em campos numericos/email/tel.
10. [ ] Imagens com `loading="lazy"`, dimensoes definidas.
11. [ ] Sem hardcoded `px` que partam zoom (texto >= 16px para evitar zoom iOS).
12. [ ] Safe-area-inset respeitada em elementos sticky bottom (iOS notch/home indicator).
13. [ ] Testado em DevTools com `iPhone SE` e `Pixel 7` sem regressoes visuais.
14. [ ] Sem `console.log` de debug deixados; sem `overflow-hidden` que corte tooltips/menus em mobile.
15. [ ] (POS-specific) Catalogo + carrinho + pagamento operaveis com um dedo em portrait.

## 13. Anti-padroes proibidos

- ❌ `min-width: 1024px` ou `max-width: ` em containers que escondem conteudo em mobile.
- ❌ Tabelas raw sem fallback mobile.
- ❌ Modais com largura fixa em px que cortam em ecras pequenos.
- ❌ Tooltips como unica forma de mostrar informacao (mobile nao tem hover).
- ❌ Botoes com `text-xs` e altura `< 40px` em mobile.
- ❌ Sidebars permanentes em < lg que comem 50%+ do ecra.
- ❌ Inputs com `font-size < 16px` em mobile (provoca zoom em iOS).
- ❌ Layouts `grid-cols-4`/`grid-cols-5` sem prefixo de breakpoint.
- ❌ `position: fixed` sem `safe-area-inset` em iOS.
- ❌ `window.alert/confirm/prompt` — sempre `ConfirmationModal` (responsivo por design).
- ❌ Conteudo critico atras de `:hover` (preco, accoes, detalhes).

## 14. Ficheiros-chave a tocar

| Area                       | Ficheiro                                                                |
|----------------------------|-------------------------------------------------------------------------|
| Casca / drawer mobile      | `frontend/src/components/layout/Layout.tsx`, `Sidebar.tsx`, `Header.tsx`|
| POS                        | `frontend/src/pages/commercial/CommercialPOS.tsx` (+ farmacia/garrafeira) |
| Tabelas responsivas        | `frontend/src/components/ui/SmartTable.tsx`, `DataTable.tsx`            |
| Modais                     | `frontend/src/components/ui/Modal.tsx`, `ConfirmationModal.tsx`         |
| Inputs / Botoes            | `frontend/src/components/ui/{Input,Select,Button}.tsx`                  |
| Hooks utilitarios          | criar `frontend/src/hooks/useMediaQuery.ts`, `useOnlineStatus.ts` se faltar |
| Bottom-bar POS (novo)      | `frontend/src/components/pos/POSBottomBar.tsx` (criar)                  |

## 15. Roadmap recomendado (ordem de implementacao)

1. Sidebar drawer mobile + header compacto (`Layout.tsx`).
2. `SmartTable` com prop `mobileCardRender`.
3. `Modal` full-screen em mobile + safe-area-inset.
4. POS — `SegmentedControl` Catalogo/Carrinho + bottom-bar fixa.
5. POS — grelha de produtos `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.
6. POS — tela de pagamento full-screen.
7. Refactor de formularios criticos (vendas, produtos, clientes) para single-column mobile.
8. Lighthouse mobile audit em todas as paginas principais; corrigir todos os blockers.
