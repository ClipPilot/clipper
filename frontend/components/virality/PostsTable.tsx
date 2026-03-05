"use client";

import { useState, useMemo } from "react";
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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityPost } from "@/api/virality";
import { formatNumber, formatDate } from "@/lib/formatters";
import { platformIcon, platformIconColor } from "@/lib/platformUtils";
import { getPostMetricChange, getPostEngRateChange, getComparisonDate } from "@/app/dashboard/virality/[competitorId]/utils";
import { ComparisonModeSelector, type ComparisonMode } from "@/components/virality/ComparisonModeSelector";

interface PostsTableProps {
  posts: ViralityPost[];
  accountPlatformMap: Record<number, string>;
  accountSyncMap?: Record<number, string | null>;
  comparisonMode: ComparisonMode;
  onComparisonModeChange: (mode: ComparisonMode) => void;
  onDeletePost?: (postId: number) => void;
}

type SortKey = "views" | "likes" | "comments" | "eng_rate" | "published";
type SortDir = "asc" | "desc";

type ViewsFilter = "all" | "50k" | "100k" | "500k" | "1m" | "10m";
type LikesFilter = "all" | "5k" | "10k" | "50k" | "100k" | "1m";

const VIEW_FILTER_OPTIONS: { key: ViewsFilter; label: string; min: number }[] = [
  { key: "all", label: "All views", min: 0 },
  { key: "50k", label: "50K+", min: 50_000 },
  { key: "100k", label: "100K+", min: 100_000 },
  { key: "500k", label: "500K+", min: 500_000 },
  { key: "1m", label: "1M+", min: 1_000_000 },
  { key: "10m", label: "10M+", min: 10_000_000 },
];

const LIKE_FILTER_OPTIONS: { key: LikesFilter; label: string; min: number }[] = [
  { key: "all", label: "All likes", min: 0 },
  { key: "5k", label: "5K+", min: 5_000 },
  { key: "10k", label: "10K+", min: 10_000 },
  { key: "50k", label: "50K+", min: 50_000 },
  { key: "100k", label: "100K+", min: 100_000 },
  { key: "1m", label: "1M+", min: 1_000_000 },
];

function MetricChangeIndicator({ change, absolute }: { change: number | null; absolute?: boolean }) {
  if (change == null) return null;
  return (
    <div className={cn("flex items-center gap-0.5", change >= 0 ? "text-green-500" : "text-red-500")}>
      <Icon icon={change >= 0 ? "solar:arrow-up-linear" : "solar:arrow-down-linear"} width={10} />
      <span className="text-[10px] font-medium">{absolute ? (change >= 0 ? "+" : "") + change.toFixed(2) : Math.abs(change).toFixed(1) + "%"}</span>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  extra,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  extra?: React.ReactNode;
}) {
  const isActive = currentSort === sortKey;
  return (
    <button
      className="inline-flex items-center gap-1 hover:text-text-secondary transition-colors"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {extra}
      <Icon
        icon={
          isActive
            ? currentDir === "asc"
              ? "solar:alt-arrow-up-linear"
              : "solar:alt-arrow-down-linear"
            : "solar:sort-vertical-linear"
        }
        width={12}
        className={isActive ? "text-accent-400" : "text-text-tertiary"}
      />
    </button>
  );
}

function FilterDropdown<T extends string>({
  options,
  selected,
  onChange,
  icon,
}: {
  options: { key: T; label: string }[];
  selected: T;
  onChange: (key: T) => void;
  icon: string;
}) {
  const selectedLabel = options.find((o) => o.key === selected)?.label ?? "All";
  const isFiltered = selected !== "all";

  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
            isFiltered
              ? "bg-accent-400/10 text-accent-400 border border-accent-400/30"
              : "bg-surface-elevated text-text-secondary hover:text-text-primary border border-transparent"
          )}
        >
          <Icon icon={icon} width={13} />
          {selectedLabel}
          <Icon icon="solar:alt-arrow-down-linear" width={10} />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Filter options"
        selectionMode="single"
        selectedKeys={new Set([selected])}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as T;
          if (key) onChange(key);
        }}
      >
        {options.map((opt) => (
          <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export function PostsTable({ posts, accountPlatformMap, comparisonMode, onComparisonModeChange, onDeletePost }: PostsTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewsFilter, setViewsFilter] = useState<ViewsFilter>("all");
  const [likesFilter, setLikesFilter] = useState<LikesFilter>("all");
  const comparisonDate = useMemo(() => getComparisonDate(comparisonMode), [comparisonMode]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const filteredAndSortedPosts = useMemo(() => {
    let result = posts.slice();

    // Apply filters
    const viewMin = VIEW_FILTER_OPTIONS.find((o) => o.key === viewsFilter)?.min ?? 0;
    if (viewMin > 0) {
      result = result.filter((p) => (p.video_play_count ?? 0) >= viewMin);
    }

    const likeMin = LIKE_FILTER_OPTIONS.find((o) => o.key === likesFilter)?.min ?? 0;
    if (likeMin > 0) {
      result = result.filter((p) => p.like_count >= likeMin);
    }

    // Apply sorting
    if (sortKey) {
      result.sort((a, b) => {
        let aVal = 0;
        let bVal = 0;

        switch (sortKey) {
          case "views":
            aVal = a.video_play_count ?? 0;
            bVal = b.video_play_count ?? 0;
            break;
          case "likes":
            aVal = a.like_count;
            bVal = b.like_count;
            break;
          case "comments":
            aVal = a.comment_count;
            bVal = b.comment_count;
            break;
          case "eng_rate":
            aVal = a.video_play_count ? (a.like_count + a.comment_count) / a.video_play_count : 0;
            bVal = b.video_play_count ? (b.like_count + b.comment_count) / b.video_play_count : 0;
            break;
          case "published":
            aVal = new Date(a.posted_at || 0).getTime();
            bVal = new Date(b.posted_at || 0).getTime();
            break;
        }

        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
    }

    return result;
  }, [posts, sortKey, sortDir, viewsFilter, likesFilter]);

  const totalPages = Math.ceil(filteredAndSortedPosts.length / rowsPerPage);
  const paginatedPosts = filteredAndSortedPosts.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const activeFilterCount = (viewsFilter !== "all" ? 1 : 0) + (likesFilter !== "all" ? 1 : 0);

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
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">Calculate % change:</span>
          <ComparisonModeSelector selected={comparisonMode} onChange={onComparisonModeChange} />
        </div>
        <div className="flex items-center gap-2">
          <FilterDropdown
            options={VIEW_FILTER_OPTIONS}
            selected={viewsFilter}
            onChange={(key) => { setViewsFilter(key); setPage(1); }}
            icon="solar:eye-bold"
          />
          <FilterDropdown
            options={LIKE_FILTER_OPTIONS}
            selected={likesFilter}
            onChange={(key) => { setLikesFilter(key); setPage(1); }}
            icon="solar:heart-bold"
          />
          {activeFilterCount > 0 && (
            <button
              className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors underline"
              onClick={() => { setViewsFilter("all"); setLikesFilter("all"); setPage(1); }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
      <Table
        aria-label="Posts table"
        removeWrapper
        classNames={{
          th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4 whitespace-nowrap",
          td: "py-4 px-4 border-t border-border-base",
          table: "min-w-[700px]",
        }}
      >
        <TableHeader>
          <TableColumn>POST</TableColumn>
          <TableColumn>PLATFORM</TableColumn>
          <TableColumn>
            <SortableHeader label="VIEWS" sortKey="views" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </TableColumn>
          <TableColumn>
            <SortableHeader
              label="ENG RATE"
              sortKey="eng_rate"
              currentSort={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
            />
          </TableColumn>
          <TableColumn>
            <SortableHeader label="LIKES" sortKey="likes" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </TableColumn>
          <TableColumn>
            <SortableHeader label="COMMENTS" sortKey="comments" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </TableColumn>
          <TableColumn>TYPE</TableColumn>
          <TableColumn>
            <SortableHeader label="PUBLISHED" sortKey="published" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </TableColumn>
          {onDeletePost && <TableColumn>{""}</TableColumn>}
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
                  {!post.thumbnail_url || accountPlatformMap[post.account_id] === "instagram" ? (
                    <div className="w-8 h-8 rounded-sm bg-surface-hover flex items-center justify-center flex-shrink-0">
                      <Icon
                        icon={platformIcon(accountPlatformMap[post.account_id])}
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
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {post.caption || "No caption"}
                    </p>
                    {post.mass_post_id != null && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Chip size="sm" variant="flat" classNames={{ base: "bg-violet-500/10 text-violet-500 h-5 px-1.5", content: "text-[10px] font-medium px-0" }}>
                          Managed by Cuttr
                        </Chip>
                        {post.campaign_name && (
                          <Chip size="sm" variant="flat" classNames={{ base: "bg-amber-500/10 text-amber-500 h-5 px-1.5", content: "text-[10px] font-medium px-0" }}>
                            {post.campaign_name}
                          </Chip>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Icon
                  icon={platformIcon(accountPlatformMap[post.account_id])}
                  width={16}
                  className={platformIconColor(accountPlatformMap[post.account_id])}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-text-primary">
                    {post.video_play_count != null
                      ? formatNumber(post.video_play_count)
                      : "—"}
                  </span>
                  <MetricChangeIndicator change={getPostMetricChange(post, "views", comparisonDate)} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-text-primary">
                    {post.video_play_count
                      ? (((post.like_count + post.comment_count) / post.video_play_count) * 100).toFixed(2) + "%"
                      : "—"}
                  </span>
                  <MetricChangeIndicator change={getPostEngRateChange(post, comparisonDate)} absolute />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-text-primary">
                    {formatNumber(post.like_count)}
                  </span>
                  <MetricChangeIndicator change={getPostMetricChange(post, "likes", comparisonDate)} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-text-primary">
                    {formatNumber(post.comment_count)}
                  </span>
                  <MetricChangeIndicator change={getPostMetricChange(post, "comments", comparisonDate)} />
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
              {onDeletePost && (
                <TableCell>
                  <button
                    className="p-1 rounded-md text-text-tertiary hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePost(post.id);
                    }}
                    aria-label="Remove post"
                  >
                    <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                  </button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing {paginatedPosts.length} of {filteredAndSortedPosts.length} posts
          {activeFilterCount > 0 && ` (filtered from ${posts.length})`}
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
