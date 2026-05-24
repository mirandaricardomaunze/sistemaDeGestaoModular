---
name: audit-alerts
description: "Sistema de alertas de auditoria — monitorização proactiva de riscos operacionais e fiscais que podem comprometer a auditoria da empresa (facturas vencidas, aprovações pendentes, encomendas paradas, sangrias não auditadas, etc.)."
---

# 🔍 Audit Alerts — Monitorização Proactiva de Riscos

> 🤖 **AI INSTRUCTION (MANDATORY)**: Qualquer nova feature que envolva estado pendente (aprovação, fluxo intermédio, documento sem fechar) deve ser avaliada se merece um detector de auditoria. Detectores escalam exponencialmente com complexidade — quando adicionas estado novo, adiciona o detector na mesma PR para evitar dívida de monitorização.

## 1. Filosofia

Riscos de auditoria são **dívida silenciosa**: o sistema continua a funcionar normalmente, mas no fim do ano fiscal aparecem 200 facturas vencidas há meses, 30 aprovações esquecidas, sangrias sem aprovação e turnos abertos há semanas. Quando o auditor chega, é tarde demais.

A solução **não é mais um dashboard que ninguém abre** — é levar a informação ao utilizador através do `NotificationCenter` (sino) + email digest diário ao gestor. O utilizador clica no alerta → vai directo ao registo problemático → resolve. Cada alerta resolvido fecha-se automaticamente no próximo scan.

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│ Cron horário (BullMQ ou node-cron)                              │
│ ▼                                                                │
│ auditAlertsService.scanAll(companyId)                           │
│   ├─ scanInvoicesOverdue()      → cria Alert(module='audit')   │
│   ├─ scanApprovalsPending()                                     │
│   ├─ scanOrdersStuck()                                          │
│   ├─ scanShiftsOpenTooLong()                                    │
│   ├─ scanMovementsNoApproval()                                  │
│   ├─ scanNegativeStock()                                        │
│   ├─ scanInvoicesNoWarehouse()                                  │
│   └─ scanSalesNoFiscalNumber()                                  │
│ ▼                                                                │
│ Alert table (deduplicado por sourceType + sourceId)             │
│ ▼                                                                │
│ ├─ NotificationCenter (frontend, badge no sino)                 │
│ └─ Cron diário 07:00 → email digest aos managers/admins         │
└─────────────────────────────────────────────────────────────────┘
```

### Princípios não-negociáveis

- **Idempotente**: o scan corre de hora em hora. Cada alerta tem chave única `audit:${type}:${sourceId}` — não cria duplicados.
- **Auto-resolver**: quando o problema é corrigido (fatura paga, aprovação dada, encomenda completa), o próximo scan marca o alerta como `resolved` automaticamente.
- **Não bloqueia**: scan corre em background, falhar uma query não pode rebentar o cron.
- **Multi-tenant**: scan corre por `companyId`, isolamento total.
- **Configurável por role**: cada role tem prefs (mostrar X / não mostrar Y), persistido em `NotificationPreference` (tabela nova).

## 3. Tipos de risco e regras de detecção

| Risco | Trigger | Prioridade | Auto-resolve quando |
|---|---|---|---|
| **Fatura vencida** | `Invoice.dueDate < now AND status IN (sent, partial, overdue) AND amountDue > 0` | `high` se ≤30d, `critical` se >30d | `status='paid'` ou `cancelled` |
| **Nota de Crédito pendente** | `CreditNote.status='draft'` criada há >24h | `medium` | `status IN (issued, refunded)` |
| **Nota de Débito pendente** | `DebitNote.status='draft'` criada há >24h | `medium` | `status IN (issued, settled)` |
| **Aprovação pendente** | `ApprovalRequest.status='pending' AND requestedAt < now - 24h` | `high` se ≥48h, `medium` antes | `status IN (approved, rejected)` |
| **Encomenda parada** | `CustomerOrder.status IN (printed, separated) AND updatedAt < now - 72h` | `medium` | `status IN (completed, cancelled)` |
| **Pedido de cancelamento pendente** | `OrderCancellationRequest.status='pending' AND requestedAt < now - 24h` | `high` | decisão tomada |
| **Turno aberto há demasiado tempo** | `CashSession.closedAt IS NULL AND openedAt < now - 24h` | `high` | `closedAt IS NOT NULL` |
| **Sangria sem aprovação** | `CashMovement.type='sangria' AND amount > threshold AND approvalId IS NULL` | `critical` | aprovação ligada ou amount reduzido |
| **Stock negativo** | `Product.currentStock < 0` | `critical` (integridade comprometida) | `currentStock >= 0` |
| **Fatura sem armazém** | `Invoice.warehouseId IS NULL AND createdAt > '2026-05-23'` (data do feature) | `low` (informativo) | `warehouseId` definido |
| **Venda sem nº fiscal** | `Sale.fiscalNumber IS NULL AND status='completed'` | `critical` (não-conformidade fiscal) | `fiscalNumber IS NOT NULL` |
| **Discrepância de turno** | `CashSession.difference != 0 AND abs(difference) > threshold AND closedAt IS NOT NULL` | `medium` | nota de auditoria registada |
| **Documento fiscal duplicado** | mesmo `fiscalNumber + series + companyId` em >1 registo | `critical` | manualmente após investigação |

> ⚠️ **Threshold de sangria** e **threshold de discrepância** vêm de `CompanySettings.auditThresholds` (JSON). Defaults: `sangria: 5000 MTn`, `discrepancy: 100 MTn`.

## 4. Modelo de dados — extensões necessárias

### `Alert` (modelo existente — já suporta multi-módulo)

Adicionar `audit` ao enum `AlertModule`:

```prisma
enum AlertModule {
  inventory
  invoices
  hospitality
  pharmacy
  crm
  pos
  general
  audit       // ← NOVO
}
```

Campo `Alert.sourceType` + `Alert.sourceId` (já existentes) são usados como chave de dedup e para construir o link para o registo.

### `NotificationPreference` (tabela nova)

```prisma
model NotificationPreference {
  id          String   @id @default(uuid())
  companyId   String
  role        String   // 'admin' | 'manager' | 'operator' | 'cashier' | 'stock_keeper' | 'super_admin'
  module      String   // 'audit', 'invoices', ...
  alertType   String?  // null = todo o módulo; ou específico ex.: 'invoice_overdue'
  inCenter    Boolean  @default(true)  // mostrar no sino?
  inEmail     Boolean  @default(false) // incluir no digest diário?
  minPriority String   @default('low') // só notificar se prioridade >= isto
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company  @relation(fields: [companyId], references: [id])

  @@unique([companyId, role, module, alertType])
  @@index([companyId, role])
  @@map("notification_preferences")
}
```

Defaults por role (seed):
- `super_admin`, `admin`, `manager`: TUDO no sino + email digest (de tudo `medium+`)
- `operator`, `cashier`: só alertas do POS/caixa que lhes dizem respeito directamente (turno aberto, sangria sem aprovação se for deles)
- `stock_keeper`: stock negativo, fatura sem armazém

## 5. Cron jobs

### Hourly scan (`auditAlertsCron.ts`)

```ts
// cron: '0 * * * *' (top of every hour)
// Para cada companyId activo, corre auditAlertsService.scanAll(companyId).
// Wrapper try-catch por scanner — falhar um não compromete os outros.
```

### Daily email digest (`auditDigestCron.ts`)

```ts
// cron: '0 7 * * *' (07:00 todos os dias)
// Para cada role com inEmail=true:
//   1. Query Alert table: module='audit' AND status='active' AND priority >= role.minPriority
//   2. Agrupar por tipo, contar
//   3. Gerar HTML estilo:
//      "Bom dia. Pendências de auditoria que precisam da sua atenção:
//       - 5 facturas vencidas (3 críticas)
//       - 2 aprovações há >48h
//       - 1 turno aberto há 3 dias
//       [Ver detalhes →]"
//   4. Enviar para todos os users do role via mail.ts (reaproveita SMTP)
```

## 6. Backend — estrutura de pastas

```
backend/src/
├── services/
│   ├── auditAlertsService.ts      # scanAll + scanners individuais
│   └── auditDigestService.ts      # geração do email digest
├── cron/
│   ├── auditAlerts.ts             # scheduler horário
│   └── auditDigest.ts             # scheduler diário 07:00
└── routes/
    └── notificationPreferences.ts # CRUD para admin configurar prefs por role
```

## 7. Frontend

### NotificationCenter — alterações
- Adicionar `audit` ao `MODULE_CONFIG` (cor amarela/âmbar para destacar)
- Filtro novo na dropdown: "Auditoria" (mostra só module=audit)
- Ícone próprio nos cards (ex.: `HiOutlineShieldExclamation`)

### Settings → Notificações (página nova, só admin)
- Tabela: roles em linhas × tipos de alerta em colunas
- Checkbox `inCenter` / `inEmail` + dropdown `minPriority` por célula
- Botão "Repor defaults"
- Botão "Forçar scan agora" (chama `POST /api/alerts/generate/audit`)

## 8. Endpoints novos

```
POST   /api/alerts/generate/audit       # força um scan (admin only)
GET    /api/notification-preferences    # lista por companyId
PUT    /api/notification-preferences    # batch update (admin only)
POST   /api/notification-preferences/reset  # repor defaults (admin only)
```

## 9. Performance & Caching

- Cada scanner deve usar `select` projection (não trazer registos inteiros — só `id`, `status`, datas).
- Scan duma empresa com 10k facturas deve completar em <2s. Se ultrapassar, paginar com cursor.
- Não correr scanners em paralelo dentro do mesmo company — Prisma pool pode esgotar. Sequencial é OK porque o cron é horário.
- Múltiplas empresas em paralelo: limite de 5 simultâneas com BullMQ concurrency.

## 10. Testing

- Unit tests por scanner: `__tests__/auditAlertsService.test.ts`
- Cada teste: cria fixture de risco → corre scanner → assert alerta criado com prioridade correcta → resolve o risco → assert alerta auto-fechado no próximo scan
- Integration test: scanAll completa em <2s para fixture com 1000 facturas + 500 encomendas + 50 aprovações

## 11. Observabilidade

- Cada scan loga `logger.info({ companyId, durationMs, alertsCreated, alertsResolved })`
- Métricas (futuro): expor em `/api/metrics` para Prometheus
- Email digest log: `logger.info({ companyId, role, recipientCount, alertCount })`

## 12. Migração & rollout

1. Schema: adicionar `audit` ao enum + criar tabela `notification_preferences`
2. Seed: criar defaults por role para cada empresa existente
3. Deploy cron jobs (começam a correr automaticamente)
4. Frontend: filtro Auditoria visível no sino
5. Page de Settings → Notificações (só admin)
6. Monitorizar logs durante 1 semana para validar performance e false-positives
7. Activar email digest (depois de validar — começa OFF em prod até admin ligar)

## 13. Pegadinhas a evitar

- **Não enviar email digest se não houver alertas** — irritante. Skip silencioso.
- **Não enviar alertas críticos por SMS** — fora de scope (custos + complexidade); usar email + push web (futuro).
- **Não criar alerta a cada hora se nada mudou** — usar `findFirst` antes de `create` para evitar contadores inflacionados.
- **Não escrever scanners que ignorem `companyId`** — multi-tenant leak.
- **Não fazer `Promise.all` de todos os scanners** — esgota pool Prisma com volume alto.
- **Não bloquear o login com alertas** — popup ao login é tentador mas mata UX (decidido em 2026-05-23, ver memória `project-audit-alerts`).
- **Documento fiscal duplicado é incidente, não alerta** — investigação manual obrigatória, alerta serve só para sinalizar.

## 14. Skills relacionadas

- [[security-and-auth]] — RBAC para endpoints de prefs (só admin)
- [[multicore]] — isolamento por companyId em todos os scanners
- [[observability-and-logs]] — Winston, sem PII em logs
- [[performance-and-caching]] — projection, paginação, BullMQ concurrency
- [[saft-xml]] — vendas sem fiscalNumber comprometem o SAF-T → prioridade `critical`
