"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card,
  Button,
  Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import type { VideoGenerationStatus } from "@/api/ugc/video";
import type { UGCScene } from "@/components/ugc-studio/script/types";
import { FolderSelector } from "@/components/clips";

interface VideoPreviewProps {
  videoStatus: VideoGenerationStatus;
  scenes: UGCScene[];
  teamId: number;
  scriptId: string;
  onFinalize: (folderId: number | null) => void;
  isFinalizing: boolean;
}

export function VideoPreview({
  videoStatus,
  scenes,
  teamId,
  scriptId,
  onFinalize,
  isFinalizing,
}: VideoPreviewProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);

  const isFinalized = !!videoStatus.clipId;

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-accent mb-1">
            Video Preview
          </h2>
          <p className="text-text-secondary text-sm">
            {isFinalized
              ? "This video has been saved to your library"
              : "Review your video and make any edits before finalizing"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
 className="bg-accent-400 text-white font-semibold"
 onPress={isFinalized ? () => router.push(`/dashboard/clips/${videoStatus.clipId}/edit`) : () => onFinalize(selectedFolderId)}
 isPending={isFinalizing}
 isDisabled={isFinalizing}
 >
            {!isFinalizing && <Icon icon={isFinalized ? "solar:pen-bold" : "solar:check-circle-bold"} width={16} />}
            {isFinalizing ? "Finalizing..." : isFinalized ? "Edit" : "Finalize & Save"}
          </Button>
        </div>
      </div>

      {/* Main video player */}
      <Card className="bg-surface-elevated border border-border-base overflow-hidden">
        <Card.Content className="p-0">
          <div className="relative aspect-[9/16] max-h-[70vh] mx-auto bg-black">
            {videoStatus.finalVideoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoStatus.finalVideoUrl}
                  className="w-full h-full object-contain"
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                />

                {/* Play overlay (only shows when paused and no native controls visible) */}
                {!isPlaying && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
                    onClick={handlePlayPause}
                  >
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Icon
                        icon="solar:play-bold"
                        className="text-white ml-1"
                        width={36}
                      />
                    </div>
                  </motion.button>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size="lg" color="accent" />
              </div>
            )}
          </div>

          {/* Video info bar */}
          <div className="p-4 border-t border-border-base bg-surface-base">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Icon
                    icon="solar:clock-circle-bold"
                    className="text-text-muted"
                    width={16}
                  />
                  <span className="text-sm text-text-secondary">
                    {videoStatus.totalDurationSeconds
                      ? formatDuration(videoStatus.totalDurationSeconds)
                      : "--:--"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="solar:clapperboard-bold"
                    className="text-text-muted"
                    width={16}
                  />
                  <span className="text-sm text-text-secondary">
                    {scenes.length} scenes
                  </span>
                </div>
              </div>
              {!isFinalized && (
                <div className="flex items-center gap-2">
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-accent-400"
                    width={16}
                  />
                  <span className="text-sm text-accent-400 font-medium">
                    Ready to finalize
                  </span>
                </div>
              )}
              {isFinalized && (
                <div className="flex items-center gap-2">
                  <Icon
                    icon="solar:verified-check-bold"
                    className="text-green-400"
                    width={16}
                  />
                  <span className="text-sm text-green-400 font-medium">
                    Saved to library
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Script used */}
      {scenes.length > 0 && (
        <Card className="bg-surface-elevated border border-border-base">
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Icon
                icon="solar:document-text-bold-duotone"
                className="text-accent-400"
                width={20}
              />
              <h3 className="text-lg font-semibold text-text-accent">
                Script Used
              </h3>
            </div>
            <div className="space-y-3">
              {scenes.map((scene, index) => (
                <motion.div
                  key={scene.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-3 p-3 rounded-lg bg-surface-base"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-400/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-accent-400">
                      {scene.sceneNumber}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-text-muted uppercase">
                        {scene.sceneType || "Scene"}
                      </span>
                      <span className="text-xs text-text-muted">•</span>
                      <span className="text-xs text-text-muted">
                        {scene.estimatedDurationSeconds || (scene as any).durationSeconds || 5}s
                      </span>
                    </div>
                    <p className="text-sm text-text-accent leading-relaxed">
                      "{scene.dialogue}"
                    </p>
                    {scene.action && (
                      <p className="text-xs text-text-muted mt-1 italic">
                        {scene.action}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {!isFinalized && (
        <>
          {/* Folder Selection */}
          <Card className="bg-surface-elevated border border-border-base">
            <Card.Content className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center flex-shrink-0">
                  <Icon
                    icon="solar:folder-bold-duotone"
                    className="text-accent-400"
                    width={20}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-accent mb-2">
                    Save to folder (optional)
                  </p>
                  <FolderSelector
                    teamId={teamId}
                    selectedFolderId={selectedFolderId}
                    onFolderSelect={setSelectedFolderId}
                    placeholder="Root (no folder)"
                    size="sm"
                  />
                </div>
              </div>
            </Card.Content>
          </Card>

          <Card className="bg-surface-elevated border border-border-base">
            <Card.Content className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon
                    icon="solar:info-circle-bold-duotone"
                    className="text-blue-400"
                    width={20}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-accent mb-1">
                    What happens when you finalize?
                  </p>
                  <p className="text-xs text-text-secondary">
                    Your video will be saved to your &quot;My Clips&quot; library where you can
                    add captions, text overlays, and make further edits using the clip editor.
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>
        </>
      )}

    </div>
  );
}
