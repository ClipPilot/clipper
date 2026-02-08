"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Pagination,
  Spinner,
  Spacer,
  Tooltip as HTooltip,
  addToast,
  cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useTeams } from "@/hooks/useTeams";
import {
  viralityAPI,
  type CompetitorWithTargets,
  type ViralityPost,
} from "@/api/virality";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(num: number) {
  const abs = Math.abs(num);
  if (abs >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatChartValue(value: number) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(0) + "K";
  return value.toLocaleString();
}

// ─── Chart Data Builder ──────────────────────────────────────────────────────

interface AggregatedDay {
  date: string;
  likes: number;
  comments: number;
  views: number;
}

function buildChartData(
  posts: ViralityPost[],
  weekFilter: number
): AggregatedDay[] {
  const byDate = new Map<string, { likes: number; comments: number; views: number }>();

  for (const post of posts) {
    if (!post.metrics_history?.length) continue;
    for (const entry of post.metrics_history) {
      const day = entry.recorded_at.slice(0, 10); // YYYY-MM-DD
      const existing = byDate.get(day) || { likes: 0, comments: 0, views: 0 };
      existing.likes += entry.likes;
      existing.comments += entry.comments;
      existing.views += entry.views ?? 0;
      byDate.set(day, existing);
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weekFilter * 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return Array.from(byDate.entries())
    .filter(([date]) => date >= cutoffStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...vals,
    }));
}

// ─── Analytics Chart ─────────────────────────────────────────────────────────

const CHART_LINE_COLOR = "hsl(var(--heroui-primary))";

type ChartMetricKey = "likes" | "comments" | "views";

interface AnalyticsChartProps {
  posts: ViralityPost[];
}

function AnalyticsChart({ posts }: AnalyticsChartProps) {
  const [weekFilter, setWeekFilter] = useState(4);
  const [activeMetric, setActiveMetric] = useState<ChartMetricKey>("likes");

  const chartData = useMemo(
    () => buildChartData(posts, weekFilter),
    [posts, weekFilter]
  );

  const hasData = chartData.length > 0;

  // Compute totals from chart data
  const totals = useMemo(() => {
    const likes = chartData.reduce((s, d) => s + d.likes, 0);
    const comments = chartData.reduce((s, d) => s + d.comments, 0);
    const views = chartData.reduce((s, d) => s + d.views, 0);
    return { likes, comments, views };
  }, [chartData]);

  const metrics: {
    key: ChartMetricKey;
    title: string;
    value: number;
    tooltip?: string;
  }[] = [
    { key: "likes", title: "Total Likes", value: totals.likes },
    { key: "comments", title: "Total Comments", value: totals.comments },
    { key: "views", title: "Total Views", value: totals.views, tooltip: "Only counts views on video posts (Reels)" },
  ];

  // Build chart series based on active metric
  const series = useMemo(() => {
    return chartData.map((d) => ({
      date: d.date,
      value: d[activeMetric],
    }));
  }, [chartData, activeMetric]);

  return (
    <Card className="bg-surface-base border border-border-base">
      <section className="flex flex-col flex-nowrap">
        <div className="flex flex-col justify-between gap-y-2 p-6">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-medium text-text-primary font-medium">
                Analytics
              </dt>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-[3px] rounded-full"
                  style={{ backgroundColor: CHART_LINE_COLOR }}
                />
                <span className="text-xs text-text-tertiary">Aggregated</span>
              </div>
            </div>
            <Spacer y={2} />
            <Tabs
              size="sm"
              selectedKey={String(weekFilter)}
              onSelectionChange={(key) => setWeekFilter(Number(key))}
            >
              <Tab key="1" title="1 Week" />
              <Tab key="2" title="2 Weeks" />
              <Tab key="3" title="3 Weeks" />
              <Tab key="4" title="4 Weeks" />
            </Tabs>
            <div className="mt-2 flex w-full items-center">
              <div className="-my-3 flex w-full items-center gap-x-3 overflow-x-auto py-3">
                {metrics.map(({ key, title, value, tooltip }) => (
                  <button
                    key={key}
                    className={cn(
                      "rounded-medium flex w-full flex-col gap-2 p-3 transition-colors",
                      { "bg-default-100": activeMetric === key }
                    )}
                    onClick={() => setActiveMetric(key)}
                  >
                    <span
                      className={cn(
                        "text-small text-default-500 font-medium transition-colors inline-flex items-center gap-1",
                        { "text-primary": activeMetric === key }
                      )}
                    >
                      {title}
                      {tooltip && (
                        <HTooltip content={tooltip} placement="top" size="sm">
                          <Icon
                            icon="solar:info-circle-linear"
                            width={14}
                            className="text-default-400 cursor-help"
                          />
                        </HTooltip>
                      )}
                    </span>
                    <div className="flex items-center gap-x-3">
                      <span className="text-foreground text-3xl font-bold">
                        {formatChartValue(value)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {hasData ? (
          <ResponsiveContainer
            className="min-h-[300px] [&_.recharts-surface]:outline-hidden"
            height="100%"
            width="100%"
          >
            <AreaChart
              key={`${weekFilter}-${activeMetric}`}
              accessibilityLayer
              data={series}
              height={300}
              margin={{ left: 0, right: 0 }}
              width={500}
            >
              <defs>
                <linearGradient id="gradient-main" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="10%"
                    stopColor={CHART_LINE_COLOR}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_LINE_COLOR}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="hsl(var(--heroui-default-200))"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="date"
                style={{ fontSize: "var(--heroui-font-size-tiny)" }}
                tickLine={false}
                interval={weekFilter <= 1 ? 0 : weekFilter <= 2 ? 1 : Math.max(0, Math.floor(series.length / 7) - 1)}
              />
              <Tooltip
                content={({ label, payload }) => (
                  <div className="rounded-medium bg-foreground text-tiny shadow-small flex h-auto min-w-[140px] items-center gap-x-2 p-2.5">
                    <div className="flex w-full flex-col gap-y-1">
                      {payload?.map((p, index) => (
                        <div
                          key={index}
                          className="text-small text-background flex w-full items-center justify-between gap-x-2"
                        >
                          <span className="font-medium">
                            {formatChartValue(p.value as number)}
                          </span>
                        </div>
                      ))}
                      <span className="text-small text-foreground-400 font-medium mt-0.5">
                        {label}
                      </span>
                    </div>
                  </div>
                )}
                cursor={{ strokeWidth: 0 }}
              />
              <Area
                activeDot={{
                  stroke: CHART_LINE_COLOR,
                  strokeWidth: 2,
                  fill: "hsl(var(--heroui-background))",
                  r: 4,
                }}
                animationDuration={800}
                animationEasing="ease-in-out"
                dataKey="value"
                fill="url(#gradient-main)"
                stroke={CHART_LINE_COLOR}
                strokeWidth={2.5}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Icon
              icon="solar:chart-2-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-text-secondary text-sm">
              Metrics will appear after the next sync
            </p>
          </div>
        )}
      </section>
    </Card>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CompetitorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { selectedTeam } = useTeams();
  const competitorId = Number(params.competitorId);

  const [competitor, setCompetitor] = useState<CompetitorWithTargets | null>(
    null
  );
  const [postsByTarget, setPostsByTarget] = useState<
    Record<number, ViralityPost[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTargetId, setActiveTargetId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const rowsPerPage = 6;

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || isNaN(competitorId)) return;
    try {
      const comp = await viralityAPI.getCompetitor(
        selectedTeam.id,
        competitorId
      );
      setCompetitor(comp);

      // Fetch posts for each target
      const postsMap: Record<number, ViralityPost[]> = {};
      await Promise.all(
        comp.targets.map(async (t) => {
          const posts = await viralityAPI.getTargetPosts(
            selectedTeam.id,
            t.id,
            100
          );
          postsMap[t.id] = posts;
        })
      );
      setPostsByTarget(postsMap);
    } catch (err: any) {
      addToast({
        title: "Failed to load competitor",
        description: err.message,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, competitorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pagination when tab changes
  const handleTabChange = (key: React.Key) => {
    setActiveTargetId(String(key));
    setPage(1);
  };

  const handleSyncAll = async () => {
    if (!selectedTeam?.id || !competitor) return;
    setIsSyncing(true);
    try {
      for (const target of competitor.targets) {
        await viralityAPI.syncTarget(selectedTeam.id, target.id);
      }
      addToast({ title: "Sync complete", color: "success" });
      await fetchData();
    } catch (err: any) {
      addToast({
        title: "Sync failed",
        description: err.message,
        color: "danger",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine which targets/posts are active based on tab
  const activeTargets = useMemo(() => {
    if (!competitor) return [];
    if (activeTargetId === "all") return competitor.targets;
    const id = Number(activeTargetId);
    return competitor.targets.filter((t) => t.id === id);
  }, [competitor, activeTargetId]);

  const activePosts = useMemo(() => {
    const posts: ViralityPost[] = [];
    for (const t of activeTargets) {
      posts.push(...(postsByTarget[t.id] || []));
    }
    return posts.sort(
      (a, b) =>
        new Date(b.posted_at || 0).getTime() -
        new Date(a.posted_at || 0).getTime()
    );
  }, [activeTargets, postsByTarget]);

  // Stats with change deltas from metrics_history
  const stats = useMemo(() => {
    const followers = activeTargets.reduce(
      (sum, t) => sum + (t.follower_count || 0),
      0
    );
    const totalLikes = activePosts.reduce(
      (sum, p) => sum + (p.like_count || 0),
      0
    );
    const totalComments = activePosts.reduce(
      (sum, p) => sum + (p.comment_count || 0),
      0
    );
    const totalViews = activePosts.reduce(
      (sum, p) => sum + (p.video_view_count ?? p.video_play_count ?? 0),
      0
    );

    // Compute change % by comparing last two metrics_history entries across all posts
    let prevLikes = 0, prevComments = 0, prevViews = 0;
    let latestLikes = 0, latestComments = 0, latestViews = 0;
    let hasHistory = false;

    for (const post of activePosts) {
      const h = post.metrics_history;
      if (h && h.length >= 2) {
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
    }

    const pct = (latest: number, prev: number) =>
      prev > 0 ? ((latest - prev) / prev) * 100 : null;

    return {
      followers,
      totalLikes,
      totalComments,
      totalViews,
      likesChange: hasHistory ? pct(latestLikes, prevLikes) : null,
      commentsChange: hasHistory ? pct(latestComments, prevComments) : null,
      viewsChange: hasHistory ? pct(latestViews, prevViews) : null,
    };
  }, [activeTargets, activePosts]);

  // Pagination
  const totalPages = Math.ceil(activePosts.length / rowsPerPage);
  const paginatedPosts = activePosts.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!competitor) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center gap-3">
        <Icon
          icon="solar:danger-triangle-linear"
          width={48}
          className="text-text-tertiary"
        />
        <p className="text-text-secondary">Competitor not found</p>
        <Button
          variant="flat"
          onPress={() => router.push("/dashboard/virality")}
        >
          Back to Competitors
        </Button>
      </div>
    );
  }

  const statCards = [
    {
      title: "FOLLOWERS",
      value: formatNumber(stats.followers),
      icon: "solar:users-group-rounded-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
      change: null as number | null,
    },
    {
      title: "TOTAL LIKES",
      value: formatNumber(stats.totalLikes),
      icon: "solar:heart-bold",
      iconColor: "text-red-500",
      iconBg: "bg-red-500/10",
      change: stats.likesChange,
    },
    {
      title: "TOTAL COMMENTS",
      value: formatNumber(stats.totalComments),
      icon: "solar:chat-round-dots-bold",
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10",
      change: stats.commentsChange,
    },
    {
      title: "TOTAL VIEWS",
      value: formatNumber(stats.totalViews),
      icon: "solar:eye-bold",
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
      change: stats.viewsChange,
      tooltip: "Only counts views on video posts (Reels)",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="flat"
              isIconOnly
              className="bg-surface-base"
              onPress={() => router.push("/dashboard/virality")}
            >
              <Icon icon="solar:arrow-left-linear" width={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                {competitor.name}
              </h1>
              {competitor.description && (
                <p className="text-text-secondary text-sm">
                  {competitor.description}
                </p>
              )}
            </div>
          </div>
          <Button
            className="bg-accent-400 text-white"
            startContent={
              isSyncing ? (
                <Spinner size="sm" color="white" />
              ) : (
                <Icon icon="solar:refresh-bold" width={18} />
              )
            }
            isDisabled={isSyncing || competitor.targets.length === 0}
            onPress={handleSyncAll}
          >
            {isSyncing ? "Syncing..." : "Sync All"}
          </Button>
        </div>

        {/* Target Tabs */}
        {competitor.targets.length > 0 ? (
          <Tabs
            selectedKey={activeTargetId}
            onSelectionChange={handleTabChange}
            variant="underlined"
            classNames={{
              tabList: "border-b border-border-base",
              cursor: "bg-accent-400",
              tab: "text-text-tertiary data-[selected=true]:text-text-primary",
            }}
          >
            <Tab key="all" title="All Targets" />
            {competitor.targets.map((t) => (
              <Tab
                key={String(t.id)}
                title={
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      src={t.avatar_url || undefined}
                      name={t.username.charAt(0).toUpperCase()}
                      className="w-4 h-4"
                      classNames={{ base: "bg-surface-hover" }}
                    />
                    @{t.username}
                  </div>
                }
              />
            ))}
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Icon
              icon="solar:users-group-rounded-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-text-secondary text-sm">
              No targets in this competitor group yet
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card
              key={stat.title}
              className="bg-surface-base border border-border-base"
            >
              <CardBody className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                    <Icon
                      icon={stat.icon}
                      width={24}
                      className={stat.iconColor}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs text-text-tertiary font-medium tracking-wide">
                        {stat.title}
                      </p>
                      {"tooltip" in stat && stat.tooltip && (
                        <HTooltip content={stat.tooltip} placement="top" size="sm">
                          <Icon
                            icon="solar:info-circle-linear"
                            width={12}
                            className="text-default-400 cursor-help"
                          />
                        </HTooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-text-primary">
                        {stat.value}
                      </p>
                      {stat.change != null && (
                        <div
                          className={cn(
                            "flex items-center gap-0.5",
                            stat.change >= 0 ? "text-green-500" : "text-red-500"
                          )}
                        >
                          <Icon
                            icon={
                              stat.change >= 0
                                ? "solar:arrow-up-linear"
                                : "solar:arrow-down-linear"
                            }
                            width={12}
                          />
                          <span className="text-xs font-medium">
                            {Math.abs(stat.change).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        
        {/* <AnalyticsChart posts={activePosts} /> */}

        {/* Posts Table */}
        {activePosts.length > 0 ? (
          <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
            <Table
              aria-label="Posts table"
              removeWrapper
              classNames={{
                th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
                td: "py-4 px-4 border-t border-border-base",
              }}
            >
              <TableHeader>
                <TableColumn>POST</TableColumn>
                <TableColumn>POSTED</TableColumn>
                <TableColumn>LIKES</TableColumn>
                <TableColumn>COMMENTS</TableColumn>
                <TableColumn>VIEWS</TableColumn>
              </TableHeader>
              <TableBody>
                {paginatedPosts.map((post) => (
                  <TableRow
                    key={post.id}
                    className="cursor-pointer hover:bg-surface-hover transition-colors"
                    onClick={() => window.open(post.post_url, "_blank")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3 max-w-sm">
                        <Avatar
                          src={post.thumbnail_url || undefined}
                          name="P"
                          size="sm"
                          radius="sm"
                          classNames={{
                            base: "bg-surface-hover flex-shrink-0",
                          }}
                        />
                        <p className="text-sm text-text-primary truncate">
                          {post.caption || "No caption"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-text-secondary">
                        {post.posted_at ? formatDate(post.posted_at) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-text-primary">
                        {formatNumber(post.like_count)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-text-primary">
                        {formatNumber(post.comment_count)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-text-primary">
                        {(post.video_view_count ?? post.video_play_count) != null
                          ? formatNumber(post.video_view_count ?? post.video_play_count ?? 0)
                          : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
              <p className="text-sm text-text-tertiary">
                Showing {paginatedPosts.length} of {activePosts.length} posts
              </p>
              {totalPages > 1 && (
                <Pagination
                  total={totalPages}
                  page={page}
                  onChange={setPage}
                  size="sm"
                  classNames={{
                    item: "bg-surface-elevated text-text-secondary",
                    cursor: "bg-accent-400 text-white",
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="bg-surface-base border border-border-base rounded-xl flex flex-col items-center justify-center py-16 gap-2">
            <Icon
              icon="solar:document-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-text-secondary text-sm">
              No posts yet — sync targets to fetch posts
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
