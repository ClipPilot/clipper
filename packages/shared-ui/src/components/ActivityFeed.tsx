"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Tooltip, Chip, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber } from "../lib/formatters";
import { platformIcon, platformIconColor } from "../lib/platformUtils";
import { timeAgo } from "../lib/formatters";

type ContentFilter = "viral" | "recent";

const VIRAL_VIEW_THRESHOLD = 50_000;
const PAGE_SIZE = 20;

export interface FeedPost {
  id: number;
  accountId: number;
  accountUsername: string;
  platform: string;
  caption: string | null;
  thumbnailUrl: string | null;
  postUrl: string;
  postedAt: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  viewsGained?: number;
  massPostId?: number | null;
  campaignName?: string | null;
}

interface ActivityFeedProps {
  posts: FeedPost[];
  allPosts?: FeedPost[];
  hasDateRange?: boolean;
}

export function ActivityFeed({ posts, allPosts, hasDateRange = false }: ActivityFeedProps) {
  const [filter, setFilter] = useState<ContentFilter>("viral");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasViewsGained = posts.length > 0 && posts[0].viewsGained !== undefined;

  const viralPostsWithDelta = useMemo(() => {
    if (hasViewsGained) {
      return posts
        .filter((p) => (p.viewsGained ?? 0) >= VIRAL_VIEW_THRESHOLD)
        .sort((a, b) => (b.viewsGained ?? 0) - (a.viewsGained ?? 0));
    }
    return posts
      .filter((p) => p.viewCount >= VIRAL_VIEW_THRESHOLD)
      .sort((a, b) => b.viewCount - a.viewCount);
  }, [posts, hasViewsGained]);

  const filteredPosts = useMemo(() => {
    switch (filter) {
      case "viral":
        return viralPostsWithDelta;
      case "recent":
        return posts
          .slice()
          .sort((a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime());
      default:
        return viralPostsWithDelta;
    }
  }, [filter, posts, viralPostsWithDelta]);

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

  const displayPosts = allPosts ?? posts;
  if (displayPosts.length === 0) {
    return (
      <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Icon icon="solar:fire-bold" width={40} className="text-text-tertiary" />
          <p className="text-text-secondary text-sm">No posts yet — sync accounts to see top content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
      <div className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-base">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-text-primary">Top Performing Content</h3>
            {filter === "viral" && (
              <Tooltip>
                <Tooltip.Trigger>
                  <span className="cursor-help">
                    <Icon icon="solar:info-circle-linear" width={14} className="text-text-tertiary" />
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  {hasDateRange
                    ? "Showing posts that gained 50k+ views within the selected date range. View counts reflect only views gained during that period."
                    : "Showing posts that gained 50k+ views between their first and last recorded sync. Select a date range for more specific results."}
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5">
            {filters.map((f) => (
              <div
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                  filter === f.key
                    ? "bg-accent-400 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {f.label}
              </div>
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
              const isViral = filter === "viral";
              const viewsDelta = isViral && hasViewsGained ? post.viewsGained : undefined;

              return (
                <div
                  key={post.id}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors cursor-pointer"
                  onClick={() => window.open(post.postUrl, "_blank")}
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
                    {post.thumbnailUrl && post.platform === "tiktok" ? (
                      <img src={post.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon icon={platformIcon(post.platform)} width={18} className="text-text-tertiary" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-text-primary">
                        @{post.accountUsername}
                      </span>
                      <Icon icon={platformIcon(post.platform)} width={12} className={platformIconColor(post.platform)} />
                      {post.postedAt && (
                        <span className="text-[11px] text-text-tertiary ml-auto flex-shrink-0">
                          {timeAgo(post.postedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-1">
                      {post.caption || "No caption"}
                    </p>
                    {post.massPostId != null && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Chip size="sm" variant="tertiary">
                          Managed by Cuttr
                        </Chip>
                        {post.campaignName && (
                          <Chip size="sm" variant="tertiary">
                            {post.campaignName}
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
                          {formatNumber(post.viewCount)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                        <Icon icon="solar:heart-bold" width={11} className="text-red-500/70" />
                        {formatNumber(post.likeCount)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                        <Icon icon="solar:chat-round-dots-bold" width={11} className="text-blue-500/70" />
                        {formatNumber(post.commentCount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
