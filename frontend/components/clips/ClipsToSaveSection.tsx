"use client";

import React, { useState } from "react";
import { Card, CardBody, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip, clipsAPI } from "@/api/clips";
import { UnsavedClipCard } from "./UnsavedClipCard";

interface ClipsToSaveSectionProps {
  clips: Clip[];
  teamId: number;
  onClipSaved: (clipId: number) => void;
  onClipRejected?: (clipId: number) => void;
  onClipView?: (clip: Clip) => void;
  onUsageUpdated?: () => void;
}

const getSourceVideoName = (clip: Clip): string => {
  if (clip.input_metadata?.originalFileName) {
    return clip.input_metadata.originalFileName;
  }
  if (clip.raw_video_path) {
    const parts = clip.raw_video_path.split("/");
    const filename = parts[parts.length - 1];
    return filename.replace(/^\d+_/, "");
  }
  return "Unknown video";
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const ClipsToSaveSection: React.FC<ClipsToSaveSectionProps> = ({
  clips,
  teamId,
  onClipSaved,
  onClipRejected,
  onClipView,
  onUsageUpdated,
}) => {
  const [savingClipIds, setSavingClipIds] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isSectionCollapsed, setIsSectionCollapsed] = useState(false);

  const clipsBySourceVideo = clips.reduce(
    (acc, clip) => {
      // Group by source_video_path (thumbnail), raw_video_id, or treat as standalone
      const key =
        clip.source_video_path || clip.raw_video_id || `standalone-${clip.id}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(clip);
      return acc;
    },
    {} as Record<string | number, Clip[]>
  );

  const handleSaveClip = async (clipId: number) => {
    setSavingClipIds((prev) => new Set(prev).add(clipId));

    try {
      await clipsAPI.saveClip(teamId, clipId);
      onClipSaved(clipId);
      onUsageUpdated?.();

      addToast({
        title: "Clip saved",
        description: "The clip has been saved to your library.",
        color: "success",
      });
    } catch (error: any) {
      console.error("Failed to save clip:", error);

      if (error.message?.includes("limit")) {
        addToast({
          title: "Clip limit reached",
          description:
            "You've reached your clip limit. Upgrade your plan to save more clips.",
          color: "warning",
        });
      } else {
        addToast({
          title: "Failed to save clip",
          description: error.message || "Something went wrong",
          color: "danger",
        });
      }
    } finally {
      setSavingClipIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(clipId);
        return newSet;
      });
    }
  };

  if (clips.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <button
        onClick={() => setIsSectionCollapsed(!isSectionCollapsed)}
        className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
      >
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Icon
            icon="solar:gallery-check-bold-duotone"
            className="text-2xl text-warning-500"
          />
          Clips to Save
          <span className="text-sm font-normal text-text-tertiary">
            ({clips.length} clip{clips.length !== 1 ? "s" : ""} waiting to be
            saved)
          </span>
        </h2>
        <Icon
          icon={isSectionCollapsed ? "solar:alt-arrow-down-outline" : "solar:alt-arrow-up-outline"}
          className="text-xl text-text-tertiary"
        />
      </button>

      {!isSectionCollapsed && (
        <>
          <Card className="bg-surface-base border border-warning-500/30 mb-4">
            <CardBody className="p-4 flex items-center gap-3">
              <Icon
                icon="solar:info-circle-bold"
                className="text-xl text-warning-500 flex-shrink-0"
              />
              <p className="text-sm text-text-secondary">
                These clips have a preview watermark. Save the clips you want to
                keep and download. They will be added to your library without the
                watermark. Saving a clip counts toward your usage quota.
              </p>
            </CardBody>
          </Card>

          <div className="space-y-4">
        {Object.entries(clipsBySourceVideo).map(([sourceKey, groupClips]) => {
          const isCollapsed = collapsedGroups.has(sourceKey);
          const firstClip = groupClips[0];
          const videoName = getSourceVideoName(firstClip);
          const videoDate = formatDate(firstClip.created_at);

          const toggleCollapse = () => {
            setCollapsedGroups((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(sourceKey)) {
                newSet.delete(sourceKey);
              } else {
                newSet.add(sourceKey);
              }
              return newSet;
            });
          };

          return (
            <div
              key={sourceKey}
              className="bg-surface-elevated rounded-lg border border-border-base overflow-hidden"
            >
              <button
                onClick={toggleCollapse}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-dark/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    icon="solar:video-library-bold"
                    className="text-xl text-accent-400"
                  />
                  <div className="text-left">
                    <span className="text-sm font-semibold text-text-primary">
                      {groupClips.length} clip{groupClips.length !== 1 ? "s" : ""} from:{" "}
                      <span className="font-normal text-text-secondary">{videoName}</span>
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-text-tertiary mt-0.5">
                      <Icon icon="solar:calendar-outline" className="text-sm" />
                      <span>{videoDate}</span>
                    </div>
                  </div>
                </div>
                <Icon
                  icon={isCollapsed ? "solar:alt-arrow-down-outline" : "solar:alt-arrow-up-outline"}
                  className="text-xl text-text-tertiary"
                />
              </button>

              {!isCollapsed && (
                <div className="p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...groupClips]
                      .sort((a, b) => (b.clip_score ?? 0) - (a.clip_score ?? 0))
                      .map((clip) => (
                        <UnsavedClipCard
                          key={clip.id}
                          clip={clip}
                          onSave={handleSaveClip}
                          onReject={onClipRejected}
                          onView={onClipView ? () => onClipView(clip) : undefined}
                          isSaving={savingClipIds.has(clip.id)}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
          </div>
        </>
      )}
    </div>
  );
};
