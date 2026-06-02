# Spec: FEFO automático de lotes na venda Comercial

- **Status**: implemented
- **Autor**: Miranda Maunze (com assistência)
- **Data**: 2026-06-01
- **Skill(s) relacionadas**: [[spec-driven]], [[test-harness]], [[multicore]], [[data-integrity-and-validation]], [[clean-architecture]]

## 1. Contexto

O schema já tem `ProductBatch` (lote com `expiryDate`, `quantity`, `status`) e `SaleItem.batchId` (FK opcional para lote). Os módulos Farmácia e Garrafeira já ordenam lotes por `expiryDate asc` para mostrar o mais próximo do vencimento. **O POS Comercial não.** Hoje, ao registar uma venda em `salesService.create`, o `batchId` fica sempre `NULL`, e o `currentStock` agregado do produto é decrementado sem tocar em nenhum `ProductBatch.quantity` específico.

Consequência: empresas que controlam lotes (alimentação, cosmética, química) perdem rastreabilidade, e lotes velhos ficam encalhados enquanto se vende dos novos.

## 2. Objectivo

Permitir que uma empresa active **FEFO automático** (First-Expired, First-Out) no POS Comercial: ao vender, o sistema escolhe o(s) lote(s) com `expiryDate` mais próxima, decrementa-os e regista o `batchId` no `SaleItem` para rastreabilidade total venda↔lote.

## 3. Não-objectivos

- **Selecção manual de lote no POS** (deixar o cashier escolher) — `batchSelectionMode='manual'` fica reservado mas não implementado nesta spec.
- **FEFO para módulos Farmácia, Garrafeira, Restauração** — esses já têm os seus próprios fluxos. Esta spec é apenas para `originModule='commercial'`.
- **Bloqueio de venda quando lote expirou** — comportamento configurável, mas o default desta spec é "consome na mesma e regista o `batchId` do lote expirado". Fica para uma spec futura adicionar workflow de aprovação.
- **Devolução de venda com restituição ao lote original** — fora do escopo; revertida no campo agregado como hoje.
- **Migração de vendas históricas** — `SaleItem` antigos ficam com `batchId=NULL`. Não fazemos backfill.

## 4. Contrato

### 4.1 API

Nenhuma rota nova. `POST /api/sales` mantém o mesmo contrato. Os campos `items[].batchId` no payload ficam **ignorados** (server-side autoritativo).

Resposta 200 inclui `batchId` em cada item criado quando FEFO foi aplicado:

```json
{
  "id": "...",
  "items": [
    { "productId": "p1", "quantity": 5, "batchId": "b-oldest", ... },
    { "productId": "p1", "quantity": 3, "batchId": "b-next",   ... }
  ]
}
```

(Sim — uma linha do POS pode virar duas linhas de `SaleItem` se o lote mais velho não chegar.)

### 4.2 Modelo de dados

**Mudança em `CompanySettings`** — campo novo:

```prisma
model CompanySettings {
  // ... campos existentes
  batchSelectionMode String @default("none") @map("batch_selection_mode")
  // valores: 'none' | 'fefo' | 'manual'
  //   none   → comportamento actual (não toca em ProductBatch)
  //   fefo   → FEFO automático (esta spec)
  //   manual → reservado para spec futura
}
```

Sem migração destrutiva. Default `'none'` mantém comportamento existente para todas as empresas que não optarem.

**`SaleItem.batchId`** já existe (linha 939 do schema). Não há mudança de schema aí.

**`ProductBatch.quantity`** é decrementado dentro da mesma transacção da venda. Sem campo novo.

### 4.3 Estado / eventos

Sem novos eventos Socket.IO. Sem novos jobs BullMQ.

Os alertas de `batch_expiring`/`expired_product` já existentes em `batchesService` continuam disparados pelo cron normal — esta spec não muda o motor de alertas.

## 5. Regras de negócio

1. **Opt-in por empresa.** Se `companySettings.batchSelectionMode !== 'fefo'`, `salesService.create` mantém comportamento actual (sem `batchId`, sem decremento de `ProductBatch`).
2. **Ordem de selecção** (estritamente nesta ordem):
   1. `ProductBatch.quantity > 0`
   2. `status != 'depleted'`
   3. (opcional) `warehouseId = sale.warehouseId` se a venda tem `warehouseId`; caso contrário ignora-se a coluna
   4. **Ordenar por** `expiryDate ASC NULLS LAST`, desempate por `receivedDate ASC`, desempate por `id ASC` (determinismo)
3. **Split entre lotes.** Se o lote escolhido tem `quantity < itemQuantityRestante`, consome tudo do lote, abre o próximo, repete até esgotar a quantidade do item. Cada lote consumido vira **uma linha `SaleItem` separada** com `batchId` correspondente, mesmo `productId`, `unitPrice` e proporção do desconto.
4. **Desconto rateado.** Se a linha original tem `discount=D` e foi partida em N lotes com quantidades `q1..qN`, o desconto da linha `i` é `D * qi / sum(qi)`, arredondado a 2 casas, com a última linha a absorver o resíduo de arredondamento.
5. **Fallback sem lotes.** Se o produto não tem nenhum `ProductBatch` activo (qty>0, não depleted), a venda **prossegue sem `batchId`** (comportamento actual). Não é erro — muitas empresas vendem produtos sem rastreio de lotes.
6. **Lotes expirados consomem-se na mesma.** Lote com `expiryDate < now` continua elegível e fica em primeiro lugar no FEFO. Razão: a obrigação é despachar o mais velho; bloquear venda fica para spec futura com workflow de aprovação.
7. **Decremento atómico.** O decremento de cada `ProductBatch.quantity` e a criação dos `SaleItem` correm dentro da **mesma** transacção que já existe em `salesService.create` (isolation `Serializable`).
8. **Stock agregado.** `Product.currentStock` continua a ser actualizado pelo `stockService.recordMovement` exactamente como hoje. FEFO não substitui esse cálculo — é uma camada acima.
9. **Movimento de stock por lote.** Para cada `SaleItem` com `batchId`, gera-se **um `StockMovement` próprio** com `productBatchId` preenchido, em vez de um único movimento agregado. Razão: rastreabilidade.
10. **Reservas de sessão.** A lógica de `stockReservation` existente (consumir do buffer reservado primeiro) continua **antes** do FEFO. FEFO opera apenas sobre o `remaining` depois de consumir reservas. Reservas são por produto, não por lote.

## 6. Edge cases

- **Produto com lotes parcialmente esgotados**: lote A (qty=2, exp=10d), lote B (qty=10, exp=60d), venda pede 5 → 2 do A + 3 do B, 2 linhas SaleItem.
- **Produto com lote expirado**: lote A (qty=10, exp=-5d), lote B (qty=10, exp=30d), venda pede 3 → 3 do A (expirado), 1 linha SaleItem com `batchId` do A.
- **Produto sem lotes**: lotes=[], venda pede 5 → 1 linha SaleItem com `batchId=NULL`, comportamento idêntico ao actual.
- **Lotes com `expiryDate=NULL`**: ordenam-se **por último** (`NULLS LAST`); usados só se não houver lotes com data.
- **Stock total dos lotes < quantidade pedida**: `stockService.validateAvailability` já fala antes, levanta `badRequest`. Mantém-se. FEFO não é responsável por validar disponibilidade.
- **Empresa em `batchSelectionMode='none'`**: comportamento 100% inalterado, mesmo que existam lotes registados.
- **`originModule != 'commercial'`** (ex. restaurant, bottlestore): FEFO **não corre**, mesmo com modo activo. A flag `batchSelectionMode` aplica-se só a vendas comerciais; os outros módulos têm fluxos próprios.
- **Concorrência**: duas vendas a consumir do mesmo lote em paralelo → `Serializable` levanta `P2034`, request 2 retentado pela camada de cima. Não é responsabilidade desta spec resolver retry.
- **Desconto rateado com arredondamento**: discount=10 em 3 lotes (qty 2/3/5) → 2.00/3.00/5.00. discount=10 em 3 lotes (qty 1/1/1) → 3.33/3.33/3.34 (último absorve resíduo).

## 7. Critérios de aceitação

- [ ] Existe `companySettings.batchSelectionMode` no schema, com default `'none'`, migração aplicada.
- [ ] Empresa com `batchSelectionMode='none'`: venda cria `SaleItem` com `batchId=NULL` (regressão zero contra hoje).
- [ ] Empresa com `batchSelectionMode='fefo'` + produto com lotes: venda escolhe lote mais próximo do vencimento e popula `batchId`.
- [ ] Split entre lotes: pedido de 5 quando lote mais velho tem 2 → cria 2 `SaleItem` com `batchId` distinto, soma `quantity` = 5, soma `total` igual ao da linha original (epsilon 0.01).
- [ ] Lote expirado consome-se em vez de ser ignorado.
- [ ] Produto sem lotes: venda sucede com `batchId=NULL` em `batchSelectionMode='fefo'`.
- [ ] `ProductBatch.quantity` é decrementado pela mesma quantidade consumida.
- [ ] Cada `SaleItem` com `batchId` tem um `StockMovement` correspondente com `productBatchId` igual.
- [ ] `Product.currentStock` é decrementado pelo total pedido (igual ao caminho antigo).
- [ ] Reservation pré-existente é consumida ANTES de FEFO; só o `remaining` passa por FEFO.
- [ ] Ordenação determinística: empate em `expiryDate` resolve por `receivedDate ASC`, depois `id ASC`.

## 8. Plano de testes

| Tipo       | Cobertura                                                              | Ficheiro                                                  |
|------------|------------------------------------------------------------------------|-----------------------------------------------------------|
| Integração | Modo `'none'`: regressão — venda não preenche `batchId`                | `backend/src/__tests__/services/fefo.test.ts`             |
| Integração | Modo `'fefo'` + 1 lote chega: 1 SaleItem com `batchId` do lote         | idem                                                      |
| Integração | Modo `'fefo'` + split 2/3: 2 SaleItem, soma quantidade/total correcta  | idem                                                      |
| Integração | Modo `'fefo'` + lote expirado: consome o expirado primeiro             | idem                                                      |
| Integração | Modo `'fefo'` + produto sem lotes: fallback para `batchId=NULL`        | idem                                                      |
| Integração | Modo `'fefo'` + lotes com `expiryDate=NULL`: usados por último         | idem                                                      |
| Integração | Reserva de sessão consumida primeiro, FEFO só aplica ao restante       | idem                                                      |
| Integração | Desconto rateado: discount=10 split 2/3/5 → 2.00/3.00/5.00             | idem                                                      |
| Integração | Empate em `expiryDate`: ordem por `receivedDate ASC`                   | idem                                                      |
| E2E manual | POS Comercial real: vender produto com 2 lotes, ver receipt + audit    | (passos no PR)                                            |

Todos os testes novos desta spec usam o harness novo (`backend/src/test/`): factories + `withTestTx` para `allocateFefo` e `rateableSplit`. Testes que exercitem `salesService.create` directamente devem usar `withTestTenant`, porque esse service abre a sua própria transacção interna.

## 11. Implementação

- Migração: `backend/prisma/migrations/20260601120000_add_batch_selection_mode/migration.sql`
- Schema: `backend/prisma/schema.prisma` (`CompanySettings.batchSelectionMode`)
- Serviço FEFO: `backend/src/services/commercial/fefo.service.ts`
- Integração de venda: `backend/src/services/salesService.ts`
- Testes harness: `backend/src/__tests__/services/fefo.test.ts`

## 12. Estado de validação local

- `npm.cmd run typecheck -w backend`: passou em 2026-06-01.
- Testes FEFO/commercial/sales exigem BD de teste acessível; a última execução local falhou por indisponibilidade do host Neon configurado, não por falha de asserção.

## 9. Riscos & rollback

- **Risco**: split incorrecto causa total da venda divergir do esperado (cliente paga X, sistema regista X-ε). **Mitigação**: invariante testada — `Σ(SaleItem.total) === Sale.subtotal`. Teste falha o build.
- **Risco**: lock em `ProductBatch` em alta concorrência (2 caixas, mesmo lote) provoca `Serializable failure`. **Mitigação**: já é o comportamento actual com `Product.currentStock`; nada de novo. Front-end já trata 409 com retry.
- **Risco**: empresa esquece de configurar e activa por engano → `batchId` começa a aparecer onde não devia. **Mitigação**: opt-in explícito via UI nas Settings, com aviso "esta opção exige que os seus produtos tenham lotes registados".
- **Rollback**:
  1. Mudar `batchSelectionMode` da empresa para `'none'` em `companySettings` (1 query SQL, 10 seg).
  2. Se necessário desfazer o código: o caminho FEFO está atrás de um único `if`, comentar/remover esse bloco mantém a venda a funcionar como hoje. `SaleItem.batchId` populados em vendas já feitas ficam (não causam regressão).

## 10. Métricas de sucesso

- % de `SaleItem` com `batchId NOT NULL` em vendas Comercial → idealmente >90% para empresas em modo `'fefo'`.
- Idade média do lote consumido (dias entre `receivedDate` do lote e `createdAt` da venda) → deve baixar após activação.
- Quantidade de stock expirado descartado por mês → deve baixar após 1-2 ciclos de validade.
