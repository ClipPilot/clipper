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

export function platformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtube: "YouTube",
    x: "X (Twitter)",
    facebook: "Facebook",
    linkedin: "LinkedIn",
  };
  return names[platform] ?? platform;
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

export function detectPlatformFromUrl(input: string): Platform | null {
  const lower = input.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) return "instagram";
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("x.com") || lower.includes("twitter.com")) return "x";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("facebook.com") || lower.includes("fb.com")) return "facebook";
  if (lower.includes("linkedin.com")) return "linkedin";
  return null;
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
