"use client";

import React, { useState } from "react";
import { Button, Card, CardBody, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { videoAPI, UploadProgress } from "@/api/video";

interface UploadSectionProps {
  teamId: number;
  onUploadComplete: (s3Key: string, fileName: string, fileSize: number) => void;
  onError: (error: string) => void;
}

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const UploadSection: React.FC<UploadSectionProps> = ({
  teamId,
  onUploadComplete,
  onError,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      onError(`File size must be less than 2GB. Your file is ${formatBytes(file.size)}`);
      return;
    }

    const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm"];
    if (!validTypes.includes(file.type)) {
      onError("Please upload a valid video file (MP4, MOV, AVI, MKV, WebM)");
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    setProgress(null);

    try {
      const { uploadUrl, s3Key } = await videoAPI.getPresignedUploadUrl(
        teamId,
        file.name,
        file.type,
        file.size
      );

      await videoAPI.uploadToS3(uploadUrl, file, (uploadProgress) => {
        setProgress(uploadProgress);
      });

      onUploadComplete(s3Key, file.name, file.size);
    } catch (err: any) {
      console.error("Upload error:", err);
      onError(err.message || "Failed to upload video");
      setIsUploading(false);
      setSelectedFile(null);
      setProgress(null);
    }
  };

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          {isUploading ? (
            <>
              <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
                <Icon icon="solar:cloud-upload-bold-duotone" className="text-4xl text-accent-400 animate-pulse" />
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
                    {progress ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}` : "Starting..."}
                  </span>
                  <span>
                    {progress?.remainingTime !== null && progress?.remainingTime !== undefined
                      ? `${formatTime(progress.remainingTime)} remaining`
                      : "Calculating..."}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
                <Icon icon="solar:videocamera-record-bold-duotone" className="text-4xl text-accent-400" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-text-primary mb-2">
                  Upload Your Video
                </h3>
                <p className="text-sm text-text-secondary">
                  Choose a video file to create AI-powered clips
                </p>
              </div>

              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="video-upload"
              />

              <Button
                as="label"
                htmlFor="video-upload"
                size="lg"
                color="primary"
                startContent={<Icon icon="solar:upload-bold" className="text-xl" />}
                className="cursor-pointer px-8"
              >
                Choose Video File
              </Button>

              <div className="flex items-start gap-2 text-xs text-text-tertiary">
                <Icon icon="solar:info-circle-outline" className="text-base mt-0.5" />
                <div>
                  <p>Max size: 2GB</p>
                  <p>Max duration: 3 hours</p>
                  <p>Formats: MP4, MOV, AVI, MKV, WebM</p>
                </div>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
