"use client";

import { memo, useRef } from "react";
import { Card, Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { UGCVideoJob } from "@/api/ugc/video";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

interface VideoJobCardProps {
  job: UGCVideoJob;
  onClick: () => void;
}

function getStatusColor(status: UGCVideoJob["status"], isFinalized: boolean) {
  switch (status) {
    case "completed":
      return isFinalized ? "success" : "warning";
    case "generating":
      return "primary";
    case "queued":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "default";
  }
}

function getStatusLabel(status: UGCVideoJob["status"], isFinalized: boolean) {
  switch (status) {
    case "completed":
      return isFinalized ? "Finalized" : "Ready to Finalize";
    case "generating":
      return "Generating";
    case "queued":
      return "Queued";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `0:${secs.toString().padStart(2, "0")}`;
}

export const VideoJobCard = memo(
  function VideoJobCard({ job, onClick }: VideoJobCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    const isProcessing = job.status === "generating" || job.status === "queued";
    const isFinalized = job.status === "completed" && !!job.clipId;

    return (
      <Card
        className="bg-surface-base border border-border-base hover:border-accent-400/50 hover:shadow-lg hover:shadow-accent-400/10 transition-all cursor-pointer overflow-hidden group"
        isPressable
        onPress={onClick}
      >
        {/* Vertical video thumbnail - 9:16 aspect ratio */}
        <div className="aspect-[9/16] bg-surface-elevated overflow-hidden relative">
          {job.status === "completed" && job.finalVideoUrl ? (
            <video
              ref={videoRef}
              src={job.finalVideoUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
              onMouseEnter={() => videoRef.current?.play()}
              onMouseLeave={() => {
                if (videoRef.current) {
                  videoRef.current.pause();
                  videoRef.current.currentTime = 0;
                }
              }}
            />
          ) : job.thumbnailUrl ? (
            <img
              src={job.thumbnailUrl}
              alt={job.scriptTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-elevated to-surface-dark">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-accent-400/20 flex items-center justify-center">
                    <Icon
                      icon="solar:refresh-circle-bold-duotone"
                      className="text-4xl animate-spin text-accent-400"
                    />
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {job.status === "queued" ? "In Queue" : `${job.progress || 0}%`}
                  </span>
                </div>
              ) : (
                <Icon
                  icon="solar:video-frame-play-bold-duotone"
                  className="text-5xl text-text-tertiary/50"
                />
              )}
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

          {/* Status chip - top left */}
          <div className="absolute top-2 left-2">
            <Chip
              size="sm"
              color={getStatusColor(job.status, isFinalized)}
              variant="flat"
              className="text-[10px] h-5 backdrop-blur-sm"
            >
              {getStatusLabel(job.status, isFinalized)}
            </Chip>
          </div>

          {/* Duration badge - top right */}
          {job.status === "completed" && job.totalDurationSeconds && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-md font-medium">
              {formatDuration(job.totalDurationSeconds)}
            </div>
          )}

          {/* Progress bar overlay for generating */}
          {job.status === "generating" && (
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <Progress
                value={job.progress || 0}
                size="sm"
                color="primary"
                classNames={{
                  track: "bg-white/20",
                  indicator: "bg-accent-400",
                }}
              />
              <p className="text-[10px] text-white/80 mt-1 truncate text-center">
                {job.progressMessage || "Processing..."}
              </p>
            </div>
          )}

          {/* Play button overlay on hover for completed */}
          {job.status === "completed" && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Icon icon="solar:play-bold" className="text-2xl text-white ml-1" />
              </div>
            </div>
          )}

          {/* Bottom content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            {/* Title */}
            <h3 className="text-sm font-semibold text-white truncate mb-1">
              {job.scriptTitle}
            </h3>
            {/* Time */}
            <span className="text-[11px] text-white/60">
              {formatRelativeTime(new Date(job.createdAt))}
            </span>

            {/* Failed error */}
            {job.status === "failed" && (
              <p className="text-[11px] text-red-400 truncate mt-1">
                {job.errorMessage || "Generation failed"}
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  },
  (prev, next) =>
    prev.job.id === next.job.id &&
    prev.job.status === next.job.status &&
    prev.job.progress === next.job.progress &&
    prev.job.finalVideoUrl === next.job.finalVideoUrl &&
    prev.job.clipId === next.job.clipId
);
