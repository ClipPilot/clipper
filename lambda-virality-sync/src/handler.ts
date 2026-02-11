import { Handler, Context } from "aws-lambda";
import { ApifyClient } from "apify-client";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@clipper/shared-db";
import { eq, and, inArray, sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL!;
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
const INSTAGRAM_SCRAPER_ACTOR = "apify/instagram-scraper";
const INSTAGRAM_PROFILE_SCRAPER_ACTOR = "apify/instagram-profile-scraper";
const TIKTOK_SCRAPER_ACTOR = "clockworks/tiktok-scraper";
const X_POSTS_SCRAPER_ACTOR = "apidojo/twitter-scraper-lite";
const X_VIEWS_SCRAPER_ACTOR = "scrape.badger/twitter-tweets-scraper";
const MAX_METRICS_HISTORY = 28;
const MAX_FOLLOWER_HISTORY = 180; // ~6 months of daily syncs
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
    videoViewCount: rawPost.videoPlayCount,
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

interface FollowerEntry {
  recorded_at: string;
  followers: number;
}

async function scrapeInstagramAccount(
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

async function scrapeInstagramProfile(
  client: ApifyClient,
  username: string
): Promise<InstagramProfile | null> {
  const input = {
    usernames: [username],
  };

  console.log(`[Apify] Fetching profile details for @${username}`);
  const run = await client.actor(INSTAGRAM_PROFILE_SCRAPER_ACTOR).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  if (items.length > 0) {
    return normalizeProfileData(items[0]);
  }
  return null;
}

// ── TikTok helpers ──

function normalizeTikTokPostData(rawPost: any): InstagramPost {
  const urlMatch = rawPost.webVideoUrl?.match(/\/video\/(\d+)/);
  const videoId = urlMatch ? urlMatch[1] : rawPost.id || "";

  return {
    id: videoId,
    shortCode: videoId,
    url: rawPost.webVideoUrl || "",
    displayUrl: rawPost.videoMeta?.coverUrl || "",
    caption: rawPost.text || "",
    hashtags: rawPost.hashtags?.map((h: any) => h.name || h) || [],
    likesCount: rawPost.diggCount || 0,
    commentsCount: rawPost.commentCount || 0,
    videoViewCount: rawPost.playCount,
    videoPlayCount: rawPost.playCount,
    timestamp: rawPost.createTimeISO || "",
    type: "Video",
    ownerUsername: rawPost.authorMeta?.name || "",
    ownerFullName: rawPost.authorMeta?.nickName || "",
    ownerId: rawPost.authorMeta?.id || "",
  };
}

async function scrapeTikTokAccount(
  client: ApifyClient,
  username: string
): Promise<{ posts: InstagramPost[]; profile: InstagramProfile | null }> {
  const input = {
    profiles: [username],
    resultsPerPage: 100,
    shouldDownloadCovers: false,
    shouldDownloadVideos: false,
  };

  console.log(`[Apify/TikTok] Calling actor with input:`, JSON.stringify(input, null, 2));

  const run = await client.actor(TIKTOK_SCRAPER_ACTOR).call(input);
  console.log(`[Apify/TikTok] Run completed: runId=${run.id}, datasetId=${run.defaultDatasetId}`);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[Apify/TikTok] Dataset returned ${items.length} items`);

  if (items.length === 0) {
    throw new Error(`@${username} not found or private`);
  }

  const posts: InstagramPost[] = items.map((item) => normalizeTikTokPostData(item));

  // Build profile from the first post's authorMeta
  const first = items[0] as any;
  const authorMeta = first?.authorMeta;
  const profile: InstagramProfile | null = authorMeta
    ? {
        username: authorMeta.name || username,
        fullName: authorMeta.nickName || authorMeta.name || username,
        biography: authorMeta.signature || "",
        profilePicUrl: authorMeta.avatar || "",
        followersCount: authorMeta.fans || 0,
        followsCount: authorMeta.following || 0,
        postsCount: authorMeta.video || 0,
        isVerified: authorMeta.verified || false,
      }
    : null;

  if (profile) {
    console.log(`[Apify/TikTok] Profile: @${profile.username} | ${profile.fullName} | ${profile.followersCount} followers | ${profile.postsCount} posts`);
  }

  console.log(`[Apify/TikTok] Parsed ${posts.length} posts, profile=${profile ? "found" : "not found"}`);

  return { posts, profile };
}

// ── X (Twitter) helpers ──

function normalizeXPostData(rawPost: any, viewCount: number | null): InstagramPost {
  const hashtags = (rawPost.text || "")
    .match(/#[a-zA-Z0-9_]+/g)
    ?.map((h: string) => h.substring(1)) || [];

  const urlUsername = rawPost.url?.match(
    /(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)\//
  );

  return {
    id: rawPost.id,
    shortCode: rawPost.id,
    url: rawPost.url || "",
    displayUrl: "",
    caption: rawPost.text || "",
    hashtags,
    likesCount: rawPost.likeCount || 0,
    commentsCount: rawPost.replyCount || 0,
    videoViewCount: viewCount ?? undefined,
    videoPlayCount: viewCount ?? undefined,
    timestamp: rawPost.createdAt
      ? new Date(rawPost.createdAt).toISOString()
      : "",
    type: rawPost.isRetweet ? "Retweet" : rawPost.isQuote ? "Quote" : "Tweet",
    ownerUsername: urlUsername?.[1] || "",
    ownerFullName: "",
    ownerId: "",
  };
}

async function scrapeXAccount(
  client: ApifyClient,
  username: string
): Promise<{ posts: InstagramPost[]; profile: InstagramProfile | null }> {
  // Step 1: Fetch tweets
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - SCRAPE_WINDOW_DAYS);

  const postsInput = {
    twitterHandles: [username],
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    maxItems: 100,
    sort: "Latest",
    includeSearchTerms: false,
  };

  console.log(`[Apify/X] Calling posts actor with input:`, JSON.stringify(postsInput, null, 2));

  const postsRun = await client.actor(X_POSTS_SCRAPER_ACTOR).call(postsInput);
  console.log(`[Apify/X] Posts run completed: runId=${postsRun.id}, datasetId=${postsRun.defaultDatasetId}`);

  const { items: tweetItems } = await client.dataset(postsRun.defaultDatasetId).listItems();
  console.log(`[Apify/X] Dataset returned ${tweetItems.length} tweets`);

  if (tweetItems.length === 0) {
    throw new Error(`@${username} not found or has no recent posts`);
  }

  // Step 2: Fetch view counts
  const tweetIds = tweetItems.map((item: any) => item.id).filter(Boolean);
  const viewCountMap = new Map<string, number | null>();

  if (tweetIds.length > 0) {
    try {
      const viewsInput = {
        tweets: tweetIds.join(","),
        max_results: 100,
        mode: "Get a Few Tweets",
      };

      console.log(`[Apify/X] Fetching view counts for ${tweetIds.length} tweets...`);

      const viewsRun = await client.actor(X_VIEWS_SCRAPER_ACTOR).call(viewsInput);
      const { items: viewItems } = await client.dataset(viewsRun.defaultDatasetId).listItems();

      for (const item of viewItems) {
        const vi = item as any;
        viewCountMap.set(String(vi.id), vi.view_count ?? null);
      }

      console.log(`[Apify/X] Got view counts for ${viewCountMap.size} tweets`);
    } catch (err) {
      console.warn(`[Apify/X] Failed to fetch view counts for @${username}:`, err);
    }
  }

  // Step 3: Normalize
  const posts: InstagramPost[] = tweetItems.map((item: any) =>
    normalizeXPostData(item, viewCountMap.get(String(item.id)) ?? null)
  );

  console.log(`[Apify/X] Parsed ${posts.length} posts`);

  return { posts, profile: null };
}

async function upsertPost(
  db: ReturnType<typeof drizzle>,
  accountId: number,
  postData: InstagramPost,
  platform: string
): Promise<boolean> {
  if (!postData.id) return false;

  const [existingPost] = await db
    .select()
    .from(schema.viralityPosts)
    .where(
      and(
        eq(schema.viralityPosts.account_id, accountId),
        eq(schema.viralityPosts.platform_post_id, postData.id)
      )
    )
    .limit(1);

  const newMetric: MetricsEntry = {
    recorded_at: new Date().toISOString(),
    likes: postData.likesCount,
    comments: postData.commentsCount,
    views: postData.videoPlayCount ?? null,
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
        video_view_count: postData.videoPlayCount,
        video_play_count: postData.videoPlayCount,
        metrics_history: trimmed,
        updated_at: new Date(),
      })
      .where(eq(schema.viralityPosts.id, existingPost.id));

    console.log(`[DB] Updated post ${postData.id} (${postData.shortCode}) | likes=${postData.likesCount} comments=${postData.commentsCount} views=${postData.videoPlayCount ?? "N/A"} | metrics_history: ${trimmed.length} entries`);
  } else {
    await db.insert(schema.viralityPosts).values({
      account_id: accountId,
      platform_post_id: postData.id,
      post_url: postData.url || (platform === "x"
        ? `https://x.com/i/status/${postData.id}`
        : platform === "tiktok"
          ? postData.url
          : `https://www.instagram.com/p/${postData.shortCode}/`),
      thumbnail_url: platform === "tiktok" ? postData.displayUrl : null,
      caption: postData.caption,
      hashtags: postData.hashtags || [],
      post_type: postData.type,
      posted_at: postData.timestamp ? new Date(postData.timestamp) : null,
      like_count: postData.likesCount,
      comment_count: postData.commentsCount,
      video_view_count: postData.videoPlayCount,
      video_play_count: postData.videoPlayCount,
      metrics_history: [newMetric],
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log(`[DB] Inserted new post ${postData.id} (${postData.shortCode}) | type=${postData.type} | likes=${postData.likesCount} comments=${postData.commentsCount} views=${postData.videoPlayCount ?? "N/A"} | caption="${postData.caption.substring(0, 80)}${postData.caption.length > 80 ? "..." : ""}"`);
  }

  return true;
}

async function updateAccountProfile(
  db: ReturnType<typeof drizzle>,
  accountId: number,
  profile: InstagramProfile
) {
  // Fetch existing follower_history
  const [existing] = await db
    .select({ follower_history: schema.viralityAccounts.follower_history })
    .from(schema.viralityAccounts)
    .where(eq(schema.viralityAccounts.id, accountId))
    .limit(1);

  const history: FollowerEntry[] = Array.isArray(existing?.follower_history)
    ? [...(existing.follower_history as FollowerEntry[])]
    : [];

  if (profile.followersCount != null) {
    history.push({
      recorded_at: new Date().toISOString(),
      followers: profile.followersCount,
    });
  }

  const trimmed = history.length > MAX_FOLLOWER_HISTORY
    ? history.slice(-MAX_FOLLOWER_HISTORY)
    : history;

  await db
    .update(schema.viralityAccounts)
    .set({
      display_name: profile.fullName,
      avatar_url: profile.profilePicUrl,
      bio: profile.biography,
      follower_count: profile.followersCount,
      following_count: profile.followsCount,
      post_count: profile.postsCount,
      follower_history: trimmed,
      is_verified: profile.isVerified || false,
      updated_at: new Date(),
    })
    .where(eq(schema.viralityAccounts.id, accountId));

  console.log(`[DB] Updated profile for account ${accountId}: ${profile.fullName} | followers=${profile.followersCount} following=${profile.followsCount} posts=${profile.postsCount} | follower_history: ${trimmed.length} entries`);
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

  let accountsSynced = 0;
  let accountsFailed = 0;
  let postsUpserted = 0;

  try {
    const accounts = await db
      .select()
      .from(schema.viralityAccounts)
      .where(inArray(schema.viralityAccounts.platform, ["instagram", "tiktok", "x"]));

    console.log(`\n[DB] Found ${accounts.length} accounts to sync:`);
    for (const a of accounts) {
      console.log(`  - id=${a.id} @${a.username} (team=${a.team_id}, last_synced=${a.last_synced_at || "never"})`);
    }

    for (const account of accounts) {
      console.log(`\n--- Syncing @${account.username} [${account.platform}] (id=${account.id}) ---`);

      await db
        .update(schema.viralityAccounts)
        .set({ sync_status: "syncing", sync_error: null, updated_at: new Date() })
        .where(eq(schema.viralityAccounts.id, account.id));

      try {
        const { posts, profile } = account.platform === "tiktok"
          ? await scrapeTikTokAccount(apifyClient, account.username)
          : account.platform === "x"
            ? await scrapeXAccount(apifyClient, account.username)
            : await scrapeInstagramAccount(apifyClient, account.username);

        // Fallback: fetch profile separately if posts scrape didn't include it (Instagram only)
        const resolvedProfile = profile
          ?? (account.platform === "instagram"
            ? await scrapeInstagramProfile(apifyClient, account.username)
            : null);

        if (resolvedProfile) {
          await updateAccountProfile(db, account.id, resolvedProfile);
        }

        console.log(`[DB] Upserting ${posts.length} posts...`);
        for (const post of posts) {
          const ok = await upsertPost(db, account.id, post, account.platform);
          if (ok) postsUpserted++;
        }

        // Compute total_likes from all posts for this account
        const [likesResult] = await db
          .select({ total: sql<number>`COALESCE(SUM(${schema.viralityPosts.like_count}), 0)` })
          .from(schema.viralityPosts)
          .where(eq(schema.viralityPosts.account_id, account.id));

        await db
          .update(schema.viralityAccounts)
          .set({ sync_status: "completed", last_synced_at: new Date(), total_likes: Number(likesResult.total), updated_at: new Date() })
          .where(eq(schema.viralityAccounts.id, account.id));

        accountsSynced++;
        console.log(`\n[OK] @${account.username} completed: ${posts.length} posts upserted`);
      } catch (error: any) {
        accountsFailed++;
        console.error(`\n[FAIL] @${account.username}: ${error.message}`);

        await db
          .update(schema.viralityAccounts)
          .set({ sync_status: "failed", sync_error: error.message || "Unknown error", updated_at: new Date() })
          .where(eq(schema.viralityAccounts.id, account.id));
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
    accounts_synced: accountsSynced,
    accounts_failed: accountsFailed,
    posts_upserted: postsUpserted,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n========================================`);
  console.log(`  SYNC COMPLETE`);
  console.log(`  Synced: ${accountsSynced} | Failed: ${accountsFailed} | Posts: ${postsUpserted}`);
  console.log(`========================================\n`);
  console.log(JSON.stringify(result, null, 2));

  return { statusCode: 200, body: JSON.stringify(result) };
};
