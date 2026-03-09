import type { ViralityPost } from "@/api/virality";
import type { ComparisonMode } from "@/components/virality/ComparisonModeSelector";
import type { StatCardItem } from "@/components/virality/StatCards";
import { formatNumber } from "@/lib/formatters";

/** Percentage change helper — returns null when prev is 0 */
export function pct(latest: number, prev: number): number | null {
  return prev > 0 ? ((latest - prev) / prev) * 100 : null;
}

/** Average posts per week calculated from posted_at timestamps */
export function computePostsPerWeek(posts: ViralityPost[]): number {
  if (posts.length < 2) return posts.length;
  const dates = posts
    .map((p) => (p.posted_at ? new Date(p.posted_at).getTime() : 0))
    .filter((t) => t > 0);
  if (dates.length < 2) return posts.length;
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);
  const weeks = Math.max((latest - earliest) / (7 * 24 * 60 * 60 * 1000), 1);
  return +(dates.length / weeks).toFixed(1);
}

/** Compute % change for a post metric, optionally relative to a comparison date */
export function getPostMetricChange(
  post: ViralityPost,
  metric: "likes" | "comments" | "views",
  comparisonDate?: Date | null
): number | null {
  const h = post.metrics_history;
  if (!h || h.length < 2) return null;
  const latest = h[h.length - 1];
  const prev = comparisonDate
    ? findClosestEntry(h, comparisonDate)
    : h[h.length - 2];
  if (!prev || prev === latest) return null;
  const prevVal = metric === "views" ? (prev.views ?? 0) : prev[metric];
  const latestVal = metric === "views" ? (latest.views ?? 0) : latest[metric];
  if (prevVal === 0 || (metric === "views" && latestVal === 0)) return null;
  return ((latestVal - prevVal) / prevVal) * 100;
}

/** Compute % change in engagement rate, optionally relative to a comparison date */
export function getPostEngRateChange(
  post: ViralityPost,
  comparisonDate?: Date | null
): number | null {
  const h = post.metrics_history;
  if (!h || h.length < 2) return null;
  const latest = h[h.length - 1];
  const prev = comparisonDate
    ? findClosestEntry(h, comparisonDate)
    : h[h.length - 2];
  if (!prev || prev === latest) return null;
  const prevViews = prev.views ?? 0;
  const latestViews = latest.views ?? 0;
  if (prevViews === 0 || latestViews === 0) return null;
  const prevRate = ((prev.likes + prev.comments) / prevViews) * 100;
  const latestRate = ((latest.likes + latest.comments) / latestViews) * 100;
  return latestRate - prevRate;
}

/** Calculate views gained within a date range using metrics_history.
 *  Falls back to total video_play_count when history is insufficient. */
export function getViewsInRange(
  post: ViralityPost,
  startDate?: string,
  endDate?: string
): number {
  const h = post.metrics_history;
  if (!h || h.length === 0) return post.video_play_count ?? 0;

  // If only one history entry, fall back to total views
  if (h.length < 2) return post.video_play_count ?? 0;

  // If no date range, return total views
  if (!startDate && !endDate) return post.video_play_count ?? 0;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : new Date();

  const startEntry = start ? findClosestEntry(h, start) : h[0];
  const endEntry = end ? findClosestEntry(h, end) : h[h.length - 1];

  if (!startEntry || !endEntry) return post.video_play_count ?? 0;

  const startViews = startEntry.views ?? 0;
  const endViews = endEntry.views ?? 0;

  return Math.max(endViews - startViews, 0);
}

/** Find the history entry closest to a target date */
export function findClosestEntry<T extends { recorded_at: string }>(
  history: T[],
  targetDate: Date
): T | null {
  if (!history || history.length === 0) return null;
  const targetMs = targetDate.getTime();
  let closest: T | null = null;
  let closestDiff = Infinity;
  for (const entry of history) {
    const diff = Math.abs(new Date(entry.recorded_at).getTime() - targetMs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = entry;
    }
  }
  return closest;
}

/** Resolve a ComparisonMode to a Date (null = last sync / use last two entries) */
export function getComparisonDate(mode: ComparisonMode): Date | null {
  switch (mode.type) {
    case "last-sync":
      return null;
    case "days-ago": {
      const d = new Date();
      d.setDate(d.getDate() - mode.days);
      return d;
    }
    case "custom-date":
      return mode.date;
  }
}

export interface PostFrequencyDay {
  date: string;
  count: number;
}

export interface AccountChartDay {
  hourKey: string;
  [key: string]: string | number;
}

/** Build chart data with a separate series per account for the given metric (hourly granularity) */
export function buildChartDataByAccount(
  postsByAccount: Record<number, ViralityPost[]>,
  accountIds: number[],
  metric: "likes" | "comments" | "views",
  startDate?: string,
  endDate?: string,
): AccountChartDay[] {
  const startStr = startDate ? new Date(startDate).toISOString().slice(0, 13) : undefined;
  const endStr = endDate ? new Date(endDate).toISOString().slice(0, 13) : undefined;

  const allHours = new Set<string>();
  const byAccountHour = new Map<number, Map<string, number>>();

  for (const accountId of accountIds) {
    const posts = postsByAccount[accountId] || [];
    const hourMap = new Map<string, number>();

    for (const post of posts) {
      if (!post.metrics_history?.length) continue;
      // Per post: take the max value at each hour (metrics are cumulative,
      // so duplicate snapshots in the same hour must not be summed)
      const postHourMax = new Map<string, number>();
      for (const entry of post.metrics_history) {
        const hour = entry.recorded_at.slice(0, 13);
        if (startStr && hour < startStr) continue;
        if (endStr && hour > endStr) continue;
        allHours.add(hour);
        const val = metric === "views" ? (entry.views ?? 0) : entry[metric];
        const prev = postHourMax.get(hour);
        if (prev === undefined || val > prev) postHourMax.set(hour, val);
      }
      for (const [hour, val] of Array.from(postHourMax)) {
        hourMap.set(hour, (hourMap.get(hour) || 0) + val);
      }
    }

    byAccountHour.set(accountId, hourMap);
  }

  const sorted = Array.from(allHours).sort();

  return sorted.map((hour) => {
    const point: AccountChartDay = { hourKey: hour };
    for (const accountId of accountIds) {
      point[`account_${accountId}`] = byAccountHour.get(accountId)?.get(hour) || 0;
    }
    return point;
  });
}

/** Build post frequency data using the page-level date range (supports hourly for single-day) */
export function buildPostFrequencyDataFromRange(
  posts: ViralityPost[],
  startDate?: string,
  endDate?: string
): { data: PostFrequencyDay[]; isHourly: boolean } {
  const now = new Date();
  const end = endDate ? new Date(endDate) : now;

  // When no startDate, use the earliest post date instead of a fixed window
  let start: Date;
  if (startDate) {
    start = new Date(startDate);
  } else {
    const postDates = posts
      .map((p) => p.posted_at ? new Date(p.posted_at).getTime() : 0)
      .filter((t) => t > 0);
    start = postDates.length > 0
      ? new Date(Math.min(...postDates))
      : new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  const isHourly = diffDays <= 1;

  if (isHourly) {
    // Group by local hour so chart matches user's timezone
    const toLocalHourKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`;

    const byHour = new Map<string, number>();
    for (const post of posts) {
      if (!post.posted_at) continue;
      const d = new Date(post.posted_at);
      if (d < start || d > end) continue;
      const hourKey = toLocalHourKey(d);
      byHour.set(hourKey, (byHour.get(hourKey) || 0) + 1);
    }

    const result: PostFrequencyDay[] = [];
    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    while (cursor <= end) {
      const key = toLocalHourKey(cursor);
      result.push({
        date: cursor.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
        count: byHour.get(key) || 0,
      });
      cursor.setHours(cursor.getHours() + 1);
    }
    return { data: result, isHourly: true };
  }

  // Group by day — convert UTC posted_at to local date so chart matches
  // the user's calendar (e.g., a post at 5 PM PST on Mar 5 stored as
  // Mar 6 UTC should still show under Mar 5 for PST users).
  const toLocalDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const startStr = toLocalDay(start.toISOString());
  const byDate = new Map<string, number>();
  for (const post of posts) {
    if (!post.posted_at) continue;
    const day = toLocalDay(post.posted_at);
    if (day < startStr) continue;
    byDate.set(day, (byDate.get(day) || 0) + 1);
  }

  const result: PostFrequencyDay[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);

  while (cursor <= endDay) {
    const dayStr = toLocalDay(cursor.toISOString());
    result.push({
      date: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: byDate.get(dayStr) || 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { data: result, isHourly: false };
}

// ── Stat card builder ─────────────────────────────────────────────────────────

export interface CompetitorStats {
  totalViews: number;
  totalEngagements: number;
  engagementsChange: number | null;
  engagementRate: number;
  engRateChange: number | null;
  followers: number;
  followersChange: number | null;
  viewsChange: number | null;
}

/**
 * Builds the StatCardItem array for the competitor detail page stat row.
 * Keeping this in utils.ts avoids a 50-line block of data in the page component.
 */
export function buildStatCards(
  stats: CompetitorStats,
  totalPosts: number,
  postsPerWeek: number
): StatCardItem[] {
  return [
    {
      title: "TOTAL VIEWS",
      value: formatNumber(stats.totalViews),
      icon: "solar:eye-bold",
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
      change: stats.viewsChange,
      tooltip: "Only counts views on video posts (Reels)",
    },
    {
      title: "TOTAL ENGAGEMENTS",
      value: formatNumber(stats.totalEngagements),
      icon: "solar:heart-bold",
      iconColor: "text-red-500",
      iconBg: "bg-red-500/10",
      change: stats.engagementsChange,
      tooltip: "Sum of likes and comments",
    },
    {
      title: "TOTAL POSTS",
      value: formatNumber(totalPosts),
      icon: "solar:document-bold",
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
      change: null,
    },
    {
      title: "FOLLOWERS",
      value: formatNumber(stats.followers),
      icon: "solar:users-group-rounded-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
      change: stats.followersChange,
    },
    {
      title: "AVG ENG RATE",
      value: stats.engagementRate.toFixed(2) + "%",
      icon: "solar:chart-2-bold",
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10",
      change: stats.engRateChange,
      absoluteChange: true,
      tooltip: "(Likes + Comments) / Views x 100",
    },
    {
      title: "CONTENT VELOCITY",
      value: String(postsPerWeek),
      icon: "solar:rocket-2-bold",
      iconColor: "text-purple-500",
      iconBg: "bg-purple-500/10",
      change: null,
      tooltip: "Average posts per week based on post date range",
    },
  ];
}

// ── Sync countdown ────────────────────────────────────────────────────────────

/**
 * Returns a human-readable string for how long until the next scheduled
 * Lambda virality sync (runs at 00:00 UTC and 12:00 UTC every day).
 */
export function getNextSyncCountdown(): string {
  const now = new Date();
  const candidates = [0, 12].map((h) => {
    const t = new Date(now);
    t.setUTCHours(h, 0, 0, 0);
    if (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
    return t;
  });
  const next = candidates.reduce((a, b) => (a < b ? a : b));
  const diff = next.getTime() - now.getTime();
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}
