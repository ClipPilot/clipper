"use client";

import React, { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ScrollShadow,
  cn,
  type CardProps,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { useTeams } from "@/hooks/useTeams";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useRouter } from "next/navigation";

interface WorkspaceSelectorProps extends CardProps {
  onCreateTeam?: () => void;
  onManageTeam?: () => void;
}

export default function WorkspaceSelector({
  onCreateTeam,
  onManageTeam,
  ...props
}: WorkspaceSelectorProps) {
  const router = useRouter();
  const { teams, isLoading, defaultTeamId, setAsDefaultTeam } =
    useTeams();
  const [selectedTeam, setSelectedTeam] = useAtom(selectedTeamAtom);
  const { usageStats } = useUsageStats(selectedTeam?.id);

  // Track which team logos failed to load (stale presigned URLs)
  const [failedLogos, setFailedLogos] = useState<Set<number>>(new Set());
  // Track previous logo URLs to detect when they change (fresh presigned URLs)
  const prevLogoUrlsRef = React.useRef<Record<number, string | undefined>>({});

  // Reset failed state when logo URL changes (fresh data from API)
  React.useEffect(() => {
    teams.forEach(team => {
      const prevUrl = prevLogoUrlsRef.current[team.id];
      // If the URL changed and we have a new URL, clear the failed state
      if (team.logo_url && team.logo_url !== prevUrl) {
        setFailedLogos(prev => {
          const next = new Set(prev);
          next.delete(team.id);
          return next;
        });
      }
      prevLogoUrlsRef.current[team.id] = team.logo_url;
    });
  }, [teams]);

  const handleLogoError = (teamId: number) => {
    setFailedLogos(prev => new Set(prev).add(teamId));
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return "solar:crown-bold-duotone";
      case "manager":
        return "solar:user-check-bold-duotone";
      case "member":
      default:
        return "solar:user-bold-duotone";
    }
  };

  const getPlanName = (plan?: string) => {
    switch (plan) {
      case "enterprise":
        return "Enterprise";
      case "scale":
        return "Scale";
      case "studio":
        return "Studio";
      case "creator":
        return "Creator";
      default:
        return "Free";
    }
  };

  const getPlanColor = (plan?: string) => {
    switch (plan) {
      case "enterprise":
        return "bg-emerald-500/10 text-emerald-500";
      case "scale":
        return "bg-purple-500/10 text-purple-500";
      case "studio":
        return "bg-accent-400/10 text-accent-400";
      case "creator":
        return "bg-orange-500/10 text-orange-500";
      default:
        return "bg-blue-500/10 text-blue-500";
    }
  };

  const currentPlan = selectedTeam?.plan || "free";
  const isPaidPlan = ["creator", "studio", "scale", "enterprise"].includes(currentPlan);

  return (
      <Card
        className="w-full min-w-[320px] bg-surface-base border border-border-base"
        {...props}
      >
        <CardHeader className="flex flex-col px-0 pb-0">
          <div className="flex w-full items-center justify-between px-5 py-3 border-b border-border-base">
            <div>
              <h4 className="text-medium font-semibold text-text-primary">
                Current Workspace
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-medium",
                    getPlanColor(currentPlan)
                  )}
                >
                  {getPlanName(currentPlan)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="w-full gap-0 p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-text-tertiary">
                Loading teams...
              </span>
            </div>
          ) : teams.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-text-tertiary">No teams found</span>
            </div>
          ) : (
            <ScrollShadow className="max-h-[300px] w-full">
              {teams.map((team) => {
                const teamPlan = team.plan || "free";
                const isDefault = defaultTeamId === team.id;
                return (
                  <div
                    key={team.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-5 py-3 border-b border-border-base transition-colors hover:bg-surface-elevated",
                      {
                        "bg-accent-400/10": selectedTeam?.id === team.id,
                      }
                    )}
                  >
                    <button
                      onClick={() => setSelectedTeam(team)}
                      className="flex items-center gap-3 flex-1"
                    >
                      {team.logo_url && !failedLogos.has(team.id) ? (
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg overflow-hidden ring-2 ring-offset-2 ring-offset-surface-base transition-all",
                            selectedTeam?.id === team.id
                              ? "ring-accent-400"
                              : "ring-transparent"
                          )}
                        >
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="w-full h-full object-cover"
                            onError={() => handleLogoError(team.id)}
                          />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                            selectedTeam?.id === team.id
                              ? "bg-accent-400 text-white ring-2 ring-accent-400 ring-offset-2 ring-offset-surface-base"
                              : teamPlan === "enterprise"
                                ? "bg-emerald-500 text-white"
                                : teamPlan === "scale"
                                  ? "bg-purple-500 text-white"
                                  : teamPlan === "studio"
                                    ? "bg-accent-400 text-white"
                                    : teamPlan === "creator"
                                      ? "bg-orange-500 text-white"
                                      : "bg-blue-500 text-white"
                          )}
                        >
                          <Icon icon={getRoleIcon(team.role)} width={20} />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col items-start min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-sm font-medium truncate",
                              selectedTeam?.id === team.id
                                ? "text-accent-400"
                                : "text-text-primary"
                            )}
                          >
                            {team.name}
                          </span>
                          <span
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap",
                              getPlanColor(teamPlan)
                            )}
                          >
                            {getPlanName(teamPlan)}
                          </span>
                          {isDefault && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-500/10 text-green-500 whitespace-nowrap">
                              Default
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-tertiary capitalize">
                          {team.role}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isDefault ? (
                        <button
                          onClick={() => setAsDefaultTeam(null)}
                          className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
                          title="Remove as default"
                        >
                          <Icon
                            icon="solar:star-bold"
                            className="text-green-500"
                            width={18}
                          />
                        </button>
                      ) : (
                        <button
                          onClick={() => setAsDefaultTeam(team.id)}
                          className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
                          title="Set as default"
                        >
                          <Icon
                            icon="solar:star-outline"
                            className="text-text-tertiary hover:text-accent-400"
                            width={18}
                          />
                        </button>
                      )}
                      {selectedTeam?.id === team.id && (
                        <Icon
                          icon="solar:check-circle-bold"
                          className="text-accent-400"
                          width={20}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </ScrollShadow>
          )}
        </CardBody>

        {!isPaidPlan && (
          <div className="px-4 py-3 border-t border-border-base">
            <button
              onClick={() => router.push("/dashboard/pricing")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-accent-400/10 border border-accent-400/20 hover:bg-accent-400/20 transition-colors"
            >
              <Icon
                icon="solar:rocket-bold-duotone"
                className="text-accent-400 flex-shrink-0"
                width={20}
              />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-accent-400">Upgrade</p>
                <p className="text-xs text-text-tertiary">
                  Get more credits
                </p>
              </div>
              <Icon
                icon="solar:arrow-right-bold"
                className="text-accent-400"
                width={16}
              />
            </button>
          </div>
        )}

        {isPaidPlan && (
          <div className="px-4 py-3 border-t border-border-base">
            <button
              onClick={() => router.push("/dashboard/pricing")}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                currentPlan === "enterprise"
                  ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                  : currentPlan === "scale"
                    ? "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
                    : currentPlan === "creator"
                      ? "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20"
                      : "bg-accent-400/10 border-accent-400/20 hover:bg-accent-400/20"
              )}
            >
              <Icon
                icon="solar:verified-check-bold"
                className={
                  currentPlan === "enterprise"
                    ? "text-emerald-500"
                    : currentPlan === "scale"
                      ? "text-purple-500"
                      : currentPlan === "creator"
                        ? "text-orange-500"
                        : "text-accent-400"
                }
                width={20}
              />
              <div className="flex-1 text-left">
                <p
                  className={cn(
                    "text-sm font-medium",
                    currentPlan === "enterprise"
                      ? "text-emerald-500"
                      : currentPlan === "scale"
                        ? "text-purple-500"
                        : currentPlan === "creator"
                          ? "text-orange-500"
                          : "text-accent-400"
                  )}
                >
                  {getPlanName(currentPlan)} Plan
                </p>
                <p className="text-xs text-text-tertiary">
                  {currentPlan === "enterprise" ? "Managed plan" : "Manage subscription"}
                </p>
              </div>
              <Icon
                icon="solar:arrow-right-bold"
                className={
                  currentPlan === "enterprise"
                    ? "text-emerald-500"
                    : currentPlan === "scale"
                      ? "text-purple-500"
                      : currentPlan === "creator"
                        ? "text-orange-500"
                        : "text-accent-400"
                }
                width={16}
              />
            </button>
          </div>
        )}

        {usageStats && (
          <div className="px-4 py-3 border-t border-border-base">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-text-secondary font-medium">Usage</span>
              <span className="text-text-tertiary">
                {usageStats.clipsCreated} / {usageStats.limit} credits used
              </span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  usageStats.clipsCreated >= usageStats.limit
                    ? "bg-red-500"
                    : usageStats.clipsCreated >= usageStats.limit * 0.75
                      ? "bg-yellow-500"
                      : "bg-accent-400"
                )}
                style={{
                  width: `${Math.min((usageStats.clipsCreated / usageStats.limit) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-border-base space-y-2">
          <Button
            variant="flat"
            className="w-full bg-accent-400/10 text-accent-400 hover:bg-accent-400/20"
            startContent={
              <Icon icon="solar:add-circle-bold-duotone" width={18} />
            }
            onPress={onCreateTeam}
          >
            Create Team
          </Button>
          {selectedTeam && (
            <Button
              variant="light"
              className="w-full text-text-secondary"
              startContent={
                <Icon icon="solar:settings-bold-duotone" width={18} />
              }
              onPress={onManageTeam}
            >
              Manage Team
            </Button>
          )}
        </div>
      </Card>
  );
}
