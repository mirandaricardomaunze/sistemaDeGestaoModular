# Multicore ERP

ERP multi-tenant para Moçambique. Cobre **Comercial, Farmácia, Hotelaria, Restauração, Garrafeira, Logística** + módulos core (POS, CRM, Facturação, Fiscal, RH, Financeiro).

## Layout

Monorepo **npm workspaces**:

```
sistemas/
├─ frontend/    # React 19 + Vite + TailwindCSS + TanStack Query
├─ backend/     # Node + Express + Prisma 6 + Socket.IO + BullMQ
└─ package.json # workspace orchestrator
```

A raiz é apenas orquestradora — toda a dependência de app vive no workspace correspondente. Ver [.agent/skills/monorepo-structure/SKILL.md](.agent/skills/monorepo-structure/SKILL.md) para regras.

## Setup

```bash
# 1. Instalar (do root — instala ambos workspaces)
npm install

# 2. Configurar backend
cp backend/.env.example backend/.env
# editar backend/.env (DATABASE_URL, JWT_SECRET, REDIS_URL, ...)

# 3. Gerar Prisma client + correr migrations
npm run prisma:generate -w backend
npm run prisma:migrate -w backend

# 4. (opcional) Seed inicial
npm run seed -w backend
```

## Comandos do dia-a-dia

| Acção | Comando |
|---|---|
| Dev (frontend + backend em paralelo) | `npm run dev` |
| Build (ambos) | `npm run build` |
| Type-check (ambos) | `npm run typecheck` |
| Testes (ambos) | `npm test` |
| Lint | `npm run lint` |

Para isolar um workspace, adicionar `-w frontend` ou `-w backend`. Exemplo:

```bash
npm run dev -w frontend
npm run typecheck -w backend
npm i axios -w frontend
```

## Docker

```bash
docker compose up -d            # postgres + redis + backend + frontend
docker compose logs -f backend  # acompanhar backend
docker compose down             # parar
```

## Documentação

- [CLAUDE.md](CLAUDE.md) — guia completo do projecto (stack, convenções, comandos)
- [.agent/skills/](.agent/skills/) — 17+ regras de engenharia por área (ler antes de mexer)
- [backend/README.md](backend/README.md) — detalhes do backend
- [MIGRATION_PLAN.md](MIGRATION_PLAN.md) — plano da migração para workspaces (apagar após conclusão)
