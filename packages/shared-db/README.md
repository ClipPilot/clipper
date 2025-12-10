# @clipper/shared-db

Shared database schema and utilities for AI Clipping monorepo.

## Features

- Centralized Drizzle ORM schema definitions
- Support for multiple environments (dev, staging, prod)
- TypeScript types generated from schema
- Database migration management

## Environment Configuration

The package supports three environments:

- **dev** (default): Uses `DATABASE_URL`
- **staging**: Uses `STAGING_DATABASE_URL`
- **prod**: Uses `PROD_DATABASE_URL`

Set the `ENV` environment variable to switch between environments:

```bash
ENV=prod pnpm db:generate
ENV=staging pnpm db:migrate
```

## Scripts

- `pnpm build` - Build TypeScript to JavaScript
- `pnpm build:watch` - Build in watch mode
- `pnpm db:generate` - Generate migrations from schema
- `pnpm db:migrate` - Run migrations
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:push` - Push schema changes directly to database

## Usage

Import tables and types in your application:

```typescript
import { users, videos, clips } from "@clipper/shared-db";
```

## Adding New Tables

1. Edit `src/schema.ts` to add your table definitions
2. Run `pnpm db:generate` to create migrations
3. Run `pnpm db:migrate` to apply migrations
4. Rebuild the package with `pnpm build`
