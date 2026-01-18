import { Clip } from "@/api/clips";
import { Command } from "./types";

export function createRecentClipsCommands(
  clips: Clip[],
  navigate: (path: string) => void,
  maxItems = 5
): Command[] {
  return clips.slice(0, maxItems).map((clip) => ({
    id: `recent-${clip.id}`,
    label: clip.title || `Clip #${clip.id}`,
    icon: "solar:play-circle-bold-duotone",
    group: "recent" as const,
    keywords: ["recent", clip.title?.toLowerCase() || ""],
    action: () => navigate(`/dashboard/clips?clip=${clip.id}`),
  }));
}
