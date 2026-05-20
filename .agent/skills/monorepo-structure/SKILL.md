---
name: monorepo-structure
description: "Layout de monorepo npm workspaces (frontend/ + backend/) e regras para manter a separação física entre apps. Ler antes de adicionar dependências, mover ficheiros entre camadas, ou alterar configs de build/deploy."
---

# Monorepo Structure — Frontend / Backend Separation

> 🤖 **AI INSTRUCTION (MANDATORY)**: Antes de instalar uma dependência, mover ficheiros, ou editar `package.json`, `Dockerfile`, `docker-compose.yml`, `eslint.config.js` ou configs de TypeScript, valida que a alteração respeita as regras deste skill. Se uma instrução do utilizador viola estas regras (ex: "instala o axios no root"), responde com a alternativa correcta primeiro.

## Estado actual

O projecto é um **npm workspaces monorepo** com dois packages independentes:

- `frontend/` — aplicação React/Vite (UI, PWA, offline-first)
- `backend/` — API Node.js/Express + Prisma + BullMQ

A raiz (`/`) é apenas **orquestrador de workspaces**. Não é uma app.

## Layout autoritativo

```
sistemas/                          # workspace root — orquestrador
├─ package.json                    # workspaces: ["frontend", "backend"]; scripts orquestradores; ferramentas partilhadas
├─ package-lock.json               # único lockfile do monorepo
├─ docker-compose.yml              # services: postgres, redis, backend, frontend
├─ eslint.config.js                # config única (paths apontam para frontend/src/** e backend/src/**)
├─ .gitignore                      # cobre raiz + ambos workspaces
├─ CLAUDE.md, README.md            # documentação do projecto
├─ .agent/skills/                  # skills (este ficheiro vive aqui)
├─ scripts/                        # utilitários do repo (mojibake check, etc.)
│
├─ frontend/                       # workspace: React/Vite
│  ├─ package.json                 # SÓ deps de frontend (react, vite, tanstack, dexie, …)
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ tsconfig.json + tsconfig.app.json + tsconfig.node.json
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  ├─ Dockerfile                   # build do frontend (multi-stage: build → nginx)
│  ├─ nginx.conf
│  ├─ public/
│  ├─ src/                         # código React (pages/, components/, hooks/, services/, …)
│  └─ dist/                        # output do vite build (gitignored)
│
└─ backend/                        # workspace: Node/Express
   ├─ package.json                 # SÓ deps de backend (express, prisma, bullmq, …)
   ├─ tsconfig.json
   ├─ Dockerfile
   ├─ jest.config.js + jest.setup.ts
   ├─ prisma/                      # schema, migrations, seed
   ├─ scripts/                     # scripts admin do backend
   ├─ src/                         # código backend (routes/, services/, lib/, …)
   ├─ logs/                        # output do winston (gitignored)
   ├─ uploads/                     # uploads recebidos (gitignored)
   ├─ backups/                     # backups gerados (gitignored)
   └─ dist/                        # output do tsc (gitignored)
```

## Regras invioláveis

### 1. Isolamento físico entre apps

- **Frontend e backend NUNCA se importam mutuamente.** Não há `import` no frontend que aponte para `backend/src/...` nem vice-versa. A única ponte é HTTP (Axios no frontend → Express no backend) ou Socket.IO.
- **Tipos partilhados são duplicados conscientemente.** Cada workspace mantém os seus próprios Zod schemas e tipos. Se a duplicação se tornar dor real (3+ ocorrências do mesmo schema), criar um terceiro workspace `shared/` — não improvisar com paths relativos `../../backend/...`.

### 2. Dependências por workspace

- **Toda a dep de frontend vive em `frontend/package.json`.** React, Vite, Tailwind, TanStack Query, Dexie, axios cliente, jspdf, etc.
- **Toda a dep de backend vive em `backend/package.json`.** Express, Prisma, BullMQ, Socket.IO server, etc.
- **Root `package.json` só pode ter:**
  - `"workspaces": ["frontend", "backend"]`
  - Scripts orquestradores (`dev`, `build`, `test`, `lint`)
  - Ferramentas que operam sobre o repo inteiro: `concurrently`, ESLint base + plugins, TypeScript (versão única para todo o monorepo), Prettier
- **Proibido:** instalar `@prisma/client`, `react`, `vite`, ou qualquer dep de runtime de uma app no root. Se aparecer, é um cheiro: mover para o workspace correcto.

### 3. Comandos

Sempre via flag `-w` no root, ou `cd` para o workspace:

| Acção | Comando (do root) |
|---|---|
| Dev (ambos em paralelo) | `npm run dev` |
| Dev só frontend | `npm run dev -w frontend` |
| Dev só backend | `npm run dev -w backend` |
| Build frontend | `npm run build -w frontend` |
| Build backend | `npm run build -w backend` |
| Type-check frontend | `npm run typecheck -w frontend` (`tsc --noEmit`) |
| Type-check backend | `npm run typecheck -w backend` |
| Testes | `npm test` (orquestra ambos) |
| Adicionar dep frontend | `npm install <pkg> -w frontend` |
| Adicionar dep backend | `npm install <pkg> -w backend` |
| Adicionar dep root (rara!) | `npm install <pkg> -w . --include-workspace-root` ou `npm install <pkg> --workspace-root` |

### 4. Configs — onde cada ficheiro vive

| Ficheiro | Localização | Porquê |
|---|---|---|
| `vite.config.ts` | `frontend/` | É config de frontend |
| `tailwind.config.js`, `postcss.config.js` | `frontend/` | UI styling, só do frontend |
| `index.html` | `frontend/` | Entry-point do Vite |
| `tsconfig.json` (frontend) | `frontend/` | Compilação de `frontend/src` |
| `tsconfig.json` (backend) | `backend/` | Compilação de `backend/src` |
| `prisma/` | `backend/` | Schema e migrações |
| `jest.config.js` | `backend/` | Testes backend |
| `Dockerfile` (frontend) | `frontend/` | Build context = `frontend/` |
| `Dockerfile` (backend) | `backend/` | Build context = `backend/` |
| `nginx.conf` | `frontend/` | Acompanha o Dockerfile do frontend |
| `docker-compose.yml` | raiz | Orquestra ambos os services |
| `eslint.config.js` | raiz | Config única; `files` aponta para `frontend/src/**` e `backend/src/**` |
| `.gitignore` | raiz | Cobre os dois workspaces |

### 5. Docker

- `docker-compose.yml` define `frontend.build.context: ./frontend` e `backend.build.context: ./backend`.
- Cada `Dockerfile` faz `COPY package*.json ./` e `npm ci` **dentro do seu próprio workspace** — não copiar o `package.json` do root para dentro de um container de app.
- Em CI, build em paralelo: `docker compose build frontend backend`.

### 6. Comunicação frontend ↔ backend

- Frontend chama backend via `VITE_API_URL` (HTTP) e Socket.IO client.
- Nenhum import directo de código. Nenhum `import type` de `backend/`.
- Se precisares de partilhar uma constante (ex: enum de status), **duplica e adiciona um teste de consistência no backend** — não cries um import cross-workspace.

### 7. Versões de runtime

- **TypeScript**: versão única no root, herdada por hoisting. Não permitir versões divergentes entre workspaces (fonte de bugs subtis em types do Prisma).
- **Prisma**: única versão no `backend/package.json`. Nunca no root nem no frontend (frontend não fala com a DB directamente).
- **Node**: versão alinhada via `.nvmrc` ou `engines` no `package.json` raiz.

## Sinais de regressão a vigiar

Se vires qualquer um destes, pára e corrige antes de continuar:

- `import` no frontend a apontar para `../backend/`, `../../backend/` ou caminho absoluto para `backend/`.
- `import` no backend a apontar para `../frontend/` ou `../src/`.
- Dep de UI (`react`, `tailwindcss`, `@headlessui/*`) instalada no root ou no backend.
- Dep de runtime backend (`express`, `prisma`, `@prisma/client`) instalada no root ou no frontend.
- Dois `node_modules/typescript` com versões diferentes (`ls -la node_modules/typescript backend/node_modules/typescript frontend/node_modules/typescript`).
- `vite.config.ts`, `tailwind.config.js` ou `index.html` na raiz.
- `docker-compose.yml` com `frontend.build.context: .` (deve ser `./frontend`).
- Documentação (`CLAUDE.md`, READMEs) a referir comandos antigos (`cd backend && npm test` em vez de `npm test -w backend`).

## Checklist antes de commitar

1. [ ] Nenhum import cross-workspace foi adicionado.
2. [ ] Deps novas foram instaladas no workspace correcto (`-w frontend` ou `-w backend`).
3. [ ] `package.json` do root continua sem deps de app (só workspaces + ferramentas de repo).
4. [ ] `npm run typecheck -w frontend` e `npm run typecheck -w backend` passam.
5. [ ] `npm run build -w frontend` e `npm run build -w backend` passam.
6. [ ] Se alteraste Docker: `docker compose build` ainda funciona.
7. [ ] Se moveste um ficheiro: actualizaste referências em `eslint.config.js`, scripts, e docs.
