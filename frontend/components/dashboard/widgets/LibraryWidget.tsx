"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { clipsAPI, Clip } from "@/api/clips";
import { WidgetWrapper } from "../WidgetWrapper";

interface LibraryWidgetProps {
  color?: string;
  onColorChange?: (color: string) => void;
}

export function LibraryWidget({ color, onColorChange }: LibraryWidgetProps) {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadClips = async () => {
      if (!selectedTeam?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { clips: savedClips } = await clipsAPI.getSavedClips(selectedTeam.id, 6, 0);
        setClips(savedClips);
      } catch (error) {
        console.error("Failed to load clips:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClips();
  }, [selectedTeam?.id]);

  return (
    <WidgetWrapper
      id="library"
      title="Library"
      icon="solar:video-library-bold"
      color={color}
      onColorChange={onColorChange}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Icon icon="solar:spinner-bold" className="animate-spin text-text-tertiary" width={24} />
        </div>
      ) : clips.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Icon icon="solar:video-library-linear" width={48} className="text-text-tertiary" />
          <p className="text-sm text-text-secondary text-center">No clips yet</p>
          <Button
 size="sm"
 variant="tertiary"
 onPress={() => router.push("/dashboard/create")}
 >
            Create your first clip
          </Button>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-3 gap-2 flex-1">
            {clips.slice(0, 6).map((clip) => (
              <button
                key={clip.id}
                onClick={() => router.push(`/dashboard/clips?clipId=${clip.id}`)}
                className="relative aspect-[9/16] rounded-lg overflow-hidden bg-surface-hover group"
              >
                {clip.clipUrl ? (
                  <img
 src={clip.clipUrl}
 alt={clip.title || "Clip"}
 className="w-full h-full object-cover"
 />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon icon="solar:video-frame-linear" width={20} className="text-text-tertiary" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Icon icon="solar:play-bold" width={24} className="text-white" />
                </div>
              </button>
            ))}
          </div>
          <Button
 size="sm"
 variant="tertiary"
 className="mt-3 w-full"
 onPress={() => router.push("/dashboard/clips")}
 >
            View All
            <Icon icon="solar:arrow-right-linear" width={14} />
</Button>
        </div>
      )}
    </WidgetWrapper>
  );
}
