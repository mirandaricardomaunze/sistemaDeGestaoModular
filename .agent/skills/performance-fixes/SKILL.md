---
name: performance-fixes
description: "Plano passo a passo para corrigir os 5 problemas críticos de performance identificados no Multicore ERP. Segue standards de engenheiro sénior. Garante que o contexto nunca se perde entre sessões."
---

# Performance Fixes — Plano de Execução Sénior

> 🤖 **INSTRUÇÃO OBRIGATÓRIA**: Esta skill define o plano canónico de correcções de performance para o Multicore ERP. Ao receber qualquer tarefa de performance, correcção de build ou optimização de estado, **lê esta skill PRIMEIRO** e executa os passos na ordem definida. Não improvises nem saltes passos.

---

## 🗂️ Contexto do Sistema

**Stack:** Node.js + Express + Prisma (backend) | React + Vite + Zustand + TanStack Query (frontend)
**Schema Prisma:** `backend/prisma/schema.prisma` — ~100 KB, 65+ modelos, 208 índices
**Entry points:** `backend/src/index.ts` | `src/main.tsx`
**Config build:** `vite.config.ts` | `backend/tsconfig.json`

---

## 🚨 Problemas Identificados & Estado

| # | Problema | Ficheiro(s) | Estado |
|---|---|---|---|
| P1 | `tsc` backend dá OOM (heap out of memory) | `backend/package.json` | 🔴 NÃO CORRIGIDO |
| P2 | Rota `/api/bottleStore/finance` errada | `backend/src/index.ts` linha 186 | 🔴 NÃO CORRIGIDO |
| P3 | `useCRMStore` persiste dados ilimitados | `src/stores/useCRMStore.ts` | 🔴 NÃO CORRIGIDO |
| P4 | Bundle `index.js` de 1.5 MB | `vite.config.ts` | 🟡 PARCIAL |
| P5 | Audit N+1 no Prisma Extension | `backend/src/lib/prisma.ts` | 🔴 NÃO CORRIGIDO |

> **Actualiza a tabela acima** depois de cada sessão de trabalho. Marca `✅ CORRIGIDO` com a data quando terminares.

---

## 📋 Plano de Execução — Passo a Passo

### PASSO 1 — Corrigir Build do Backend (OOM) ⏱️ 5 min

**Ficheiro:** `backend/package.json`

**Problema:** O `tsc` do TypeScript aloca até 2 GB de memória com o schema Prisma de 100 KB. O Node.js usa por defeito ~512 MB, causando crash fatal.

**Diagnóstico de confirmação:**
```bash
cd backend && npm run build
# Deve mostrar: FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Correcção:**
```json
// backend/package.json — secção "scripts"
{
  "scripts": {
    "build": "node --max-old-space-size=4096 node_modules/typescript/bin/tsc",
    "build:check": "node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit"
  }
}
```

**Verificação:**
```bash
cd backend && npm run build
# Deve completar sem erros (Exit code: 0)
```

---

### PASSO 2 — Corrigir Rota BottleStore Finance ⏱️ 2 min

**Ficheiro:** `backend/src/index.ts` (linha 186)

**Problema:** O mount da rota usa kebab-case (`bottle-store/finance`) mas o frontend e os testes usam camelCase (`bottleStore/finance`). Causa 404 em vez de 200/403.

**Diagnóstico de confirmação:**
```typescript
// backend/src/index.ts — linha actual ERRADA:
app.use('/api/bottle-store/finance', bottleStoreFinanceRoutes);

// Os testes chamam:
// GET /api/bottleStore/finance/dashboard
// GET /api/bottleStore/finance/transactions
// PUT /api/bottleStore/finance/transactions/:id
```

**Correcção:**
```typescript
// backend/src/index.ts — substituir linha 186:
app.use('/api/bottleStore/finance', bottleStoreFinanceRoutes);
// Manter também o alias legacy para compatibilidade:
app.use('/api/bottle-store/finance', bottleStoreFinanceRoutes);
```

**Verificação:**
```bash
cd backend && npm test -- --testPathPattern=bottleStore
# Deve mostrar: PASS src/routes/__tests__/bottleStore.test.ts
# Testes que estavam a falhar:
# ✓ BottleStoreFinance › PUT /finance/transactions/:id updates
# ✓ BottleStore RBAC › Cashier is blocked from staff-protected reads
```

---

### PASSO 3 — Limitar Persistência do useCRMStore ⏱️ 30 min

**Ficheiro:** `src/stores/useCRMStore.ts`

**Problema:** O store persiste no `localStorage` as arrays `opportunities[]`, `campaigns[]`, e `campaignUsages[]`. Com uso real, estas podem crescer para centenas de KB, causando lentidão no boot e potencial `QuotaExceededError`.

**Diagnóstico de confirmação:**
```typescript
// Abrir DevTools → Application → Local Storage
// Procurar por chave 'crm-storage'
// Se tiver mais de 100 KB, o problema está activo
```

**Correcção — adicionar `partialize` no bloco `persist`:**
```typescript
// src/stores/useCRMStore.ts — no final do create(), dentro do persist():
{
  name: 'crm-storage',
  partialize: (state) => ({
    // APENAS persistir estágios (pequenos, raramente mudam)
    stages: state.stages,
    // NÃO persistir: opportunities, campaigns, campaignUsages, customerCRMData
    // Estes são carregados da BD via loadFunnelFromDatabase() e loadCampaignsFromDatabase()
  }),
}
```

**Verificação:**
1. Abrir DevTools → Application → Local Storage
2. Confirmar que a chave `crm-storage` só tem `stages: [...]`
3. Navegar para `/crm` — dados devem carregar normalmente da API

---

### PASSO 4 — Reduzir Bundle Index de 1.5 MB ⏱️ 1 hora

**Ficheiro:** `vite.config.ts`

**Problema:** O chunk `index-*.js` tem 1,523 KB (gzip: 467 KB) e não está separado por domínio de aplicação. O Vite avisa que chunks > 500 KB degradam performance de carregamento.

**Diagnóstico de confirmação:**
```bash
npm run build 2>&1 | grep "index-"
# Deve mostrar: dist/assets/index-*.js   1,522.96 kB
```

**Correcção — adicionar manualChunks por domínio em `vite.config.ts`:**

Dentro da função `manualChunks(id)`, ANTES do `return 'vendor'` no final, adicionar:

```typescript
// ── App Domain Chunks ────────────────────────────────────────
// Separar o código da aplicação por módulo de negócio
const appChunks: [string, string][] = [
  ['/src/components/commercial/', 'app-commercial'],
  ['/src/components/pharmacy/', 'app-pharmacy'],
  ['/src/components/logistics/', 'app-logistics'],
  ['/src/components/hospitality/', 'app-hospitality'],
  ['/src/components/restaurant/', 'app-restaurant'],
  ['/src/components/bottlestore/', 'app-bottle-store'],
  ['/src/pages/commercial/', 'app-commercial'],
  ['/src/pages/pharmacy/', 'app-pharmacy'],
  ['/src/pages/logistics/', 'app-logistics'],
  ['/src/pages/hotel/', 'app-hotel'],
  ['/src/pages/restaurant/', 'app-restaurant'],
  ['/src/pages/bottlestore/', 'app-bottle-store'],
  ['/src/stores/', 'app-stores'],
  ['/src/hooks/', 'app-hooks'],
];

for (const [pattern, chunkName] of appChunks) {
  if (normalizedId.includes(pattern)) return chunkName;
}
```

**Verificação:**
```bash
npm run build
# O chunk index-*.js deve ser < 500 KB
# Devem aparecer novos chunks: app-commercial-*.js, app-pharmacy-*.js, etc.
```

---

### PASSO 5 — Enfileirar Audit Logs via BullMQ ⏱️ 2 horas

**Ficheiro:** `backend/src/lib/prisma.ts`

**Problema:** A extensão do Prisma faz `basePrisma.auditLog.create()` fire-and-forget para **cada mutação** em 65+ modelos. Sem batching, em operações bulk gera N inserts em simultâneo.

**Diagnóstico de confirmação:**
```typescript
// backend/src/lib/prisma.ts — linha ~97
basePrisma.auditLog.create({ data: { ... } }).catch(...);
// ↑ Este pattern gera 1 query extra por cada operação CRUD
```

**Correcção — criar audit queue usando BullMQ já existente:**

**Passo 5.1:** Criar ficheiro `backend/src/queues/auditQueue.ts`:
```typescript
import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

// Só criar a queue se Redis estiver disponível
export const auditQueue = redis
  ? new Queue('audit-log', { connection: redis })
  : null;

// Worker que processa em batch
export function createAuditWorker() {
  if (!redis || !auditQueue) return null;

  return new Worker(
    'audit-log',
    async (job) => {
      const { userId, userName, action, entity, entityId, newData, companyId } = job.data;
      // Import aqui para evitar circular dependency
      const { prisma: basePrisma } = await import('../lib/prisma');
      await basePrisma.auditLog.create({
        data: { userId, userName, action, entity, entityId, newData, companyId },
      });
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: { max: 50, duration: 1000 }, // 50 writes/segundo máximo
    }
  );
}
```

**Passo 5.2:** Em `backend/src/lib/prisma.ts`, substituir o fire-and-forget:
```typescript
// ANTES (problemático):
basePrisma.auditLog.create({ data: { ... } }).catch(...);

// DEPOIS (enfileirado):
import { auditQueue } from '../queues/auditQueue';

if (auditQueue) {
  auditQueue.add('write', {
    userId: context?.userId,
    userName: context?.userName || 'Sistema (Autónomo)',
    action: operation.toUpperCase(),
    entity: model,
    entityId: auditId,
    newData: operation !== 'delete' ? (tArgs.data as object | undefined) : undefined,
    companyId,
  }, { removeOnComplete: 100, removeOnFail: 50 }).catch((err: unknown) => {
    logger.error('CRITICAL: Failed to enqueue audit log', { error: err, model, operation });
  });
} else {
  // Fallback se Redis não disponível: escrever directamente (comportamento anterior)
  basePrisma.auditLog.create({ data: { ... } }).catch(...);
}
```

**Passo 5.3:** Iniciar o worker em `backend/src/index.ts`:
```typescript
import { createAuditWorker } from './queues/auditQueue';
// Dentro da função start():
const auditWorker = createAuditWorker();
if (auditWorker) logger.info('Audit worker started');
```

**Verificação:**
```bash
cd backend && npm run dev
# Deve mostrar: "Audit worker started (Redis connected)"
# Fazer uma operação CRUD qualquer
# Em Redis: LRANGE bull:audit-log:wait 0 -1
# Deve mostrar entradas a serem processadas
```

---

## ✅ Checklist Final Pós-Correcção

Após completar todos os passos, executar a verificação final:

```bash
# 1. Build backend sem OOM
cd backend && npm run build
# Expected: Exit code 0

# 2. Testes backend
cd backend && npm test
# Expected: BottleStore tests PASS

# 3. Build frontend com chunks menores
cd .. && npm run build
# Expected: Nenhum chunk > 500 KB (ou apenas xlsx/recharts que são third-party)

# 4. Lint
npm run lint
# Expected: 0 errors

# 5. Verificar localStorage
# DevTools → Application → Local Storage → crm-storage
# Expected: Apenas { stages: [...] }
```

---

## 🧠 Contexto Adicional para Não Perder

### Rotas montadas no backend (index.ts)
```
POST/GET /api/auth           → authRoutes
GET/POST  /api/sales         → salesRoutes
GET/POST  /api/commercial    → commercialRoutes
GET/POST  /api/bottleStore   → bottleStoreRoutes        (camelCase!)
GET/POST  /api/bottleStore/finance → bottleStoreFinanceRoutes  (após P2)
GET/POST  /api/pharmacy      → pharmacyRoutes
GET/POST  /api/logistics     → logisticsRoutes
```

### Stores Zustand e o que persistem
```
useStore.ts       → theme, sidebarOpen, businessType, alertConfig, companySettings, cart
useCRMStore.ts    → APENAS stages[] (após P3)
useFiscalStore.ts → taxConfigs, irpsBrackets, retentions, fiscalReports, deadlines
useAuthStore.ts   → token, user, permissions
useAuditStore.ts  → logs locais (paginated via server-side)
```

### Bundle chunks gerados (vite.config.ts)
```
react-vendor     → react, react-dom, scheduler
router           → react-router-dom
tanstack         → @tanstack/*
recharts         → recharts
xlsx             → xlsx
pdf-vendor       → jspdf
scanner-vendor   → html5-qrcode
map-vendor       → leaflet, react-leaflet
app-commercial   → pages/commercial/ + components/commercial/
app-pharmacy     → pages/pharmacy/ + components/pharmacy/
... etc
```
