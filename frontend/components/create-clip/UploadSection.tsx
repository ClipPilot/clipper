"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Card, ProgressBar, Input, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { videoAPI, UploadProgress, MultipartUploadResponse, VideoUrlInfo, VideoDownloadProgress } from "@/api/video";
import { formatBytes, formatDuration } from "@/lib/videoUrlUtils";
import { PLAN_UPLOAD_LIMITS } from "@/lib/constants";

interface UploadSectionProps {
  teamId: number;
  plan?: string;
  onUploadComplete: (s3Key: string, fileName: string, fileSize: number) => void;
  onError: (error: string) => void;
  isDisabled?: boolean;
  disabledReason?: string;
}

const MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 2 * 60 * 60; // 2 hours

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

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024 * 1024)
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

export const UploadSection: React.FC<UploadSectionProps> = ({
  teamId,
  plan = "free",
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

  // URL download state
  const [urlInput, setUrlInput] = useState("");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoUrlInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<VideoDownloadProgress | null>(null);

  const MAX_FILE_SIZE = PLAN_UPLOAD_LIMITS[plan] ?? PLAN_UPLOAD_LIMITS.free;
  const validTypes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
  ];

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

  const processFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      const limitGB = MAX_FILE_SIZE / (1024 * 1024 * 1024);
      onError(
        `File size must be less than ${limitGB}GB. Your file is ${formatBytes(file.size)}`
      );
      return;
    }

    if (!validTypes.includes(file.type)) {
      onError("Please upload a valid video file (MP4, MOV, AVI, MKV, WebM)");
      return;
    }

    try {
      const duration = await getVideoDuration(file);
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        const hours = Math.floor(duration / 3600);
        const mins = Math.floor((duration % 3600) / 60);
        onError(
          `Video is too long (${hours}h ${mins}m). Maximum duration is 2 hours.`
        );
        return;
      }
    } catch {
      // If we can't read metadata, let the upload proceed — backend will handle it
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

  const handleFetchVideoInfo = async () => {
    if (!urlInput.trim()) {
      onError("Please enter a video URL");
      return;
    }

    setIsFetchingInfo(true);
    setVideoInfo(null);

    try {
      const info = await videoAPI.getVideoInfo(urlInput.trim());
      setVideoInfo(info);
    } catch (err: any) {
      onError(err.message || "Failed to fetch video info");
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleUrlDownload = async () => {
    if (!urlInput.trim()) return;

    setIsDownloading(true);
    setDownloadProgress(null);

    try {
      const result = await videoAPI.downloadFromUrl(
        urlInput.trim(),
        teamId,
        (progress) => setDownloadProgress(progress)
      );

      onUploadComplete(result.s3Key, result.fileName, result.fileSize);
    } catch (err: any) {
      onError(err.message || "Failed to download video");
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

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
            <h3 className="text-lg font-bold text-text-accent mb-2">
              Downloading from Google Drive
            </h3>
            <p className="text-sm text-text-secondary">
              Please wait while we fetch your file...
            </p>
          </div>
          <ProgressBar isIndeterminate className="w-full max-w-md" >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
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
            <h3 className="text-lg font-bold text-text-accent mb-2">
              Uploading Video
            </h3>
            {selectedFile && (
              <p className="text-sm text-text-secondary mb-4">
                {selectedFile.name}
              </p>
            )}
          </div>

          <div className="w-full max-w-md">
            <ProgressBar
 value={progress?.percentage || 0}
 className="mb-3"
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
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
              <h3 className="text-lg font-bold text-text-accent mb-1">
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
 isDisabled={downloading}
 variant="tertiary"
 className="cursor-pointer"
 >
                <Icon icon="solar:folder-open-bold" />
                Browse Files
              </Button>

            </div>

            <div className="flex items-start gap-2 text-xs text-text-tertiary">
              <Icon
                icon="solar:info-circle-outline"
                className="text-base mt-0.5"
              />
              <div>
                <p>Max 2 hours | Max size: {MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB | Formats: MP4, MOV, AVI, MKV, WebM</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderUrlDownload = () => (
    <div className="flex flex-col space-y-4">
      {isDownloading ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-full mb-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/20 flex items-center gap-2">
            <Icon
              icon="solar:danger-triangle-bold"
              className="text-warning-500 flex-shrink-0"
              width={20}
            />
            <p className="text-sm text-warning-500">
              Do not leave this page while downloading
            </p>
          </div>

          <div className="w-20 h-20 bg-accent-400/10 rounded-full flex items-center justify-center">
            <Icon
              icon="solar:download-bold-duotone"
              className="text-4xl text-accent-400 animate-pulse"
            />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-text-accent mb-2">
              {downloadProgress?.type === "uploading"
                ? "Uploading to Cloud..."
                : "Downloading Video"}
            </h3>
            {videoInfo && (
              <p className="text-sm text-text-secondary mb-4">
                {videoInfo.title}
              </p>
            )}
          </div>

          <div className="w-full max-w-md">
            <ProgressBar
 value={
 downloadProgress?.type === "uploading"
 ? 100
 : downloadProgress?.percent || 0
 }
 className="mb-3"
 isIndeterminate={
 downloadProgress?.type === "start" ||
 downloadProgress?.type === "uploading"
 }
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
            <div className="flex justify-between text-sm text-text-secondary">
              <span>
                {downloadProgress?.type === "uploading"
                  ? "Saving to cloud..."
                  : downloadProgress?.type === "progress"
                    ? `${downloadProgress.percent?.toFixed(1)}%`
                    : "Starting..."}
              </span>
              <span>{downloadProgress?.speed || ""}</span>
            </div>
            {downloadProgress?.eta && downloadProgress.type === "progress" && (
              <div className="text-right text-xs text-text-tertiary mt-1">
                ETA: {downloadProgress.eta}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
 placeholder="Paste video URL (YouTube, Twitch, TikTok, etc.)"
 value={urlInput}
 onChange={(e) => setUrlInput(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter" && urlInput.trim()) handleFetchVideoInfo();
 }}
 startContent={
 <Icon
 icon="solar:link-bold"
 className="text-text-tertiary"
 />
 }
 isDisabled={isFetchingInfo}
 />
            <Button
 variant="tertiary"
 onPress={handleFetchVideoInfo}
 isPending={isFetchingInfo}
 isDisabled={!urlInput.trim()}
 >
              Fetch
            </Button>
          </div>

          {videoInfo && (
            <div className="rounded-lg border border-border-base bg-surface-elevated p-4">
              <div className="flex gap-4">
                {videoInfo.thumbnail && (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-32 h-20 object-cover rounded-md flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-text-accent truncate">
                    {videoInfo.title}
                  </h4>
                  <p className="text-xs text-text-secondary mt-1">
                    {videoInfo.uploader}
                    {videoInfo.platform && (
                      <span className="ml-2 px-1.5 py-0.5 bg-accent-400/10 text-accent-400 rounded text-[10px]">
                        {videoInfo.platform}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                    {videoInfo.duration > 0 && (
                      <span>Duration: {formatDuration(videoInfo.duration)}</span>
                    )}
                    {videoInfo.filesize > 0 && (
                      <span>~{formatBytes(videoInfo.filesize)}</span>
                    )}
                  </div>
                </div>
              </div>

              <Button variant="primary"
 className="w-full mt-4"
 onPress={handleUrlDownload}
 >
                <Icon icon="solar:download-bold" />
                Download & Import
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-text-tertiary">
            <Icon
              icon="solar:info-circle-outline"
              className="text-base mt-0.5 flex-shrink-0"
            />
            <p>
              Supports YouTube, Twitch, Kick, TikTok, Instagram, Vimeo, and 1000+ other sites
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (isDisabled) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <Card.Content className="p-8">
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
              <Button variant="primary"
 size="md"
 isDisabled
 className="opacity-50 cursor-not-allowed"
 >
                <Icon icon="solar:folder-open-bold" />
                Browse Files
              </Button>

            </div>
          </div>
        </Card.Content>
      </Card>
    );
  }

  // If currently uploading a file or downloading from URL, show just that view (no tabs)
  if (isUploading || isDownloading) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <Card.Content className="p-8">
          {isDownloading ? renderUrlDownload() : renderFileUpload()}
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <Card.Content className="p-8">
        <Tabs
 aria-label="Upload method"
 >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Upload method">
              <Tabs.Tab id="file">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:upload-bold" />
                  <span>Upload File</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="url">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:link-bold" />
                  <span>Paste URL</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="file">
            {renderFileUpload()}
          </Tabs.Panel>
          <Tabs.Panel id="url">
            {renderUrlDownload()}
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
    </Card>
  );
};
