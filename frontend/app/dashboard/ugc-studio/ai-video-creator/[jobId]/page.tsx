"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAtomValue } from "jotai";
import { Card, CardBody, Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import {
  ugcVideoAPI,
  VideoGenerationStatus,
} from "@/api/ugc/video";
import { ugcScriptAPI } from "@/api/ugc";
import { VideoPreview } from "@/components/ugc-studio/generate/VideoPreview";
import { VideoLoadingAnimation } from "@/components/ugc-studio/generate/VideoLoadingAnimation";
import { useUGCVideoSocket } from "@/hooks/useUGCVideoSocket";
import type { UGCScene } from "@/components/ugc-studio/script/types";

export default function VideoJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoGenerationStatus | null>(
    null
  );
  const [scenes, setScenes] = useState<UGCScene[]>([]);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Fetch job status and script data on mount
  useEffect(() => {
    const fetchJobData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get job status
        const status = await ugcVideoAPI.getVideoStatus(jobId);
        setVideoStatus(status);

        // Get the script to load scenes using scriptId from the status response
        if (status.scriptId) {
          setScriptId(status.scriptId);
          const scriptResponse = await ugcScriptAPI.getFullScript(status.scriptId);
          if (scriptResponse?.scripts) {
            const selectedScript =
              scriptResponse.scripts[scriptResponse.selectedVariantIndex || 0];
            setScenes(selectedScript?.scenes || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch job data:", err);
        setError(err instanceof Error ? err.message : "Failed to load video job");
      } finally {
        setLoading(false);
      }
    };

    fetchJobData();
  }, [jobId]);

  // Socket for real-time updates
  // When status becomes "completed", re-fetch from API to get presigned URL
  const handleSocketUpdate = useCallback(async (status: VideoGenerationStatus) => {
    if (status.status === "completed" && !status.finalVideoUrl) {
      // Socket sends finalVideoKey but not finalVideoUrl
      // Re-fetch from API to get the presigned URL
      try {
        const fullStatus = await ugcVideoAPI.getVideoStatus(status.jobId);
        setVideoStatus(fullStatus);
      } catch (err) {
        console.error("Failed to fetch completed video status:", err);
        setVideoStatus(status);
      }
    } else {
      setVideoStatus(status);
    }
  }, []);

  useUGCVideoSocket({
    teamId: selectedTeam?.id,
    jobId: videoStatus?.status === "generating" || videoStatus?.status === "queued" ? jobId : null,
    onUpdate: handleSocketUpdate,
  });

  const handleFinalize = async () => {
    if (!selectedTeam?.id) return;

    setIsFinalizing(true);
    setError(null);

    try {
      const response = await ugcVideoAPI.finalizeVideo({
        jobId,
        teamId: selectedTeam.id,
      });

      // Redirect to clip edit page
      router.push(`/dashboard/clips/${response.clipId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize video");
      setIsFinalizing(false);
    }
  };

  const handleBack = () => {
    router.push("/dashboard/ugc-studio/ai-video-creator");
  };

  // Check if user has access
  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
        <Card className="bg-surface-base border border-border-base max-w-md">
          <CardBody className="p-8 text-center">
            <Icon
              icon="solar:lock-bold-duotone"
              className="text-amber-400 mx-auto mb-4"
              width={48}
            />
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Access Required
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              You need a Scale plan or higher to access this feature.
            </p>
            <Button
              className="bg-accent-400 text-white font-semibold"
              onPress={() => router.push("/dashboard/pricing")}
            >
              View Plans
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  // Error state
  if (error && !videoStatus) {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Video Creator
          </Button>

          <Card className="bg-red-500/10 border border-red-500/30">
            <CardBody className="p-8 text-center">
              <Icon
                icon="solar:danger-triangle-bold-duotone"
                className="text-red-400 mx-auto mb-4"
                width={48}
              />
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Error Loading Video
              </h2>
              <p className="text-text-secondary text-sm mb-6">{error}</p>
              <Button
                variant="bordered"
                className="border-red-500/30 text-red-400"
                onPress={handleBack}
              >
                Go Back
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // Failed job state
  if (videoStatus?.status === "failed") {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Video Creator
          </Button>

          <Card className="bg-red-500/10 border border-red-500/30">
            <CardBody className="p-8 text-center">
              <Icon
                icon="solar:video-frame-cut-bold-duotone"
                className="text-red-400 mx-auto mb-4"
                width={48}
              />
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Video Generation Failed
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                {videoStatus.error || "An error occurred during video generation."}
              </p>
              <Button
                variant="bordered"
                className="border-border-base text-text-secondary"
                onPress={handleBack}
              >
                Go Back
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // Generating / Queued state - show loading animation
  if (
    videoStatus?.status === "generating" ||
    videoStatus?.status === "queued"
  ) {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Video Creator
          </Button>

          <VideoLoadingAnimation
            status={videoStatus}
            totalScenes={scenes.length || 3}
            onCancel={handleBack}
          />
        </div>
      </div>
    );
  }

  // Completed state - show preview
  if (videoStatus?.status === "completed") {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-5xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Video Creator
          </Button>

          {error && (
            <Card className="bg-red-500/10 border border-red-500/30 mb-6">
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <Icon
                    icon="solar:danger-triangle-bold"
                    className="text-red-400"
                    width={24}
                  />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </CardBody>
            </Card>
          )}

          <VideoPreview
            videoStatus={videoStatus}
            scenes={scenes}
            teamId={selectedTeam.id}
            scriptId={scriptId || ""}
            onFinalize={handleFinalize}
            isFinalizing={isFinalizing}
          />
        </div>
      </div>
    );
  }

  // Default / unknown state
  return (
    <div className="min-h-screen bg-surface-dark p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="light"
          className="text-text-secondary mb-6"
          startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
          onPress={handleBack}
        >
          Back to Video Creator
        </Button>

        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-8 text-center">
            <Icon
              icon="solar:video-frame-play-bold-duotone"
              className="text-text-tertiary mx-auto mb-4"
              width={48}
            />
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Video Job Not Found
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              The video job you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
            <Button
              className="bg-accent-400 text-white font-semibold"
              onPress={handleBack}
            >
              Go Back
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
