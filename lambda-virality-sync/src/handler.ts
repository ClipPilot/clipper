import { Handler, Context } from "aws-lambda";
import { ApifyClient } from "apify-client";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@clipper/shared-db";
import { eq, and } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL!;
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
const INSTAGRAM_SCRAPER_ACTOR = "apify/instagram-scraper";
const MAX_METRICS_HISTORY = 28;
const SCRAPE_WINDOW_DAYS = 28;

let pool: Pool | null = null;

const getDb = () => {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return drizzle(pool, { schema });
};

// ── Apify helpers ──

interface InstagramPost {
  id: string;
  shortCode: string;
  url: string;
  displayUrl: string;
  caption: string;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp: string;
  type: string;
  ownerUsername: string;
  ownerFullName: string;
  ownerId: string;
}

interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  isVerified: boolean;
}

function normalizePostData(rawPost: any): InstagramPost {
  return {
    id: rawPost.id || rawPost.shortCode,
    shortCode: rawPost.shortCode,
    url: rawPost.url,
    displayUrl: rawPost.displayUrl,
    caption: rawPost.caption || "",
    hashtags: rawPost.hashtags || [],
    likesCount: rawPost.likesCount || 0,
    commentsCount: rawPost.commentsCount || 0,
    videoViewCount: rawPost.videoViewCount,
    videoPlayCount: rawPost.videoPlayCount,
    timestamp: rawPost.timestamp,
    type: rawPost.type,
    ownerUsername: rawPost.ownerUsername,
    ownerFullName: rawPost.ownerFullName,
    ownerId: rawPost.ownerId,
  };
}

function normalizeProfileData(rawProfile: any): InstagramProfile {
  return {
    username: rawProfile.username,
    fullName: rawProfile.fullName,
    biography: rawProfile.biography,
    profilePicUrl: rawProfile.profilePicUrl || rawProfile.profilePicUrlHD,
    followersCount: rawProfile.followersCount,
    followsCount: rawProfile.followsCount,
    postsCount: rawProfile.postsCount,
    isVerified: rawProfile.verified || rawProfile.isVerified || false,
  };
}

// ── Sync logic ──

interface MetricsEntry {
  recorded_at: string;
  likes: number;
  comments: number;
  views: number | null;
}

async function scrapeTarget(
  client: ApifyClient,
  username: string
): Promise<{ posts: InstagramPost[]; profile: InstagramProfile | null }> {
  const input = {
    addParentData: false,
    directUrls: [`https://www.instagram.com/${username}/`],
    onlyPostsNewerThan: `${SCRAPE_WINDOW_DAYS} days`,
    resultsLimit: 100,
    resultsType: "posts",
    searchType: "user",
  };

  console.log(`[Apify] Calling actor with input:`, JSON.stringify(input, null, 2));

  const run = await client.actor(INSTAGRAM_SCRAPER_ACTOR).call(input);
  console.log(`[Apify] Run completed: runId=${run.id}, datasetId=${run.defaultDatasetId}`);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[Apify] Dataset returned ${items.length} items`);

  if (items.length === 0) {
    throw new Error(`@${username} not found or private`);
  }

  const posts: InstagramPost[] = [];
  let profile: InstagramProfile | null = null;

  for (const item of items) {
    if (item.type === "profile" || item.profilePicUrl) {
      profile = normalizeProfileData(item);
    } else {
      posts.push(normalizePostData(item));
    }
  }

  if (profile) {
    console.log(`[Apify] Profile: @${profile.username} | ${profile.fullName} | ${profile.followersCount} followers | ${profile.postsCount} posts | verified=${profile.isVerified}`);
  }

  console.log(`[Apify] Parsed ${posts.length} posts, profile=${profile ? "found" : "not found"}`);

  return { posts, profile };
}

async function upsertPost(
  db: ReturnType<typeof drizzle>,
  targetId: number,
  postData: InstagramPost
): Promise<boolean> {
  if (!postData.id) return false;

  const [existingPost] = await db
    .select()
    .from(schema.viralityPosts)
    .where(
      and(
        eq(schema.viralityPosts.target_id, targetId),
        eq(schema.viralityPosts.platform_post_id, postData.id)
      )
    )
    .limit(1);

  const newMetric: MetricsEntry = {
    recorded_at: new Date().toISOString(),
    likes: postData.likesCount,
    comments: postData.commentsCount,
    views: postData.videoViewCount ?? postData.videoPlayCount ?? null,
  };

  if (existingPost) {
    const history: MetricsEntry[] = Array.isArray(existingPost.metrics_history)
      ? [...(existingPost.metrics_history as MetricsEntry[])]
      : [];
    history.push(newMetric);
    const trimmed = history.length > MAX_METRICS_HISTORY
      ? history.slice(-MAX_METRICS_HISTORY)
      : history;

    await db
      .update(schema.viralityPosts)
      .set({
        like_count: postData.likesCount,
        comment_count: postData.commentsCount,
        video_view_count: postData.videoViewCount,
        video_play_count: postData.videoPlayCount,
        metrics_history: trimmed,
        updated_at: new Date(),
      })
      .where(eq(schema.viralityPosts.id, existingPost.id));

    console.log(`[DB] Updated post ${postData.id} (${postData.shortCode}) | likes=${postData.likesCount} comments=${postData.commentsCount} views=${postData.videoViewCount ?? "N/A"} | metrics_history: ${trimmed.length} entries`);
  } else {
    await db.insert(schema.viralityPosts).values({
      target_id: targetId,
      platform_post_id: postData.id,
      post_url:
        postData.url ||
        `https://www.instagram.com/p/${postData.shortCode}/`,
      thumbnail_url: postData.displayUrl,
      caption: postData.caption,
      hashtags: postData.hashtags || [],
      post_type: postData.type,
      posted_at: postData.timestamp ? new Date(postData.timestamp) : null,
      like_count: postData.likesCount,
      comment_count: postData.commentsCount,
      video_view_count: postData.videoViewCount,
      video_play_count: postData.videoPlayCount,
      metrics_history: [newMetric],
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log(`[DB] Inserted new post ${postData.id} (${postData.shortCode}) | type=${postData.type} | likes=${postData.likesCount} comments=${postData.commentsCount} views=${postData.videoViewCount ?? "N/A"} | caption="${postData.caption.substring(0, 80)}${postData.caption.length > 80 ? "..." : ""}"`);
  }

  return true;
}

async function updateTargetProfile(
  db: ReturnType<typeof drizzle>,
  targetId: number,
  profile: InstagramProfile
) {
  await db
    .update(schema.viralityTargets)
    .set({
      display_name: profile.fullName,
      avatar_url: profile.profilePicUrl,
      bio: profile.biography,
      follower_count: profile.followersCount,
      following_count: profile.followsCount,
      post_count: profile.postsCount,
      is_verified: profile.isVerified || false,
      updated_at: new Date(),
    })
    .where(eq(schema.viralityTargets.id, targetId));

  console.log(`[DB] Updated profile for target ${targetId}: ${profile.fullName} | followers=${profile.followersCount} following=${profile.followsCount} posts=${profile.postsCount}`);
}

// ── Lambda handler ──

export const handler: Handler = async (event: any, context: Context) => {
  console.log(`\n========================================`);
  console.log(`  VIRALITY SYNC - ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  if (!DATABASE_URL) {
    return { statusCode: 500, body: "DATABASE_URL not configured" };
  }
  if (!APIFY_API_TOKEN) {
    return { statusCode: 500, body: "APIFY_API_TOKEN not configured" };
  }

  console.log(`[Config] DATABASE_URL: ${DATABASE_URL.replace(/\/\/.*@/, "//***@")}`);
  console.log(`[Config] APIFY_API_TOKEN: ${APIFY_API_TOKEN.substring(0, 8)}...`);
  console.log(`[Config] Scrape window: ${SCRAPE_WINDOW_DAYS} days | Max metrics history: ${MAX_METRICS_HISTORY} entries`);

  const db = getDb();
  const apifyClient = new ApifyClient({ token: APIFY_API_TOKEN });

  let targetsSynced = 0;
  let targetsFailed = 0;
  let postsUpserted = 0;

  try {
    const targets = await db
      .select()
      .from(schema.viralityTargets)
      .where(eq(schema.viralityTargets.platform, "instagram"));

    console.log(`\n[DB] Found ${targets.length} Instagram targets to sync:`);
    for (const t of targets) {
      console.log(`  - id=${t.id} @${t.username} (team=${t.team_id}, last_synced=${t.last_synced_at || "never"})`);
    }

    for (const target of targets) {
      console.log(`\n--- Syncing @${target.username} (id=${target.id}) ---`);

      await db
        .update(schema.viralityTargets)
        .set({ sync_status: "syncing", sync_error: null, updated_at: new Date() })
        .where(eq(schema.viralityTargets.id, target.id));

      try {
        const { posts, profile } = await scrapeTarget(apifyClient, target.username);

        if (profile) {
          await updateTargetProfile(db, target.id, profile);
        }

        console.log(`[DB] Upserting ${posts.length} posts...`);
        for (const post of posts) {
          const ok = await upsertPost(db, target.id, post);
          if (ok) postsUpserted++;
        }

        await db
          .update(schema.viralityTargets)
          .set({ sync_status: "completed", last_synced_at: new Date(), updated_at: new Date() })
          .where(eq(schema.viralityTargets.id, target.id));

        targetsSynced++;
        console.log(`\n[OK] @${target.username} completed: ${posts.length} posts upserted`);
      } catch (error: any) {
        targetsFailed++;
        console.error(`\n[FAIL] @${target.username}: ${error.message}`);

        await db
          .update(schema.viralityTargets)
          .set({ sync_status: "failed", sync_error: error.message || "Unknown error", updated_at: new Date() })
          .where(eq(schema.viralityTargets.id, target.id));
      }
    }
  } catch (error) {
    console.error("[FATAL]", error);
    return { statusCode: 500, body: String(error) };
  } finally {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }

  const result = {
    targets_synced: targetsSynced,
    targets_failed: targetsFailed,
    posts_upserted: postsUpserted,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n========================================`);
  console.log(`  SYNC COMPLETE`);
  console.log(`  Synced: ${targetsSynced} | Failed: ${targetsFailed} | Posts: ${postsUpserted}`);
  console.log(`========================================\n`);
  console.log(JSON.stringify(result, null, 2));

  return { statusCode: 200, body: JSON.stringify(result) };
};
