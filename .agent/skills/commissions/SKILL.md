---
name: commissions
description: "Motor de cálculo de comissões: 4 dimensões (vendedor, meta, produto/categoria, margem). Documenta o schema CommissionRule, fluxo de cálculo no payrollService, regras de scope/snapshot, e como adicionar novas dimensões sem partir o histórico salarial."
---

# Skill: Comissões

> **Quando usar:** ao tocar em qualquer coisa que envolva `CommissionRule`,
> `commissionRate` em `Employee`, `SalesTarget`, ou no cálculo de bónus dentro
> de `payrollService.calculateDynamicBonus`. Também ao mexer nas UIs
> [CommercialBonusConfig](../../../src/components/commercial/hr/CommercialBonusConfig.tsx),
> [BonusConfigManager](../../../src/components/employees/BonusConfigManager.tsx)
> ou no `SalesTargetModal`.

---

## 0. Princípios não-negociáveis

1. **Snapshot de custo** — comissão por margem usa `SaleItem.costPrice` (snapshot
   no momento da venda). `Product.costPrice` é só **fallback** para vendas
   antigas anteriores ao snapshot.
2. **Vendas anuladas saem fora** — qualquer agregação tem de filtrar
   `voidStatus: { not: 'voided' }` (ver `salesTarget.service.ts:33`).
3. **Fonte de verdade do vendedor** = `Sale.userId` ↔ `Employee.userId`.
   `Employee` sem `userId` linkado **não** gera comissão automática
   (log warn, retornar 0 — não throw).
4. **Backend é a autoridade final**. O frontend pode mostrar preview, mas o valor
   que vai para `PayrollRecord.bonus` vem sempre do `calculateDynamicBonus`.
5. **Multi-tenant**: queries em `Sale`/`SaleItem` **têm** `companyId`
   (a extensão de Prisma em `lib/prisma.ts` injecta — ver `multicore/SKILL.md`).
6. **Arredondamento**: usar `round2` (`commercial/shared.ts`). Decimals voltam
   como `number` só na borda da resposta.
7. **IVA**: `Sale.total` é **com IVA**. `SaleItem.total` também. Se quiseres
   comissão sobre base tributável, descontar IVA via `Sale.subtotal` ou
   `Sale.totalTax`. Por defeito, a comissão é sobre `total` (com IVA) — manter
   coerência com o que já existe.

---

## 1. Schema actual

```prisma
// backend/prisma/schema.prisma
model CommissionRule {
  id         String         @id @default(uuid())
  employeeId String?        @unique   // 1 regra por empregado (override)
  role       EmployeeRole?            // regra "global" por papel
  type       CommissionType @default(fixed)
  rate       Decimal?       @db.Decimal(5, 2)
  tiers      Json?                     // tiered: [{min, rate}] | target: [{minProgress, rate}]
  isActive   Boolean        @default(true)
  // ── EXTENSÕES (gap 1) ───────────────────────────────────────────────────
  productId  String?                   // comissão só para vendas deste produto
  categoryId String?                   // comissão só para vendas desta categoria
  companyId  String?
}

enum CommissionType {
  fixed
  tiered
  profit_based
  target_based                          // ← gap 2: liga a SalesTarget
}
```

E em `Employee` há um campo legacy `commissionRate Decimal?` usado como
fallback quando não há `CommissionRule`. Manter — é a forma simples para SMEs
que não querem configurar regras.

---

## 2. As 4 dimensões pedidas

| # | Dimensão | Como se exprime no schema | Resolução |
|---|---|---|---|
| 1 | **Por vendedor** | `CommissionRule.employeeId` (unique) ou fallback `Employee.commissionRate` | Filtra `Sale.userId = employee.userId` |
| 2 | **Por meta** | `type: target_based` + `tiers: [{minProgress: number, rate: number}]` | Carrega `SalesTarget` activa do mês; calcula `progress = sales / target.value`; aplica tier cujo `minProgress` é satisfeito |
| 3 | **Por produto/categoria** | `productId` ou `categoryId` na `CommissionRule` | Filtra agregação por `SaleItem.productId` ou `SaleItem.product.categoryId` |
| 4 | **Por margem** | `type: profit_based` | Σ `(SaleItem.total − SaleItem.costPrice × quantity)` × rate |

**Combinações suportadas** (importante!):
- Vendedor + Produto → `employeeId + productId`
- Equipa + Categoria → `role + categoryId`
- Vendedor + Meta → `employeeId + type: target_based`
- Vendedor + Produto + Margem → `employeeId + productId + type: profit_based`

**Não suportado**: regra com `productId` E `categoryId` simultâneos
(ambiguidade). Validar no Zod com `.refine()`.

---

## 3. Resolução da regra para um empregado

Ordem de prioridade (a primeira que casa, ganha):

```
1. CommissionRule.employeeId = employee.id  AND isActive    ← override individual
2. CommissionRule.role = employee.role      AND isActive    ← regra do papel
3. Employee.commissionRate                                  ← fallback legacy
4. 0                                                         ← sem comissão
```

> Quando há `productId`/`categoryId` na regra, ela **só se aplica às vendas
> desse escopo**. Se o vendedor não vendeu nada dentro do scope, comissão = 0
> (não cai para o fallback).

---

## 4. Algoritmo (pseudo-código)

```typescript
async function calculateBonus(employee, month, year): Promise<number> {
  if (!employee.userId) return 0;
  const rule = await resolveRule(employee);     // 1→2→3 acima
  if (!rule) return 0;

  const { startDate, endDate } = monthRange(month, year);
  const saleWhere = {
    userId: employee.userId,
    companyId: employee.companyId,
    voidStatus: { not: 'voided' },
    createdAt: { gte: startDate, lte: endDate },
  };

  // ── Escopo de produto/categoria ───────────────────────────────────────
  // Quando há scope, agregamos sobre SaleItem em vez de Sale.
  const hasScope = rule.productId || rule.categoryId;
  const items = hasScope
    ? await prisma.saleItem.findMany({
        where: {
          sale: saleWhere,
          ...(rule.productId ? { productId: rule.productId } : {}),
          ...(rule.categoryId ? { product: { categoryId: rule.categoryId } } : {}),
        },
        select: { total: true, quantity: true, costPrice: true,
                  product: { select: { costPrice: true } } },
      })
    : null;

  // ── Total de vendas do âmbito ──────────────────────────────────────────
  const totalSales = hasScope
    ? items!.reduce((s, i) => s + Number(i.total || 0), 0)
    : Number((await prisma.sale.aggregate({ where: saleWhere,
                _sum: { total: true } }))._sum.total || 0);

  if (totalSales === 0) return 0;

  // ── Aplicar por tipo ───────────────────────────────────────────────────
  switch (rule.type) {
    case 'fixed':
      return round2(totalSales * Number(rule.rate || 0) / 100);

    case 'tiered': {
      const tiers = (rule.tiers as Array<{min:number, rate:number}>) ?? [];
      const sorted = [...tiers].sort((a,b) => b.min - a.min);
      const tier = sorted.find(t => totalSales >= t.min);
      return tier ? round2(totalSales * tier.rate / 100) : 0;
    }

    case 'profit_based': {
      const itemsForProfit = items
        ?? await prisma.saleItem.findMany({ where: { sale: saleWhere },
              select: { total: true, quantity: true, costPrice: true,
                        product: { select: { costPrice: true } } } });
      const profit = itemsForProfit.reduce((s, i) => {
        const cost = Number(i.costPrice ?? i.product?.costPrice ?? 0)
                   * Number(i.quantity || 0);
        return s + Math.max(0, Number(i.total || 0) - cost);
      }, 0);
      return round2(profit * Number(rule.rate || 0) / 100);
    }

    case 'target_based': {
      // tiers: [{minProgress: 0, rate: 1}, {minProgress: 80, rate: 3}, …]
      const target = await prisma.salesTarget.findFirst({
        where: { companyId: employee.companyId, isActive: true,
                 employeeId: employee.id, type: 'MONTHLY',
                 startDate: { lte: endDate }, endDate: { gte: startDate } },
      });
      if (!target || Number(target.value) <= 0) return 0;
      const progressPct = (totalSales / Number(target.value)) * 100;
      const tiers = (rule.tiers as Array<{minProgress:number, rate:number}>) ?? [];
      const sorted = [...tiers].sort((a,b) => b.minProgress - a.minProgress);
      const tier = sorted.find(t => progressPct >= t.minProgress);
      return tier ? round2(totalSales * tier.rate / 100) : 0;
    }
  }
}
```

---

## 5. Estrutura de ficheiros

```
backend/src/
  services/
    payrollService.ts                  ← calculateDynamicBonus (MODIFICAR)
  validation/
    employees.ts                       ← commissionRuleSchema (NOVO bloco)
  routes/
    employees.ts                       ← já tem /commissions/rules CRUD (MELHORAR validação)

src/
  components/commercial/hr/
    CommercialBonusConfig.tsx          ← UI principal (MODIFICAR — adicionar tipo, produto, categoria)
  components/employees/
    BonusConfigManager.tsx             ← duplicado simplificado (MODIFICAR)
  types/
    index.ts                           ← CommissionRule type (ESTENDER: productId, categoryId, target_based)

.agent/skills/commissions/SKILL.md     ← este ficheiro
```

---

## 6. Validação Zod (a adicionar em `validation/employees.ts`)

```typescript
export const commissionTierSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('volume'),  min: z.number().min(0), rate: z.number().min(0).max(100) }),
  z.object({ kind: z.literal('target'),  minProgress: z.number().min(0).max(1000), rate: z.number().min(0).max(100) }),
]);

export const commissionRuleSchema = z.object({
  employeeId: z.string().uuid().nullable().optional(),
  role:       z.enum(['admin','manager','operator','cashier','stock_keeper']).nullable().optional(),
  type:       z.enum(['fixed','tiered','profit_based','target_based']),
  rate:       z.number().min(0).max(100).nullable().optional(),
  tiers:      z.array(commissionTierSchema).optional(),
  productId:  z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  isActive:   z.boolean().optional().default(true),
})
.refine(d => !(d.productId && d.categoryId), {
  message: 'Use productId OU categoryId, não os dois',
  path: ['productId'],
})
.refine(d => d.type !== 'tiered'       || (d.tiers && d.tiers.length > 0), {
  message: 'tiered requer pelo menos 1 escalão',
  path: ['tiers'],
})
.refine(d => d.type !== 'target_based' || (d.tiers && d.tiers.length > 0), {
  message: 'target_based requer escalões por progresso',
  path: ['tiers'],
})
.refine(d => !['fixed','profit_based'].includes(d.type) || d.rate != null, {
  message: 'fixed/profit_based requerem rate',
  path: ['rate'],
});
```

---

## 7. UI — pontos de toque

`CommercialBonusConfig.tsx`:

1. Adicionar `target_based` ao `Select` "Tipo de Cálculo".
2. Quando `type === 'target_based'`:
   - Mostrar tiers com `minProgress` (% da meta) em vez de `min` (MT).
   - Avisar se o empregado não tem `SalesTarget` activa do mês.
3. Adicionar selectores opcionais "Produto" e "Categoria" (mutuamente
   exclusivos — desabilitar um quando o outro está preenchido).
4. No Card de listagem, mostrar o scope: "Apenas para [Produto X]" /
   "Apenas categoria [Y]" / "Atinge ≥ 100% da meta".

Componentes a reutilizar: `Select`, `Input`, `Button`, `Card`,
`ConfirmationModal`. **Nunca** `<button>`, `<input>`, `window.confirm` (ver
`ui-ux-design/SKILL.md`).

---

## 8. Testes obrigatórios

`backend/src/__tests__/payrollEngine.test.ts` (estender; **não criar ficheiro novo**):

```typescript
describe('calculateDynamicBonus', () => {
  it('fixed: 5% sobre total de vendas', /* … */);
  it('profit_based: 10% sobre margem, usa costPrice snapshot', /* … */);
  it('tiered: aplica o tier mais alto que o total satisfaz', /* … */);
  it('target_based: aplica tier por % de progresso da meta MENSAL activa', /* … */);
  it('target_based: retorna 0 se não há SalesTarget activa', /* … */);
  it('productId: agrega apenas SaleItem desse produto', /* … */);
  it('categoryId: agrega apenas SaleItem cujo product.categoryId casa', /* … */);
  it('exclui vendas com voidStatus = "voided"', /* … */);
  it('retorna 0 quando employee.userId é null (log warn)', /* … */);
  it('resolução: employeeId override > role > Employee.commissionRate > 0', /* … */);
});
```

Mocking: usar o mock de `prisma` já existente em `jest.setup.ts`. Não tocar
em DB real.

---

## 9. Pegadinhas / edge cases

- **Tier vazio**: `tiers: []` com `type: tiered` deve falhar a validação,
  não retornar 0 silenciosamente.
- **`rate` negativo**: bloquear no Zod (`.min(0)`).
- **Devoluções**: hoje não são descontadas. Se aparecer requisito de
  "vendas líquidas" (vendas − devoluções), tratar via `voidStatus` ou
  `returnedAt`. Documentar a mudança aqui antes de implementar.
- **Meta partilhada (warehouseId em vez de employeeId)**: a comissão
  `target_based` por empregado **ignora** metas warehouse-only. Se for
  preciso "todos os vendedores da loja partilham 1 meta", criar tipo
  novo `team_target_based` — não reaproveitar `target_based`.
- **Produto desactivado**: se `productId` aponta para produto inactivo,
  não bloquear — o histórico ainda vale.
- **Categoria recursiva**: o sistema tem categoria flat (sem hierarquia
  hoje). Se isso mudar, este filtro fica obsoleto — actualizar.

---

## 10. Checklist de conclusão

- [ ] Schema: `CommissionRule.productId?`, `categoryId?`, índices, FKs
- [ ] Schema: `CommissionType.target_based` no enum
- [ ] Migration SQL gerada e commitada
- [ ] `payrollService.calculateDynamicBonus` suporta os 4 tipos + scope produto/categoria
- [ ] Zod `commissionRuleSchema` em `validation/employees.ts` + usado em `routes/employees.ts`
- [ ] `routes/employees.ts` POST/PUT validam com o schema novo (substituir o `if (!type)` cru)
- [ ] `CommercialBonusConfig.tsx`: opção `target_based`, selectores produto/categoria, listagem mostra scope
- [ ] `types/index.ts` `CommissionRule` estendido
- [ ] Testes em `payrollEngine.test.ts` cobrem todos os ramos
- [ ] `npx tsc --noEmit` passa (frontend + backend)
- [ ] Skill actualizada se houver decisão de design que diverge daqui
