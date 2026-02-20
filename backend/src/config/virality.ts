export const APIFY_ACTORS = {
  INSTAGRAM_SCRAPER: "apify/instagram-scraper",
  INSTAGRAM_PROFILE_SCRAPER: "apify/instagram-profile-scraper",
  INSTAGRAM_REEL_SCRAPER: "apify/instagram-reel-scraper",
  TIKTOK_SCRAPER: "clockworks/tiktok-scraper",
  X_POSTS_SCRAPER: "apidojo/twitter-scraper-lite",
  X_VIEWS_SCRAPER: "scrape.badger/twitter-tweets-scraper",
} as const;

export const SCRAPE_WINDOW_DAYS = 31;
export const MAX_ACCOUNTS_PER_TEAM = 10;
export const SYNC_INTERVAL_HOURS = 6;
export const SYNCS_PER_DAY = Math.floor(24 / SYNC_INTERVAL_HOURS);
export const MAX_METRICS_HISTORY = SCRAPE_WINDOW_DAYS * SYNCS_PER_DAY;
export const MAX_FOLLOWER_HISTORY = 180;
