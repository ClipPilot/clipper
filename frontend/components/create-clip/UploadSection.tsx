"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Card, CardBody, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { videoAPI, UploadProgress, MultipartUploadResponse } from "@/api/video";
import { DrivePicker } from "./DrivePicker";

interface UploadSectionProps {
  teamId: number;
  onUploadComplete: (s3Key: string, fileName: string, fileSize: number) => void;
  onError: (error: string) => void;
  isDisabled?: boolean;
  disabledReason?: string;
}

const MULTIPART_THRESHOLD = 50 * 1024 * 1024;

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

export const UploadSection: React.FC<UploadSectionProps> = ({
  teamId,
  onUploadComplete,
  onError,
  isDisabled = false,
  disabledReason,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"single" | "multipart">(
    "single"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const multipartDataRef = useRef<MultipartUploadResponse | null>(null);

  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
  const validTypes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
  ];

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

  const processFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      onError(
        `File size must be less than 2GB. Your file is ${formatBytes(file.size)}`
      );
      return;
    }

    if (!validTypes.includes(file.type)) {
      onError("Please upload a valid video file (MP4, MOV, AVI, MKV, WebM)");
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    setProgress(null);

    const useMultipart = file.size > MULTIPART_THRESHOLD;
    setUploadType(useMultipart ? "multipart" : "single");

    try {
      let s3Key: string;

      if (useMultipart) {
        const multipartData = await videoAPI.initiateMultipartUpload(
          teamId,
          file.name,
          file.type,
          file.size
        );
        multipartDataRef.current = multipartData;
        s3Key = multipartData.s3Key;

        const parts = await videoAPI.uploadMultipart(
          file,
          multipartData,
          (uploadProgress) => setProgress(uploadProgress),
          6
        );

        await videoAPI.completeMultipartUpload(
          s3Key,
          multipartData.uploadId,
          parts
        );
        multipartDataRef.current = null;
      } else {
        const { uploadUrl, s3Key: key } = await videoAPI.getPresignedUploadUrl(
          teamId,
          file.name,
          file.type,
          file.size
        );
        s3Key = key;
        await videoAPI.uploadToS3(uploadUrl, file, (uploadProgress) =>
          setProgress(uploadProgress)
        );
      }

      onUploadComplete(s3Key, file.name, file.size);
    } catch (err: any) {
      console.error("Upload error:", err);

      if (multipartDataRef.current) {
        try {
          await videoAPI.abortMultipartUpload(
            multipartDataRef.current.s3Key,
            multipartDataRef.current.uploadId
          );
        } catch (abortErr) {
          console.error("Failed to abort multipart upload:", abortErr);
        }
        multipartDataRef.current = null;
      }

      onError(err.message || "Failed to upload video");
      setIsUploading(false);
      setSelectedFile(null);
      setProgress(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
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
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile]
  );

  const renderFileUpload = () => (
    <div className="flex flex-col items-center justify-center space-y-4">
      {downloading ? (
        <>
          <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
            <Icon
              icon="logos:google-drive"
              className="text-4xl animate-pulse"
            />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Downloading from Google Drive
            </h3>
            <p className="text-sm text-text-secondary">
              Please wait while we fetch your file...
            </p>
          </div>
          <Progress isIndeterminate color="primary" className="w-full max-w-md" />
        </>
      ) : isUploading ? (
        <>
          <div className="w-full mb-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/20 flex items-center gap-2">
            <Icon
              icon="solar:danger-triangle-bold"
              className="text-warning-500 flex-shrink-0"
              width={20}
            />
            <p className="text-sm text-warning-500">
              Do not leave this page while uploading
            </p>
          </div>

          <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
            <Icon
              icon="solar:cloud-upload-bold-duotone"
              className="text-4xl text-accent-400 animate-pulse"
            />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Uploading Video
            </h3>
            {selectedFile && (
              <p className="text-sm text-text-secondary mb-4">
                {selectedFile.name}
              </p>
            )}
          </div>

          <div className="w-full max-w-md">
            <Progress
              value={progress?.percentage || 0}
              color="primary"
              className="mb-3"
              showValueLabel
            />
            <div className="flex justify-between text-sm text-text-secondary">
              <span>
                {progress
                  ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`
                  : "Starting..."}
              </span>
              <span>{progress?.speed ? formatSpeed(progress.speed) : ""}</span>
            </div>
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>
                {uploadType === "multipart" ? "Fast Upload" : "Standard upload"}
              </span>
              <span>
                {progress?.remainingTime !== null &&
                progress?.remainingTime !== undefined
                  ? `${formatTime(progress.remainingTime)} remaining`
                  : "Calculating..."}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div
          className={`w-full border-2 border-dashed rounded-xl p-8 transition-colors ${
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
                Drag & Drop Video
              </h3>
              <p className="text-sm text-text-secondary">or click to browse</p>
            </div>

            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload"
            />

            <div className="flex gap-3">
              <Button
                as="label"
                htmlFor="video-upload"
                size="md"
                color="primary"
                isDisabled={downloading}
                variant="flat"
                startContent={<Icon icon="solar:folder-open-bold" />}
                className="cursor-pointer"
              >
                Browse Files
              </Button>

              <DrivePicker setDownloading={setDownloading} downloading={downloading} processFile={processFile} />
            </div>

            <div className="flex items-start gap-2 text-xs text-text-tertiary">
              <Icon
                icon="solar:info-circle-outline"
                className="text-base mt-0.5"
              />
              <div>
                <p>Max size: 2GB | Formats: MP4, MOV, AVI, MKV, WebM</p>
              </div>
            </div>
          </div>
        </div>
      )}
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
            <div className="flex gap-3">
              <Button
                size="md"
                color="primary"
                isDisabled
                startContent={<Icon icon="solar:folder-open-bold" />}
                className="opacity-50 cursor-not-allowed"
              >
                Browse Files
              </Button>

              <DrivePicker setDownloading={setDownloading} disabled />
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-8">{renderFileUpload()}</CardBody>
    </Card>
  );
};
