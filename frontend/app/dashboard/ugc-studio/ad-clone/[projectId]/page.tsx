"use client";

import { useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAtomValue } from "jotai";
import { Card, CardBody, Button, Spinner, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { adCloneAPI } from "@/api/adClone";
import { useAdCloneSocket } from "@/hooks/useAdClone";
import { useVideoJobStatus } from "@/hooks/useVideoJobStatus";
import { VideoStatusPage } from "@/components/ugc-studio/generate/VideoStatusPage";
import { BrandLogo } from "@/components/brand-logo";

const AD_CLONE_GENERATING_STATUSES = [
  "generating_video",
  "analyzing",
  "generating_script",
];

export default function AdCloneProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const fetchStatus = useCallback(
    (id: string) => adCloneAPI.getStatus(id),
    []
  );

  const finalizeVideo = useCallback(
    (id: string, teamId: number) => adCloneAPI.finalizeProject(id, { teamId }),
    []
  );

  const {
    status,
    loading,
    error,
    isFinalizing,
    isGenerating,
    handleSocketUpdate,
    retryFinalize,
  } = useVideoJobStatus({
    jobId: projectId,
    teamId: selectedTeam?.id,
    fetchStatus,
    finalizeVideo,
    generatingStatuses: AD_CLONE_GENERATING_STATUSES,
  });

  useAdCloneSocket(
    selectedTeam?.id,
    isGenerating ? projectId : null,
    handleSocketUpdate
  );

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
        <Card className="bg-surface-base border border-border-base max-w-md">
          <CardBody className="p-8 text-center">
            <Icon icon="solar:lock-bold-duotone" className="text-amber-400 mx-auto mb-4" width={48} />
            <h2 className="text-xl font-bold text-text-primary mb-2">Access Required</h2>
            <p className="text-text-secondary text-sm mb-6">
              You need a Scale plan or higher to access this feature.
            </p>
            <Button className="bg-orange-500 text-white font-semibold" onPress={() => router.push("/dashboard/pricing")}>
              View Plans
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const extraStates =
    ["script_generated", "analysis_complete"].includes(status?.status || "")
      ? (
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-8 text-center">
              <Icon icon="solar:document-text-bold-duotone" className="text-orange-500 mx-auto mb-4" width={48} />
              <h2 className="text-xl font-bold text-text-primary mb-2">Project In Progress</h2>
              <p className="text-text-secondary text-sm mb-6">
                This project is waiting for you to continue. Go back to the wizard to complete it.
              </p>
              <Button
                className="bg-orange-500 text-white font-semibold"
                onPress={() => router.push("/dashboard/ugc-studio/ad-clone/create")}
              >
                Continue in Wizard
              </Button>
            </CardBody>
          </Card>
        )
      : null;

  const getStatusLabel = () => {
    switch (status?.status) {
      case "analyzing": return "Analyzing video";
      case "generating_script": return "Generating script";
      case "generating_video": return "Generating video";
      default: return "Processing";
    }
  };

  const generatingContent = (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
              <BrandLogo size={56} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-base border-2 border-orange-500 flex items-center justify-center">
              <Spinner size="sm" color="warning" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">{getStatusLabel()}...</h2>
            <p className="text-text-secondary">
              {(status?.progressMessage as string) || "Please wait while we process your ad clone"}
            </p>
          </div>

          <div className="w-full max-w-md space-y-2">
            <Progress
              value={status?.progress || 0}
              size="md"
              color="warning"
              classNames={{ track: "bg-surface-elevated", indicator: "bg-orange-500" }}
            />
            <p className="text-sm text-text-tertiary">{status?.progress || 0}% complete</p>
          </div>

          <Card className="bg-surface-elevated border border-border-base w-full max-w-md">
            <CardBody className="p-4">
              <div className="space-y-3">
                {[
                  { label: "Analyzing reference video", active: "analyzing", done: ["generating_script", "generating_video"] },
                  { label: "Generating ad script", active: "generating_script", done: ["generating_video"] },
                  { label: "Creating video scenes", active: "generating_video", done: [] as string[] },
                ].map((step, i) => {
                  const isDone = step.done.includes(status?.status || "");
                  const isActive = status?.status === step.active;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isActive ? "bg-orange-500" : isDone ? "bg-green-500/20" : "bg-surface-base"
                      }`}>
                        {isDone ? (
                          <Icon icon="solar:check-circle-bold" className="text-green-400" width={14} />
                        ) : (
                          <span className={`text-xs font-bold ${isActive ? "text-white" : "text-text-tertiary"}`}>{i + 1}</span>
                        )}
                      </div>
                      <p className="text-sm text-text-secondary">{step.label}</p>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      </CardBody>
    </Card>
  );

  return (
    <VideoStatusPage
      status={status}
      loading={loading}
      error={error}
      isFinalizing={isFinalizing}
      isGenerating={isGenerating}
      backLabel="Back to Ad Clones"
      backPath="/dashboard/ugc-studio/ad-clone"
      accentColor="orange"
      completedLabel="Ad Clone Complete!"
      generatingContent={generatingContent}
      extraStates={extraStates}
      onRetryFinalize={retryFinalize}
    />
  );
}
