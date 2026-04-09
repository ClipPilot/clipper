"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Chip } from "@heroui/react";
import { toast } from "@/lib/toast";
import { PageLoader } from "@/components/ui/PageLoader";
import { DateRangeFilter, PlatformFilter } from "@/components/virality";
import { ViralityUpgradeWall } from "@clipper/shared-ui";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import {
  viralityAPI,
  type CompetitorWithAccounts,
  type DashboardStats,
  type ViralityPost,
  type ViralityAccount,
  type AlertLog,
} from "@/api/virality";
import { userPerformanceAPI } from "@/api/userPerformance";
import { canAccessViralityTracker } from "@/lib/plans";
import type { PlatformOption } from "@clipper/shared-ui";

type PostWithMeta = ViralityPost & {
  accountUsername: string;
  accountPlatform: string;
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border-base bg-surface-base p-5 flex items-center gap-4">
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon icon={icon} width={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "ri:tiktok-fill",
  instagram: "ri:instagram-fill",
  x: "ri:twitter-x-fill",
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-black",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
  x: "bg-zinc-800",
};

function PostRow({ post, rank }: { post: PostWithMeta; rank: number }) {
  const views = post.video_play_count || 0;
  const likes = post.like_count || 0;
  const comments = post.comment_count || 0;
  const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const showThumbnail =
    post.thumbnail_url &&
    post.accountPlatform !== "instagram" &&
    post.accountPlatform !== "tiktok";

  return (
    <a
      href={post.post_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 border-b border-border-base last:border-b-0 hover:bg-surface-hover/50 -mx-2 px-2 rounded-lg transition-colors"
    >
      <span className="text-sm font-medium text-text-tertiary w-6 text-center">
        {rank}
      </span>
      {showThumbnail ? (
        <img
          src={post.thumbnail_url!}
          alt=""
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div
          className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${PLATFORM_COLORS[post.accountPlatform] || "bg-surface-dark"}`}
        >
          <Icon
            icon={PLATFORM_ICONS[post.accountPlatform] || "solar:video-frame-bold-duotone"}
            width={18}
            className="text-white"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">
          @{post.accountUsername}
        </p>
        <p className="text-xs text-text-tertiary">
          {formatNumber(views)} views &middot; {engRate.toFixed(1)}% eng
        </p>
      </div>
      <Chip
        size="sm"
        className="capitalize text-xs"
      >
        {post.accountPlatform}
      </Chip>
    </a>
  );
}

function AlertRow({ alert }: { alert: AlertLog }) {
  const isFailed = alert.status === "failed";
  const postCount = alert.viral_post_ids.length;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-base last:border-b-0">
      <Chip
        size="sm"
        color={isFailed ? "danger" : "success"}
      >
        {alert.status}
      </Chip>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{alert.subject}</p>
        <p className="text-xs text-text-tertiary">
          {postCount} viral post{postCount !== 1 ? "s" : ""} &middot;{" "}
          {new Date(alert.sent_at).toLocaleDateString()}
        </p>
      </div>
      <Icon
        icon="solar:letter-bold-duotone"
        width={18}
        className="text-text-tertiary flex-shrink-0"
      />
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();
  const [platformFilter, setPlatformFilter] = useState<PlatformOption>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [myDashboardStats, setMyDashboardStats] = useState<DashboardStats | null>(null);
  const [allPosts, setAllPosts] = useState<PostWithMeta[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan)) return;
    try {
      const { startDate, endDate } = dateRange;

      const [competitorsList, stats, myStats, myAccts, alerts] = await Promise.all([
        viralityAPI.getCompetitors(selectedTeam.id),
        viralityAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
        userPerformanceAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
        userPerformanceAPI.getAccounts(selectedTeam.id),
        viralityAPI.getAlertLogs(selectedTeam.id, 5),
      ]);

      setDashboardStats(stats);
      setMyDashboardStats(myStats);
      setAlertLogs(alerts);

      const withAccounts: CompetitorWithAccounts[] = await Promise.all(
        competitorsList.map((c) => viralityAPI.getCompetitor(selectedTeam.id, c.id))
      );

      const accountMap: Record<number, ViralityAccount> = {};
      for (const c of withAccounts) {
        for (const a of c.accounts) {
          accountMap[a.id] = a;
        }
      }
      for (const a of myAccts) {
        accountMap[a.id] = a;
      }

      const allCompAccounts = withAccounts.flatMap((c) => c.accounts);
      const posts: PostWithMeta[] = [];

      const postArrays = await Promise.all([
        ...allCompAccounts.map((a) =>
          viralityAPI
            .getAccountPosts(selectedTeam.id, a.id, 50, 0, startDate, endDate)
            .then((p) => p.map((post) => ({ ...post, accountUsername: a.username, accountPlatform: a.platform })))
        ),
        ...myAccts.map((a) =>
          userPerformanceAPI
            .getAccountPosts(selectedTeam.id, a.id, 50, 0, startDate, endDate)
            .then((p) => p.map((post) => ({ ...post, accountUsername: a.username, accountPlatform: a.platform })))
        ),
      ]);

      for (const arr of postArrays) {
        posts.push(...arr);
      }

      setAllPosts(posts);
    } catch (err: any) {
      toast({ title: "Failed to load dashboard", description: err.message, color: "danger" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPosts = useMemo(() => {
    if (platformFilter === "all") return allPosts;
    return allPosts.filter((p) => p.accountPlatform === platformFilter);
  }, [allPosts, platformFilter]);

  const totalReach = useMemo(() => {
    const compViews = dashboardStats?.totalViews || 0;
    const myViews = myDashboardStats?.totalViews || 0;
    return compViews + myViews;
  }, [dashboardStats, myDashboardStats]);

  const totalImpressions = useMemo(() => {
    return filteredPosts.reduce((s, p) => s + (p.video_play_count || 0), 0);
  }, [filteredPosts]);

  const engagementRate = useMemo(() => {
    const totalLikes = filteredPosts.reduce((s, p) => s + (p.like_count || 0), 0);
    const totalComments = filteredPosts.reduce((s, p) => s + (p.comment_count || 0), 0);
    const totalViews = filteredPosts.reduce((s, p) => s + (p.video_play_count || 0), 0);
    return totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
  }, [filteredPosts]);

  const shareOfVoice = useMemo(() => {
    const myViews = myDashboardStats?.totalViews || 0;
    return totalReach > 0 ? (myViews / totalReach) * 100 : 0;
  }, [myDashboardStats, totalReach]);

  const sortedByViews = useMemo(() => {
    return [...filteredPosts].sort(
      (a, b) => (b.video_play_count || 0) - (a.video_play_count || 0)
    );
  }, [filteredPosts]);

  const bestPosts = sortedByViews.slice(0, 5);
  const worstPosts = useMemo(() => {
    return [...filteredPosts]
      .filter((p) => (p.video_play_count || 0) > 0)
      .sort((a, b) => (a.video_play_count || 0) - (b.video_play_count || 0))
      .slice(0, 5);
  }, [filteredPosts]);

  if (!canAccessViralityTracker(selectedTeam?.plan)) {
    return <ViralityUpgradeWall />;
  }

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8 overflow-x-hidden"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Executive Dashboard
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              High-level performance overview across all tracked accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <PlatformFilter value={platformFilter} onChange={setPlatformFilter} />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Reach"
            value={formatNumber(totalReach)}
            icon="solar:eye-bold-duotone"
            color="bg-blue-500"
          />
          <KpiCard
            label="Total Impressions"
            value={formatNumber(totalImpressions)}
            icon="solar:graph-up-bold-duotone"
            color="bg-purple-500"
          />
          <KpiCard
            label="Engagement Rate"
            value={`${engagementRate.toFixed(2)}%`}
            icon="solar:heart-pulse-bold-duotone"
            color="bg-pink-500"
          />
          <KpiCard
            label="Share of Voice"
            value={`${shareOfVoice.toFixed(1)}%`}
            icon="solar:chat-round-dots-bold-duotone"
            color="bg-emerald-500"
          />
        </div>

        {/* Best / Worst Performing Posts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border-base bg-surface-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon icon="solar:arrow-up-bold-duotone" width={20} className="text-green-400" />
              <h2 className="text-lg font-semibold text-text-primary">
                Best Performing Posts
              </h2>
            </div>
            {bestPosts.length === 0 ? (
              <p className="text-sm text-text-tertiary py-4 text-center">No posts found</p>
            ) : (
              bestPosts.map((post, i) => (
                <PostRow key={post.id} post={post} rank={i + 1} />
              ))
            )}
          </div>

          <div className="rounded-xl border border-border-base bg-surface-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon icon="solar:arrow-down-bold-duotone" width={20} className="text-red-400" />
              <h2 className="text-lg font-semibold text-text-primary">
                Worst Performing Posts
              </h2>
            </div>
            {worstPosts.length === 0 ? (
              <p className="text-sm text-text-tertiary py-4 text-center">No posts found</p>
            ) : (
              worstPosts.map((post, i) => (
                <PostRow key={post.id} post={post} rank={i + 1} />
              ))
            )}
          </div>
        </div>

        {/* Recent Virality Alerts */}
        <div className="rounded-xl border border-border-base bg-surface-base p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="solar:bell-bold-duotone" width={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-text-primary">
              Recent Virality Alerts
            </h2>
          </div>
          {alertLogs.length === 0 ? (
            <p className="text-sm text-text-tertiary py-4 text-center">
              No alerts yet — configure alert settings in the Competitor Tracker
            </p>
          ) : (
            alertLogs.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
