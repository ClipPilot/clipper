"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button, Chip, useOverlayState } from "@heroui/react";
import { toast } from "@/lib/toast";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  AccountsTable,
  ActivityFeed,
  AddAccountModal,
  DeleteGroupModal,
  DateRangeFilter,
  PlatformFilter,
} from "@/components/virality";
import { CompetitorCard, ViralityUpgradeWall, type FeedPost, computeGroupCardData } from "@clipper/shared-ui";
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
  const router = useRouter();
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
  const [myAccounts, setMyAccounts] = useState<ViralityAccount[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; accountCount: number } | null>(null);
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan))
      return;
    try {
      const { startDate, endDate } = dateRange;

      const myAccts = await userPerformanceAPI.getAccounts(selectedTeam.id);
      setMyAccounts(myAccts);

      const [withAccounts, stats, myStats, alerts] = await Promise.all([
        viralityAPI.getGroupsWithAccounts(selectedTeam.id),
        viralityAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
        userPerformanceAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
        viralityAPI.getAlertLogs(selectedTeam.id, 5),
      ]);

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
      for (const a of myAccts) {
        accountMap[a.id] = a;
      }

      const myPostsByAccount = await userPerformanceAPI.getAllPosts(
        selectedTeam.id,
        startDate,
        endDate,
      );

      const postsByAcct: Record<number, ViralityPost[]> = {};
      for (const [idStr, acctPosts] of Object.entries(myPostsByAccount)) {
        postsByAcct[Number(idStr)] = acctPosts;
      }
      setPostsByAccount(postsByAcct);

      const posts: PostWithMeta[] = [];
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

  const managedAccts = useMemo(() => myAccounts.filter((a: any) => a.source === "mass_posting"), [myAccounts]);

  const managedCardData = useMemo(() => {
    if (managedAccts.length === 0) return null;
    return { id: "managed" as const, name: "Cuttr Managed", ...computeGroupCardData(managedAccts, postsByAccount) };
  }, [managedAccts, postsByAccount]);

  const competitorCards = useMemo(() => {
    return competitors.map((comp) => ({
      id: comp.id,
      name: comp.name,
      accounts: comp.accounts,
      ...computeGroupCardData(comp.accounts, postsByAccount),
    }));
  }, [competitors, postsByAccount]);

  const accountRows = useMemo(() => {
    const rows: import("@clipper/shared-ui").AccountRow[] = [];
    for (const group of competitors) {
      for (const a of group.accounts) {
        const acctPosts = postsByAccount[a.id] || [];
        const views = acctPosts.reduce((s, p) => s + (p.video_play_count || 0), 0);
        const postCount = acctPosts.length;
        rows.push({
          id: a.id,
          username: a.username,
          displayName: a.display_name || "",
          platform: a.platform,
          accountType: (a.account_type as "profile" | "hashtag" | "keyword") || "profile",
          competitorName: group.name,
          competitorId: group.id,
          views,
          avgViews: postCount > 0 ? Math.round(views / postCount) : 0,
          postCount,
          isActive: a.is_active !== false,
          alertEnabled: !!a.alert_enabled,
        });
      }
    }
    return rows;
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

        {/* Account Group Cards */}
        <div className="flex flex-wrap gap-4 [&>*]:flex-1 [&>*]:min-w-[250px]">
          {managedCardData && (
            <CompetitorCard
              data={managedCardData as any}
              index={0}
              onView={() => router.push("/dashboard/your-performance/managed")}
              nameOverride={
                <div>
                  <p className="text-sm font-medium text-text-primary">Cuttr Managed</p>
                  <span className="text-[10px] text-text-tertiary">
                    {managedCardData.accountCount} account{managedCardData.accountCount !== 1 ? "s" : ""}
                  </span>
                </div>
              }
            />
          )}
          {competitorCards.map((card, idx) => (
            <CompetitorCard
              key={card.id}
              data={card}
              index={idx + (managedCardData ? 1 : 0)}
              onView={(id) => router.push(`/dashboard/virality/${id}`)}
              actions={
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="tertiary"
                    className="bg-accent-400/10 text-accent-400 text-[11px] h-7 min-w-0 px-2.5"
                    onPress={() => router.push(`/dashboard/virality/${card.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    isIconOnly
                    variant="tertiary"
                    className="text-red-400 hover:bg-red-400/10 h-7 w-7 min-w-0"
                    onPress={() => openDeleteModal({ id: card.id, name: card.name, accountCount: card.accountCount })}
                  >
                    <Icon icon="solar:trash-bin-minimalistic-linear" width={14} />
                  </Button>
                </div>
              }
            />
          ))}
        </div>

        {/* Accounts & Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          <div className="xl:col-span-2 [&>*]:h-full">
            <AccountsTable
              accounts={accountRows}
              platformFilter={platformFilter}
              accountLimit={getViralityAccountLimit(selectedTeam?.plan)}
              availableGroups={competitors.map((c) => ({ id: c.id, name: c.name }))}
              onToggleAlert={async (accountId, enabled) => {
                if (!selectedTeam?.id) return;
                try {
                  await userPerformanceAPI.updateAlertEnabled(selectedTeam.id, accountId, enabled);
                  toast({ title: `Alerts ${enabled ? "enabled" : "disabled"}`, color: "success" });
                  await fetchData();
                } catch (err: any) {
                  toast({ title: "Failed to update alerts", description: err.message, color: "danger" });
                }
              }}
              onToggleStatus={async (accountId, newStatus) => {
                if (!selectedTeam?.id) return;
                try {
                  await userPerformanceAPI.updateAccountStatus(selectedTeam.id, accountId, newStatus === "active");
                  toast({ title: `Account ${newStatus === "active" ? "activated" : "deactivated"}`, color: "success" });
                  await fetchData();
                } catch (err: any) {
                  toast({ title: "Failed to update status", description: err.message, color: "danger" });
                }
              }}
              onDelete={async (accountId) => {
                if (!selectedTeam?.id) return;
                try {
                  await userPerformanceAPI.deleteAccount(selectedTeam.id, accountId);
                  toast({ title: "Account deleted", color: "success" });
                  await fetchData();
                } catch (err: any) {
                  toast({ title: "Failed to delete account", description: err.message, color: "danger" });
                }
              }}
              onMoveAccount={async (accountId, targetGroupId) => {
                if (!selectedTeam?.id) return;
                try {
                  await viralityAPI.moveAccountToGroup(selectedTeam.id, accountId, { groupId: targetGroupId, isCompetitor: false });
                  toast({ title: "Account moved", color: "success" });
                  await fetchData();
                } catch (err: any) {
                  toast({ title: "Failed to move account", description: err.message, color: "danger" });
                }
              }}
            />
          </div>
          <div className="xl:col-span-1 [&>*]:h-full">
            <ActivityFeed
              posts={feedPosts}
              title="Your Content"
              tabs={[
                { key: "best", label: "Best" },
                { key: "worst", label: "Worst" },
                { key: "recent", label: "Recent" },
              ]}
              defaultTab="best"
              maxHeight="720px"
            />
          </div>
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

      <DeleteGroupModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        group={deleteTarget}
        availableGroups={competitors}
        onDelete={handleDeleteGroup}
        onMoveAndDelete={handleMoveAndDelete}
      />
    </motion.div>
  );
}
