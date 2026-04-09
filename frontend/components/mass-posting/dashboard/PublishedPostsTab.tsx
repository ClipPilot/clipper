"use client";

import { useState, useCallback } from "react";
import {
  Chip,
  Button,
  Spinner,
  Modal,
  useOverlayState } from "@heroui/react";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { Icon } from "@iconify/react";
import { formatDateTime } from "@/lib/formatters";
import {
  platformIcon,
  platformIconColor,
  platformChipClass } from "@/lib/platformUtils";
import { FilterBar } from "./FilterBar";
import type { TeamPost, PostsPagination } from "@/types/massPosting";
import type { GetTeamPostsParams } from "@/api/adPosting";

interface PublishedPostsTabProps {
  posts: TeamPost[];
  pagination: PostsPagination | null;
  isLoading: boolean;
  onParamsChange: (params: GetTeamPostsParams) => void;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
}

export function PublishedPostsTab({
  posts,
  pagination,
  isLoading,
  onParamsChange,
  dateRange,
  onDateRangeChange }: PublishedPostsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();

  const fireParams = useCallback(
    (overrides: Partial<GetTeamPostsParams> = {}) => {
      const params: GetTeamPostsParams = {
        search: searchQuery || undefined,
        platform: platformFilter !== "all" ? platformFilter : undefined,
        dateRange,
        page,
        sortBy: "posted_time",
        sortOrder: "desc",
        ...overrides };
      onParamsChange(params);
    },
    [searchQuery, platformFilter, dateRange, page, onParamsChange],
  );

  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;
  const startItem =
    total === 0 ? 0 : (page - 1) * (pagination?.pageSize ?? 20) + 1;
  const endItem = Math.min(page * (pagination?.pageSize ?? 20), total);

  const handleExportCSV = () => {
    if (posts.length === 0) return;

    const headers = [
      "ID",
      "Clip Title",
      "Account",
      "Platform",
      "Status",
      "Post URL",
      "Published Date",
      "Created At",
    ];
    const rows = posts.map((post) => [
      post.id,
      post.clip_title ?? "",
      post.accountHandle ?? "",
      post.platform,
      post.status,
      post.post_url ?? "",
      post.posted_time ?? "",
      post.created_at,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `published-posts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleVideoClick = (clipUrl: string | null) => {
    if (!clipUrl) return;
    setVideoUrl(clipUrl);
    onOpen();
  };

  return (
    <>
      <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={(v) => {
            setSearchQuery(v);
            setPage(1);
            fireParams({ search: v || undefined, page: 1 });
          }}
          searchPlaceholder="Search posts..."
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
            onDateRangeChange(v);
            setPage(1);
            fireParams({ dateRange: v, page: 1 });
          }}
          rightContent={
            <Button
 size="sm"
 variant="tertiary"
 className="bg-white/[0.04] text-text-secondary h-9"
 onPress={handleExportCSV}
 isDisabled={posts.length === 0}
 >
              <Icon icon="solar:export-bold" width={14} />
              Export CSV
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" color="accent" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Icon
              icon="solar:inbox-line-bold-duotone"
              width={48}
              className="mb-3 opacity-40"
            />
            <p className="text-sm">No published posts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="bg-white/[0.04] text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4 text-left">CONTENT</th>
                  <th className="bg-white/[0.04] text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4 text-left">ACCOUNT</th>
                  <th className="bg-white/[0.04] text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4 text-left">PLATFORM</th>
                  <th className="bg-white/[0.04] text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4 text-left">PUBLISHED DATE</th>
                  <th className="bg-white/[0.04] text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4 text-left">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const { date, time } = formatDateTime(post.posted_time);

                  return (
                    <tr
                      key={post.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-4 border-t border-border-base">
                        <div className="flex items-center gap-3">
                          {post.clip_url ? (
                            <button
                              onClick={() => handleVideoClick(post.clip_url)}
                              className="relative w-[72px] h-[48px] rounded-md overflow-hidden bg-white/[0.04] flex-shrink-0 group cursor-pointer"
                            >
                              <video
                                src={post.clip_url}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Icon
                                  icon="solar:play-bold"
                                  width={20}
                                  className="text-white"
                                />
                              </div>
                            </button>
                          ) : (
                            <div className="w-[72px] h-[48px] rounded-md bg-white/[0.04] flex-shrink-0 flex items-center justify-center">
                              <Icon
                                icon="solar:videocamera-record-bold-duotone"
                                width={24}
                                className="text-text-tertiary"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate max-w-[320px]">
                              {post.clip_title || `Post #${post.id}`}
                            </p>
                            <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 text-xs font-medium rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                              Published
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 border-t border-border-base">
                        <span className="text-sm text-text-secondary">
                          {post.accountHandle || "—"}
                        </span>
                      </td>
                      <td className="py-4 px-4 border-t border-border-base">
                        <Chip
 size="sm"
 variant="tertiary"
 >
                          <Icon icon={platformIcon(post.platform)} width={12} />
                          <span className="text-xs capitalize">
                            {post.platform}
                          </span>
                        </Chip>
                      </td>
                      <td className="py-4 px-4 border-t border-border-base">
                        <div>
                          <p className="text-sm text-text-primary">{date}</p>
                          <p className="text-xs text-text-tertiary">{time}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 border-t border-border-base">
                        {post.post_url ? (
                          <Button
 size="sm"
 variant="tertiary"
 isIconOnly
 className="bg-transparent hover:bg-white/[0.04]"
 onPress={() => window.open(post.post_url!, "_blank")}
 >
                            <Icon
                              icon="solar:square-arrow-right-up-linear"
                              width={16}
                              className="text-text-secondary"
                            />
                          </Button>
                        ) : (
                          <span className="text-xs text-text-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
          <p className="text-sm text-text-tertiary">
            {total > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium text-text-secondary">
                  {startItem}-{endItem}
                </span>{" "}
                of{" "}
                <span className="font-medium text-text-secondary">{total}</span>{" "}
                posts
              </>
            ) : (
              "No results"
            )}
          </p>
          {totalPages > 1 && (
            <PaginationControl total={totalPages}
 page={page}
 onChange={(p) => {
 setPage(p);
 fireParams({ page: p });
 }}
 />
          )}
        </div>
      </div>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={() => {
 onClose();
 setVideoUrl(null);
 }}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
          <Modal.Body className="p-0">
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            )}
          </Modal.Body>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>
    </>
  );
}
