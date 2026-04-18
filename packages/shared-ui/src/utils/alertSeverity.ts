export interface ViralPostSnapshot {
  postId: number;
  postUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  platform: string;
  accountHandle: string;
  groupName: string;
  isCompetitor: boolean;
  currentViews: number;
  previousViews: number;
  viewsIncrease: number;
  percentIncrease: number;
  likeCount: number;
  commentCount: number;
}

export type AlertSeverity = "high" | "medium" | "low";

export function computeAlertSeverity(
  percentIncrease: number,
  viewsIncrease: number,
  settings: {
    percent_threshold: number;
    absolute_threshold: number;
  },
): AlertSeverity {
  const { percent_threshold, absolute_threshold } = settings;
  if (percentIncrease >= percent_threshold * 3 && viewsIncrease >= absolute_threshold * 2) return "high";
  if (percentIncrease >= percent_threshold * 1.5 || viewsIncrease >= absolute_threshold) return "medium";
  return "low";
}

export function deriveSnapshotSeverity(
  posts: ViralPostSnapshot[],
  settings: {
    owned_percent_threshold: number;
    owned_absolute_threshold: number;
    competitor_percent_threshold: number;
    competitor_absolute_threshold: number;
  },
): AlertSeverity {
  if (!posts.length) return "low";
  const severities = posts.map((p) =>
    computeAlertSeverity(
      p.percentIncrease,
      p.viewsIncrease,
      p.isCompetitor
        ? { percent_threshold: settings.competitor_percent_threshold, absolute_threshold: settings.competitor_absolute_threshold }
        : { percent_threshold: settings.owned_percent_threshold, absolute_threshold: settings.owned_absolute_threshold },
    ),
  );
  if (severities.includes("high")) return "high";
  if (severities.includes("medium")) return "medium";
  return "low";
}

export function deriveSnapshotType(posts: ViralPostSnapshot[]): "Competitor" | "Owned" | "Mixed" {
  const hasCompetitor = posts.some((p) => p.isCompetitor);
  const hasOwned = posts.some((p) => !p.isCompetitor);
  if (hasCompetitor && hasOwned) return "Mixed";
  return hasCompetitor ? "Competitor" : "Owned";
}
