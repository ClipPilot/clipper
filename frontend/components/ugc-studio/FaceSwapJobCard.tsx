"use client";

import { memo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Progress,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { FaceSwapJob, getStatusColor, getStatusIcon } from "./types";
import { faceSwapAPI } from "@/api/ugc/faceSwap";

interface FaceSwapJobCardProps {
  job: FaceSwapJob;
  onClick: () => void;
  onDelete?: (jobId: string) => void;
}

export const FaceSwapJobCard = memo(
  function FaceSwapJobCard({ job, onClick, onDelete }: FaceSwapJobCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
      if (isDeleting || !onDelete) return;

      setIsDeleting(true);
      try {
        await onDelete(job.id);
      } finally {
        setIsDeleting(false);
      }
    };

    const handleDownload = async () => {
      if (!job.outputUrl || isDownloading) return;

      setIsDownloading(true);
      addToast({ title: "Preparing your video for download...", color: "primary" });
      try {
        const filename = `face-swap-${job.id}.mp4`;
        const blob = await faceSwapAPI.downloadVideo(job.outputUrl, filename);
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error("Failed to download video:", error);
        addToast({
          title: "Download failed",
          description: "Failed to download the video. Please try again.",
          color: "danger",
        });
      } finally {
        setIsDownloading(false);
      }
    };

    return (
      <div onClick={onClick} className="cursor-pointer">
        <Card className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-colors overflow-hidden">
          <CardBody className="p-2 sm:p-3">
          <div className="flex gap-2 sm:gap-3">
            <div className="w-16 h-12 sm:w-20 sm:h-14 md:w-24 md:h-16 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
              {job.status === "completed" && job.outputUrl ? (
                <video
                  ref={videoRef}
                  src={job.outputUrl}
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
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon
                    icon={getStatusIcon(job.status)}
                    className={`text-lg sm:text-xl ${job.status === "running" ? "animate-spin text-accent-400" : (job.status === "uploading" || job.status === "pending_upload") ? "animate-pulse text-accent-400" : "text-text-tertiary"}`}
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-start justify-between gap-1 sm:gap-2 mb-1 sm:mb-1.5">
                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                  {job.title && (
                    <span className="text-xs sm:text-sm font-medium text-text-primary truncate">
                      {job.title}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Chip
                      size="sm"
                      color={getStatusColor(job.status)}
                      variant="flat"
                      className="text-[9px] sm:text-[10px] h-4 sm:h-5"
                    >
                      {job.status}
                    </Chip>
                    <span className="text-[9px] sm:text-[10px] md:text-xs text-text-tertiary truncate">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  {job.status === "completed" && job.outputUrl && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        className="bg-accent-400/20 text-accent-400 min-w-6 w-6 h-6 sm:min-w-7 sm:w-7 sm:h-7"
                        onPress={handleDownload}
                        isLoading={isDownloading}
                      >
                        {!isDownloading && (
                          <Icon icon="solar:download-bold" className="text-xs sm:text-sm" />
                        )}
                      </Button>
                    </div>
                  )}
                  {onDelete && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        className="bg-red-500/20 text-red-500 min-w-6 w-6 h-6 sm:min-w-7 sm:w-7 sm:h-7"
                        onPress={handleDelete}
                        isLoading={isDeleting}
                      >
                        {!isDeleting && (
                          <Icon icon="solar:trash-bin-trash-bold" className="text-xs sm:text-sm" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {job.status === "running" && (
                <div className="space-y-0.5 sm:space-y-1">
                  <Progress
                    value={job.progress || 0}
                    size="sm"
                    color="primary"
                  />
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-text-tertiary truncate">
                    {job.progressMessage || "Processing..."}
                  </p>
                </div>
              )}
              {job.status === "failed" && (
                <p className="text-[9px] sm:text-[10px] md:text-xs text-red-500 truncate">
                  {job.errorMessage || "Processing failed"}
                </p>
              )}
              {job.status === "completed" && (
                <p className="text-[9px] sm:text-[10px] md:text-xs text-text-secondary">Click to view</p>
              )}
              {job.status === "queued" && (
                <p className="text-[9px] sm:text-[10px] md:text-xs text-text-tertiary">Queuing Job.</p>
              )}
              {(job.status === "uploading" || job.status === "pending_upload") && (
                <p className="text-[9px] sm:text-[10px] md:text-xs text-accent-400">
                  {job.progressMessage || "Uploading files..."}
                </p>
              )}
            </div>
          </div>
        </CardBody>
        </Card>
      </div>
    );
  },
  (prev, next) =>
    prev.job.id === next.job.id &&
    prev.job.status === next.job.status &&
    prev.job.progress === next.job.progress &&
    prev.job.outputUrl === next.job.outputUrl &&
    prev.job.clipId === next.job.clipId &&
    prev.job.title === next.job.title &&
    prev.onDelete === next.onDelete
);
