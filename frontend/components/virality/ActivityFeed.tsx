"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardBody, Tooltip, Chip, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityPost, ViralityAccount } from "@/api/virality";
import type { DateRangeValue } from "@/components/virality/DateRangeFilter";
import { formatNumber } from "@/lib/formatters";
import { platformIcon, platformIconColor, timeAgo } from "@/lib/platformUtils";
import { getViewsInRange } from "@/app/dashboard/virality/[competitorId]/utils";

type ContentFilter = "viral" | "recent";

const VIRAL_VIEW_THRESHOLD = 50_000;
const PAGE_SIZE = 20;

interface TopPerformingContentProps {
  /** Posts filtered by the dashboard date range (used for viral + recent) */
  posts: ViralityPost[];
  /** All posts regardless of date range (used for "All" tab) */
  allPosts: ViralityPost[];
  accountMap: Record<number, ViralityAccount>;
  dateRange: DateRangeValue;
}

export function ActivityFeed({ posts, allPosts, accountMap, dateRange }: TopPerformingContentProps) {
  const [filter, setFilter] = useState<ContentFilter>("viral");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasDateRange = !!(dateRange.startDate || dateRange.endDate);

  /** For viral tab: compute view delta per post within the date range */
  const viralPostsWithDelta = useMemo(() => {
    return posts
      .map((p) => ({
        post: p,
        viewsGained: getViewsInRange(p, dateRange.startDate, dateRange.endDate),
      }))
      .filter((item) => item.viewsGained >= VIRAL_VIEW_THRESHOLD)
      .sort((a, b) => b.viewsGained - a.viewsGained);
  }, [posts, dateRange.startDate, dateRange.endDate]);

  const filteredPosts = useMemo(() => {
    switch (filter) {
      case "viral":
        return viralPostsWithDelta.map((item) => item.post);
      case "recent":
        return posts
          .slice()
          .sort(
            (a, b) =>
              new Date(b.posted_at || 0).getTime() -
              new Date(a.posted_at || 0).getTime()
          );
      default:
        return viralPostsWithDelta.map((item) => item.post);
    }
  }, [filter, posts, viralPostsWithDelta]);

  /** Map post id -> views gained for viral display */
  const viralDeltaMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of viralPostsWithDelta) {
      map.set(item.post.id, item.viewsGained);
    }
    return map;
  }, [viralPostsWithDelta]);

  // Reset visible count when filter changes
  const handleFilterChange = useCallback((f: ContentFilter) => {
    setFilter(f);
    setVisibleCount(PAGE_SIZE);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredPosts.length));
      }
    },
    [filteredPosts.length]
  );

  const visiblePosts = filteredPosts.slice(0, visibleCount);

  const filters: { key: ContentFilter; label: string }[] = [
    { key: "viral", label: "Viral" },
    { key: "recent", label: "Recent" },
  ];

  if (allPosts.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="flex flex-col items-center justify-center py-12 gap-2">
          <Icon icon="solar:fire-bold" width={40} className="text-text-tertiary" />
          <p className="text-text-secondary text-sm">No posts yet — sync accounts to see top content</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-base">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-text-primary">Top Performing Content</h3>
            {filter === "viral" && (
              <Tooltip
                content={
                  hasDateRange
                    ? "Showing posts that gained 50k+ views within the selected date range. View counts reflect only views gained during that period."
                    : "Showing posts that gained 50k+ views between their first and last recorded sync. Select a date range for more specific results."
                }
                classNames={{ content: "max-w-[240px] text-xs m-2" }}
              >
                <span className="cursor-help">
                  <Icon icon="solar:info-circle-linear" width={14} className="text-text-tertiary" />
                </span>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                  filter === f.key
                    ? "bg-accent-400 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Icon icon="solar:fire-bold" width={32} className="text-text-tertiary" />
            <p className="text-text-secondary text-xs">
              {filter === "viral"
                ? `No posts gained 50k+ views${hasDateRange ? " in this date range" : ""}`
                : "No posts match this filter"}
            </p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="divide-y divide-border-base overflow-y-auto overflow-x-hidden max-h-[480px]"
            onScroll={handleScroll}
          >
            {visiblePosts.map((post) => {
              const account = accountMap[post.account_id];
              const platform = account?.platform || "instagram";
              const isViral = filter === "viral";
              const viewsDelta = isViral ? viralDeltaMap.get(post.id) : undefined;

              return (
                <div
                  key={post.id}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors cursor-pointer"
                  onClick={() => window.open(post.post_url, "_blank")}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
                    {post.thumbnail_url && platform === "tiktok" ? (
                      <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon icon={platformIcon(platform)} width={18} className="text-text-tertiary" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {account && (
                        <span className="text-xs font-medium text-text-primary">
                          @{account.username}
                        </span>
                      )}
                      <Icon icon={platformIcon(platform)} width={12} className={platformIconColor(platform)} />
                      {post.posted_at && (
                        <span className="text-[11px] text-text-tertiary ml-auto flex-shrink-0">
                          {timeAgo(post.posted_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-1">
                      {post.caption || "No caption"}
                    </p>
                    {post.mass_post_id != null && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Chip size="sm" variant="flat" classNames={{ base: "bg-violet-500/10 text-violet-500 h-4 px-1", content: "text-[9px] font-medium px-0" }}>
                          Managed by Cuttr
                        </Chip>
                        {post.campaign_name && (
                          <Chip size="sm" variant="flat" classNames={{ base: "bg-amber-500/10 text-amber-500 h-4 px-1", content: "text-[9px] font-medium px-0" }}>
                            {post.campaign_name}
                          </Chip>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {isViral && viewsDelta != null ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-500 font-medium">
                          <Icon icon="solar:eye-bold" width={11} />
                          +{formatNumber(viewsDelta)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                          <Icon icon="solar:eye-bold" width={11} />
                          {formatNumber(post.video_play_count ?? 0)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                        <Icon icon="solar:heart-bold" width={11} className="text-red-500/70" />
                        {formatNumber(post.like_count)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                        <Icon icon="solar:chat-round-dots-bold" width={11} className="text-blue-500/70" />
                        {formatNumber(post.comment_count)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
