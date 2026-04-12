"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Tooltip, Chip, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber } from "../lib/formatters";
import { platformIcon, platformIconColor } from "../lib/platformUtils";
import { timeAgo } from "../lib/formatters";

export type ContentFilter = "viral" | "recent" | "best" | "worst";

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
  maxItems?: number;
  tabs?: { key: ContentFilter; label: string }[];
  defaultTab?: ContentFilter;
  title?: string;
  maxHeight?: string;
}

const DEFAULT_TABS: { key: ContentFilter; label: string }[] = [
  { key: "viral", label: "Viral" },
  { key: "recent", label: "Recent" },
];

export function ActivityFeed({ posts, allPosts, hasDateRange = false, maxItems, tabs, defaultTab, title, maxHeight }: ActivityFeedProps) {
  const filterTabs = tabs ?? DEFAULT_TABS;
  const [filter, setFilter] = useState<ContentFilter>(defaultTab ?? filterTabs[0].key);
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
      case "best":
        return posts.slice().sort((a, b) => b.viewCount - a.viewCount);
      case "worst":
        return posts
          .slice()
          .filter((p) => p.viewCount > 0)
          .sort((a, b) => a.viewCount - b.viewCount);
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

  const capped = maxItems ? filteredPosts.slice(0, maxItems) : filteredPosts;
  const visiblePosts = capped.slice(0, visibleCount);

  const displayPosts = allPosts ?? posts;
  if (displayPosts.length === 0) {
    return (
      <div className="rounded-2xl border border-border-base bg-surface-base overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
            <Icon icon="solar:fire-bold" width={24} className="text-text-tertiary" />
          </div>
          <p className="text-text-secondary text-sm">No posts yet — sync accounts to see top content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-base bg-surface-base overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-base">
        <h3 className="text-base font-semibold text-text-primary">{title ?? "Top Performing Content"}</h3>
        <div className="flex items-center">
          <div className="flex items-center gap-0.5 bg-surface-elevated rounded-lg p-1">
            {filterTabs.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => handleFilterChange(f.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  filter === f.key
                    ? "bg-accent-400 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {filter === "viral" && (
            <Tooltip>
              <Tooltip.Trigger>
                <span className="cursor-help ml-2">
                  <Icon icon="solar:info-circle-linear" width={16} className="text-text-tertiary" />
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
      </div>

      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
            <Icon icon="solar:fire-bold" width={24} className="text-text-tertiary" />
          </div>
          <p className="text-text-secondary text-sm">
            {filter === "viral"
              ? `No posts gained 50k+ views${hasDateRange ? " in this date range" : ""}`
              : filter === "worst"
                ? "No posts with views yet"
                : "No posts match this filter"}
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="divide-y divide-border-base overflow-y-auto overflow-x-hidden"
          style={{ maxHeight: maxHeight ?? "480px" }}
          onScroll={handleScroll}
        >
          {visiblePosts.map((post, index) => {
            const isViral = filter === "viral";
            const isBest = filter === "best";
            const isWorst = filter === "worst";
            const isRanked = isBest || isWorst;
            const viewsDelta = isViral && hasViewsGained ? post.viewsGained : undefined;

            return (
              <div
                key={post.id}
                className="flex items-start gap-4 px-6 py-4 hover:bg-surface-hover transition-colors cursor-pointer group"
                onClick={() => window.open(post.postUrl, "_blank")}
              >
                {isRanked && (
                  <span className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5",
                    index < 3
                      ? isBest
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                      : "bg-surface-elevated text-text-tertiary"
                  )}>
                    {index + 1}
                  </span>
                )}


                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium text-text-primary">
                      @{post.accountUsername}
                    </span>
                    <Icon icon={platformIcon(post.platform)} width={13} className={platformIconColor(post.platform)} />
                    {post.postedAt && (
                      <span className="text-xs text-text-tertiary ml-auto flex-shrink-0">
                        {timeAgo(post.postedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-1 mb-1.5">
                    {post.caption || "No caption"}
                  </p>
                  {post.massPostId != null && (
                    <div className="flex items-center gap-1 mb-1.5">
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
                  <div className="flex items-center gap-3">
                    {isViral && viewsDelta != null ? (
                      <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                        <Icon icon="solar:eye-bold" width={13} />
                        +{formatNumber(viewsDelta)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-text-tertiary">
                        <Icon icon="solar:eye-bold" width={13} />
                        {formatNumber(post.viewCount)}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-text-tertiary">
                      <Icon icon="solar:heart-bold" width={13} className="text-red-500/70" />
                      {formatNumber(post.likeCount)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-text-tertiary">
                      <Icon icon="solar:chat-round-dots-bold" width={13} className="text-blue-500/70" />
                      {formatNumber(post.commentCount)}
                    </span>
                  </div>
                </div>

                <Icon
                  icon="solar:arrow-right-up-linear"
                  width={16}
                  className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
