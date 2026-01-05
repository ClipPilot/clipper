"use client";

import { useState } from "react";
import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { FaceSwapJob, formatDuration, getStatusColor, getStatusIcon } from "./types";

interface FaceSwapDetailModalProps {
  job: FaceSwapJob | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (jobId: string) => void;
}

export function FaceSwapDetailModal({ job, isOpen, onClose, onDelete }: FaceSwapDetailModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!job || isDeleting || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(job.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!job?.outputUrl || isDownloading) return;

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

  if (!job) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <Icon icon="solar:mask-happly-bold-duotone" className="text-accent-400" width={24} />
          <span>Face Swap Details</span>
        </ModalHeader>
        <ModalBody className="py-6">
          <div className="space-y-6">
            {job.status === "completed" && job.outputUrl ? (
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  src={job.outputUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              </div>
            ) : (
              <div className="rounded-xl bg-surface-elevated aspect-video flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Icon
                    icon={getStatusIcon(job.status)}
                    className={`text-5xl ${job.status === "running" ? "animate-spin text-accent-400" : "text-text-tertiary"}`}
                  />
                  {job.status === "running" && (
                    <div className="space-y-2 px-8">
                      <Progress
                        value={job.progress || 0}
                        size="md"
                        color="primary"
                        className="max-w-xs mx-auto"
                      />
                      <p className="text-sm text-text-secondary">
                        {job.progressMessage || "Processing..."}
                      </p>
                    </div>
                  )}
                  {job.status === "failed" && (
                    <p className="text-sm text-red-500 px-4">
                      {job.errorMessage || "Processing failed"}
                    </p>
                  )}
                  {job.status === "queued" && (
                    <p className="text-sm text-text-secondary">Queuing Job.</p>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Status</p>
                <Chip size="sm" color={getStatusColor(job.status)} variant="flat">
                  {job.status}
                </Chip>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Created</p>
                <p className="text-sm text-text-primary">
                  {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Processing Time</p>
                <p className="text-sm text-text-primary">
                  {formatDuration(job.createdAt, job.finishedAt)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Job ID</p>
                <p className="text-sm text-text-primary font-mono truncate">{job.id}</p>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-between w-full">
            <div>
              {onDelete && (
                <Button
                  variant="flat"
                  color="danger"
                  onPress={handleDelete}
                  isLoading={isDeleting}
                  startContent={!isDeleting && <Icon icon="solar:trash-bin-trash-bold" width={18} />}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="flat" onPress={onClose}>
                Close
              </Button>
              {job.status === "completed" && job.outputUrl && (
                <Button
                  color="primary"
                  onPress={handleDownload}
                  isLoading={isDownloading}
                  startContent={!isDownloading && <Icon icon="solar:download-bold" width={18} />}
                >
                  {isDownloading ? "Downloading..." : "Download Video"}
                </Button>
              )}
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
