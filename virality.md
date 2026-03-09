---
title: "Virality & Performance Tracking"
description: "Comprehensive technical documentation for the virality competitor tracking and user performance tracking systems"
---

# Virality & Performance Tracking

Cuttr's virality system provides two complementary features:

1. **Competitor Tracking (Virality)** — Monitor competitor social media accounts, detect viral posts, and receive email alerts
2. **Your Performance** — Track your own accounts and mass-posted content with per-post analytics

Both systems share a common `AccountTrackingService` base class and are synced by the same AWS Step Function on a 12-hour schedule.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │   AWS EventBridge (every 12 hours)   │
                    │     cron(0 */12 * * ? *)             │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │   Step Functions State Machine       │
                    │   clipster-virality-sync-prod        │
                    │                                      │
                    │  1. Orchestrator Lambda               │
                    │     → Fetch all active accounts       │
                    │     → Clean up stale syncs            │
                    │                                      │
                    │  2. Map: Worker Lambda (parallel)     │
                    │     → Per-account Apify scrape        │
                    │     → Upsert posts + metrics          │
                    │     → Credit gating                   │
                    │                                      │
                    │  3. Team Extractor Lambda             │
                    │     → Deduplicate team IDs            │
                    │                                      │
                    │  4. Map: Reporter Lambda (per team)   │
                    │     → Detect viral posts              │
                    │     → Send email alerts               │
                    └─────────────────────────────────────┘

    ┌────────────────────┐         ┌────────────────────────┐
    │  Virality Accounts │         │   User Accounts        │
    │  (competitors)     │         │   (your performance)   │
    │                    │         │                        │
    │  viralityAccounts  │         │  userAccounts          │
    │  viralityPosts     │         │  userPosts             │
    │                    │         │  source: null |        │
    │                    │         │    "mass_posting"      │
    └────────────────────┘         └────────────────────────┘
```

---

## Two Tracking Systems

### Competitor Tracking (Virality)

Track competitor social media accounts to monitor their performance and detect viral content.

| Aspect            | Detail                                                      |
| ----------------- | ----------------------------------------------------------- |
| **Tables**        | `viralityAccounts`, `viralityPosts`                         |
| **Grouping**      | Accounts grouped under `viralityCompetitors` (optional)     |
| **Alerts**        | Viral post detection with email notifications + PDF reports |
| **Routes**        | `/api/virality/{teamId}/...`                                |
| **UI**            | Dashboard → Virality → Competitor pages                     |
| **Account Types** | `profile`, `hashtag`, `keyword`                             |

### Your Performance

Track your own accounts — both organically added accounts and mass-posting burner accounts.

| Aspect             | Detail                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| **Tables**         | `userAccounts`, `userPosts`                                               |
| **Source Field**   | `null` = organic account, `"mass_posting"` = auto-created by mass posting |
| **Alerts**         | Not supported (reporter only runs for `source: "virality"`)               |
| **Routes**         | `/api/user-performance/{teamId}/...`                                      |
| **UI**             | Dashboard → Virality → Your Performance                                   |
| **Mass Post Link** | `userPosts.mass_post_id` references the original `posts` table            |

---

## Database Schema

### Tables

#### `viralityCompetitors`

Groups competitor accounts under a named competitor.

| Column        | Type               | Description          |
| ------------- | ------------------ | -------------------- |
| `id`          | serial PK          |                      |
| `team_id`     | integer FK → teams | Owning team          |
| `name`        | varchar(255)       | Competitor name      |
| `description` | text               | Optional description |
| `created_at`  | timestamp          |                      |
| `updated_at`  | timestamp          |                      |

#### `viralityAccounts`

Tracked competitor social media accounts.

| Column             | Type                                      | Description                         |
| ------------------ | ----------------------------------------- | ----------------------------------- |
| `id`               | serial PK                                 |                                     |
| `team_id`          | integer FK → teams                        |                                     |
| `competitor_id`    | integer FK → viralityCompetitors          | Optional grouping                   |
| `platform`         | enum: instagram, tiktok, x                |                                     |
| `account_type`     | varchar(20), default "profile"            | profile, hashtag, or keyword        |
| `username`         | varchar(255)                              | Handle without @                    |
| `profile_url`      | text                                      | Full URL                            |
| `display_name`     | varchar(255)                              |                                     |
| `avatar_url`       | text                                      |                                     |
| `bio`              | text                                      |                                     |
| `follower_count`   | integer                                   | Latest count                        |
| `following_count`  | integer                                   |                                     |
| `total_likes`      | integer                                   | Sum of all post likes               |
| `post_count`       | integer                                   |                                     |
| `follower_history` | jsonb                                     | Array of `{recorded_at, followers}` |
| `is_verified`      | boolean                                   |                                     |
| `last_synced_at`   | timestamp                                 | Last successful sync                |
| `sync_status`      | enum: pending, syncing, completed, failed |                                     |
| `sync_error`       | text                                      | Error message if failed             |
| `alert_enabled`    | boolean, default false                    | Include in viral alerts             |
| `is_active`        | boolean, default true                     | Deactivated if credits run out      |
| `syncs_remaining`  | integer, default 14                       | Decremented each sync               |
| `created_at`       | timestamp                                 |                                     |
| `updated_at`       | timestamp                                 |                                     |

**Unique constraint**: `(team_id, platform, username)`

#### `userAccounts`

Same structure as `viralityAccounts` plus:

| Column   | Type                  | Description                                       |
| -------- | --------------------- | ------------------------------------------------- |
| `source` | varchar(20), nullable | `null` = organic, `"mass_posting"` = auto-created |

All other columns identical to `viralityAccounts`.

#### `viralityPosts` / `userPosts`

Tracked posts with metrics history.

| Column             | Type                               | Description                                           |
| ------------------ | ---------------------------------- | ----------------------------------------------------- |
| `id`               | serial PK                          |                                                       |
| `account_id`       | integer FK → parent accounts table | Cascade delete                                        |
| `platform_post_id` | varchar(255)                       | Canonical ID (shortCode for IG, numeric for TikTok/X) |
| `post_url`         | text                               | Direct post URL                                       |
| `thumbnail_url`    | text                               |                                                       |
| `caption`          | text                               |                                                       |
| `hashtags`         | jsonb                              | Array of strings                                      |
| `post_type`        | varchar(50)                        | e.g., "Video", "Image", "Reel"                        |
| `posted_at`        | timestamp                          | Original post date                                    |
| `like_count`       | integer                            | Latest likes                                          |
| `comment_count`    | integer                            | Latest comments                                       |
| `video_view_count` | integer                            |                                                       |
| `video_play_count` | integer                            |                                                       |
| `metrics_history`  | jsonb, default []                  | Array of MetricsEntry snapshots                       |
| `syncs_remaining`  | integer                            | Default 14 (virality) or 28 (user)                    |
| `created_at`       | timestamp                          |                                                       |
| `updated_at`       | timestamp                          |                                                       |

**`userPosts` only**:

| Column         | Type                         | Description                                   |
| -------------- | ---------------------------- | --------------------------------------------- |
| `mass_post_id` | integer FK → posts, nullable | Links to the mass posting job that created it |

**Unique constraint**: `(account_id, platform_post_id)`

#### `MetricsEntry` (jsonb structure)

```typescript
{
  recorded_at: string; // ISO timestamp
  likes: number;
  comments: number;
  views: number | null;
}
```

Maximum entries retained: `MAX_METRICS_HISTORY = 62` (31 days x 2 syncs/day). Oldest entries are trimmed on each sync.

#### `viralitySettings`

Per-team alert configuration.

| Column               | Type                    | Description                                  |
| -------------------- | ----------------------- | -------------------------------------------- |
| `id`                 | serial PK               |                                              |
| `team_id`            | integer FK → teams      | Unique per team                              |
| `percent_threshold`  | integer, default 100    | % growth to trigger alert (e.g., 100 = 100%) |
| `absolute_threshold` | integer, default 100000 | Absolute views gained to trigger             |
| `threshold_mode`     | enum: "and", "or"       | Both conditions or either                    |
| `time_frame_hours`   | integer, default 24     | Lookback window for growth detection         |
| `additional_emails`  | jsonb, default []       | Extra email recipients                       |

#### `viralityAlertLogs`

History of sent viral alerts.

| Column           | Type                         | Description                      |
| ---------------- | ---------------------------- | -------------------------------- |
| `id`             | serial PK                    |                                  |
| `team_id`        | integer FK → teams           |                                  |
| `user_id`        | integer FK → users, nullable |                                  |
| `email`          | varchar(255)                 | Recipient                        |
| `subject`        | varchar(500)                 | Email subject                    |
| `email_body`     | text                         | Lightweight summary              |
| `viral_post_ids` | jsonb                        | Array of post IDs that triggered |
| `status`         | enum: "sent", "failed"       |                                  |
| `error_message`  | text, nullable               |                                  |
| `sent_at`        | timestamp                    |                                  |

---

## Sync System

### Constants

```
SCRAPE_WINDOW_DAYS    = 31        Posts newer than 31 days
SYNC_INTERVAL_HOURS   = 12        Step Function runs every 12h
SYNCS_PER_DAY         = 2         24 / 12
SYNCS_PER_WEEK        = 14        2 * 7
MAX_METRICS_HISTORY   = 62        31 * 2 (entries per post)
MAX_FOLLOWER_HISTORY  = 180       ~6 months of daily follower snapshots
STALE_SYNC_MINUTES    = 15        Syncs stuck > 15 min are reset to "failed"
```

### Sync Triggers

There are three ways syncs are triggered:

| Trigger                       | What Gets Synced                                                                                     | Who Calls It                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Scheduled (Step Function)** | All active `viralityAccounts` + `userAccounts` where `source != 'mass_posting'`                      | EventBridge cron every 12h               |
| **Manual Single Account**     | One account (full profile scrape)                                                                    | UI "Refresh" button per account          |
| **Sync All**                  | All non-mass-posting accounts (full scrape) + all mass posting posts (per-post scrape, no decrement) | UI "Sync All" button on Your Performance |

### What the Step Function DOES NOT Sync

Mass posting accounts (`source = 'mass_posting'`) are **excluded** from the Step Function. The orchestrator explicitly filters them:

```typescript
or(
  isNull(schema.userAccounts.source),
  not(eq(schema.userAccounts.source, "mass_posting")),
);
```

Mass posting posts are synced separately — either via the "Sync All" button or through the `syncMassPostAnalytics()` service.

### Account-Level Sync Flow

This is the full profile scrape that runs for non-mass-posting accounts.

```
1. cleanupStaleSyncs()
   └─ Any account stuck in "pending"/"syncing" > 15 min → set to "failed"

2. Credit Gating (atomic)
   ├─ Decrement syncs_remaining (WHERE syncs_remaining > 0)
   ├─ If syncs_remaining was 0:
   │   ├─ Charge 1 credit (consumeClip)
   │   ├─ Reset syncs_remaining to SYNCS_PER_WEEK - 1 (13)
   │   └─ If no credits → deactivate account, abort
   └─ Set sync_status = "syncing"

3. Apify Scrape (based on account_type + platform)
   ├─ Profile: scrapeInstagramPosts / scrapeTikTokPosts / scrapeXPosts
   │   └─ Returns up to 100 posts from last 31 days + profile data
   ├─ Hashtag: scrapeInstagramHashtag / scrapeTikTokHashtag / scrapeXKeywordSearch
   └─ Keyword: scrapeXKeywordSearch / scrapeTikTokHashtag / scrapeInstagramHashtag

4. Update Profile (profile-type only)
   ├─ Followers, display name, avatar, bio, post count
   ├─ Append to follower_history (max 180 entries)
   └─ X: separate follower count fetch via scrapeXFollowerCount

5. Upsert Posts
   ├─ Deduplicate by (account_id, platform_post_id)
   ├─ Extract canonical post ID from URL
   ├─ If existing: append MetricsEntry to metrics_history, trim to 62
   └─ If new: insert with [MetricsEntry]

6. Finalize
   ├─ Compute total_likes (SUM of all post like_count)
   ├─ Set sync_status = "completed", last_synced_at = now()
   └─ Emit socket event: virality-sync-update
```

### Mass Posting Per-Post Sync Flow

This is the lightweight per-post scrape for mass posting content.

```
1. Query user_posts WHERE mass_post_id IS NOT NULL AND syncs_remaining > 0
   └─ Optionally filtered by team_id

2. For each post (concurrency = 5):
   ├─ Call apify.scrapePostMetrics(post_url, platform)
   │   └─ Scrapes single post URL → { likesCount, commentsCount, viewCount, thumbnailUrl }
   ├─ Append MetricsEntry to metrics_history (trim to MAX_METRICS_HISTORY)
   ├─ Update like_count, comment_count, video_play_count, thumbnail_url
   └─ Decrement syncs_remaining (only on scheduled runs, NOT on "Sync All")
```

**Key difference**: "Sync All" calls `syncMassPostAnalytics(teamId, false)` — the `false` means syncs are NOT decremented. This preserves the 28-sync budget for scheduled runs, ensuring mass posting posts get a full month of tracking for CPM analysis.

### Credit Economics

| Resource                   | Cost                                      | Reset                                        |
| -------------------------- | ----------------------------------------- | -------------------------------------------- |
| Account sync (per account) | 14 free syncs, then 1 credit per 14 syncs | `syncs_remaining` resets to 13 after charge  |
| Mass posting post sync     | 28 syncs total per post                   | No reset — post stops syncing when exhausted |

**At the default 12h schedule**:

- Account-level: 14 syncs ÷ 2/day = **1 credit per account per week** (indefinite)
- Mass posting posts: 28 syncs ÷ ~1/day = **~28 days of tracking** (then stops)

**Credit consumption order**: Base plan pool first → addon pool → if both empty, account is deactivated.

### Apify Scrapers

| Actor                                  | Platform              | Params                                                    |
| -------------------------------------- | --------------------- | --------------------------------------------------------- |
| `apify/instagram-scraper`              | Instagram posts       | `onlyPostsNewerThan: "31 days"`, `resultsLimit: 100`      |
| `apify/instagram-profile-scraper`      | Instagram profile     | `usernames: [username]`                                   |
| `apify/instagram-reel-scraper`         | Instagram single reel | `directUrls: [reelUrl]`                                   |
| `clockworks/tiktok-scraper`            | TikTok posts          | `oldestPostDateUnified: "31 days"`, `resultsPerPage: 100` |
| `apidojo/twitter-scraper-lite`         | X posts               | `start/end` date range (31 days), `maxItems: 100`         |
| `scrape.badger/twitter-tweets-scraper` | X view counts         | `tweetIds: [...]` (supplemental)                          |

**X (Twitter) requires two scrapers**: One for post data (likes, retweets), a separate one for view counts, which are merged by tweet ID.

---

## Step Function (AWS)

### Infrastructure

**State Machine**: `clipster-virality-sync-prod`
**Schedule**: EventBridge rule `cron(0 */12 * * ? *)` (00:00 UTC and 12:00 UTC)
**Region**: us-west-2

### Lambda Functions

| Lambda         | Memory | Timeout       | Purpose                                        |
| -------------- | ------ | ------------- | ---------------------------------------------- |
| Orchestrator   | 256 MB | 60s           | Fetch all active accounts, clean stale syncs   |
| Worker         | 512 MB | 900s (15 min) | Per-account Apify scrape + upsert              |
| Team Extractor | 256 MB | 30s           | Deduplicate team IDs from results              |
| Reporter       | 512 MB | 120s          | Detect viral posts, send email alerts per team |

### State Machine Flow

```
FetchAccounts (Orchestrator)
    │
    │  Returns: { accounts: [{id, username, platform, team_id, syncs_remaining, account_type, source}, ...] }
    │
    ▼
SyncAllAccounts (Map — parallel, configurable max concurrency)
    │
    │  For each account → Worker Lambda
    │  Retry: 1 attempt, 30s backoff
    │  Catch: On failure, continue (ItemBatcher)
    │
    ▼
ExtractTeams (Team Extractor)
    │
    │  Input: all Map results
    │  Filters: only source="virality" AND status="completed"
    │  Returns: { teams: [{teamId}, ...] }
    │
    ▼
ReportPerTeam (Map — max concurrency 5)
    │
    │  For each team → Reporter Lambda
    │  Only runs for virality (competitor) accounts, NOT user performance
    │
    ▼
Done (Succeed)
```

### Orchestrator Account Selection

The orchestrator merges two queries:

```typescript
// Virality accounts: all active, supported platforms
viralityAccounts WHERE is_active=true AND platform IN ('instagram','tiktok','x')
  → tagged with source: "virality"

// User accounts: active, supported platforms, excluding mass_posting
userAccounts WHERE is_active=true AND platform IN ('instagram','tiktok','x')
  AND (source IS NULL OR source != 'mass_posting')
  → tagged with source: "user"
```

The `source` field tells the Worker Lambda which table to read/write from.

### Worker Table Routing

```typescript
const isUserAccount = source === "user";
const accountsTable = isUserAccount
  ? schema.userAccounts
  : schema.viralityAccounts;
const postsTable = isUserAccount ? schema.userPosts : schema.viralityPosts;
```

---

## Viral Alerts

Viral alerts only apply to **competitor (virality) accounts**, not user performance.

### Detection Algorithm

```
For each alert_enabled account:
  For each post:
    1. Find metrics_history entries within time_frame_hours window
    2. Get earliest entry (prev) and latest entry (curr) in window
    3. Calculate: percentIncrease = (curr.views - prev.views) / prev.views * 100
    4. Calculate: absoluteIncrease = curr.views - prev.views
    5. Apply threshold_mode:
       - "and": percentIncrease >= percent_threshold AND absoluteIncrease >= absolute_threshold
       - "or":  percentIncrease >= percent_threshold OR absoluteIncrease >= absolute_threshold
    6. Special: if prev.views = 0 (new post), only check absolute threshold
```

### Alert Debounce

- Checks `viralityAlertLogs` for the team
- Skips if an alert was sent in the last **12 hours**

### Email Contents

- Grouped by competitor (competitor name, account count, viral post count)
- Up to 8 posts per competitor, 30 total posts in email
- Full PDF attachment with branding, all posts, views, growth %, likes, post URLs
- Recipients: all team members + `additionalEmails` from `viralitySettings`

---

## "Sync All" Button (Your Performance)

The "Sync All" button on the Your Performance page calls a single backend endpoint:

```
POST /api/user-performance/{teamId}/sync-all
```

### What It Does

1. **Fetch all accounts** for the team
2. **Split by source**:
   - `source != "mass_posting"` → regular accounts → full Apify profile scrape (`syncAccount`)
   - `source = "mass_posting"` → mass posting accounts → per-post metrics scrape (`syncMassPostAnalytics`)
3. **Mass posting posts are synced WITHOUT decrementing `syncs_remaining`** — this preserves the 28-sync budget for scheduled runs, ensuring a full month of tracking for CPM analysis
4. **Return summary**: `{ accounts: { synced, failed }, massPosts: { synced, skipped } }`

### Frontend Toast

The frontend shows a combined toast:

- "Synced 2 account(s) + 15 post(s)"
- Warning if any accounts failed
- "Nothing to sync" if no accounts or posts needed syncing

---

## Mass Posting Integration

When a mass posting job completes and publishes a post:

1. `adPosting.service.ts` → `findOrCreateMassPostingAccount()`:
   - Checks if `userAccounts` row exists for `(team_id, platform, username)`
   - If not, creates one with `source: "mass_posting"`
2. Links the published post to `userPosts` with `mass_post_id` referencing the original `posts` record
3. The post starts with `syncs_remaining = 28` for ~1 month of per-post tracking

These accounts:

- **Appear** in the Your Performance UI (so you can see metrics)
- **Are excluded** from the Step Function (synced differently)
- **Are excluded** from "Sync All" account-level syncs (only their posts are synced per-post)

---

## Real-Time Updates (WebSocket)

When a sync completes or fails, a Socket.IO event is emitted:

```typescript
// Event: "virality-sync-update"
// Room: "team-{teamId}"
{
  accountId: number;
  syncStatus: "completed" | "failed";
  syncError?: string;
}
```

The frontend `useViralitySyncSocket` hook listens for these events and triggers `fetchData(true)` (silent refresh) when accounts finish their initial sync.

---

## Frontend Data Flow

### Your Performance Page

```
MyPerformanceView
  │
  ├─ fetchData()
  │   ├─ GET /user-performance/{teamId}/accounts → setAccounts()
  │   └─ For each account: GET /user-performance/{teamId}/accounts/{id}/posts → setPostsByAccount()
  │
  ├─ derived (useMemo)
  │   ├─ Filter active accounts and posts by date range
  │   ├─ Compute lastSyncedAt = max(account.last_synced_at) across all accounts
  │   ├─ Build chart data (hourly aggregation of metrics_history)
  │   └─ Compute postsPerWeek
  │
  ├─ "Last synced X ago · Next sync in Yh Zm"
  │   ├─ timeAgo(lastSyncedAt) → human-readable
  │   └─ getNextSyncCountdown() → hardcoded to 12h UTC schedule (00:00 / 12:00)
  │
  └─ handleSyncAll() → POST /user-performance/{teamId}/sync-all
```

### Chart Data Aggregation

Posts' `metrics_history` arrays are aggregated into hourly chart points:

1. For each post, build a Map of `hourKey → max metric value` (dedup snapshots in same hour)
2. Sum across all posts per hour
3. Group by account for overlay lines
4. Sort hours chronologically

---

## API Routes

### Virality (Competitors)

| Method | Route                                   | Description                                      |
| ------ | --------------------------------------- | ------------------------------------------------ |
| GET    | `/{teamId}/accounts`                    | List all competitor accounts                     |
| POST   | `/{teamId}/accounts`                    | Add account (platform, profileUrl, competitorId) |
| GET    | `/{teamId}/accounts/{accountId}`        | Get account                                      |
| DELETE | `/{teamId}/accounts/{accountId}`        | Remove account                                   |
| PATCH  | `/{teamId}/accounts/{accountId}/status` | Toggle is_active                                 |
| POST   | `/{teamId}/accounts/{accountId}/sync`   | Manual sync                                      |
| GET    | `/{teamId}/accounts/{accountId}/posts`  | Get posts (limit, offset, date filters)          |
| DELETE | `/{teamId}/posts/{postId}`              | Delete post                                      |
| GET    | `/{teamId}/dashboard`                   | Dashboard stats                                  |
| GET    | `/{teamId}/competitors`                 | List competitors                                 |
| POST   | `/{teamId}/competitors`                 | Create competitor                                |
| GET    | `/{teamId}/competitors/{competitorId}`  | Get with accounts                                |
| PATCH  | `/{teamId}/competitors/{competitorId}`  | Update                                           |
| DELETE | `/{teamId}/competitors/{competitorId}`  | Delete                                           |
| PATCH  | `/{teamId}/accounts/{accountId}/alerts` | Toggle alert_enabled                             |
| GET    | `/{teamId}/settings`                    | Get alert settings                               |
| PUT    | `/{teamId}/settings`                    | Save alert settings                              |
| GET    | `/{teamId}/alert-logs`                  | Alert history                                    |

### User Performance

| Method | Route                                   | Description                                     |
| ------ | --------------------------------------- | ----------------------------------------------- |
| GET    | `/{teamId}/accounts`                    | List all user accounts (including mass posting) |
| POST   | `/{teamId}/accounts`                    | Add organic account                             |
| GET    | `/{teamId}/accounts/{accountId}`        | Get account                                     |
| DELETE | `/{teamId}/accounts/{accountId}`        | Remove account                                  |
| PATCH  | `/{teamId}/accounts/{accountId}/status` | Toggle is_active                                |
| POST   | `/{teamId}/accounts/{accountId}/sync`   | Manual sync (single account)                    |
| POST   | `/{teamId}/sync-all`                    | Sync all accounts + mass posting posts          |
| GET    | `/{teamId}/accounts/{accountId}/posts`  | Get posts                                       |
| DELETE | `/{teamId}/posts/{postId}`              | Delete post                                     |
| GET    | `/{teamId}/dashboard`                   | Dashboard stats                                 |

---

## Key Files Reference

### Backend

| File                                                       | Purpose                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `backend/src/config/virality.ts`                           | Constants: scrape window, sync interval, actor IDs            |
| `backend/src/services/virality/accountTracking.service.ts` | Base class for account syncing (shared by both systems)       |
| `backend/src/services/virality/userPerformance.service.ts` | Instance of AccountTrackingService for userAccounts/userPosts |
| `backend/src/services/virality/apify.service.ts`           | All Apify scraper integrations                                |
| `backend/src/services/virality/massPostSync.service.ts`    | Per-post sync for mass posting content                        |
| `backend/src/controllers/userPerformance.controller.ts`    | User performance endpoints including syncAll                  |
| `backend/src/controllers/virality.controller.ts`           | Competitor tracking endpoints                                 |
| `backend/src/routes/userPerformance.routes.ts`             | User performance route definitions                            |
| `backend/src/routes/virality.routes.ts`                    | Virality route definitions                                    |
| `backend/src/services/adPosting.service.ts`                | Mass posting — creates `source: "mass_posting"` accounts      |
| `backend/src/services/team.service.ts`                     | `consumeClip()` credit consumption                            |
| `backend/src/services/socket.service.ts`                   | `emitViralitySyncUpdate()` WebSocket events                   |

### Lambda

| File                                      | Purpose                                                           |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `lambda-virality-sync/src/handler.ts`     | All 4 Lambda handlers (orchestrator, worker, extractor, reporter) |
| `lambda-virality-sync/src/viralAlerts.ts` | Viral detection algorithm + email builder                         |

### Infrastructure

| File                            | Purpose                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `infra/lambda-virality-sync.tf` | Step Function, Lambdas, EventBridge schedule, IAM roles |

### Frontend

| File                                                      | Purpose                                       |
| --------------------------------------------------------- | --------------------------------------------- |
| `frontend/components/virality/MyPerformanceView.tsx`      | Your Performance main view + Sync All handler |
| `frontend/components/virality/AnalyticsChart.tsx`         | Metrics chart with hourly aggregation         |
| `frontend/app/dashboard/virality/[competitorId]/utils.ts` | Chart data aggregation utilities              |
| `frontend/api/userPerformance/index.ts`                   | API client for user performance endpoints     |

### Schema

| File                               | Purpose                                 |
| ---------------------------------- | --------------------------------------- |
| `packages/shared-db/src/schema.ts` | All table definitions (lines 1036-1260) |

---

## Summary Table

| Feature                       | Competitors                        | Your Performance (organic)         | Your Performance (mass posting)     |
| ----------------------------- | ---------------------------------- | ---------------------------------- | ----------------------------------- |
| **Table**                     | viralityAccounts / viralityPosts   | userAccounts / userPosts           | userAccounts / userPosts            |
| **source**                    | N/A                                | null                               | "mass_posting"                      |
| **Step Function**             | Synced                             | Synced                             | Excluded                            |
| **Sync All**                  | N/A                                | Full profile scrape                | Per-post metrics (no decrement)     |
| **Sync type**                 | Account-level (100 posts, 31 days) | Account-level (100 posts, 31 days) | Per-post (single URL)               |
| **syncs_remaining (account)** | 14 (1 credit/week)                 | 14 (1 credit/week)                 | 14 (unused — no account-level sync) |
| **syncs_remaining (post)**    | 14 (unused)                        | 14 (unused)                        | 28 (~1 month of daily syncs)        |
| **Viral alerts**              | Yes                                | No                                 | No                                  |
| **Follower tracking**         | Yes                                | Yes                                | No (no profile scrape)              |
| **Created by**                | User in Virality UI                | User in Your Performance UI        | Auto by mass posting job            |
