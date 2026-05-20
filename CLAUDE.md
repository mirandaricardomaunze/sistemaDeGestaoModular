# Multicore ERP — Project Guide

ERP multi-tenant para Moçambique. Cobre Comercial, Farmácia, Hotelaria, Restauração, Garrafeira, Logística + módulos core (POS, CRM, Facturação, Fiscal, RH, Financeiro).

## Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, React Query, Zustand (apenas state cliente — não usar para listas), React Hook Form + Zod
- **Backend**: Node.js + Express + TypeScript, Prisma 7 (PostgreSQL/Supabase), Socket.IO, BullMQ + Redis, Winston
- **Pacotes-chave**: jsPDF (PDFs), Dexie (IndexedDB offline), Leaflet (mapas), Recharts (charts)

## Comandos

| Acção | Comando |
|---|---|
| Dev (frontend + backend) | `npm run dev` |
| Build frontend | `npm run build` |
| Type-check frontend | `npx tsc --noEmit` |
| Type-check backend | `cd backend && npx tsc --noEmit` (usar `NODE_OPTIONS=--max-old-space-size=6144`) |
| Testes backend | `cd backend && npm test` |
| Lint | `npm run lint` |
| Prisma migrate | `cd backend && npx prisma migrate dev` |

## Estrutura

```
/
├─ src/                  # Frontend (React)
│  ├─ pages/             # Routed pages (lazy via React.lazy)
│  │  ├─ commercial/     # Módulo Comercial
│  │  ├─ pharmacy/       # Módulo Farmácia
│  │  ├─ hospitality/    # Módulo Hotelaria
│  │  └─ ...
│  ├─ components/
│  │  ├─ ui/             # Sistema de design (Button, Modal, ConfirmationModal, Card, …)
│  │  └─ <feature>/      # Componentes de domínio
│  ├─ hooks/             # React Query hooks + custom hooks
│  ├─ services/api/      # Axios clients tipados
│  ├─ stores/            # Zustand (auth, preferências, offline queue)
│  └─ contexts/          # TenantContext (multi-tenant), Theme, etc.
├─ backend/src/
│  ├─ routes/            # Thin Express handlers — delegam para services
│  ├─ services/          # Lógica de negócio (única camada que toca em Prisma)
│  ├─ middleware/        # auth, module-gating, rate limit, errors
│  ├─ lib/               # prisma, socket, redis
│  ├─ validation/        # Zod schemas por domínio
│  ├─ utils/             # pagination helpers, logger
│  ├─ queues/            # BullMQ workers
│  └─ constants/         # módulos, planos, fiscal
└─ .agent/skills/        # Regras de engenharia (16 skills) — ler antes de mexer numa área
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
- **ConfirmationModal** ([src/components/ui/ConfirmationModal.tsx](src/components/ui/ConfirmationModal.tsx)) para confirmações destrutivas — **nunca** `window.confirm/prompt/alert`.
- Páginas via `React.lazy()` para code-splitting.
- Listas > 200 linhas → `VirtualTable` / `VirtualList`.
- Prefetches de boot deferidos via `requestIdleCallback`.

### Money & IVA
- Sempre `Decimal` no Prisma; nunca `Float` para valores monetários.
- Conversão para `number` apenas na borda da apresentação.
- Helpers em [src/utils/money.ts](src/utils/money.ts) (`toCents`, `toMoney`, `applyPercent`).

### POS / Catálogo
- `product.price` = preço da **CAIXA**; `packSize` = unidades por caixa; stock e `SaleItem.quantity` em **unidades**.
- POS converte caixa → unidade antes de enviar para a API.
- Catálogo é carregado uma vez com `limit: 2000` e a busca é client-side (ver [src/pages/commercial/CommercialPOS.tsx](src/pages/commercial/CommercialPOS.tsx)).

## Padrões de UI

- Botões: `<Button variant="primary|outline|ghost|danger|success" size="xs|sm|md|lg">`. Nunca `<button>` raw.
- Inputs: `<Input>`, `<Select>`, `<Textarea>`. Nunca `<input>`/`<select>` raw.
- Cards: `<Card>` com `p-4/p-6` consistente.
- Dark mode obrigatório: cada classe de cor tem variante `dark:`.
- Iconografia: Heroicons v2 (`react-icons/hi2`).

## Skills

A pasta [.agent/skills/](.agent/skills/) tem **16 SKILL.md** com regras detalhadas. Ler o relevante antes de tocar numa área:

- `security-and-auth` — JWT, bcrypt, rate limit, secrets
- `data-integrity-and-validation` — Zod, transações, FK
- `performance-and-caching` — N+1, pagination, virtualização, cache
- `clean-architecture` — separação rotas/serviços
- `multicore` — isolamento por `companyId`
- `ui-ux-design` — sistema de design
- `testing-standards` — coverage, tipos de testes
- `observability-and-logs` — Winston, sem PII
- `documentation-standards` — TSDoc em APIs públicas
- `producao-readiness` — checklist pré-deploy
- `saft-xml`, `inventario-fisico`, `payroll-unificado`, `plano-de-contas` — domínios específicos
- `encoding-utf8` — UTF-8 sem BOM em código
- `performance-fixes` — issues já resolvidos (referência histórica)

## Workflow

1. Ler o skill relevante antes de mexer numa área.
2. Backend: route → service → Prisma. Validar com Zod no início da route.
3. Frontend: API client → React Query hook → componente. Estado cliente em Zustand.
4. Antes de marcar tarefa completa: `npx tsc --noEmit` (frontend + backend) tem de passar.
5. Listas > 200 itens: virtualizar. Endpoints `GET /lista`: paginar.
6. Acções destrutivas: `ConfirmationModal`, nunca `confirm()` nativo.
