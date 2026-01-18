import { Clip } from "@/api/clips";
import { Command } from "./types";

export function createSearchResultCommands(
  clips: Clip[],
  navigate: (path: string) => void
): Command[] {
  return clips.map((clip) => ({
    id: `search-${clip.id}`,
    label: clip.title || `Clip #${clip.id}`,
    icon: "solar:play-circle-bold-duotone",
    group: "search" as const,
    keywords: [clip.title?.toLowerCase() || ""],
    action: () => navigate(`/dashboard/clips?clip=${clip.id}`),
  }));
}
