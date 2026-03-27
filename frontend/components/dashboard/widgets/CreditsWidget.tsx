"use client";

import { ProgressBar, Chip, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { WidgetWrapper } from "../WidgetWrapper";

interface CreditsWidgetProps {
  color?: string;
  onColorChange?: (color: string) => void;
}

export function CreditsWidget({ color, onColorChange }: CreditsWidgetProps) {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const { usageStats, isLoading } = useUsageStats(selectedTeam?.id);

  const usagePercent = usageStats
    ? Math.round((usageStats.clipsCreated / usageStats.limit) * 100)
    : 0;

  const getProgressColor = () => {
    if (usagePercent >= 90) return "danger";
    if (usagePercent >= 70) return "warning";
    return "primary";
  };

  const getPlanColor = (plan: string): "success" | "warning" | "danger" | "default" | "accent" => {
    switch (plan?.toLowerCase()) {
      case "enterprise":
        return "accent";
      case "scale":
        return "success";
      case "studio":
        return "accent";
      default:
        return "default";
    }
  };

  return (
    <WidgetWrapper
      id="credits"
      title="Credits"
      icon="solar:wallet-bold"
      color={color}
      onColorChange={onColorChange}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Icon icon="solar:spinner-bold" className="animate-spin text-text-tertiary" width={24} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-text-primary">
                {usageStats?.remaining ?? 0}
              </span>
              <Chip
 size="sm"
 color={getPlanColor(selectedTeam?.plan || "free")}
 variant="tertiary"
 >
                {selectedTeam?.plan || "Free"}
              </Chip>
            </div>
            <p className="text-xs text-text-secondary mb-3">credits remaining</p>
            <ProgressBar value={usagePercent} className="mb-1">
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <p className="text-xs text-text-tertiary">
              {usageStats?.clipsCreated ?? 0} / {usageStats?.limit ?? 0} used
            </p>
          </div>
          {selectedTeam?.plan === "free" && (
            <Button
 size="sm"
 variant="tertiary"
 onPress={() => router.push("/dashboard/pricing")}
 >
              <Icon icon="solar:arrow-up-bold" width={14} />
              Upgrade
            </Button>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
