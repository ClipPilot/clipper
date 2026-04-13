"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button, Chip, useOverlayState } from "@heroui/react";
import { toast } from "@/lib/toast";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  ActivityFeed,
  AddAccountModal,
  DeleteGroupModal,
  DateRangeFilter,
  HeadToHeadTable,
  PlatformFilter,
} from "@/components/virality";
import { CompetitorCard, ViralityUpgradeWall, type FeedPost, computeGroupCardData } from "@clipper/shared-ui";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import {
  viralityAPI,
  type ViralityPost,
  type ViralityAccount,
  type AlertLog,
  type CompetitorWithAccounts,
} from "@/api/virality";
import { userPerformanceAPI } from "@/api/userPerformance";
import { canAccessViralityTracker, getViralityAccountLimit } from "@/lib/plans";
import { formatNumber } from "@/lib/formatters";
import { pct, computePostsPerWeek } from "@/app/dashboard/virality/[competitorId]/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import type { PlatformOption } from "@clipper/shared-ui";

type PostWithMeta = ViralityPost & {
  accountUsername: string;
  accountPlatform: string;
};

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

export default function YourCompetitorsPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();
  const [platformFilter, setPlatformFilter] = useState<PlatformOption>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<PostWithMeta[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [competitorGroups, setCompetitorGroups] = useState<CompetitorWithAccounts[]>([]);
  const [myAccounts, setMyAccounts] = useState<ViralityAccount[]>([]);
  const [compPostsByAccount, setCompPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [myPostsByAccount, setMyPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [totalAccountCount, setTotalAccountCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; accountCount: number } | null>(null);
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan))
      return;
    try {
      const { startDate, endDate } = dateRange;

      const myAccts = await userPerformanceAPI.getAccounts(selectedTeam.id);

      const [withAccounts, alerts] = await Promise.all([
        viralityAPI.getGroupsWithAccounts(selectedTeam.id),
        viralityAPI.getAlertLogs(selectedTeam.id, 5),
      ]);

      setAlertLogs(alerts);
      setMyAccounts(myAccts);
      setCompetitorGroups(
        withAccounts.filter((g: any) => g.competitor === true),
      );

      const compAccountCount = withAccounts.reduce(
        (sum: number, c: CompetitorWithAccounts) => sum + c.accounts.length,
        0,
      );
      setTotalAccountCount(compAccountCount + myAccts.length);

      const accountMap: Record<number, ViralityAccount> = {};
      for (const c of withAccounts.filter((g: any) => g.competitor === true)) {
        for (const a of c.accounts) {
          accountMap[a.id] = a;
        }
      }

      const [compPosts, myPosts] = await Promise.all([
        viralityAPI.getAllPosts(selectedTeam.id, startDate, endDate),
        userPerformanceAPI.getAllPosts(selectedTeam.id, startDate, endDate),
      ]);

      setCompPostsByAccount(compPosts);

      const myPostsMap: Record<number, ViralityPost[]> = {};
      for (const [idStr, acctPosts] of Object.entries(myPosts)) {
        myPostsMap[Number(idStr)] = acctPosts;
      }
      setMyPostsByAccount(myPostsMap);

      const posts: PostWithMeta[] = [];
      for (const [accountIdStr, accountPosts] of Object.entries(compPosts)) {
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
        true,
      );
      groupId = group.id;
    }

    if (!groupId) {
      throw new Error("Please select or create a competitor group");
    }

    const account = await viralityAPI.addAccount(
      selectedTeam.id,
      platform,
      profileUrl,
      groupId,
      options.accountType,
      true,
    );

    if (options.enableAlerts) {
      await viralityAPI.updateAlertEnabled(selectedTeam.id, account.id, true);
    }

    toast({ title: "Competitor added", color: "success" });
    await fetchData();
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.deleteGroup(selectedTeam.id, groupId);
      toast({ title: "Group deleted", color: "success" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed to delete group", description: err.message, color: "danger" });
    }
  };

  const handleMoveAndDelete = async (sourceGroupId: number, targetGroupId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.bulkMoveAccounts(selectedTeam.id, { sourceGroupId, targetGroupId });
      await viralityAPI.deleteGroup(selectedTeam.id, sourceGroupId);
      toast({ title: "Accounts moved and group deleted", color: "success" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed to move accounts", description: err.message, color: "danger" });
    }
  };

  const openDeleteModal = (card: { id: number; name: string; accountCount: number }) => {
    setDeleteTarget(card);
  };

  const competitorCards = useMemo(() => {
    return competitorGroups.map((comp) => ({
      competitor: comp,
      ...computeGroupCardData(comp.accounts, compPostsByAccount),
    }));
  }, [competitorGroups, compPostsByAccount]);

  const headToHeadData = useMemo(() => {
    const allMyPosts = Object.values(myPostsByAccount).flat();
    const myFollowers = myAccounts.reduce((s, a) => s + (a.follower_count || 0), 0);
    const myTotalViews = allMyPosts.reduce((s, p) => s + (p.video_play_count || 0), 0);
    const myTotalLikes = allMyPosts.reduce((s, p) => s + (p.like_count || 0), 0);
    const myTotalComments = allMyPosts.reduce((s, p) => s + (p.comment_count || 0), 0);
    const myEngRate = myTotalViews > 0 ? ((myTotalLikes + myTotalComments) / myTotalViews) * 100 : 0;
    const myAvgViews = allMyPosts.length > 0 ? Math.round(myTotalViews / allMyPosts.length) : 0;
    const myPostsPerWeek = computePostsPerWeek(allMyPosts);

    const myRow = {
      name: "Your Performance",
      followers: myFollowers,
      totalViews: myTotalViews,
      totalPosts: allMyPosts.length,
      engRate: myEngRate,
      postsPerWeek: myPostsPerWeek,
      avgViews: myAvgViews,
    };

    const competitorRows = competitorCards.map((card) => ({
      name: card.competitor.name,
      followers: card.followers,
      totalViews: card.totalViews,
      totalPosts: card.competitor.accounts.flatMap((a) => compPostsByAccount[a.id] || []).length,
      engRate: card.engRate,
      postsPerWeek: card.contentVelocity,
      avgViews: card.avgViews,
    }));

    return [myRow, ...competitorRows];
  }, [myAccounts, myPostsByAccount, competitorCards, compPostsByAccount]);

  const PIE_COLORS = ["#a78bfa", "#3b82f6", "#f97316", "#10b981", "#ef4444", "#eab308", "#ec4899"];

  const shareOfViewsData = useMemo(() => {
    return headToHeadData
      .filter((d) => d.totalViews > 0)
      .map((d) => ({ name: d.name, value: d.totalViews }));
  }, [headToHeadData]);

  const totalShareViews = useMemo(
    () => shareOfViewsData.reduce((s, d) => s + d.value, 0),
    [shareOfViewsData],
  );

  const filteredPosts = useMemo(() => {
    if (platformFilter === "all") return allPosts;
    return allPosts.filter((p) => p.accountPlatform === platformFilter);
  }, [allPosts, platformFilter]);

  const feedPosts: FeedPost[] = useMemo(() => {
    return filteredPosts.map((p) => ({
      id: p.id,
      accountId: p.account_id,
      accountUsername: p.accountUsername,
      platform: p.accountPlatform,
      caption: p.caption,
      thumbnailUrl: p.thumbnail_url,
      postUrl: p.post_url,
      postedAt: p.posted_at,
      likeCount: p.like_count || 0,
      commentCount: p.comment_count || 0,
      viewCount: p.video_play_count ?? 0,
      massPostId: p.mass_post_id,
      campaignName: p.campaign_name,
    }));
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
            Your Competitors
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Track and compare competitor performance against yours
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
            Add Competitor
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Competitor Group Cards */}
        <div className="flex flex-wrap gap-4 [&>*]:flex-1 [&>*]:min-w-[250px]">
          {competitorCards.map((card, idx) => (
            <CompetitorCard
              key={card.competitor.id}
              data={{
                id: card.competitor.id,
                name: card.competitor.name,
                accountCount: card.accountCount,
                followers: card.followers,
                totalViews: card.totalViews,
                engRate: card.engRate,
                avgViews: card.avgViews,
                platforms: card.platforms,
                followersChange: card.followersChange,
                viewsChange: card.viewsChange,
                engRateChange: card.engRateChange,
                contentVelocity: card.contentVelocity,
              }}
              index={idx}
              onView={(id) => router.push(`/dashboard/virality/${id}`)}
              actions={
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="tertiary"
                    className="bg-accent-400/10 text-accent-400 text-[11px] h-7 min-w-0 px-2.5"
                    onPress={() => router.push(`/dashboard/virality/${card.competitor.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    isIconOnly
                    variant="tertiary"
                    className="text-red-400 hover:bg-red-400/10 h-7 w-7 min-w-0"
                    onPress={() => openDeleteModal({ id: card.competitor.id, name: card.competitor.name, accountCount: card.accountCount })}
                  >
                    <Icon icon="solar:trash-bin-minimalistic-linear" width={14} />
                  </Button>
                </div>
              }
            />
          ))}
        </div>

        {/* Head-to-Head Comparison */}
        <HeadToHeadTable competitors={headToHeadData} />

        {/* Share of Views & Competitor Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          <div className="xl:col-span-1 [&>*]:h-full">
            <div className="rounded-2xl border border-border-base bg-surface-base p-6 flex flex-col">
              <h3 className="text-base font-semibold text-text-primary mb-4">Share of Views</h3>
              {shareOfViewsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
                    <Icon icon="solar:pie-chart-2-bold" width={24} className="text-text-tertiary" />
                  </div>
                  <p className="text-text-secondary text-sm">No view data yet</p>
                </div>
              ) : (
                <>
                  <div className="w-full aspect-square max-w-[280px] mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={shareOfViewsData}
                          cx="50%"
                          cy="50%"
                          innerRadius="55%"
                          outerRadius="85%"
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {shareOfViewsData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          content={({ payload }) => {
                            if (!payload?.[0]) return null;
                            const d = payload[0].payload as { name: string; value: number };
                            const pctValue = totalShareViews > 0 ? ((d.value / totalShareViews) * 100).toFixed(1) : "0";
                            return (
                              <div className="bg-surface-elevated border border-border-base rounded-lg px-3 py-2 shadow-lg">
                                <p className="text-xs font-medium text-text-primary">{d.name}</p>
                                <p className="text-xs text-text-secondary">{formatNumber(d.value)} views ({pctValue}%)</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-auto pt-4 border-t border-border-base">
                    {shareOfViewsData.map((d, i) => {
                      const pctValue = totalShareViews > 0 ? ((d.value / totalShareViews) * 100).toFixed(1) : "0";
                      return (
                        <div key={d.name} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                            <span className="text-sm text-text-secondary truncate">{d.name}</span>
                          </div>
                          <span className="text-sm font-medium text-text-primary flex-shrink-0">{pctValue}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="xl:col-span-2 [&>*]:h-full">
            <ActivityFeed
              posts={feedPosts}
              title="Competitor Content"
              tabs={[
                { key: "best", label: "Best" },
                { key: "worst", label: "Worst" },
                { key: "recent", label: "Recent" },
              ]}
              defaultTab="best"
              maxHeight="500px"
            />
          </div>
        </div>
      </div>

      <AddAccountModal
        isOpen={isOpen}
        onClose={onClose}
        competitors={competitorGroups}
        hideMyPerformanceOption
        groupLabel="Competitor"
        onSubmit={handleAddAccount}
        accountCount={totalAccountCount}
        accountLimit={getViralityAccountLimit(selectedTeam?.plan)}
        plan={selectedTeam?.plan}
      />

      <DeleteGroupModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        group={deleteTarget}
        availableGroups={competitorGroups}
        onDelete={handleDeleteGroup}
        onMoveAndDelete={handleMoveAndDelete}
      />
    </motion.div>
  );
}
