# Spec: Faturação por Unidade de Medida (kg, L, m)

- **Status**: draft
- **Autor**: Antigravity
- **Data**: 2026-06-08
- **Skill(s) relacionadas**: [[data-integrity-and-validation]], [[clean-architecture]], [[multicore]]

## 1. Contexto

O sistema Multicore armazena todas as quantidades como `Int` (inteiro). Isso impede a faturação por peso (kg), volume (L) ou comprimento (m) — algo essencial para talhos, mercearias, postos de combustível, e material de construção. A concorrência (SAP, Odoo, TOTVS) suporta isto nativamente.

## 2. Objectivo

- Permitir configurar a unidade de medida (un, kg, L, m, etc.) por produto
- Aceitar quantidades decimais (até 3 casas) para unidades pesáveis/mensuráveis
- Manter quantidades inteiras para unidades discretas (un, cx, pç)
- Exibir quantidades formatadas profissionalmente no POS, PDFs, e SAF-T

## 3. Não-objectivos

- Conversão automática entre unidades (kg↔g, L↔mL) — spec separada
- Integração com balanças USB/Serial — spec separada
- Preços por faixa de peso (ex: 0-5kg = preço A, 5-10kg = preço B) — spec separada

## 4. Contrato

### 4.1 Modelo de dados

| Tabela | Campo | De | Para |
|---|---|---|---|
| Product | `unit` | `String @default("un")` | Sem alteração (já existe) |
| Product | `currentStock` | `Int` | `Decimal(10,3)` |
| Product | `minStock` | `Int` | `Decimal(10,3)` |
| Product | `maxStock` | `Int?` | `Decimal?(10,3)` |
| Product | `reservedStock` | `Int` | `Decimal(10,3)` |
| SaleItem | `quantity` | `Int` | `Decimal(10,3)` |
| InvoiceItem | `quantity` | `Int` | `Decimal(10,3)` |
| CustomerOrderItem | `quantity` | `Int` | `Decimal(10,3)` |
| CreditNoteItem | `quantity` | `Int` | `Decimal(10,3)` |
| DebitNoteItem | `quantity` | `Int` | `Decimal(10,3)` |
| PurchaseOrderItem | `quantity` | `Int` | `Decimal(10,3)` |
| PurchaseOrderItem | `receivedQty` | `Int` | `Decimal(10,3)` |
| WarehouseStock | `quantity` | `Int` | `Decimal(10,3)` |
| WarehouseStock | `reservedQuantity` | `Int` | `Decimal(10,3)` |
| StockMovement | `quantity` | `Int` | `Decimal(10,3)` |
| StockMovement | `balanceBefore` | `Int` | `Decimal(10,3)` |
| StockMovement | `balanceAfter` | `Int` | `Decimal(10,3)` |
| StockReservation | `quantity` | `Int` | `Decimal(10,3)` |
| StockTransferItem | `quantity` | `Int` | `Decimal(10,3)` |
| StockTransferItem | `receivedQuantity` | `Int?` | `Decimal?(10,3)` |
| SupplierInvoiceItem | `quantity` | `Int` | `Decimal(10,3)` |
| PhysicalInventoryLine | `expectedQuantity` | `Int` | `Decimal(10,3)` |
| PhysicalInventoryLine | `countedQuantity` | `Int` | `Decimal(10,3)` |
| PhysicalInventoryLine | `difference` | `Int` | `Decimal(10,3)` |
| PriceTier | `minQty` | `Int` | `Decimal(10,3)` |

### 4.2 Unidades suportadas

```typescript
un  → Unidade (inteiro)
cx  → Caixa (inteiro)
pc  → Peça (inteiro)
kg  → Quilograma (3 decimais)
g   → Grama (inteiro)
L   → Litro (3 decimais)
mL  → Mililitro (inteiro)
m   → Metro (2 decimais)
m2  → Metro quadrado (2 decimais)
```

## 5. Regras de negócio

1. Se `product.unit` é inteira (un, cx, pç, g, mL), a quantidade DEVE ser inteiro — rejeitar com 400 se tiver decimais
2. Se `product.unit` é decimal (kg, L, m, m²), aceitar até 3 casas decimais
3. O campo `unit` do produto NÃO pode ser alterado se existirem movimentos de stock
4. O preço unitário é sempre por unidade da medida configurada (MT/kg, MT/L, etc.)
5. O stock é mantido na mesma unidade do produto (não há conversão)
6. SAF-T `<UnitOfMeasure>` deve reflectir a unidade real do produto

## 6. Edge cases

- Produto "un" com quantity 0.5 → erro 400 "Quantidade deve ser inteira para produtos vendidos em unidades"
- Produto "kg" com quantity 0 → erro 400 "Quantidade deve ser maior que zero"
- Produto "kg" com quantity 0.0005 → erro 400 "Quantidade não pode ter mais de 3 casas decimais"
- Nota de crédito para item vendido em kg → manter quantidade decimal
- Transferência de stock de produto kg → aceitar decimal
- Inventário físico de produto kg → aceitar contagem decimal

## 7. Critérios de aceitação

- [ ] Produto com unit="kg" pode ser vendido no POS com quantity=0.750
- [ ] Produto com unit="un" NÃO pode ser vendido com quantity=0.5
- [ ] Stock decrementa correctamente: 10.000 - 0.750 = 9.250
- [ ] PDF da fatura mostra "0.750 kg × 850,00 MT/kg = 637,50 MT"
- [ ] SAF-T gera `<Quantity>0.750</Quantity>` e `<UnitOfMeasure>KG</UnitOfMeasure>`
- [ ] Encomenda aceita quantidade decimal para produto pesável
- [ ] Inventário físico aceita contagem decimal para produto pesável
- [ ] Formulário de produto permite escolher unidade de medida
- [ ] POS adapta input de quantidade (decimal vs inteiro) conforme a unidade do produto

## 8. Plano de testes

| Tipo | Cobertura | Ficheiro |
|---|---|---|
| Unit | Validação de quantidade vs unidade | `unitOfMeasure.test.ts` |
| Unit | Cálculo de totais com decimal | `salesService.test.ts` |
| Integração | Venda POS com kg → stock | `__tests__/sales.test.ts` |
| E2E manual | Golden path: criar produto kg, vender no POS, verificar recibo e stock | (manual) |

## 9. Riscos & rollback

- **Risco**: Migração Int→Decimal pode causar erros em queries raw que fazem `::int` cast. **Mitigação**: grep e corrigir todos os casts antes da migração.
- **Rollback**: Migração reversa `Decimal→Int` com `ROUND()` — possível mas perde precisão. Feature flag `ENABLE_DECIMAL_QUANTITIES` no companySettings para rollback soft.
