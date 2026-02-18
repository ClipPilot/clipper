"use client";

import React, { useRef, useEffect, useState } from "react";
import { Card, CardBody, Progress, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Clip {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
  rawVideoUrl?: string;
  saved?: boolean;
  error_message?: string;
}

interface PendingClipsSectionProps {
  clips: Clip[];
  onClipClick: (clip: Clip) => void;
  onCancel?: (clipId: number) => void;
}

function VideoThumbnail({ videoUrl, isEdit }: { videoUrl: string; isEdit?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 1; // Seek to 1 second for thumbnail
    }
  }, [videoUrl]);

  return (
    <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={videoUrl}
        className={`w-full h-full object-contain transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setIsLoaded(true)}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-warning-400/30 border-t-warning-400 rounded-full animate-spin" />
        </div>
      )}
      {/* Processing overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 flex flex-col items-center justify-center">
        {/* Animated processing indicator */}
        <div className="relative mb-4">
          {/* Outer ring */}
          <div className={`w-16 h-16 rounded-full border-4 ${isEdit ? "border-primary-500/20" : "border-warning-500/20"} animate-pulse`} />
          {/* Spinning ring */}
          <div className={`absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent ${isEdit ? "border-t-primary-400" : "border-t-warning-400"} animate-spin`} />
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon
              icon={isEdit ? "solar:pen-bold" : "solar:video-frame-play-horizontal-bold"}
              className={`text-2xl ${isEdit ? "text-primary-400" : "text-warning-400"}`}
            />
          </div>
        </div>
        <span className="text-sm font-medium text-white">{isEdit ? "Applying Changes" : "Processing"}</span>
        {/* Animated progress bar */}
        <div className="w-24 mt-2">
          <Progress
            size="sm"
            isIndeterminate
            color={isEdit ? "primary" : "warning"}
            classNames={{
              track: "bg-white/20",
              indicator: isEdit ? "bg-gradient-to-r from-primary-400 to-primary-500" : "bg-gradient-to-r from-warning-400 to-warning-500",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PlaceholderThumbnail({ isEdit }: { isEdit?: boolean }) {
  return (
    <div className="relative w-full aspect-[9/16] bg-gradient-to-br from-surface-elevated to-surface-base rounded-lg overflow-hidden">
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      {/* Processing overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Animated processing indicator */}
        <div className="relative mb-4">
          {/* Outer ring */}
          <div className={`w-16 h-16 rounded-full border-4 ${isEdit ? "border-primary-500/20" : "border-warning-500/20"} animate-pulse`} />
          {/* Spinning ring */}
          <div className={`absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent ${isEdit ? "border-t-primary-400" : "border-t-warning-400"} animate-spin`} />
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon
              icon={isEdit ? "solar:pen-bold" : "solar:video-frame-play-horizontal-bold"}
              className={`text-2xl ${isEdit ? "text-primary-400" : "text-warning-400"}`}
            />
          </div>
        </div>
        <span className="text-sm font-medium text-text-primary">{isEdit ? "Applying Changes" : "Processing"}</span>
        {/* Animated progress bar */}
        <div className="w-24 mt-2">
          <Progress
            size="sm"
            isIndeterminate
            color={isEdit ? "primary" : "warning"}
            classNames={{
              track: "bg-surface-base",
              indicator: isEdit ? "bg-gradient-to-r from-primary-400 to-primary-500" : "bg-gradient-to-r from-warning-400 to-warning-500",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PendingClipsSection({
  clips,
  onClipClick,
  onCancel,
}: PendingClipsSectionProps) {
  const [cancellingIds, setCancellingIds] = useState<Set<number>>(new Set());

  const handleCancel = async (clipId: number) => {
    if (!onCancel) return;

    setCancellingIds(prev => new Set(prev).add(clipId));
    try {
      await onCancel(clipId);
    } finally {
      setCancellingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(clipId);
        return newSet;
      });
    }
  };
  if (clips.length === 0) return null;

  const failedClips = clips.filter((c) => c.status === "failed");
  const pendingOnly = clips.filter((c) => c.status !== "failed");
  const newClips = pendingOnly.filter((c) => !c.saved);
  const editingClips = pendingOnly.filter((c) => c.saved);

  return (
    <div className="mb-8 space-y-6">
      {/* Failed clips */}
      {failedClips.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Icon
              icon="solar:danger-circle-bold-duotone"
              className="text-2xl text-danger-400"
            />
            Failed ({failedClips.length})
          </h2>
          <p className="text-sm text-text-tertiary mb-4">
            These clips failed during processing. You can dismiss them or try again.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {failedClips.map((clip) => (
              <Card
                key={clip.id}
                className="bg-surface-base border border-danger-500/30"
              >
                <CardBody className="p-3">
                  <div className="relative w-full aspect-[9/16] bg-gradient-to-br from-danger-500/10 to-surface-base rounded-lg overflow-hidden flex flex-col items-center justify-center">
                    <div className="relative mb-3">
                      <div className="w-14 h-14 rounded-full border-4 border-danger-500/20 flex items-center justify-center">
                        <Icon
                          icon="solar:close-circle-bold"
                          className="text-3xl text-danger-400"
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-danger-400">Failed</span>
                    {clip.error_message && (
                      <p className="text-xs text-text-tertiary mt-2 px-3 text-center line-clamp-3">
                        {clip.error_message}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-text-tertiary truncate mr-1">
                      {new Date(clip.updated_at).toLocaleTimeString()}
                    </p>
                    {onCancel && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        isLoading={cancellingIds.has(clip.id)}
                        onPress={() => handleCancel(clip.id)}
                        className="min-w-fit h-6 text-xs px-2"
                      >
                        {!cancellingIds.has(clip.id) && "Dismiss"}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* New clips being processed */}
      {newClips.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Icon
              icon="solar:clock-circle-bold-duotone"
              className="text-2xl text-warning-400"
            />
            Processing ({newClips.length})
          </h2>
          <p className="text-sm text-text-tertiary mb-4">
            Processing may take anywhere from 5 to 30 minutes; we&apos;ll email you when
            it&apos;s complete.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {newClips.map((clip) => (
              <Card
                key={clip.id}
                isPressable
                onPress={() => onClipClick(clip)}
                className="bg-surface-base border border-warning-500/30 hover:border-warning-500/50 hover:scale-[1.02] transition-all duration-200"
              >
                <CardBody className="p-2">
                  {clip.rawVideoUrl ? (
                    <VideoThumbnail videoUrl={clip.rawVideoUrl} isEdit={false} />
                  ) : (
                    <PlaceholderThumbnail isEdit={false} />
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-text-tertiary">
                      Started {new Date(clip.created_at).toLocaleTimeString()}
                    </p>
                    {onCancel && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        isIconOnly
                        isLoading={cancellingIds.has(clip.id)}
                        onPress={() => handleCancel(clip.id)}
                        className="min-w-6 w-6 h-6"
                        title="Cancel processing"
                      >
                        {!cancellingIds.has(clip.id) && (
                          <Icon icon="solar:close-circle-bold" className="text-sm" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edited clips being processed */}
      {editingClips.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Icon
              icon="solar:pen-bold-duotone"
              className="text-2xl text-primary-400"
            />
            Applying Changes ({editingClips.length})
          </h2>
          <p className="text-sm text-text-tertiary mb-4">
            Your edits are being applied. This usually takes 1-2 minutes.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {editingClips.map((clip) => (
              <Card
                key={clip.id}
                isPressable
                onPress={() => onClipClick(clip)}
                className="bg-surface-base border border-primary-500/30 hover:border-primary-500/50 hover:scale-[1.02] transition-all duration-200"
              >
                <CardBody className="p-2">
                  {clip.rawVideoUrl ? (
                    <VideoThumbnail videoUrl={clip.rawVideoUrl} isEdit={true} />
                  ) : (
                    <PlaceholderThumbnail isEdit={true} />
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-text-tertiary">
                      Editing since {new Date(clip.updated_at).toLocaleTimeString()}
                    </p>
                    {onCancel && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        isIconOnly
                        isLoading={cancellingIds.has(clip.id)}
                        onPress={() => handleCancel(clip.id)}
                        className="min-w-6 w-6 h-6"
                        title="Cancel editing"
                      >
                        {!cancellingIds.has(clip.id) && (
                          <Icon icon="solar:close-circle-bold" className="text-sm" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
