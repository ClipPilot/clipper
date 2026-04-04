"use client";

import { StatusChip } from "@clipper/shared-ui";
import type { ViralityPost } from "@clipper/shared-types";
import { Card } from "@heroui/react";

const mockPosts: Pick<
  ViralityPost,
  | "id"
  | "caption"
  | "like_count"
  | "comment_count"
  | "video_view_count"
  | "post_url"
  | "posted_at"
>[] = [
  {
    id: 1,
    caption: "How to grow your brand on TikTok in 2026",
    like_count: 12400,
    comment_count: 342,
    video_view_count: 98000,
    post_url: "https://tiktok.com/@example/1",
    posted_at: "2026-04-01T10:00:00Z",
  },
  {
    id: 2,
    caption: "Behind the scenes of our latest campaign",
    like_count: 5600,
    comment_count: 128,
    video_view_count: 34000,
    post_url: "https://instagram.com/p/example2",
    posted_at: "2026-04-02T14:30:00Z",
  },
  {
    id: 3,
    caption: "5 editing tricks that went viral",
    like_count: 28900,
    comment_count: 890,
    video_view_count: 210000,
    post_url: "https://tiktok.com/@example/3",
    posted_at: "2026-04-03T09:15:00Z",
  },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const statuses: ("pending" | "completed" | "failed")[] = [
  "completed",
  "pending",
  "failed",
];

export function ExamplePosts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {mockPosts.map((post, i) => (
        <Card key={post.id} className="bg-zinc-900 border border-zinc-800">
          <Card.Header className="flex justify-between items-center">
            <span className="text-sm text-zinc-400 truncate max-w-[200px]">
              {post.post_url}
            </span>
            <StatusChip status={statuses[i]} />
          </Card.Header>
          <Card.Content className="space-y-3">
            <p className="text-white text-sm">{post.caption}</p>
            <div className="flex gap-4 text-xs text-zinc-400">
              <span>{formatCount(post.like_count)} likes</span>
              <span>{formatCount(post.comment_count)} comments</span>
              {post.video_view_count && (
                <span>{formatCount(post.video_view_count)} views</span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {new Date(post.posted_at!).toLocaleDateString()}
            </p>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
