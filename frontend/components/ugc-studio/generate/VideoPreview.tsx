"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import type { VideoGenerationStatus } from "@/api/ugc/video";
import type { UGCScene } from "@/components/ugc-studio/script/types";
import { useUsageStats } from "@/hooks/useUsageStats";
import { ugcVideoAPI } from "@/api/ugc/video";

interface VideoPreviewProps {
  videoStatus: VideoGenerationStatus;
  scenes: UGCScene[];
  teamId: number;
  scriptId: string;
  onFinalize: () => void;
  onRegenerate: () => void;
  isFinalizing: boolean;
}

const SCENE_EDIT_CREDIT_COST = 3;

export function VideoPreview({
  videoStatus,
  scenes,
  teamId,
  scriptId,
  onFinalize,
  onRegenerate,
  isFinalizing,
}: VideoPreviewProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [isRegeneratingScene, setIsRegeneratingScene] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const { usageStats } = useUsageStats(teamId);
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

  const handleEditSceneClick = (sceneId: string) => {
    if (!usageStats || usageStats.totalRemaining < SCENE_EDIT_CREDIT_COST) {
      setSceneError(
        `Not enough credits. You need ${SCENE_EDIT_CREDIT_COST} credits to edit a scene.`
      );
      return;
    }
    setEditingSceneId(sceneId);
    setShowEditConfirm(true);
    setSceneError(null);
  };

  const handleConfirmEditScene = async () => {
    if (!editingSceneId || !videoStatus.jobId) return;

    setIsRegeneratingScene(true);
    setSceneError(null);

    try {
      await ugcVideoAPI.regenerateScene({
        jobId: videoStatus.jobId,
        sceneId: editingSceneId,
        teamId,
      });

      // The scene regeneration will create a new job - for now, just close the modal
      // In a full implementation, you'd poll for the scene regeneration status
      setShowEditConfirm(false);
      setEditingSceneId(null);

      // Trigger a full regeneration since we need to reassemble the video
      onRegenerate();
    } catch (err) {
      setSceneError(
        err instanceof Error ? err.message : "Failed to regenerate scene"
      );
    } finally {
      setIsRegeneratingScene(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSceneVideo = (sceneId: string) => {
    return videoStatus.sceneVideos?.find((sv) => sv.sceneId === sceneId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">
            Video Preview
          </h2>
          <p className="text-text-secondary text-sm">
            {isFinalized
              ? "This video has been saved to your library"
              : "Review your video and make any edits before finalizing"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isFinalized && (
            <Button
              variant="bordered"
              className="border-border-base text-text-secondary"
              onPress={onRegenerate}
              startContent={<Icon icon="solar:refresh-bold" width={16} />}
            >
              Regenerate
            </Button>
          )}
          <Button
            className="bg-accent-400 text-white font-semibold"
            onPress={isFinalized ? () => router.push(`/dashboard/clips/${videoStatus.clipId}/edit`) : onFinalize}
            isLoading={isFinalizing}
            isDisabled={isFinalizing}
            startContent={
              !isFinalizing && <Icon icon={isFinalized ? "solar:pen-bold" : "solar:check-circle-bold"} width={16} />
            }
          >
            {isFinalizing ? "Finalizing..." : isFinalized ? "Edit" : "Finalize & Save"}
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {sceneError && (
        <Card className="bg-red-500/10 border border-red-500/30">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon
                icon="solar:danger-triangle-bold"
                className="text-red-400"
                width={24}
              />
              <p className="text-red-400 text-sm">{sceneError}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Main video player */}
      <Card className="bg-surface-elevated border border-border-base overflow-hidden">
        <CardBody className="p-0">
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
                <Spinner size="lg" color="primary" />
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
        </CardBody>
      </Card>

      {/* Script used */}
      {scenes.length > 0 && (
        <Card className="bg-surface-elevated border border-border-base">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Icon
                icon="solar:document-text-bold-duotone"
                className="text-accent-400"
                width={20}
              />
              <h3 className="text-lg font-semibold text-text-primary">
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
                    <p className="text-sm text-text-primary leading-relaxed">
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
          </CardBody>
        </Card>
      )}

      {!isFinalized && (
        <Card className="bg-surface-elevated border border-border-base">
          <CardBody className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Icon
                  icon="solar:info-circle-bold-duotone"
                  className="text-blue-400"
                  width={20}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">
                  What happens when you finalize?
                </p>
                <p className="text-xs text-text-secondary">
                  Your video will be saved to your &quot;My Clips&quot; library where you can
                  add captions, text overlays, and make further edits using the clip editor.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Edit Scene Confirmation Modal */}
      <Modal
        isOpen={showEditConfirm}
        onClose={() => {
          setShowEditConfirm(false);
          setEditingSceneId(null);
        }}
        classNames={{
          base: "bg-surface-elevated border border-border-base",
          header: "border-b border-border-base",
          footer: "border-t border-border-base",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-text-primary">Regenerate Scene</span>
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Icon
                  icon="solar:refresh-bold-duotone"
                  className="text-purple-400"
                  width={32}
                />
              </div>
              <p className="text-text-primary mb-2">
                This will use{" "}
                <span className="font-bold text-purple-400">
                  {SCENE_EDIT_CREDIT_COST} credits
                </span>
              </p>
              <p className="text-sm text-text-secondary">
                The scene will be regenerated with new AI animation. This may take
                a few minutes and the entire video will need to be reassembled.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              className="border-border-base text-text-secondary"
              onPress={() => {
                setShowEditConfirm(false);
                setEditingSceneId(null);
              }}
              isDisabled={isRegeneratingScene}
            >
              Cancel
            </Button>
            <Button
              className="bg-purple-500 text-white font-semibold"
              onPress={handleConfirmEditScene}
              isLoading={isRegeneratingScene}
              isDisabled={isRegeneratingScene}
              startContent={
                !isRegeneratingScene && (
                  <Icon icon="solar:refresh-bold" width={16} />
                )
              }
            >
              {isRegeneratingScene ? "Regenerating..." : "Regenerate Scene"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
