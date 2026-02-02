"use client";

import { memo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Progress,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { FaceSwapJob, getStatusColor, getStatusIcon } from "./types";
import { useDownloadVideo } from "@/hooks/useDownloadVideo";

interface FaceSwapJobCardProps {
  job: FaceSwapJob;
  onClick: () => void;
  onDelete?: (jobId: string) => void;
  onEdit?: (clipId: number) => void;
  onShare?: (clipId: number) => Promise<string>;
}

export const FaceSwapJobCard = memo(
  function FaceSwapJobCard({ job, onClick, onDelete, onEdit, onShare }: FaceSwapJobCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [showCopied, setShowCopied] = useState(false);
    const { isDownloading, download } = useDownloadVideo();

    const handleDelete = async () => {
      if (isDeleting || !onDelete) return;
      setIsDeleting(true);
      try {
        await onDelete(job.id);
      } finally {
        setIsDeleting(false);
      }
    };

    const handleDownload = () => {
      if (!job.outputUrl) return;
      download({
        url: job.outputUrl,
        filename: `face-swap-${job.id}.mp4`,
        isFaceSwap: true,
      });
    };

    const handleEdit = () => {
      if (job.clipId && onEdit) {
        onEdit(job.clipId);
      }
    };

    const handleShare = async () => {
      if (!job.clipId || !onShare || isSharing) return;

      if (job.shareToken) {
        const url = `${window.location.origin}/shared/${job.shareToken}`;
        await navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
        return;
      }

      setIsSharing(true);
      try {
        const token = await onShare(job.clipId);
        const url = `${window.location.origin}/shared/${token}`;
        await navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      } finally {
        setIsSharing(false);
      }
    };

    const isCompleted = job.status === "completed";
    const hasClip = !!job.clipId;

    return (
      <div onClick={onClick} className="cursor-pointer h-full">
        <Card className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-colors overflow-hidden h-full">
          <CardBody className="p-0">
            {/* Stacked layout on mobile, horizontal on sm+ */}
            <div className="flex flex-col sm:flex-row">
              {/* Thumbnail */}
              <div className="w-full sm:w-28 md:w-32 h-24 sm:h-auto sm:min-h-[100px] bg-surface-elevated flex-shrink-0 relative">
                {isCompleted && job.outputUrl ? (
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
                      className={`text-2xl sm:text-3xl ${
                        job.status === "running"
                          ? "animate-spin text-accent-400"
                          : (job.status === "uploading" || job.status === "pending_upload")
                            ? "animate-pulse text-accent-400"
                            : "text-text-tertiary"
                      }`}
                    />
                  </div>
                )}
                {/* Status badge overlay on thumbnail */}
                <div className="absolute top-2 left-2">
                  <Chip
                    size="sm"
                    color={getStatusColor(job.status)}
                    variant="flat"
                    className="text-[10px] h-5 backdrop-blur-sm"
                  >
                    {job.status}
                  </Chip>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-3 flex flex-col min-w-0">
                {/* Title & Date */}
                <div className="mb-2">
                  <h3 className="text-sm font-medium text-text-primary truncate">
                    {job.title || "Untitled Swap"}
                  </h3>
                  <span className="text-xs text-text-tertiary">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Status messages */}
                <div className="flex-1 mb-2">
                  {job.status === "running" && (
                    <div className="space-y-1">
                      <Progress value={job.progress || 0} size="sm" color="primary" />
                      <p className="text-xs text-text-tertiary truncate">
                        {job.progressMessage || "Processing..."}
                      </p>
                    </div>
                  )}
                  {job.status === "failed" && (
                    <p className="text-xs text-red-500 line-clamp-2">
                      {job.errorMessage || "Processing failed"}
                    </p>
                  )}
                  {isCompleted && (
                    <p className="text-xs text-text-secondary">Click to view details</p>
                  )}
                  {job.status === "queued" && (
                    <p className="text-xs text-text-tertiary">Waiting in queue...</p>
                  )}
                  {(job.status === "uploading" || job.status === "pending_upload") && (
                    <p className="text-xs text-accent-400">
                      {job.progressMessage || "Uploading files..."}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div
                  className="flex items-center gap-1 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isCompleted && hasClip && onShare && (
                    <Tooltip content={showCopied ? "Copied!" : (job.shareToken ? "Copy link" : "Share")}>
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        className="bg-blue-500/20 text-blue-500 min-w-7 w-7 h-7"
                        onPress={handleShare}
                        isLoading={isSharing}
                      >
                        {!isSharing && (
                          <Icon
                            icon={job.shareToken ? "solar:link-bold" : "solar:share-bold"}
                            className="text-sm"
                          />
                        )}
                      </Button>
                    </Tooltip>
                  )}
                  {isCompleted && hasClip && onEdit && (
                    <Tooltip content="Edit">
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        className="bg-purple-500/20 text-purple-500 min-w-7 w-7 h-7"
                        onPress={handleEdit}
                      >
                        <Icon icon="solar:pen-bold" className="text-sm" />
                      </Button>
                    </Tooltip>
                  )}
                  {isCompleted && job.outputUrl && (
                    <Tooltip content="Download">
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        className="bg-accent-400/20 text-accent-400 min-w-7 w-7 h-7"
                        onPress={handleDownload}
                        isLoading={isDownloading}
                      >
                        {!isDownloading && (
                          <Icon icon="solar:download-bold" className="text-sm" />
                        )}
                      </Button>
                    </Tooltip>
                  )}
                  {onDelete && (
                    <Tooltip content="Delete">
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        className="bg-red-500/20 text-red-500 min-w-7 w-7 h-7"
                        onPress={handleDelete}
                        isLoading={isDeleting}
                      >
                        {!isDeleting && (
                          <Icon icon="solar:trash-bin-trash-bold" className="text-sm" />
                        )}
                      </Button>
                    </Tooltip>
                  )}
                </div>
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
    prev.job.shareToken === next.job.shareToken &&
    prev.onDelete === next.onDelete &&
    prev.onEdit === next.onEdit &&
    prev.onShare === next.onShare
);
