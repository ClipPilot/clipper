"use client";

import { useRef, useState, useCallback } from "react";
import { Button, Card, Input, ProgressBar, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { MultiSegmentTrimmer, VideoSegment } from "./multi-segment";
import { UploadedFile } from "./types";
import { videoAPI, VideoUrlInfo, VideoDownloadProgress } from "@/api/video";
import { fetchVideoAsFile, formatDuration, formatBytes } from "@/lib/videoUrlUtils";

const MAX_UPLOAD_DURATION = 300;

interface VideoUploadCardProps {
  video: UploadedFile | null;
  videoDuration: number;
  segments: VideoSegment[];
  onVideoChange: (video: UploadedFile | null, duration: number) => void;
  onSegmentsChange: (segments: VideoSegment[]) => void;
  showEditor?: boolean;
  onToggleEditor?: () => void;
  teamId?: number;
}

export function VideoUploadCard({
  video,
  videoDuration,
  segments,
  onVideoChange,
  onSegmentsChange,
  showEditor = false,
  onToggleEditor,
  teamId,
}: VideoUploadCardProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [urlInput, setUrlInput] = useState("");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoUrlInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<VideoDownloadProgress | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleVideoSelect = useCallback(
    async (file: File) => {
      const validTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
      if (!validTypes.includes(file.type)) return;

      if (video?.preview) URL.revokeObjectURL(video.preview);

      const preview = URL.createObjectURL(file);
      const videoEl = document.createElement("video");
      videoEl.src = preview;
      videoEl.onloadedmetadata = () => {
        const dur = videoEl.duration;
        if (dur > MAX_UPLOAD_DURATION) {
          URL.revokeObjectURL(preview);
          alert("Video too long. Maximum upload duration is 5 minutes.");
          return;
        }
        onVideoChange({ file, preview }, dur);
        onSegmentsChange([{ id: crypto.randomUUID(), start: 0, end: Math.min(dur, 60) }]);
      };
    },
    [video, onVideoChange, onSegmentsChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleVideoSelect(file);
    },
    [handleVideoSelect]
  );

  const handleClear = () => {
    if (video?.preview) URL.revokeObjectURL(video.preview);
    onVideoChange(null, 0);
    onSegmentsChange([]);
  };

  const handleFetchVideoInfo = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingInfo(true);
    setVideoInfo(null);
    setUrlError(null);

    try {
      const info = await videoAPI.getVideoInfo(urlInput.trim());
      if (info.duration > MAX_UPLOAD_DURATION) {
        setUrlError(`Video is ${formatDuration(info.duration)} long. Maximum is 5 minutes.`);
        return;
      }
      setVideoInfo(info);
    } catch (err: any) {
      setUrlError(err.message || "Failed to fetch video info");
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleUrlDownload = async () => {
    if (!urlInput.trim() || !teamId) return;
    setIsDownloading(true);
    setDownloadProgress(null);
    setUrlError(null);

    try {
      const result = await videoAPI.downloadFromUrl(
        urlInput.trim(),
        teamId,
        (progress) => setDownloadProgress(progress)
      );

      if (!result.downloadUrl) {
        throw new Error("No download URL received");
      }

      setDownloadProgress({ type: "uploading", message: "Importing video..." });
      const file = await fetchVideoAsFile(result.downloadUrl, result.fileName);
      const preview = URL.createObjectURL(file);

      const videoEl = document.createElement("video");
      videoEl.src = preview;
      videoEl.onloadedmetadata = () => {
        const dur = videoEl.duration;
        onVideoChange({ file, preview }, dur);
        onSegmentsChange([{ id: crypto.randomUUID(), start: 0, end: Math.min(dur, 60) }]);
        setIsDownloading(false);
        setDownloadProgress(null);
        setUrlInput("");
        setVideoInfo(null);
      };
      videoEl.onerror = () => {
        URL.revokeObjectURL(preview);
        setUrlError("Failed to load downloaded video");
        setIsDownloading(false);
        setDownloadProgress(null);
      };
    } catch (err: any) {
      setUrlError(err.message || "Failed to download video");
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const renderFileUpload = () => (
    <div
      className={`border-2 border-dashed rounded-xl p-12 transition-colors ${
        isDragging
          ? "border-accent-400 bg-accent-400/10"
          : "border-border-base hover:border-accent-400/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 bg-accent-400/10 rounded-full flex items-center justify-center">
          <Icon icon="solar:upload-bold-duotone" className="text-3xl text-accent-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-text-accent">Drag & drop your video</p>
          <p className="text-sm text-text-tertiary mt-1">or click to browse files</p>
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleVideoSelect(file);
            e.target.value = "";
          }}
        />
        <Button
 size="md"
 variant="tertiary"
 onPress={() => videoInputRef.current?.click()}
 >
          <Icon icon="solar:folder-open-bold" />
          Browse Files
        </Button>
        <p className="text-xs text-text-muted">MP4, MOV, WebM supported</p>
      </div>
    </div>
  );

  const renderUrlDownload = () => (
    <div className="flex flex-col space-y-4">
      {isDownloading ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="w-16 h-16 bg-accent-400/10 rounded-full flex items-center justify-center">
            <Icon icon="solar:download-bold-duotone" className="text-3xl text-accent-400 animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-semibold text-text-accent">
              {downloadProgress?.type === "uploading" ? "Importing Video..." : "Downloading Video"}
            </h3>
            {videoInfo && (
              <p className="text-sm text-text-tertiary mt-1">{videoInfo.title}</p>
            )}
          </div>
          <div className="w-full max-w-sm">
            <ProgressBar
 value={downloadProgress?.type === "uploading" ? 100 : downloadProgress?.percent || 0}
 className="mb-2"
 isIndeterminate={downloadProgress?.type === "start" || downloadProgress?.type === "uploading"}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
            <div className="flex justify-between text-xs text-text-tertiary">
              <span>
                {downloadProgress?.type === "uploading"
                  ? "Importing..."
                  : downloadProgress?.type === "progress"
                    ? `${downloadProgress.percent?.toFixed(1)}%`
                    : "Starting..."}
              </span>
              <span>{downloadProgress?.speed || ""}</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
 placeholder="Paste video URL (YouTube, TikTok, etc.)"
 value={urlInput}
 onChange={(e) => setUrlInput(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter" && urlInput.trim()) handleFetchVideoInfo();
 }}
 startContent={<Icon icon="solar:link-bold" className="text-text-tertiary" />}
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
                  <h4 className="text-sm font-semibold text-text-accent truncate">{videoInfo.title}</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    {videoInfo.uploader}
                    {videoInfo.platform && (
                      <span className="ml-2 px-1.5 py-0.5 bg-accent-400/10 text-accent-400 rounded text-[10px]">
                        {videoInfo.platform}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                    {videoInfo.duration > 0 && <span>{formatDuration(videoInfo.duration)}</span>}
                    {videoInfo.filesize > 0 && <span>~{formatBytes(videoInfo.filesize)}</span>}
                  </div>
                </div>
              </div>
              <Button variant="primary"
 className="w-full mt-4"
 onPress={handleUrlDownload}
 isDisabled={!teamId}
 >
                <Icon icon="solar:download-bold" />
                Download & Import
              </Button>
            </div>
          )}

          {urlError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Icon icon="solar:danger-triangle-bold" className="text-red-400 flex-shrink-0" width={18} />
              <p className="text-sm text-red-400">{urlError}</p>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-text-tertiary">
            <Icon icon="solar:info-circle-outline" className="text-base mt-0.5 flex-shrink-0" />
            <p>Supports YouTube, Twitch, Kick, TikTok, Instagram, and 1000+ sites. Max 5 minutes.</p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Card className="bg-surface-base border border-border-base">
      <Card.Header className="pb-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
            <Icon icon="solar:videocamera-record-bold-duotone" className="text-accent-400" width={22} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-text-accent">Video & Trim</h3>
            <p className="text-xs text-text-tertiary">Upload video and select clips (max 60s total)</p>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="pt-4">
        {video ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-2 bg-surface-elevated rounded-lg">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-accent truncate">{video.file.name}</p>
                <p className="text-xs text-text-tertiary">
                  {Math.round(videoDuration)}s {!showEditor && "\u2022 Ready for auto-detect"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onToggleEditor && (
                  <Button
 size="sm"
 variant="tertiary"
 className={showEditor ? "bg-purple-500/20 text-purple-400" : "bg-surface-base text-text-secondary"}
 onPress={onToggleEditor}
 >
                    <Icon icon={showEditor ? "solar:minimize-square-bold" : "solar:tuning-2-bold"} width={16} />
                    {showEditor ? "Hide Editor" : "Manual Edit"}
                  </Button>
                )}
                <Button
 size="sm"
 variant="tertiary"
 className="bg-surface-base text-text-secondary"
 onPress={handleClear}
 >
                  <Icon icon="solar:refresh-bold" width={16} />
                  Change
                </Button>
              </div>
            </div>

            {!showEditor && (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video src={video.preview} className="w-full h-full object-contain" controls playsInline />
              </div>
            )}

            {showEditor && (
              <MultiSegmentTrimmer
                videoSrc={video.preview}
                videoFile={video.file}
                duration={videoDuration}
                segments={segments}
                onSegmentsChange={onSegmentsChange}
                maxTotalDuration={60}
                maxSegments={5}
              />
            )}
          </div>
        ) : isDownloading ? (
          renderUrlDownload()
        ) : (
          <Tabs
 aria-label="Upload method"
 >
            <Tab
              key="file"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:upload-bold" />
                  <span>Upload File</span>
                </div>
              }
            >
              {renderFileUpload()}
            </Tab>
            <Tab
              key="url"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:link-bold" />
                  <span>Paste URL</span>
                </div>
              }
            >
              {renderUrlDownload()}
            </Tab>
          </Tabs>
        )}
      </Card.Content>
    </Card>
  );
}
