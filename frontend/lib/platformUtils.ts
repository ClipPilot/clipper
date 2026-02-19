export type Platform = "instagram" | "tiktok" | "x" | "youtube" | "facebook" | "linkedin";

export function platformIcon(platform: string): string {
  if (platform === "x") return "ri:twitter-x-fill";
  if (platform === "tiktok") return "ri:tiktok-fill";
  if (platform === "youtube") return "ri:youtube-fill";
  if (platform === "facebook") return "ri:facebook-fill";
  if (platform === "linkedin") return "ri:linkedin-fill";
  return "ri:instagram-fill";
}

export function platformIconColor(platform: string): string {
  if (platform === "tiktok") return "text-cyan-400";
  if (platform === "x") return "text-foreground";
  if (platform === "youtube") return "text-red-500";
  if (platform === "facebook") return "text-blue-500";
  if (platform === "linkedin") return "text-blue-400";
  return "text-pink-500";
}

export function platformChipClass(platform: string): string {
  if (platform === "tiktok") return "bg-cyan-500/10 text-cyan-500";
  if (platform === "x") return "bg-foreground/10 text-foreground";
  if (platform === "youtube") return "bg-red-500/10 text-red-500";
  if (platform === "facebook") return "bg-blue-500/10 text-blue-500";
  if (platform === "linkedin") return "bg-blue-400/10 text-blue-400";
  return "bg-pink-500/10 text-pink-500";
}

export function platformShortLabel(platform: string): string {
  if (platform === "instagram") return "IG";
  if (platform === "tiktok") return "TT";
  if (platform === "youtube") return "YT";
  if (platform === "x") return "X";
  if (platform === "facebook") return "FB";
  if (platform === "linkedin") return "LI";
  return "?";
}

export function syncStatusColor(status: string): "success" | "danger" | "warning" | "default" {
  switch (status) {
    case "completed": return "success";
    case "failed": return "danger";
    case "syncing": return "warning";
    default: return "default";
  }
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const CHART_COLORS = [
  "#6366F1",
  "#22D3EE",
  "#34D399",
  "#A78BFA",
  "#F472B6",
  "#FBBF24",
  "#FB923C",
  "#F87171",
  "#E1306C",
  "#00F2EA",
  "#833AB4",
  "#14B8A6",
];
