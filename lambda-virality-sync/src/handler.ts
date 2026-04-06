import { Handler, Context } from "aws-lambda";
import { ApifyClient } from "apify-client";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@clipper/shared-db";
import { eq, and, or, lte, inArray, sql, isNull, not, gt, isNotNull } from "drizzle-orm";
import { checkAndSendViralAlertsForTeam } from "./viralAlerts";

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

/**
 * Apply flaky-data protection and strict views monotonicity to scraped metrics.
 *
 * Likes/comments: if Apify returns 0 but we have previous data, use the previous
 * value (flaky scrape). A real non-zero decrease is accepted.
 *
 * Views: strictly monotonic — never decrease. Uses Math.max against previous.
 */
function resolveMetrics(
  incoming: { likes: number; comments: number; views: number | null },
  lastMetric: MetricsEntry | null,
): { likes: number; comments: number; views: number | null } {
  const likes = (!incoming.likes && lastMetric) ? lastMetric.likes : (incoming.likes || 0);
  const comments = (!incoming.comments && lastMetric) ? lastMetric.comments : (incoming.comments || 0);
  const rawViews = incoming.views;
  const views = (rawViews != null && lastMetric?.views != null)
    ? Math.max(rawViews, lastMetric.views)
    : rawViews ?? lastMetric?.views ?? null;
  return { likes, comments, views };
}

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

/** Extract the URL-derived post identifier (shortCode for IG, numeric ID for TikTok/X). */
function extractPostIdFromUrl(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    switch (platform) {
      case "instagram": {
        const m = u.pathname.match(/\/(?:reels?|p)\/([A-Za-z0-9_-]+)/);
        return m?.[1] ?? null;
      }
      case "tiktok": {
        const m = u.pathname.match(/\/video\/(\d+)/);
        return m?.[1] ?? null;
      }
      case "x": {
        const m = u.pathname.match(/\/status\/(\d+)/);
        return m?.[1] ?? null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
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

  const canonicalId = (postData.url
    ? extractPostIdFromUrl(postData.url, platform)
    : null) || postData.id;

  let existingRows = await db
    .select()
    .from(postsTable)
    .where(
      and(
        eq(postsTable.account_id, accountId),
        eq(postsTable.platform_post_id, canonicalId)
      )
    )
    .limit(1);

  if (existingRows.length === 0 && canonicalId !== postData.id) {
    existingRows = await db
      .select()
      .from(postsTable)
      .where(
        and(
          eq(postsTable.account_id, accountId),
          eq(postsTable.platform_post_id, postData.id)
        )
      )
      .limit(1);
  }

  const existingPost = existingRows[0];

  if (existingPost) {
    const history: MetricsEntry[] = Array.isArray(existingPost.metrics_history)
      ? [...(existingPost.metrics_history as MetricsEntry[])]
      : [];
    const lastMetric = history.length > 0 ? history[history.length - 1] : null;
    const { likes: newLikes, comments: newComments, views: newViews } = resolveMetrics(
      { likes: postData.likesCount || 0, comments: postData.commentsCount || 0, views: postData.videoPlayCount ?? null },
      lastMetric,
    );

    history.push({ recorded_at: new Date().toISOString(), likes: newLikes, comments: newComments, views: newViews });
    const trimmed = history.length > MAX_METRICS_HISTORY
      ? history.slice(-MAX_METRICS_HISTORY)
      : history;

    await db
      .update(postsTable)
      .set({
        like_count: newLikes,
        comment_count: newComments,
        video_play_count: newViews,
        thumbnail_url: postData.displayUrl || existingPost.thumbnail_url,
        metrics_history: trimmed,
        updated_at: new Date(),
      })
      .where(eq(postsTable.id, existingPost.id));

    console.log(`[DB] Updated post ${postData.id} (${postData.shortCode}) | likes=${newLikes} comments=${newComments} views=${newViews ?? "N/A"} | metrics_history: ${trimmed.length} entries`);
  } else {
    const newMetric: MetricsEntry = {
      recorded_at: new Date().toISOString(),
      likes: postData.likesCount || 0,
      comments: postData.commentsCount || 0,
      views: postData.videoPlayCount ?? null,
    };
    await db.insert(postsTable).values({
      account_id: accountId,
      platform_post_id: canonicalId,
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


// ── URL normalization ──

/** Normalize Instagram URLs: /reels/ → /reel/ (Apify requires /reel/) */
function normalizeInstagramUrl(url: string): string {
  return url.replace(/instagram\.com\/reels\//, "instagram.com/reel/");
}

// ── Single-post metrics scraping (for mass posts) ──

interface PostMetrics {
  likesCount: number;
  commentsCount: number;
  viewCount: number | null;
  thumbnailUrl: string | null;
}

async function scrapeBatchPostMetrics(
  client: ApifyClient,
  postUrls: string[],
  platform: string
): Promise<Map<string, PostMetrics>> {
  const results = new Map<string, PostMetrics>();
  if (postUrls.length === 0) return results;

  if (platform === "instagram") {
    const urls = postUrls.map(normalizeInstagramUrl);
    const run = await client.actor(INSTAGRAM_SCRAPER_ACTOR).call({
      directUrls: urls,
      resultsType: "posts",
    });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    for (const item of items) {
      const raw = item as any;
      const postId = extractPostIdFromUrl(raw.url || "", "instagram") || raw.shortCode;
      if (!postId) continue;
      results.set(postId, {
        likesCount: raw.likesCount || 0,
        commentsCount: raw.commentsCount || 0,
        viewCount: raw.videoPlayCount ?? raw.videoViewCount ?? null,
        thumbnailUrl: raw.displayUrl || raw.thumbnailUrl || null,
      });
    }
  } else if (platform === "tiktok") {
    const run = await client.actor(TIKTOK_SCRAPER_ACTOR).call({
      postURLs: postUrls,
      shouldDownloadCovers: false,
      shouldDownloadVideos: false,
    });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    for (const item of items) {
      const raw = item as any;
      const postId = extractPostIdFromUrl(raw.webVideoUrl || "", "tiktok") || raw.id;
      if (!postId) continue;
      results.set(postId, {
        likesCount: raw.diggCount || 0,
        commentsCount: raw.commentCount || 0,
        viewCount: raw.playCount ?? null,
        thumbnailUrl: raw.videoMeta?.coverUrl || null,
      });
    }
  } else if (platform === "x") {
    const tweetIds = postUrls
      .map((url) => url.match(/\/status\/(\d+)/)?.[1])
      .filter((id): id is string => !!id);
    if (tweetIds.length === 0) return results;

    const postsRun = await client.actor(X_POSTS_SCRAPER_ACTOR).call({
      tweetIDs: tweetIds,
      maxItems: tweetIds.length,
    });
    const { items: tweetItems } = await client.dataset(postsRun.defaultDatasetId).listItems();

    const tweetMap = new Map<string, any>();
    for (const item of tweetItems) {
      const raw = item as any;
      const id = raw.id || raw.id_str;
      if (id) tweetMap.set(String(id), raw);
    }

    const viewsMap = new Map<string, number>();
    try {
      const viewsRun = await client.actor(X_VIEWS_SCRAPER_ACTOR).call({
        tweets: tweetIds.join(","),
        max_results: tweetIds.length,
        mode: "Get a Few Tweets",
      });
      const { items: viewItems } = await client.dataset(viewsRun.defaultDatasetId).listItems();
      for (const vi of viewItems) {
        const raw = vi as any;
        const id = raw.id || raw.id_str;
        if (id && raw.view_count != null) viewsMap.set(String(id), raw.view_count);
      }
    } catch {
      // view scraper failed, continue without views
    }

    for (const tweetId of tweetIds) {
      const tweet = tweetMap.get(tweetId);
      if (!tweet) continue;
      results.set(tweetId, {
        likesCount: tweet.likeCount || 0,
        commentsCount: tweet.replyCount || 0,
        viewCount: viewsMap.get(tweetId) ?? null,
        thumbnailUrl: null,
      });
    }
  }

  return results;
}

// ── Orchestrator handler (Step Functions — cursor-based pagination) ──

const PAGE_SIZE = 100;

export const orchestratorHandler: Handler = async (event: any, context: Context) => {
  const cursor = event?.cursor ?? null;
  const teamId: number | undefined = cursor?.teamId ?? event?.Payload?.teamId ?? event?.teamId;
  const massPostsOnly: boolean = cursor?.massPostsOnly ?? event?.Payload?.massPostsOnly ?? event?.massPostsOnly ?? false;

  console.log(`\n========================================`);
  console.log(`  VIRALITY SYNC ORCHESTRATOR - ${new Date().toISOString()}`);
  console.log(`  teamId=${teamId ?? "all"} massPostsOnly=${massPostsOnly} cursor=${JSON.stringify(cursor)}`);
  console.log(`========================================\n`);

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }

  const localPool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(localPool, { schema });

  try {
    if (!cursor && !massPostsOnly) {
      const cutoff = new Date(Date.now() - STALE_SYNC_MINUTES * 60 * 1000);

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
    }

    const phases = massPostsOnly ? ["mass_post"] : ["virality", "user", "mass_post"];
    let phaseIndex = phases.indexOf(cursor?.phase ?? phases[0]);
    let lastId: number = cursor?.lastId ?? 0;
    let accounts: any[] = [];

    while (accounts.length === 0 && phaseIndex < phases.length) {
      const phase = phases[phaseIndex];

      if (phase === "virality") {
        const rows = await db
          .select({ id: schema.viralityAccounts.id, username: schema.viralityAccounts.username })
          .from(schema.viralityAccounts)
          .where(and(
            inArray(schema.viralityAccounts.platform, ["instagram", "tiktok", "x"]),
            eq(schema.viralityAccounts.is_active, true),
            gt(schema.viralityAccounts.id, lastId),
          ))
          .orderBy(schema.viralityAccounts.id)
          .limit(PAGE_SIZE);

        accounts = rows.map((a) => ({ id: a.id, source: "virality" as const, username: a.username }));
      } else if (phase === "user") {
        const rows = await db
          .select({ id: schema.userAccounts.id, username: schema.userAccounts.username })
          .from(schema.userAccounts)
          .where(and(
            inArray(schema.userAccounts.platform, ["instagram", "tiktok", "x"]),
            eq(schema.userAccounts.is_active, true),
            or(isNull(schema.userAccounts.source), not(eq(schema.userAccounts.source, "mass_posting"))),
            gt(schema.userAccounts.id, lastId),
          ))
          .orderBy(schema.userAccounts.id)
          .limit(PAGE_SIZE);

        accounts = rows.map((a) => ({ id: a.id, source: "user" as const, username: a.username }));
      } else if (phase === "mass_post") {
        const conditions: any[] = [
          isNotNull(schema.userPosts.mass_post_id),
          gt(schema.userPosts.syncs_remaining, 0),
          eq(schema.campaigns.status, "started"),
          gt(schema.userAccounts.id, lastId),
        ];
        if (teamId) conditions.push(eq(schema.userAccounts.team_id, teamId));

        const rows = await db
          .select({
            account_id: schema.userAccounts.id,
            platform: schema.userAccounts.platform,
            team_id: schema.userAccounts.team_id,
          })
          .from(schema.userPosts)
          .innerJoin(schema.userAccounts, eq(schema.userPosts.account_id, schema.userAccounts.id))
          .innerJoin(schema.posts, eq(schema.userPosts.mass_post_id, schema.posts.id))
          .innerJoin(schema.campaigns, eq(schema.posts.campaign_id, schema.campaigns.id))
          .where(and(...conditions))
          .groupBy(schema.userAccounts.id, schema.userAccounts.platform, schema.userAccounts.team_id)
          .orderBy(schema.userAccounts.id)
          .limit(PAGE_SIZE);

        accounts = rows.map((r) => ({
          id: r.account_id,
          source: "mass_post_batch" as const,
          account_id: r.account_id,
          platform: r.platform,
          team_id: r.team_id,
        }));
      }

      if (accounts.length === 0) {
        phaseIndex++;
        lastId = 0;
      }
    }

    const currentPhase = phases[phaseIndex] ?? "done";
    let nextCursor: any = null;

    if (accounts.length > 0) {
      const lastItem = accounts[accounts.length - 1];
      const lastItemId = lastItem.account_id ?? lastItem.id;

      if (accounts.length === PAGE_SIZE) {
        nextCursor = { phase: currentPhase, lastId: lastItemId, teamId, massPostsOnly };
      } else {
        const nextPhaseIndex = phaseIndex + 1;
        if (nextPhaseIndex < phases.length) {
          nextCursor = { phase: phases[nextPhaseIndex], lastId: 0, teamId, massPostsOnly };
        }
      }
    }

    console.log(`[Orchestrator] phase=${currentPhase} returned ${accounts.length} accounts, nextCursor=${JSON.stringify(nextCursor)}`);
    for (const a of accounts) {
      if (a.source === "mass_post_batch") {
        console.log(`  - [mass_post_batch] account=${a.account_id} ${a.platform} (team=${a.team_id})`);
      } else {
        console.log(`  - [${a.source}] id=${a.id} @${a.username}`);
      }
    }

    return { accounts, nextCursor };
  } finally {
    await localPool.end();
  }
};

// ── Worker handler (Step Functions Map iterator) ──

export const workerHandler: Handler = async (event: any, context: Context) => {
  const { id: itemId, source } = event;

  // ── Mass post batch: scrape all posts for one account in a single Apify run ──
  if (source === "mass_post_batch") {
    const { platform, account_id, team_id } = event;

    console.log(`\n========================================`);
    console.log(`  MASS POST BATCH SYNC - account=${account_id} [${platform}]`);
    console.log(`  ${new Date().toISOString()}`);
    console.log(`========================================\n`);

    if (!DATABASE_URL) throw new Error("DATABASE_URL not configured");
    if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

    const localPool = new Pool({ connectionString: DATABASE_URL });
    const db = drizzle(localPool, { schema });
    const apifyClient = new ApifyClient({ token: APIFY_API_TOKEN });

    let syncedCount = 0;
    let skippedCount = 0;

    try {
      const batchPosts = await db
        .select({
          id: schema.userPosts.id,
          post_url: schema.userPosts.post_url,
          syncs_remaining: schema.userPosts.syncs_remaining,
        })
        .from(schema.userPosts)
        .innerJoin(schema.posts, eq(schema.userPosts.mass_post_id, schema.posts.id))
        .innerJoin(schema.campaigns, eq(schema.posts.campaign_id, schema.campaigns.id))
        .where(and(
          eq(schema.userPosts.account_id, account_id),
          isNotNull(schema.userPosts.mass_post_id),
          gt(schema.userPosts.syncs_remaining, 0),
          eq(schema.campaigns.status, "started"),
        ));

      console.log(`[DB] Found ${batchPosts.length} eligible posts for account=${account_id}`);

      if (batchPosts.length === 0) {
        console.log(`[Skip] No eligible posts for account=${account_id}`);
        return { id: account_id, source: "mass_post_batch", status: "skipped", reason: "no_posts" };
      }

      const eligiblePosts: Array<{ id: number; post_url: string }> = [];
      for (const p of batchPosts) {
        const decremented = await db
          .update(schema.userPosts)
          .set({
            syncs_remaining: sql`${schema.userPosts.syncs_remaining} - 1`,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(schema.userPosts.id, p.id),
              sql`${schema.userPosts.syncs_remaining} > 0`
            )
          )
          .returning({ id: schema.userPosts.id });

        if (decremented.length > 0) {
          eligiblePosts.push({ id: p.id, post_url: p.post_url });
        } else {
          skippedCount++;
          console.log(`[Skip] Post id=${p.id} has no syncs remaining`);
        }
      }

      if (eligiblePosts.length === 0) {
        console.log(`[Skip] All ${batchPosts.length} posts skipped (no syncs remaining)`);
        return { id: account_id, source: "mass_post_batch", status: "skipped", reason: "no_syncs" };
      }

      // Single Apify call for all post URLs
      const postUrls = eligiblePosts.map((p) => p.post_url);
      console.log(`[Apify] Batch scraping ${postUrls.length} ${platform} posts...`);
      const metricsMap = await scrapeBatchPostMetrics(apifyClient, postUrls, platform);
      console.log(`[Apify] Got metrics for ${metricsMap.size}/${postUrls.length} posts`);

      // Bulk-fetch current post data for metrics history (single query instead of N)
      const eligibleIds = eligiblePosts.map((p) => p.id);
      const existingPostRows = await db
        .select({
          id: schema.userPosts.id,
          metrics_history: schema.userPosts.metrics_history,
          like_count: schema.userPosts.like_count,
          comment_count: schema.userPosts.comment_count,
          video_play_count: schema.userPosts.video_play_count,
          thumbnail_url: schema.userPosts.thumbnail_url,
        })
        .from(schema.userPosts)
        .where(inArray(schema.userPosts.id, eligibleIds));
      const existingPostMap = new Map(existingPostRows.map((r) => [r.id, r]));

      // Update each post with its metrics
      for (const p of eligiblePosts) {
        const postIdentifier = extractPostIdFromUrl(p.post_url, platform);
        const metrics = postIdentifier ? metricsMap.get(postIdentifier) : null;

        if (!metrics) {
          skippedCount++;
          console.log(`[Skip] Post id=${p.id} — no metrics returned from batch`);
          continue;
        }

        const existing = existingPostMap.get(p.id);

        const history: MetricsEntry[] = Array.isArray(existing?.metrics_history)
          ? [...(existing.metrics_history as MetricsEntry[])]
          : [];
        const lastMetric = history.length > 0 ? history[history.length - 1] : null;
        const { likes: newLikes, comments: newComments, views: newViews } = resolveMetrics(
          { likes: metrics.likesCount || 0, comments: metrics.commentsCount || 0, views: metrics.viewCount ?? null },
          lastMetric,
        );

        history.push({ recorded_at: new Date().toISOString(), likes: newLikes, comments: newComments, views: newViews });
        const trimmed = history.length > MAX_METRICS_HISTORY
          ? history.slice(-MAX_METRICS_HISTORY)
          : history;

        await db
          .update(schema.userPosts)
          .set({
            like_count: newLikes,
            comment_count: newComments,
            video_play_count: newViews,
            thumbnail_url: metrics.thumbnailUrl || existing?.thumbnail_url || null,
            metrics_history: trimmed,
            updated_at: new Date(),
          })
          .where(eq(schema.userPosts.id, p.id));

        syncedCount++;
        console.log(`[OK] Post id=${p.id} synced: likes=${newLikes} comments=${newComments} views=${newViews ?? "N/A"}`);
      }

      // Update account last_synced_at once for the whole batch
      await db
        .update(schema.userAccounts)
        .set({
          last_synced_at: sql`GREATEST(${schema.userAccounts.last_synced_at}, NOW())`,
          updated_at: new Date(),
        })
        .where(eq(schema.userAccounts.id, account_id));

      console.log(`[OK] Batch complete: ${syncedCount} synced, ${skippedCount} skipped`);
      return { id: account_id, source: "mass_post_batch", status: "completed", syncedCount, skippedCount, teamId: team_id };
    } catch (error: any) {
      console.error(`[FAIL] Mass post batch account=${account_id}: ${error.message}`);
      throw error;
    } finally {
      await localPool.end();
    }
  }

  // ── Legacy mass_post events from in-flight Step Functions executions ──
  if (source === "mass_post") {
    console.warn(`[Skip] Legacy mass_post event (id=${itemId}) — use mass_post_batch instead`);
    return { id: itemId, source: "mass_post", status: "skipped", reason: "legacy_format" };
  }

  // ── Account sync (virality / user) ──
  const { username } = event;
  const accountId = itemId;
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
      await db
        .update(accountsTable)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(accountsTable.id, account.id));
      console.log(`[Sync] Sync budget exhausted for @${account.username} (team=${account.team_id}), deactivated`);
      return { accountId, username: account.username, source: sourceLabel, status: "deactivated", postsUpserted: 0 };
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
      return { accountId, username: account.username, source: sourceLabel, status: "completed", postsUpserted, teamId: account.team_id };
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

// ── Team Extractor handler (Step Functions — deduplicates teamIds from sync results) ──

export const teamExtractorHandler: Handler = async () => {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }

  const localPool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(localPool, { schema });

  try {
    const results = await db
      .selectDistinct({ team_id: schema.viralityAccounts.team_id })
      .from(schema.viralityAccounts)
      .where(and(
        eq(schema.viralityAccounts.is_active, true),
        isNotNull(schema.viralityAccounts.team_id)
      ));

    const teams = results
      .filter((r) => r.team_id != null)
      .map((r) => ({ teamId: r.team_id }));
    console.log(`[Extractor] Found ${teams.length} unique teams with active virality accounts`);

    return { teams };
  } finally {
    await localPool.end();
  }
};

// ── Reporter handler (Step Functions — runs once per team after extraction) ──

export const reporterHandler: Handler = async (event: any, context: Context) => {
  const teamId: number | undefined = event.teamId;
  console.log(`\n========================================`);
  console.log(`  VIRALITY SYNC REPORTER - team=${teamId} - ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  if (!teamId) {
    console.log("[Reporter] No teamId in event, skipping");
    return { status: "skipped", reason: "no_team_id" };
  }

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }

  const localPool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(localPool, { schema });

  try {
    await checkAndSendViralAlertsForTeam(db, teamId);
    return { status: "completed", teamId };
  } finally {
    await localPool.end();
  }
};
