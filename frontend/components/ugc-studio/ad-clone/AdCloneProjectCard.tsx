"use client";

import { useRef, useEffect, useState } from "react";
import { Card, CardBody, Progress, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { AdCloneProjectStatus } from "@/store/adClone";

export interface AdCloneProject {
  id: string;
  productName: string | null;
  status: AdCloneProjectStatus;
  progress: number;
  progressMessage: string | null;
  thumbnailUrl?: string;
  finalVideoUrl?: string;
  createdAt: string;
  sceneCount?: number;
}

interface AdCloneProjectCardProps {
  project: AdCloneProject;
  onClick: () => void;
}

const STATUS_CONFIG: Record<
  AdCloneProjectStatus,
  { label: string; color: "warning" | "primary" | "success" | "danger" | "default"; icon: string }
> = {
  uploading: {
    label: "Uploading",
    color: "default",
    icon: "solar:upload-bold",
  },
  analyzing: {
    label: "Analyzing",
    color: "warning",
    icon: "solar:magnifer-bold",
  },
  analysis_complete: {
    label: "Analyzed",
    color: "primary",
    icon: "solar:check-circle-bold",
  },
  generating_script: {
    label: "Generating Script",
    color: "warning",
    icon: "solar:document-text-bold",
  },
  script_generated: {
    label: "Script Ready",
    color: "primary",
    icon: "solar:document-text-bold",
  },
  generating_video: {
    label: "Generating Video",
    color: "warning",
    icon: "solar:clapperboard-play-bold",
  },
  completed: {
    label: "Complete",
    color: "success",
    icon: "solar:check-circle-bold",
  },
  failed: {
    label: "Failed",
    color: "danger",
    icon: "solar:danger-triangle-bold",
  },
};

export function AdCloneProjectCard({ project, onClick }: AdCloneProjectCardProps) {
  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.uploading;
  const isGenerating = ["analyzing", "generating_script", "generating_video"].includes(project.status);
  const isComplete = project.status === "completed";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Load video metadata to show first frame
  useEffect(() => {
    if (isComplete && project.finalVideoUrl && videoRef.current) {
      const video = videoRef.current;
      video.preload = "metadata";
      video.currentTime = 0.1; // Seek to first frame

      const handleLoaded = () => setVideoLoaded(true);
      video.addEventListener("loadeddata", handleLoaded);
      return () => video.removeEventListener("loadeddata", handleLoaded);
    }
  }, [isComplete, project.finalVideoUrl]);

  return (
    <Card
      isPressable
      onPress={onClick}
      className="bg-surface-base border border-border-base hover:border-orange-500/50 transition-all group"
    >
      <CardBody className="p-0">
        {/* Thumbnail */}
        <div className="relative aspect-[9/16] bg-surface-elevated overflow-hidden">
          {/* For completed videos, show video first frame */}
          {isComplete && project.finalVideoUrl ? (
            <>
              <video
                ref={videoRef}
                src={project.finalVideoUrl}
                className="w-full h-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
              {!videoLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-elevated">
                  <Icon
                    icon="solar:refresh-circle-bold-duotone"
                    className="text-text-tertiary animate-spin"
                    width={24}
                  />
                </div>
              )}
            </>
          ) : project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.productName || "Ad Clone"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon
                icon={isGenerating ? "solar:refresh-circle-bold-duotone" : "solar:video-frame-play-bold-duotone"}
                className={`text-text-tertiary ${isGenerating ? "animate-spin" : ""}`}
                width={36}
              />
            </div>
          )}

          {/* Status overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
              <Icon
                icon="solar:refresh-circle-bold-duotone"
                className="text-white animate-spin mb-2"
                width={32}
              />
              <Progress
                value={project.progress}
                size="sm"
                color="warning"
                className="w-3/4"
                classNames={{
                  track: "bg-white/20",
                  indicator: "bg-orange-500",
                }}
              />
              <span className="text-xs text-white/80 mt-2">{project.progress}%</span>
            </div>
          )}

          {/* Play button for completed videos */}
          {isComplete && project.finalVideoUrl && (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Icon icon="solar:play-bold" className="text-white ml-0.5" width={24} />
              </div>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 left-2">
            <Chip
              size="sm"
              color={statusConfig.color}
              variant="flat"
              startContent={<Icon icon={statusConfig.icon} width={12} />}
              classNames={{ base: "h-6 px-2", content: "text-[10px] font-medium" }}
            >
              {statusConfig.label}
            </Chip>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-sm font-medium text-text-primary truncate">
            {project.productName || "Untitled Project"}
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
