import { getApifyService } from "../services/virality/apify.service";
import { fetchWithTimeout } from "./fetchWithTimeout";

export type Platform = "instagram" | "tiktok" | "x" | "youtube" | "facebook";

export interface ResolvedAccount {
  platform: Platform;
  username: string;
  profileUrl: string;
}

/**
 * Detect which platform a URL belongs to.
 * Returns null if unrecognized.
 */
export function detectPlatform(url: string): Platform | null {
  try {
    const hostname = new URL(url).hostname.replace("www.", "").toLowerCase();

    if (hostname === "instagram.com" || hostname === "instagr.am") return "instagram";
    if (hostname === "tiktok.com" || hostname === "vm.tiktok.com") return "tiktok";
    if (hostname === "x.com" || hostname === "twitter.com") return "x";
    if (hostname === "youtube.com" || hostname === "youtu.be" || hostname === "m.youtube.com") return "youtube";
    if (hostname === "facebook.com" || hostname === "fb.com" || hostname === "fb.watch" || hostname === "m.facebook.com") return "facebook";

    return null;
  } catch {
    return null;
  }
}

// ── URL-based extraction (free, instant) ──

/**
 * Try to extract username from a Facebook post/video/reel URL.
 * Works for: facebook.com/USERNAME/posts/ID, facebook.com/USERNAME/videos/ID
 * Fails for: facebook.com/reel/ID, facebook.com/watch/?v=ID, fb.watch/ID, numeric profile IDs
 */
function extractFacebookUsernameFromUrl(url: string): string | null {
  // facebook.com/USERNAME/posts/ID or /videos/ID or /photos/ID
  const postMatch = url.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/([a-zA-Z0-9_.]+)\/(?:posts|videos|photos|reels)\//
  );
  if (postMatch && !isReservedFacebookPath(postMatch[1])) {
    return postMatch[1];
  }

  // facebook.com/USERNAME (profile URL, no post path)
  const profileMatch = url.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/([a-zA-Z0-9_.]+)\/?$/
  );
  if (profileMatch && !isReservedFacebookPath(profileMatch[1])) {
    return profileMatch[1];
  }

  return null;
}

function isReservedFacebookPath(segment: string): boolean {
  const reserved = [
    "reel", "watch", "share", "story", "stories", "groups",
    "marketplace", "events", "pages", "profile.php", "login",
    "help", "settings", "ads", "gaming",
  ];
  return reserved.includes(segment.toLowerCase());
}

/**
 * Try to extract username from a YouTube URL.
 * Works for: youtube.com/@CHANNEL/...
 * Fails for: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
 */
function extractYouTubeUsernameFromUrl(url: string): string | null {
  const handleMatch = url.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/@([a-zA-Z0-9_.-]+)/
  );
  if (handleMatch) {
    return handleMatch[1];
  }
  return null;
}

/**
 * Try to extract username from an Instagram post/reel URL.
 * Works for: instagram.com/USERNAME/reel/CODE, instagram.com/USERNAME/p/CODE
 * Fails for: instagram.com/reel/CODE, instagram.com/p/CODE (no username in URL)
 */
function extractInstagramUsernameFromUrl(url: string): string | null {
  // instagram.com/USERNAME/reel/CODE or /p/CODE
  const withUsername = url.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/(?:reel|p)\//
  );
  if (withUsername && !isReservedInstagramPath(withUsername[1])) {
    return withUsername[1];
  }
  return null;
}

function isReservedInstagramPath(segment: string): boolean {
  const reserved = ["reel", "reels", "p", "stories", "explore", "accounts", "direct", "tv"];
  return reserved.includes(segment.toLowerCase());
}

// ── Retry helper for flaky Apify scrapers ──

const APIFY_RETRY_ATTEMPTS = 5;
const APIFY_RETRY_DELAY_MS = 2000;

async function withRetries<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = APIFY_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (i < attempts) {
        console.warn(`[AccountResolver] ${label} attempt ${i}/${attempts} failed: ${err.message}. Retrying in ${APIFY_RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, APIFY_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError!;
}

// ── API-based resolution (fallbacks) ──

/**
 * Resolve Instagram post owner via Apify scraper.
 * Uses the existing apify/instagram-scraper with directUrls.
 */
async function resolveInstagramAccount(url: string): Promise<string> {
  return withRetries(async () => {
    const apify = getApifyService();
    const result = await apify.scrapeInstagramReel(url);
    if (!result.uploader) {
      throw new Error("Could not resolve Instagram account from post");
    }
    return result.uploader;
  }, "Instagram resolve");
}

/**
 * Resolve YouTube video owner via free oEmbed API (no auth required).
 * Returns the channel handle from author_url.
 */
async function resolveYouTubeAccount(url: string): Promise<string> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetchWithTimeout(oembedUrl, {}, 10000);

  if (!response.ok) {
    throw new Error(`YouTube oEmbed failed: ${response.status}`);
  }

  const data = await response.json() as { author_name?: string; author_url?: string };

  // Try to extract @handle from author_url (e.g., https://www.youtube.com/@ChannelName)
  if (data.author_url) {
    const handleMatch = data.author_url.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) {
      return handleMatch[1];
    }
  }

  // Fall back to author_name
  if (data.author_name) {
    return data.author_name;
  }

  throw new Error("Could not resolve YouTube account from video");
}

/**
 * Resolve Facebook post owner via Apify scraper.
 */
async function resolveFacebookAccount(url: string): Promise<string> {
  return withRetries(async () => {
    const apify = getApifyService();
    const client = (apify as any).getClient();

    const run = await client
      .actor("apify/facebook-posts-scraper")
      .call({
        startUrls: [{ url }],
        resultsLimit: 1,
      });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      throw new Error("Could not resolve Facebook account — no results");
    }

    const item = items[0] as any;
    const username = item.user?.name || item.user?.url || item.pageName || null;

    if (!username) {
      throw new Error("Could not resolve Facebook account from post");
    }

    // If we got a URL, extract the username from it
    if (username.startsWith("http")) {
      const match = username.match(/facebook\.com\/([a-zA-Z0-9_.]+)/);
      return match ? match[1] : username;
    }

    return username;
  }, "Facebook resolve");
}

// ── Main resolver ──

function buildProfileUrl(platform: Platform, username: string): string {
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${username}/`;
    case "tiktok": return `https://www.tiktok.com/@${username}`;
    case "x": return `https://x.com/${username}`;
    case "youtube": return `https://www.youtube.com/@${username}`;
    case "facebook": return `https://www.facebook.com/${username}`;
  }
}

/**
 * Resolve the account (username + profile URL) from any post/video URL.
 *
 * Strategy:
 * 1. Detect platform from URL
 * 2. Try to extract username from URL pattern (free, instant)
 * 3. Fall back to API-based resolution (Apify/oEmbed)
 */
export async function resolveAccountFromUrl(url: string): Promise<ResolvedAccount> {
  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error(`Unrecognized platform for URL: ${url}`);
  }

  // Step 1: Try URL-based extraction
  let username: string | null = null;

  switch (platform) {
    case "instagram":
      username = extractInstagramUsernameFromUrl(url);
      break;
    case "facebook":
      username = extractFacebookUsernameFromUrl(url);
      break;
    case "youtube":
      username = extractYouTubeUsernameFromUrl(url);
      break;
    case "tiktok": {
      const match = url.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/);
      username = match ? match[1] : null;
      break;
    }
    case "x": {
      const match = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)\/status/);
      username = match ? match[1] : null;
      break;
    }
  }

  if (username) {
    console.log(`[AccountResolver] Extracted ${platform} username from URL: @${username}`);
    return { platform, username, profileUrl: buildProfileUrl(platform, username) };
  }

  // Step 2: API-based fallback
  console.log(`[AccountResolver] Username not in URL, resolving ${platform} via API...`);

  switch (platform) {
    case "instagram":
      username = await resolveInstagramAccount(url);
      break;
    case "youtube":
      username = await resolveYouTubeAccount(url);
      break;
    case "facebook":
      username = await resolveFacebookAccount(url);
      break;
    default:
      throw new Error(`Cannot resolve account from ${platform} post URL — username not found in URL`);
  }

  console.log(`[AccountResolver] Resolved ${platform} account: @${username}`);
  return { platform, username, profileUrl: buildProfileUrl(platform, username) };
}
