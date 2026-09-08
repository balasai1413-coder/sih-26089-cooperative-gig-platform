# Architecture foundation

This repository is a simple npm-workspaces monorepo.

- `apps/web`: Next.js browser application.
- `apps/api`: NestJS REST API.
- `packages/database`: Prisma schema and database client boundary.
- `packages/contracts`: future shared API contracts.
- `packages/shared`: future framework-agnostic utilities.
- `infra/docker`: local PostgreSQL and Redis services.

The API is versioned under `/api/v1`. Authentication is a single-module NestJS foundation using password hashes, short-lived access JWTs, rotated refresh JWTs stored only as hashes, and reusable role-level guards. Resource ownership and cooperative-scope policies are intentionally deferred.

PostgreSQL and Redis run through Docker Compose in local development. The API is intentionally a single NestJS application; no microservices or service-domain features are present in this phase.
