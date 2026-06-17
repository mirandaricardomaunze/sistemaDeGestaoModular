# Spec: Guia de Transporte com Transferência de Stock entre Armazéns

- **Status**: draft
- **Autor**: Miranda Maunze (+ Claude)
- **Data**: 2026-06-16
- **Skill(s) relacionadas**: [[spec-driven]], [[clean-architecture]], [[data-integrity-and-validation]], [[multicore]], [[security-and-auth]], [[inventario-fisico]]
- **Documento de arquitetura base**: [docs/architecture/stock-movements-and-commercial-documents.md](../architecture/stock-movements-and-commercial-documents.md)

> **Como usar este ficheiro**: é o guia passo-a-passo. Faz as fases por ordem (§8). Cada fase termina com `npm run typecheck` verde. Não saltar a Fase 0.

---

## 1. Contexto

Hoje a Guia de Transporte (modelo `Delivery`, módulo Logística) é um documento puramente de transporte: regista motorista, viatura, rota e destinatário, **mas não mexe em stock** (confirmado no documento de arquitetura base, §3.4). Quando se desloca mercadoria de um armazém para outro, o inventário por armazém (`warehouse_stocks`) não reflete a saída/entrada.

O sistema **já possui** um motor de transferências entre armazéns testado e robusto — `StockTransfer` + `warehousesService` ([backend/src/services/warehousesService.ts](../../backend/src/services/warehousesService.ts)) — com máquina de estados, reserva, aprovação, despacho (saída da origem), receção (entrada no destino) e cancelamento, todos via `stockService.recordMovement({ movementType: 'transfer' })`.

## 2. Objetivo

Permitir emitir uma Guia do tipo **transferência de armazém** que, ao circular, move o stock entre o armazém de origem e o de destino, **reutilizando o motor `StockTransfer`** (não duplicar lógica de stock), em **duas fases** (saída no despacho, entrada na confirmação de entrega) e **sujeita a aprovação** (reutiliza o `ApprovalRequest` existente).

**Decisões de design fixadas** (confirmadas com o dono do projeto, 2026-06-16):
1. **Duas fases** — saída da origem quando a Guia parte; entrada no destino quando a entrega é confirmada. Stock fica "em trânsito" entre as duas.
2. **Com aprovação** — reutiliza o fluxo `ApprovalRequest` (`requestType: 'warehouse_transfer'`). Mercadoria só sai depois de aprovada.
3. **Reutilizar `StockTransfer`** — a Guia liga-se a um `StockTransfer` via `transferId`. Toda a lógica de stock vem de `warehousesService`. A Guia é o documento de transporte imprimível.

## 3. Não-objetivos

- ❌ Guia de transferência **sem** aprovação (fica fora; é uma decisão revertível em spec futura).
- ❌ Transferência **instantânea** numa fase só (rejeitada; usamos duas fases).
- ❌ Mover stock em Guias do tipo **entrega a cliente** (`kind = 'shipment'`) — essas mantêm o comportamento atual (sem movimento; a saída deu-se na Venda/Fatura).
- ❌ Transferências multi-armazém (3+ pontos) ou cross-company.
- ❌ Substituir o ecrã de transferências existente (`StockTransferManager`). A Guia é um **canal adicional** sobre o mesmo motor.

## 4. Contrato

### 4.1 Modelo de dados (Prisma)

**Alteração ao modelo `Delivery`** ([schema.prisma:2375](../../backend/prisma/schema.prisma)):

```prisma
model Delivery {
  // ... campos existentes ...
  kind        DeliveryKind  @default(shipment)   // NOVO
  transferId  String?       @unique               // NOVO — FK para StockTransfer (1:1)
  transfer    StockTransfer? @relation(fields: [transferId], references: [id])  // NOVO
  // ...
  @@index([transferId])                           // NOVO
}

enum DeliveryKind {                                // NOVO enum
  shipment            // entrega a cliente (comportamento atual, sem stock)
  warehouse_transfer  // transferência entre armazéns (move stock via StockTransfer)
}
```

**Alteração ao modelo `StockTransfer`** — lado inverso da relação 1:1:

```prisma
model StockTransfer {
  // ... campos existentes ...
  delivery  Delivery?   // NOVO — back-relation (Guia que o transporta)
}
```

> **Por que `transferId` na `Delivery` e não armazéns diretos**: a origem/destino, itens e quantidades (Decimal) já vivem no `StockTransfer` / `StockTransferItem`. Duplicá-los na `Delivery` criaria duas fontes de verdade. A Guia só precisa do ponteiro. Regra [[data-integrity-and-validation]].

> **Migração**: aditiva e não-destrutiva. `kind` tem default `shipment`, logo todas as Guias existentes mantêm comportamento atual. Ver Fase 1.

### 4.2 API

Reutiliza as rotas de logística existentes ([backend/src/routes/logistics.ts](../../backend/src/routes/logistics.ts)), estendendo o payload.

**`POST /api/logistics/deliveries`** — criar Guia.

Request (novo caso de transferência):
```json
{
  "kind": "warehouse_transfer",
  "sourceWarehouseId": "uuid",
  "targetWarehouseId": "uuid",
  "deliveryAddress": "Armazém Central → Filial Maputo",
  "items": [
    { "productId": "uuid", "quantity": 10 }
  ],
  "driverId": "uuid?",
  "vehicleId": "uuid?",
  "scheduledDate": "2026-06-20T08:00:00Z?",
  "reason": "Reposição filial"
}
```

Comportamento: dentro de **uma transação**, cria o `StockTransfer` (draft) com os itens, submete-o (→ `pending`, gera `ApprovalRequest`), e cria a `Delivery` com `kind='warehouse_transfer'`, `transferId` ligado e `status='pending'`.

Response 201: a `Delivery` criada, incluindo `transfer` (com `status`, `number`).

Erros: `400` origem=destino, sem itens, quantidade ≤ 0, ou módulo `logistics`/`commercial` não ativo; `403` sem role; `404` armazém não pertence à empresa.

**`PATCH /api/logistics/deliveries/:id/status`** — transição de estado da Guia (já existe via `updateDeliveryStatus`). Passa a propagar para o `StockTransfer` quando `kind='warehouse_transfer'`:

| Novo status da Guia | Ação no `StockTransfer` | Efeito no stock |
|---|---|---|
| `in_transit` (parte) | `dispatchTransfer` | **Saída** da origem (`-`), reserva consumida |
| `delivered` (entregue) | `receiveTransfer` | **Entrada** no destino (`+`) |
| `failed` / `cancelled` / `returned` | `cancelTransfer` | Repõe stock conforme estado |

Erros: `400 Guia não pode partir: a transferência aguarda aprovação` (se transfer ≠ `approved` ao tentar `in_transit`); `409` reserva inconsistente.

### 4.3 Estado / eventos

**Sincronização de máquinas de estado** (Guia ⇆ Transferência):

```
Guia: pending ──(aprovação externa do transfer)──► pending/scheduled ──in_transit──► delivered
Transfer: pending ──approved──► approved ──in_transit──► received
                       │
                       └─ rejected  ⇒ Guia bloqueada de partir (fica pending)
```

- A **aprovação** acontece no fluxo de aprovações já existente (`approveTransfer`), não numa rota nova. O aprovador vê o pedido no painel de Approvals como hoje.
- A Guia só consegue transitar para `in_transit` **depois** de o transfer estar `approved` (gate de aprovação).
- Eventos Socket.IO: manter `logistics:new_delivery` (já emitido) e `approvals:created/approved/rejected` (já emitidos por `warehousesService`). Adicionar `logistics:delivery_status` no `updateDeliveryStatus` se ainda não existir.

### 4.4 Documento impresso — PDF da Guia (`GET /api/logistics/deliveries/:id/pdf`)

> O gerador atual ([backend/src/utils/pdf.generator.ts](../../backend/src/utils/pdf.generator.ts)) **não tem tabela de itens** e contém mojibake nos acentos (`Destinatrio`, `Observaces`). Esta spec substitui-o por um layout profissional, compacto e em **UTF-8 correto** ([[encoding-utf8]]).

**Objetivos de layout**:
- **Poupar espaço**: tabela densa, uma linha por item, cabeçalho a negrito, linhas alternadas (zebra) leves; cabeçalho/empresa condensados no topo; assinaturas compactas no rodapé. Maximizar itens por folha A4.
- **Largura útil A4**: ~495 pt (margens 50 pt; página 595 pt).

**Colunas da tabela de itens** (todas pedidas pelo dono do projeto):

| Coluna | Largura (pt) | Origem do dado | Alinh. |
|---|---:|---|---|
| Cód. Barras | 85 | `product.barcode` (nº; opcional imagem Code128 — ver nota) | esq. |
| Referência | 55 | `product.code` | esq. |
| Descrição | 150 | `product.name` (truncar com `…`) | esq. |
| Validade | 55 | `productBatch.expiryDate` (ou `—` se sem lote) `dd/MM/yy` | centro |
| Qtd | 35 | quantidade (Decimal, formatada por unidade) | dir. |
| Valor | 60 | valor da linha (`unitPrice × qtd`) em MT | dir. |
| Peso (kg) | 55 | peso da linha (`unitWeight × qtd`) | dir. |

Soma ≈ 495 pt. Qtd entra por ser essencial num documento de transporte, mas mantém-se estreita.

**Rodapé da tabela (totais)** — linha de resumo a negrito:
- **Total de Peso** (kg) = Σ peso das linhas.
- **Total Valor** (MT) = Σ valor das linhas.
- Nº total de itens / volumes.

**Cabeçalho** (condensado, ~2 colunas): emissor (nome, NUIT, contacto) à esquerda; nº da Guia, data de emissão, estado, e **origem → destino** (nomes dos armazéns, para `warehouse_transfer`) à direita.

**Notas de implementação**:
- Os dados dos itens vêm do `StockTransferItem` (transferência) ou `DeliveryItem` (entrega), sempre com `include` de `product` (barcode, code, name, unitWeight) e, quando aplicável, do `productBatch` (validade). Montar um `DeliveryPdfItem[]` no service antes de chamar o gerador (rota thin — [[clean-architecture]]).
- **Código de barras como imagem** (Code128) é opcional e exige dep nova (`bwip-js`, via `npm i bwip-js -w backend`). Por defeito imprime-se o **número**; a imagem fica como melhoria atrás de flag. Não adicionar a dep sem necessidade.
- Paginação: se os itens excederem a folha, criar nova página repetindo o cabeçalho da tabela (PDFKit `doc.addPage()`).
- Valores monetários: `Decimal` → `number` só na borda de apresentação; formatar `pt` com sufixo `MT`.

## 5. Regras de negócio

1. Guia com `kind='warehouse_transfer'` **exige** `sourceWarehouseId`, `targetWarehouseId` e ≥1 item; ambos os armazéns pertencem à `companyId` (multi-tenant, [[multicore]]). ⇒ teste T1.
2. `sourceWarehouseId ≠ targetWarehouseId`. ⇒ teste T2.
3. Criar a Guia cria **e submete** o `StockTransfer` (`pending`) gerando `ApprovalRequest`; nenhum stock se move nesta fase. ⇒ teste T3.
4. A Guia **não pode** transitar para `in_transit` enquanto o `StockTransfer` não estiver `approved`. ⇒ teste T4.
5. `in_transit` ⇒ `dispatchTransfer`: deduz stock do armazém **origem** (`movementType: 'transfer'`, qty negativa) e consome a reserva. Idempotente: só corre se transfer estiver `approved`. ⇒ teste T5.
6. `delivered` ⇒ `receiveTransfer`: credita stock no armazém **destino** (`movementType: 'transfer'`, qty positiva). Só corre se transfer estiver `in_transit`. ⇒ teste T6.
7. `failed`/`cancelled` ⇒ `cancelTransfer`: se `approved`, liberta reserva; se `in_transit`, repõe stock na origem (`adjustment`). ⇒ teste T7.
8. Guias `kind='shipment'` **nunca** tocam em stock (comportamento atual preservado). ⇒ teste T8.
9. Cada transição que move stock corre dentro de **uma** transação Prisma (atomicidade Guia + transfer + movimentos). ⇒ teste T9.
10. Quantidades em `Decimal` (suporte a unidades de medida fracionadas — alinhado com `unit-of-measure-billing`). Os itens canónicos são os do `StockTransferItem`, não os `DeliveryItem`. ⇒ teste T6.

## 6. Edge cases

- **Origem = destino**: `400` na criação. ⇒ T2.
- **Stock insuficiente na origem ao aprovar**: `approveTransfer` já lança `400` (disponível < pedido). A Guia fica `pending`. ⇒ T10.
- **Tentar `in_transit` antes de aprovado**: `400` com mensagem clara, sem mover stock. ⇒ T4.
- **Dupla expedição** (chamar `in_transit` duas vezes): a 2ª falha porque o transfer já não está `approved`. Sem dupla dedução. ⇒ T5.
- **Entrega parcial**: fora de âmbito nesta spec — `receiveTransfer` recebe a quantidade total expedida (usa o caminho sem `receivedItems`). Registar como follow-up.
- **Cancelar Guia em trânsito**: stock reposto na origem via `cancelTransfer`. ⇒ T7.
- **Empresa sem módulo logística/comercial**: `403`/gating do middleware. ⇒ T1 (variante).
- **Apagar Guia de transferência**: bloquear `deleteDelivery` se `transfer` não estiver em estado terminal (evita órfãos). ⇒ T11.

## 7. Critérios de aceitação

- [ ] Criar Guia `warehouse_transfer` cria `StockTransfer` `pending` + `ApprovalRequest`, sem mover stock.
- [ ] Guia não parte (`in_transit`) enquanto transfer não aprovado — erro 400 claro.
- [ ] Após aprovação, pôr Guia `in_transit` deduz stock da origem em `warehouse_stocks` e cria `StockMovement` `transfer` negativo com `reference = número da Guia/transfer`.
- [ ] Pôr Guia `delivered` credita stock no destino e cria `StockMovement` `transfer` positivo.
- [ ] Cancelar/falhar a Guia repõe stock conforme o estado.
- [ ] Guias `shipment` continuam sem qualquer movimento de stock.
- [ ] Os movimentos aparecem em `GET /api/products/stock-movements` filtrando por `type=transfer`.
- [ ] O PDF da Guia mostra a tabela compacta (Cód. Barras, Referência, Descrição, Validade, Qtd, Valor, Peso) com totais (Total Peso e Total Valor) e acentos corretos.
- [ ] `npm run typecheck` (frontend + backend) e `npm test -w backend` verdes.

## 8. Plano de implementação (passo-a-passo)

> Executar por ordem. Cada fase é commitável e deixa o `typecheck` verde.

### Fase 0 — Preparação (sem código)
- [ ] Ler [[clean-architecture]], [[data-integrity-and-validation]], [[multicore]] e a memória `project_transfer_approvals`.
- [ ] Reler `warehousesService.ts` (createTransfer/submit/approve/dispatch/receive/cancel) — é o motor que vamos reutilizar.
- [ ] Confirmar que os testes de transferência atuais passam: `npm test -w backend -- warehouses` (baseline verde).

### Fase 1 — Schema + migração (BD) ✅ CONCLUÍDA (2026-06-16)
- [x] Em [schema.prisma](../../backend/prisma/schema.prisma): enum `DeliveryKind`, campos `kind`/`transferId`/relação na `Delivery`, back-relation `delivery` em `StockTransfer`, `@@index([transferId])`.
- [x] Migração aplicada: `prisma/migrations/20260616120000_add_delivery_kind_and_transfer_link`. Aditiva — `kind` default `shipment`.
- [x] `prisma generate` — client regenerado.
- [x] **Critério cumprido**: migração aplicada sem perda; Guias existentes ficam `kind='shipment'`. `migrate status` = "up to date".

> ⚠️ **Nota operacional (descoberta nesta fase)**:
> - A BD partilhada é **Neon** (`neondb`) — confirmado.
> - `prisma migrate dev` **falha** com `P3006` ao validar na *shadow database*: a migração histórica `20260609210000_support_decimal_quantities` referencia `reservedStock` que não existe nesse ponto do replay (drift histórico **pré-existente**, alheio a esta feature). O histórico real está OK (`migrate status` = up to date).
> - **Workaround usado**: gerar SQL via `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script`, criar o ficheiro de migração manualmente e aplicar com `prisma migrate deploy` (não usa shadow DB). **Usar este método** para as próximas migrações até o histórico ser saneado.

> **Progresso 2026-06-16**: Fases 2, 3, 4, 5 e 5b **implementadas**; `npm run typecheck` (frontend + backend) verde. Helpers tx-aware: `dispatchTransferTx`/`receiveTransferTx`/`cancelTransferTx`/`createAndSubmitTransferTx` em `warehousesService`. Guia conduz o `StockTransfer` em `operations.service.ts`. PDF reescrito com tabela compacta. Frontend: toggle Entrega/Transferência + picker de produtos + badges de estado em `DeliveriesPage.tsx`.
>
> **Correção descoberta nos testes**: as transações de `createDelivery`/`updateDeliveryStatus` precisavam de `{ timeout: 30000, maxWait: 10000 }` — o default de 5s do Prisma estourava (P2028 → 504) com a latência do Neon ao encadear a lógica de transferência.
>
> **Fase 6 (testes T1–T11)**: testes escritos em `backend/src/routes/__tests__/logistics.test.ts` e endurecidos com retry (HTTP 5xx + leituras DB + setup), por causa da flakiness do Neon partilhado. Nas corridas em que a BD respondeu, os asserts de lógica passaram (até 4/8 por corrida; nenhum falhou por lógica — só por 503/timeout de ligação). **Bloqueado por infraestrutura**: o servidor Neon ficou inacessível (`Can't reach database server`, `globalSetup` desistiu após 8 tentativas). Reexecutar `npx jest src/routes/__tests__/logistics.test.ts -t "Transferência"` (de `backend/`) quando a BD estiver de pé para obter o verde completo.

### Fase 2 — Refactor para reutilização transacional (backend, sem mudança de comportamento) ✅
> `dispatchTransfer`/`receiveTransfer`/`cancelTransfer` abrem a sua própria `$transaction`. Para os chamar de dentro da transação da Guia, extrair o corpo para helpers que recebem `tx`.
- [ ] Em `warehousesService.ts`, extrair `_dispatchTransferTx(tx, companyId, transfer, userId, userName)`, `_receiveTransferTx(...)`, `_cancelTransferTx(...)`. Os métodos públicos passam a abrir a tx e delegar no helper.
- [ ] Exportar os helpers (ou um método `applyTransferTransition(tx, transferId, toStatus, actor)`) para o `logisticsService` consumir.
- [ ] **Critério**: `npm test -w backend -- warehouses` continua verde (refactor puro).

### Fase 3 — Serviço de logística (backend)
- [ ] Em [operations.service.ts](../../backend/src/services/logistics/operations.service.ts) `createDelivery`: se `kind==='warehouse_transfer'`, dentro da `$transaction`:
      1. validar origem≠destino, armazéns da empresa, itens>0;
      2. criar `StockTransfer` (draft) + itens;
      3. submeter (→ `pending` + `ApprovalRequest`) reutilizando a lógica de `warehousesService.submitTransfer` (extrair helper `tx` se preciso, como Fase 2);
      4. criar a `Delivery` com `kind`, `transferId`, `status='pending'`.
- [ ] Em `updateDeliveryStatus`: carregar `delivery` com `transfer`; se `kind==='warehouse_transfer'`, dentro da mesma `$transaction`, mapear status→transição (§4.2) e chamar o helper da Fase 2. Validar gate de aprovação (regra 4).
- [ ] Em `deleteDelivery`: bloquear se transfer não terminal (edge case T11).
- [ ] Erros sempre via `ApiError.*`; logs via `logger`.
- [ ] **Critério**: `npm run typecheck -w backend` verde.

### Fase 4 — Validação (Zod) + rota
- [ ] Em [backend/src/validation/](../../backend/src/validation/) estender o schema de criação de Delivery: `kind` opcional (default `shipment`); quando `warehouse_transfer`, exigir `sourceWarehouseId`, `targetWarehouseId`, `items` não-vazios. Usar `superRefine` para origem≠destino.
- [ ] Validar o body na rota `POST /deliveries` antes de chamar o service ([[clean-architecture]] — rota thin).
- [ ] **Critério**: pedido inválido devolve `400` com mensagem Zod.

### Fase 5 — Frontend
- [ ] API client ([frontend/src/services/api/](../../frontend/src/services/api/)): adicionar `kind` + campos de transferência ao tipo de criação de Guia.
- [ ] No formulário de criação de Guia (componente em `frontend/src/components/logistics/` ou página `pages/logistics/`): toggle "Tipo: Entrega a cliente | Transferência entre armazéns". Quando transferência, mostrar `<Select>` de armazém origem/destino e picker de produtos+quantidade. Usar componentes do design system ([[ui-ux-design]]): `Select`, `Input`, `Button`, `Card`.
- [ ] Mostrar o estado da transferência/aprovação na lista e no detalhe da Guia (badge: Aguarda aprovação / Aprovada / Em trânsito / Recebida).
- [ ] Ações destrutivas (cancelar) via `ConfirmationModal`, nunca `confirm()`.
- [ ] Invalidar as queries de stock/movimentos após transições (React Query).
- [ ] **Critério**: `npm run typecheck -w frontend` verde; fluxo manual no ecrã.

### Fase 5b — PDF profissional da Guia (backend)
- [ ] Reescrever [pdf.generator.ts](../../backend/src/utils/pdf.generator.ts) em UTF-8 correto, com a tabela de itens de §4.4 (Cód. Barras, Referência, Descrição, Validade, Qtd, Valor, Peso) + linha de totais (Total Peso, Total Valor, nº itens).
- [ ] Estender o tipo de input (`DeliveryPdfInput`) com `items: DeliveryPdfItem[]`, `sourceWarehouseName?`, `targetWarehouseName?`.
- [ ] No service que serve `GET /deliveries/:id/pdf`: carregar a Guia com itens + `product` (barcode/code/name/unitWeight) + `productBatch` (validade) e montar o `items` antes de invocar o gerador.
- [ ] Layout denso (zebra, cabeçalho condensado, assinaturas compactas) e paginação com cabeçalho repetido.
- [ ] Corrigir mojibake existente (`Destinatário`, `Observações`, etc.).
- [ ] **Critério**: PDF abre com tabela legível, totais corretos e acentos corretos.

### Fase 6 — Testes (ver §9)
- [ ] Escrever T1–T11 com o harness ([[test-harness]]: factories + `withTestTx`).
- [ ] `npm test -w backend` verde.

### Fase 7 — Fecho
- [ ] Atualizar este ficheiro: `Status: implemented` + link do commit/PR.
- [ ] Atualizar [docs/architecture/stock-movements-and-commercial-documents.md](../architecture/stock-movements-and-commercial-documents.md) §1/§3.4: a Guia de transferência **passa** a gerar movimentos `transfer`.
- [ ] (Opcional) Memória de projeto: "Guia kind=warehouse_transfer move stock via StockTransfer".

## 9. Plano de testes

| ID | Tipo | Cobertura | Ficheiro |
|---|---|---|---|
| T1 | Integração | Criação valida armazéns da empresa / itens | `__tests__/logistics.test.ts` |
| T2 | Unit | origem=destino ⇒ 400 | `logistics.*.test.ts` |
| T3 | Integração | Criar Guia ⇒ transfer `pending` + ApprovalRequest, stock inalterado | `__tests__/logistics.test.ts` |
| T4 | Integração | `in_transit` sem aprovação ⇒ 400, sem movimento | `__tests__/logistics.test.ts` |
| T5 | Integração | Aprovar→`in_transit` deduz origem + cria movimento `transfer` (-); 2ª vez não duplica | `__tests__/logistics.test.ts` |
| T6 | Integração | `delivered` credita destino (Decimal) + movimento `transfer` (+) | `__tests__/logistics.test.ts` |
| T7 | Integração | `cancelled`/`failed` repõe stock conforme estado | `__tests__/logistics.test.ts` |
| T8 | Integração | Guia `shipment` não cria nenhum `StockMovement` | `__tests__/logistics.test.ts` |
| T9 | Integração | Falha a meio ⇒ rollback total (Guia+transfer+movimento) | `__tests__/logistics.test.ts` |
| T10 | Integração | Stock insuficiente ao aprovar ⇒ 400 | `__tests__/warehouses…test.ts` (já coberto, validar) |
| T11 | Unit | Apagar Guia com transfer não-terminal ⇒ 400 | `logistics.*.test.ts` |

> Harness: usar `withTestTx` (rollback automático) e factories de `backend/src/test/`. ⚠️ Atenção à memória `project_tests_share_prod_db` — não apagar dados globais.

## 10. Riscos & rollback

- **Risco: transação aninhada** (chamar métodos que abrem `$transaction` dentro de outra). **Mitigação**: Fase 2 extrai helpers `tx`-aware antes de integrar. Não chamar métodos públicos que abram nova transação a partir de `updateDeliveryStatus`.
- **Risco: dupla contagem de stock** (Guia move + Venda/Fatura também move). **Mitigação**: movimento só ocorre para `kind='warehouse_transfer'`, que é transferência interna (sem venda associada). `shipment` nunca move. Regra 8 + T8.
- **Risco: divergência de quantidades** entre `DeliveryItem` (Int) e `StockTransferItem` (Decimal). **Mitigação**: a fonte de verdade do stock é o `StockTransferItem`; os `DeliveryItem` são opcionais/descritivos. Regra 10.
- **Risco: regra de aprovação adicionar fricção operacional**. **Mitigação**: decisão consciente do dono; reversível via spec futura (tornar aprovação opcional por `companySettings`).
- **Rollback**: migração é aditiva (`kind` default `shipment`); reverter = parar de enviar `kind='warehouse_transfer'` no frontend e/ou feature-flag por `companySettings.deliveryTransferEnabled`. Sem migração destrutiva a desfazer.

## 11. Referências de código

- Motor a reutilizar: `backend/src/services/warehousesService.ts` (`submitTransfer` ~L180, `approveTransfer` L245, `dispatchTransfer` L336, `receiveTransfer` L380, `cancelTransfer` L436).
- Guia/Delivery: `backend/src/services/logistics/operations.service.ts` (`createDelivery` L176, `updateDeliveryStatus` L218); rotas `backend/src/routes/logistics.ts` (L140+).
- Movimentos: `backend/src/services/stockService.ts` (`recordMovement`).
- Schema: `backend/prisma/schema.prisma` (`Delivery` L2375, `StockTransfer` L376, enums `DeliveryStatus` L3176 / `TransferStatus` L2764).
- Consulta de movimentos: `backend/src/services/productsService.ts` (`getMovements` L748).
