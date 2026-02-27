import { ApifyClient } from "apify-client";
import { config } from "../../config/env";
import { APIFY_ACTORS, SCRAPE_WINDOW_DAYS } from "../../config/virality";
import { parseXUsername } from "../../utils/parseUsername";

const ACTOR_TIMEOUT_SECS = 600; // 10 minutes

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

export interface InstagramReelResult {
  videoUrl: string;
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  likesCount: number;
  commentsCount: number;
  viewCount: number;
}

class ApifyService {
  private client: ApifyClient | null = null;

  constructor() {
    if (config.apify.apiToken) {
      this.client = new ApifyClient({ token: config.apify.apiToken });
    }
  }

  private getClient(): ApifyClient {
    if (!this.client) {
      throw new Error(
        "APIFY_API_TOKEN is not configured. Add it to your .env file."
      );
    }
    return this.client;
  }

  async downloadYouTubeVideo(url: string): Promise<{ downloadUrl: string; title: string; duration: number; thumbnail: string; uploader: string; fileSize: number }> {
    const client = this.getClient();
    const run = await client
      .actor(APIFY_ACTORS.YOUTUBE_DOWNLOADER)
      .call({
        startUrls: [url],
        quality: "480",
        proxy: { useApifyProxy: true },
      }, { timeout: ACTOR_TIMEOUT_SECS });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      throw new Error("Failed to download YouTube video via Apify — no results returned");
    }

    const item = items[0] as any;
    if (!item.downloadUrl) {
      throw new Error("Apify returned no download URL for this YouTube video");
    }

    return {
      downloadUrl: item.downloadUrl,
      title: item.title || "YouTube Video",
      duration: item.duration || 0,
      thumbnail: item.thumbnail || "",
      uploader: item.uploader || item.channelName || "",
      fileSize: item.fileSize || 0,
    };
  }

  async scrapeInstagramReel(url: string): Promise<InstagramReelResult> {
    const client = this.getClient();
    const run = await client
      .actor(APIFY_ACTORS.INSTAGRAM_SCRAPER)
      .call({
        directUrls: [url],
        resultsLimit: 1,
        resultsType: "posts",
      }, { timeout: ACTOR_TIMEOUT_SECS });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      throw new Error("Failed to fetch Instagram reel via Apify — no results returned");
    }

    const item = items[0] as any;
    const videoUrl = item.videoUrl || item.video_url || item.displayUrl;

    if (!videoUrl) {
      throw new Error("Apify returned no video URL for this Instagram reel");
    }

    return {
      videoUrl,
      title: item.caption?.slice(0, 100) || item.alt || "Instagram Reel",
      duration: item.videoDuration || item.duration || 0,
      thumbnail: item.displayUrl || item.thumbnailUrl || "",
      uploader: item.ownerUsername || item.ownerFullName || "",
      likesCount: item.likesCount || 0,
      commentsCount: item.commentsCount || 0,
      viewCount: item.videoPlayCount || item.videoViewCount || 0,
    };
  }

  async scrapeInstagramPosts(
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

    const client = this.getClient();
    const run = await client
      .actor(APIFY_ACTORS.INSTAGRAM_SCRAPER)
      .call(input, { timeout: ACTOR_TIMEOUT_SECS });

    const { items } = await client
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

    const client = this.getClient();
    const run = await client
      .actor(APIFY_ACTORS.INSTAGRAM_PROFILE_SCRAPER)
      .call(input, { timeout: ACTOR_TIMEOUT_SECS });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length > 0) {
      return this.normalizeProfileData(items[0]);
    }

    return null;
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

  // ── Instagram Hashtag ──

  async scrapeInstagramHashtag(
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

    const client = this.getClient();
    const run = await client
      .actor(APIFY_ACTORS.INSTAGRAM_SCRAPER)
      .call(input, { timeout: ACTOR_TIMEOUT_SECS });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    const posts: InstagramPost[] = items
      .filter((item: any) => item.type !== "profile" && !item.profilePicUrl)
      .map((item) => this.normalizePostData(item));

    return { posts, profile: null };
  }

  // ── TikTok ──

  async scrapeTikTokPosts(
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

    const client = this.getClient();
    const run = await client
      .actor(APIFY_ACTORS.TIKTOK_SCRAPER)
      .call(input, { timeout: ACTOR_TIMEOUT_SECS });

    const { items } = await client
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

  // ── TikTok Hashtag ──

  async scrapeTikTokHashtag(
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

    const client = this.getClient();
    const run = await client
      .actor(APIFY_ACTORS.TIKTOK_SCRAPER)
      .call(input, { timeout: ACTOR_TIMEOUT_SECS });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    const posts: InstagramPost[] = items.map((item) =>
      this.normalizeTikTokPostData(item)
    );

    return { posts, profile: null };
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

    const client = this.getClient();
    const postsRun = await client
      .actor(APIFY_ACTORS.X_POSTS_SCRAPER)
      .call(postsInput, { timeout: ACTOR_TIMEOUT_SECS });

    const { items: tweetItems } = await client
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

        const viewsRun = await client
          .actor(APIFY_ACTORS.X_VIEWS_SCRAPER)
          .call(viewsInput, { timeout: ACTOR_TIMEOUT_SECS });

        const { items: viewItems } = await client
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

  // ── X Keyword/Hashtag Search ──

  async scrapeXKeywordSearch(
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

    const client = this.getClient();
    const postsRun = await client
      .actor(APIFY_ACTORS.X_POSTS_SCRAPER)
      .call(postsInput, { timeout: ACTOR_TIMEOUT_SECS });

    const { items: tweetItems } = await client
      .dataset(postsRun.defaultDatasetId)
      .listItems();

    // Fetch view counts
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

        const viewsRun = await client
          .actor(APIFY_ACTORS.X_VIEWS_SCRAPER)
          .call(viewsInput, { timeout: ACTOR_TIMEOUT_SECS });

        const { items: viewItems } = await client
          .dataset(viewsRun.defaultDatasetId)
          .listItems();

        for (const item of viewItems) {
          const vi = item as any;
          viewCountMap.set(String(vi.id), vi.view_count ?? null);
        }
      } catch (err) {
        console.warn(`Failed to fetch X view counts for search "${term}":`, err);
      }
    }

    const posts: InstagramPost[] = tweetItems.map((item: any) =>
      this.normalizeXPostData(item, viewCountMap.get(String(item.id)) ?? null)
    );

    return { posts, profile: null };
  }

  private normalizeXPostData(
    rawPost: any,
    viewCount: number | null
  ): InstagramPost {
    // Extract hashtags from tweet text
    const hashtags = (rawPost.text || "")
      .match(/#[a-zA-Z0-9_]+/g)
      ?.map((h: string) => h.substring(1)) || [];

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
      ownerUsername: rawPost.url ? parseXUsername(rawPost.url) : "",
      ownerFullName: "",
      ownerId: "",
    };
  }

  /**
   * Fetch X/Twitter profile using SocialData API (follower count, etc.)
   */
  /**
   * Fetch X follower count from SocialData API.
   * Only returns followersCount — all other profile fields come from Apify scrapers.
   */
  async fetchXFollowerCount(username: string): Promise<Partial<InstagramProfile> | null> {
    const apiKey = config.socialData.apiKey;
    if (!apiKey) {
      console.warn("SOCIALDATA_API_KEY not configured, skipping X profile fetch");
      return null;
    }

    try {
      const res = await fetch(`https://api.socialdata.tools/twitter/user/${encodeURIComponent(username)}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn(`SocialData API error for @${username}: ${res.status} ${res.statusText}`);
        return null;
      }

      const data: any = await res.json();
      console.log(`[SocialData] Fetched X follower count for @${username}: ${data.followers_count}`);

      return {
        followersCount: data.followers_count ?? 0,
      };
    } catch (err) {
      console.warn(`Failed to fetch X profile for @${username}:`, err);
      return null;
    }
  }

  async scrapePostMetrics(postUrl: string, platform: string): Promise<{
    likesCount: number;
    commentsCount: number;
    viewCount: number | null;
    thumbnailUrl: string | null;
  } | null> {
    try {
      const client = this.getClient();

      if (platform === "instagram") {
        const result = await this.scrapeInstagramReel(postUrl);
        return {
          likesCount: result.likesCount,
          commentsCount: result.commentsCount,
          viewCount: result.viewCount,
          thumbnailUrl: result.thumbnail || null,
        };
      }

      if (platform === "tiktok") {
        const run = await client
          .actor(APIFY_ACTORS.TIKTOK_SCRAPER)
          .call({
            postURLs: [postUrl],
            shouldDownloadCovers: false,
            shouldDownloadVideos: false,
          }, { timeout: ACTOR_TIMEOUT_SECS });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        if (items.length === 0) return null;

        const item = items[0] as any;
        return {
          likesCount: item.diggCount || 0,
          commentsCount: item.commentCount || 0,
          viewCount: item.playCount ?? null,
          thumbnailUrl: item.videoMeta?.coverUrl || null,
        };
      }

      if (platform === "x") {
        const tweetId = postUrl.match(/\/status\/(\d+)/)?.[1];
        if (!tweetId) return null;

        const postsRun = await client
          .actor(APIFY_ACTORS.X_POSTS_SCRAPER)
          .call({
            tweetIDs: [tweetId],
            maxItems: 1,
          }, { timeout: ACTOR_TIMEOUT_SECS });

        const { items: tweetItems } = await client.dataset(postsRun.defaultDatasetId).listItems();
        if (tweetItems.length === 0) return null;

        const tweet = tweetItems[0] as any;
        let viewCount: number | null = null;

        try {
          const viewsRun = await client
            .actor(APIFY_ACTORS.X_VIEWS_SCRAPER)
            .call({ tweets: tweetId, max_results: 1, mode: "Get a Few Tweets" }, { timeout: ACTOR_TIMEOUT_SECS });

          const { items: viewItems } = await client.dataset(viewsRun.defaultDatasetId).listItems();
          if (viewItems.length > 0) {
            viewCount = (viewItems[0] as any).view_count ?? null;
          }
        } catch {
          // view scraper failed, continue without views
        }

        return {
          likesCount: tweet.likeCount || 0,
          commentsCount: tweet.replyCount || 0,
          viewCount,
          thumbnailUrl: null,
        };
      }

      return null;
    } catch (err) {
      console.warn(`[Apify] scrapePostMetrics failed for ${postUrl}:`, err);
      return null;
    }
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
      videoPlayCount: rawPost.playCount,
      timestamp: rawPost.createTimeISO || "",
      type: "Video",
      ownerUsername: rawPost.authorMeta?.name || "",
      ownerFullName: rawPost.authorMeta?.nickName || "",
      ownerId: rawPost.authorMeta?.id || "",
    };
  }
}

let _apifyService: ApifyService | null = null;
export function getApifyService() {
  if (!_apifyService) _apifyService = new ApifyService();
  return _apifyService;
}
export type { InstagramPost, InstagramProfile };
