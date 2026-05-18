---
name: producao-readiness
description: "Checklist e guia completo para preparar o sistema Multicore ERP para produção. Cobre segurança, configuração de ambiente, deployment Docker, monitorização e recuperação de falhas. Segue standards de Engenheiro de Sistemas Sénior."
---

# Produção Readiness — Guia de Engenheiro de Sistemas Sénior

> 🤖 **INSTRUÇÃO OBRIGATÓRIA**: Antes de qualquer deployment em produção ou tarefa relacionada com infraestrutura, configuração de ambiente, Docker, ou monitorização, **lê esta skill PRIMEIRO**. Segue a checklist na ordem definida.

---

## 🗺️ Arquitectura de Produção

```
Internet
   │
   ▼
[Nginx :80/:443]   ← SSL termination, gzip, static cache
   │
   ├── /* → /usr/share/nginx/html (React SPA)
   └── /api/* → [Backend Node.js :3001]
                      │
                 ┌────┴─────────────────────┐
                 │                          │
           [PostgreSQL :5432]         [Redis :6379]
           (dados primários)         (cache + queues)
```

**Stack de produção:**
- `docker-compose.yml` com 4 serviços: `postgres`, `redis`, `backend`, `frontend`
- Backend com `NODE_ENV=production`
- Frontend servido via Nginx com gzip e cache de 1 ano para assets

---

## 🔐 SECÇÃO 1 — Variáveis de Ambiente (CRÍTICO)

### 1.1 Variáveis Obrigatórias do Backend

Criar `backend/.env` (nunca commitar para Git):

```bash
# ─── Base de Dados ───────────────────────────────────────────
DATABASE_URL=postgresql://user:password@postgres:5432/sistema_db

# ─── Redis ───────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─── Aplicação ───────────────────────────────────────────────
NODE_ENV=production
PORT=3001
JWT_SECRET=<string-aleatória-256-bits-mínimo>
JWT_EXPIRES_IN=8h

# ─── CORS ────────────────────────────────────────────────────
ALLOWED_ORIGINS=https://teu-dominio.co.mz,https://www.teu-dominio.co.mz

# ─── Email (SMTP) ────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@empresa.co.mz
SMTP_PASS=<password-app-gmail>

# ─── Google Drive Backups ────────────────────────────────────
GDRIVE_CLIENT_ID=<oauth2-client-id>
GDRIVE_CLIENT_SECRET=<oauth2-client-secret>
GDRIVE_REFRESH_TOKEN=<refresh-token>

# ─── M-Pesa API ──────────────────────────────────────────────
MPESA_API_KEY=<chave-api-mpesa>
MPESA_BASE_URL=https://api.sandbox.vm.co.mz  # ou produção
MPESA_SERVICE_PROVIDER=<código-SP>

# ─── Telegram Alertas ────────────────────────────────────────
TELEGRAM_BOT_TOKEN=<token-bot>
TELEGRAM_CHAT_ID=<id-chat-alertas>

# ─── AI Assistant ────────────────────────────────────────────
GEMINI_API_KEY=<chave-gemini>
```

### 1.2 Variáveis do Frontend

Criar `.env` na raiz (ou passar como ARG no Docker build):

```bash
VITE_API_URL=https://teu-dominio.co.mz/api
VITE_APP_NAME=Multicore
VITE_ENV=production
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_OFFLINE=true
```

> [!CAUTION]
> **NUNCA** commitar ficheiros `.env` para o Git. Verificar que `.gitignore` inclui `.env` e `.env.*` (excluindo `.env.example`).

---

## 🐳 SECÇÃO 2 — Docker & Deployment

### 2.1 Sequência de Deployment

```bash
# 1. Gerar build do frontend
npm run build
# Verificar: dist/ gerado com PWA (sw.js + workbox-*.js)

# 2. Build do backend (verificar sem OOM — ver skill performance-fixes PASSO 1)
cd backend && npm run build && cd ..

# 3. Subir stack Docker
docker-compose up -d --build

# 4. Aguardar health checks
docker-compose ps
# Todos os serviços devem mostrar: healthy

# 5. Executar migrações da base de dados
docker-compose exec backend npx prisma migrate deploy

# 6. (Opcional) Seed inicial
docker-compose exec backend node -e "require('./dist/prisma/seed.js')"

# 7. Verificar saúde
curl https://teu-dominio.co.mz/api/health
# Expected: {"status":"OK","database":"CONNECTED"}
```

### 2.2 Problemas Conhecidos do Docker

| Problema | Causa | Solução |
|---|---|---|
| Backend crasha com OOM | `tsc` sem `--max-old-space-size` | Ver skill `performance-fixes` P1 |
| `backend` não inicia | `postgres` ainda não healthy | `depends_on: condition: service_healthy` já configurado |
| Redis não conecta | Container Redis não iniciado | `docker-compose up redis -d` primeiro |
| Frontend 404 em rotas SPA | Nginx não configurado | Nginx já tem `try_files` correcto no `nginx.conf` |

### 2.3 Dockerfile — Pontos de Atenção

```dockerfile
# Frontend Dockerfile (raiz) — IMPORTANTE:
# O VITE_API_URL é passado como build ARG, não como runtime env
# Em produção, deve apontar para o domínio público, não localhost

ARG VITE_API_URL=https://teu-dominio.co.mz/api
ENV VITE_API_URL=$VITE_API_URL
```

---

## 🗄️ SECÇÃO 3 — Base de Dados

### 3.1 Migrações

```bash
# Desenvolvimento: cria e aplica migração
cd backend && npx prisma migrate dev --name "nome-da-migracao"

# Produção: aplica migrações existentes SEM criar novas
cd backend && npx prisma migrate deploy

# Ver estado das migrações
npx prisma migrate status
```

### 3.2 Backups

O sistema tem backup automático via `backupService.ts`:
- Backup da DB para arquivo local (`backend/backups/`)
- Upload automático para Google Drive
- Cron job configurado em `backend/src/cron/automation.ts`

```bash
# Backup manual
docker-compose exec backend node -e "
  const { backupService } = require('./dist/services/backupService');
  backupService.performBackup();
"
```

### 3.3 Índices Críticos a Verificar

O schema tem **208 índices**. Os mais críticos para performance:

```sql
-- Verificar na BD se os índices existem:
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

Modelos com maior volume de queries — garantir `@@index([companyId, ...])`:
- `Sale` — `@@index([companyId, createdAt])`
- `Product` — `@@index([companyId, categoryId])`
- `AuditLog` — `@@index([companyId, createdAt])` 
- `StockMovement` — `@@index([companyId, productId, createdAt])`

---

## 🔒 SECÇÃO 4 — Segurança em Produção

### 4.1 Checklist de Segurança

```
[ ] JWT_SECRET tem mínimo 256 bits (32+ caracteres aleatórios)
[ ] ALLOWED_ORIGINS inclui APENAS domínios de produção (sem *)
[ ] express.json({ limit: '50kb' }) — protecção contra large payloads ✅ já configurado
[ ] Helmet activo com HSTS ✅ já configurado
[ ] Rate limiters activos: auth (10/15min), api (100/min), financial (20/min) ✅
[ ] HTTPS activo no domínio de produção (SSL via Let's Encrypt ou similar)
[ ] Nginx desactiva acesso a ficheiros ocultos (/.git, etc.) ✅ já configurado
[ ] Prescrições servidas apenas via rota autenticada ✅ já configurado
[ ] Token blacklisting via Redis activo ✅ (degraded se Redis em baixo)
```

### 4.2 Variáveis que NÃO Devem Aparecer em Logs

Auditar `winston` e middleware para garantir que estes campos são mascarados:
- `password`, `passwordHash`
- `jwt`, `token`, `authorization`
- `mpesa_api_key`, `smtp_pass`
- Dados de prescrições médicas (PII)

---

## 📊 SECÇÃO 5 — Monitorização & Observabilidade

### 5.1 Health Checks

```bash
# Backend health (DB connection)
GET /api/health
# → {"status":"OK","database":"CONNECTED","timestamp":"..."}

# Frontend health (Nginx)
GET /
# → HTML da SPA

# Docker health status
docker-compose ps
# → todos os serviços: healthy
```

### 5.2 Logs Estruturados (Winston)

O backend usa `winston` com output JSON estruturado:

```json
{
  "level": "info",
  "service": "sistema-backend",
  "timestamp": "2026-05-18 17:00:00",
  "method": "POST",
  "path": "/api/sales",
  "status": 201,
  "duration": 145,
  "userId": "uuid",
  "companyId": "uuid"
}
```

```bash
# Ver logs em tempo real
docker-compose logs -f backend

# Filtrar por erros
docker-compose logs backend | grep '"level":"error"'

# Ver logs das últimas 2 horas
docker-compose logs --since 2h backend
```

### 5.3 Alertas via Telegram

O sistema tem integração com bot Telegram para alertas críticos:
- Configurar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env`
- Verificar em `backend/src/services/` o serviço de notificações

### 5.4 Métricas de Performance a Monitorizar

| Métrica | Limite Aceitável | Acção se Exceder |
|---|---|---|
| Response time API | < 500ms (p95) | Adicionar índices DB ou Redis cache |
| CPU backend | < 70% sustained | Escalar horizontalmente |
| RAM backend | < 512 MB | Verificar memory leaks (stores Zustand) |
| DB connections | < 80% pool | Ajustar `connection_limit` no Prisma |
| Redis memory | < 80% | Rever TTL de cache |

---

## 🔄 SECÇÃO 6 — Recuperação de Falhas

### 6.1 Backend Caiu

```bash
# Ver último erro
docker-compose logs --tail=50 backend

# Reiniciar apenas o backend (sem parar DB)
docker-compose restart backend

# Se a DB tem dados corrompidos:
docker-compose exec backend npx prisma migrate deploy
```

### 6.2 Redis Indisponível

O sistema foi desenhado para **degradar graciosamente** sem Redis:
- Rate limiting → usa in-memory store (por processo)
- Token blacklisting → desactivado (tokens só expiram naturalmente)
- Email queue (BullMQ) → emails não são enviados
- Audit queue → fallback para write directo

```bash
# Reiniciar Redis
docker-compose restart redis

# Verificar Redis
docker-compose exec redis redis-cli ping
# Expected: PONG
```

### 6.3 Rollback de Deploy

```bash
# Parar serviços actuais
docker-compose down

# Fazer checkout da versão anterior
git checkout <tag-versão-anterior>

# Rebuild e subir
docker-compose up -d --build

# IMPORTANTE: se houve migrações, pode ser necessário reverter:
cd backend && npx prisma migrate resolve --rolled-back <nome-da-migracao>
```

---

## 🚀 SECÇÃO 7 — Optimizações de Produção Activas

### 7.1 Frontend (já configurado)
```
✅ PWA com Service Worker (Workbox)
✅ StaleWhileRevalidate para chamadas GET à API (cache 24h)
✅ Code splitting em 75+ chunks lazy-loaded
✅ Gzip compression (Nginx, level 6)
✅ Cache de 1 ano para assets estáticos (imutáveis por hash)
✅ requestIdleCallback para prefetch do catálogo offline
```

### 7.2 Backend (já configurado)
```
✅ Tenant isolation automático via Prisma Extension
✅ 208 índices no schema Prisma
✅ Rate limiting por categoria (api/financial/export)
✅ Pagination clamping (max 500 registos por query)
✅ Payload limit 50 KB (anti-DoS)
✅ Helmet com HSTS
✅ Graceful shutdown com timeout de 10s
✅ Health check endpoint /api/health
```

### 7.3 Optimizações Pendentes (ver skill performance-fixes)
```
🔴 P1: Backend build OOM — requer --max-old-space-size=4096
🔴 P2: Rota /api/bottleStore/finance — correcção de mount
🔴 P3: useCRMStore persist — limitar com partialize
🟡 P4: Bundle index.js 1.5 MB — chunking adicional
🔴 P5: Audit N+1 — migrar para BullMQ queue
```

---

## 📂 SECÇÃO 8 — Ficheiros Críticos de Infra

| Ficheiro | Propósito |
|---|---|
| `docker-compose.yml` | Orquestração de todos os serviços |
| `Dockerfile` | Build do frontend (multi-stage: node → nginx) |
| `backend/Dockerfile` | Build do backend |
| `nginx.conf` | Proxy reverso, gzip, cache, SPA routing |
| `backend/prisma/schema.prisma` | Schema da BD (~100 KB, 65+ modelos) |
| `backend/src/index.ts` | Entry point do backend, mount de todas as rotas |
| `src/main.tsx` | Entry point do frontend, lazy loading de todas as páginas |
| `vite.config.ts` | Config build, code splitting, PWA |
| `backend/tsconfig.json` | Config TypeScript do backend |

---

## ✅ Checklist Final Pré-Deploy

```
[ ] Todas as variáveis de ambiente configuradas (.env)
[ ] JWT_SECRET forte (32+ chars aleatórios)
[ ] ALLOWED_ORIGINS correcto para produção
[ ] Backend build funciona sem OOM (skill performance-fixes P1)
[ ] Frontend build sem erros (npm run build)
[ ] docker-compose up -d sobe todos os serviços: healthy
[ ] Migrações aplicadas: npx prisma migrate deploy
[ ] Health check retorna: {"status":"OK","database":"CONNECTED"}
[ ] HTTPS configurado (SSL/TLS)
[ ] Backup automático configurado (Google Drive credentials)
[ ] Logs Telegram configurados para alertas críticos
[ ] Testes de smoke: login → criar venda → gerar factura
```
