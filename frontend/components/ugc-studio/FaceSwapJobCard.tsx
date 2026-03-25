"use client";

import { memo, useRef, useState } from "react";
import { Button, Chip, ProgressBar, Tooltip } from "@heroui/react";
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
      try { await onDelete(job.id); } finally { setIsDeleting(false); }
    };

    const handleDownload = () => {
      if (!job.outputUrl) return;
      download({ url: job.outputUrl, filename: `face-swap-${job.id}.mp4`, isFaceSwap: true });
    };

    const handleEdit = () => {
      if (job.clipId && onEdit) onEdit(job.clipId);
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
      } finally { setIsSharing(false); }
    };

    const isCompleted = job.status === "completed";
    const isProcessing = job.status === "running" || job.status === "uploading" || job.status === "pending_upload" || job.status === "queued";
    const hasClip = !!job.clipId;

    if (isProcessing || job.status === "failed") {
      return (
        <div
          onClick={onClick}
          className="cursor-pointer h-full bg-surface-base border border-border-base rounded-xl hover:border-accent-400/30 transition-all overflow-hidden"
        >
          <div className="p-4 flex flex-col h-full min-h-[140px]">
            <div className="flex items-start gap-3 flex-1">
              <Icon
                icon={getStatusIcon(job.status)}
                className={`text-3xl flex-shrink-0 ${
                  job.status === "running" ? "animate-spin text-accent-400"
                    : job.status === "uploading" || job.status === "pending_upload" ? "animate-pulse text-accent-400"
                    : job.status === "failed" ? "text-red-500"
                    : "text-yellow-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-text-primary truncate">{job.title || "Face Swap"}</h3>
                  <Chip size="sm" color={getStatusColor(job.status)} variant="tertiary" className="text-[10px] h-5 flex-shrink-0">
                    {job.status === "pending_upload" ? "uploading" : job.status}
                  </Chip>
                </div>
                <span className="text-xs text-text-tertiary">{new Date(job.createdAt).toLocaleDateString()}</span>
                <div className="mt-2">
                  {job.status === "running" && (
                    <div className="space-y-1">
                      <ProgressBar value={job.progress || 0}>
                        <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
                      </ProgressBar>
                      <p className="text-xs text-text-tertiary truncate">{job.progressMessage || "Processing..."} ({job.progress || 0}%)</p>
                    </div>
                  )}
                  {job.status === "queued" && <p className="text-xs text-text-tertiary">Waiting in queue...</p>}
                  {(job.status === "uploading" || job.status === "pending_upload") && (
                    <p className="text-xs text-accent-400">{job.progressMessage || "Uploading files..."}</p>
                  )}
                  {job.status === "failed" && (
                    <p className="text-xs text-red-500 line-clamp-2">{job.errorMessage || "Processing failed"}</p>
                  )}
                </div>
              </div>
            </div>
            {onDelete && (
              <div className="flex justify-end mt-3" onClick={(e) => e.stopPropagation()}>
                <Tooltip content="Delete">
                  <Button size="sm" variant="tertiary" isIconOnly className="text-red-500 min-w-7 w-7 h-7" onPress={handleDelete} isPending={isDeleting}>
                    {!isDeleting && <Icon icon="solar:trash-bin-trash-bold" className="text-sm" />}
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={onClick}
        className="group cursor-pointer h-full bg-surface-base border border-border-base rounded-xl hover:border-accent-400/30 hover:shadow-lg hover:shadow-accent-400/5 transition-all overflow-hidden"
      >
        <div className="relative aspect-[9/16] bg-surface-dark">
          <video
            ref={videoRef}
            src={job.outputUrl!}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
            onMouseEnter={() => videoRef.current?.play()}
            onMouseLeave={() => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } }}
          />
          <div className="absolute top-2 left-2">
            <Chip size="sm" color={getStatusColor(job.status)} variant="tertiary" className="text-[10px] h-5 backdrop-blur-sm">
              {job.status}
            </Chip>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-2">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
              <h3 className="text-sm font-medium text-white truncate">{job.title || "Untitled Swap"}</h3>
              <span className="text-xs text-white/60">{new Date(job.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {hasClip && onShare && (
              <Tooltip content={showCopied ? "Copied!" : (job.shareToken ? "Copy link" : "Share")} placement="left">
                <Button size="sm" variant="tertiary" isIconOnly className="bg-black/40 backdrop-blur-sm text-white/80 hover:text-white min-w-8 w-8 h-8 rounded-lg" onPress={handleShare} isPending={isSharing}>
                  {!isSharing && <Icon icon={job.shareToken ? "solar:link-bold" : "solar:share-bold"} className="text-sm" />}
                </Button>
              </Tooltip>
            )}
            {hasClip && onEdit && (
              <Tooltip content="Edit" placement="left">
                <Button size="sm" variant="tertiary" isIconOnly className="bg-black/40 backdrop-blur-sm text-white/80 hover:text-white min-w-8 w-8 h-8 rounded-lg" onPress={handleEdit}>
                  <Icon icon="solar:pen-bold" className="text-sm" />
                </Button>
              </Tooltip>
            )}
            {job.outputUrl && (
              <Tooltip content="Download" placement="left">
                <Button size="sm" variant="tertiary" isIconOnly className="bg-black/40 backdrop-blur-sm text-white/80 hover:text-white min-w-8 w-8 h-8 rounded-lg" onPress={handleDownload} isPending={isDownloading}>
                  {!isDownloading && <Icon icon="solar:download-bold" className="text-sm" />}
                </Button>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip content="Delete" placement="left">
                <Button size="sm" variant="tertiary" isIconOnly className="bg-black/40 backdrop-blur-sm text-red-400/80 hover:text-red-400 min-w-8 w-8 h-8 rounded-lg" onPress={handleDelete} isPending={isDeleting}>
                  {!isDeleting && <Icon icon="solar:trash-bin-trash-bold" className="text-sm" />}
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
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
