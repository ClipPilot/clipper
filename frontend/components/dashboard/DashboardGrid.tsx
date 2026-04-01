"use client";

import { useState, useEffect } from "react";
import { Card, Button, Chip, Avatar, Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAtom, useAtomValue } from "jotai";
import { selectedTeamAtom, userTeamsAtom } from "@/store/auth";
import { useUsageStats } from "@/hooks/useUsageStats";
import { clipsAPI, Clip } from "@/api/clips";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import { ugcVideoAPI, UGCVideoJob } from "@/api/ugc/video";
import type { FaceSwapJob } from "@/components/ugc-studio/types";

/* ── SVG arc gauge for credits ────────────────────────────────── */
function CreditArc({
  percent,
  size = 100,
}: {
  percent: number;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const startAngle = 135;
  const sweepAngle = 270;
  const arcLen = (sweepAngle / 360) * circ;
  const filled = (Math.min(percent, 100) / 100) * arcLen;

  const color =
    percent >= 90 ? "#ef4444" : percent >= 70 ? "#f59e0b" : "#4F47E6";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-base)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${circ}`}
        strokeDashoffset={0}
        transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
        opacity={0.5}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${circ}`}
        initial={{ strokeDashoffset: arcLen }}
        animate={{ strokeDashoffset: arcLen - filled }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/* ── Pulsing dot for active jobs ──────────────────────────────── */
function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

export function DashboardGrid() {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useAtom(selectedTeamAtom);
  const userTeams = useAtomValue(userTeamsAtom);
  const { usageStats, isLoading: statsLoading } = useUsageStats(
    selectedTeam?.id,
  );
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [pendingClips, setPendingClips] = useState<Clip[]>([]);
  const [pendingFaceSwaps, setPendingFaceSwaps] = useState<FaceSwapJob[]>([]);
  const [pendingUGCJobs, setPendingUGCJobs] = useState<UGCVideoJob[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedTeam?.id) {
        setClipsLoading(false);
        return;
      }
      try {
        const [saved, pending, faceSwapJobs, ugcJobs] = await Promise.all([
          clipsAPI.getSavedClips(selectedTeam.id, 6, 0),
          clipsAPI.getPendingClips(selectedTeam.id),
          faceSwapAPI.getTeamJobs(selectedTeam.id).catch(() => ({ jobs: [] })),
          ugcVideoAPI
            .listVideoJobs(selectedTeam.id, 20, 0)
            .catch(() => ({ jobs: [] })),
        ]);
        setRecentClips(saved.clips);
        setPendingClips(pending.filter((clip) => clip.status !== "failed"));
        const activeFaceSwaps = faceSwapJobs.jobs.filter(
          (job) =>
            job.status === "uploading" ||
            job.status === "queued" ||
            job.status === "running",
        );
        setPendingFaceSwaps(activeFaceSwaps);
        const activeUGCJobs = ugcJobs.jobs.filter(
          (job) => job.status === "queued" || job.status === "generating",
        );
        setPendingUGCJobs(activeUGCJobs);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setClipsLoading(false);
      }
    };
    loadData();
  }, [selectedTeam?.id]);

  const usagePercent = usageStats
    ? Math.round((usageStats.clipsCreated / usageStats.limit) * 100)
    : 0;

  const getPlanGradient = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case "enterprise":
        return "from-emerald-500/20 to-emerald-500/5";
      case "scale":
        return "from-purple-500/20 to-purple-500/5";
      case "studio":
        return "from-accent-400/20 to-accent-400/5";
      default:
        return "from-blue-500/20 to-blue-500/5";
    }
  };

  const getPlanAccent = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case "enterprise":
        return "#10b981";
      case "scale":
        return "#a855f7";
      case "studio":
        return "#4F47E6";
      default:
        return "#3b82f6";
    }
  };

  const quickActions = [
    {
      id: "create",
      label: "AI Clipping",
      description: "From long video",
      icon: "solar:scissors-bold-duotone",
      href: "/dashboard/create-clip",
      color: "#4F47E6",
    },
    {
      id: "faceswap",
      label: "Face Swap",
      description: "Swap faces in video",
      icon: "solar:face-scan-circle-bold-duotone",
      href: "/dashboard/ugc-studio/face-swap",
      color: "#EC4899",
    },
    {
      id: "aivideo",
      label: "UGC Studio",
      description: "Generate from script",
      icon: "solar:magic-stick-3-bold-duotone",
      href: "/dashboard/ugc-studio/ai-video-creator",
      color: "#22C55E",
    },
    {
      id: "library",
      label: "My Library",
      description: "View saved clips",
      icon: "solar:folder-bold-duotone",
      href: "/dashboard/clips",
      color: "#F59E0B",
    },
  ];

  /* ── Pending items for Activity widget ──────────────────────── */
  const allPendingItems: Array<{
    id: string;
    title: string;
    status: string;
    type: "clip" | "faceswap" | "ugc";
    icon: string;
    color: string;
    progress?: number;
  }> = [
    ...pendingClips.map((clip) => ({
      id: `clip-${clip.id}`,
      title: clip.title || `Clip #${clip.id}`,
      status: clip.status,
      type: "clip" as const,
      icon: "solar:scissors-bold-duotone",
      color: "#06b6d4",
    })),
    ...pendingFaceSwaps.map((job) => ({
      id: `faceswap-${job.id}`,
      title: job.title || "Face Swap",
      status: job.status === "running" ? "running" : job.status,
      type: "faceswap" as const,
      icon: "solar:face-scan-circle-bold-duotone",
      color: "#ec4899",
      progress: job.status === "running" ? job.progress || 0 : undefined,
    })),
    ...pendingUGCJobs.map((job) => ({
      id: `ugc-${job.id}`,
      title: job.scriptTitle || "AI Video",
      status: job.status === "generating" ? "generating" : job.status,
      type: "ugc" as const,
      icon: "solar:magic-stick-3-bold-duotone",
      color: "#22c55e",
      progress: job.status === "generating" ? job.progress || 0 : undefined,
    })),
  ];
  const totalPending = allPendingItems.length;
  const typeCounts = {
    clip: pendingClips.length,
    faceswap: pendingFaceSwaps.length,
    ugc: pendingUGCJobs.length,
  };

  const plan = selectedTeam?.plan || "free";

  return (
    <div className="space-y-4">
      {/* ── Main 2-column grid: left content + right activity ── */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* ═══ Left column ═══ */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* Row 1: Credits + Workspace side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Credits */}
            <Card className="bg-surface-base border border-border-base overflow-hidden">
              <div
                className={`absolute inset-0 bg-gradient-to-b ${getPlanGradient(plan)} pointer-events-none`}
              />
              <Card.Content className="p-5 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">
                    Credits
                  </span>
                  <Chip
                    size="sm"
                    variant="tertiary"
                    style={{
                      backgroundColor: `${getPlanAccent(plan)}18`,
                      color: getPlanAccent(plan),
                    }}
                  >
                    {plan}
                  </Chip>
                </div>

                {statsLoading ? (
                  <div className="flex justify-center py-6">
                    <Icon
                      icon="solar:spinner-bold"
                      className="animate-spin text-text-tertiary"
                      width={24}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <CreditArc percent={usagePercent} size={88} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-bold text-text-primary leading-none">
                            {usageStats?.remaining ?? 0}
                          </span>
                          <span className="text-[10px] text-text-tertiary mt-0.5">
                            left
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-tertiary">Used</span>
                          <span className="text-text-primary font-medium tabular-nums">
                            {usageStats?.clipsCreated ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-tertiary">Limit</span>
                          <span className="text-text-primary font-medium tabular-nums">
                            {usageStats?.limit ?? 0}
                          </span>
                        </div>
                        <div className="h-px bg-border-base" />
                        <div className="flex justify-between text-xs">
                          <span className="text-text-tertiary">Remaining</span>
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: getPlanAccent(plan) }}
                          >
                            {usageStats?.remaining ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {plan === "free" && (
                      <Button
                        size="sm"
                        variant="tertiary"
                        className="w-full mt-4 bg-accent-400/10 text-accent-400 font-medium"
                        onPress={() => router.push("/dashboard/pricing")}
                      >
                        <Icon icon="solar:arrow-up-bold" width={14} />
                        Upgrade Plan
                      </Button>
                    )}
                  </>
                )}
              </Card.Content>
            </Card>

            {/* Workspace */}
            <Card className="bg-surface-base border border-border-base">
              <Card.Content className="p-5">
                <span className="text-xs font-semibold tracking-wider uppercase text-text-tertiary mb-4 block">
                  Workspace
                </span>

                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <Avatar
                      size="lg"
                      className="bg-accent-400/10 ring-2 ring-accent-400/30"
                    >
                      {selectedTeam?.logo_url ? (
                        <Avatar.Image
                          src={selectedTeam.logo_url}
                          alt={selectedTeam?.name || "Team"}
                        />
                      ) : null}
                      <Avatar.Fallback className="text-accent-400 font-bold text-lg">
                        {selectedTeam?.name?.charAt(0) || "T"}
                      </Avatar.Fallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-surface-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate text-sm">
                      {selectedTeam?.name || "No Team"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Icon
                        icon={
                          selectedTeam?.role === "owner"
                            ? "solar:crown-bold-duotone"
                            : selectedTeam?.role === "manager"
                              ? "solar:shield-check-bold-duotone"
                              : "solar:user-bold-duotone"
                        }
                        width={12}
                        className="text-text-tertiary"
                      />
                      <span className="text-xs text-text-tertiary capitalize">
                        {selectedTeam?.role || "member"}
                      </span>
                    </div>
                  </div>
                </div>

                {userTeams.length > 1 && (
                  <Dropdown>
                    <Button size="sm" variant="tertiary" className="w-full bg-surface-elevated">
                        Switch Workspace
                        <Icon icon="solar:alt-arrow-down-linear" width={14} />
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        aria-label="Switch team"
                        onAction={(key) => {
                          const team = userTeams.find(
                            (t) => t.id.toString() === key,
                          );
                          if (team) setSelectedTeam(team);
                        }}
                      >
                        {userTeams.map((team) => (
                          <Dropdown.Item
                            key={team.id.toString()}
                            className={
                              team.id === selectedTeam?.id
                                ? "bg-surface-hover"
                                : ""
                            }
                          >
                            <Avatar size="sm" className="w-6 h-6">
                              <Avatar.Fallback>
                                {team.name.charAt(0)}
                              </Avatar.Fallback>
                            </Avatar>
                            {team.name}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                )}
              </Card.Content>
            </Card>
          </div>

          {/* Row 2: Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => router.push(action.href)}
                className="group relative p-4 rounded-xl bg-surface-base border border-border-base hover:border-border-light overflow-hidden transition-colors text-left"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(circle at 30% 50%, ${action.color}08, transparent 70%)`,
                  }}
                />
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${action.color}12` }}
                  >
                    <Icon
                      icon={action.icon}
                      width={22}
                      style={{ color: action.color }}
                    />
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    {action.label}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {action.description}
                  </p>
                </div>
                <Icon
                  icon="solar:arrow-right-up-linear"
                  width={14}
                  className="absolute top-4 right-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </motion.button>
            ))}
          </div>
        </div>

        {/* ═══ Right column: Activity ═══ */}
        <div className="col-span-12 lg:col-span-5">
          <Card className="bg-surface-base border border-border-base overflow-hidden">
            <Card.Content className="p-5 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">
                  Activity
                </span>
                {totalPending > 0 && (
                  <div className="flex items-center gap-2">
                    <PulseDot color="#4F47E6" />
                    <span className="text-xs font-medium text-accent-400 tabular-nums">
                      {totalPending} active
                    </span>
                  </div>
                )}
              </div>

              {clipsLoading ? (
                <div className="flex justify-center py-6">
                  <Icon
                    icon="solar:spinner-bold"
                    className="animate-spin text-text-tertiary"
                    width={24}
                  />
                </div>
              ) : totalPending === 0 ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-3">
                    <Icon
                      icon="solar:check-circle-bold-duotone"
                      width={28}
                      className="text-green-500"
                    />
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    All clear
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    No active jobs
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Type breakdown pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {typeCounts.clip > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-400">
                        <Icon icon="solar:scissors-bold-duotone" width={10} />
                        {typeCounts.clip} clip{typeCounts.clip > 1 ? "s" : ""}
                      </span>
                    )}
                    {typeCounts.faceswap > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-pink-500/10 text-pink-400">
                        <Icon
                          icon="solar:face-scan-circle-bold-duotone"
                          width={10}
                        />
                        {typeCounts.faceswap} swap
                        {typeCounts.faceswap > 1 ? "s" : ""}
                      </span>
                    )}
                    {typeCounts.ugc > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-500/10 text-green-400">
                        <Icon
                          icon="solar:magic-stick-3-bold-duotone"
                          width={10}
                        />
                        {typeCounts.ugc} video{typeCounts.ugc > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Job timeline */}
                  <div className="relative">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border-base" />

                    <AnimatePresence mode="popLayout">
                      {allPendingItems.slice(0, 6).map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ delay: i * 0.05 }}
                          className="relative flex items-start gap-3 py-1.5"
                        >
                          <div className="relative z-10 mt-0.5 shrink-0">
                            <div
                              className="w-[22px] h-[22px] rounded-md flex items-center justify-center"
                              style={{ backgroundColor: `${item.color}20` }}
                            >
                              <Icon
                                icon={item.icon}
                                width={12}
                                style={{ color: item.color }}
                              />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary truncate leading-tight">
                              {item.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-text-tertiary capitalize">
                                {item.status}
                              </span>
                              {item.progress !== undefined && (
                                <div className="flex-1 max-w-[60px]">
                                  <div className="h-1 rounded-full bg-surface-hover overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: item.color }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${item.progress}%` }}
                                      transition={{ duration: 0.6 }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 mt-1">
                            {item.progress !== undefined ? (
                              <span
                                className="text-[10px] font-semibold tabular-nums"
                                style={{ color: item.color }}
                              >
                                {item.progress}%
                              </span>
                            ) : (
                              <PulseDot color={item.color} />
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {allPendingItems.length > 6 && (
                    <button
                      onClick={() => router.push("/dashboard/clips")}
                      className="w-full text-center text-[10px] text-text-tertiary hover:text-text-secondary transition-colors pt-1"
                    >
                      +{allPendingItems.length - 6} more
                    </button>
                  )}
                </div>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>

      {/* ── Recent Clips: full width ────────────────────────────── */}
      <Card className="bg-surface-base border border-border-base">
        <Card.Content className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">
              Recent Clips
            </span>
            {recentClips.length > 0 && (
              <button
                onClick={() => router.push("/dashboard/clips")}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent-400 transition-colors"
              >
                View all
                <Icon icon="solar:arrow-right-linear" width={12} />
              </button>
            )}
          </div>

          {clipsLoading ? (
            <div className="flex justify-center py-8">
              <Icon
                icon="solar:spinner-bold"
                className="animate-spin text-text-tertiary"
                width={28}
              />
            </div>
          ) : recentClips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center mb-3">
                <Icon
                  icon="solar:video-library-bold-duotone"
                  width={28}
                  className="text-text-tertiary"
                />
              </div>
              <p className="text-sm font-medium text-text-primary mb-1">
                No clips yet
              </p>
              <p className="text-xs text-text-tertiary mb-4">
                Create your first clip to get started
              </p>
              <Button
                size="sm"
                className="bg-accent-400 text-white font-medium"
                onPress={() => router.push("/dashboard/create-clip")}
              >
                Create Clip
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {recentClips.map((clip, i) => (
                <motion.button
                  key={clip.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.03 * i }}
                  onClick={() =>
                    router.push(`/dashboard/clips?clipId=${clip.id}`)
                  }
                  className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface-elevated group"
                >
                  {clip.clipUrl ? (
                    <video
                      src={clip.clipUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon
                        icon="solar:video-frame-bold-duotone"
                        width={20}
                        className="text-text-tertiary"
                      />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-5 pb-1.5">
                    <p className="text-[10px] text-white/80 font-medium truncate leading-tight">
                      {clip.title || `Clip #${clip.id}`}
                    </p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Icon
                        icon="solar:play-bold"
                        width={14}
                        className="text-white ml-0.5"
                      />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
