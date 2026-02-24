# CLAUDE.md

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

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `test-backend.yml` | PR/push to main/staging (backend/** or shared-db/**) | Runs `pnpm test` in backend |
| `deploy-backend.yml` | Push to main (backend/**) | Build Docker -> ECR -> Deploy ECS |
| `deploy-worker.yml` | Push to main (backend/src/worker/**) | Build Docker -> ECR -> Deploy ECS worker |
| `deploy-*-lambda.yml` | Push to main (lambda paths) | Build Docker -> ECR -> Update Lambda |
| `terraform-deploy.yml` | Push to main (infra/**) | Terraform plan -> apply |
| `claude-code-review.yml` | Pull requests | AI code review |
| `*-staging.yml` | Staging-specific deployments | Same pattern, staging resources |

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

### Database
- All schema changes go through `packages/shared-db/src/schema.ts`
- Always generate migrations, never push schema directly in production
- Rebuild `@clipper/shared-db` after schema changes (`pnpm build`)
- Use Drizzle query builder for type-safe queries

### General
- Package manager: pnpm only (never npm or yarn)
- Node.js v22+
- Environment variables: never commit `.env` files (use dotenv-vault)
- Secrets in production: AWS Secrets Manager
- CORS: explicitly allowlisted origins in `backend/src/app.ts`

## Important Patterns

### Adding a New API Endpoint
1. Create/update route in `backend/src/routes/<feature>.routes.ts`
2. Create/update controller in `backend/src/controllers/<feature>.controller.ts`
3. Create/update service in `backend/src/services/<feature>.service.ts`
4. Add route mounting in `backend/src/app.ts` if new route file
5. Apply `requireAuth` or `validateAPIKey` middleware as appropriate

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
- **Backend/Worker**: Push to `main` branch; CI auto-deploys via ECR -> ECS
- **Lambdas**: Push to `main` with changes in lambda directory; CI auto-deploys
- **Infrastructure**: Push to `main` with changes in `infra/`; Terraform auto-applies
- **Frontend**: Deployed via AWS Amplify (auto-deploys on main)
- **Staging**: Use `staging` branch or staging-specific workflows
