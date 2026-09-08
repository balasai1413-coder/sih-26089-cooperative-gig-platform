# SIH 26089 — Cooperative Gig Services Platform

Foundation monorepo for SIH Problem ID 26089. This setup contains a Next.js frontend (Tailwind and shadcn/ui-ready), a NestJS REST API, Prisma/PostgreSQL configuration, and Redis/BullMQ dependencies. It intentionally contains no product-domain functionality.

## Prerequisites

- Node.js 20.11 or later
- npm 10 or later
- Docker Desktop (or Docker Engine with the Compose plugin)

## Install

```bash
npm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp packages/database/.env.example packages/database/.env
```

Use a strong local-only value for `POSTGRES_PASSWORD` in `.env`, and keep the matching password in the API and database URLs.

## Start infrastructure

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
```

The command starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379` by default.

## Run the applications

In separate terminals:

```bash
npm run dev:web
npm run dev:api
```

The frontend is available at [http://localhost:3000](http://localhost:3000). The API listens at `http://localhost:3001` by default. Set distinct, 32-character-or-longer JWT secrets in `apps/api/.env` before using authentication endpoints.

## Verify the API

```bash
curl http://localhost:3001/api/v1/health
```

Expected response:

```json
{ "status": "ok" }
```

## Authentication foundation

The initial REST endpoints are:

- `POST /api/v1/auth/register/customer`
- `POST /api/v1/auth/register/worker`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Registration accepts an E.164 mobile number, optional email, and an 8–128 character password. The role comes from the registration route, never from the request body. Successful registration, login, and refresh responses return a safe user object and an access token. Their rotating refresh JWT is stored in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`, never in the JSON response. Passwords and persisted refresh-token hashes are never returned by the API.

## Database commands

Prisma is configured with PostgreSQL and has an initial migration for identity, cooperative membership, skills, verification records, and certificates.

```bash
npm run prisma:generate
npm run prisma:migrate -- --name initial_auth_foundation
```

Run the migration command after PostgreSQL is available.

## Quality checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

## Repository layout

```text
apps/
  web/       Next.js frontend
  api/       NestJS REST API
packages/
  database/  Prisma schema and client
  shared/    framework-agnostic shared code
  contracts/ API contracts
infra/docker/ Docker Compose services
docs/        architecture notes
```
