# syntax=docker/dockerfile:1
#
# Frontend (React/Vite) — monorepo workspace build.
# IMPORTANT: build context must be the repo root (see docker-compose.yml).
#   docker build -f frontend/Dockerfile -t sistema-frontend .

FROM node:20-alpine AS base
WORKDIR /app

# ---------- deps ----------
# Install all workspace deps using the single root lockfile.
FROM base AS deps
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY frontend ./frontend

# Build-time API URL. Override via:
#   docker build --build-arg VITE_API_URL=https://api.exemplo.co.mz/api -f frontend/Dockerfile .
# Otherwise frontend/.env.production is auto-loaded by Vite (mode=production).
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build -w frontend

# ---------- runner ----------
FROM nginx:alpine AS runner

COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
