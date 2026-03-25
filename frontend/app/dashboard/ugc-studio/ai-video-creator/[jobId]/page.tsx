"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAtomValue } from "jotai";
import { Card, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { ugcVideoAPI } from "@/api/ugc/video";
import { ugcScriptAPI } from "@/api/ugc";
import { useUGCVideoSocket } from "@/hooks/useUGCVideoSocket";
import { useVideoJobStatus } from "@/hooks/useVideoJobStatus";
import { VideoStatusPage } from "@/components/ugc-studio/generate/VideoStatusPage";
import { VideoLoadingAnimation } from "@/components/ugc-studio/generate/VideoLoadingAnimation";
import type { UGCScene } from "@/components/ugc-studio/script/types";
import type { VideoGenerationStatus } from "@/api/ugc/video";

const UGC_GENERATING_STATUSES = ["generating", "queued"];

export default function VideoJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const [scenes, setScenes] = useState<UGCScene[]>([]);

  const fetchStatus = useCallback(
    (id: string) => ugcVideoAPI.getVideoStatus(id),
    []
  );

  const finalizeVideo = useCallback(
    (id: string, teamId: number) => ugcVideoAPI.finalizeVideo({ jobId: id, teamId }),
    []
  );

  const onInitialFetch = useCallback(async (status: VideoGenerationStatus) => {
    if (!status.scriptId) return;
    try {
      const scriptResponse = await ugcScriptAPI.getFullScript(status.scriptId);
      if (scriptResponse?.scripts) {
        const selectedScript = scriptResponse.scripts[scriptResponse.selectedVariantIndex || 0];
        setScenes(selectedScript?.scenes || []);
      }
    } catch {
      // VideoLoadingAnimation has a fallback for missing scenes
    }
  }, []);

  const {
    status,
    loading,
    error,
    isFinalizing,
    isGenerating,
    handleSocketUpdate,
    retryFinalize,
  } = useVideoJobStatus<VideoGenerationStatus>({
    jobId,
    teamId: selectedTeam?.id,
    fetchStatus,
    finalizeVideo,
    generatingStatuses: UGC_GENERATING_STATUSES,
    onInitialFetch,
  });

  useUGCVideoSocket({
    teamId: selectedTeam?.id,
    jobId: isGenerating ? jobId : null,
    onUpdate: handleSocketUpdate as (status: VideoGenerationStatus) => void,
  });

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
        <Card className="bg-surface-base border border-border-base max-w-md">
          <Card.Content className="p-8 text-center">
            <Icon icon="solar:lock-bold-duotone" className="text-amber-400 mx-auto mb-4" width={48} />
            <h2 className="text-xl font-bold text-text-accent mb-2">Access Required</h2>
            <p className="text-text-secondary text-sm mb-6">
              You need a Scale plan or higher to access this feature.
            </p>
            <Button className="bg-accent-400 text-white font-semibold" onPress={() => router.push("/dashboard/pricing")}>
              View Plans
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  const handleBack = useCallback(
    () => router.push("/dashboard/ugc-studio/ai-video-creator"),
    [router]
  );

  const generatingContent = (
    <VideoLoadingAnimation
      status={status as VideoGenerationStatus}
      totalScenes={scenes.length || 3}
      onCancel={handleBack}
    />
  );

  return (
    <VideoStatusPage
      status={status}
      loading={loading}
      error={error}
      isFinalizing={isFinalizing}
      isGenerating={isGenerating}
      backLabel="Back to Video Creator"
      backPath="/dashboard/ugc-studio/ai-video-creator"
      accentColor="accent"
      completedLabel="Video Complete!"
      generatingContent={generatingContent}
      onRetryFinalize={retryFinalize}
    />
  );
}
