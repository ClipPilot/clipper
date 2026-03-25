"use client";

import React, { useRef, useEffect, useState } from "react";
import { Modal,
  Button,
  ProgressBar } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useVideoStream } from "@/hooks/useVideoStream";

interface Clip {
  id: number;
  team_id?: number;
  clip_score?: number;
  message?: string;
  prompt?: string;
  created_at: string;
  clipUrl?: string;
  title?: string;
}

interface PreviewClipViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip;
  onSave?: (clipId: number) => Promise<void>;
  onReject?: (clipId: number) => void;
  isSaving?: boolean;
}

export default function PreviewClipViewModal({
  isOpen,
  onClose,
  clip,
  onSave,
  onReject,
  isSaving = false,
}: PreviewClipViewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { blobUrl } = useVideoStream({
    isOpen,
    clipId: clip.id,
    teamId: clip.team_id,
    clipUrl: clip.clipUrl,
  });

  // Reset playback state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      videoRef.current.currentTime = percentage * duration;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "danger";
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave(clip.id);
      onClose();
    }
  };

  const handleReject = () => {
    if (onReject) {
      onReject(clip.id);
      onClose();
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container scroll="inside"><Modal.Dialog className="sm:max-w-2xl" onContextMenu={handleContextMenu}>
        <Modal.Header className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                icon="solar:eye-bold-duotone"
                className="text-xl text-warning-500"
              />
              <h2 className="text-xl font-bold text-text-accent">
                Preview Clip
              </h2>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Video Player - takes 3 columns */}
            <div className="lg:col-span-3 flex items-center justify-center isolate">
              {clip.clipUrl ? (
                <div
                  className="relative bg-black rounded-lg overflow-hidden w-full group"
                  onContextMenu={handleContextMenu}
                  style={{ userSelect: "none" }}
                >
                  {blobUrl ? (
                    <>
                      <video
                        key={`preview-video-${clip.id}`}
                        ref={videoRef}
                        src={blobUrl}
                        autoPlay
                        className="w-full max-h-[500px] object-contain"
                        playsInline
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        controlsList="nodownload noremoteplayback"
                        disablePictureInPicture
                      />

                      {/* Play/Pause overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={togglePlay}
                          className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
                        >
                          <Icon
                            icon={
                              isPlaying ? "solar:pause-bold" : "solar:play-bold"
                            }
                            className="text-3xl text-black ml-1"
                          />
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <div
                          className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-2"
                          onClick={handleSeek}
                        >
                          <div
                            className="h-full bg-accent-400 rounded-full transition-all"
                            style={{
                              width: `${(currentTime / duration) * 100 || 0}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-white text-xs">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {/* Preview badge */}
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1 z-10">
                        <Icon icon="solar:eye-bold" className="text-sm" />
                        <span>Preview</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3">
                      <Icon
                        icon="solar:spinner-bold"
                        className="text-4xl text-text-tertiary animate-spin"
                      />
                      <p className="text-sm text-text-tertiary">Loading video...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg bg-surface-elevated w-full h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <Icon
                      icon="solar:video-frame-play-vertical-bold-duotone"
                      className="text-6xl text-text-tertiary mb-2"
                    />
                    <p className="text-text-secondary">Video not available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Info Panel - takes 2 columns */}
            <div className="lg:col-span-2 space-y-4">
              {/* Score */}
              {clip.clip_score !== null && clip.clip_score !== undefined && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon
                      icon="solar:star-bold-duotone"
                      className="text-accent-400"
                    />
                    Virality Score
                  </h3>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-bold text-text-accent">
                      {clip.clip_score}
                    </span>
                    <span className="text-text-tertiary">/100</span>
                  </div>
                  <ProgressBar
 value={clip.clip_score}
 className="h-2"
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
                </div>
              )}

              {/* AI Analysis */}
              {clip.message && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon
                      icon="solar:chat-square-bold-duotone"
                      className="text-accent-400"
                    />
                    AI Analysis
                  </h3>
                  <p className="text-sm text-text-accent leading-relaxed">
                    {clip.message}
                  </p>
                </div>
              )}

              {/* Prompt Used */}
              {clip.prompt && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon
                      icon="solar:pen-bold-duotone"
                      className="text-accent-400"
                    />
                    Prompt Used
                  </h3>
                  <p className="text-sm text-text-accent leading-relaxed italic">
                    &quot;{clip.prompt}&quot;
                  </p>
                </div>
              )}

              {/* Info notice */}
              <div className="p-4 rounded-lg bg-warning-500/10 border border-warning-500/30">
                <div className="flex items-start gap-3">
                  <Icon
                    icon="solar:info-circle-bold"
                    className="text-xl text-warning-500 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="text-sm text-text-secondary">
                      This is a preview clip which you cannot download. Save the clip to
                      download it.
                    </p>
                  </div>
                </div>
              </div>

              {/* Created date */}
              <div className="p-4 rounded-lg bg-surface-elevated">
                <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                  <Icon
                    icon="solar:calendar-bold-duotone"
                    className="text-accent-400"
                  />
                  Created
                </h3>
                <p className="text-sm text-text-accent">
                  {new Date(clip.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="flex justify-between">
          <Button variant="tertiary" onPress={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            {onReject && (
              <Button
 variant="danger-soft"
 onPress={handleReject}
 isDisabled={isSaving}
 >
                <Icon icon="solar:close-circle-bold" />
                Reject
              </Button>
            )}
            {onSave && (
              <Button variant="primary"
 onPress={handleSave}
 isPending={isSaving}
 isDisabled={isSaving}
 >
                {!isSaving && <Icon icon="solar:diskette-bold" />}
                {isSaving ? "Saving..." : "Save Clip"}
                {!isSaving && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                      1 Credit
                    </span>
                  )}
</Button>
            )}
          </div>
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
