export type Platform = "instagram" | "tiktok" | "x" | "youtube" | "facebook";

export function platformIcon(platform: string): string {
  if (platform === "x") return "ri:twitter-x-fill";
  if (platform === "tiktok") return "ri:tiktok-fill";
  if (platform === "youtube") return "ri:youtube-fill";
  if (platform === "facebook") return "ri:facebook-fill";
  return "ri:instagram-fill";
}

export function platformIconColor(platform: string): string {
  if (platform === "tiktok") return "text-cyan-400";
  if (platform === "x") return "text-foreground";
  if (platform === "youtube") return "text-red-500";
  if (platform === "facebook") return "text-blue-500";
  return "text-pink-500";
}

export function platformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtube: "YouTube",
    x: "X (Twitter)",
    facebook: "Facebook",
  };
  return names[platform] ?? platform;
}
