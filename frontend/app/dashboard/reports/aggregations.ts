import type { ViralityPost, ViralityAccount } from "@clipper/shared-ui";

export interface ReportRow {
  key: string;
  label: string;
  color: string;
  postCount: number;
  views: number;
  likes: number;
  comments: number;
  engRate: number;
}

const PLATFORM_ORDER = ["instagram", "tiktok", "x"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  tiktok: "#22D3EE",
  x: "#94A3B8",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  reel: "Reels",
  short: "Shorts",
  video: "Videos",
};

const CONTENT_TYPE_COLORS = [
  "#A78BFA",
  "#6366F1",
  "#F472B6",
  "#34D399",
  "#FBBF24",
  "#FB923C",
];

function toRow(
  key: string,
  label: string,
  color: string,
  posts: ViralityPost[],
): ReportRow {
  let views = 0;
  let likes = 0;
  let comments = 0;
  for (const p of posts) {
    views += p.video_play_count ?? 0;
    likes += p.like_count ?? 0;
    comments += p.comment_count ?? 0;
  }
  const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  return {
    key,
    label,
    color,
    postCount: posts.length,
    views,
    likes,
    comments,
    engRate,
  };
}

export function aggregateByPlatform(
  posts: ViralityPost[],
  accountsById: Record<number, ViralityAccount>,
): ReportRow[] {
  const buckets: Record<string, ViralityPost[]> = {};
  for (const p of posts) {
    const account = accountsById[p.account_id];
    const platform = account?.platform?.toLowerCase();
    if (!platform) continue;
    (buckets[platform] ??= []).push(p);
  }

  const rows: ReportRow[] = [];
  for (const platform of PLATFORM_ORDER) {
    const bucket = buckets[platform] ?? [];
    rows.push(
      toRow(
        platform,
        PLATFORM_LABELS[platform],
        PLATFORM_COLORS[platform],
        bucket,
      ),
    );
  }
  return rows;
}

export function aggregateByPostType(posts: ViralityPost[]): ReportRow[] {
  const buckets: Record<string, ViralityPost[]> = {};
  for (const p of posts) {
    const t = (p.post_type ?? "").toLowerCase();
    if (!t) continue;
    (buckets[t] ??= []).push(p);
  }

  const keys = Object.keys(buckets).sort(
    (a, b) => buckets[b].length - buckets[a].length,
  );

  return keys.map((key, i) =>
    toRow(
      key,
      CONTENT_TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
      CONTENT_TYPE_COLORS[i % CONTENT_TYPE_COLORS.length],
      buckets[key],
    ),
  );
}

export function aggregateTotals(posts: ViralityPost[]) {
  let views = 0;
  let likes = 0;
  let comments = 0;
  for (const p of posts) {
    views += p.video_play_count ?? 0;
    likes += p.like_count ?? 0;
    comments += p.comment_count ?? 0;
  }
  const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  return { postCount: posts.length, views, likes, comments, engRate };
}

export function rowsToCsv(rows: ReportRow[], dimensionLabel: string): string {
  const headers = [
    dimensionLabel,
    "Posts",
    "Views",
    "Likes",
    "Comments",
    "Engagement Rate (%)",
  ];
  const body = rows.map((r) => [
    r.label,
    r.postCount,
    r.views,
    r.likes,
    r.comments,
    r.engRate.toFixed(2),
  ]);
  return [headers, ...body]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
}
