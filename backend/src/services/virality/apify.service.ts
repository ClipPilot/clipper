import { ApifyClient } from "apify-client";

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const INSTAGRAM_SCRAPER_ACTOR = "apify/instagram-scraper";

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
    username: string,
    postsLimit: number = 20
  ): Promise<{ posts: InstagramPost[]; profile: InstagramProfile | null }> {
    const input = {
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "posts",
      resultsLimit: postsLimit,
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
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "details",
      searchType: "user",
    };

    const run = await this.client
      .actor(INSTAGRAM_SCRAPER_ACTOR)
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
      videoViewCount: rawPost.videoViewCount,
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
}

export const apifyService = new ApifyService();
export type { InstagramPost, InstagramProfile };
