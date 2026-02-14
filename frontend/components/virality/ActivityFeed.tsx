"use client";

import { useState } from "react";
import { Card, CardBody, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityPost, ViralityAccount } from "@/api/virality";
import { formatNumber, formatDate } from "@/lib/formatters";

interface ActivityFeedProps {
  posts: ViralityPost[];
  accountMap: Record<number, ViralityAccount>;
  defaultCount?: number;
}

function getPlatformIcon(platform: string) {
  if (platform === "x") return "ri:twitter-x-fill";
  if (platform === "tiktok") return "ri:tiktok-fill";
  return "ri:instagram-fill";
}

function getPlatformColor(platform: string) {
  if (platform === "tiktok") return "text-cyan-400";
  if (platform === "x") return "text-foreground";
  return "text-pink-500";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function ActivityFeed({ posts, accountMap, defaultCount = 7 }: ActivityFeedProps) {
  const [showCount, setShowCount] = useState(defaultCount);

  const sorted = posts
    .slice()
    .sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime());

  const visible = sorted.slice(0, showCount);
  const hasMore = sorted.length > showCount;

  if (sorted.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="flex flex-col items-center justify-center py-12 gap-2">
          <Icon icon="solar:feed-linear" width={40} className="text-text-tertiary" />
          <p className="text-text-secondary text-sm">No recent posts — sync accounts to see activity</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-base">
          <h3 className="text-sm font-medium text-text-primary">Recent Activity</h3>
          <span className="text-xs text-text-tertiary">{sorted.length} posts</span>
        </div>

        <div className="divide-y divide-border-base">
          {visible.map((post) => {
            const account = accountMap[post.account_id];
            const platform = account?.platform || "instagram";

            return (
              <div
                key={post.id}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors cursor-pointer"
                onClick={() => window.open(post.post_url, "_blank")}
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
                  {post.thumbnail_url ? (
                    <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon icon={getPlatformIcon(platform)} width={18} className="text-text-tertiary" />
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
                    <Icon icon={getPlatformIcon(platform)} width={12} className={getPlatformColor(platform)} />
                    {post.posted_at && (
                      <span className="text-[11px] text-text-tertiary ml-auto flex-shrink-0">
                        {timeAgo(post.posted_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-1">
                    {post.caption || "No caption"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {post.video_play_count != null && post.video_play_count > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                        <Icon icon="solar:eye-bold" width={11} />
                        {formatNumber(post.video_play_count)}
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

        {/* Show More / Show Less */}
        {(hasMore || showCount > defaultCount) && (
          <div className="px-5 py-3 border-t border-border-base flex justify-center">
            {hasMore ? (
              <Button
                size="sm"
                variant="flat"
                className="bg-surface-elevated text-text-secondary"
                onPress={() => setShowCount((c) => c + defaultCount)}
              >
                Show More
              </Button>
            ) : (
              <Button
                size="sm"
                variant="flat"
                className="bg-surface-elevated text-text-secondary"
                onPress={() => setShowCount(defaultCount)}
              >
                Show Less
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
