import { ApifyClient } from "apify-client";

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const INSTAGRAM_SCRAPER_ACTOR = "apify/instagram-scraper";
const INSTAGRAM_PROFILE_SCRAPER_ACTOR = "apify/instagram-profile-scraper";
const TIKTOK_SCRAPER_ACTOR = "clockworks/tiktok-scraper";
const X_POSTS_SCRAPER_ACTOR = "apidojo/twitter-scraper-lite";
const X_VIEWS_SCRAPER_ACTOR = "scrape.badger/twitter-tweets-scraper";
const SCRAPE_WINDOW_DAYS = 28;

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

class ApifyService {
  private client: ApifyClient;

  constructor() {
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN is not configured");
    }
    this.client = new ApifyClient({ token: APIFY_API_TOKEN });
  }

  async scrapeInstagramPosts(
    username: string
  ): Promise<{ posts: InstagramPost[]; profile: InstagramProfile | null }> {
    const input = {
      addParentData: false,
      directUrls: [`https://www.instagram.com/${username}/`],
      onlyPostsNewerThan: "28 days",
      resultsLimit: 100,
      resultsType: "posts",
      searchType: "user",
    };

    const run = await this.client
      .actor(INSTAGRAM_SCRAPER_ACTOR)
      .call(input);

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      throw new Error(
        `Instagram profile @${username} was not found or may be private`
      );
    }

    const posts: InstagramPost[] = [];
    let profile: InstagramProfile | null = null;

    for (const item of items) {
      if (item.type === "profile" || item.profilePicUrl) {
        profile = this.normalizeProfileData(item);
      } else {
        posts.push(this.normalizePostData(item));
      }
    }

    return { posts, profile };
  }

  async scrapeInstagramProfile(
    username: string
  ): Promise<InstagramProfile | null> {
    const input = {
      usernames: [username],
    };

    const run = await this.client
      .actor(INSTAGRAM_PROFILE_SCRAPER_ACTOR)
      .call(input);

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length > 0) {
      return this.normalizeProfileData(items[0]);
    }

    return null;
  }

  parseInstagramUsername(input: string): string {
    let username = input.trim();

    // Remove @ prefix
    if (username.startsWith("@")) {
      username = username.substring(1);
    }

    // Extract from URL
    const urlMatch = username.match(
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/
    );
    if (urlMatch) {
      username = urlMatch[1];
    }

    // Remove trailing slashes
    username = username.replace(/\/$/, "");

    return username;
  }

  normalizePostData(rawPost: any): InstagramPost {
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

  normalizeProfileData(rawProfile: any): InstagramProfile {
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

  // ── TikTok ──

  async scrapeTikTokPosts(
    username: string
  ): Promise<{ posts: InstagramPost[]; profile: InstagramProfile | null }> {
    const input = {
      profiles: [username],
      resultsPerPage: 100,
      shouldDownloadCovers: false,
      shouldDownloadVideos: false,
    };

    const run = await this.client
      .actor(TIKTOK_SCRAPER_ACTOR)
      .call(input);

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      throw new Error(
        `TikTok profile @${username} has not new posts or was not found or may be private`
      );
    }

    const posts: InstagramPost[] = items.map((item) =>
      this.normalizeTikTokPostData(item)
    );

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

    return { posts, profile };
  }

  parseTikTokUsername(input: string): string {
    let username = input.trim();

    // Remove @ prefix
    if (username.startsWith("@")) {
      username = username.substring(1);
    }

    // Extract from URL: tiktok.com/@username
    const urlMatch = username.match(
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/
    );
    if (urlMatch) {
      username = urlMatch[1];
    }

    // Remove trailing slashes
    username = username.replace(/\/$/, "");

    return username;
  }

  // ── X (Twitter) ──

  async scrapeXPosts(
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

    const postsRun = await this.client
      .actor(X_POSTS_SCRAPER_ACTOR)
      .call(postsInput);

    const { items: tweetItems } = await this.client
      .dataset(postsRun.defaultDatasetId)
      .listItems();

    if (tweetItems.length === 0) {
      throw new Error(
        `X profile @${username} has no recent posts or was not found or may be private`
      );
    }

    // Step 2: Fetch view counts for all tweet IDs
    const tweetIds = tweetItems
      .map((item: any) => item.id)
      .filter(Boolean);

    const viewCountMap = new Map<string, number | null>();

    if (tweetIds.length > 0) {
      try {
        const viewsInput = {
          tweets: tweetIds.join(","),
          max_results: 100,
          mode: "Get a Few Tweets",
        };

        const viewsRun = await this.client
          .actor(X_VIEWS_SCRAPER_ACTOR)
          .call(viewsInput);

        const { items: viewItems } = await this.client
          .dataset(viewsRun.defaultDatasetId)
          .listItems();

        for (const item of viewItems) {
          const vi = item as any;
          viewCountMap.set(String(vi.id), vi.view_count ?? null);
        }
      } catch (err) {
        // View count scraper failed — continue without views
        console.warn(`Failed to fetch X view counts for @${username}:`, err);
      }
    }

    // Step 3: Normalize posts with merged view counts
    const posts: InstagramPost[] = tweetItems.map((item: any) =>
      this.normalizeXPostData(item, viewCountMap.get(String(item.id)) ?? null)
    );

    return { posts, profile: null };
  }

  parseXUsername(input: string): string {
    let username = input.trim();

    // Remove @ prefix
    if (username.startsWith("@")) {
      username = username.substring(1);
    }

    // Extract from URL: x.com/username or twitter.com/username
    const urlMatch = username.match(
      /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/
    );
    if (urlMatch) {
      username = urlMatch[1];
    }

    // Remove trailing slashes
    username = username.replace(/\/$/, "");

    return username;
  }

  private normalizeXPostData(
    rawPost: any,
    viewCount: number | null
  ): InstagramPost {
    // Extract hashtags from tweet text
    const hashtags = (rawPost.text || "")
      .match(/#[a-zA-Z0-9_]+/g)
      ?.map((h: string) => h.substring(1)) || [];

    // Extract username from URL: https://x.com/username/status/...
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

  private normalizeTikTokPostData(rawPost: any): InstagramPost {
    // Extract video ID from webVideoUrl
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
}

export const apifyService = new ApifyService();
export type { InstagramPost, InstagramProfile };
