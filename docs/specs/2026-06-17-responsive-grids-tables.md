# Spec: Responsividade Completa — Grids, Tabelas, Cards e Modais

- **Status**: implemented
- **Autor**: AI (Antigravity)
- **Data**: 2026-06-17
- **Skill(s) relacionadas**: [[responsive-mobile]], [[responsive-layouts]], [[sistema-responsive-ui]], [[sistema-responsive-elements]]

## 1. Contexto

22+ páginas de negócio usam `grid-cols-3`, `grid-cols-4` e `grid-cols-2` **sem breakpoint mobile** (`sm:`/`md:`), causando overflow horizontal e conteúdo ilegível em telas < 640px. Tabelas `<table>` inline (não SmartTable) também carecem de `overflow-x-auto`, ficando cortadas em mobile e tablet. Os componentes core (Button, Input, Select, Card, Modal, SmartTable, Pagination) já estão bem responsivos — o problema está exclusivamente nas páginas de negócio.

## 2. Objectivo

- Garantir que **todas as páginas** do sistema Multicore ERP renderizam correctamente em 3 breakpoints: mobile (375px), tablet (768px) e desktop (1280px+).
- Eliminar todo `grid-cols-N` (N ≥ 3) bare sem breakpoint `sm:` ou `md:` precedente.
- Envolver todas as `<table>` nativas em containers scrolláveis horizontalmente.
- Zero erros de TypeScript introduzidos.

## 3. Não-objectivos

- Redesign visual ou mudança de layout desktop — layouts desktop mantêm-se idênticos.
- Criação de `mobileCardRender` personalizado para SmartTables que ainda não o têm — o auto-card do SmartTable já cobre.
- Responsividade do Sidebar/Navigation — já tratada separadamente.
- Mudanças em componentes core (Button, Input, Select, Card) — já responsivos.
- POS screens (PharmacyPOS, RestaurantPOS, BottleStorePOS) — têm lógica POS própria documentada na skill `responsive-mobile`.

## 4. Contrato

### 4.1 API (não aplicável)

Nenhuma mudança de API. Puramente frontend/CSS.

### 4.2 Modelo de dados (não aplicável)

Nenhuma mudança em schema.prisma.

### 4.3 Estado / eventos (não aplicável)

Nenhuma mudança de estado ou eventos.

## 5. Regras de negócio

1. **Mobile-first obrigatório**: Todo `grid-cols-N` com N ≥ 3 DEVE ter `grid-cols-1` como base, escalando com `sm:grid-cols-2` e/ou `md:grid-cols-N`.
2. **Grids de 2 colunas em modais**: `grid-cols-2` dentro de `<Modal>` DEVE usar `grid-cols-1 sm:grid-cols-2` para empilhar campos em mobile.
3. **Tabelas nativas scrolláveis**: Toda `<table>` fora de SmartTable DEVE estar envolvida em `<div className="overflow-x-auto">` com `min-w-[500px]` ou superior na tabela.
4. **Zero overflow horizontal**: Nenhuma página pode produzir scrollbar horizontal na viewport de 375px.
5. **Desktop inalterado**: O layout em viewport ≥ 1280px DEVE permanecer visualmente idêntico ao actual.
6. **Zero erros TypeScript**: `npx tsc --noEmit` deve passar sem erros novos.
7. **Texto legível**: Nenhum texto deve ficar truncado sem `truncate` + `title` tooltip, ou `break-words` em mobile.

## 6. Edge cases

- **Grids com número condicional de filhos** (ex: `grid-cols-4` mas 2 items condicionalmente hidden): o layout mobile empilha naturalmente — sem impacto.
- **Grid `grid-cols-12` para formulários de itens** (Invoices.tsx L1301): manter com scroll horizontal em mobile, pois é um formulário tabular — não converter para stack.
- **Grids `grid-cols-7` do calendário** (calendar.tsx L484): manter bare — é um calendário, 7 colunas é semanticamente correcto.
- **Tabelas com `colSpan`** (ExpandedInvoiceDetails): o `overflow-x-auto` wrapper não afecta `colSpan` — funciona normalmente.
- **Modais com grids aninhados** (DeliveriesPage com grid-cols-2 dentro de grid-cols-3): cada nível é tratado independentemente.

## 7. Critérios de aceitação

- [ ] `npx tsc --noEmit` passa sem erros novos no directório `frontend/`
- [ ] Zero ocorrências de `grid-cols-3 gap` ou `grid-cols-4 gap` bare (sem breakpoint `sm:`/`md:`) nos ficheiros listados na spec
- [ ] `DeliveriesPage.tsx`: formulário de criação empilha campos em 375px sem overflow
- [ ] `SupplierInvoices.tsx`: PaymentModal mostra Total/Já Pago/Em Dívida empilhados em 375px
- [ ] `SupplierInvoices.tsx`: ExpandedInvoiceDetails tabelas fazem scroll horizontal em 375px sem cortar
- [ ] `Invoices.tsx`: modal de detalhes empilha campos em 375px
- [ ] `VehiclesPage.tsx`: modal de detalhes empilha 3 campos em 375px
- [ ] `ParcelsPage.tsx`: detalhes empilham em 375px
- [ ] `PharmacyPartners.tsx`: grid de stats empilha em 375px
- [ ] `MarginAnalysis.tsx`: grids de métricas empilham em 375px
- [ ] `CommercialReports.tsx`: grid de stats empilha em 375px
- [ ] `Alerts.tsx`: stats cards mostram 1 coluna em 375px
- [ ] Desktop (1280px): layout de todas as páginas modificadas permanece visualmente idêntico

## 8. Plano de testes

| Tipo       | Cobertura                                              | Ficheiro / Método                      |
|------------|--------------------------------------------------------|----------------------------------------|
| Build      | Zero erros TypeScript                                  | `npx tsc --noEmit`                     |
| Grep audit | Zero `grid-cols-[3-4] gap` bare nos ficheiros-alvo     | `grep -rn "grid-cols-[34] gap" pages/` |
| E2E manual | Chrome DevTools — iPhone SE (375px) em 5 páginas-chave | Ver passos abaixo                      |
| E2E manual | Chrome DevTools — iPad (768px) em 5 páginas-chave      | Ver passos abaixo                      |
| Visual     | Desktop (1440px) — confirmar zero regressão            | Comparação visual                      |

### Passos E2E Manual (5 páginas-chave)

1. **DeliveriesPage** → Abrir modal "Nova Entrega" → Confirmar campos empilhados em 375px → Confirmar 3 colunas em 1280px
2. **SupplierInvoices** → Expandir factura → Confirmar tabela scrollável em 375px → Abrir "Pagamento" → Confirmar 3 stats empilhados
3. **Invoices** → Abrir "Nova Fatura" → Confirmar grids empilhados em 375px → Ver detalhes → Confirmar 2→1 cols
4. **VehiclesPage** → Ver detalhes de veículo → Confirmar 3 campos empilhados em 375px
5. **Alerts** → Confirmar 4 stats cards em 1 coluna em 375px, 2 colunas em 768px, 4 em 1280px

## 9. Riscos & rollback

- **Risco**: Classe Tailwind mal editada quebra layout desktop. **Mitigação**: Apenas adicionamos prefixos de breakpoint a classes existentes — nunca removemos classes. Revisão por grep antes de commit.
- **Risco**: `overflow-x-auto` em tabela cria double-scroll em contextos já scrolláveis. **Mitigação**: Testar em modal (que já tem `overflow-y-auto`) + ExpandedRow.
- **Rollback**: Git revert do commit único. Nenhuma migração envolvida, nenhum dado alterado. Rollback imediato.

## 10. Métricas de sucesso

- Zero reports de "corta no telemóvel" pelos utilizadores em produção.
- `grep -rn "grid-cols-[34] gap" --include="*.tsx" frontend/src/pages/ | grep -v "sm:\|md:\|lg:\|xl:\|calendar"` retorna 0 resultados.
