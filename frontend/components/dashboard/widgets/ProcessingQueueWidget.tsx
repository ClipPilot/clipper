"use client";

import { useState, useEffect } from "react";
import { Progress, Chip, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { clipsAPI, Clip } from "@/api/clips";
import { WidgetWrapper } from "../WidgetWrapper";

interface ProcessingQueueWidgetProps {
  color?: string;
  onColorChange?: (color: string) => void;
}

export function ProcessingQueueWidget({ color, onColorChange }: ProcessingQueueWidgetProps) {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [pendingClips, setPendingClips] = useState<Clip[]>([]);
  const [unsavedClips, setUnsavedClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadJobs = async () => {
      if (!selectedTeam?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const [pending, unsaved] = await Promise.all([
          clipsAPI.getPendingClips(selectedTeam.id),
          clipsAPI.getUnsavedClips(selectedTeam.id),
        ]);
        setPendingClips(pending);
        setUnsavedClips(unsaved);
      } catch (error) {
        console.error("Failed to load jobs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadJobs();

    const interval = setInterval(loadJobs, 10000);
    return () => clearInterval(interval);
  }, [selectedTeam?.id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "solar:hourglass-bold";
      case "processing":
        return "solar:refresh-bold";
      case "completed":
        return "solar:check-circle-bold";
      default:
        return "solar:clock-circle-bold";
    }
  };

  const getStatusColor = (status: string): "warning" | "primary" | "success" | "default" => {
    switch (status) {
      case "pending":
        return "warning";
      case "processing":
        return "primary";
      case "completed":
        return "success";
      default:
        return "default";
    }
  };

  const allJobs = [...pendingClips, ...unsavedClips];
  const processingCount = pendingClips.length;
  const readyCount = unsavedClips.length;

  return (
    <WidgetWrapper
      id="processing"
      title="Processing Queue"
      icon="solar:layers-bold"
      color={color}
      onColorChange={onColorChange}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Icon icon="solar:spinner-bold" className="animate-spin text-text-tertiary" width={24} />
        </div>
      ) : allJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Icon icon="solar:check-circle-bold" width={48} className="text-success" />
          <p className="text-sm text-text-secondary text-center">All caught up!</p>
          <p className="text-xs text-text-tertiary text-center">No clips processing</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 h-full">
          <div className="flex items-center gap-3">
            {processingCount > 0 && (
              <Chip size="sm" color="warning" variant="flat" startContent={<Icon icon="solar:refresh-bold" width={12} className="animate-spin" />}>
                {processingCount} processing
              </Chip>
            )}
            {readyCount > 0 && (
              <Chip size="sm" color="success" variant="flat" startContent={<Icon icon="solar:check-circle-bold" width={12} />}>
                {readyCount} ready
              </Chip>
            )}
          </div>

          <div className="flex-1 overflow-auto space-y-2">
            {allJobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-surface-hover"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${color || "#4F47E6"}20` }}
                >
                  <Icon
                    icon={getStatusIcon(job.status)}
                    width={16}
                    className={job.status === "processing" ? "animate-spin" : ""}
                    style={{ color: color || "#4F47E6" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {job.title || `Clip #${job.id}`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Chip
                      size="sm"
                      color={getStatusColor(job.status)}
                      variant="dot"
                      className="capitalize text-[10px]"
                    >
                      {job.status}
                    </Chip>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {allJobs.length > 4 && (
            <Button
              size="sm"
              variant="light"
              className="w-full"
              onPress={() => router.push("/dashboard/clips")}
            >
              +{allJobs.length - 4} more
            </Button>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
