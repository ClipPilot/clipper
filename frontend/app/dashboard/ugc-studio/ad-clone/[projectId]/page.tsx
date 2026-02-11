"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAtomValue } from "jotai";
import { Card, CardBody, Button, Spinner, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import { BrandLogo } from "@/components/brand-logo";
import { canAccessUGCStudio } from "@/lib/plans";
import { adCloneAPI, ProjectStatusResponse } from "@/api/adClone";
import { useAdCloneSocket } from "@/hooks/useAdClone";
import type { AdCloneProjectStatus } from "@/store/adClone";

export default function AdCloneProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatusResponse | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const hasAutoFinalized = useRef(false);

  // Fetch project status on mount
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        setError(null);

        const status = await adCloneAPI.getStatus(projectId);
        setProjectStatus(status);
      } catch (err) {
        console.error("Failed to fetch project data:", err);
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId]);

  // Socket update handler
  const handleSocketUpdate = useCallback(async (update: {
    projectId: string;
    status: AdCloneProjectStatus;
    progress: number;
    progressMessage: string;
    finalVideoUrl?: string;
    clipId?: number | null;
    error?: string;
  }) => {
    // If the worker already created the clip, redirect immediately
    if (update.status === "completed" && update.clipId) {
      router.push(`/dashboard/clips/${update.clipId}/edit`);
      return;
    }

    if (update.status === "completed" && !update.finalVideoUrl) {
      // Re-fetch from API to get presigned URL
      try {
        const fullStatus = await adCloneAPI.getStatus(update.projectId);
        setProjectStatus(fullStatus);
      } catch (err) {
        console.error("Failed to fetch completed status:", err);
        setProjectStatus(prev => prev ? {
          ...prev,
          status: update.status,
          progress: update.progress,
          progressMessage: update.progressMessage,
        } : null);
      }
    } else {
      setProjectStatus(prev => prev ? {
        ...prev,
        status: update.status,
        progress: update.progress,
        progressMessage: update.progressMessage,
        finalVideoUrl: update.finalVideoUrl || prev.finalVideoUrl,
        error: update.error,
      } : null);
    }
  }, [router]);

  // Socket for real-time updates
  const isGenerating = projectStatus?.status === "generating_video" ||
    projectStatus?.status === "analyzing" ||
    projectStatus?.status === "generating_script";

  useAdCloneSocket(
    selectedTeam?.id,
    isGenerating ? projectId : null,
    handleSocketUpdate
  );

  // Poll for status updates when generating (fallback for socket)
  useEffect(() => {
    if (!isGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await adCloneAPI.getStatus(projectId);
        setProjectStatus(status);

        // Stop polling if completed or failed
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [isGenerating, projectId]);

  // Auto-redirect or fallback finalize when video is completed
  useEffect(() => {
    const autoFinalize = async () => {
      if (
        projectStatus?.status === "completed" &&
        selectedTeam?.id &&
        !hasAutoFinalized.current &&
        !isFinalizing
      ) {
        // If worker already created the clip, redirect directly
        if (projectStatus.clipId) {
          router.push(`/dashboard/clips/${projectStatus.clipId}/edit`);
          return;
        }

        // Fallback: finalize via API (worker may not have created the clip)
        if (!projectStatus.finalVideoUrl) return;

        hasAutoFinalized.current = true;
        setIsFinalizing(true);
        setError(null);

        try {
          const response = await adCloneAPI.finalizeProject(projectId, {
            teamId: selectedTeam.id,
          });

          router.push(`/dashboard/clips/${response.clipId}/edit`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save to library");
          setIsFinalizing(false);
          hasAutoFinalized.current = false;
        }
      }
    };

    autoFinalize();
  }, [projectStatus, selectedTeam?.id, projectId, router, isFinalizing]);

  const handleBack = () => {
    router.push("/dashboard/ugc-studio/ad-clone");
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
              className="bg-orange-500 text-white font-semibold"
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
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  // Error state (no project data)
  if (error && !projectStatus) {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Ad Clones
          </Button>

          <Card className="bg-red-500/10 border border-red-500/30">
            <CardBody className="p-8 text-center">
              <Icon
                icon="solar:danger-triangle-bold-duotone"
                className="text-red-400 mx-auto mb-4"
                width={48}
              />
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Error Loading Project
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

  // Failed state
  if (projectStatus?.status === "failed") {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Ad Clones
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
                {projectStatus.error || "An error occurred during video generation."}
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

  // Generating state - show loading animation
  if (isGenerating) {
    const getStatusLabel = () => {
      switch (projectStatus?.status) {
        case "analyzing":
          return "Analyzing video";
        case "generating_script":
          return "Generating script";
        case "generating_video":
          return "Generating video";
        default:
          return "Processing";
      }
    };

    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Ad Clones
          </Button>

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
                  <h2 className="text-xl font-semibold text-text-primary">
                    {getStatusLabel()}...
                  </h2>
                  <p className="text-text-secondary">
                    {projectStatus?.progressMessage || "Please wait while we process your ad clone"}
                  </p>
                </div>

                <div className="w-full max-w-md space-y-2">
                  <Progress
                    value={projectStatus?.progress || 0}
                    size="md"
                    color="warning"
                    classNames={{
                      track: "bg-surface-elevated",
                      indicator: "bg-orange-500",
                    }}
                  />
                  <p className="text-sm text-text-tertiary">
                    {projectStatus?.progress || 0}% complete
                  </p>
                </div>

                <Card className="bg-surface-elevated border border-border-base w-full max-w-md">
                  <CardBody className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          projectStatus?.status === "analyzing" ? "bg-orange-500" :
                          ["generating_script", "generating_video"].includes(projectStatus?.status || "") ? "bg-green-500/20" : "bg-surface-base"
                        }`}>
                          {["generating_script", "generating_video"].includes(projectStatus?.status || "") ? (
                            <Icon icon="solar:check-circle-bold" className="text-green-400" width={14} />
                          ) : (
                            <span className="text-xs font-bold text-white">1</span>
                          )}
                        </div>
                        <p className="text-sm text-text-secondary">
                          Analyzing reference video
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          projectStatus?.status === "generating_script" ? "bg-orange-500" :
                          projectStatus?.status === "generating_video" ? "bg-green-500/20" : "bg-surface-base"
                        }`}>
                          {projectStatus?.status === "generating_video" ? (
                            <Icon icon="solar:check-circle-bold" className="text-green-400" width={14} />
                          ) : (
                            <span className={`text-xs font-bold ${projectStatus?.status === "generating_script" ? "text-white" : "text-text-tertiary"}`}>2</span>
                          )}
                        </div>
                        <p className="text-sm text-text-secondary">
                          Generating ad script
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          projectStatus?.status === "generating_video" ? "bg-orange-500" : "bg-surface-base"
                        }`}>
                          <span className={`text-xs font-bold ${projectStatus?.status === "generating_video" ? "text-white" : "text-text-tertiary"}`}>3</span>
                        </div>
                        <p className="text-sm text-text-secondary">
                          Creating video scenes
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // Completed state - auto-finalize and show loading
  if (projectStatus?.status === "completed" && projectStatus.finalVideoUrl) {
    // Show finalizing state while auto-finalize is in progress
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Ad Clones
          </Button>

          {error ? (
            <Card className="bg-red-500/10 border border-red-500/30">
              <CardBody className="p-8 text-center">
                <Icon
                  icon="solar:danger-triangle-bold-duotone"
                  className="text-red-400 mx-auto mb-4"
                  width={48}
                />
                <h2 className="text-xl font-bold text-text-primary mb-2">
                  Failed to Save Video
                </h2>
                <p className="text-text-secondary text-sm mb-6">{error}</p>
                <Button
                  className="bg-orange-500 text-white font-semibold"
                  onPress={() => {
                    hasAutoFinalized.current = false;
                    setError(null);
                  }}
                >
                  Try Again
                </Button>
              </CardBody>
            </Card>
          ) : (
            <Card className="bg-surface-base border border-border-base">
              <CardBody className="p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Icon
                        icon="solar:check-circle-bold-duotone"
                        className="text-orange-500"
                        width={40}
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-base border-2 border-orange-500 flex items-center justify-center">
                      <Spinner size="sm" color="warning" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-primary mb-2">
                      Ad Clone Complete!
                    </h2>
                    <p className="text-text-secondary">
                      Saving to your library and preparing the editor...
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Script review / other in-progress states - redirect to wizard
  if (["script_generated", "analysis_complete"].includes(projectStatus?.status || "")) {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            className="text-text-secondary mb-6"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            onPress={handleBack}
          >
            Back to Ad Clones
          </Button>

          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-8 text-center">
              <Icon
                icon="solar:document-text-bold-duotone"
                className="text-orange-500 mx-auto mb-4"
                width={48}
              />
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Project In Progress
              </h2>
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
          Back to Ad Clones
        </Button>

        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-8 text-center">
            <Icon
              icon="solar:video-frame-play-bold-duotone"
              className="text-text-tertiary mx-auto mb-4"
              width={48}
            />
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Project Not Found
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              The project you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
            <Button
              className="bg-orange-500 text-white font-semibold"
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
