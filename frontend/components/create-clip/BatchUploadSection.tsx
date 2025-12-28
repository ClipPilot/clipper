"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Card, CardBody, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  videoAPI,
  UploadProgress,
  MultipartUploadResponse,
  BatchUploadedVideo,
} from "@/api/video";
import { DrivePicker } from "./DrivePicker";

interface BatchUploadSectionProps {
  teamId: number;
  onUploadComplete: (videos: BatchUploadedVideo[]) => void;
  onError: (error: string) => void;
  isDisabled?: boolean;
  disabledReason?: string;
  maxVideos?: number;
}

interface FileUploadState {
  file: File;
  videoIndex: number;
  status: "pending" | "uploading" | "completed" | "failed";
  progress: UploadProgress | null;
  s3Key: string | null;
  error: string | null;
  duration: number; // Duration in seconds
}

const MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 30 * 60; // 30 minutes

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024 * 1024)
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
};

export const BatchUploadSection: React.FC<BatchUploadSectionProps> = ({
  teamId,
  onUploadComplete,
  onError,
  isDisabled = false,
  disabledReason,
  maxVideos = 5,
}) => {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const multipartDataRefs = useRef<Map<number, MultipartUploadResponse>>(
    new Map()
  );

  const isUploading = files.some((f) => f.status === "uploading");
  const allCompleted =
    files.length > 0 && files.every((f) => f.status === "completed");
  const hasErrors = files.some((f) => f.status === "failed");

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = "Upload in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading]);

  // Notify parent when all uploads complete
  useEffect(() => {
    if (allCompleted && files.length > 0) {
      const uploadedVideos: BatchUploadedVideo[] = files.map((f) => ({
        s3Key: f.s3Key!,
        fileName: f.file.name,
        fileSize: f.file.size,
        videoIndex: f.videoIndex,
        duration: f.duration,
      }));
      onUploadComplete(uploadedVideos);
    }
  }, [allCompleted, files, onUploadComplete]);

  const uploadFile = async (fileState: FileUploadState) => {
    const { file, videoIndex } = fileState;
    const useMultipart = file.size > MULTIPART_THRESHOLD;

    try {
      let s3Key: string;

      if (useMultipart) {
        const multipartData = await videoAPI.initiateMultipartUpload(
          teamId,
          file.name,
          file.type,
          file.size
        );
        multipartDataRefs.current.set(videoIndex, multipartData);
        s3Key = multipartData.s3Key;

        const parts = await videoAPI.uploadMultipart(
          file,
          multipartData,
          (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.videoIndex === videoIndex ? { ...f, progress } : f
              )
            );
          },
          6
        );

        await videoAPI.completeMultipartUpload(
          s3Key,
          multipartData.uploadId,
          parts
        );
        multipartDataRefs.current.delete(videoIndex);
      } else {
        const { uploadUrl, s3Key: key } = await videoAPI.getPresignedUploadUrl(
          teamId,
          file.name,
          file.type,
          file.size
        );
        s3Key = key;
        await videoAPI.uploadToS3(uploadUrl, file, (progress) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.videoIndex === videoIndex ? { ...f, progress } : f
            )
          );
        });
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.videoIndex === videoIndex ? { ...f, status: "completed", s3Key } : f
        )
      );
    } catch (err: any) {
      console.error(`Upload error for video ${videoIndex}:`, err);

      const multipartData = multipartDataRefs.current.get(videoIndex);
      if (multipartData) {
        try {
          await videoAPI.abortMultipartUpload(
            multipartData.s3Key,
            multipartData.uploadId
          );
        } catch (abortErr) {
          console.error("Failed to abort multipart upload:", abortErr);
        }
        multipartDataRefs.current.delete(videoIndex);
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.videoIndex === videoIndex
            ? { ...f, status: "failed", error: err.message || "Upload failed" }
            : f
        )
      );
    }
  };

  const validateAndAddFiles = async (newFiles: File[]) => {
    console.log("Validating files:", newFiles);
    setDownloading(true);
    const validTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/webm",
    ];
    const errors: string[] = [];
    const validFiles: { file: File; duration: number }[] = [];

    const currentCount = files.length;
    const remainingSlots = maxVideos - currentCount;

    if (newFiles.length > remainingSlots) {
      onError(
        `You can only add ${remainingSlots} more video(s). Maximum is ${maxVideos}.`
      );
      return;
    }

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size must be less than 2GB`);
        continue;
      }
      if (!validTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid video format`);
        continue;
      }

      // Check video duration
      try {
        const duration = await getVideoDuration(file);
        if (duration > MAX_VIDEO_DURATION_SECONDS) {
          const durationMins = Math.ceil(duration / 60);
          errors.push(
            `${file.name}: Video is ${durationMins} minutes (max 30 minutes)`
          );
          continue;
        }
        validFiles.push({ file, duration });
      } catch (err) {
        errors.push(`${file.name}: Could not read video duration`);
        continue;
      }
    }

    if (errors.length > 0) {
      onError(errors.join("\n"));
    }

    if (validFiles.length > 0) {
      const newFileStates: FileUploadState[] = validFiles.map(
        ({ file, duration }, idx) => ({
          file,
          videoIndex: currentCount + idx,
          status: "uploading" as const,
          progress: null,
          s3Key: null,
          error: null,
          duration,
        })
      );

      setFiles((prev) => [...prev, ...newFileStates]);

      // Start uploads
      newFileStates.forEach((fileState) => {
        uploadFile(fileState);
      });
    }
    setDownloading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      validateAndAddFiles(selectedFiles);
    }
    // Reset input
    e.target.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        validateAndAddFiles(droppedFiles);
      }
    },
    [files.length, maxVideos]
  );

  const removeFile = (videoIndex: number) => {
    setFiles((prev) => {
      const newFiles = prev.filter((f) => f.videoIndex !== videoIndex);
      // Re-index remaining files
      return newFiles.map((f, idx) => ({ ...f, videoIndex: idx }));
    });
  };

  const retryUpload = (videoIndex: number) => {
    const fileState = files.find((f) => f.videoIndex === videoIndex);
    if (fileState) {
      setFiles((prev) =>
        prev.map((f) =>
          f.videoIndex === videoIndex
            ? { ...f, status: "uploading", progress: null, error: null }
            : f
        )
      );
      uploadFile({
        ...fileState,
        status: "uploading",
        progress: null,
        error: null,
      });
    }
  };

  const clearAll = () => {
    setFiles([]);
  };

  const renderFileList = () => (
    <div className="space-y-3 w-full">
      {files.map((fileState) => (
        <div
          key={fileState.videoIndex}
          className={`p-4 rounded-lg border ${
            fileState.status === "failed"
              ? "border-danger-500/50 bg-danger-500/10"
              : fileState.status === "completed"
                ? "border-success-500/50 bg-success-500/10"
                : "border-border-base bg-surface-elevated"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                fileState.status === "failed"
                  ? "bg-danger-500/20"
                  : fileState.status === "completed"
                    ? "bg-success-500/20"
                    : "bg-accent-400/20"
              }`}
            >
              <span className="font-bold text-sm">
                {fileState.videoIndex + 1}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {fileState.file.name}
              </p>
              <p className="text-xs text-text-tertiary">
                {formatBytes(fileState.file.size)}
              </p>
            </div>

            {fileState.status === "uploading" && (
              <Icon
                icon="solar:cloud-upload-bold-duotone"
                className="text-xl text-accent-400 animate-pulse"
              />
            )}
            {fileState.status === "completed" && (
              <Icon
                icon="solar:check-circle-bold"
                className="text-xl text-success-500"
              />
            )}
            {fileState.status === "failed" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={() => retryUpload(fileState.videoIndex)}
                >
                  Retry
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  isIconOnly
                  onPress={() => removeFile(fileState.videoIndex)}
                >
                  <Icon icon="solar:trash-bin-trash-bold" />
                </Button>
              </div>
            )}
          </div>

          {fileState.status === "uploading" && fileState.progress && (
            <div className="mt-3">
              <Progress
                value={fileState.progress.percentage}
                color="primary"
                size="sm"
                className="mb-1"
              />
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>
                  {formatBytes(fileState.progress.loaded)} /{" "}
                  {formatBytes(fileState.progress.total)}
                </span>
                <span>
                  {fileState.progress.speed
                    ? formatSpeed(fileState.progress.speed)
                    : ""}
                </span>
              </div>
            </div>
          )}

          {fileState.status === "failed" && fileState.error && (
            <p className="mt-2 text-xs text-danger-500">{fileState.error}</p>
          )}
        </div>
      ))}
    </div>
  );

  const renderDropZone = () => (
    <div
      className={`border-2 border-dashed rounded-xl p-8 transition-colors ${
        isDragging
          ? "border-accent-400 bg-accent-400/10"
          : "border-border-base hover:border-accent-400/50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 bg-accent-400/10 rounded-full flex items-center justify-center">
          <Icon
            icon="solar:upload-bold-duotone"
            className="text-3xl text-accent-400"
          />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-bold text-text-primary mb-1">
            Drag & Drop Videos
          </h3>
          <p className="text-sm text-text-secondary">
            or click to browse (max {maxVideos} videos)
          </p>
        </div>

        <input
          type="file"
          accept="video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="batch-video-upload"
        />

        <div className="flex gap-3">
          <Button
            as="label"
            htmlFor="batch-video-upload"
            size="md"
            isDisabled={downloading}
            color="primary"
            variant="flat"
            startContent={<Icon icon="solar:folder-open-bold" />}
            className="cursor-pointer"
          >
            Browse Files
          </Button>

          <DrivePicker
            processFiles={validateAndAddFiles}
            setDownloading={setDownloading}
            downloading={downloading}
          />
        </div>

        <div className="flex items-start gap-2 text-xs text-text-tertiary">
          <Icon icon="solar:info-circle-outline" className="text-base mt-0.5" />
          <div>
            <p>
              Max 30 min per video | Max size: 2GB | Formats: MP4, MOV, AVI,
              MKV, WebM
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (isDisabled) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 bg-surface-elevated rounded-full flex items-center justify-center">
              <Icon
                icon="solar:lock-bold-duotone"
                className="text-4xl text-text-tertiary"
              />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-text-tertiary mb-2">
                Upload Disabled
              </h3>
              <p className="text-sm text-text-tertiary">
                {disabledReason || "You cannot upload videos at this time"}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-6">
        {isUploading && (
          <div className="mb-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/20 flex items-center gap-2">
            <Icon
              icon="solar:danger-triangle-bold"
              className="text-warning-500 flex-shrink-0"
              width={20}
            />
            <p className="text-sm text-warning-500">
              Do not leave this page while uploading
            </p>
          </div>
        )}

        {files.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {files.length} / {maxVideos} videos
              </span>
              {allCompleted && (
                <span className="text-xs text-success-500 flex items-center gap-1">
                  <Icon icon="solar:check-circle-bold" />
                  All uploaded
                </span>
              )}
            </div>
            {!isUploading && (
              <Button
                size="sm"
                color="danger"
                variant="light"
                onPress={clearAll}
              >
                Clear All
              </Button>
            )}
          </div>
        )}

        {files.length > 0 && renderFileList()}

        {files.length < maxVideos && !isUploading && (
          <div className={files.length > 0 ? "mt-4" : ""}>
            {renderDropZone()}
          </div>
        )}

        {hasErrors && !isUploading && (
          <p className="mt-3 text-sm text-danger-500 text-center">
            Some uploads failed. Please retry or remove them before proceeding.
          </p>
        )}
      </CardBody>
    </Card>
  );
};
