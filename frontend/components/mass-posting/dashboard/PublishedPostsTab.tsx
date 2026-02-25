"use client";

import { useState, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Pagination,
  Button,
  Spinner,
  Modal,
  ModalContent,
  ModalBody,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDateTime } from "@/lib/formatters";
import {
  platformIcon,
  platformIconColor,
  platformChipClass,
} from "@/lib/platformUtils";
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
  onDateRangeChange,
}: PublishedPostsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fireParams = useCallback(
    (overrides: Partial<GetTeamPostsParams> = {}) => {
      const params: GetTeamPostsParams = {
        search: searchQuery || undefined,
        platform: platformFilter !== "all" ? platformFilter : undefined,
        dateRange,
        page,
        sortBy: "posted_time",
        sortOrder: "desc",
        ...overrides,
      };
      onParamsChange(params);
    },
    [searchQuery, platformFilter, dateRange, page, onParamsChange]
  );

  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;
  const startItem = total === 0 ? 0 : (page - 1) * (pagination?.pageSize ?? 20) + 1;
  const endItem = Math.min(page * (pagination?.pageSize ?? 20), total);

  // TODO(human): Decide on export strategy — currently exports only the visible page.
  // Options: (a) fetch all pages in a loop, (b) single call with large pageSize,
  // (c) dedicated backend CSV endpoint. Implement your chosen approach below.
  const handleExportCSV = () => {
    if (posts.length === 0) return;

    const headers = ["ID", "Clip Title", "Account", "Platform", "Status", "Post URL", "Published Date", "Created At"];
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
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
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
              variant="flat"
              className="bg-surface-elevated border border-border-base text-text-secondary h-9"
              startContent={<Icon icon="solar:export-bold" width={14} />}
              onPress={handleExportCSV}
              isDisabled={posts.length === 0}
            >
              Export CSV
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" color="primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Icon icon="solar:inbox-line-bold-duotone" width={48} className="mb-3 opacity-40" />
            <p className="text-sm">No published posts found</p>
          </div>
        ) : (
          <Table
            aria-label="Published posts table"
            removeWrapper
            classNames={{
              th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
              td: "py-4 px-4 border-t border-border-base",
            }}
          >
            <TableHeader>
              <TableColumn>CONTENT</TableColumn>
              <TableColumn>ACCOUNT</TableColumn>
              <TableColumn>PLATFORM</TableColumn>
              <TableColumn>PUBLISHED DATE</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const { date, time } = formatDateTime(post.posted_time);

                return (
                  <TableRow
                    key={post.id}
                    className="hover:bg-surface-elevated/50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {post.clip_url ? (
                          <button
                            onClick={() => handleVideoClick(post.clip_url)}
                            className="relative w-[72px] h-[48px] rounded-md overflow-hidden bg-surface-elevated flex-shrink-0 group cursor-pointer"
                          >
                            <video
                              src={post.clip_url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Icon icon="solar:play-bold" width={20} className="text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-[72px] h-[48px] rounded-md bg-surface-elevated flex-shrink-0 flex items-center justify-center">
                            <Icon icon="solar:videocamera-record-bold-duotone" width={24} className="text-text-tertiary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate max-w-[320px]">
                            {post.clip_title || `Post #${post.id}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            <span className="text-xs text-text-tertiary">
                              Published
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-text-secondary">
                        {post.accountHandle || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        variant="flat"
                        classNames={{
                          base: `${platformChipClass(post.platform)} h-6 px-2`,
                        }}
                        startContent={
                          <Icon
                            icon={platformIcon(post.platform)}
                            width={12}
                          />
                        }
                      >
                        <span className="text-xs capitalize">
                          {post.platform}
                        </span>
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-text-primary">{date}</p>
                        <p className="text-xs text-text-tertiary">{time}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.post_url ? (
                        <Button
                          size="sm"
                          variant="flat"
                          isIconOnly
                          className="bg-transparent hover:bg-surface-elevated"
                          onPress={() =>
                            window.open(post.post_url!, "_blank")
                          }
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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

      {/* Video Preview Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setVideoUrl(null);
        }}
        size="3xl"
        classNames={{
          base: "bg-surface-base border border-border-base",
          closeButton: "text-text-secondary hover:text-text-primary",
        }}
      >
        <ModalContent>
          <ModalBody className="p-0">
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
