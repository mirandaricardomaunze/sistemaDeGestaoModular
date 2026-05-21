# Migration Plan — Separação Frontend / Backend (npm workspaces)

> **Objectivo**: separar fisicamente o frontend (actualmente na raiz) do backend num layout monorepo npm workspaces, conforme [.agent/skills/monorepo-structure/SKILL.md](.agent/skills/monorepo-structure/SKILL.md).
>
> **Estado**: 🟡 não iniciado
>
> **Branch sugerida**: `refactor/monorepo-workspaces`
>
> **Reversibilidade**: cada passo é um commit independente. Rollback = `git revert <commit>` ou `git reset --hard <commit-anterior>`.
>
> **Auditoria prévia (já feita 2026-05-20)**:
> - ✅ Zero cross-imports entre `src/` e `backend/src/`
> - ⚠️ Root tem `@prisma/client@7.2` e `prisma@7.2` mas nunca importa Prisma → remover
> - ⚠️ TypeScript divergente (root 5.9.3 vs backend 5.7.2) → alinhar
> - ✅ Nenhum risco bloqueante identificado

---

## Pré-requisitos

```powershell
# Garantir tree limpo antes de começar
git status
# Criar branch dedicada
git checkout -b refactor/monorepo-workspaces
# Snapshot do estado actual: typecheck deve passar em ambos antes de mexer
npx tsc --noEmit
cd backend; npx tsc --noEmit; cd ..
```

Se algum `tsc` falhar antes do passo 1, **parar** e corrigir primeiro — não confundir bugs pré-existentes com regressões da migração.

---

## Passo 1 — Cleanup do root `package.json`  🟢

**Objectivo**: remover Prisma (não usado) do root e alinhar TypeScript com backend.

### Alterações

- [x] Remover `@prisma/client` e `prisma` de [package.json](package.json) `dependencies` e `devDependencies`
- [ ] Alinhar `typescript` no root para a versão mais recente que ambos suportam (sugestão: manter `~5.9.3` no root, actualizar backend para `^5.9.3` num commit separado se quiser — opcional neste passo) — adiado
- [x] `npm install` para regenerar `package-lock.json` (75 packages removidos)

### Validação

```powershell
npm install
npx tsc --noEmit                          # frontend
cd backend; npx tsc --noEmit; cd ..       # backend
npm run build                              # frontend build deve completar
```

### Commit

```
chore: remove Prisma deps from root (unused by frontend)
```

---

## Passo 2 — Mover frontend para `frontend/`  🟢

**Objectivo**: criar pasta `frontend/` e mover todos os artefactos do frontend para lá. Ainda **sem** activar workspaces — root continua a ser uma app frontend, só fisicamente noutra pasta.

### Ficheiros/pastas a mover (raiz → `frontend/`)

| Origem | Destino |
|---|---|
| `src/` | `frontend/src/` |
| `public/` | `frontend/public/` |
| `index.html` | `frontend/index.html` |
| `vite.config.ts` | `frontend/vite.config.ts` |
| `tsconfig.json` | `frontend/tsconfig.json` |
| `tsconfig.app.json` | `frontend/tsconfig.app.json` |
| `tsconfig.node.json` | `frontend/tsconfig.node.json` |
| `tailwind.config.js` | `frontend/tailwind.config.js` |
| `postcss.config.js` | `frontend/postcss.config.js` |
| `Dockerfile` | `frontend/Dockerfile` |
| `nginx.conf` | `frontend/nginx.conf` |
| `dist/` | apagar (será regerado em `frontend/dist/`) |

### Comando (preserva histórico git)

```powershell
mkdir frontend
git mv src public index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tailwind.config.js postcss.config.js Dockerfile nginx.conf frontend/
Remove-Item -Recurse -Force dist
```

### Edições obrigatórias após o move

- [x] [.gitignore](.gitignore) — já cobre `dist` em qualquer profundidade; sem edit necessário
- [x] [eslint.config.js](eslint.config.js) — `files: ['src/**/*.{ts,tsx}']` → `files: ['frontend/src/**/*.{ts,tsx}']`
- [x] [docker-compose.yml](docker-compose.yml) — `context: .` (frontend) → `context: ./frontend`

### Validação

```powershell
# Frontend agora corre a partir de frontend/
cd frontend
npx tsc --noEmit
npx vite build
cd ..
# Backend não foi tocado
cd backend; npx tsc --noEmit; cd ..
```

### Notas

- Os scripts em `package.json` da raiz (`vite`, `tsc -b && vite build`) vão **partir** depois deste passo — é esperado, o passo 3 corrige.
- Não correr `npm run dev` entre Passo 2 e Passo 3. Usar `cd frontend; npx vite` para testar manualmente se necessário.

### Commit

```
refactor: move frontend files to frontend/ subdirectory
```

---

## Passo 3 — Activar npm workspaces  🟢

**Objectivo**: declarar `frontend/` e `backend/` como workspaces; split do `package.json` raiz em três (root orquestrador + frontend + backend já existente).

### Criar `frontend/package.json`

Mover do root para `frontend/package.json` todas as deps de runtime de frontend (lista derivada do `package.json` actual):

```json
{
  "name": "@sistema/frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    // ... todas as deps de runtime do frontend actual:
    // @dnd-kit/*, @headlessui/react, @hookform/resolvers,
    // @tanstack/*, axios, clsx, date-fns, dexie, file-saver,
    // html5-qrcode, i18next, i18next-browser-languagedetector,
    // jspdf, jspdf-autotable, leaflet, qrcode.react,
    // react, react-dom, react-hook-form, react-hot-toast,
    // react-i18next, react-icons, react-leaflet, react-markdown,
    // react-router-dom, recharts, remark-gfm, socket.io-client,
    // tailwind-merge, xlsx, zod, zustand
  },
  "devDependencies": {
    // @testing-library/*, @types/file-saver, @types/leaflet,
    // @types/react, @types/react-dom, @vitejs/plugin-react,
    // autoprefixer, jsdom, postcss, tailwindcss,
    // vite, vite-plugin-compression2, vite-plugin-pwa, vitest
  }
}
```

### Reescrever `package.json` da raiz

```json
{
  "name": "sistema-monorepo",
  "private": true,
  "version": "0.0.0",
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev:frontend": "npm run dev -w frontend",
    "dev:backend": "npm run dev -w backend",
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "build": "npm run build -w frontend && npm run build -w backend",
    "typecheck": "npm run typecheck -w frontend && npm run typecheck -w backend",
    "test": "npm run test -w frontend && npm run test -w backend",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/node": "^24.10.4",
    "concurrently": "^9.2.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.46.4"
  }
}
```

### Adicionar script `typecheck` ao backend

[backend/package.json](backend/package.json) `scripts`:

```json
"typecheck": "node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit"
```

### Validação

```powershell
# Apagar tudo e reinstalar de raiz com workspaces
Remove-Item -Recurse -Force node_modules, backend/node_modules
Remove-Item package-lock.json
npm install
# Deve ver: "added X packages in workspaces frontend, backend"

npm run typecheck                          # ambos
npm run build                              # ambos
npm run dev                                # ambos sobem (Ctrl+C para parar)
```

### Riscos a vigiar

- Conflito de versões hoisted: `npm ls typescript` deve mostrar uma versão. Se mostrar duas (uma em `frontend/`, outra em `backend/`), alinhar versões.
- Backend Prisma 6.x vs root sem Prisma: ok, backend tem o seu isolado.
- ESLint pode queixar-se se `eslint.config.js` ainda referir paths antigos — passo 4 corrige.

### Commit

```
refactor: enable npm workspaces (frontend + backend)
```

---

## Passo 4 — Configs derivadas + docs  🟢

**Objectivo**: actualizar tudo o que ainda assume o layout antigo.

### Ficheiros a editar

- [x] [eslint.config.js](eslint.config.js) — `frontend/src/**` aplicado no Passo 2
- [x] [docker-compose.yml](docker-compose.yml) — frontend context ajustado no Passo 2 (mas Dockerfiles precisam re-escrita — ver "Docker — follow-up" abaixo)
- [x] [scripts/check-mojibake.mjs](scripts/check-mojibake.mjs), [scripts/fix-mojibake.mjs](scripts/fix-mojibake.mjs), [scripts/hook-check-mojibake.mjs](scripts/hook-check-mojibake.mjs) — path-agnostic (recebem ficheiros como args), sem alteração necessária
- [x] [CLAUDE.md](CLAUDE.md) — comandos via `-w`, árvore com `frontend/`+`backend/`, secção "Layout — npm workspaces monorepo" no topo
- [x] [README.md](README.md) — reescrito do template Vite default para intro real do monorepo
- [x] [backend/README.md](backend/README.md) — adicionada nota explicando que é workspace e apontando para README raiz
- [x] `backend/.dockerignore` existe e está OK (paths relativos a backend/)

### Docker — follow-up (não bloqueante)

Os Dockerfiles em [frontend/Dockerfile](frontend/Dockerfile) e [backend/Dockerfile](backend/Dockerfile) usam `npm ci` com lockfile local, mas com workspaces o lockfile vive no root. Isto faz `docker compose build` falhar.

**Fix necessário num commit separado**:
1. `docker-compose.yml`: mudar ambos `context: ./<workspace>` para `context: .` + `dockerfile: <workspace>/Dockerfile`
2. Reescrever cada Dockerfile para copiar root `package.json` + `package-lock.json` + ambos workspace `package.json`, fazer `npm ci -w <workspace>`, depois copiar só o source do workspace relevante
3. Validar com `docker compose build` antes de fechar

Este trabalho não bloqueia o dev local (`npm run dev` funciona). Adiar para sessão dedicada com tempo para testar builds Docker (~10 min cada).

### .env files — follow-up (não bloqueante)

Os ficheiros `.env`, `.env.example`, `.env.production` na raiz contêm **apenas `VITE_*` variables** (são do frontend). Foram esquecidos no root quando o frontend moveu para `frontend/` no Passo 2.

**Impacto actual**: Vite não os carrega porque o build agora corre dentro de `frontend/`. O `VITE_API_URL=https://api.multicore.co.mz/api` em produção **não está activo** — o build vai usar o default ou nada.

**Fix**: `git mv .env .env.example .env.production frontend/`. `.env.docker` permanece no root (usado pelo docker-compose).

Adiar conforme decisão do utilizador, mas tratar antes do próximo deploy de produção.

### Legacy directories — removidos ✅

- `logs/` (vazio) — removido
- `uploads/prescriptions/` (vazio) — removido
- Ambos eram restos de quando backend corria a partir da raiz. Activo: `backend/logs/`, `backend/uploads/`.

### Validação final (gold path)

Executada 2026-05-21 — resultados:
- `npm install` (clean): 1559 packages, OK ✅
- `npm run typecheck`: frontend 0 erros, backend 0 erros ✅
- `npm run build`: frontend (25.5s, dist/ gerado), backend (tsc OK) ✅
- `npm run lint`: 111 problemas pré-existentes (13 errors, 98 warnings) — mesmos do Step 2, sem regressão
- `npm test`: 19 test suites passed, 656 tests passed, 1 skipped ✅
- `docker compose build`: **adiado** — ver "Docker — follow-up" acima

### Memory updates

Após validação, actualizar [MEMORY.md](../../C:/Users/miran/.claude/projects/c--Users-miran-Desktop-sistemas/memory/MEMORY.md):

- Criar `project_monorepo_layout.md`: "Monorepo npm workspaces — `frontend/` + `backend/`, root só orquestra. Migração concluída YYYY-MM-DD. Ver skill `monorepo-structure`."

### Commit

```
refactor: update configs and docs for monorepo layout
```

### Cleanup final

```powershell
# Apagar este ficheiro — a migração está concluída
git rm MIGRATION_PLAN.md
git commit -m "docs: remove completed migration plan"
```

---

## Tabela de estado

| Passo | Descrição | Estado | Commit |
|---|---|---|---|
| 1 | Cleanup root (remover Prisma) | 🟢 concluído | (pendente) |
| 2 | Mover frontend para `frontend/` | 🟢 concluído | (pendente) |
| 3 | Activar npm workspaces | 🟢 concluído | (pendente) |
| 4 | Configs derivadas + docs | 🟢 concluído | (pendente) |

**Legenda**: 🟡 não iniciado · 🟠 em curso · 🟢 concluído · 🔴 bloqueado

---

## Se algo correr mal

- **`tsc` falha após mover ficheiros**: confirmar que `tsconfig.json` em `frontend/` tem `include: ["src"]` (relativo ao novo location) e que `__dirname` em `vite.config.ts` resolve correctamente.
- **`npm install` muito lento ou hang**: apagar `node_modules` e `package-lock.json` em **todos** os níveis e reinstalar do root.
- **ESLint reporta ficheiros não encontrados**: `files: ['src/**']` está desactualizado — precisa ser `frontend/src/**`.
- **Docker build falha**: confirmar `context: ./frontend` em `docker-compose.yml` e que o `Dockerfile` está dentro de `frontend/`.
- **Rollback total**: `git checkout main && git branch -D refactor/monorepo-workspaces`.
