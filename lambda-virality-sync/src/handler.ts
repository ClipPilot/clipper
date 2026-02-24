import { Handler, Context } from "aws-lambda";
import { ApifyClient } from "apify-client";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@clipper/shared-db";
import { eq, and, or, lte, inArray, sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL!;
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
const SOCIALDATA_API_KEY = process.env.SOCIALDATA_API_KEY || "";
const INSTAGRAM_SCRAPER_ACTOR = "apify/instagram-scraper";
const INSTAGRAM_PROFILE_SCRAPER_ACTOR = "apify/instagram-profile-scraper";
const TIKTOK_SCRAPER_ACTOR = "clockworks/tiktok-scraper";
const X_POSTS_SCRAPER_ACTOR = "apidojo/twitter-scraper-lite";
const X_VIEWS_SCRAPER_ACTOR = "scrape.badger/twitter-tweets-scraper";
const SYNC_INTERVAL = 12 // every 12 hours
const SYNCS_PER_DAY = Math.floor(24 / SYNC_INTERVAL)
const SYNCS_PER_WEEK = SYNCS_PER_DAY * 7; // 14 syncs = 1 credit
const SCRAPE_WINDOW_DAYS = 31;
const MAX_METRICS_HISTORY = SCRAPE_WINDOW_DAYS * SYNCS_PER_DAY;
const MAX_FOLLOWER_HISTORY = 180; // ~6 months of daily syncs
const STALE_SYNC_MINUTES = 15;

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
    oldestPostDateUnified: `${SCRAPE_WINDOW_DAYS} days`,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
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

// ── Instagram Hashtag ──

async function scrapeInstagramHashtag(
  client: ApifyClient,
  hashtag: string
): Promise<{ posts: InstagramPost[]; profile: null }> {
  const tag = hashtag.replace(/^#/, "").toLowerCase();
  const input = {
    addParentData: false,
    directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
    onlyPostsNewerThan: `${SCRAPE_WINDOW_DAYS} days`,
    resultsLimit: 100,
    resultsType: "posts",
    searchType: "hashtag",
  };

  console.log(`[Apify/IG-Hashtag] Calling actor with input:`, JSON.stringify(input, null, 2));
  const run = await client.actor(INSTAGRAM_SCRAPER_ACTOR).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[Apify/IG-Hashtag] Dataset returned ${items.length} items`);

  const posts: InstagramPost[] = items
    .filter((item: any) => item.type !== "profile" && !item.profilePicUrl)
    .map((item) => normalizePostData(item));

  return { posts, profile: null };
}

// ── TikTok Hashtag ──

async function scrapeTikTokHashtag(
  client: ApifyClient,
  hashtag: string
): Promise<{ posts: InstagramPost[]; profile: null }> {
  const tag = hashtag.replace(/^#/, "").toLowerCase();
  const input = {
    hashtags: [`#${tag}`],
    oldestPostDateUnified: `${SCRAPE_WINDOW_DAYS} days`,
    resultsPerPage: 100,
    shouldDownloadCovers: false,
    shouldDownloadVideos: false,
  };

  console.log(`[Apify/TikTok-Hashtag] Calling actor with input:`, JSON.stringify(input, null, 2));
  const run = await client.actor(TIKTOK_SCRAPER_ACTOR).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[Apify/TikTok-Hashtag] Dataset returned ${items.length} items`);

  const posts: InstagramPost[] = items.map((item) => normalizeTikTokPostData(item));
  return { posts, profile: null };
}

// ── X Keyword/Hashtag Search ──

async function scrapeXKeywordSearch(
  client: ApifyClient,
  term: string
): Promise<{ posts: InstagramPost[]; profile: null }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - SCRAPE_WINDOW_DAYS);

  const postsInput = {
    searchTerms: [term],
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    maxItems: 100,
    sort: "Latest",
    includeSearchTerms: false,
  };

  console.log(`[Apify/X-Search] Calling actor with input:`, JSON.stringify(postsInput, null, 2));
  const postsRun = await client.actor(X_POSTS_SCRAPER_ACTOR).call(postsInput);
  const { items: tweetItems } = await client.dataset(postsRun.defaultDatasetId).listItems();
  console.log(`[Apify/X-Search] Dataset returned ${tweetItems.length} tweets`);

  const tweetIds = tweetItems.map((item: any) => item.id).filter(Boolean);
  const viewCountMap = new Map<string, number | null>();

  if (tweetIds.length > 0) {
    try {
      const viewsInput = {
        tweets: tweetIds.join(","),
        max_results: 100,
        mode: "Get a Few Tweets",
      };
      const viewsRun = await client.actor(X_VIEWS_SCRAPER_ACTOR).call(viewsInput);
      const { items: viewItems } = await client.dataset(viewsRun.defaultDatasetId).listItems();
      for (const item of viewItems) {
        const vi = item as any;
        viewCountMap.set(String(vi.id), vi.view_count ?? null);
      }
      console.log(`[Apify/X-Search] Got view counts for ${viewCountMap.size} tweets`);
    } catch (err) {
      console.warn(`[Apify/X-Search] Failed to fetch view counts for "${term}":`, err);
    }
  }

  const posts: InstagramPost[] = tweetItems.map((item: any) =>
    normalizeXPostData(item, viewCountMap.get(String(item.id)) ?? null)
  );

  return { posts, profile: null };
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
  platform: string,
  postsTable: any = schema.viralityPosts
): Promise<boolean> {
  if (!postData.id) return false;

  // Skip posts outside the scrape window
  if (postData.timestamp) {
    const postDate = new Date(postData.timestamp);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SCRAPE_WINDOW_DAYS);
    if (postDate < cutoff) return false;
  }

  const [existingPost] = await db
    .select()
    .from(postsTable)
    .where(
      and(
        eq(postsTable.account_id, accountId),
        eq(postsTable.platform_post_id, postData.id)
      )
    )
    .limit(1);

  const newMetric: MetricsEntry = {
    recorded_at: new Date().toISOString(),
    likes: postData.likesCount || 0,
    comments: postData.commentsCount || 0,
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
      .update(postsTable)
      .set({
        like_count: postData.likesCount || 0,
        comment_count: postData.commentsCount || 0,
        video_play_count: postData.videoPlayCount,
        thumbnail_url: postData.displayUrl || existingPost.thumbnail_url,
        metrics_history: trimmed,
        updated_at: new Date(),
      })
      .where(eq(postsTable.id, existingPost.id));

    console.log(`[DB] Updated post ${postData.id} (${postData.shortCode}) | likes=${postData.likesCount} comments=${postData.commentsCount} views=${postData.videoPlayCount ?? "N/A"} | metrics_history: ${trimmed.length} entries`);
  } else {
    await db.insert(postsTable).values({
      account_id: accountId,
      platform_post_id: postData.id,
      post_url: postData.url || (platform === "x"
        ? `https://x.com/i/status/${postData.id}`
        : platform === "tiktok"
          ? postData.url || ""
          : `https://www.instagram.com/p/${postData.shortCode}/`),
      thumbnail_url: postData.displayUrl || null,
      caption: postData.caption,
      hashtags: postData.hashtags || [],
      post_type: postData.type,
      posted_at: postData.timestamp ? new Date(postData.timestamp) : null,
      like_count: postData.likesCount || 0,
      comment_count: postData.commentsCount || 0,
      video_play_count: postData.videoPlayCount,
      metrics_history: [newMetric],
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log(`[DB] Inserted new post ${postData.id} (${postData.shortCode}) | type=${postData.type} | likes=${postData.likesCount} comments=${postData.commentsCount} views=${postData.videoPlayCount ?? "N/A"} | caption="${postData.caption.substring(0, 80)}${postData.caption.length > 80 ? "..." : ""}"`);
  }

  return true;
}

/**
 * Fetch X follower count from SocialData API.
 * Only returns followersCount — all other profile fields come from Apify scrapers.
 */
async function fetchXFollowerCount(username: string): Promise<Partial<InstagramProfile> | null> {
  if (!SOCIALDATA_API_KEY) {
    console.warn("[SocialData] SOCIALDATA_API_KEY not configured, skipping X follower fetch");
    return null;
  }

  try {
    const res = await fetch(`https://api.socialdata.tools/twitter/user/${encodeURIComponent(username)}`, {
      headers: {
        Authorization: `Bearer ${SOCIALDATA_API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`[SocialData] API error for @${username}: ${res.status} ${res.statusText}`);
      return null;
    }

    const data: any = await res.json();
    console.log(`[SocialData] Fetched X follower count for @${username}: ${data.followers_count}`);

    return {
      followersCount: data.followers_count ?? 0,
    };
  } catch (err) {
    console.warn(`[SocialData] Failed to fetch X follower count for @${username}:`, err);
    return null;
  }
}

async function updateAccountProfile(
  db: ReturnType<typeof drizzle>,
  accountId: number,
  profile: Partial<InstagramProfile>,
  accountsTable: any = schema.viralityAccounts
) {
  // Fetch existing follower_history
  const [existing] = await db
    .select({ follower_history: accountsTable.follower_history })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
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

  const updates: Record<string, any> = {
    follower_history: trimmed,
    updated_at: new Date(),
  };
  if (profile.fullName !== undefined) updates.display_name = profile.fullName;
  if (profile.profilePicUrl !== undefined) updates.avatar_url = profile.profilePicUrl;
  if (profile.biography !== undefined) updates.bio = profile.biography;
  if (profile.followersCount !== undefined) updates.follower_count = profile.followersCount;
  if (profile.followsCount !== undefined) updates.following_count = profile.followsCount;
  if (profile.postsCount !== undefined) updates.post_count = profile.postsCount;
  if (profile.isVerified !== undefined) updates.is_verified = profile.isVerified;

  await db
    .update(accountsTable)
    .set(updates)
    .where(eq(accountsTable.id, accountId));

  console.log(`[DB] Updated profile for account ${accountId}: followers=${profile.followersCount ?? "N/A"} | follower_history: ${trimmed.length} entries`);
}

// ── Credit helpers ──

async function consumeOneCredit(
  db: ReturnType<typeof drizzle>,
  teamId: number
): Promise<boolean> {
  // Get latest usage stats for the team
  const [stats] = await db
    .select()
    .from(schema.usageStats)
    .where(eq(schema.usageStats.team_id, teamId))
    .orderBy(sql`${schema.usageStats.created_at} DESC`)
    .limit(1);

  if (!stats) return false;

  // Atomic increment: only succeeds if clips_created < limit (prevents double-charge under concurrency)
  const baseUpdated = await db
    .update(schema.usageStats)
    .set({ clips_created: sql`${schema.usageStats.clips_created} + 1`, updated_at: new Date() })
    .where(
      and(
        eq(schema.usageStats.id, stats.id),
        sql`${schema.usageStats.clips_created} < ${schema.usageStats.limit}`
      )
    )
    .returning({ id: schema.usageStats.id });

  if (baseUpdated.length > 0) return true;

  // Atomic decrement: only succeeds if addon_clips_remaining > 0
  const addonUpdated = await db
    .update(schema.teams)
    .set({ addon_clips_remaining: sql`${schema.teams.addon_clips_remaining} - 1`, updated_at: new Date() })
    .where(
      and(
        eq(schema.teams.id, teamId),
        sql`${schema.teams.addon_clips_remaining} > 0`
      )
    )
    .returning({ id: schema.teams.id });

  return addonUpdated.length > 0;
}

// ── Orchestrator handler (Step Functions) ──

export const orchestratorHandler: Handler = async (event: any, context: Context) => {
  console.log(`\n========================================`);
  console.log(`  VIRALITY SYNC ORCHESTRATOR - ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }

  const localPool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(localPool, { schema });

  try {
    const cutoff = new Date(Date.now() - STALE_SYNC_MINUTES * 60 * 1000);

    // Clean up stale viralityAccounts syncs
    const staleVirality = await db
      .update(schema.viralityAccounts)
      .set({
        sync_status: "failed",
        sync_error: `Sync timed out (stuck for more than ${STALE_SYNC_MINUTES} minutes)`,
        updated_at: new Date(),
      })
      .where(
        and(
          or(
            eq(schema.viralityAccounts.sync_status, "pending"),
            eq(schema.viralityAccounts.sync_status, "syncing")
          ),
          lte(schema.viralityAccounts.updated_at, cutoff)
        )
      )
      .returning({ id: schema.viralityAccounts.id, username: schema.viralityAccounts.username });

    if (staleVirality.length > 0) {
      console.log(`[Cleanup] Reset ${staleVirality.length} stale virality syncs: ${staleVirality.map((s) => `@${s.username}`).join(", ")}`);
    }

    // Clean up stale userAccounts syncs
    const staleUser = await db
      .update(schema.userAccounts)
      .set({
        sync_status: "failed",
        sync_error: `Sync timed out (stuck for more than ${STALE_SYNC_MINUTES} minutes)`,
        updated_at: new Date(),
      })
      .where(
        and(
          or(
            eq(schema.userAccounts.sync_status, "pending"),
            eq(schema.userAccounts.sync_status, "syncing")
          ),
          lte(schema.userAccounts.updated_at, cutoff)
        )
      )
      .returning({ id: schema.userAccounts.id, username: schema.userAccounts.username });

    if (staleUser.length > 0) {
      console.log(`[Cleanup] Reset ${staleUser.length} stale user syncs: ${staleUser.map((s) => `@${s.username}`).join(", ")}`);
    }

    // Query active virality accounts
    const viralityAccounts = await db
      .select({
        id: schema.viralityAccounts.id,
        username: schema.viralityAccounts.username,
        platform: schema.viralityAccounts.platform,
        team_id: schema.viralityAccounts.team_id,
        syncs_remaining: schema.viralityAccounts.syncs_remaining,
        account_type: schema.viralityAccounts.account_type,
      })
      .from(schema.viralityAccounts)
      .where(
        and(
          inArray(schema.viralityAccounts.platform, ["instagram", "tiktok", "x"]),
          eq(schema.viralityAccounts.is_active, true)
        )
      );

    // Query active user accounts
    const userAcctList = await db
      .select({
        id: schema.userAccounts.id,
        username: schema.userAccounts.username,
        platform: schema.userAccounts.platform,
        team_id: schema.userAccounts.team_id,
        syncs_remaining: schema.userAccounts.syncs_remaining,
        account_type: schema.userAccounts.account_type,
      })
      .from(schema.userAccounts)
      .where(
        and(
          inArray(schema.userAccounts.platform, ["instagram", "tiktok", "x"]),
          eq(schema.userAccounts.is_active, true)
        )
      );

    // Merge both lists with a source field
    const accounts = [
      ...viralityAccounts.map((a) => ({ ...a, source: "virality" as const })),
      ...userAcctList.map((a) => ({ ...a, source: "user" as const })),
    ];

    console.log(`[DB] Found ${viralityAccounts.length} virality + ${userAcctList.length} user = ${accounts.length} total accounts to sync`);
    for (const a of accounts) {
      console.log(`  - [${a.source}] id=${a.id} @${a.username} (team=${a.team_id})`);
    }

    return { accounts };
  } finally {
    await localPool.end();
  }
};

// ── Worker handler (Step Functions Map iterator) ──

export const workerHandler: Handler = async (event: any, context: Context) => {
  const { id: accountId, username, source } = event;
  const isUserAccount = source === "user";
  const accountsTable = isUserAccount ? schema.userAccounts : schema.viralityAccounts;
  const postsTable = isUserAccount ? schema.userPosts : schema.viralityPosts;
  const sourceLabel = isUserAccount ? "user" : "virality";

  console.log(`\n========================================`);
  console.log(`  VIRALITY SYNC WORKER - @${username} (id=${accountId}, source=${sourceLabel})`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }
  if (!APIFY_API_TOKEN) {
    throw new Error("APIFY_API_TOKEN not configured");
  }

  const localPool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(localPool, { schema });
  const apifyClient = new ApifyClient({ token: APIFY_API_TOKEN });
  let postsUpserted = 0;

  try {
    // Re-fetch full account from DB for latest state
    const [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1);

    if (!account) {
      console.log(`[Skip] Account id=${accountId} not found (source=${sourceLabel})`);
      return { accountId, username, source: sourceLabel, status: "skipped", reason: "not_found", postsUpserted: 0 };
    }

    if (!account.is_active) {
      console.log(`[Skip] @${account.username} is no longer active (source=${sourceLabel})`);
      return { accountId, username: account.username, source: sourceLabel, status: "skipped", reason: "inactive", postsUpserted: 0 };
    }

    console.log(`[Sync] @${account.username} [${account.platform}] syncs_remaining=${account.syncs_remaining} source=${sourceLabel}`);

    // Atomic decrement: only succeeds if syncs_remaining > 0 (prevents race between parallel workers)
    const decremented = await db
      .update(accountsTable)
      .set({ syncs_remaining: sql`${accountsTable.syncs_remaining} - 1`, updated_at: new Date() })
      .where(
        and(
          eq(accountsTable.id, account.id),
          sql`${accountsTable.syncs_remaining} > 0`
        )
      )
      .returning({ id: accountsTable.id });

    if (decremented.length === 0) {
      // syncs_remaining was 0 — need to charge a credit
      const charged = await consumeOneCredit(db, account.team_id);
      if (charged) {
        await db
          .update(accountsTable)
          .set({ syncs_remaining: SYNCS_PER_WEEK - 1, updated_at: new Date() })
          .where(eq(accountsTable.id, account.id));
        console.log(`[Credit] Charged 1 credit for @${account.username} (team=${account.team_id}), reset syncs_remaining=${SYNCS_PER_WEEK - 1}`);
      } else {
        // No credits — deactivate account
        await db
          .update(accountsTable)
          .set({ is_active: false, updated_at: new Date() })
          .where(eq(accountsTable.id, account.id));
        console.log(`[Credit] No credits for team=${account.team_id}, deactivated @${account.username}`);
        return { accountId, username: account.username, source: sourceLabel, status: "deactivated", postsUpserted: 0 };
      }
    }

    // Set sync_status to syncing
    await db
      .update(accountsTable)
      .set({ sync_status: "syncing", sync_error: null, updated_at: new Date() })
      .where(eq(accountsTable.id, account.id));

    try {
      let posts: InstagramPost[];
      let profile: InstagramProfile | null = null;
      const accountType = account.account_type || "profile";

      if (accountType === "hashtag") {
        const result = account.platform === "tiktok"
          ? await scrapeTikTokHashtag(apifyClient, account.username)
          : account.platform === "x"
            ? await scrapeXKeywordSearch(apifyClient, `#${account.username}`)
            : await scrapeInstagramHashtag(apifyClient, account.username);
        posts = result.posts;
      } else if (accountType === "keyword") {
        const result = account.platform === "x"
          ? await scrapeXKeywordSearch(apifyClient, account.username)
          : account.platform === "tiktok"
            ? await scrapeTikTokHashtag(apifyClient, account.username)
            : await scrapeInstagramHashtag(apifyClient, account.username);
        posts = result.posts;
      } else {
        const result = account.platform === "tiktok"
          ? await scrapeTikTokAccount(apifyClient, account.username)
          : account.platform === "x"
            ? await scrapeXAccount(apifyClient, account.username)
            : await scrapeInstagramAccount(apifyClient, account.username);
        posts = result.posts;
        profile = result.profile;
      }

      // Only update profile for profile-type accounts
      if (accountType === "profile") {
        const resolvedProfile = profile
          ?? (account.platform === "instagram"
            ? await scrapeInstagramProfile(apifyClient, account.username)
            : null);

        if (resolvedProfile) {
          await updateAccountProfile(db, account.id, resolvedProfile, accountsTable);
        }

        if (account.platform === "x") {
          const xFollowers = await fetchXFollowerCount(account.username);
          if (xFollowers) {
            await updateAccountProfile(db, account.id, xFollowers, accountsTable);
          }
        }
      }

      console.log(`[DB] Upserting ${posts.length} posts...`);
      for (const post of posts) {
        const ok = await upsertPost(db, account.id, post, account.platform, postsTable);
        if (ok) postsUpserted++;
      }

      // Compute total_likes from all posts for this account
      const [likesResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(${postsTable.like_count}), 0)` })
        .from(postsTable)
        .where(eq(postsTable.account_id, account.id));

      await db
        .update(accountsTable)
        .set({ sync_status: "completed", last_synced_at: new Date(), total_likes: Number(likesResult.total), updated_at: new Date() })
        .where(eq(accountsTable.id, account.id));

      console.log(`[OK] @${account.username} (${sourceLabel}) completed: ${posts.length} posts upserted`);
      return { accountId, username: account.username, source: sourceLabel, status: "completed", postsUpserted };
    } catch (error: any) {
      console.error(`[FAIL] @${account.username} (${sourceLabel}): ${error.message}`);
      await db
        .update(accountsTable)
        .set({ sync_status: "failed", sync_error: error.message || "Unknown error", updated_at: new Date() })
        .where(eq(accountsTable.id, account.id));
      throw error; // Re-throw so Step Functions sees the failure
    }
  } finally {
    await localPool.end();
  }
};
