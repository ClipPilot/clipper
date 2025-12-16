"use client";

import React, { useState } from "react";
import { Card, CardBody, CardFooter, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip } from "@/api/clips";
import { SecureVideoPlayer } from "./SecureVideoPlayer";

interface UnsavedClipCardProps {
  clip: Clip;
  onSave: (clipId: number) => Promise<void>;
  onDelete?: (clipId: number) => void;
  isSaving?: boolean;
}

export const UnsavedClipCard: React.FC<UnsavedClipCardProps> = ({
  clip,
  onSave,
  onDelete,
  isSaving = false,
}) => {
  const [isLocalSaving, setIsLocalSaving] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getScoreClasses = (score?: number) => {
    if (!score && score !== 0) return "text-accent-400 bg-accent-400/10";
    if (score >= 80) return "text-success-600 bg-success-600/10";
    if (score >= 60) return "text-warning-600 bg-warning-600/10";
    return "text-text-tertiary bg-surface-elevated";
  };

  const handleSave = async () => {
    setIsLocalSaving(true);
    try {
      await onSave(clip.id);
    } finally {
      setIsLocalSaving(false);
    }
  };

  const saving = isSaving || isLocalSaving;

  return (
    <Card className="bg-surface-base border border-border-accent overflow-hidden">
      <CardBody className="p-0">
        <div className="aspect-[9/16] max-h-[400px]">
          {clip.clipUrl ? (
            <SecureVideoPlayer
              src={clip.clipUrl}
              poster={clip.sourceVideoUrl}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-dark">
              <Icon
                icon="solar:video-frame-play-vertical-bold-duotone"
                className="text-5xl text-accent-400"
              />
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {clip.title || `Clip #${clip.id}`}
            </h3>
            {clip.clip_score !== undefined && clip.clip_score !== null && (
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getScoreClasses(
                  clip.clip_score
                )}`}
              >
                <Icon icon="solar:star-bold" className="text-xs" />
                <span className="text-xs font-medium">{clip.clip_score}</span>
              </div>
            )}
          </div>

          {clip.message && (
            <p className="text-xs text-text-secondary line-clamp-2 mb-2">
              {clip.message}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <div className="flex items-center gap-1">
              <Icon icon="solar:clock-circle-outline" className="text-sm" />
              <span>{formatDate(clip.created_at)}</span>
            </div>
          </div>
        </div>
      </CardBody>

      <CardFooter className="px-4 py-3 border-t border-border-base flex gap-2">
        <Button
          fullWidth
          color="primary"
          size="sm"
          onPress={handleSave}
          isLoading={saving}
          isDisabled={saving}
          startContent={!saving && <Icon icon="solar:diskette-bold" />}
        >
          {saving ? "Saving..." : "Save Clip"}
        </Button>

        {onDelete && (
          <Button
            size="sm"
            variant="light"
            color="danger"
            isIconOnly
            onPress={() => onDelete(clip.id)}
            isDisabled={saving}
          >
            <Icon icon="solar:trash-bin-outline" className="text-lg" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
