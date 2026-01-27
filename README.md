# AI Clipping Monorepo

A monorepo for the AI Clipping application, featuring a shared database package that can be used across backend, frontend, and other services.

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
├── frontend/               # Frontend application
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

# Or push schema directly to database (dev only)
pnpm db:push
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

## Production Deployment

1. Set `NODE_ENV=production` in backend environment
2. Set `ENV=prod` when running migrations
3. Ensure `PROD_DATABASE_URL` is configured
4. Run migrations: `ENV=prod pnpm db:migrate`
5. Build and deploy: `pnpm build:backend`

## Tips

- Use `pnpm db:studio` to visualize and edit your database with Drizzle Studio
- The backend automatically switches database URLs based on `NODE_ENV`
- Always test migrations in development before applying to staging/production
- Keep your schema changes backward compatible when possible

- To start workers, CD into backend and pnpm dev:worker
