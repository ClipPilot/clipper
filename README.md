# Cuttr (Clipper)

AI-powered video clipping and content creation platform. Automatically detects and extracts compelling video clips from long-form content using face detection, scene detection, transcription, and virality metrics.

**Production**: [platform.cuttr.com](https://platform.cuttr.com) | **API**: [api.cuttr.com](https://api.cuttr.com) | **Admin**: [admin.cuttr.com](https://admin.cuttr.com)

## Project Structure

```
clipper/
├── backend/                  # Express API + worker (pnpm)
├── frontend/                 # Next.js user app (npm)
├── admin-frontend/           # Next.js admin dashboard (npm)
├── packages/
│   ├── shared-db/            # Drizzle ORM schema + migrations
│   ├── shared-types/         # Auto-generated API types (OpenAPI → TypeScript)
│   ├── shared-ui/            # Shared React components (HeroUI)
│   └── shared-email/         # Email templates
├── lambda-*/                 # AWS Lambda functions
├── infra/                    # Terraform IaC
└── .github/workflows/        # CI/CD pipelines
```

## Getting Started

### Prerequisites

- Node.js v22+
- pnpm v10.12.2+
- PostgreSQL

### Installation

```bash
pnpm install

# Frontends use npm (not pnpm)
cd frontend && npm install
cd admin-frontend && npm install
```

### Environment Variables

Environment variables are managed via [dotenv-vault](https://www.dotenv.org/docs). Each package has its own `.env.vault` file.

```bash
npx dotenv-vault@latest login
npx dotenv-vault@latest pull   # Run from each package directory
```

Contact Naman to configure new environment variables in the vault.

### Database Setup

```bash
# Pull env vars for shared-db and backend (see above)

# Build shared packages
pnpm build:shared

# Generate and apply migrations
cd packages/shared-db
pnpm db:generate
pnpm db:migrate
```

Migrations are environment-specific (`ENV=dev|staging|prod`):
- `drizzle/` — Development
- `drizzle/staging/` — Staging
- `drizzle/prod/` — Production

### Running Services

```bash
pnpm dev:backend     # API server (port 3001)
pnpm dev:worker      # SQS worker (from backend/)

cd frontend && npm run dev           # Frontend (port 3000)
cd admin-frontend && npm run dev     # Admin (port 3002)
```

---

## Development Practices

### Shared Types (API Contract)

API types are auto-generated from OpenAPI annotations. One source of truth for both backend and frontend.

**How it works:**
```
@openapi JSDoc (route files) → swagger-jsdoc → openapi.json → openapi-typescript → TypeScript types
```

`openapi.json` is auto-generated — never edit it directly.

Only request and response types need to come from `@clipper/shared-types`. Other types (UI state, component props, store types) can be defined locally.

**Using shared types:**
```typescript
// Backend controller — enforces response shape
import type { Clip } from "@clipper/shared-types";
export const getClips = async (req: Request, res: Response<{ clips: Clip[] }>) => { ... };

// Frontend — same type, no duplication
import type { Clip } from "@clipper/shared-types";
const data: { clips: Clip[] } = await response.json();
```

**After changing shared types:**
```bash
pnpm build:shared
```

This runs: shared-db → shared-email → export OpenAPI spec → generate types → shared-ui

### Adding a New API Endpoint

1. Define a **named schema** in `backend/src/config/swagger.ts` under `components.schemas`:

```typescript
MyItemResponse: {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
        },
      },
    },
  },
},
```

2. Create route in `backend/src/routes/<feature>.routes.ts` with `@openapi` JSDoc referencing the schema:

```typescript
/**
 * @openapi
 * /my-feature/teams/{teamId}/items:
 *   get:
 *     summary: List items
 *     tags: [MyFeature]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MyItemResponse'
 */
router.get("/teams/:teamId/items", requireAuth, myController.listItems);
```

3. Create controller + service, mount route in `backend/src/app.ts` if new route file

4. Run one command:

```bash
pnpm build:shared
```

This auto-generates everything — `models.ts`, `api.types.ts`, and the compiled output. No manual type wiring needed.

5. Import in backend controller and frontend:

```typescript
// Backend (import from bridge layer)
import type { MyItemResponse } from "../types/api.types";

// Frontend
import type { MyItemResponse } from "@clipper/shared-types";
```

**All response/request types MUST be named schemas in `swagger.ts`** — never inline-only. `models.ts` and `api.types.ts` are auto-generated and should not be edited manually.

### Adding a New Database Table

1. Define table in `packages/shared-db/src/schema.ts`
2. `cd packages/shared-db && pnpm db:generate`
3. `pnpm db:migrate`
4. `pnpm build` (rebuild the package)
5. Import in backend: `import { myTable } from "@clipper/shared-db/src/schema"`

### Shared UI Components

Shared React components in `packages/shared-ui/` are used by both frontends.

- Frontends consume **source** directly via `transpilePackages` in `next.config`
- React and HeroUI are `peerDependencies` — no duplicate instances
- `shared-ui` is excluded from pnpm workspace (`!packages/shared-ui` in `pnpm-workspace.yaml`) to prevent pnpm from installing React in its `node_modules`
- Adding a new component: create in `src/components/`, export from `src/components/index.ts` — available immediately in dev (no rebuild needed for frontends)
- Run `pnpm build:shared` before pushing to validate types

### Shared UI on Amplify

Both frontends are hosted on AWS Amplify. The Amplify build must build shared packages first.

**Install command** (base directory = repo root):
```bash
cd packages/shared-types && npm install && npm run build && cd ../shared-ui && npm install && npm run build && cd ../../frontend && npm install
```

**Build command:**
```bash
cd frontend && npm run build
```

If react-aria breaks on Amplify, verify:
1. `overrides` block exists in the frontend's `package.json`
2. `transpilePackages` is set in `next.config`
3. `@clipper/shared-ui/package.json` has React as `peerDependencies` (not `dependencies`)

---

## Scripts

### Root

| Script | What it does |
|--------|-------------|
| `pnpm build:shared` | Build all shared packages (db → email → export spec → types → ui) |
| `pnpm build:backend` | Build shared + backend |
| `pnpm dev:backend` | Start backend in dev mode |
| `pnpm dev:worker` | Start SQS worker in dev mode |

### Backend

| Script | What it does |
|--------|-------------|
| `pnpm dev` | Start API server |
| `pnpm dev:worker` | Start SQS worker |
| `pnpm build` | Compile TypeScript + copy assets |
| `pnpm test` | Run all tests (vitest) |
| `pnpm type-check` | TypeScript type checking |
| `pnpm api:export-spec` | Export OpenAPI spec to `packages/shared-types/openapi.json` |

### Shared-DB

| Script | What it does |
|--------|-------------|
| `pnpm build` | Compile TypeScript |
| `pnpm db:generate` | Generate migrations from schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |

---

## CI/CD Pipeline

A single unified `ci.yml` orchestrator detects what changed and conditionally deploys only the affected services.

```
.github/workflows/
  ci.yml                 -- THE pipeline (test, terraform, deploy)
  _deploy-ecs.yml        -- Reusable: ECS service deploys
  _deploy-lambda.yml     -- Reusable: Lambda deploys
  release.yml            -- Auto versioning + tags + changelog
  rollback.yml           -- One-click rollback
```

### Deployment Flow

| Action | Result |
|--------|--------|
| Push to `staging` | Deploys changed services to staging |
| Push to `main` | Tests + terraform only, no deploys. release-please creates Release PR |
| Merge Release PR | Creates git tag → deploys ALL services to production |
| Manual deploy | Actions > CI/CD Pipeline > Run workflow |
| Rollback | Actions > Rollback > Run workflow |

### Commit Convention

| Prefix | Example | Version bump |
|--------|---------|-------------|
| `feat:` | `feat: add webhook retry logic` | MINOR |
| `fix:` | `fix: clip preview not loading` | PATCH |
| `feat!:` | `feat!: redesign auth flow` | MAJOR |
| `chore:` | `chore: update dependencies` | No bump |
