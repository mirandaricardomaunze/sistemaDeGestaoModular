---
name: offline-mode
description: "Regras canónicas para o modo offline do Multicore ERP — Dexie schema único, fila idempotente, sincronização com backoff, prefetch de catálogo e plano de execução para os 10 buracos identificados em 2026-05-20."
---

# Offline Mode — Skill Canónico

> 🤖 **INSTRUÇÃO OBRIGATÓRIA**: Antes de tocar em qualquer código que envolva IndexedDB, fila de sincronização, prefetch ou comportamento "sem rede" — lê este skill **inteiro**. Há duas implementações divergentes do offlineDB no projecto e usar a errada introduz vendas que nunca sincronizam. Não improvises.

---

## 🗂️ Contexto Real do Sistema

**Stack offline:**
- **Storage local**: Dexie.js (IndexedDB)
- **Idempotency**: header `X-Client-Operation-Id` (UUID por mutação)
- **Backoff**: exponencial com jitter, cap 5 min, máx 10 tentativas
- **Prefetch**: catálogo via `requestIdleCallback` no boot e no evento `online`
- **Backend dedupe**: middleware `idempotency` em `/api`, scoped por `companyId`, Redis com fallback para memória (TTL 24h)

**Ficheiros canónicos (usar sempre):**

| Camada | Ficheiro | Papel |
|---|---|---|
| DB schema | [src/db/offlineDB.ts](../../src/db/offlineDB.ts) | **ÚNICA fonte de verdade**. Classe `OfflineDB` (db name `OfflineDB`). v4 com `clientId`/`status`/`nextRetryAt`. |
| Queue API | [src/services/offline/offlineQueue.ts](../../src/services/offline/offlineQueue.ts) | `enqueueSale()`, `enqueueOperation()`, `retryFailed()`, `discardFailed()`, `purgeSynced()`. |
| Sync hook | [src/hooks/useOfflineSync.ts](../../src/hooks/useOfflineSync.ts) | Polling 15s, online/offline listeners, separa retryable vs permanent failures. |
| Axios interceptor | [src/services/api/client.ts](../../src/services/api/client.ts) | Stamping automático de `X-Client-Operation-Id` + auto-enqueue em network failure. |
| Catalog prefetch | [src/services/offline/catalogPrefetch.ts](../../src/services/offline/catalogPrefetch.ts) | Carrega products+customers, TTL 30 min, gravado em `catalogMeta`. |
| UI | [src/components/offline/SyncQueuePanel.tsx](../../src/components/offline/SyncQueuePanel.tsx) + badge em [Header.tsx](../../src/components/layout/Header.tsx) | Painel para retry/discard/purge. |
| Backend dedupe | [backend/src/middleware/idempotency.ts](../../backend/src/middleware/idempotency.ts) | Replay automático da resposta cacheada para o mesmo `clientId+companyId`. |

**Ficheiros LEGADOS — REMOVIDOS em 2026-05-20:**

| Ficheiro | Substituto |
|---|---|
| ~~`src/services/offline/offlineDB.ts`~~ | [src/db/offlineDB.ts](../../src/db/offlineDB.ts) |
| ~~`src/hooks/commercial/useSyncManager.ts`~~ | [src/hooks/useOfflineSync.ts](../../src/hooks/useOfflineSync.ts) |

> Bootstrap de migração one-shot vive em [src/services/offline/legacyDbMigration.ts](../../src/services/offline/legacyDbMigration.ts) — corre uma vez por instalação, copia vendas pendentes do `MulticoreOfflineDB` para `db.pendingSales`, depois apaga a DB legada e guarda flag `offline_legacy_migrated_v1` em `localStorage`. Pode ser eliminado depois de algumas semanas em produção (todos os clientes já migraram).

---

## 🚨 Buracos Identificados (2026-05-20) & Estado

| # | Buraco | Severidade | Estado |
|---|---|---|---|
| B1 | Dois `offlineDB` em coexistência (`OfflineDB` vs `MulticoreOfflineDB`) | 🔴 Crítica | ✅ CORRIGIDO (2026-05-20) |
| B2 | `CommercialPOS` enfileira vendas na DB errada e sem `clientId` | 🔴 Crítica | ✅ CORRIGIDO (2026-05-20) |
| B3 | POS deduz stock offline sem **reserva server-side** → overselling entre terminais | 🟠 Alta | ✅ CORRIGIDO (2026-05-20) |
| B4 | Catálogo não revalida ao voltar online — preço/stock podem ficar stale | 🟡 Média | ✅ CORRIGIDO (2026-05-20) |
| B5 | Módulos sem cobertura offline: Restaurante, Farmácia (batches), Hotel, Logística | 🟡 Média | ✅ CORRIGIDO (2026-05-20) (Logística fora de âmbito — driver app à parte) |
| B6 | Sem cap nem alerta quando a queue cresce demais (>500 ops) | 🟡 Média | ✅ CORRIGIDO (2026-05-20) |
| B7 | Recibo offline (`OFF-{ts}`) **não é série fiscal válida** → discrepância pós-sync | 🔴 Crítica (fiscal) | ✅ CORRIGIDO (2026-05-20) |
| B8 | `navigator.onLine === true` mas backend inacessível (captive portal, firewall) | 🟠 Alta | ✅ CORRIGIDO (2026-05-20) |
| B9 | Operações `done` acumulam-se se cleanup falhar (sem purge agendado) | 🟢 Baixa | ✅ CORRIGIDO (2026-05-20) |
| B10 | `useSyncManager` legado activo no POS — corre em paralelo com `useOfflineSync` | 🔴 Crítica | ✅ CORRIGIDO (2026-05-20) |

> **Actualizar a tabela após cada sessão.** Marcar `✅ CORRIGIDO (YYYY-MM-DD)` quando fechado.

---

## 📐 Regras Obrigatórias

### R1. UMA SÓ instância de IndexedDB
Importar **sempre** `db` de [src/db/offlineDB.ts](../../src/db/offlineDB.ts). Nunca importar de `services/offline/offlineDB.ts`. Esse ficheiro vai ser apagado em B1.

```ts
// ✅ CORRECTO
import { db } from '@/db/offlineDB';

// ❌ ERRADO — DB diferente, schema diferente, sync diferente
import { offlineDB } from '@/services/offline/offlineDB';
```

### R2. Enfileirar via API canónica, NUNCA `db.x.add()` directo
```ts
// ✅ CORRECTO
import { enqueueSale, enqueueOperation } from '@/services/offline/offlineQueue';
await enqueueSale(saleData);
await enqueueOperation({ module: 'commercial', endpoint: '/api/orders', method: 'POST', data: payload });

// ❌ ERRADO — perde clientId, status inicial errado, nextRetryAt ausente
await db.pendingSales.add({ data, timestamp: Date.now(), status: 'pending' });
```

### R3. Idempotency obrigatória em qualquer mutação
O axios interceptor estampa o header automaticamente — **não desligar** com `skipOfflineQueue: true` excepto em três casos justificados:
1. Pagamentos M-Pesa/cartão (já em `NON_QUEUEABLE` do interceptor).
2. Endpoints `/auth/*`.
3. Sync interno (`useOfflineSync` usa `skipOfflineQueue` para não re-enfileirar tentativas).

Se criares um novo endpoint que **não** pode ser deduplicado server-side, adiciona-o ao array `NON_QUEUEABLE` em [client.ts](../../src/services/api/client.ts).

### R4. Permanent vs Transient failures
O hook já distingue (`isPermanentFailure`): 4xx → `failed` (excepto 408/425/429), 5xx/network → retry com backoff. **Não inventar nova classificação**. Se uma regra de negócio precisar de comportamento diferente, fá-lo no service do backend, não no client.

### R5. Backoff: nunca mexer manualmente em `nextRetryAt`
Usar `computeNextRetry(attempts)` de [offlineDB.ts](../../src/db/offlineDB.ts). Está em base 1s, dobra, cap 5min, jitter 30%. Mexer só para corrigir o algoritmo (e nesse caso, actualiza este skill).

### R6. Catálogo offline: prefetch só, nunca write
Tabelas `db.products` e `db.customers` são **read-only do ponto de vista do utilizador**. Único writer permitido: `prefetchCatalog()`. Não escrever stock offline directamente — usar `db.pendingOperations` com payload de ajuste (ver B3 para o plano correcto).

### R7. Toast feedback obrigatório
Quando enfileiras offline, mostra um toast `📥 "Sem ligação. Operação guardada..."`. Quando sincronizas com sucesso, `🔄 "N operações sincronizadas"`. Já implementado em [useOfflineSync.ts](../../src/hooks/useOfflineSync.ts) e [client.ts](../../src/services/api/client.ts) — não duplicar nos serviços.

### R8. UTF-8 sem BOM
Como em qualquer ficheiro do projecto. Ver skill [`encoding-utf8`](../encoding-utf8/SKILL.md).

---

## 📋 Plano de Execução — Passo a Passo

### B1 + B10 — Unificar offline DB e remover `useSyncManager` ⏱️ 3-4h

**Problema:** Existem duas classes Dexie e dois hooks de sync a correr em paralelo:
- `OfflineDB` (canónica, em [src/db/offlineDB.ts](../../src/db/offlineDB.ts)) — usada por `useOfflineSync` global.
- `MulticoreOfflineDB` (legado, em [src/services/offline/offlineDB.ts](../../src/services/offline/offlineDB.ts)) — usada por `CommercialPOS` via `useSyncManager`.

**Consequência:** vendas criadas offline pelo POS vão para `MulticoreOfflineDB.syncQueue`. O `useOfflineSync` no Header lê de `OfflineDB.pendingSales`. **Nunca se cruzam**. Resultado: o badge no header mostra 0 pendentes enquanto o POS tem vendas paradas.

**Passos:**

1. **Migrar `CommercialPOS` para a queue canónica.** Em [src/pages/commercial/CommercialPOS.tsx](../../src/pages/commercial/CommercialPOS.tsx) (linha ~752):
   ```ts
   // ANTES
   await offlineDB.syncQueue.add({ type: 'SALE', data: saleData, status: 'pending', ... });

   // DEPOIS
   import { enqueueSale } from '@/services/offline/offlineQueue';
   const queued = await enqueueSale(saleData);
   saleResponse = { receiptNumber: `OFF-${queued.clientId.slice(0, 8)}` }; // ver B7
   ```

2. **Migrar leitura de catálogo offline** (linhas ~197-198 + ~762-773):
   ```ts
   // ANTES
   offlineDB.products.toArray().then(rows => setOfflineProducts(rows as POSProduct[]));

   // DEPOIS
   import { getCachedProducts, getCachedCustomers } from '@/services/offline/catalogPrefetch';
   getCachedProducts().then(rows => setOfflineProducts(rows as unknown as POSProduct[]));
   getCachedCustomers().then(rows => setOfflineCustomers(rows as unknown as POSCustomer[]));
   ```

3. **Para a dedução local de stock offline**, enfileirar uma operação em vez de escrever directo no cache (ver B3 para regras completas). Solução interim: manter dedução in-memory no estado React mas **não** persistir.

4. **Apagar `useSyncManager`** ([src/hooks/commercial/useSyncManager.ts](../../src/hooks/commercial/useSyncManager.ts)) inteiro. Substituir no POS:
   ```ts
   // ANTES
   import { useSyncManager } from '../../hooks/commercial/useSyncManager';
   const { isOnline, pendingCount } = useSyncManager(activeShift?.companyId);

   // DEPOIS
   import { useOfflineSync } from '../../hooks/useOfflineSync';
   const { isOnline, pendingCount } = useOfflineSync();
   ```

5. **Apagar [src/services/offline/offlineDB.ts](../../src/services/offline/offlineDB.ts)** (a classe `MulticoreOfflineDB`).

6. **Migração de dados existentes em produção** (para utilizadores que já têm vendas em `MulticoreOfflineDB`):
   - Adicionar bootstrap em [main.tsx](../../src/main.tsx) que lê `MulticoreOfflineDB.syncQueue`, copia para `db.pendingSales` via `enqueueSale()` com `clientId` novo (UUID), e depois `MulticoreOfflineDB.delete()`. Correr **uma vez** com flag em `localStorage`.

**Verificação:**
```bash
# Frontend
npx tsc --noEmit -p tsconfig.app.json
npm run lint

# Manual:
# 1. DevTools → Application → IndexedDB → confirmar que só existe "OfflineDB"
# 2. Fazer uma venda offline no POS → badge no header deve mostrar +1 pendente
# 3. Voltar online → toast "1 operação sincronizada" deve aparecer
```

---

### B2 — Idempotency no payload offline do POS ⏱️ 30 min

**Problema:** Mesmo após B1, o `enqueueSale` cria um `clientId` mas o backend só lê o **header** `X-Client-Operation-Id`. O sync hook ([useOfflineSync.ts:120](../../src/hooks/useOfflineSync.ts)) já passa este header — confirmar que continua a passar após B1.

**Passos:**

1. Confirmar em [useOfflineSync.ts](../../src/hooks/useOfflineSync.ts) que `syncSales` chama `salesAPI.create({...sale.data, clientId: sale.clientId})` E que `salesAPI.create` ou o axios interceptor envia o header. **Auditar `src/services/api/sales.api.ts`** — se não estiver, adicionar:
   ```ts
   await api.post('/sales', payload, {
     headers: { 'X-Client-Operation-Id': payload.clientId ?? cryptoRandomId() },
   });
   ```

2. Adicionar teste em `backend/src/routes/__tests__/sales.test.ts`:
   ```ts
   it('replays cached response on duplicate X-Client-Operation-Id', async () => {
     const clientId = uuid();
     const first = await request(app).post('/api/sales')
       .set('Authorization', `Bearer ${token}`)
       .set('X-Client-Operation-Id', clientId)
       .send(payload);
     const second = await request(app).post('/api/sales')
       .set('Authorization', `Bearer ${token}`)
       .set('X-Client-Operation-Id', clientId)
       .send(payload);
     expect(second.status).toBe(first.status);
     expect(second.headers['x-idempotent-replay']).toBe('true');
     // Should not create a second sale
   });
   ```

**Verificação:** Testes backend passam; manual: criar venda offline, voltar online — backend regista **uma só** venda mesmo que o cliente faça retry após timeout.

---

### B3 — Reserva server-side para evitar overselling offline ⏱️ 1 dia

**Problema:** Dois POS offline na mesma loja conseguem vender o mesmo produto. Após sync, o segundo gera erro 422 (stock insuficiente) mas a venda já foi feita ao cliente (talão impresso).

**Solução: reserva preditiva por shift.**

**Passos:**

1. **Backend — endpoint `/api/cash-sessions/:id/reserve-stock`** que recebe `{ productId, units }` e cria um `StockReservation` ligado ao shift. Quando o shift fecha, reservas não consumidas expiram.

2. **Frontend — no `openShift()` do POS**, reservar uma fatia de cada produto crítico (top 50 mais vendidos da loja, configurável). Pré-fatia o stock total entre terminais activos: `reserva = floor(stockTotal / N_terminais_activos) - buffer`.

3. **Quando offline**, o POS só pode vender dentro da sua reserva. Se exceder, mostrar:
   > "⚠️ Stock reservado esgotado para este turno. Volte online ou contacte o gerente."

4. **Quando sync uma venda**, o backend abate da reserva primeiro, depois do stock geral.

> Esta é a parte mais cara do plano. Se não houver tempo, mitigar com: **proibir** vendas offline de produtos com `currentStock < threshold` (ex: stock<10 → exige online).

**Verificação:** Teste de integração — duas sessões de POS, ambas offline, vendem o mesmo SKU; após sync, o segundo recebe 422 e mostra erro ao operador.

---

### B4 — Revalidação de catálogo após sync ⏱️ 1h

**Problema:** Após o cliente voltar online e sincronizar 30 vendas, o catálogo local pode estar desactualizado (preços alterados pelo gerente noutro terminal). O `prefetchCatalog` só corre no boot e no evento `online`.

**Passos:**

1. Em [useOfflineSync.ts](../../src/hooks/useOfflineSync.ts), no `syncAll()` após sucesso (linhas 152-159):
   ```ts
   if (totalSuccess > 0) {
     toast.success(...);
     await db.pendingSales.where('status').equals('done').delete();
     await db.pendingOperations.where('status').equals('done').delete();
     // 👇 NOVO: invalidar catálogo para refrescar preços/stock
     await db.catalogMeta.delete('products');
     await db.catalogMeta.delete('customers');
     void import('../services/offline/catalogPrefetch')
       .then(({ prefetchCatalog }) => prefetchCatalog(true));
   }
   ```

2. **Opcional (optimização futura)**: ETag/`If-Modified-Since` no `GET /products?limit=2000`. Backend devolve 304 quando nada mudou desde `lastSyncedAt`. Reduz banda em ~95%.

---

### B5 — Cobertura offline para módulos críticos ⏱️ 2-3 dias

**Estado actual:**
- ✅ Commercial (products, customers, sales) — coberto após B1.
- 🟡 Pharmacy: tabela `medications` declarada em [offlineDB.ts:55](../../src/db/offlineDB.ts) mas **sem prefetch** e sem cobertura de `ProductBatch`.
- ❌ Restaurante: pedidos de mesa não offlineables.
- 🟡 Hotel: tabela `rooms` declarada mas sem prefetch.
- ❌ Logística: deliveries não offlineables.

**Critério de priorização**: módulo que **fica completamente parado sem rede** > módulo que apenas perde features.

**Plano (por módulo):**
1. Adicionar tabela em [offlineDB.ts](../../src/db/offlineDB.ts) (`version(5)` com upgrade).
2. Adicionar função `prefetchX()` em [catalogPrefetch.ts](../../src/services/offline/catalogPrefetch.ts).
3. Hooks de leitura caem para `getCachedX()` quando `!isOnline`.
4. Mutações já são auto-enfileiradas pelo interceptor — confirmar que o endpoint **não** está em `NON_QUEUEABLE`.

**Não fazer**: portal cliente, módulos que dependem de pagamento online (M-Pesa), reservas hoteleiras com sincronização externa (Booking.com).

---

### B6 — Cap e alerta na queue ⏱️ 30 min

**Passos:**

1. Em [offlineQueue.ts](../../src/services/offline/offlineQueue.ts) adicionar constante `MAX_QUEUE_SIZE = 500` e verificação em `enqueueSale`/`enqueueOperation`:
   ```ts
   const total = await db.pendingSales.count() + await db.pendingOperations.count();
   if (total >= MAX_QUEUE_SIZE) {
     toast.error('Fila offline cheia (500 operações). Volta online para sincronizar antes de continuar.');
     throw new Error('OFFLINE_QUEUE_FULL');
   }
   ```

2. Em [useOfflineSync.ts](../../src/hooks/useOfflineSync.ts), expor `queueWarningLevel: 'ok' | 'warn' | 'critical'` (warn @ 200, critical @ 400).

3. Header mostra badge âmbar/vermelho quando warn/critical.

---

### B7 — Numeração fiscal offline ⏱️ 1 dia

**Problema crítico (fiscal MZ):** Talão offline gera `OFF-{timestamp}` que **não é uma série fiscal válida**. Após sync, o backend atribui número de série real. Cliente fica com talão `OFF-123456` e o sistema regista venda como `FT-2026-0042`. Inspector da AT pode considerar fraude.

**Solução: pré-reserva de blocos de série fiscal.**

**Passos:**

1. **Backend** — quando um shift abre, reservar um bloco de N (ex: 100) números da série fiscal activa para esse terminal. Marcar como `reserved_offline` em `DocumentSeries`.

2. **Frontend** — no `openShift()` do POS, receber e guardar em Dexie o `{ serie: 'FT 2026', from: 100, to: 199 }`.

3. **Quando vender offline**, atribuir o próximo número do bloco. Talão sai com `FT 2026/0103` desde o início.

4. **Quando fechar shift online**, devolver números não usados ao pool.

5. **SAF-T**: estes números já entram no XML correctamente. Ver skill [`saft-xml`](../saft-xml/SKILL.md).

> Se este plano for muito agressivo, mitigação mínima: **proibir** vendas offline para clientes com NUIT (factura fiscal obrigatória). Permitir apenas vendas a "Consumidor Final" sem NUIT em modo offline.

---

### B8 — Healthcheck para "falsamente online" ⏱️ 1h

**Problema:** `navigator.onLine === true` mas o backend está inacessível (firewall, captive portal, DNS partido). O cliente faz POST, recebe timeout, mas o sistema acha que está online e não enfileira.

**Passos:**

1. Adicionar endpoint `GET /api/health` no backend (deve responder em <100ms, sem tocar em BD).
2. Em [useOfflineSync.ts](../../src/hooks/useOfflineSync.ts), substituir `navigator.onLine` por estado derivado:
   ```ts
   const [isReachable, setIsReachable] = useState(true);
   useEffect(() => {
     const tick = async () => {
       try {
         const r = await fetch(`${API_BASE}/health`, { method: 'GET', cache: 'no-store' });
         setIsReachable(r.ok);
       } catch {
         setIsReachable(false);
       }
     };
     const i = setInterval(tick, 30_000);
     tick();
     return () => clearInterval(i);
   }, []);
   const effectiveOnline = navigator.onLine && isReachable;
   ```

3. `syncAll` corre só se `effectiveOnline === true`.

4. UI mostra estados separados: 🔴 Offline / 🟠 Sem servidor / 🟢 Online.

---

### B9 — Purge agendado de operações `done` ⏱️ 15 min

**Passos:**

1. Em [useOfflineSync.ts](../../src/hooks/useOfflineSync.ts), no `useEffect` principal, adicionar um cleanup periódico (a cada 5 min):
   ```ts
   const purgeInterval = setInterval(() => { void purgeSynced(); }, 5 * 60 * 1000);
   // ...
   return () => { clearInterval(interval); clearInterval(purgeInterval); };
   ```

2. Também correr `purgeSynced()` no boot.

---

## ✅ Checklist de Verificação Final (Após Cada Buraco Fechado)

```bash
# 1. Tipos
npx tsc --noEmit -p tsconfig.app.json
cd backend && npx tsc --noEmit

# 2. Lint
cd .. && npm run lint

# 3. Testes (com foco no que tocaste)
cd backend && npm test -- --testPathPattern=sales
cd backend && npm test -- --testPathPattern=idempotency  # se aplicável

# 4. Manual no browser
# - DevTools → Application → IndexedDB → confirmar APENAS "OfflineDB" (não "MulticoreOfflineDB")
# - Network → Offline → fazer venda → confirmar enfileiramento via badge no Header
# - Network → Online → confirmar sync automático + toast de sucesso
# - Recarregar página offline → confirmar que catálogo continua disponível
```

---

## 🧠 Decisões Arquitecturais (para não voltar a discutir)

1. **Por que Dexie e não localStorage?** Quotas maiores (~50 MB vs 5-10 MB), transactional, suporta indexes. localStorage só para preferências cliente (theme, sidebar).

2. **Por que `clientId` UUID e não auto-increment?** Auto-increment colide entre múltiplos clientes a sincronizar o mesmo registo. UUID elimina coordenação.

3. **Por que TTL de 24h no cache de idempotency?** Equilíbrio entre proteger contra retries muito atrasados (offline 1 semana) e não inflacionar o Redis. Se um cliente fica offline >24h, vendas voltam a poder duplicar — mitigação: a queue local também tem `clientId`, e o hook não retenta após `MAX_SYNC_ATTEMPTS=10`.

4. **Por que Service Worker NÃO está no plano?** O sistema **não** é uma PWA — não precisa de funcionar com a aba fechada. Adicionar SW agora aumentaria a superfície sem trazer valor. Se um dia for prioridade, abrir RFC separada (não é "fechar um buraco").

5. **Por que não CRDTs / sync framework (Replicache, Yjs)?** Custo de adopção alto, e o nosso modelo de dados (vendas append-only, stock controlado) não exige merge complexo. A abordagem queue-of-operations + idempotency cobre 95% dos casos com 5% do esforço.

---

## 📜 Histórico

| Data | Mudança |
|---|---|
| 2026-05-20 | Skill criado. Auditoria identificou 10 buracos. |
| 2026-05-20 | B1+B10 fechados: `CommercialPOS` migrado para `useOfflineSync` + `enqueueSale`, catalog reads via `getCachedProducts`/`getCachedCustomers`, dedução de stock offline passou a in-memory (state), bootstrap one-shot `migrateLegacyOfflineDB` adicionado em `main.tsx`, `services/offline/offlineDB.ts` e `hooks/commercial/useSyncManager.ts` apagados. B2 também fechado: `useOfflineSync.syncSales` passou a usar `api.request()` com header `X-Client-Operation-Id: sale.clientId` (antes chamava `salesAPI.create()` sem header, deixando o interceptor estampar UUID novo a cada retry — o que tornava a idempotency inútil em vendas). |
| 2026-05-20 | B4 fechado: após sync com sucesso, `useOfflineSync.syncAll` invalida `catalogMeta` e re-corre `prefetchCatalog(true)` — preço/stock refrescados antes da próxima venda. |
| 2026-05-20 | B6 fechado: cap de 500 operações na queue (`MAX_QUEUE_SIZE`), `OfflineQueueFullError` lançado em `enqueueSale`/`enqueueOperation`, `queueLevel` (`ok`/`warn`/`critical`/`full`) exposto pelo hook, axios interceptor e POS tratam o erro com toast específico. Limiares: warn ≥ 200, critical ≥ 400, full ≥ 500. |
| 2026-05-20 | B8 fechado: `pingBackend()` chama `/api/health` a cada 30s (timeout 5s); `useOfflineSync` agora distingue `networkOnline` (do `navigator.onLine`) de `serverReachable` (do healthcheck); `isOnline = networkOnline && serverReachable`; Header mostra três estados distintos (online/offline/sem servidor). |
| 2026-05-20 | B9 fechado: `purgeSynced()` corre no boot e depois a cada 5 min via `setInterval` separado. |
| 2026-05-20 | B7 mitigado (interim): POS bloqueia venda offline se `selectedCustomer.document` estiver definido OU `cartTotal >= 1000 MT`. Mitigação removida na entrada seguinte. |
| 2026-05-20 | B3 mitigado (interim): POS bloqueia venda offline se qualquer item tiver `currentStock < 10`. Mitigação removida na entrada seguinte. |
| 2026-05-20 | B5 parcial: schema do `OfflineDB` v5 adicionou tabela `menuItems`. Helpers `prefetchPharmacy`/`prefetchHospitality`/`prefetchRestaurantMenu` e `getCachedX` expostos. `PharmacyPOS` e `RestaurantPOS` chamam o prefetch no mount; Hotel/Logística ainda não wirados. |
| 2026-05-20 | **B7 completo**: novo modelo `DocumentSeriesReservation` (1 bloco por sessão), migration `20260520140000`. `openSession()` reserva atomicamente bloco de **100 números** da série 'FR' activa (`SELECT FOR UPDATE` + bump em `DocumentSeries.lastNumber`). `closeSession()` marca `releasedAt = now` — números não usados ficam como gaps (legalmente aceitáveis em MZ desde que rasteáveis). `salesService.create()` aceita `assignedFiscalNumber`/`assignedFiscalSeries` no payload; valida `[from,to]` + `>= nextNumber` (sem reuso) e atualiza `nextNumber`. Para vendas online dentro de sessão, consome automaticamente do bloco antes de cair para alocação global. Frontend: schema Dexie v6 adicionou `shiftFiscalReservation`; novo helper `shiftReservations.ts` com `saveShiftReservations`, `allocateNextFiscalNumber`, `consumeOfflineStock`, `clearShiftReservations`. `shiftAPI.open/close` invocam-nos automaticamente. `CommercialPOS` substituiu o guard interim pela atribuição real — talão sai com `FR A/0103` desde o início, idêntico ao que o backend regista no sync. |
| 2026-05-20 | **B3 completo**: `openSession()` reserva **5 unidades** de cada produto com `currentStock >= 10` (cap 500 SKUs por sessão) em `StockReservation`, incrementando `reservedStock` em `Product`. Reservas têm TTL de 24h. `closeSession()` apaga reservas e decrementa `reservedStock`. `salesService.create()` consome primeiro do `StockReservation` da sessão (decrement linear), só depois valida contra availability global — terminais offline têm garantia de não overselling. Frontend: schema Dexie v6 adicionou `shiftStockReservations` com índice composto `[sessionId+productId]`. POS valida disponibilidade local antes do payment e decrementa atomicamente no `consumeOfflineStock`. Guard interim de `stock < 10` removido. |
| 2026-05-20 | **B5 fechado**: `HotelDashboard` chama `prefetchHospitality()` no mount, completando Pharmacy/Restaurant/Hotel. Logística fica **fora de âmbito** — o caso de uso (driver mobile + nav offline) é uma app à parte, não cabe no padrão prefetch-de-catálogo deste skill. Se um dia for prioritário, abrir RFC. |
