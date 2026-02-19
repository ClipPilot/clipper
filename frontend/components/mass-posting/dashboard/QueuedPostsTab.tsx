"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Pagination,
  Spinner,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDateTime } from "@/lib/formatters";
import {
  platformIcon,
  platformIconColor,
  platformChipClass,
} from "@/lib/platformUtils";
import { FilterBar } from "./FilterBar";
import type {
  TeamPost,
  PostsPagination,
  QueuedGroup,
} from "@/types/massPosting";
import type { GetTeamPostsParams } from "@/api/adPosting";

const STATUS_CONFIG: Record<
  string,
  { color: string; dotClass: string; icon?: string; label: string }
> = {
  scheduled: {
    color: "text-green-400",
    dotClass: "bg-green-400",
    label: "Queued",
  },
  failed: {
    color: "text-red-400",
    dotClass: "bg-red-400",
    icon: "solar:danger-triangle-bold",
    label: "Failed",
  },
};

interface QueuedPostsTabProps {
  posts: TeamPost[];
  pagination: PostsPagination | null;
  isLoading: boolean;
  onParamsChange: (params: GetTeamPostsParams) => void;
}

export function QueuedPostsTab({
  posts,
  pagination,
  isLoading,
  onParamsChange,
}: QueuedPostsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);

  const fireParams = useCallback(
    (overrides: Partial<GetTeamPostsParams> = {}) => {
      const params: GetTeamPostsParams = {
        search: searchQuery || undefined,
        platform: platformFilter !== "all" ? platformFilter : undefined,
        dateRange,
        page,
        sortBy: "created_at",
        sortOrder: "desc",
        ...overrides,
      };
      onParamsChange(params);
    },
    [searchQuery, platformFilter, dateRange, page, onParamsChange]
  );

  // Group posts by clip_id for the queued view
  const grouped = useMemo(() => {
    const map = new Map<string, QueuedGroup>();
    for (const post of posts) {
      const key = post.clip_id != null ? String(post.clip_id) : `no-clip-${post.id}`;
      if (!map.has(key)) {
        map.set(key, {
          clip_id: post.clip_id,
          clip_title: post.clip_title,
          clip_url: post.clip_url,
          posts: [],
          earliestCreatedAt: post.created_at,
        });
      }
      const group = map.get(key)!;
      group.posts.push(post);
      if (post.created_at < group.earliestCreatedAt) {
        group.earliestCreatedAt = post.created_at;
      }
    }
    return Array.from(map.values());
  }, [posts]);

  const totalPages = pagination?.totalPages ?? 1;
  const totalVideos = pagination?.total ?? 0;
  const totalPosts = pagination?.totalPosts ?? 0;

  // Determine worst status in group for display
  const groupStatus = (group: QueuedGroup) => {
    if (group.posts.some((p) => p.status === "failed")) return "failed";
    return "scheduled";
  };

  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={(v) => {
          setSearchQuery(v);
          setPage(1);
          fireParams({ search: v || undefined, page: 1 });
        }}
        searchPlaceholder="Search by clip title..."
        showPlatformFilter
        platformValue={platformFilter}
        onPlatformChange={(v) => {
          setPlatformFilter(v);
          setPage(1);
          fireParams({ platform: v !== "all" ? v : undefined, page: 1 });
        }}
        showDateRange
        dateRangeValue={dateRange}
        onDateRangeChange={(v) => {
          setDateRange(v);
          setPage(1);
          fireParams({ dateRange: v, page: 1 });
        }}
        countLabel={`${totalVideos} video${totalVideos !== 1 ? "s" : ""} queued`}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" color="primary" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
          <Icon icon="solar:inbox-line-bold-duotone" width={48} className="mb-3 opacity-40" />
          <p className="text-sm">No queued posts found</p>
        </div>
      ) : (
        <Table
          aria-label="Queued posts table"
          removeWrapper
          classNames={{
            th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
            td: "py-4 px-4 border-t border-border-base",
          }}
        >
          <TableHeader>
            <TableColumn>VIDEO CONTENT</TableColumn>
            <TableColumn>DATE SUBMITTED</TableColumn>
            <TableColumn>PLATFORMS</TableColumn>
            <TableColumn>STATUS</TableColumn>
          </TableHeader>
          <TableBody>
            {grouped.map((group) => {
              const { date, time } = formatDateTime(group.earliestCreatedAt);
              const status = groupStatus(group);
              const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;

              return (
                <TableRow
                  key={group.clip_id ?? group.posts[0]?.id}
                  className="hover:bg-surface-elevated/50 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {group.clip_url ? (
                        <div className="relative w-[72px] h-[48px] rounded-md overflow-hidden bg-surface-elevated flex-shrink-0">
                          <video
                            src={group.clip_url}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        </div>
                      ) : (
                        <div className="w-[72px] h-[48px] rounded-md bg-surface-elevated flex-shrink-0 flex items-center justify-center">
                          <Icon icon="solar:videocamera-record-bold-duotone" width={24} className="text-text-tertiary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate max-w-[280px]">
                          {group.clip_title || `Clip #${group.clip_id}`}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {group.posts.length} post{group.posts.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm text-text-primary">{date}</p>
                      <p className="text-xs text-text-tertiary">{time}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const counts = new Map<string, number>();
                        for (const p of group.posts) {
                          counts.set(p.platform, (counts.get(p.platform) ?? 0) + 1);
                        }
                        return Array.from(counts.entries()).map(([platform, count]) => (
                          <Tooltip
                            key={platform}
                            content={`${platform}${count > 1 ? ` ×${count}` : ""}`}
                            placement="top"
                          >
                            <span
                              className={`relative w-7 h-7 rounded-full flex items-center justify-center ${platformChipClass(platform)}`}
                            >
                              <Icon
                                icon={platformIcon(platform)}
                                width={14}
                                className={platformIconColor(platform)}
                              />
                              {count > 1 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-accent-400 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                                  {count}
                                </span>
                              )}
                            </span>
                          </Tooltip>
                        ));
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusCfg.icon ? (
                        <Icon
                          icon={statusCfg.icon}
                          width={14}
                          className={statusCfg.color}
                        />
                      ) : (
                        <span
                          className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`}
                        />
                      )}
                      <span
                        className={`text-sm font-medium ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          {grouped.length > 0 ? (
            <>
              <span className="font-medium text-text-secondary">
                {grouped.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-text-secondary">
                {totalVideos}
              </span>{" "}
              video{totalVideos !== 1 ? "s" : ""}{" "}
              <span className="text-text-tertiary">
                ({totalPosts} total post{totalPosts !== 1 ? "s" : ""})
              </span>
            </>
          ) : (
            "No results"
          )}
        </p>
        {totalPages > 1 && (
          <Pagination
            total={totalPages}
            page={page}
            onChange={(p) => {
              setPage(p);
              fireParams({ page: p });
            }}
            size="sm"
            classNames={{
              item: "bg-surface-elevated text-text-secondary",
              cursor: "bg-accent-400 text-white",
            }}
          />
        )}
      </div>
    </div>
  );
}
