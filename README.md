# Cuttr (Clipper)

AI-powered video clipping and content creation platform. Automatically detects and extracts compelling video clips from long-form content using face detection, scene detection, transcription, and virality metrics.

**Production**: [platform.cuttr.com](https://platform.cuttr.com) | **API**: [api.cuttr.com](https://api.cuttr.com) | **Admin**: [admin.cuttr.com](https://admin.cuttr.com)

## Project Structure

```
clipper/
├── packages/
│   └── shared-db/          # Shared Drizzle ORM database package
│       ├── src/
│       │   ├── schema.ts   # Database schema definitions
│       │   └── index.ts    # Package exports
│       ├── drizzle/        # Migration files (dev)
│       ├── drizzle.config.js
│       └── package.json
├── backend/                # Express backend
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts    # Database connection initialization
│   │   │   └── example.ts  # Usage examples
│   │   └── ...
│   └── package.json
│   ├── shared-types/       # Shared TypeScript types (@clipper/shared-types)
│   └── shared-ui/          # Shared React components (@clipper/shared-ui)
├── frontend/               # Frontend application (npm)
├── admin-frontend/         # Admin dashboard (npm)
├── package.json           # Root package.json
└── pnpm-workspace.yaml    # PNPM workspace configuration
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm (v10.12.2+)
- PostgreSQL

### Installation

1. Install dependencies for all packages:

```bash
pnpm install
```

### Environment Variables (dotenv-vault)

This project uses [dotenv-vault](https://www.dotenv.org/docs) to securely manage environment variables across all packages. Encrypted `.env.vault` files are committed to git, while plaintext `.env` files are gitignored.

#### Vault Setup

The project vault is hosted at:
**[vault.dotenv.org](https://vault.dotenv.org)**

Each package has its own vault:
- `backend/.env.vault`
- `frontend/.env.vault`
- `packages/shared-db/.env.vault`

#### Getting Started

1. **Login** to the vault:

```bash
npx dotenv-vault@latest login
```

2. **Pull** environment variables to your local `.env` files:

```bash
# From each package directory (backend, frontend, packages/shared-db)
npx dotenv-vault@latest pull
```

3. **Adding new variables:** Contact Naman to configure any new environment variables in the vault.

### Database Setup

#### 1. Configure Environment Variables

Pull environment variables using dotenv-vault (see above), or manually create the `.env` files:

`packages/shared-db/.env`:

```env
DATABASE_URL=postgresql://user:password@host:port/database_dev
STAGING_DATABASE_URL=postgresql://user:password@host:port/database_staging
PROD_DATABASE_URL=postgresql://user:password@host:port/database_prod
ENV=dev
```

`backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:port/database_dev
STAGING_DATABASE_URL=postgresql://user:password@host:port/database_staging
PROD_DATABASE_URL=postgresql://user:password@host:port/database_prod
NODE_ENV=development
```

#### 2. Build the Shared Database Package

```bash
pnpm build:shared
```

#### 3. Generate and Run Migrations

```bash
# Generate migrations from schema
cd packages/shared-db
pnpm db:generate

# Run migrations
pnpm db:migrate
```

## Environment Management

The shared-db package supports multiple environments:

### Development (default)

```bash
ENV=dev pnpm db:generate
```

### Staging

```bash
ENV=staging pnpm db:generate
```

### Production

```bash
ENV=prod pnpm db:generate
```

Migrations for each environment are stored in separate directories:

- `drizzle/` - Development
- `drizzle/staging/` - Staging
- `drizzle/prod/` - Production

## Shared Packages

### @clipper/shared-types

Shared TypeScript types used across backend and both frontends.

```bash
cd packages/shared-types && pnpm build
```

- Backend references via `workspace:*` (pnpm)
- Frontends reference via `file:../packages/shared-types` (npm)

### @clipper/shared-ui

Shared React components used across frontends. React is a **peer dependency** to prevent duplicate React instances that break react-aria/HeroUI on Amplify.

```bash
cd packages/shared-ui && pnpm build
```

- Frontends reference via `file:../packages/shared-ui` (npm)
- Each frontend has `overrides` in `package.json` to force singleton React resolution
- `transpilePackages` is set in each frontend's `next.config` so Next.js compiles the shared source

### Building shared packages

Always rebuild shared packages before building frontends:

```bash
cd packages/shared-types && pnpm build
cd packages/shared-ui && pnpm build
```

## Frontend Builds

Both frontends use **npm** (not pnpm). They are not part of the pnpm workspace.

### Local

```bash
# Main frontend
cd frontend && npm install && npm run build

# Admin frontend
cd admin-frontend && npm install && npm run build
```

### Amplify

Amplify build settings must build shared packages first. Set the **base directory to the repo root**, then:

**Install command:**
```bash
cd packages/shared-types && npm install && npm run build && cd ../shared-ui && npm install && npm run build && cd ../../frontend && npm install
```

**Build command:**
```bash
cd frontend && npm run build
```

For admin-frontend, replace `frontend` with `admin-frontend` in the commands above.

### Verifying on Amplify

After pushing, check Amplify build logs for:
- Shared packages building successfully in the install phase
- No "Invalid hook call" or "multiple instances of React" errors
- No react-aria context errors

If react-aria breaks, verify:
1. `overrides` block exists in the frontend's `package.json`
2. `transpilePackages` is set in `next.config`
3. `@clipper/shared-ui/package.json` has React as `peerDependencies` (not `dependencies`)

## Usage in Backend

### Import and Use Database

```typescript
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

// Query users
const users = await db.select().from(schema.users);

// Get user by id
const user = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.id, userId));

// Insert a new user
const [newUser] = await db
  .insert(schema.users)
  .values({ email: "user@example.com", name: "John Doe" })
  .returning();
```

### Import Schema Tables Directly

```typescript
import { users, videos, clips } from "@clipper/shared-db";
import { db } from "./db";

const allUsers = await db.select().from(users);
```

## Scripts

### Root Scripts

- `pnpm install:all` - Install dependencies for all packages
- `pnpm build:shared` - Build the shared-db package
- `pnpm build:backend` - Build shared-db and backend
- `pnpm dev:backend` - Start backend in development mode

### Backend Scripts

- `pnpm dev` - Start backend in development mode
- `pnpm build` - Build backend
- `pnpm start` - Start production backend
- `pnpm db:generate` - Generate migrations (delegates to shared-db)
- `pnpm db:migrate` - Run migrations (delegates to shared-db)
- `pnpm db:studio` - Open Drizzle Studio (delegates to shared-db)
- `pnpm db:push` - Push schema to database (delegates to shared-db)

### Shared-DB Scripts

- `pnpm build` - Compile TypeScript
- `pnpm build:watch` - Build in watch mode
- `pnpm db:generate` - Generate migrations from schema
- `pnpm db:migrate` - Apply migrations
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:push` - Push schema directly to database

## Adding New Tables

1. Edit `packages/shared-db/src/schema.ts` to add your table:

```typescript
export const myNewTable = pgTable("my_new_table", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

2. Generate migrations:

```bash
cd packages/shared-db
pnpm db:generate
```

3. Review the generated migration in `drizzle/`

4. Apply the migration:

```bash
pnpm db:migrate
```

5. Rebuild the package:

```bash
pnpm build
```

6. Use in your backend:

```typescript
import { myNewTable } from "@clipper/shared-db";
import { db } from "./db";

const items = await db.select().from(myNewTable);
```

## Development Workflow

1. Make changes to schema in `packages/shared-db/src/schema.ts`
2. Generate migrations: `cd packages/shared-db && pnpm db:generate`
3. Apply migrations: `pnpm db:migrate`
4. Build the package: `pnpm build`
5. Backend will automatically pick up the changes

## CI/CD Pipeline

### Overview

A single unified `ci.yml` orchestrator detects what changed and conditionally deploys only the affected services. Reusable workflows (`_deploy-ecs.yml`, `_deploy-lambda.yml`) eliminate duplication.

```
.github/workflows/
  ci.yml                 -- THE pipeline (test, terraform, deploy)
  _deploy-ecs.yml        -- Reusable: ECS service deploys
  _deploy-lambda.yml     -- Reusable: Lambda deploys
  release.yml            -- Auto versioning + tags + changelog
  rollback.yml           -- One-click rollback
  claude-code-review.yml -- AI code review on PRs
  claude.yml             -- @claude in issues/PRs
```

### How Deployments Work

**Push to `staging`** -- Deploys only changed services to the staging environment.

```
feature/* --merge--> staging ---> ci.yml detects changes ---> deploys to staging
```

**Push to `main`** -- Runs tests and terraform only. No service deploys. `release-please` creates/updates a Release PR.

```
staging --merge--> main ---> tests + terraform apply (no service deploys)
                         ---> release-please opens/updates Release PR
```

**Merge the Release PR** -- Creates a git tag (`v1.2.0`). The tag triggers production deployment of all services.

```
Release PR --merge--> main ---> tag v1.2.0 created ---> deploys ALL services to production
```

**Pull Requests** -- Runs tests + terraform plan (posts comment on PR). No deployments.

**Manual Deploy** -- Go to Actions > CI/CD Pipeline > Run workflow. Select a service and environment.

**Rollback** -- Go to Actions > Rollback > Run workflow. Select service type (ECS/Lambda), service name, and environment.

### Commit Convention

Use [conventional commits](https://www.conventionalcommits.org/) for automatic versioning:

| Prefix | Example | Version bump |
|--------|---------|-------------|
| `feat:` | `feat: add webhook retry logic` | MINOR (1.1.0 -> 1.2.0) |
| `fix:` | `fix: clip preview not loading` | PATCH (1.2.0 -> 1.2.1) |
| `feat!:` | `feat!: redesign auth flow` | MAJOR (1.2.1 -> 2.0.0) |
| `chore:` | `chore: update dependencies` | No bump (in changelog) |
| `refactor:` | `refactor: extract clip service` | No bump (in changelog) |

### Release Flow

1. Merge feature branches to `staging` (auto-deploys to staging)
2. Merge `staging` to `main` via PR (runs tests + terraform only)
3. `release-please` creates/updates a Release PR with bumped version + changelog
4. Merge the Release PR when ready -- creates git tag -- deploys production

### Quick Reference

| I want to... | Do this |
|---|---|
| Deploy to staging | Merge to `staging` branch |
| Deploy to production | Merge the Release PR on `main` |
| Deploy one service manually | Actions > CI/CD Pipeline > Run workflow |
| Roll back a broken deploy | Actions > Rollback > Run workflow |
| See what version is deployed | Check GitHub Releases or `git tag` |
| See what changed in a release | Read `CHANGELOG.md` or the GitHub Release |
