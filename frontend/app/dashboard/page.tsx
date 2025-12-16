"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { Button, Card, CardBody, Progress, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { clipsAPI, Clip } from "@/api/clips";
import { useUsageStats } from "@/hooks/useUsageStats";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const { usageStats } = useUsageStats(selectedTeam?.id);

  useEffect(() => {
    if (!user) {
      const accessToken =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      if (!accessToken) {
        router.push("/auth");
        return;
      }
      authAPI
        .getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          router.push("/auth");
        });
    }
  }, [user, router, setUser]);

  useEffect(() => {
    if (selectedTeam?.id) {
      loadRecentClips();
    }
  }, [selectedTeam?.id]);

  const loadRecentClips = async () => {
    if (!selectedTeam?.id) return;

    setIsLoadingClips(true);
    try {
      const clips = await clipsAPI.getClips(selectedTeam.id);
      const sorted = clips
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        .slice(0, 6);
      setRecentClips(sorted);
    } catch (error) {
      console.error("Failed to load clips:", error);
    } finally {
      setIsLoadingClips(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const usagePercentage = usageStats
    ? (usageStats.clipsCreated / usageStats.limit) * 100
    : 0;

  const getPlanColor = (plan?: string) => {
    switch (plan) {
      case "scale":
        return "purple-500";
      case "studio":
        return "accent-400";
      default:
        return "blue-500";
    }
  };

  const getPlanName = (plan?: string) => {
    switch (plan) {
      case "scale":
        return "Scale";
      case "studio":
        return "Studio";
      default:
        return "Free";
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  const currentPlan = selectedTeam?.plan || "free";

  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
              {getGreeting()}, {user?.firstName || "there"}
            </h1>
            <p className="text-text-secondary mt-1">
              Here&apos;s what&apos;s happening with your clips
            </p>
          </div>
          <Button
            className="bg-accent-400 text-white font-semibold"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={() => router.push("/dashboard/create-clip")}
          >
            Create Clip
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  currentPlan === "scale" ? "bg-purple-500/20" : currentPlan === "studio" ? "bg-accent-400/20" : "bg-blue-500/20"
                )}>
                  <Icon
                    icon="solar:bookmark-bold-duotone"
                    className={cn(
                      currentPlan === "scale" ? "text-purple-500" : currentPlan === "studio" ? "text-accent-400" : "text-blue-500"
                    )}
                    width={22}
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full",
                  currentPlan === "scale" ? "bg-purple-500/10 text-purple-500" : currentPlan === "studio" ? "bg-accent-400/10 text-accent-400" : "bg-blue-500/10 text-blue-500"
                )}>
                  {getPlanName(currentPlan)}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-text-primary">
                    {usageStats?.clipsCreated ?? 0}
                  </span>
                  <span className="text-sm text-text-tertiary">
                    / {usageStats?.limit ?? 0} clips
                  </span>
                </div>
                <Progress
                  value={usagePercentage}
                  size="sm"
                  color={
                    usagePercentage >= 100
                      ? "danger"
                      : usagePercentage >= 75
                        ? "warning"
                        : "primary"
                  }
                  classNames={{
                    indicator: currentPlan === "scale" ? "bg-purple-500" : "",
                  }}
                />
                <p className="text-xs text-text-tertiary">
                  {usageStats?.remaining ?? 0} clips remaining this period
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Icon icon="solar:video-library-bold-duotone" className="text-green-500" width={22} />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-2xl font-bold text-text-primary">
                  {recentClips.length}
                </span>
                <p className="text-sm text-text-secondary">Total Clips</p>
              </div>
            </CardBody>
          </Card>

          <Card
            className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-colors cursor-pointer"
            isPressable
            onPress={() => router.push("/dashboard/create-clip")}
          >
            <CardBody className="p-5 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-accent-400/10 flex items-center justify-center mb-3">
                <Icon icon="solar:scissors-bold-duotone" className="text-accent-400" width={26} />
              </div>
              <p className="text-sm font-medium text-text-primary">Create New Clip</p>
              <p className="text-xs text-text-tertiary mt-1">
                Upload a video to get started
              </p>
            </CardBody>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Recent Clips</h2>
            {recentClips.length > 0 && (
              <Button
                variant="light"
                size="sm"
                className="text-text-secondary"
                endContent={<Icon icon="solar:arrow-right-bold" width={16} />}
                onPress={() => router.push("/dashboard/clips")}
              >
                View All
              </Button>
            )}
          </div>

          {isLoadingClips ? (
            <div className="flex items-center justify-center py-16">
              <Icon icon="solar:loading-circle-bold" className="text-4xl animate-spin text-accent-400" />
            </div>
          ) : recentClips.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentClips.map((clip) => (
                <Card
                  key={clip.id}
                  className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-all cursor-pointer group"
                  isPressable
                  onPress={() => router.push(`/dashboard/clips/${clip.id}/edit`)}
                >
                  <CardBody className="p-0">
                    <div className="aspect-[9/16] max-h-48 bg-surface-elevated rounded-t-xl overflow-hidden flex items-center justify-center">
                      {clip.clipUrl ? (
                        <video
                          src={clip.clipUrl}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <Icon icon="solar:video-frame-play-vertical-bold-duotone" className="text-4xl text-text-tertiary" />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-text-primary truncate">
                            {clip.title || `Clip #${clip.id}`}
                          </h3>
                          <p className="text-xs text-text-tertiary mt-1">
                            {formatDate(clip.updated_at)}
                          </p>
                        </div>
                        {clip.clip_score !== undefined && clip.clip_score !== null && (
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            clip.clip_score >= 80
                              ? "bg-green-500/10 text-green-500"
                              : clip.clip_score >= 60
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-surface-elevated text-text-tertiary"
                          )}>
                            <Icon icon="solar:star-bold" width={12} />
                            {clip.clip_score}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-surface-base border border-border-base">
              <CardBody className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center mb-4">
                  <Icon icon="solar:video-frame-play-vertical-bold-duotone" className="text-accent-400" width={32} />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No clips yet
                </h3>
                <p className="text-sm text-text-secondary text-center max-w-sm mb-6">
                  Upload a long-form video and let AI automatically find the best moments for social media
                </p>
                <Button
                  className="bg-accent-400 text-white font-semibold"
                  startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                  onPress={() => router.push("/dashboard/create-clip")}
                >
                  Create Your First Clip
                </Button>
              </CardBody>
            </Card>
          )}
        </div>

        {currentPlan === "free" && (
          <Card className="bg-gradient-to-br from-accent-400/10 to-purple-500/10 border border-accent-400/20">
            <CardBody className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent-400/20 flex items-center justify-center">
                    <Icon icon="solar:rocket-bold-duotone" className="text-accent-400" width={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      Upgrade to Pro
                    </h3>
                    <p className="text-sm text-text-secondary">
                      Unlock unlimited generations and more saved clips
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-accent-400 text-white font-semibold"
                  endContent={<Icon icon="solar:arrow-right-bold" width={18} />}
                  onPress={() => router.push("/dashboard/pricing")}
                >
                  View Plans
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
