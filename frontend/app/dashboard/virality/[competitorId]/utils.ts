import type { ViralityPost } from "@/api/virality";
import type { ComparisonMode } from "@/components/virality/ComparisonModeSelector";

/** Compute % change between last two metrics_history entries for a post */
export function getPostMetricChange(
  post: ViralityPost,
  metric: "likes" | "comments" | "views"
): number | null {
  const h = post.metrics_history;
  if (!h || h.length < 2) return null;
  const prev = h[h.length - 2];
  const latest = h[h.length - 1];
  const prevVal = metric === "views" ? (prev.views ?? 0) : prev[metric];
  const latestVal = metric === "views" ? (latest.views ?? 0) : latest[metric];
  if (prevVal === 0 || (metric === "views" && latestVal === 0)) return null;
  return ((latestVal - prevVal) / prevVal) * 100;
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

export interface AggregatedDay {
  date: string;
  likes: number;
  comments: number;
  views: number;
}

/** Aggregate post metrics by day, filtered to the last N weeks */
export function buildChartData(
  posts: ViralityPost[],
  weekFilter: number
): AggregatedDay[] {
  const byDate = new Map<string, { likes: number; comments: number; views: number }>();

  for (const post of posts) {
    if (!post.metrics_history?.length) continue;
    for (const entry of post.metrics_history) {
      const day = entry.recorded_at.slice(0, 10);
      const existing = byDate.get(day) || { likes: 0, comments: 0, views: 0 };
      existing.likes += entry.likes;
      existing.comments += entry.comments;
      existing.views += entry.views ?? 0;
      byDate.set(day, existing);
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weekFilter * 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return Array.from(byDate.entries())
    .filter(([date]) => date >= cutoffStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...vals,
    }));
}
