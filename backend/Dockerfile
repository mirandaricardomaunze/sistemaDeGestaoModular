# syntax=docker/dockerfile:1
#
# Backend (Node/Express/Prisma) — monorepo workspace build.
# IMPORTANT: build context must be the repo root (see docker-compose.yml).
#   docker build -f backend/Dockerfile -t sistema-backend .

FROM node:20-alpine AS base
WORKDIR /app

# ---------- deps (full install, includes devDeps for build) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
# Prisma schema is needed for `prisma generate` during install/build.
COPY backend/prisma ./backend/prisma
RUN npm ci
RUN npm run prisma:generate -w backend

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY backend ./backend
# Carry over the Prisma-generated client from the deps stage.
COPY --from=deps /app/backend/prisma ./backend/prisma
RUN npm run build -w backend

# ---------- production deps (smaller node_modules for runner) ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma
RUN npm ci --omit=dev --workspaces --include-workspace-root
RUN npm run prisma:generate -w backend

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production

RUN mkdir -p /app/backend/logs /app/backend/backups /app/backend/uploads \
 && chown -R node:node /app

USER node

# Workspace manifests so `npm start -w backend`-style resolution works
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node frontend/package.json ./frontend/package.json
COPY --chown=node:node backend/package.json ./backend/package.json

# Production node_modules (hoisted at /app/node_modules, plus any unhoistable
# packages under /app/backend/node_modules).
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Compiled output + Prisma schema/migrations
COPY --from=builder --chown=node:node /app/backend/dist ./backend/dist
COPY --from=builder --chown=node:node /app/backend/prisma ./backend/prisma

WORKDIR /app/backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
