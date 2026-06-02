# Multicore ERP — Project Guide

ERP multi-tenant para Moçambique. Cobre Comercial, Farmácia, Hotelaria, Restauração, Garrafeira, Logística + módulos core (POS, CRM, Facturação, Fiscal, RH, Financeiro).

## Layout — npm workspaces monorepo

Frontend e backend são **packages independentes** em [frontend/](frontend/) e [backend/](backend/). A raiz é apenas **orquestradora**. Ver [.agent/skills/monorepo-structure/SKILL.md](.agent/skills/monorepo-structure/SKILL.md) para regras invioláveis.

## Stack

- **Frontend** ([frontend/](frontend/)): React 19, TypeScript, Vite, TailwindCSS, React Query, Zustand (apenas state cliente — não usar para listas), React Hook Form + Zod
- **Backend** ([backend/](backend/)): Node.js + Express + TypeScript, Prisma 6 (PostgreSQL/Supabase), Socket.IO, BullMQ + Redis, Winston
- **Pacotes-chave**: jsPDF (PDFs), Dexie (IndexedDB offline), Leaflet (mapas), Recharts (charts)

## Regras de Git e Seguranca do Agente

- O agente NUNCA deve fazer `git add`, `git commit` ou `git push` de dados sensiveis: `.env`, `.env.production`, credenciais, tokens, JWT secrets, DATABASE_URL, chaves Supabase/OpenAI/Gemini, dumps de BD, logs com PII ou ficheiros gerados com dados reais.
- O agente NUNCA deve fazer commit ou push de skills/instrucoes do agente (`.agent/skills/`, `.agents/skills/`, `.claude/`, `CLAUDE.md` ou ficheiros equivalentes) sem pedido explicito do dono do projecto para versionar essas regras.
- Antes de qualquer commit/push autorizado, o agente deve executar `git status --short`, rever o diff preparado e confirmar que nenhum segredo, dado real de cliente ou skill/instrucao privada esta incluido.
- Se encontrar segredo ja rastreado pelo Git, o agente deve parar, avisar o dono do projecto e propor remocao/rotacao; nao deve mascarar nem publicar o segredo.

## Comandos (sempre do root)

| Acção | Comando |
|---|---|
| Dev (frontend + backend) | `npm run dev` |
| Dev só frontend | `npm run dev -w frontend` |
| Dev só backend | `npm run dev -w backend` |
| Build (ambos) | `npm run build` |
| Build frontend | `npm run build -w frontend` |
| Type-check (ambos) | `npm run typecheck` |
| Type-check frontend | `npm run typecheck -w frontend` |
| Type-check backend | `npm run typecheck -w backend` (usar `NODE_OPTIONS=--max-old-space-size=6144` se necessário) |
| Testes | `npm test` |
| Testes backend | `npm test -w backend` |
| Lint | `npm run lint` |
| Prisma migrate | `npm run prisma:migrate -w backend` |
| Prisma generate | `npm run prisma:generate -w backend` |
| Adicionar dep frontend | `npm i <pkg> -w frontend` |
| Adicionar dep backend | `npm i <pkg> -w backend` |

**Nunca** instalar deps de app no root — só ferramentas de repo (ESLint, TypeScript, concurrently).

## Estrutura

```
sistemas/                          # workspace root
├─ package.json                    # workspaces=[frontend,backend], scripts orquestradores, overrides
├─ package-lock.json               # único lockfile do monorepo
├─ docker-compose.yml              # postgres, redis, backend, frontend
├─ eslint.config.js                # config única — paths apontam para frontend/src/** e backend/src/**
├─ CLAUDE.md, README.md
├─ .agent/skills/                  # 17 SKILL.md — regras de engenharia
├─ scripts/                        # utilitários do repo (mojibake)
│
├─ frontend/                       # workspace: React/Vite
│  ├─ package.json                 # só deps de frontend
│  ├─ vite.config.ts, tsconfig*.json, tailwind/postcss configs
│  ├─ Dockerfile, nginx.conf
│  ├─ index.html, public/
│  └─ src/
│     ├─ pages/                    # Routed pages (lazy via React.lazy)
│     │  ├─ commercial/, pharmacy/, hospitality/, ...
│     ├─ components/ui/            # Sistema de design (Button, Modal, ConfirmationModal, ...)
│     ├─ components/<feature>/     # Componentes de domínio
│     ├─ hooks/                    # React Query hooks + custom hooks
│     ├─ services/api/             # Axios clients tipados
│     ├─ stores/                   # Zustand (auth, preferências, offline queue)
│     ├─ contexts/                 # TenantContext, Theme, etc.
│     └─ db/, utils/
│
└─ backend/                        # workspace: Node/Express
   ├─ package.json                 # só deps de backend
   ├─ tsconfig.json, jest.config.js
   ├─ Dockerfile, .dockerignore
   ├─ prisma/                      # schema, migrations, seed
   ├─ scripts/                     # admin scripts (fiscal, mojibake do backend)
   └─ src/
      ├─ routes/                   # Thin Express handlers — delegam para services
      ├─ services/                 # Lógica de negócio (única camada que toca em Prisma)
      ├─ middleware/               # auth, module-gating, rate limit, errors
      ├─ lib/                      # prisma, socket, redis
      ├─ validation/               # Zod schemas por domínio
      ├─ utils/                    # pagination helpers, logger
      ├─ queues/                   # BullMQ workers
      └─ constants/                # módulos, planos, fiscal
```

## Convenções

### Multi-tenancy
- Todas as queries são scoped por `companyId` automaticamente via Prisma extension em [backend/src/lib/prisma.ts](backend/src/lib/prisma.ts). Não duplicar `where: { companyId }` quando o middleware já injecta.
- `req.companyId` vem do JWT (middleware `auth.ts`).
- Módulos por empresa em `CompanyModule`. Frontend usa `useTenant().hasModule('pharmacy')` para gating.

### Backend
- Routes **thin**: validam input (Zod), chamam service, devolvem JSON.
- Services contêm a lógica; testáveis em isolamento.
- Erros via `ApiError.badRequest/notFound/forbidden/internal` (nunca `throw new Error()`).
- Pagination: `getPaginationParams(req.query)` + `createPaginatedResponse()`. Cap a **2000** ([utils/pagination.ts](backend/src/utils/pagination.ts)).
- Logs: `logger.info/warn/error` (Winston). Nunca `console.log`.

### Frontend
- **TanStack Query** para todos os reads (`useQuery`, `useInfiniteQuery`). Nunca guardar listas em Zustand.
- **Zustand** apenas para state cliente (auth, UI, offline queue).
- **ConfirmationModal** ([frontend/src/components/ui/ConfirmationModal.tsx](frontend/src/components/ui/ConfirmationModal.tsx)) para confirmações destrutivas — **nunca** `window.confirm/prompt/alert`.
- Páginas via `React.lazy()` para code-splitting.
- Listas > 200 linhas → `VirtualTable` / `VirtualList`.
- Prefetches de boot deferidos via `requestIdleCallback`.

### Money & IVA
- Sempre `Decimal` no Prisma; nunca `Float` para valores monetários.
- Conversão para `number` apenas na borda da apresentação.
- Helpers em [frontend/src/utils/money.ts](frontend/src/utils/money.ts) (`toCents`, `toMoney`, `applyPercent`).

### POS / Catálogo
- `product.price` = preço da **CAIXA**; `packSize` = unidades por caixa; stock e `SaleItem.quantity` em **unidades**.
- POS converte caixa → unidade antes de enviar para a API.
- Catálogo é carregado uma vez com `limit: 2000` e a busca é client-side (ver [frontend/src/pages/commercial/CommercialPOS.tsx](frontend/src/pages/commercial/CommercialPOS.tsx)).

## Padrões de UI

- Botões: `<Button variant="primary|outline|ghost|danger|success" size="xs|sm|md|lg">`. Nunca `<button>` raw.
- Inputs: `<Input>`, `<Select>`, `<Textarea>`. Nunca `<input>`/`<select>` raw.
- Cards: `<Card>` com `p-4/p-6` consistente.
- Dark mode obrigatório: cada classe de cor tem variante `dark:`.
- Iconografia: Heroicons v2 (`react-icons/hi2`).

## Skills

A pasta [.agent/skills/](.agent/skills/) tem **20+ SKILL.md** com regras detalhadas. Ler o relevante antes de tocar numa área:

- `spec-driven` — template leve para spec antes de código (features que tocam $/stock/fiscal/API)
- `test-harness` — factories + `withTestTx` (rollback automático) + mocks em [backend/src/test/](backend/src/test/)
- `design-system` — inventário operacional dos componentes em [frontend/src/components/ui/](frontend/src/components/ui/) + processo para adicionar (cheat-sheet de [[ui-ux-design]])
- `monorepo-structure` — layout npm workspaces, regras de packages
- `security-and-auth` — JWT, bcrypt, rate limit, secrets
- `data-integrity-and-validation` — Zod, transações, FK
- `performance-and-caching` — N+1, pagination, virtualização, cache
- `clean-architecture` — separação rotas/serviços
- `multicore` — isolamento por `companyId`
- `offline-mode` — IndexedDB, sync queue, reservas de série
- `ui-ux-design` — sistema de design
- `testing-standards` — coverage, tipos de testes (complementa [[test-harness]])
- `observability-and-logs` — Winston, sem PII
- `documentation-standards` — TSDoc em APIs públicas
- `producao-readiness` — checklist pré-deploy
- `saft-xml`, `inventario-fisico`, `payroll-unificado`, `plano-de-contas` — domínios específicos
- `encoding-utf8` — UTF-8 sem BOM em código
- `performance-fixes` — issues já resolvidos (referência histórica)

Specs em [docs/specs/](docs/specs/) — uma por feature não-trivial, seguindo o template de `spec-driven`.

## Workflow

1. Ler o skill relevante antes de mexer numa área.
2. Backend: route → service → Prisma. Validar com Zod no início da route.
3. Frontend: API client → React Query hook → componente. Estado cliente em Zustand.
4. Antes de marcar tarefa completa: `npm run typecheck` (frontend + backend) tem de passar.
5. Listas > 200 itens: virtualizar. Endpoints `GET /lista`: paginar.
6. Acções destrutivas: `ConfirmationModal`, nunca `confirm()` nativo.
7. Deps novas: sempre via `npm i <pkg> -w frontend` ou `-w backend` — nunca no root.
