# CLAUDE.md

## Critical Rules

- **NEVER run `terraform apply`**. Only use `terraform validate` and `terraform plan` for local checks. All infrastructure changes are deployed through CI/CD.
- **Minimal comments**. Do not add comments to code. Keep code self-explanatory.

## Project Overview

**Clipper** (brand name: **Cuttr**) is an AI-powered video clipping and content creation platform. It automatically detects and extracts compelling video clips from long-form content using face detection, scene detection, transcription, and virality metrics. The product also supports UGC script generation, ad cloning, face swaps, voice cloning, and social media mass posting.

- **Production URL**: platform.cuttr.com
- **API URL**: api.cuttr.com
- **Admin**: admin.cuttr.com
- **Status**: status.cuttr.com

## Repository Structure

This is a **pnpm monorepo** (pnpm v10.12.2+) with the following layout:

```
clipper/
├── backend/                 # Express.js API server (TypeScript)
├── frontend/                # Next.js 15 user-facing app (React 18, HeroUI, Tailwind)
├── admin-frontend/          # Next.js 16 admin dashboard (React 19, Tailwind)
├── packages/
│   └── shared-db/           # Shared Drizzle ORM schema + migrations (@clipper/shared-db)
├── lambda-expire-clips/     # Lambda: auto-expire/archive stale clips (TypeScript)
├── lambda-face-detect/      # Lambda: face detection in video frames (Python/OpenCV)
├── lambda-scene-detect/     # Lambda: scene/cut + silence detection (Python/OpenCV)
├── lambda-virality-sync/    # Lambda: sync social media metrics (TypeScript)
├── lambda-youtube/          # Lambda: download YouTube videos via yt-dlp (Python)
├── n8n-nodes/               # Custom n8n workflow nodes (GitHub Issues)
├── infra/                   # Terraform IaC for AWS infrastructure
├── status/                  # Next.js 15 status monitoring dashboard
├── docs/                    # Mintlify documentation site (MDX)
├── .github/workflows/       # CI/CD pipelines (GitHub Actions)
└── .claude/agents/          # Claude Code custom agent definitions
```

### Workspace Configuration

Defined in `pnpm-workspace.yaml`:
- `packages/*` (shared-db)
- `backend`
- `lambda-expire-clips`
- `lambda-virality-sync`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | Express 5, TypeScript, Node.js 22 |
| **Frontend** | Next.js 15 (Turbopack), React 18, HeroUI, Tailwind CSS 4, Jotai (state) |
| **Admin Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Database** | PostgreSQL (AWS RDS) via Drizzle ORM |
| **Cache** | Redis (AWS ElastiCache) via ioredis |
| **Auth** | Supabase Auth (JWT Bearer tokens) |
| **Storage** | AWS S3 (video/clip storage with Glacier lifecycle) |
| **Queue** | AWS SQS (job queue for video processing worker) |
| **Compute** | AWS ECS Fargate (backend + worker), AWS Lambda |
| **CDN** | AWS CloudFront |
| **Frontend Hosting** | AWS Amplify |
| **Monitoring** | Sentry (error tracking + profiling) |
| **Payments** | Stripe (subscriptions + usage-based billing) |
| **Email** | Resend |
| **IaC** | Terraform |
| **CI/CD** | GitHub Actions |
| **Docs** | Mintlify |

### Key AI/ML Integrations
- **OpenAI** - LLM for script generation, ad analysis, AI suggestions
- **Google Gemini** - Alternative LLM provider
- **Deepgram** - Speech-to-text transcription
- **ElevenLabs** - Voice cloning/synthesis
- **fal.ai** - Image/video generation
- **OpenCV** (Python) - Face detection, scene detection in Lambdas
- **Apify** - Social media scraping (Instagram, TikTok, X/Twitter)

## Development Setup

### Prerequisites
- Node.js v22+
- pnpm v10.12.2+
- PostgreSQL (local or remote)

### Installation

```bash
pnpm install
```

### Environment Variables

Environment variables are managed via [dotenv-vault](https://vault.dotenv.org). Each package has its own `.env.vault` file. To pull secrets locally:

```bash
npx dotenv-vault@latest login
npx dotenv-vault@latest pull   # Run from each package directory
```

Key environment variables (see `backend/src/config/env.ts`):
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Supabase auth
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY` - AI services
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payments
- `AWS_REGION` (default: us-west-2), `SQS_QUEUE_URL`, `S3_BUCKET`
- `RESEND_API_KEY` - Email
- `ELEVENLABS_API_KEY`, `FAL_KEY` - Media generation
- `APIFY_API_TOKEN` - Social media scraping

### Running Services

```bash
# Backend API server (port 3001)
pnpm dev:backend
# or: cd backend && pnpm dev

# Backend worker (SQS consumer for video processing)
cd backend && pnpm dev:worker

# Frontend (port 3000)
cd frontend && pnpm dev

# Admin frontend (port 3002)
cd admin-frontend && pnpm dev

# Status dashboard (port 3005)
cd status && pnpm dev

# Documentation site (port 3000)
cd docs && mint dev
```

## Backend Architecture

### Entry Points
- `backend/src/server.ts` - HTTP server bootstrap (Express + Socket.IO)
- `backend/src/app.ts` - Express app configuration, route mounting, middleware
- `backend/src/worker/index.ts` - SQS worker polling loop (processes video jobs)

### Code Organization (MVC-like)

```
backend/src/
├── server.ts              # Server startup
├── app.ts                 # Express app + route registration
├── instrument.ts          # Sentry instrumentation
├── config/                # Environment config, Swagger, Stripe plans
├── constants/             # App constants
├── controllers/           # Request handlers (one per feature domain)
├── routes/                # Express route definitions
│   └── api-platform/      # Public API routes (X-API-Key auth)
├── services/              # Business logic layer
│   ├── clips/             # Clip processing services
│   ├── face-swap/         # Face swap services
│   ├── ad-clone/          # Ad cloning services
│   ├── ai-ugc/            # AI UGC generation
│   ├── virality/          # Virality tracking
│   ├── google/            # Google Drive integration
│   └── massPosting/       # Social media mass posting
├── middleware/             # Auth, admin, subscription middleware
├── worker/                # SQS job consumer
│   └── processors/        # Individual job type processors
├── db/                    # Database connection setup
├── types/                 # TypeScript type definitions
├── utils/                 # Shared utilities
├── templates/             # Email/HTML templates
└── fonts/                 # Font assets (copied to dist on build)
```

### API Routes

All routes are prefixed with `/api/` except `/internal/` and `/health`. Key routes:

| Route | Description |
|-------|-------------|
| `/api/auth` | Authentication (Supabase-based) |
| `/api/clip-video` | Core clip creation and management |
| `/api/teams` | Team/workspace management |
| `/api/stripe` | Billing, subscriptions, webhooks |
| `/api/face-swap` | Face swap processing |
| `/api/ugc` | UGC script generation |
| `/api/scene-builder` | Scene builder for UGC videos |
| `/api/ugc-video` | UGC video generation |
| `/api/ad-clone` | Ad cloning analysis and script generation |
| `/api/virality` | Social media virality tracking |
| `/api/voice-clones` | Voice cloning |
| `/api/ad-posting` | Social media mass posting |
| `/api/graphics` | Graphics generation |
| `/api/admin` | Admin operations |
| `/api/platform` | Public API (X-API-Key auth) |
| `/api/folders` | Folder organization |
| `/api/tags` | Tagging system |
| `/api/referrals` | Referral program |
| `/api/announcements` | In-app announcements |
| `/api/intake` | User onboarding intake |
| `/api-docs` | Swagger UI documentation |
| `/health` | Health check endpoint |
| `/health/worker` | Worker health (SQS + ECS status) |

### Authentication

Two auth mechanisms:
1. **User auth** (`requireAuth` middleware): Supabase JWT tokens via `Authorization: Bearer <token>`. Verifies token with Supabase, looks up user in local DB by `supabase_uid`.
2. **API key auth** (`validateAPIKey` middleware): SHA-256 hashed API keys via `X-API-Key` header. Includes rate limiting (60 req/min) and billing balance checks.

Additional middleware:
- `requireSeatAccess` - Verifies team seat limits before actions
- `admin.middleware.ts` - Admin role verification
- `subscription.middleware.ts` - Subscription tier checks

### Worker (Video Processing)

The worker (`backend/src/worker/`) is a standalone process (separate ECS service, 8 vCPU / 16GB) that:
- Polls SQS for video processing jobs
- Processes up to 5 jobs concurrently
- Supports heartbeat-based visibility timeout extension
- Uses ECS task protection to prevent scale-in during processing

Job types handled:
`clip-video`, `batch-clip-video`, `update-captions`, `text-overlay`, `update-overlays`, `video-edit`, `generate-character`, `generate-scene-image`, `generate-script`, `generate-ugc-video`, `kling-face-swap`, `ad-clone-analyze`, `ad-clone-generate-script`, `ad-clone-analyze-and-script`, `ad-posting`

## Database

### ORM: Drizzle ORM

Schema is centralized in `packages/shared-db/src/schema.ts` and shared across backend and Lambda functions via the `@clipper/shared-db` workspace package.

### Key Tables
- `users` - User accounts (linked to Supabase via `supabase_uid`)
- `teams`, `teamMembers`, `teamInvites` - Multi-tenant team system
- `clips`, `addonClips` - Video clips and related clips
- `folders`, `tags` - Organization
- `jobs`, `jobsProgress` - Background job tracking
- `usageStats` - Usage metering per team
- `viralityAccounts`, `viralityPosts` - Social media tracking
- `APIKeys`, `apiBillingAccounts` - Public API billing
- `announcements`, `userAnnouncementDismissals` - In-app notifications

### Migration Workflow

```bash
# Generate migration from schema changes
cd packages/shared-db
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (visual DB editor)
pnpm db:studio

# Rebuild the shared package after schema changes
pnpm build
```

Migrations are environment-specific:
- `drizzle/` - Development
- `drizzle/staging/` - Staging
- `drizzle/prod/` - Production

Set `ENV=dev|staging|prod` when running migration commands.

## Frontend Architecture

### User Frontend (`frontend/`)

- **Framework**: Next.js 15 with Turbopack, React 18
- **UI Library**: HeroUI (component library)
- **Styling**: Tailwind CSS 4, tailwind-variants
- **State Management**: Jotai (atomic state), Redux (legacy)
- **Real-time**: Socket.IO client
- **Auth**: Supabase SSR (`@supabase/ssr`)
- **Charts**: Recharts
- **Video**: wavesurfer.js (audio waveforms), react-timeline-editor
- **DnD**: @dnd-kit

App router structure (`frontend/app/`):
```
app/
├── auth/              # Login, signup flows
├── dashboard/         # Main app
│   ├── clips/         # Clip management
│   ├── create-clip/   # Clip creation wizard
│   ├── ugc-studio/    # UGC content studio
│   ├── virality/      # Virality dashboard
│   ├── mass-posting/  # Social media posting
│   ├── api-platform/  # API key management
│   ├── pricing/       # Subscription plans
│   ├── settings/      # Account settings
│   ├── referrals/     # Referral program
│   └── usage/         # Usage statistics
├── invite/            # Team invite acceptance
├── reset-password/    # Password reset
└── shared/            # Shared page layouts
```

### Admin Frontend (`admin-frontend/`)

- **Framework**: Next.js 16, React 19
- **Styling**: Tailwind CSS 4
- Minimal admin dashboard (runs on port 3002)

## Lambda Functions

| Lambda | Runtime | Purpose |
|--------|---------|---------|
| `lambda-face-detect` | Python 3.12, OpenCV | Detect faces in video frames (SSD300 Caffe model) |
| `lambda-scene-detect` | Python 3.12, OpenCV | Detect scene cuts and silence in video |
| `lambda-youtube` | Python 3.12, yt-dlp | Download YouTube videos (max 1080p) |
| `lambda-expire-clips` | TypeScript/Node.js | Archive/delete stale clips, Glacier lifecycle |
| `lambda-virality-sync` | TypeScript/Node.js | Sync Instagram/TikTok/X metrics via Apify |

All Lambdas are containerized (ECR) and deployed via GitHub Actions.

## Infrastructure (Terraform)

All AWS infrastructure is defined in `infra/` using Terraform:

- **State**: S3 backend (`clipster-terraform-state`)
- **Region**: us-west-2
- **Environments**: dev, staging, prod

Key resources:
- **ECS Fargate**: Backend (2 tasks, 2vCPU/4GB), Worker (8vCPU/16GB)
- **RDS PostgreSQL**: Primary database
- **ElastiCache Redis**: Caching layer
- **S3**: Video/clip storage with lifecycle policies
- **SQS**: Job queue (14-day retention)
- **ALB**: Load balancer with CORS
- **CloudFront**: CDN
- **Amplify**: Frontend hosting
- **Lambda**: 5 serverless functions
- **Secrets Manager**: All API keys and credentials

## CI/CD (GitHub Actions)

### Pipeline Architecture

A single unified `ci.yml` orchestrator detects what changed (via `dorny/paths-filter`) and conditionally runs only the relevant jobs. Reusable workflows (`_deploy-ecs.yml`, `_deploy-lambda.yml`) provide DRY deploy templates.

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push to main/staging, tags `v*`, PRs, workflow_dispatch | Unified pipeline: test -> terraform -> deploy (only changed services) |
| `_deploy-ecs.yml` | Called by ci.yml | Reusable: build Docker -> ECR -> deploy ECS service |
| `_deploy-lambda.yml` | Called by ci.yml | Reusable: build Docker -> ECR -> update Lambda function(s) |
| `release.yml` | Push to main | release-please: auto version bumps, tags, changelogs from conventional commits |
| `rollback.yml` | workflow_dispatch only | One-click rollback for ECS services and Lambda functions |
| `claude-code-review.yml` | Pull requests | AI code review |
| `claude.yml` | Issue/PR comments with @claude | Claude Code agent |

### Release Management

Uses `release-please` with conventional commits (`feat:`, `fix:`, `chore:`, etc.):
- Push to main with conventional commits -> release-please creates/updates a Release PR
- Merge the Release PR -> git tag (`v1.2.0`) + GitHub Release with auto-generated changelog
- Tag creation triggers production deployment of all services
- `feat:` bumps MINOR, `fix:` bumps PATCH, `feat!:` bumps MAJOR

### Rollback

- **Quick (ECS/Lambda)**: Use `rollback.yml` via workflow_dispatch — redeploys previous Docker image
- **Full**: `git revert <commit>` on main triggers full redeploy

### Manual Deploy

Trigger `ci.yml` via workflow_dispatch with service selector (all/backend/worker/etc.) and environment (production/staging).

### Build & Test Commands

```bash
# Backend
cd backend
pnpm build          # TypeScript compile + copy assets
pnpm test           # Run all tests (vitest)
pnpm test:unit      # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:watch     # Watch mode
pnpm test:coverage  # With coverage
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm type-check     # TypeScript type checking (tsc --noEmit)

# Frontend
cd frontend
pnpm build          # Next.js production build
pnpm lint           # ESLint

# Shared DB
cd packages/shared-db
pnpm build          # TypeScript compile
```

## Coding Conventions

### TypeScript/Backend
- **Target**: ES2021, module: node16
- **Strict mode**: Enabled (but `noImplicitAny: false`)
- Express route pattern: `routes/*.routes.ts` -> `controllers/*.controller.ts` -> `services/*.service.ts`
- Validation: Zod schemas
- Error monitoring: Sentry (via `@sentry/node`)
- Testing: Vitest with supertest for API tests
- Tests colocated in `__tests__/` directories alongside source

### Frontend
- Next.js App Router (not Pages)
- Components organized by feature domain in `components/`
- HeroUI for UI primitives
- Tailwind CSS for styling (tailwind-variants for variant composition)
- Jotai for lightweight state; Redux for legacy state
- ESLint + Prettier for code quality
- **Minimize useEffect usage** — follow [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect):
  - Don't use useEffect to transform data for rendering — compute during render instead
  - Don't use useEffect to handle user events — call handlers directly from event callbacks
  - Don't use useEffect to reset state when props change — use a `key` prop or compute from props
  - Don't use useEffect to sync with parent state — lift state up or pass callbacks
  - Don't use useEffect to fetch data triggered by user actions — fetch in the event handler
  - Only use useEffect for things that genuinely need to synchronize with an external system (subscriptions, timers, DOM APIs, third-party widgets)
- **UI Design Style — Liquid Glass**:
  - Cards and panels: `bg-white/[0.04] backdrop-blur-2xl` with `border border-white/[0.08]` and `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]`
  - Dividers: `bg-white/[0.06]` (not HeroUI Separator)
  - Inner containers (pills, stats): `bg-white/[0.04] border border-white/[0.06] rounded-xl`
  - Highlighted/active cards: `border-accent-400/40 shadow-lg shadow-accent-400/10`
  - Use `rounded-2xl` for cards, `rounded-xl` for inner elements
  - Accent color: `accent-400` (purple) for buttons, badges, check icons, links
  - Use framer-motion for: staggered entrance animations (`opacity/y`), hover effects (`scale(1.015)` + glow `boxShadow`), accordion open/close (`AnimatePresence` + height animation)
  - Badges/chips: use plain `<span>` with Tailwind classes, not HeroUI `Chip` (it fights custom styles)
  - Background: gradient blob with `from-accent-400/30 to-purple-500/20 opacity-30 blur-3xl` behind content

### Database
- All schema changes go through `packages/shared-db/src/schema.ts`
- Always generate migrations, never push schema directly in production
- Rebuild `@clipper/shared-db` after schema changes (`pnpm build`)
- Use Drizzle query builder for type-safe queries

### OpenAI Usage
- **Always use the Responses API** (`openaiClient.responses.create`), never the Chat Completions API (`openaiClient.chat.completions.create`)
- Use `instructions` for system-level prompts, `input` for user content, and read results from `response.output_text`
- Default model: `gpt-5-mini` for lightweight tasks, `gpt-5.2` for complex/multimodal tasks

### General
- Package manager: pnpm only (never npm or yarn)
- Node.js v22+
- Environment variables: never commit `.env` files (use dotenv-vault)
- Secrets in production: AWS Secrets Manager
- CORS: explicitly allowlisted origins in `backend/src/app.ts`

## Important Patterns

### Adding a New API Endpoint
1. Define a **named schema** in `backend/src/config/swagger.ts` under `components.schemas` for both request and response types
2. Create/update route in `backend/src/routes/<feature>.routes.ts` with `@openapi` JSDoc referencing the schema via `$ref: '#/components/schemas/MyResponse'`
3. Create/update controller in `backend/src/controllers/<feature>.controller.ts` — import the generated type: `import type { MyResponse } from "../types/api.types"`
4. Create/update service in `backend/src/services/<feature>.service.ts`
5. Add route mounting in `backend/src/app.ts` if new route file
6. Apply `requireAuth` or `validateAPIKey` middleware as appropriate
7. Run `pnpm build:shared` from the repo root — this exports the OpenAPI spec, generates `openapi.json`, and builds typed models into `packages/shared-types/`
8. Import types in frontend: `import type { MyResponse } from "@clipper/shared-types"`

The type pipeline: `swagger.ts` schemas + `@openapi` JSDoc → `pnpm build:shared` → `openapi.json` → `generated/api.ts` → `models.ts` → `api.types.ts`. Only `swagger.ts` and route JSDoc are manual. Never edit generated files. All response/request types MUST be named schemas in `swagger.ts`.

### Adding a New Database Table
1. Define table in `packages/shared-db/src/schema.ts`
2. Generate migration: `cd packages/shared-db && pnpm db:generate`
3. Apply migration: `pnpm db:migrate`
4. Rebuild: `pnpm build`
5. Import in backend: `import { myTable } from "@clipper/shared-db/src/schema"`

### Adding a New Worker Job Type
1. Define job type in `backend/src/services/sqs.service.ts`
2. Create processor in `backend/src/worker/processors/<name>Processor.ts`
3. Add case to switch in `backend/src/worker/index.ts`
4. Enqueue from service layer via `sqs.service`

### Deploying Changes

All deployments go through the unified `ci.yml` pipeline:

- **Staging**: Push/merge to `staging` branch -> auto-deploys changed services to staging
- **Production**: Merge the Release PR to `main` -> creates tag -> deploys all services to production
- **Push to main (no Release PR)**: Only runs tests + terraform apply. No service deploys until Release PR is merged.
- **Frontend**: Deployed via AWS Amplify (auto-deploys on main/staging)
- **Manual deploy**: Trigger `ci.yml` via workflow_dispatch, select service + environment
- **Rollback**: Trigger `rollback.yml` via workflow_dispatch, select service + target image

### Commit Convention

Use conventional commits for automatic versioning and changelogs:

- `feat: add webhook retry logic` -> bumps MINOR version
- `fix: clip preview not loading` -> bumps PATCH version
- `feat!: redesign auth flow` -> bumps MAJOR version (breaking change)
- `chore: update dependencies` -> included in changelog, no version bump
- `refactor: extract clip service` -> included in changelog, no version bump

### Release Flow

1. Merge feature branches to `staging` (auto-deploys to staging)
2. Merge `staging` to `main` via PR (runs tests + terraform only, NO service deploys)
3. `release-please` creates/updates a Release PR on main with bumped version + changelog
4. Merge the Release PR -> creates git tag `v1.2.0` -> triggers production deploy of all services

## Frontend Aesthetics

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. The default design language for this project is **glassmorphic liquid glass** — translucent layers, refractive blur, fluid motion, and luminous depth. Focus on:

**Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics. Favor elegant, modern typefaces that complement the glass aesthetic — thin weights, geometric forms, and high-contrast pairings work well against translucent surfaces.

**Color & Theme**: Commit to a cohesive glassmorphic aesthetic. Use CSS variables for consistency. Build palettes around translucent whites, frosted tints, and vibrant accent colors that glow through glass layers. Dominant colors with sharp luminous accents outperform timid, evenly-distributed palettes. Draw from iOS liquid glass, frosted UI patterns, and ambient light aesthetics for inspiration.

**Glass Effects**: Layer `backdrop-filter: blur()` and `saturate()` to create depth. Use semi-transparent backgrounds (`rgba`/`hsla` with low opacity), subtle borders (`1px solid rgba(255,255,255,0.18)`), and soft box-shadows to simulate refractive glass panels. Stack multiple glass layers at varying opacities to create parallax depth. Add inner highlights and edge lighting to sell the material illusion.

**Motion**: Use animations for fluid, liquid-feeling transitions and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Favor smooth, spring-based easing curves that feel organic and liquid. Elements should feel like they float, settle, and ripple.

**Backgrounds**: Create atmosphere and depth with gradient meshes, soft radial glows, and layered noise textures behind glass panels. Use ambient color blobs or aurora-style gradients that shift subtly. The background should feel alive and luminous, giving glass layers something beautiful to refract.

**Avoid generic AI-generated aesthetics**:
- Overused font families (Inter, Roboto, Arial, Space Grotesk, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
- Flat, opaque cards when glass panels would create more depth
- Heavy drop shadows when soft, diffused glows are more appropriate

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark glass themes, different fonts, different accent palettes. Every surface should feel like it has material quality — weight, translucency, and light response.
</frontend_aesthetics>
