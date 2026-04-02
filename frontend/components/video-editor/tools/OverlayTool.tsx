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
import { PLATFORM_LABELS, PLATFORM_ICONS } from "@/constants/comments";

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

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      alert("Please upload an image or video file");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      alert("File size must be less than 500MB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const url = URL.createObjectURL(file);

      const dimensions = await getMediaDimensions(url, isImage);

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
      <div>
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Icon icon="solar:layers-bold" className="text-accent-400" />
          Media Overlays
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Add images, videos, or comment overlays on top of your clip
        </p>
      </div>

      <CommentOverlayForm
        editingOverlayId={
          selectedOverlay?.type === "comment" ? selectedOverlayId : null
        }
      />

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          className="w-full"
          onPress={() => fileInputRef.current?.click()}
          isPending={uploading}
        >
          {!uploading && <Icon icon="solar:upload-bold" />}
          {uploading ? `Uploading... ${uploadProgress}%` : "Add Image/Video Overlay"}
        </Button>
        <p className="text-xs text-text-tertiary mt-2 text-center">
          Images or videos (max 500MB)
        </p>
      </div>

      {overlays.length > 0 && (
        <div className="space-y-2">
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              onClick={() => setSelectedOverlayId(overlay.id)}
              className={`flex items-center justify-between rounded-lg p-2 cursor-pointer transition-colors ${
                selectedOverlayId === overlay.id
                  ? "bg-accent-400/20 ring-1 ring-accent-400"
                  : "bg-white/[0.04] hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
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
                variant="danger-soft"
                isIconOnly
                onPress={() => handleRemoveOverlay(overlay.id)}
              >
                <Icon icon="solar:trash-bin-trash-bold" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {selectedOverlay && (
        <div className="bg-white/[0.04] rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="tertiary"
              size="sm"
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-text-secondary"
              onPress={() =>
                updateOverlay(selectedOverlay.id, {
                  opacity: selectedOverlay.opacity >= 1 ? 0.5 : 1,
                })
              }
              aria-label={selectedOverlay.opacity < 1 ? "Reset opacity" : "50% opacity"}
            >
              <Icon
                icon={selectedOverlay.opacity < 1 ? "solar:eye-closed-bold" : "solar:eye-bold"}
                className="text-lg"
              />
            </Button>
            <Slider
              value={selectedOverlay.opacity}
              onChange={(val) =>
                updateOverlay(selectedOverlay.id, { opacity: val as number })
              }
              minValue={0}
              maxValue={1}
              step={0.05}
              className="flex-1"
              aria-label="Opacity"
            >
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
            <span className="text-xs text-text-tertiary w-8 text-right tabular-nums">
              {Math.round(selectedOverlay.opacity * 100)}%
            </span>
          </div>

          <p className="text-[11px] text-text-tertiary text-center">
            Drag to move &middot; Corner handle to resize
          </p>
        </div>
      )}
    </div>
  );
}
