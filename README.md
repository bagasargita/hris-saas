# SaaS Platform

Production-oriented, multi-tenant B2B SaaS foundation: workspaces, members, roles and permissions,
invitations, sessions, audit logs and a platform admin console — with tenant isolation and authorization
enforced by the API on every request.

- **Web** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), TanStack
  Query & Table, Zustand, React Hook Form + Zod, Recharts. Light/dark themes, responsive.
- **API** — NestJS 12 modular monolith, PostgreSQL 17, Prisma 7, REST + Swagger, Argon2id, opaque server-side
  sessions, signed double-submit CSRF, rate limiting, helmet, pino logging.
- **Tooling** — Yarn 4 workspaces, Docker Compose (PostgreSQL + Mailpit), ESLint, Prettier, Jest + Supertest,
  Vitest + Testing Library, Playwright, GitHub Actions.

## Quick start

Requirements: Node.js ≥ 24.22.1 LTS (see `.nvmrc`), Corepack (`corepack enable`), Docker.

```bash
yarn install
cp .env.example .env                      # docker compose settings (PostgreSQL on :5433)
cp apps/api/.env.example apps/api/.env    # then set CSRF_SECRET to a long random value
cp apps/web/.env.example apps/web/.env.local
docker compose up -d                      # PostgreSQL + Mailpit (http://localhost:8025)
yarn db:generate
yarn db:migrate
yarn db:seed
yarn dev                                  # web http://localhost:3000 · API http://localhost:4000/api/docs
```

Sign in with a seeded account, e.g. `olivia.owner@acme.test` / `ChangeMe-dev-only-1` (development only;
see [docs/database.md](docs/database.md#seed-data-development-only)). Emails (verification, reset,
invitations) appear in Mailpit.

## Scripts

| Command                                                                          | Description                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `yarn dev`                                                                       | API and web in watch mode                               |
| `yarn build`                                                                     | Build contracts, API and web                            |
| `yarn lint` / `yarn typecheck`                                                   | ESLint / TypeScript across all workspaces               |
| `yarn test`                                                                      | Unit tests (API Jest, web Vitest)                       |
| `yarn test:integration`                                                          | API integration tests against the `saas_test` database  |
| `yarn test:e2e`                                                                  | Playwright tests (needs a migrated and seeded database) |
| `yarn format` / `yarn format:check`                                              | Prettier                                                |
| `yarn db:generate` / `db:migrate` / `db:migrate:deploy` / `db:seed` / `db:reset` | Prisma                                                  |

## Repository layout

```
apps/
  api/            NestJS API (src/modules/*, prisma/, test/)
  web/            Next.js app (src/app, src/components, src/lib, e2e/)
packages/
  contracts/      shared permission keys, roles, plans, error codes, API types
  config/         shared tsconfig and ESLint config
docs/             architecture, database, authentication, authorization, multi-tenancy, api, deployment
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Authentication](docs/authentication.md)
- [Authorization](docs/authorization.md)
- [Multi-tenancy](docs/multi-tenancy.md)
- [API](docs/api.md)
- [Deployment](docs/deployment.md)

## Notes and limitations

- **Billing** is an explicit integration boundary: plans and usage are real, checkout returns
  `501 NOT_IMPLEMENTED` until a payment provider is connected.
- **Row-Level Security** is not configured; isolation is enforced in the application layer and by composite
  foreign keys, and covered by integration tests.
- **Rate limiting** uses in-memory storage (single API instance).
- API Jest uses Node ≥ 24.9 `require(esm)` (via `--experimental-vm-modules`) for NestJS 12's ESM-only
  packages; see `apps/api/jest.config.js`.
