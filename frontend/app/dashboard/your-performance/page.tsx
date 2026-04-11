"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button, Chip, useOverlayState } from "@heroui/react";
import { toast } from "@/lib/toast";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  AddAccountModal,
  DateRangeFilter,
  PlatformFilter,
} from "@/components/virality";
import { CompetitorCard, ViralityUpgradeWall } from "@clipper/shared-ui";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import {
  viralityAPI,
  type DashboardStats,
  type ViralityPost,
  type ViralityAccount,
  type AlertLog,
  type CompetitorWithAccounts,
} from "@/api/virality";
import { userPerformanceAPI } from "@/api/userPerformance";
import { canAccessViralityTracker, getViralityAccountLimit } from "@/lib/plans";
import {
  toMyPerfId,
} from "@/lib/viralityConstants";
import { pct } from "@/app/dashboard/virality/[competitorId]/utils";
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
            icon={
              PLATFORM_ICONS[post.accountPlatform] ||
              "solar:video-frame-bold-duotone"
            }
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
      <Chip size="sm" className="capitalize text-xs">
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
      <Chip size="sm" color={isFailed ? "danger" : "success"}>
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
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null,
  );
  const [myDashboardStats, setMyDashboardStats] =
    useState<DashboardStats | null>(null);
  const [allPosts, setAllPosts] = useState<PostWithMeta[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorWithAccounts[]>([]);
  const [postsByAccount, setPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [totalAccountCount, setTotalAccountCount] = useState(0);
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan))
      return;
    try {
      const { startDate, endDate } = dateRange;

      const [withAccounts, stats, myStats, myAccts, alerts] = await Promise.all(
        [
          viralityAPI.getGroupsWithAccounts(selectedTeam.id),
          viralityAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
          userPerformanceAPI.getDashboardStats(
            selectedTeam.id,
            startDate,
            endDate,
          ),
          userPerformanceAPI.getAccounts(selectedTeam.id),
          viralityAPI.getAlertLogs(selectedTeam.id, 5),
        ],
      );

      setDashboardStats(stats);
      setMyDashboardStats(myStats);
      setAlertLogs(alerts);
      setCompetitors(
        withAccounts.filter((g: any) => g.competitor === false),
      );


      const compAccountCount = withAccounts.reduce(
        (sum: number, c: CompetitorWithAccounts) => sum + c.accounts.length,
        0,
      );
      setTotalAccountCount(compAccountCount + myAccts.length);

      const accountMap: Record<number, ViralityAccount> = {};
      for (const c of withAccounts) {
        for (const a of c.accounts) {
          accountMap[a.id] = a;
        }
      }
      for (const a of myAccts) {
        accountMap[a.id] = a;
      }

      const [compPostsByAccount, myPostsByAccount] = await Promise.all([
        viralityAPI.getAllPosts(selectedTeam.id, startDate, endDate),
        userPerformanceAPI.getAllPosts(selectedTeam.id, startDate, endDate),
      ]);

      const mergedPostsByAccount: Record<number, ViralityPost[]> = { ...compPostsByAccount };
      for (const [idStr, acctPosts] of Object.entries(myPostsByAccount)) {
        mergedPostsByAccount[toMyPerfId(Number(idStr))] = acctPosts;
      }
      setPostsByAccount(mergedPostsByAccount);

      const posts: PostWithMeta[] = [];
      for (const [accountIdStr, accountPosts] of Object.entries(
        compPostsByAccount,
      )) {
        const account = accountMap[Number(accountIdStr)];
        if (!account) continue;
        for (const post of accountPosts) {
          posts.push({
            ...post,
            accountUsername: account.username,
            accountPlatform: account.platform,
          });
        }
      }
      for (const [accountIdStr, accountPosts] of Object.entries(
        myPostsByAccount,
      )) {
        const account = accountMap[Number(accountIdStr)];
        if (!account) continue;
        for (const post of accountPosts) {
          posts.push({
            ...post,
            accountUsername: account.username,
            accountPlatform: account.platform,
          });
        }
      }

      setAllPosts(posts);
    } catch (err: any) {
      toast({
        title: "Failed to load dashboard",
        description: err.message,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddAccount = async (
    platform: "tiktok" | "instagram" | "x",
    profileUrl: string,
    options: {
      enableAlerts: boolean;
      competitorId?: number;
      newCompetitorName?: string;
      accountType: "profile" | "hashtag" | "keyword";
      isMyPerformance?: boolean;
    },
  ) => {
    if (!selectedTeam?.id) return;

    let groupId = options.competitorId;

    if (!groupId && options.newCompetitorName) {
      const group = await viralityAPI.createGroup(
        selectedTeam.id,
        options.newCompetitorName,
        undefined,
        false,
      );
      groupId = group.id;
    }

    if (!groupId) {
      throw new Error("Please select or create a group");
    }

    const account = await viralityAPI.addAccount(
      selectedTeam.id,
      platform,
      profileUrl,
      groupId,
      options.accountType,
      false,
    );

    if (options.enableAlerts) {
      await viralityAPI.updateAlertEnabled(selectedTeam.id, account.id, true);
    }

    toast({ title: "Account added", color: "success" });
    await fetchData();
  };

  const competitorCards = useMemo(() => {
    return competitors.map((comp) => {
      const posts = comp.accounts.flatMap((a) => postsByAccount[a.id] || []);
      const followers = comp.accounts.reduce(
        (s, a) => s + (a.follower_count || 0),
        0,
      );
      const totalViews = posts.reduce(
        (s, p) => s + (p.video_play_count || 0),
        0,
      );
      const totalLikes = posts.reduce((s, p) => s + (p.like_count || 0), 0);
      const totalComments = posts.reduce(
        (s, p) => s + (p.comment_count || 0),
        0,
      );
      const engRate =
        totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
      const avgViews =
        posts.length > 0 ? Math.round(totalViews / posts.length) : 0;

      let prevLikes = 0, prevComments = 0, prevViews = 0;
      let latestLikes = 0, latestComments = 0, latestViews = 0;
      let prevFollowers = 0, latestFollowers = 0;
      let hasHistory = false, hasFollowerHistory = false;

      for (const post of posts) {
        const h = post.metrics_history;
        if (!h || h.length < 2) continue;
        hasHistory = true;
        const prev = h[h.length - 2];
        const latest = h[h.length - 1];
        prevLikes += prev.likes;
        prevComments += prev.comments;
        prevViews += prev.views ?? 0;
        latestLikes += latest.likes;
        latestComments += latest.comments;
        latestViews += latest.views ?? 0;
      }

      for (const a of comp.accounts) {
        const fh = a.follower_history;
        if (!fh || fh.length < 2) continue;
        hasFollowerHistory = true;
        prevFollowers += fh[fh.length - 2].followers;
        latestFollowers += fh[fh.length - 1].followers;
      }

      const followersChange = hasFollowerHistory
        ? pct(latestFollowers, prevFollowers)
        : null;
      const viewsChange = hasHistory ? pct(latestViews, prevViews) : null;

      const prevEngRate =
        prevViews > 0 ? ((prevLikes + prevComments) / prevViews) * 100 : 0;
      const latestEngRate =
        latestViews > 0
          ? ((latestLikes + latestComments) / latestViews) * 100
          : 0;
      const engRateChange = hasHistory ? latestEngRate - prevEngRate : null;

      const platforms: string[] = Array.from(
        new Set(comp.accounts.map((a: ViralityAccount) => a.platform)),
      );

      return {
        competitor: comp,
        followers,
        totalViews,
        engRate,
        avgViews,
        platforms,
        followersChange,
        viewsChange,
        engRateChange,
        isMyPerformance: false,
      };
    });
  }, [competitors, postsByAccount]);

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
    const totalLikes = filteredPosts.reduce(
      (s, p) => s + (p.like_count || 0),
      0,
    );
    const totalComments = filteredPosts.reduce(
      (s, p) => s + (p.comment_count || 0),
      0,
    );
    const totalViews = filteredPosts.reduce(
      (s, p) => s + (p.video_play_count || 0),
      0,
    );
    return totalViews > 0
      ? ((totalLikes + totalComments) / totalViews) * 100
      : 0;
  }, [filteredPosts]);

  const sortedByViews = useMemo(() => {
    return [...filteredPosts].sort(
      (a, b) => (b.video_play_count || 0) - (a.video_play_count || 0),
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Your Performance
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              High-level performance overview across all your tracked accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <PlatformFilter
              value={platformFilter}
              onChange={setPlatformFilter}
            />
            <Button
              size="sm"
              className="bg-blue-500 text-white hover:bg-blue-600"
              onPress={onOpen}
              isDisabled={(() => {
                const limit = getViralityAccountLimit(selectedTeam?.plan);
                return limit !== -1 && totalAccountCount >= limit;
              })()}
            >
              <Icon icon="solar:add-circle-bold" width={16} />
              Add Account
            </Button>
          </div>
      </div>

      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </div>

        {/* Competitor Group Cards */}
        <div className="flex flex-wrap gap-4 [&>*]:flex-1 [&>*]:min-w-[250px]">
          {competitorCards.map((card, idx) => (
            <CompetitorCard
              key={card.competitor.id}
              data={{
                id: card.competitor.id,
                name: card.competitor.name,
                accountCount: card.competitor.accounts.length,
                followers: card.followers,
                totalViews: card.totalViews,
                engRate: card.engRate,
                avgViews: card.avgViews,
                platforms: card.platforms,
                followersChange: card.followersChange,
                viewsChange: card.viewsChange,
                engRateChange: card.engRateChange,
                isMyPerformance: card.isMyPerformance,
              }}
              index={idx}
            />
          ))}
        </div>

        {/* Best / Worst Performing Posts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border-base bg-surface-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon
                icon="solar:arrow-up-bold-duotone"
                width={20}
                className="text-green-400"
              />
              <h2 className="text-lg font-semibold text-text-primary">
                Best Performing Posts
              </h2>
            </div>
            {bestPosts.length === 0 ? (
              <p className="text-sm text-text-tertiary py-4 text-center">
                No posts found
              </p>
            ) : (
              bestPosts.map((post, i) => (
                <PostRow key={post.id} post={post} rank={i + 1} />
              ))
            )}
          </div>

          <div className="rounded-xl border border-border-base bg-surface-base p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon
                icon="solar:arrow-down-bold-duotone"
                width={20}
                className="text-red-400"
              />
              <h2 className="text-lg font-semibold text-text-primary">
                Worst Performing Posts
              </h2>
            </div>
            {worstPosts.length === 0 ? (
              <p className="text-sm text-text-tertiary py-4 text-center">
                No posts found
              </p>
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
            <Icon
              icon="solar:bell-bold-duotone"
              width={20}
              className="text-amber-400"
            />
            <h2 className="text-lg font-semibold text-text-primary">
              Recent Virality Alerts
            </h2>
          </div>
          {alertLogs.length === 0 ? (
            <p className="text-sm text-text-tertiary py-4 text-center">
              No alerts yet — configure alert settings in the Competitor Tracker
            </p>
          ) : (
            alertLogs.map((alert) => <AlertRow key={alert.id} alert={alert} />)
          )}
        </div>
      </div>

      <AddAccountModal
        isOpen={isOpen}
        onClose={onClose}
        competitors={competitors}
        hideMyPerformanceOption
        groupLabel="Group"
        onSubmit={handleAddAccount}
        accountCount={totalAccountCount}
        accountLimit={getViralityAccountLimit(selectedTeam?.plan)}
        plan={selectedTeam?.plan}
      />
    </motion.div>
  );
}
