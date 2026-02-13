"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Pagination,
  Button,
  cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityPost } from "@/api/virality";
import { formatNumber, formatDate } from "@/lib/formatters";
import { getPostMetricChange } from "@/app/dashboard/virality/[competitorId]/utils";

interface PostsTableProps {
  posts: ViralityPost[];
  accountPlatformMap: Record<number, string>;
  accountSyncMap?: Record<number, string | null>;
}

function MetricChangeIndicator({ change }: { change: number | null }) {
  if (change == null) return null;
  return (
    <div className={cn("flex items-center gap-0.5", change >= 0 ? "text-green-500" : "text-red-500")}>
      <Icon icon={change >= 0 ? "solar:arrow-up-linear" : "solar:arrow-down-linear"} width={10} />
      <span className="text-[10px] font-medium">{Math.abs(change).toFixed(1)}%</span>
    </div>
  );
}

function getPlatformIcon(platform: string): string {
  if (platform === "x") return "ri:twitter-x-fill";
  if (platform === "tiktok") return "ri:tiktok-fill";
  return "mdi:instagram";
}

export function PostsTable({ posts, accountPlatformMap }: PostsTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const totalPages = Math.ceil(posts.length / rowsPerPage);
  const paginatedPosts = posts.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  if (posts.length === 0) {
    return (
      <div className="bg-surface-base border border-border-base rounded-xl flex flex-col items-center justify-center py-16 gap-2">
        <Icon
          icon="solar:document-linear"
          width={40}
          className="text-text-tertiary"
        />
        <p className="text-text-secondary text-sm">
          No posts yet — sync accounts to fetch posts
        </p>
      </div>
    );
  }

  return (
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
          <TableColumn>PLATFORM</TableColumn>
          <TableColumn>VIEWS</TableColumn>
          <TableColumn>ENG RATE</TableColumn>
          <TableColumn>LIKES</TableColumn>
          <TableColumn>COMMENTS</TableColumn>
          <TableColumn>TYPE</TableColumn>
          <TableColumn>PUBLISHED</TableColumn>
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
                  {!post.thumbnail_url ? (
                    <div className="w-8 h-8 rounded-sm bg-surface-hover flex items-center justify-center flex-shrink-0">
                      <Icon
                        icon={getPlatformIcon(accountPlatformMap[post.account_id])}
                        width={20}
                        className="text-text-tertiary"
                      />
                    </div>
                  ) : (
                    <Avatar
                      src={post.thumbnail_url}
                      name="P"
                      size="sm"
                      radius="sm"
                      classNames={{
                        base: "bg-surface-hover flex-shrink-0",
                      }}
                    />
                  )}
                  <p className="text-sm text-text-primary truncate">
                    {post.caption || "No caption"}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Icon
                    icon={getPlatformIcon(accountPlatformMap[post.account_id])}
                    width={16}
                    className={
                      accountPlatformMap[post.account_id] === "tiktok"
                        ? "text-cyan-400"
                        : accountPlatformMap[post.account_id] === "x"
                          ? "text-foreground"
                          : "text-pink-500"
                    }
                  />
                  <span className="text-xs text-text-secondary capitalize">
                    {accountPlatformMap[post.account_id] || "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-text-primary">
                    {post.video_play_count != null
                      ? formatNumber(post.video_play_count)
                      : "—"}
                  </span>
                  <MetricChangeIndicator change={getPostMetricChange(post, "views")} />
                </div>
              </TableCell>
              <TableCell>
                <span className="font-medium text-text-primary">
                  {post.video_play_count
                    ? (((post.like_count + post.comment_count) / post.video_play_count) * 100).toFixed(2) + "%"
                    : "—"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-text-primary">
                    {formatNumber(post.like_count)}
                  </span>
                  <MetricChangeIndicator change={getPostMetricChange(post, "likes")} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-text-primary">
                    {formatNumber(post.comment_count)}
                  </span>
                  <MetricChangeIndicator change={getPostMetricChange(post, "comments")} />
                </div>
              </TableCell>
              <TableCell>
                {post.post_type ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-text-secondary">
                    {post.post_type}
                  </span>
                ) : (
                  <span className="text-text-tertiary">—</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-text-secondary">
                  {post.posted_at ? formatDate(post.posted_at) : "—"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing {paginatedPosts.length} of {posts.length} posts
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-tertiary">Show:</span>
            {[25, 50, 100].map((size) => (
              <Button
                key={size}
                size="sm"
                variant={rowsPerPage === size ? "solid" : "flat"}
                className={
                  rowsPerPage === size
                    ? "bg-accent-400 text-white min-w-[40px]"
                    : "bg-surface-elevated text-text-secondary min-w-[40px]"
                }
                onPress={() => {
                  setRowsPerPage(size);
                  setPage(1);
                }}
              >
                {size}
              </Button>
            ))}
          </div>
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
    </div>
  );
}
