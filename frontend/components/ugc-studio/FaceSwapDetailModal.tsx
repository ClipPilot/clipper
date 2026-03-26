"use client";

import { useState, useEffect } from "react";
import { Button,
  Chip,
  Input,
  Modal,
  ProgressBar,
  toast } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  FaceSwapJob,
  formatDuration,
  getStatusColor,
  getStatusIcon,
} from "./types";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import { useDownloadVideo } from "@/hooks/useDownloadVideo";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface FaceSwapDetailModalProps {
  job: FaceSwapJob | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (jobId: string) => void;
  onTitleUpdate?: (jobId: string, title: string) => void;
  onEdit?: (clipId: number) => void;
  onShare?: (clipId: number) => Promise<string>;
}

export function FaceSwapDetailModal({
  job,
  isOpen,
  onClose,
  onDelete,
  onTitleUpdate,
  onEdit,
  onShare,
}: FaceSwapDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const { isDownloading, download } = useDownloadVideo();
  const [showSegments, setShowSegments] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  useEffect(() => {
    if (job) {
      setEditTitle(job.title || "");
      setShareToken(job.shareToken || null);
    }
  }, [job]);

  const handleSaveTitle = async () => {
    if (!job || isSavingTitle) return;

    setIsSavingTitle(true);
    try {
      await faceSwapAPI.updateJobTitle(job.id, editTitle);
      setIsEditingTitle(false);
      onTitleUpdate?.(job.id, editTitle);
      toast.success("Title updated");
    } catch (error) {
      console.error("Failed to update title:", error);
      toast.danger("Failed to update title", { description: error instanceof Error ? error.message : "Please try again" });
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleDelete = async () => {
    if (!job || isDeleting || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(job.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = () => {
    if (!job?.outputUrl) return;
    download({
      url: job.outputUrl,
      filename: `face-swap-${job.id}.mp4`,
      isFaceSwap: true,
    });
  };

  const handleEdit = () => {
    if (job?.clipId && onEdit) {
      onEdit(job.clipId);
    }
  };

  const handleShare = async () => {
    if (!job?.clipId || !onShare || isSharing) return;

    if (shareToken) {
      const url = `${window.location.origin}/shared/${shareToken}`;
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
      return;
    }

    setIsSharing(true);
    try {
      const token = await onShare(job.clipId);
      setShareToken(token);
      const url = `${window.location.origin}/shared/${token}`;
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } finally {
      setIsSharing(false);
    }
  };

  const getShareUrl = () => {
    if (!shareToken) return "";
    return `${window.location.origin}/shared/${shareToken}`;
  };

  const handleClose = () => {
    setShowSegments(false);
    setActiveSegmentIndex(null);
    onClose();
  };

  if (!job) return null;

  const isCompleted = job.status === "completed";
  const hasClip = !!job.clipId;

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}><Modal.Container scroll="inside"><Modal.Dialog className="sm:max-w-4xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon
              icon="solar:mask-happly-bold-duotone"
              className="text-accent-400 text-xl sm:text-2xl"
            />
            <span className="text-base sm:text-lg">Character Swap Details</span>
          </div>
        </Modal.Header>

        <Modal.Body className="py-4 sm:py-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Video Player */}
            {isCompleted && job.outputUrl ? (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden bg-black aspect-video max-h-[50vh] sm:max-h-[60vh]">
                  <video
                    src={
                      activeSegmentIndex !== null && job.spliceSegments?.[activeSegmentIndex]
                        ? job.spliceSegments[activeSegmentIndex].url
                        : job.outputUrl
                    }
                    className="w-full h-full object-contain"
                    controls
                    controlsList="nodownload noremoteplayback"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    playsInline
                    key={activeSegmentIndex !== null ? `segment-${activeSegmentIndex}` : "main"}
                  />
                </div>

                {/* Segments */}
                {job.spliceSegments && job.spliceSegments.length > 0 && (
                  <div className="space-y-2">
                    <Button
 variant="tertiary"
 size="sm"
 onPress={() => {
 setShowSegments(!showSegments);
 if (!showSegments) setActiveSegmentIndex(null);
 }}
 className="w-full"
 >
                      <Icon
                          icon={showSegments ? "solar:alt-arrow-up-bold" : "solar:layers-bold"}
                          width={16}
                        />
                      {showSegments
                        ? "Hide Segments"
                        : `View ${job.spliceSegments.length} Individual Segments`}
                    </Button>
                    {showSegments && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        <div
                          onClick={() => setActiveSegmentIndex(null)}
                          className={`p-2 sm:p-3 rounded-lg border transition-colors text-left cursor-pointer ${
                            activeSegmentIndex === null
                              ? "border-accent-400 bg-accent-400/10"
                              : "border-border-base hover:border-accent-400/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="solar:video-frame-bold" className="text-accent-400" width={14} />
                            <span className="text-xs font-medium text-text-primary">Final Video</span>
                          </div>
                          <p className="text-[10px] text-text-tertiary">Complete merged output</p>
                        </div>
                        {job.spliceSegments.map((segment, idx) => (
                          <div
                            key={idx}
                            onClick={() => setActiveSegmentIndex(idx)}
                            className={`p-2 sm:p-3 rounded-lg border transition-colors text-left cursor-pointer ${
                              activeSegmentIndex === idx
                                ? "border-accent-400 bg-accent-400/10"
                                : "border-border-base hover:border-accent-400/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon
                                icon={segment.type === "processed" ? "solar:mask-happly-bold" : "solar:videocamera-bold"}
                                className={segment.type === "processed" ? "text-green-400" : "text-blue-400"}
                                width={14}
                              />
                              <span className="text-xs font-medium text-text-primary">
                                Segment {idx + 1}
                              </span>
                            </div>
                            <Chip
 size="sm"
 variant="tertiary"
 color={segment.type === "processed" ? "success" : "primary"}
 className="text-[10px] h-4 mb-1"
 >
                              {segment.type === "processed" ? "Swapped" : "Original"}
                            </Chip>
                            <p className="text-[10px] text-text-tertiary">
                              {formatTime(segment.start)} - {formatTime(segment.end)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Processing/Status View */
              <div className="rounded-xl bg-surface-elevated aspect-video max-h-[40vh] flex items-center justify-center">
                <div className="text-center space-y-3 p-4">
                  <Icon
                    icon={getStatusIcon(job.status)}
                    className={`text-5xl sm:text-6xl ${
                      job.status === "running"
                        ? "animate-spin text-accent-400"
                        : job.status === "uploading"
                          ? "animate-pulse text-accent-400"
                          : "text-text-tertiary"
                    }`}
                  />
                  {job.status === "running" && (
                    <div className="space-y-2 max-w-sm mx-auto">
                      <ProgressBar value={job.progress || 0} >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
                      <p className="text-sm text-text-secondary">
                        {job.progressMessage || "Processing..."}
                      </p>
                    </div>
                  )}
                  {job.status === "failed" && (
                    <p className="text-sm text-red-500 max-w-sm">
                      {job.errorMessage || "Processing failed"}
                    </p>
                  )}
                  {job.status === "queued" && (
                    <p className="text-sm text-text-secondary">Waiting in queue...</p>
                  )}
                  {job.status === "uploading" && (
                    <p className="text-sm text-accent-400">
                      {job.progressMessage || "Uploading files..."}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Title Section */}
            {isCompleted && (
              <div className="p-3 sm:p-4 rounded-lg bg-white/[0.04]">
                <p className="text-xs text-text-tertiary mb-2">Title</p>
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input onChange={(e) => (setEditTitle)(e.target.value)}
 value={editTitle}
 placeholder="Enter a title..."
 onKeyDown={(e) => {
 if (e.key === "Enter") handleSaveTitle();
 if (e.key === "Escape") {
 setIsEditingTitle(false);
 setEditTitle(job?.title || "");
 }
 }}
 autoFocus
 />
                    <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={handleSaveTitle}
 isPending={isSavingTitle}
 >
                      <Icon icon="solar:check-circle-bold" width={18} />
                    </Button>
                    <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={() => {
 setIsEditingTitle(false);
 setEditTitle(job?.title || "");
 }}
 >
                      <Icon icon="solar:close-circle-bold" width={18} />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="tertiary"
                    onPress={() => setIsEditingTitle(true)}
                    className="flex items-center gap-2 text-sm hover:text-accent-400 transition-colors group w-full"
                  >
                    <span className={job?.title ? "text-text-primary font-medium" : "text-text-muted italic"}>
                      {job?.title || "Click to add title..."}
                    </span>
                    <Icon
                      icon="solar:pen-2-bold"
                      width={14}
                      className="text-text-tertiary group-hover:text-accent-400 transition-colors"
                    />
                  </Button>
                )}
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Status</p>
                <Chip size="sm" color={getStatusColor(job.status)} variant="tertiary">
                  {job.status}
                </Chip>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Created</p>
                <p className="text-xs sm:text-sm text-text-primary">
                  {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Processing Time</p>
                <p className="text-xs sm:text-sm text-text-primary">
                  {formatDuration(job.createdAt, job.finishedAt)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Job ID</p>
                <p className="text-xs sm:text-sm text-text-primary font-mono truncate" title={job.id}>
                  {job.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          {/* Mobile: Stack buttons vertically, Desktop: Horizontal */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3">
            {/* Delete button */}
            <div className="order-2 sm:order-1">
              {onDelete && (
                <Button
 variant="danger-soft"
 onPress={handleDelete}
 isPending={isDeleting}
 className="w-full sm:w-auto"
 >
                  {!isDeleting && <Icon icon="solar:trash-bin-trash-bold" width={18} />}
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 order-1 sm:order-2">
              {/* Share section */}
              {isCompleted && hasClip && onShare && (
                <>
                  {shareToken ? (
                    <div className="flex items-center gap-2 relative">
                      {showCopied && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-success-500 text-white text-xs rounded whitespace-nowrap z-10">
                          Copied!
                        </div>
                      )}
                      <div
                        className="hidden sm:block px-3 py-2 bg-default-100 rounded-lg text-sm text-default-600 truncate max-w-[160px] cursor-pointer hover:bg-default-200 transition-colors"
                        title={getShareUrl()}
                        onClick={handleShare}
                      >
                        {getShareUrl()}
                      </div>
                      <Button
 variant="tertiary"
 onPress={handleShare}
 className="w-full sm:w-auto"
 >
                        <Icon icon="solar:copy-bold" />
                        <span className="sm:hidden">Copy Share Link</span>
                        <span className="hidden sm:inline">Copy</span>
                      </Button>
                    </div>
                  ) : (
                    <Button
 variant="tertiary"
 isPending={isSharing}
 onPress={handleShare}
 className="w-full sm:w-auto"
 >
                      {!isSharing && <Icon icon="solar:share-bold" />}
                      Share
                    </Button>
                  )}
                </>
              )}

              {/* Edit & Close & Download */}
              <div className="flex items-center gap-2">
                {isCompleted && hasClip && onEdit && (
                  <Button
 variant="tertiary"
 onPress={handleEdit}
 className="flex-1 sm:flex-none"
 >
                    <Icon icon="solar:pen-bold" />
                    Edit
                  </Button>
                )}
                <Button variant="tertiary" onPress={handleClose} className="flex-1 sm:flex-none">
                  Close
                </Button>
                {isCompleted && job.outputUrl && (
                  <Button variant="primary"
 onPress={handleDownload}
 isPending={isDownloading}
 className="flex-1 sm:flex-none"
 >
                    {!isDownloading && <Icon icon="solar:download-bold" width={18} />}
                    {isDownloading ? "..." : "Download"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
