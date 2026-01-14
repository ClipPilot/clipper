"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
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
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { BrandLogo } from "@/components/brand-logo";
import {
  scriptsAtom,
  selectedVariantIndexAtom,
  selectedVoiceAtom,
  videoJobIdAtom,
  videoStatusAtom,
} from "@/store/ugc";
import { ugcVideoAPI, VideoGenerationStatus } from "@/api/ugc/video";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useUGCVideoSocket } from "@/hooks/useUGCVideoSocket";
import { VideoLoadingAnimation } from "./VideoLoadingAnimation";

interface GenerateVideoStepProps {
  teamId: number;
  scriptId: string;
}

type StepState = "ready" | "confirming" | "generating" | "finalizing";

const GENERATE_CREDIT_COST = 15;
const SCENE_EDIT_CREDIT_COST = 3;
const FALLBACK_POLL_INTERVAL = 10000; // Fallback polling every 10s if socket fails

export function GenerateVideoStep({ teamId, scriptId }: GenerateVideoStepProps) {
  const router = useRouter();
  const scripts = useAtomValue(scriptsAtom);
  const selectedVariantIndex = useAtomValue(selectedVariantIndexAtom);
  const selectedVoice = useAtomValue(selectedVoiceAtom);
  const [jobId, setJobId] = useAtom(videoJobIdAtom);
  const [videoStatus, setVideoStatus] = useAtom(videoStatusAtom);

  const { usageStats, refetch: refetchUsage } = useUsageStats(teamId);

  const [stepState, setStepState] = useState<StepState>("ready");
  const [error, setError] = useState<string | null>(null);

  const currentScript = scripts[selectedVariantIndex];
  const scenes = currentScript?.scenes || [];
  const totalScenes = scenes.length;

  // Track last socket update for fallback polling
  const lastSocketUpdateRef = useRef<number>(0);

  // Auto-finalize and redirect to edit when complete
  const autoFinalizeAndRedirect = useCallback(async (completedJobId: string) => {
    setStepState("finalizing");
    try {
      const response = await ugcVideoAPI.finalizeVideo({
        jobId: completedJobId,
        teamId,
      });
      router.push(`/dashboard/clips/${response.clipId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize video");
      setStepState("ready");
    }
  }, [teamId, router]);

  // Check for existing video on mount - but only if we haven't intentionally skipped
  useEffect(() => {
    // Check sessionStorage flag set by ScriptStep when loading saved script or creating new
    const skipFlag = sessionStorage.getItem("skipLoadExistingVideo");
    if (skipFlag === scriptId) {
      sessionStorage.removeItem("skipLoadExistingVideo");
      console.log("[GenerateVideoStep] Skipping existing video load for reused script");
      return;
    }

    // Already have video status - auto-finalize and redirect
    if (videoStatus?.status === "completed" && videoStatus.jobId) {
      autoFinalizeAndRedirect(videoStatus.jobId);
      return;
    }

    // Don't fetch if we already have status or are not in ready state
    if (videoStatus !== null || stepState !== "ready") return;

    const checkExistingVideo = async () => {
      try {
        const existingVideo = await ugcVideoAPI.getScriptVideo(scriptId);
        if (existingVideo && existingVideo.videoUrl) {
          // Auto-finalize and redirect instead of showing preview
          autoFinalizeAndRedirect(existingVideo.jobId);
        }
      } catch {
        // No existing video - that's fine
      }
    };

    checkExistingVideo();
  }, [scriptId, videoStatus, stepState, autoFinalizeAndRedirect]);

  // Socket-based real-time updates
  const handleSocketUpdate = useCallback((status: VideoGenerationStatus) => {
    lastSocketUpdateRef.current = Date.now();
    setVideoStatus(status);

    if (status.status === "completed") {
      refetchUsage();
      // Auto-finalize and go directly to edit - skip preview
      if (status.jobId) {
        autoFinalizeAndRedirect(status.jobId);
      }
    } else if (status.status === "failed") {
      setError(status.error || "Video generation failed");
      setStepState("ready");
    }
  }, [setVideoStatus, refetchUsage, autoFinalizeAndRedirect]);

  // Connect to socket when generating
  useUGCVideoSocket({
    teamId: stepState === "generating" ? teamId : undefined,
    jobId: stepState === "generating" ? jobId : null,
    onUpdate: handleSocketUpdate,
  });

  // Fallback polling if socket updates stop (only when generating)
  useEffect(() => {
    if (!jobId || stepState !== "generating") return;

    let mounted = true;
    const pollStatus = async () => {
      // Skip if we received a socket update recently
      const timeSinceLastUpdate = Date.now() - lastSocketUpdateRef.current;
      if (timeSinceLastUpdate < FALLBACK_POLL_INTERVAL) {
        return;
      }

      console.log("[GenerateVideoStep] Socket silent, falling back to polling");
      try {
        const status = await ugcVideoAPI.getVideoStatus(jobId);
        if (!mounted) return;

        handleSocketUpdate(status);
      } catch (err) {
        console.error("Failed to poll video status:", err);
      }
    };

    // Initial fetch to get current state
    pollStatus();

    // Fallback polling at slower interval
    const interval = setInterval(pollStatus, FALLBACK_POLL_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [jobId, stepState, handleSocketUpdate]);

  const handleGenerateClick = () => {
    if (!usageStats || usageStats.totalRemaining < GENERATE_CREDIT_COST) {
      setError(`Not enough credits. You need ${GENERATE_CREDIT_COST} credits to generate a video.`);
      return;
    }
    setStepState("confirming");
  };

  const handleConfirmGenerate = async () => {
    if (!selectedVoice) {
      setError("Please select a voice first");
      return;
    }

    setError(null);
    setStepState("generating");

    try {
      const response = await ugcVideoAPI.generateVideo({
        teamId,
        scriptId,
        voiceId: selectedVoice.id,
      });

      setJobId(response.jobId);
      setVideoStatus({
        jobId: response.jobId,
        status: "queued",
        progress: 0,
        progressMessage: "Queued for video generation...",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start video generation");
      setStepState("ready");
    }
  };


  if (!currentScript || scenes.length === 0) {
    return (
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="py-16 flex flex-col items-center justify-center text-center">
          <Icon
            icon="solar:danger-triangle-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No Script Found
          </h3>
          <p className="text-text-secondary text-sm">
            Please go back and generate a script first
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!selectedVoice) {
    return (
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="py-16 flex flex-col items-center justify-center text-center">
          <Icon
            icon="solar:soundwave-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No Voice Selected
          </h3>
          <p className="text-text-secondary text-sm">
            Please go back and select a voice first
          </p>
        </CardBody>
      </Card>
    );
  }

  // Generating or Finalizing state - show loading animation
  if (stepState === "generating" || stepState === "finalizing") {
    const finalizingStatus = stepState === "finalizing" ? {
      jobId: jobId || "",
      status: "completed" as const,
      progress: 100,
      progressMessage: "Finalizing and preparing editor...",
    } : videoStatus;

    return (
      <VideoLoadingAnimation
        status={finalizingStatus}
        totalScenes={totalScenes}
        onCancel={() => {
          // Return to the AI Video Creator menu - job continues in background
          router.push("/dashboard/ugc-studio/ai-video-creator");
        }}
      />
    );
  }

  // Ready state - show summary and generate button
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Generate Your Video
        </h2>
        <p className="text-text-secondary">
          Ready to bring your script to life with AI video generation
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <Card className="bg-red-500/10 border border-red-500/30">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon icon="solar:danger-triangle-bold" className="text-red-400" width={24} />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Summary Card */}
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Video Summary</h3>

          <div className="space-y-4">
            {/* Script Info */}
            <div className="flex items-center gap-3 p-3 bg-surface-base rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                <Icon icon="solar:document-text-bold-duotone" className="text-accent-400" width={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Script</p>
                <p className="text-xs text-text-secondary">
                  {currentScript.title || "Untitled Script"} • {totalScenes} scenes
                </p>
              </div>
            </div>

            {/* Voice Info */}
            <div className="flex items-center gap-3 p-3 bg-surface-base rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Icon icon="solar:soundwave-bold-duotone" className="text-purple-400" width={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Voice</p>
                <p className="text-xs text-text-secondary">
                  {selectedVoice.name} • {selectedVoice.gender}
                </p>
              </div>
            </div>

            {/* Estimated Duration */}
            <div className="flex items-center gap-3 p-3 bg-surface-base rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Icon icon="solar:clock-circle-bold-duotone" className="text-blue-400" width={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Estimated Duration</p>
                <p className="text-xs text-text-secondary">
                  {Math.ceil(scenes.reduce((acc, s) => acc + (s.estimatedDurationSeconds || (s as any).durationSeconds || 5), 0))} seconds
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Credit Cost Card */}
      <Card className="bg-gradient-to-br from-accent-400/20 to-purple-500/20 border border-accent-400/30">
        <CardBody className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent-400/30 flex items-center justify-center">
                <Icon icon="solar:stars-bold-duotone" className="text-accent-400" width={28} />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">
                  {GENERATE_CREDIT_COST} Credits
                </p>
                <p className="text-sm text-text-secondary">
                  {usageStats
                    ? `You have ${usageStats.totalRemaining} credits remaining`
                    : "Loading credits..."}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="bg-accent-400 text-white font-semibold px-8"
              onPress={handleGenerateClick}
              isDisabled={!usageStats || usageStats.totalRemaining < GENERATE_CREDIT_COST}
              startContent={<Icon icon="solar:play-bold" width={20} />}
            >
              Generate Video
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* What happens section */}
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">What happens next?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent-400">1</span>
              </div>
              <p className="text-sm text-text-secondary">
                AI generates voice-over audio for each scene using {selectedVoice.name}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent-400">2</span>
              </div>
              <p className="text-sm text-text-secondary">
                Each scene image is animated into a video clip with realistic motion
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent-400">3</span>
              </div>
              <p className="text-sm text-text-secondary">
                Video clips are assembled with audio into your final video
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent-400">4</span>
              </div>
              <p className="text-sm text-text-secondary">
                Preview your video and optionally edit individual scenes (3 credits each)
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={stepState === "confirming"}
        onClose={() => setStepState("ready")}
        classNames={{
          base: "bg-surface-elevated border border-border-base",
          header: "border-b border-border-base",
          footer: "border-t border-border-base",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-text-primary">Confirm Video Generation</span>
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <BrandLogo size={64} />
              </div>
              <p className="text-text-primary mb-2">
                This will use <span className="font-bold text-accent-400">{GENERATE_CREDIT_COST} credits</span>
              </p>
              <p className="text-sm text-text-secondary">
                You&apos;ll have {usageStats ? usageStats.totalRemaining - GENERATE_CREDIT_COST : 0} credits remaining
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              className="border-border-base text-text-secondary"
              onPress={() => setStepState("ready")}
            >
              Cancel
            </Button>
            <Button
              className="bg-accent-400 text-white font-semibold"
              onPress={handleConfirmGenerate}
              startContent={<Icon icon="solar:play-bold" width={16} />}
            >
              Generate Video
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
