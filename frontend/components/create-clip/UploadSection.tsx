"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button, Card, CardBody, Progress, Input, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { videoAPI, UploadProgress, MultipartUploadResponse, YouTubeDownloadProgress } from "@/api/video";

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

const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const UploadSection: React.FC<UploadSectionProps> = ({
  teamId,
  onUploadComplete,
  onError,
  isDisabled = false,
  disabledReason,
}) => {
  const [activeTab, setActiveTab] = useState<string>("file");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"single" | "multipart">("single");
  const multipartDataRef = useRef<MultipartUploadResponse | null>(null);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState<{ title: string; duration: number; thumbnail: string; uploader: string } | null>(null);
  const [ytProgress, setYtProgress] = useState<YouTubeDownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading || isDownloading) {
        e.preventDefault();
        e.returnValue = "Upload in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading, isDownloading]);

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

    const useMultipart = file.size > MULTIPART_THRESHOLD;
    setUploadType(useMultipart ? "multipart" : "single");

    try {
      let s3Key: string;

      if (useMultipart) {
        const multipartData = await videoAPI.initiateMultipartUpload(teamId, file.name, file.type, file.size);
        multipartDataRef.current = multipartData;
        s3Key = multipartData.s3Key;

        const parts = await videoAPI.uploadMultipart(file, multipartData, (uploadProgress) => setProgress(uploadProgress), 6);

        await videoAPI.completeMultipartUpload(s3Key, multipartData.uploadId, parts);
        multipartDataRef.current = null;
      } else {
        const { uploadUrl, s3Key: key } = await videoAPI.getPresignedUploadUrl(teamId, file.name, file.type, file.size);
        s3Key = key;
        await videoAPI.uploadToS3(uploadUrl, file, (uploadProgress) => setProgress(uploadProgress));
      }

      onUploadComplete(s3Key, file.name, file.size);
    } catch (err: any) {
      console.error("Upload error:", err);

      if (multipartDataRef.current) {
        try {
          await videoAPI.abortMultipartUpload(multipartDataRef.current.s3Key, multipartDataRef.current.uploadId);
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

  const handleYoutubeUrlChange = (url: string) => {
    setYoutubeUrl(url);
    setVideoInfo(null);
  };

  const handleFetchVideoInfo = async () => {
    if (!youtubeUrl.trim()) {
      onError("Please enter a YouTube URL");
      return;
    }

    setIsLoadingInfo(true);
    try {
      const info = await videoAPI.getYouTubeVideoInfo(youtubeUrl);
      setVideoInfo(info);
    } catch (err: any) {
      onError(err.message || "Failed to fetch video info");
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleYoutubeDownload = async () => {
    if (!youtubeUrl.trim()) {
      onError("Please enter a YouTube URL");
      return;
    }

    setIsDownloading(true);
    setYtProgress(null);

    try {
      const result = await videoAPI.downloadYouTubeVideo(youtubeUrl, teamId, (progress) => {
        setYtProgress(progress);
      });

      onUploadComplete(result.s3Key, result.fileName, result.fileSize);
    } catch (err: any) {
      onError(err.message || "Failed to download video");
      setIsDownloading(false);
      setYtProgress(null);
    }
  };

  const renderFileUpload = () => (
    <div className="flex flex-col items-center justify-center space-y-4">
      {isUploading ? (
        <>
          <div className="w-full mb-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/20 flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" className="text-warning-500 flex-shrink-0" width={20} />
            <p className="text-sm text-warning-500">Do not leave this page while uploading</p>
          </div>

          <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
            <Icon icon="solar:cloud-upload-bold-duotone" className="text-4xl text-accent-400 animate-pulse" />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">Uploading Video</h3>
            {selectedFile && <p className="text-sm text-text-secondary mb-4">{selectedFile.name}</p>}
          </div>

          <div className="w-full max-w-md">
            <Progress value={progress?.percentage || 0} color="primary" className="mb-3" showValueLabel />
            <div className="flex justify-between text-sm text-text-secondary">
              <span>{progress ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}` : "Starting..."}</span>
              <span>{progress?.speed ? formatSpeed(progress.speed) : ""}</span>
            </div>
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>{uploadType === "multipart" ? "Fast Upload" : "Standard upload"}</span>
              <span>{progress?.remainingTime !== null && progress?.remainingTime !== undefined ? `${formatTime(progress.remainingTime)} remaining` : "Calculating..."}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
            <Icon icon="solar:videocamera-record-bold-duotone" className="text-4xl text-accent-400" />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">Upload Your Video</h3>
            <p className="text-sm text-text-secondary">Choose a video file to create AI-powered clips</p>
          </div>

          <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" id="video-upload" />

          <Button as="label" htmlFor="video-upload" size="lg" color="primary" startContent={<Icon icon="solar:upload-bold" className="text-xl" />} className="cursor-pointer px-8">
            Choose Video File
          </Button>

          <div className="flex items-start gap-2 text-xs text-text-tertiary">
            <Icon icon="solar:info-circle-outline" className="text-base mt-0.5" />
            <div>
              <p>Max size: 2GB | Max duration: 3 hours</p>
              <p>Formats: MP4, MOV, AVI, MKV, WebM</p>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderYoutubeUpload = () => (
    <div className="flex flex-col items-center justify-center space-y-4">
      {isDownloading ? (
        <>
          <div className="w-full mb-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/20 flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" className="text-warning-500 flex-shrink-0" width={20} />
            <p className="text-sm text-warning-500">Do not leave this page while downloading</p>
          </div>

          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
            <Icon icon="mdi:youtube" className="text-4xl text-red-500 animate-pulse" />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              {ytProgress?.type === "uploading" ? "Uploading to Cloud" : "Downloading from YouTube"}
            </h3>
            {videoInfo && <p className="text-sm text-text-secondary mb-4 max-w-md truncate">{videoInfo.title}</p>}
          </div>

          <div className="w-full max-w-md">
            <Progress
              value={ytProgress?.type === "uploading" ? 100 : ytProgress?.percent || 0}
              color="danger"
              className="mb-3"
              isIndeterminate={ytProgress?.type === "uploading" || ytProgress?.type === "start"}
              showValueLabel={ytProgress?.type !== "uploading" && ytProgress?.type !== "start"}
            />
            <div className="flex justify-between text-sm text-text-secondary">
              <span>
                {ytProgress?.type === "progress" && ytProgress.downloaded && ytProgress.total
                  ? `${formatBytes(ytProgress.downloaded)} / ${formatBytes(ytProgress.total)}`
                  : ytProgress?.message || "Processing..."}
              </span>
              <span>{ytProgress?.speed || ""}</span>
            </div>
            {ytProgress?.eta && (
              <div className="text-right text-xs text-text-tertiary mt-1">
                ETA: {ytProgress.eta}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
            <Icon icon="mdi:youtube" className="text-4xl text-red-500" />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">Import from YouTube</h3>
            <p className="text-sm text-text-secondary">Paste a YouTube video URL to import</p>
          </div>

          <div className="w-full max-w-lg space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                startContent={<Icon icon="mdi:link" className="text-text-tertiary" />}
                classNames={{ inputWrapper: "bg-surface-elevated border-border-base" }}
              />
              <Button color="default" variant="flat" onPress={handleFetchVideoInfo} isLoading={isLoadingInfo} isIconOnly>
                <Icon icon="solar:magnifer-bold" className="text-xl" />
              </Button>
            </div>

            {videoInfo && (
              <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
                <div className="flex gap-4">
                  {videoInfo.thumbnail && (
                    <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-32 h-20 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">{videoInfo.title}</p>
                    <p className="text-sm text-text-secondary">{videoInfo.uploader}</p>
                    <p className="text-xs text-text-tertiary mt-1">Duration: {formatDuration(videoInfo.duration)}</p>
                  </div>
                </div>
              </div>
            )}

            <Button
              fullWidth
              size="lg"
              color="danger"
              onPress={handleYoutubeDownload}
              isDisabled={!youtubeUrl.trim()}
              startContent={<Icon icon="solar:download-bold" className="text-xl" />}
            >
              Download & Import
            </Button>
          </div>

          <div className="flex items-start gap-2 text-xs text-text-tertiary">
            <Icon icon="solar:info-circle-outline" className="text-base mt-0.5" />
            <div>
              <p>Supports YouTube videos and Shorts</p>
              <p>Downloads in best available quality (up to 1080p)</p>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (isDisabled) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 bg-surface-elevated rounded-full flex items-center justify-center">
              <Icon icon="solar:lock-bold-duotone" className="text-4xl text-text-tertiary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-text-tertiary mb-2">Upload Disabled</h3>
              <p className="text-sm text-text-tertiary">{disabledReason || "You cannot upload videos at this time"}</p>
            </div>
            <Button size="lg" color="primary" isDisabled startContent={<Icon icon="solar:upload-bold" className="text-xl" />} className="px-8 opacity-50">
              Choose Video File
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-8">
        {!isUploading && !isDownloading && (
          <div className="flex justify-center mb-6">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              color="primary"
              variant="bordered"
              classNames={{ tabList: "bg-surface-elevated border-border-base" }}
            >
              <Tab
                key="file"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:upload-bold" />
                    <span>File Upload</span>
                  </div>
                }
              />
              <Tab
                key="youtube"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:youtube" />
                    <span>YouTube</span>
                  </div>
                }
              />
            </Tabs>
          </div>
        )}

        {activeTab === "file" || isUploading ? renderFileUpload() : renderYoutubeUpload()}
      </CardBody>
    </Card>
  );
};
