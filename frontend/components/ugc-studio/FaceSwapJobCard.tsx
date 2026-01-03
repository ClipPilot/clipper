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
interface FaceSwapJobCardProps {
  job: FaceSwapJob;
  onClick: () => void;
}

export const FaceSwapJobCard = memo(
  function FaceSwapJobCard({ job, onClick }: FaceSwapJobCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!job.outputUrl || isDownloading) return;

      setIsDownloading(true);
      try {
        const response = await fetch(job.outputUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `face-swap-${job.id}.mp4`;
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
      <Card
        className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-colors cursor-pointer"
        isPressable
        onPress={onClick}
      >
        <CardBody className="p-4">
          <div className="flex gap-4">
            <div className="w-32 h-20 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
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
                    className={`text-2xl ${job.status === "running" ? "animate-spin text-accent-400" : "text-text-tertiary"}`}
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Chip
                    size="sm"
                    color={getStatusColor(job.status)}
                    variant="flat"
                  >
                    {job.status}
                  </Chip>
                  <span className="text-xs text-text-tertiary">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {job.status === "completed" && job.outputUrl && (
                  <Button
                    size="sm"
                    variant="flat"
                    isIconOnly
                    className="bg-accent-400/20 text-accent-400 min-w-8 w-8 h-8"
                    onPress={handleDownload as any}
                    isLoading={isDownloading}
                  >
                    {!isDownloading && (
                      <Icon icon="solar:download-bold" width={16} />
                    )}
                  </Button>
                )}
              </div>
              {job.status === "running" && (
                <div className="space-y-1">
                  <Progress
                    value={job.progress || 0}
                    size="sm"
                    color="primary"
                  />
                  <p className="text-xs text-text-tertiary">
                    {job.progressMessage || "Processing..."}
                  </p>
                </div>
              )}
              {job.status === "failed" && (
                <p className="text-xs text-red-500 truncate">
                  {job.errorMessage || "Processing failed"}
                </p>
              )}
              {job.status === "completed" && (
                <p className="text-xs text-text-secondary">Click to view</p>
              )}
              {job.status === "queued" && (
                <p className="text-xs text-text-tertiary">Queuing Job.</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  },
  (prev, next) =>
    prev.job.id === next.job.id &&
    prev.job.status === next.job.status &&
    prev.job.progress === next.job.progress &&
    prev.job.outputUrl === next.job.outputUrl
);
