"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { VideoJobState } from "@/hooks/useVideoJobStatus";

type AccentColor = "orange" | "accent";

interface VideoStatusPageProps {
  status: VideoJobState | null;
  loading: boolean;
  error: string | null;
  isFinalizing: boolean;
  isGenerating: boolean;
  backLabel: string;
  backPath: string;
  accentColor: AccentColor;
  completedLabel: string;
  generatingContent: ReactNode;
  extraStates?: ReactNode | null;
  onRetryFinalize: () => void;
}

const colorMap: Record<AccentColor, {
  buttonClass: string;
  spinnerColor: "warning" | "primary";
  bgGlow: string;
  borderGlow: string;
  iconClass: string;
}> = {
  orange: {
    buttonClass: "bg-orange-500 text-white font-semibold",
    spinnerColor: "warning",
    bgGlow: "bg-orange-500/20",
    borderGlow: "border-orange-500",
    iconClass: "text-orange-500",
  },
  accent: {
    buttonClass: "bg-accent-400 text-white font-semibold",
    spinnerColor: "primary",
    bgGlow: "bg-accent-400/20",
    borderGlow: "border-accent-400",
    iconClass: "text-accent-400",
  },
};

export function VideoStatusPage({
  status,
  loading,
  error,
  isGenerating,
  backLabel,
  backPath,
  accentColor,
  completedLabel,
  generatingContent,
  extraStates,
  onRetryFinalize,
}: VideoStatusPageProps) {
  const router = useRouter();
  const colors = colorMap[accentColor];

  const handleBack = () => router.push(backPath);

  const backButton = (
    <Button
 variant="tertiary"
 className="text-text-secondary mb-6"
 onPress={handleBack}
 >
      <Icon icon="solar:arrow-left-linear" width={18} />
      {backLabel}
    </Button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color={colors.spinnerColor} />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          {backButton}
          <Card className="bg-red-500/10 border border-red-500/30">
            <Card.Content className="p-8 text-center">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-400 mx-auto mb-4" width={48} />
              <h2 className="text-xl font-bold text-text-accent mb-2">Error Loading Project</h2>
              <p className="text-text-secondary text-sm mb-6">{error}</p>
              <Button variant="outline" className="border-red-500/30 text-red-400" onPress={handleBack}>
                Go Back
              </Button>
            </Card.Content>
          </Card>
        </div>
      </div>
    );
  }

  if (status?.status === "failed") {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          {backButton}
          <Card className="bg-red-500/10 border border-red-500/30">
            <Card.Content className="p-8 text-center">
              <Icon icon="solar:video-frame-cut-bold-duotone" className="text-red-400 mx-auto mb-4" width={48} />
              <h2 className="text-xl font-bold text-text-accent mb-2">Video Generation Failed</h2>
              <p className="text-text-secondary text-sm mb-6">
                {status.error || "An error occurred during video generation."}
              </p>
              <Button variant="outline" className="border-border-base text-text-secondary" onPress={handleBack}>
                Go Back
              </Button>
            </Card.Content>
          </Card>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          {backButton}
          {generatingContent}
        </div>
      </div>
    );
  }

  if (status?.status === "completed") {
    if (status.clipId) {
      return (
        <div className="min-h-screen bg-surface-dark flex items-center justify-center">
          <Spinner size="lg" color={colors.spinnerColor} />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          {backButton}
          {error ? (
            <Card className="bg-red-500/10 border border-red-500/30">
              <Card.Content className="p-8 text-center">
                <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-400 mx-auto mb-4" width={48} />
                <h2 className="text-xl font-bold text-text-accent mb-2">Failed to Save Video</h2>
                <p className="text-text-secondary text-sm mb-6">{error}</p>
                <Button className={colors.buttonClass} onPress={onRetryFinalize}>
                  Try Again
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <Card className="bg-surface-base border border-border-base">
              <Card.Content className="p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className={`w-20 h-20 rounded-full ${colors.bgGlow} flex items-center justify-center`}>
                      <Icon icon="solar:check-circle-bold-duotone" className={colors.iconClass} width={40} />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-base border-2 ${colors.borderGlow} flex items-center justify-center`}>
                      <Spinner size="sm" color={colors.spinnerColor} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-accent mb-2">{completedLabel}</h2>
                    <p className="text-text-secondary">Saving to your library and preparing the editor...</p>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (extraStates) {
    return (
      <div className="min-h-screen bg-surface-dark p-6">
        <div className="max-w-4xl mx-auto">
          {backButton}
          {extraStates}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark p-6">
      <div className="max-w-4xl mx-auto">
        {backButton}
        <Card className="bg-surface-base border border-border-base">
          <Card.Content className="p-8 text-center">
            <Icon icon="solar:video-frame-play-bold-duotone" className="text-text-tertiary mx-auto mb-4" width={48} />
            <h2 className="text-xl font-bold text-text-accent mb-2">Project Not Found</h2>
            <p className="text-text-secondary text-sm mb-6">
              The project you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
            <Button className={colors.buttonClass} onPress={handleBack}>
              Go Back
            </Button>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
