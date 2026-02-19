"use client";

import { useRef, useState, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Card, CardBody, Button, Input, Textarea, Progress, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneVideoAtom,
  adCloneProductImageAtom,
  adCloneProductNameAtom,
  adCloneProductDescriptionAtom,
  adCloneAdDirectionAtom,
  adCloneCanProceedAtom,
  adCloneProgressAtom,
  adCloneProgressMessageAtom,
  adCloneErrorAtom,
  resetAdCloneAtom,
} from "@/store/adClone";
import { videoAPI, VideoUrlInfo, VideoDownloadProgress } from "@/api/video";
import { fetchVideoAsFile, formatDuration, formatBytes } from "@/lib/videoUrlUtils";

const MAX_AD_DURATION = 180;

interface AdCloneUploadStepProps {
  teamId: number;
  onContinue?: () => Promise<void> | void;
}

export function AdCloneUploadStep({ teamId, onContinue }: AdCloneUploadStepProps) {
  const [video, setVideo] = useAtom(adCloneVideoAtom);
  const [productImage, setProductImage] = useAtom(adCloneProductImageAtom);
  const [productName, setProductName] = useAtom(adCloneProductNameAtom);
  const [productDescription, setProductDescription] = useAtom(adCloneProductDescriptionAtom);
  const [adDirection, setAdDirection] = useAtom(adCloneAdDirectionAtom);
  const canProceed = useAtomValue(adCloneCanProceedAtom);
  const progress = useAtomValue(adCloneProgressAtom);
  const progressMessage = useAtomValue(adCloneProgressMessageAtom);
  const error = useAtomValue(adCloneErrorAtom);
  const resetAdClone = useSetAtom(resetAdCloneAtom);

  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [videoDragging, setVideoDragging] = useState(false);
  const [imageDragging, setImageDragging] = useState(false);

  const [urlInput, setUrlInput] = useState("");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoUrlInfo | null>(null);
  const [isUrlDownloading, setIsUrlDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<VideoDownloadProgress | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleContinue = useCallback(async () => {
    if (typeof onContinue !== "function") return;
    setIsUploading(true);
    setLocalError(null);
    try {
      await onContinue();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setLocalError(errorMsg);
      setIsUploading(false);
    }
  }, [onContinue]);

  const handleVideoSelect = useCallback(
    (file: File) => {
      const validTypes = ["video/mp4", "video/quicktime", "video/webm"];
      if (!validTypes.includes(file.type)) return;

      if (video?.preview) URL.revokeObjectURL(video.preview);

      const preview = URL.createObjectURL(file);
      const videoEl = document.createElement("video");
      videoEl.src = preview;
      videoEl.onloadedmetadata = () => {
        const duration = videoEl.duration;
        if (duration > MAX_AD_DURATION) {
          URL.revokeObjectURL(preview);
          alert("Video too long. Maximum duration is 3 minutes.");
          return;
        }
        setVideo({ file, preview, duration });
      };
    },
    [video, setVideo]
  );

  const handleImageSelect = useCallback(
    (file: File) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) return;

      if (productImage?.preview) URL.revokeObjectURL(productImage.preview);

      const preview = URL.createObjectURL(file);
      setProductImage({ file, preview });
    },
    [productImage, setProductImage]
  );

  const handleVideoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setVideoDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleVideoSelect(file);
    },
    [handleVideoSelect]
  );

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setImageDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const clearVideo = () => {
    if (video?.preview) URL.revokeObjectURL(video.preview);
    setVideo(null);
  };

  const clearImage = () => {
    if (productImage?.preview) URL.revokeObjectURL(productImage.preview);
    setProductImage(null);
  };

  const handleFetchVideoInfo = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingInfo(true);
    setVideoInfo(null);
    setUrlError(null);

    try {
      const info = await videoAPI.getVideoInfo(urlInput.trim());
      if (info.duration > MAX_AD_DURATION) {
        setUrlError(`Video is ${formatDuration(info.duration)} long. Maximum is 3 minutes.`);
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
    setIsUrlDownloading(true);
    setDownloadProgress(null);
    setUrlError(null);

    try {
      const result = await videoAPI.downloadFromUrl(
        urlInput.trim(),
        teamId,
        (p) => setDownloadProgress(p)
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
        setVideo({ file, preview, duration: videoEl.duration });
        setIsUrlDownloading(false);
        setDownloadProgress(null);
        setUrlInput("");
        setVideoInfo(null);
      };
      videoEl.onerror = () => {
        URL.revokeObjectURL(preview);
        setUrlError("Failed to load downloaded video");
        setIsUrlDownloading(false);
        setDownloadProgress(null);
      };
    } catch (err: any) {
      setUrlError(err.message || "Failed to download video");
      setIsUrlDownloading(false);
      setDownloadProgress(null);
    }
  };

  const renderFileUpload = () => (
    <div
      className={`border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer ${
        videoDragging
          ? "border-orange-400 bg-orange-400/10"
          : "border-border-base hover:border-orange-400/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setVideoDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setVideoDragging(false);
      }}
      onDrop={handleVideoDrop}
      onClick={() => videoInputRef.current?.click()}
    >
      <div className="flex flex-col items-center space-y-3">
        <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center">
          <Icon icon="solar:upload-bold-duotone" className="text-2xl text-orange-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">Drop your ad video here</p>
          <p className="text-xs text-text-tertiary mt-1">MP4, MOV, WebM &bull; Max 3 minutes</p>
        </div>
      </div>
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleVideoSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );

  const renderUrlDownload = () => (
    <div className="flex flex-col space-y-4">
      {isUrlDownloading ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center">
            <Icon icon="solar:download-bold-duotone" className="text-2xl text-orange-400 animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-text-primary">
              {downloadProgress?.type === "uploading" ? "Importing Video..." : "Downloading Video"}
            </h3>
            {videoInfo && (
              <p className="text-xs text-text-tertiary mt-1">{videoInfo.title}</p>
            )}
          </div>
          <div className="w-full max-w-sm">
            <Progress
              value={downloadProgress?.type === "uploading" ? 100 : downloadProgress?.percent || 0}
              className="mb-2"
              classNames={{ indicator: "bg-orange-500", track: "bg-surface-base" }}
              isIndeterminate={downloadProgress?.type === "start" || downloadProgress?.type === "uploading"}
              showValueLabel={downloadProgress?.type === "progress"}
            />
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
              classNames={{
                inputWrapper: "bg-surface-elevated border border-border-base",
              }}
            />
            <Button
              variant="flat"
              className="bg-orange-500/20 text-orange-400"
              onPress={handleFetchVideoInfo}
              isLoading={isFetchingInfo}
              isDisabled={!urlInput.trim()}
            >
              Fetch
            </Button>
          </div>

          {videoInfo && (
            <div className="rounded-lg border border-border-base bg-surface-elevated p-3">
              <div className="flex gap-3">
                {videoInfo.thumbnail && (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-28 h-18 object-cover rounded-md flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary truncate">{videoInfo.title}</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    {videoInfo.uploader}
                    {videoInfo.platform && (
                      <span className="ml-2 px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded text-[10px]">
                        {videoInfo.platform}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-text-tertiary">
                    {videoInfo.duration > 0 && <span>{formatDuration(videoInfo.duration)}</span>}
                    {videoInfo.filesize > 0 && <span>~{formatBytes(videoInfo.filesize)}</span>}
                  </div>
                </div>
              </div>
              <Button
                className="w-full mt-3 bg-orange-500 text-white"
                onPress={handleUrlDownload}
                startContent={<Icon icon="solar:download-bold" />}
              >
                Download & Import
              </Button>
            </div>
          )}

          {urlError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Icon icon="solar:danger-triangle-bold" className="text-red-400 flex-shrink-0" width={16} />
              <p className="text-xs text-red-400">{urlError}</p>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-text-tertiary">
            <Icon icon="solar:info-circle-outline" className="text-base mt-0.5 flex-shrink-0" />
            <p>YouTube, Twitch, TikTok, Instagram &amp; 1000+ sites. Max 3 minutes.</p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Icon icon="solar:videocamera-record-bold-duotone" className="text-orange-400" width={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Reference Ad</h3>
                <p className="text-xs text-text-tertiary">Upload the ad you want to clone</p>
              </div>
            </div>

            {video ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video src={video.preview} className="w-full h-full object-contain" controls playsInline />
                </div>
                <div className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{video.file.name}</p>
                    <p className="text-xs text-text-tertiary">{Math.round(video.duration)}s</p>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-surface-base text-text-secondary"
                    onPress={clearVideo}
                    startContent={<Icon icon="solar:refresh-bold" width={16} />}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : isUrlDownloading ? (
              renderUrlDownload()
            ) : (
              <Tabs
                aria-label="Upload method"
                variant="underlined"
                classNames={{
                  tabList: "gap-4 w-full relative rounded-none p-0 border-b border-border-base mb-4",
                  cursor: "w-full bg-orange-500",
                  tab: "max-w-fit px-2 h-9",
                  tabContent: "group-data-[selected=true]:text-orange-400",
                }}
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
          </CardBody>
        </Card>

        <Card className="bg-surface-base border border-dashed border-border-base">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Icon icon="solar:box-bold-duotone" className="text-cyan-400" width={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-text-primary">Product Image</h3>
                <p className="text-xs text-text-tertiary">Your product to feature in the ad</p>
              </div>
              <span className="text-xs font-medium text-text-muted bg-surface-elevated px-2 py-1 rounded-md">Optional</span>
            </div>

            {productImage ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-surface-elevated aspect-square max-h-[240px] mx-auto">
                  <img src={productImage.preview} alt="Product" className="w-full h-full object-contain" />
                </div>
                <div className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
                  <p className="text-sm font-medium text-text-primary truncate flex-1">{productImage.file.name}</p>
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-surface-base text-text-secondary"
                    onPress={clearImage}
                    startContent={<Icon icon="solar:refresh-bold" width={16} />}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer ${
                  imageDragging
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-border-base hover:border-cyan-400/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setImageDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setImageDragging(false);
                }}
                onDrop={handleImageDrop}
                onClick={() => imageInputRef.current?.click()}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 bg-cyan-500/10 rounded-full flex items-center justify-center">
                    <Icon icon="solar:gallery-add-bold-duotone" className="text-2xl text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">Drop your product image</p>
                    <p className="text-xs text-text-tertiary mt-1">JPG, PNG, WebP</p>
                  </div>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="bg-surface-base border border-dashed border-border-base">
        <CardBody className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Icon icon="solar:document-text-bold-duotone" className="text-purple-400" width={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text-primary">Product Details</h3>
              <p className="text-xs text-text-tertiary">Tell us about your product</p>
            </div>
            <span className="text-xs font-medium text-text-muted bg-surface-elevated px-2 py-1 rounded-md">Optional</span>
          </div>

          <Input
            label="Product Name (optional)"
            placeholder="e.g., GlowSkin Serum"
            value={productName}
            onValueChange={setProductName}
            classNames={{
              inputWrapper: "bg-surface-elevated border-border-base",
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
          />

          <Textarea
            label="Product Description (optional)"
            placeholder="Describe your product, its key features, and benefits..."
            value={productDescription}
            onValueChange={setProductDescription}
            minRows={3}
            classNames={{
              inputWrapper: "bg-surface-elevated border-border-base",
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
          />

          <Textarea
            label="Ad Direction (optional)"
            placeholder="Describe the style and tone you want for your ad. E.g., 'Luxury feel with soft lighting, minimal text overlays, focus on the product texture...'"
            value={adDirection}
            onValueChange={setAdDirection}
            minRows={2}
            classNames={{
              inputWrapper: "bg-surface-elevated border-border-base",
              input: "text-text-primary",
              label: "text-text-secondary",
            }}
          />
        </CardBody>
      </Card>

      {(localError || error) && (
        <Card className="bg-red-500/10 border border-red-500/30">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon icon="solar:danger-triangle-bold" className="text-red-400" width={24} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-sm text-red-300">{localError || error}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {isUploading && (
        <Card className="bg-surface-elevated border border-border-base">
          <CardBody className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Icon icon="solar:upload-bold-duotone" className="text-orange-500 animate-pulse" width={24} />
              <span className="text-sm font-medium text-text-primary">
                {progressMessage || "Processing..."}
              </span>
            </div>
            <Progress
              value={progress}
              className="w-full"
              classNames={{
                indicator: "bg-orange-500",
                track: "bg-surface-base",
              }}
            />
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="flat"
          className="bg-surface-base text-text-secondary"
          onPress={() => resetAdClone()}
          isDisabled={isUploading}
          startContent={<Icon icon="solar:restart-bold" width={18} />}
        >
          Reset All
        </Button>
        <Button
          size="lg"
          isDisabled={!canProceed || isUploading}
          isLoading={isUploading}
          onPress={handleContinue}
          className="px-8 bg-orange-500 text-white"
          endContent={!isUploading ? <Icon icon="solar:arrow-right-linear" width={18} /> : undefined}
        >
          {isUploading ? "Uploading..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
