"use client";

import React, { useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Slider, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import {
  mediaOverlaysAtom,
  selectedOverlayIdAtom,
  selectedOverlayAtom,
  editorClipAtom,
  videoDurationAtom,
  generateOverlayId,
  MediaOverlay,
} from "@/store/videoEditor";
import { clipsAPI } from "@/api/clips";
import { CommentOverlayForm } from "./CommentOverlayForm";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok Comment",
  youtube: "YouTube Comment",
  instagram: "Instagram Comment",
};

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "simple-icons:tiktok",
  youtube: "simple-icons:youtube",
  instagram: "simple-icons:instagram",
};

export function OverlayTool() {
  const [overlays, setOverlays] = useAtom(mediaOverlaysAtom);
  const [selectedOverlayId, setSelectedOverlayId] = useAtom(selectedOverlayIdAtom);
  const selectedOverlay = useAtomValue(selectedOverlayAtom);
  const clip = useAtomValue(editorClipAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const videoDuration = useAtomValue(videoDurationAtom);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clip || !selectedTeam?.id) return;

    // Validate file type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      alert("Please upload an image or video file");
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      alert("File size must be less than 100MB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create blob URL for preview
      const url = URL.createObjectURL(file);

      // Get natural dimensions
      const dimensions = await getMediaDimensions(url, isImage);

      // Upload to S3
      const { uploadUrl, s3Key } = await clipsAPI.getOverlayUploadUrl(
        selectedTeam.id,
        clip.id,
        file.name,
        file.type
      );
      await clipsAPI.uploadOverlayToS3(uploadUrl, file, setUploadProgress);

      const newOverlay: MediaOverlay = {
        id: generateOverlayId(),
        type: isImage ? "image" : "video",
        s3Key,
        fileName: file.name,
        url,
        startTime: 0,
        endTime: videoDuration,
        x: 50,
        y: 50,
        scale: 0.5,
        opacity: 1,
        naturalWidth: dimensions.width,
        naturalHeight: dimensions.height,
      };

      setOverlays((prev) => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
    } catch (error) {
      console.error("Failed to upload overlay:", error);
      alert("Failed to upload overlay file");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getMediaDimensions = (
    url: string,
    isImage: boolean
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      if (isImage) {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 400, height: 400 });
        img.src = url;
      } else {
        const video = document.createElement("video");
        video.onloadedmetadata = () =>
          resolve({ width: video.videoWidth, height: video.videoHeight });
        video.onerror = () => resolve({ width: 400, height: 400 });
        video.src = url;
      }
    });
  };

  const handleRemoveOverlay = (id: string) => {
    const overlay = overlays.find((o) => o.id === id);
    if (overlay?.url) URL.revokeObjectURL(overlay.url);
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  const updateOverlay = (id: string, updates: Partial<MediaOverlay>) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getOverlayLabel = (overlay: MediaOverlay): string => {
    if (overlay.type === "comment" && overlay.commentData) {
      const text = overlay.commentData.commentText;
      return `@${overlay.commentData.username}: ${text.length > 25 ? text.slice(0, 25) + "..." : text}`;
    }
    return overlay.fileName;
  };

  const getOverlaySubtitle = (overlay: MediaOverlay): string => {
    if (overlay.type === "comment" && overlay.commentData) {
      return PLATFORM_LABELS[overlay.commentData.platform] || "Comment";
    }
    return overlay.type === "image" ? "Image" : "Video";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Icon icon="solar:layers-bold" className="text-accent-400" />
          Media Overlays
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Add images, videos, or comment overlays on top of your clip
        </p>
      </div>

      {/* Comment Overlay Form */}
      <CommentOverlayForm
        editingOverlayId={
          selectedOverlay?.type === "comment" ? selectedOverlayId : null
        }
      />

      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="bordered"
          className="w-full"
          onPress={() => fileInputRef.current?.click()}
          isLoading={uploading}
          startContent={!uploading && <Icon icon="solar:upload-bold" />}
        >
          {uploading ? `Uploading... ${uploadProgress}%` : "Add Image/Video Overlay"}
        </Button>
        <p className="text-xs text-text-tertiary mt-2 text-center">
          Images or videos (max 100MB)
        </p>
      </div>

      {/* Overlay List */}
      {overlays.length > 0 && (
        <div className="space-y-2">
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              onClick={() => setSelectedOverlayId(overlay.id)}
              className={`flex items-center justify-between rounded-lg p-2 cursor-pointer transition-colors ${
                selectedOverlayId === overlay.id
                  ? "bg-accent-400/20 ring-1 ring-accent-400"
                  : "bg-surface-elevated hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded bg-surface-base flex-shrink-0 overflow-hidden">
                  {overlay.type === "comment" && overlay.commentData ? (
                    <div className="w-full h-full flex items-center justify-center bg-blue-500/20">
                      <Icon
                        icon={PLATFORM_ICONS[overlay.commentData.platform] || "solar:chat-round-dots-bold"}
                        className="text-blue-400"
                      />
                    </div>
                  ) : overlay.type === "image" ? (
                    <img
                      src={overlay.url}
                      alt={overlay.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
                      <Icon icon="solar:videocamera-bold" className="text-purple-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{getOverlayLabel(overlay)}</p>
                  <p className="text-xs text-text-tertiary">
                    {getOverlaySubtitle(overlay)} &middot;{" "}
                    {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                isIconOnly
                onPress={() => handleRemoveOverlay(overlay.id)}
              >
                <Icon icon="solar:trash-bin-trash-bold" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Selected Overlay Controls */}
      {selectedOverlay && (
        <div className="bg-surface-elevated rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Icon icon="solar:settings-bold" className="text-text-secondary" />
            Overlay Settings
          </div>

          {/* Time Range */}
          <div>
            <div className="flex justify-between text-xs text-text-tertiary mb-2">
              <span>Time Range</span>
              <span>
                {formatTime(selectedOverlay.startTime)} - {formatTime(selectedOverlay.endTime)}
              </span>
            </div>
            <div className="flex gap-2">
              <Slider
                label="Start"
                value={selectedOverlay.startTime}
                onChange={(val) =>
                  updateOverlay(selectedOverlay.id, { startTime: val as number })
                }
                minValue={0}
                maxValue={selectedOverlay.endTime - 0.1}
                step={0.1}
                size="sm"
                color="secondary"
              />
              <Slider
                label="End"
                value={selectedOverlay.endTime}
                onChange={(val) =>
                  updateOverlay(selectedOverlay.id, { endTime: val as number })
                }
                minValue={selectedOverlay.startTime + 0.1}
                maxValue={videoDuration}
                step={0.1}
                size="sm"
                color="secondary"
              />
            </div>
          </div>

          {/* Position */}
          <div>
            <div className="flex justify-between text-xs text-text-tertiary mb-2">
              <span>Position</span>
              <span>
                X: {Math.round(selectedOverlay.x)}% Y: {Math.round(selectedOverlay.y)}%
              </span>
            </div>
            <Slider
              label="X"
              value={selectedOverlay.x}
              onChange={(val) =>
                updateOverlay(selectedOverlay.id, { x: val as number })
              }
              minValue={0}
              maxValue={100}
              step={1}
              size="sm"
              color="secondary"
            />
            <Slider
              label="Y"
              value={selectedOverlay.y}
              onChange={(val) =>
                updateOverlay(selectedOverlay.id, { y: val as number })
              }
              minValue={0}
              maxValue={100}
              step={1}
              size="sm"
              color="secondary"
              className="mt-2"
            />
          </div>

          {/* Scale */}
          <div>
            <div className="flex justify-between text-xs text-text-tertiary mb-2">
              <span>Scale</span>
              <span>{Math.round(selectedOverlay.scale * 100)}%</span>
            </div>
            <Slider
              value={selectedOverlay.scale}
              onChange={(val) =>
                updateOverlay(selectedOverlay.id, { scale: val as number })
              }
              minValue={0.1}
              maxValue={2.0}
              step={0.05}
              size="sm"
              color="secondary"
            />
          </div>

          {/* Opacity */}
          <div>
            <div className="flex justify-between text-xs text-text-tertiary mb-2">
              <span>Opacity</span>
              <span>{Math.round(selectedOverlay.opacity * 100)}%</span>
            </div>
            <Slider
              value={selectedOverlay.opacity}
              onChange={(val) =>
                updateOverlay(selectedOverlay.id, { opacity: val as number })
              }
              minValue={0}
              maxValue={1}
              step={0.05}
              size="sm"
              color="secondary"
            />
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon icon="solar:info-circle-bold" className="text-sm mt-0.5 flex-shrink-0" />
          <span>
            Overlays are composited on top of the video. Use position and scale to
            place them where you want. They appear behind heading and caption text.
          </span>
        </p>
      </div>
    </div>
  );
}
