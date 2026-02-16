import type { ViralityPost } from "@/api/virality";
import type { ComparisonMode } from "@/components/virality/ComparisonModeSelector";

<<<<<<< HEAD
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
=======
/** Compute % change between last two metrics_history entries for a post */
export function getPostMetricChange(
  post: ViralityPost,
  metric: "likes" | "comments" | "views"
): number | null {
  const h = post.metrics_history;
  if (!h || h.length < 2) return null;
  const prev = h[h.length - 2];
  const latest = h[h.length - 1];
>>>>>>> 907f55fab65772aedff47f784ec0e0fd56e46d9b
  const prevVal = metric === "views" ? (prev.views ?? 0) : prev[metric];
  const latestVal = metric === "views" ? (latest.views ?? 0) : latest[metric];
  if (prevVal === 0 || (metric === "views" && latestVal === 0)) return null;
  return ((latestVal - prevVal) / prevVal) * 100;
}

<<<<<<< HEAD
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
  const prevRate = (prev.likes + prev.comments) / prevViews;
  const latestRate = (latest.likes + latest.comments) / latestViews;
  if (prevRate === 0) return null;
  return ((latestRate - prevRate) / prevRate) * 100;
}

=======
>>>>>>> 907f55fab65772aedff47f784ec0e0fd56e46d9b
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

<<<<<<< HEAD
export interface PostFrequencyDay {
  date: string;
  count: number;
}

/** Group posts by posted_at date and count per day, filling gaps with 0 */
export function buildPostFrequencyData(
  posts: ViralityPost[],
  weekFilter: number
): PostFrequencyDay[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weekFilter * 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const byDate = new Map<string, number>();

  for (const post of posts) {
    if (!post.posted_at) continue;
    const day = post.posted_at.slice(0, 10);
    if (day < cutoffStr) continue;
    byDate.set(day, (byDate.get(day) || 0) + 1);
  }

  // Fill gaps between cutoff and today
  const result: PostFrequencyDay[] = [];
  const current = new Date(cutoff);
  current.setDate(current.getDate() + 1);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (current <= today) {
    const dayStr = current.toISOString().slice(0, 10);
    result.push({
      date: new Date(dayStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: byDate.get(dayStr) || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export interface AggregatedDay {
  hourKey: string;
=======
export interface AggregatedDay {
  date: string;
>>>>>>> 907f55fab65772aedff47f784ec0e0fd56e46d9b
  likes: number;
  comments: number;
  views: number;
}

<<<<<<< HEAD
/** Aggregate post metrics per sync point (hourly), filtered to the last N weeks */
=======
/** Aggregate post metrics by day, filtered to the last N weeks */
>>>>>>> 907f55fab65772aedff47f784ec0e0fd56e46d9b
export function buildChartData(
  posts: ViralityPost[],
  weekFilter: number
): AggregatedDay[] {
<<<<<<< HEAD
  const byHour = new Map<string, { likes: number; comments: number; views: number }>();
=======
  const byDate = new Map<string, { likes: number; comments: number; views: number }>();
>>>>>>> 907f55fab65772aedff47f784ec0e0fd56e46d9b

  for (const post of posts) {
    if (!post.metrics_history?.length) continue;
    for (const entry of post.metrics_history) {
<<<<<<< HEAD
      const hour = entry.recorded_at.slice(0, 13);
      const existing = byHour.get(hour) || { likes: 0, comments: 0, views: 0 };
      existing.likes += entry.likes;
      existing.comments += entry.comments;
      existing.views += entry.views ?? 0;
      byHour.set(hour, existing);
=======
      const day = entry.recorded_at.slice(0, 10);
      const existing = byDate.get(day) || { likes: 0, comments: 0, views: 0 };
      existing.likes += entry.likes;
      existing.comments += entry.comments;
      existing.views += entry.views ?? 0;
      byDate.set(day, existing);
>>>>>>> 907f55fab65772aedff47f784ec0e0fd56e46d9b
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weekFilter * 7);
<<<<<<< HEAD
  const cutoffStr = cutoff.toISOString().slice(0, 13);

  const sorted = Array.from(byHour.entries())
    .filter(([hour]) => hour >= cutoffStr)
    .sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([hour, vals]) => ({
    hourKey: hour,
    ...vals,
  }));
}

export interface AccountChartDay {
  hourKey: string;
  [key: string]: string | number;
}

/** Build chart data with a separate series per account for the given metric (hourly granularity) */
export function buildChartDataByAccount(
  postsByAccount: Record<number, ViralityPost[]>,
  accountIds: number[],
  weekFilter: number,
  metric: "likes" | "comments" | "views"
): AccountChartDay[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weekFilter * 7);
  const cutoffStr = cutoff.toISOString().slice(0, 13);

  const allHours = new Set<string>();
  const byAccountHour = new Map<number, Map<string, number>>();

  for (const accountId of accountIds) {
    const posts = postsByAccount[accountId] || [];
    const hourMap = new Map<string, number>();

    for (const post of posts) {
      if (!post.metrics_history?.length) continue;
      for (const entry of post.metrics_history) {
        const hour = entry.recorded_at.slice(0, 13);
        if (hour < cutoffStr) continue;
        allHours.add(hour);
        const val = metric === "views" ? (entry.views ?? 0) : entry[metric];
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
  const start = startDate ? new Date(startDate) : new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : now;

  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  const isHourly = diffDays <= 1;

  if (isHourly) {
    // Group by hour
    const byHour = new Map<string, number>();
    for (const post of posts) {
      if (!post.posted_at) continue;
      const d = new Date(post.posted_at);
      if (d < start || d > end) continue;
      const hourKey = `${d.toISOString().slice(0, 13)}:00`;
      byHour.set(hourKey, (byHour.get(hourKey) || 0) + 1);
    }

    const result: PostFrequencyDay[] = [];
    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    while (cursor <= end) {
      const key = `${cursor.toISOString().slice(0, 13)}:00`;
      result.push({
        date: cursor.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
        count: byHour.get(key) || 0,
      });
      cursor.setHours(cursor.getHours() + 1);
    }
    return { data: result, isHourly: true };
  }

  // Group by day
  const startStr = start.toISOString().slice(0, 10);
  const byDate = new Map<string, number>();
  for (const post of posts) {
    if (!post.posted_at) continue;
    const day = post.posted_at.slice(0, 10);
    if (day < startStr) continue;
    byDate.set(day, (byDate.get(day) || 0) + 1);
  }

  const result: PostFrequencyDay[] = [];
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);

  while (cursor <= endDay) {
    const dayStr = cursor.toISOString().slice(0, 10);
    result.push({
      date: new Date(dayStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: byDate.get(dayStr) || 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { data: result, isHourly: false };
=======
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return Array.from(byDate.entries())
    .filter(([date]) => date >= cutoffStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...vals,
    }));
>>>>>>> 907f55fab65772aedff47f784ec0e0fd56e46d9b
}
