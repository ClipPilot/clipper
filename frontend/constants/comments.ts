import { CommentPlatform } from "@/store/videoEditor";

export const PLATFORMS: { id: CommentPlatform; label: string; icon: string }[] = [
  { id: "tiktok", label: "TikTok", icon: "simple-icons:tiktok" },
  { id: "youtube", label: "YouTube", icon: "simple-icons:youtube" },
  { id: "instagram", label: "Instagram", icon: "simple-icons:instagram" },
];

// Preset dimensions matching Puppeteer output (CSS pixels)
export const COMMENT_DIMENSIONS: Record<CommentPlatform, { width: number; height: number }> = {
  tiktok: { width: 800, height: 160 },
  youtube: { width: 800, height: 180 },
  instagram: { width: 800, height: 140 },
};

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok Comment",
  youtube: "YouTube Comment",
  instagram: "Instagram Comment",
};

export const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "simple-icons:tiktok",
  youtube: "simple-icons:youtube",
  instagram: "simple-icons:instagram",
};