# Arquitetura: Movimentos de Stock vs. Documentos Comerciais

- **Tipo**: Documento de arquitetura / referência
- **Estado**: vigente
- **Data**: 2026-06-16
- **Âmbito**: Backend — relação entre documentos comerciais (Venda POS, Guia, Fatura, Nota de Crédito) e o registo de movimentos de stock (`StockMovement`).
- **Skills relacionadas**: [[clean-architecture]], [[data-integrity-and-validation]], [[multicore]], [[inventario-fisico]]

> **Objetivo deste documento**: fixar, sem perder contexto, **quais documentos comerciais geram movimento de stock e quais não geram**, para evitar regressões e decisões erradas em features futuras de inventário, fiscal (SAF-T) e auditoria.

---

## 1. Resposta direta (TL;DR)

A pergunta era: *os movimentos de stock incluem Vendas POS, Guia, Faturas e Notas de Crédito?*

| Documento | Gera `StockMovement`? | Tipo de movimento | Efeito no stock |
|---|:---:|---|---|
| **Venda POS** | ✅ Sim | `sale` | Diminui (−) |
| **Fatura** (via Encomenda) | ✅ Sim | `sale` | Diminui (−) |
| **Fatura** (direta/manual) | ✅ Sim | `sale` | Diminui (−) |
| **Nota de Crédito** (devolução) | ✅ Sim | `return_in` | Aumenta (+) |
| **Guia de Transporte** (`kind='shipment'`) | ❌ Não | — | **Nenhum** |
| **Guia de Transferência** (`kind='warehouse_transfer'`) | ✅ Sim | `transfer` | Saída origem (−) + Entrada destino (+) |

> ⚠️ **Conclusão**: Venda POS, Fatura e Nota de Crédito **estão integrados** no livro de movimentos. A Guia de **entrega a cliente** (`shipment`) não move stock (a saída deu-se na Venda/Fatura). Desde 2026-06-16, a Guia de **transferência entre armazéns** (`warehouse_transfer`) **move stock** via `StockTransfer` (2 fases + aprovação). Ver §3.4.

---

## 2. Fonte de verdade — o modelo `StockMovement`

Todo movimento passa **exclusivamente** por `StockService.recordMovement()`
([backend/src/services/stockService.ts](../../backend/src/services/stockService.ts)).
Nenhum serviço deve alterar `product.currentStock` ou `warehouse_stocks` diretamente — só via este método, que numa única operação:

1. Lê `balanceBefore` (stock atual do produto, scoped por `companyId`).
2. Atualiza o stock global do produto (`currentStock`).
3. Faz upsert atómico do stock por armazém (`warehouse_stocks`, `INSERT ... ON CONFLICT`).
4. Cria o registo `StockMovement` (audit trail).
5. Recalcula o estado do produto (`in_stock` / `low_stock` / `out_of_stock`) e dispara alertas + socket.

### 2.1 Schema (`stock_movements`)

Campos relevantes ([backend/prisma/schema.prisma:2101](../../backend/prisma/schema.prisma)):

| Campo | Tipo | Significado |
|---|---|---|
| `movementType` | `MovementType` enum | Natureza do movimento (ver §2.2) |
| `quantity` | `Decimal(10,3)` | Sempre **valor absoluto** (sinal vem de `movementType`) |
| `balanceBefore` / `balanceAfter` | `Decimal(10,3)` | Saldo antes/depois (auditoria) |
| `originModule` | `String?` | Módulo de origem (`COMMERCIAL`, `PHARMACY`, `HOTEL`, ...) |
| `referenceType` | `String?` | Categoria do documento (`SALE`, `RETURN`, `PURCHASE`, `TRANSFER`, `ADJUSTMENT`, `EXPIRY`) |
| `reference` | `String?` | Número **legível** do documento (ex.: `receiptNumber`, `invoiceNumber`, `NC-2026-0001`) |
| `reason` | `String?` | Descrição humana (ex.: `"Venda VD-2026-0001"`) |
| `productBatchId` | `String?` | Lote consumido (rastreabilidade FEFO) |
| `warehouseId` | `String?` | Armazém afetado |
| `performedBy` | `String` | Quem executou |

### 2.2 Enum `MovementType`

```
purchase | sale | return_in | return_out | adjustment | expired | transfer | loss
```

> 🔎 **Nota de rastreabilidade (dívida técnica)**: `reference` é uma **string** (número do documento), **não uma FK** para `Sale` / `Invoice` / `CreditNote`. Não há integridade referencial garantida pela BD entre o movimento e o documento de origem. Para auditoria 100% fiável, ver recomendação R3 em §7.

---

## 3. Mapeamento detalhado documento → movimento

### 3.1 Venda POS ✅

- **Onde**: [salesService.ts:669](../../backend/src/services/salesService.ts)
- **Disparo**: ao finalizar/pagar a venda, dentro da transação Prisma.
- **Movimento**: um `recordMovement` **por sub-item expandido** (preserva rastreabilidade por lote no FEFO).

```
movementType: 'sale'
quantity:     -sub.quantity        // saída
originModule: 'COMMERCIAL'
referenceType:'SALE'
reference:    receiptNumber        // ex.: VD-2026-0001
productBatchId: sub.batchId        // quando FEFO ativo
```

> Quando o FEFO está desligado, há **uma linha** por item; com FEFO ligado, há **uma linha por fatia de lote** consumida. Ver [[fefo]] / `fefo.service.ts`.

### 3.2 Fatura (Invoice) ✅

Dois caminhos em [invoicesService.ts](../../backend/src/services/invoicesService.ts):

**a) Fatura ligada a Encomenda** ([:457](../../backend/src/services/invoicesService.ts)) — liberta a reserva e baixa stock efetivo:

```
releaseReservation(...)              // destranca o reservado
movementType: 'sale'  | referenceType: 'SALE'
quantity: -item.quantity
reference: data.orderNumber
```

**b) Fatura direta/manual** ([:533](../../backend/src/services/invoicesService.ts)) — valida disponibilidade (`validateAvailability`) e baixa stock:

```
movementType: 'sale'  | referenceType: 'SALE'
quantity: -item.quantity
reference: invoice.invoiceNumber
```

> Regra de negócio: faturas **manuais** validam stock disponível antes; faturas **via encomenda** assumem que o stock já foi reservado na criação da encomenda (`ordersService.reserveStock`, [ordersService.ts:254](../../backend/src/services/ordersService.ts)).

### 3.3 Nota de Crédito (devolução) ✅

- **Onde**: [invoicesService.ts:847](../../backend/src/services/invoicesService.ts)
- **Disparo**: ao emitir NC a partir de uma fatura, por cada item devolvido com `productId`.

```
movementType: 'return_in'           // ENTRADA — stock volta
quantity: +item.quantity            // positivo
originModule: 'COMMERCIAL'
referenceType:'RETURN'
reference:    number                // ex.: NC-2026-0001
```

> A NC repõe stock (`return_in`), recalcula o `amountDue` da fatura original e atualiza o estado (`paid`/`partial`/`sent`/`draft`).

### 3.4 Guia de Transporte — depende do `kind`

A `Delivery` tem agora um campo `kind` ([schema.prisma](../../backend/prisma/schema.prisma), enum `DeliveryKind`):

**a) `kind = 'shipment'` (entrega a cliente) ❌ — NÃO gera movimento**
- A saída física de mercadoria já foi contabilizada na **Venda/Fatura**; a Guia é só o documento de transporte.

**b) `kind = 'warehouse_transfer'` (transferência entre armazéns) ✅ — move stock via `StockTransfer`**
- A Guia liga-se a um `StockTransfer` (`Delivery.transferId`) e **conduz** o motor de transferências ([warehousesService.ts](../../backend/src/services/warehousesService.ts)) em **duas fases, com aprovação**:
  - emissão → cria + submete o transfer (`pending`) + `ApprovalRequest` (nenhum stock se move);
  - Guia `in_transit` → `dispatchTransferTx` → **saída** da origem (`movementType: 'transfer'`, `-qty`);
  - Guia `delivered` → `receiveTransferTx` → **entrada** no destino (`movementType: 'transfer'`, `+qty`);
  - Guia `failed`/`cancelled` → `cancelTransferTx` (repõe conforme estado).
- Gate: a Guia não parte enquanto o transfer não estiver `approved`.
- Spec: [docs/specs/2026-06-16-guia-transferencia-armazem.md](../specs/2026-06-16-guia-transferencia-armazem.md). Implementado 2026-06-16 (typecheck verde; suite de testes pendente de uma corrida com a BD acessível).

> Implicação: para `warehouse_transfer`, os movimentos aparecem no histórico (`GET /api/products/stock-movements`, `type=transfer`). Para `shipment`, mantém-se a regra antiga (sem movimento) — evita dupla contagem com a Venda/Fatura.

---

## 4. Outras origens de movimento (contexto completo)

Para não perder o mapa global, os movimentos de stock também são gerados por:

| Origem | Serviço | Tipo |
|---|---|---|
| Compras / receção de PO | `commercial/purchaseOrder.service.ts`, `suppliersService.ts` | `purchase` (+) |
| Transferências entre armazéns | `warehousesService.ts` (requer aprovação — ver [[project_transfer_approvals]]) | `transfer` |
| Inventário físico (acerto) | `physicalInventoryService.ts` | `adjustment` |
| Lotes (entrada/expiração) | `batchesService.ts` | `purchase` / `expired` |
| Farmácia (dispensa/ajuste) | `pharmacyService.ts` | `sale` / `adjustment` |
| Garrafeira | `bottleStoreService.ts` | vários |
| Hotelaria (consumo de booking) | `routes/hospitality.ts:152` | `sale` |
| Cancelamento de encomenda | `orderCancellationService.ts` | `return_in` + liberta reserva |

---

## 5. Como os movimentos são consultados (UI)

- **Endpoint**: `GET /api/products/stock-movements` e `GET /api/products/:id/movements` → `productsService.getMovements()` ([productsService.ts:748](../../backend/src/services/productsService.ts)).
- **Filtros**: `type` (movementType), `warehouseId`, `productId`, `search` (reason/reference/nome/código), `startDate`/`endDate`. Paginado.
- **Frontend**:
  - Componente reutilizável: [StockMovementHistory.tsx](../../frontend/src/components/inventory/StockMovementHistory.tsx).
  - Página comercial: [CommercialStockMovements.tsx](../../frontend/src/pages/commercial/CommercialStockMovements.tsx) (passa `originModule="commercial"`).
  - Histórico por produto: [ProductStockHistory.tsx](../../frontend/src/components/inventory/ProductStockHistory.tsx).
- A UI mapeia cada `movementType` para badge/ícone/cor (`movementTypeConfig`). Filtro por tipo suporta todos os 8 tipos do enum.

> Como a Guia não cria `StockMovement`, **não aparece** neste histórico. Quem procurar a saída de mercadoria associada a uma Guia tem de a encontrar pela Venda/Fatura correspondente.

---

## 6. Implicações e riscos

1. **Fiscal / SAF-T (MZ)**: a Guia de Transporte é, em regra, um documento de movimentação de mercadorias relevante para a AT. Como hoje **não toca em stock nem está ligada a um `StockMovement`**, qualquer relatório de "saída de mercadoria por documento" baseado em movimentos **ignora as Guias**. Confirmar com [[saft-xml]] se a Guia precisa de ser reportada e se o stock deve sair na Guia ou na Fatura.
2. **Dupla contagem**: se no futuro a Guia passar a baixar stock, é **obrigatório** garantir que a Fatura correspondente **deixa de baixar** (ou usa `transfer`/reserva), sob risco de descontar o stock duas vezes.
3. **Rastreabilidade fraca**: `reference` é texto livre, não FK. Um relatório que cruze movimento ↔ documento depende de o número estar bem preenchido e único. Ver R3.
4. **Consistência de `originModule`**: o valor é gravado em maiúsculas pelos serviços (`'COMMERCIAL'`) mas filtros de UI usam minúsculas (`originModule="commercial"`). Confirmar normalização no `getMovements` para o filtro por módulo funcionar de forma consistente.

---

## 7. Recomendações (não implementadas)

| ID | Recomendação | Prioridade |
|---|---|---|
| R1 | Decidir e documentar (com [[saft-xml]]) se a Guia de Transporte deve gerar movimento de stock e em que momento sai a mercadoria (Guia vs. Fatura). | Alta |
| R2 | Se a Guia passar a mover stock, garantir idempotência: o par Guia↔Fatura desconta **uma só vez**. | Alta |
| R3 | Evoluir `StockMovement.reference` (string) para FKs opcionais tipadas (`saleId`, `invoiceId`, `creditNoteId`, `deliveryId`) para auditoria com integridade referencial. | Média |
| R4 | Garantir normalização case-insensitive de `originModule` no filtro de `getMovements`. | Baixa |

> ⚠️ **Antes de implementar R1/R2/R3**: abrir uma spec em `docs/specs/` seguindo [[spec-driven]] (toca em stock + fiscal). Este documento é **análise**, não autoriza alteração de comportamento.

---

## 8. Referências de código

- `backend/src/services/stockService.ts` — `recordMovement` (única porta de entrada)
- `backend/src/services/salesService.ts:669` — Venda POS
- `backend/src/services/invoicesService.ts:457,533,847` — Fatura (encomenda/manual) + Nota de Crédito
- `backend/src/services/logistics/operations.service.ts` — Guia/Delivery (**sem** movimento)
- `backend/src/services/productsService.ts:748` — consulta de movimentos
- `backend/prisma/schema.prisma:2101,3057` — modelo `StockMovement` + enum `MovementType`
