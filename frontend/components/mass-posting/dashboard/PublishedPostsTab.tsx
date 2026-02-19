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
  Chip,
  Pagination,
  Button,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDateTime } from "@/lib/formatters";
import { platformIcon, platformIconColor, platformChipClass } from "@/lib/platformUtils";
import { MOCK_PUBLISHED_POSTS } from "./mockData";
import { FilterBar } from "./FilterBar";

export function PublishedPostsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30days");
  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  const filtered = useMemo(() => {
    return MOCK_PUBLISHED_POSTS.filter((post) => {
      const matchesSearch =
        !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.accountName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform =
        platformFilter === "all" || post.platform === platformFilter;
      return matchesSearch && matchesPlatform;
    });
  }, [searchQuery, platformFilter]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const startItem = (page - 1) * rowsPerPage + 1;
  const endItem = Math.min(page * rowsPerPage, filtered.length);

  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        searchPlaceholder="Search posts or accounts..."
        showPlatformFilter
        platformValue={platformFilter}
        onPlatformChange={(v) => { setPlatformFilter(v); setPage(1); }}
        showDateRange
        dateRangeValue={dateRange}
        onDateRangeChange={setDateRange}
        rightContent={
          <Button
            size="sm"
            variant="flat"
            className="bg-surface-elevated border border-border-base text-text-secondary h-9"
            startContent={<Icon icon="solar:export-bold" width={14} />}
          >
            Export CSV
          </Button>
        }
      />

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
          {paginated.map((post) => {
            const { date, time } = formatDateTime(post.publishedDate);

            return (
              <TableRow
                key={post.id}
                className="hover:bg-surface-elevated/50 transition-colors"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative w-[72px] h-[48px] rounded-md overflow-hidden bg-surface-elevated flex-shrink-0">
                      <Avatar
                        src={post.thumbnailUrl}
                        radius="sm"
                        classNames={{
                          base: "w-full h-full",
                          img: "object-cover",
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate max-w-[320px]">
                        {post.title}
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
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={post.accountAvatarUrl}
                      name={post.accountName.charAt(0)}
                      size="sm"
                      classNames={{
                        base: "w-7 h-7 bg-surface-elevated flex-shrink-0",
                      }}
                    />
                    <span className="text-sm text-text-primary">
                      {post.accountName}
                    </span>
                  </div>
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
                    <span className="text-xs capitalize">{post.platform}</span>
                  </Chip>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm text-text-primary">{date}</p>
                    <p className="text-xs text-text-tertiary">{time}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="flat"
                    isIconOnly
                    className="bg-transparent hover:bg-surface-elevated"
                    onPress={() => window.open(post.postUrl, "_blank")}
                  >
                    <Icon
                      icon="solar:square-arrow-right-up-linear"
                      width={16}
                      className="text-text-secondary"
                    />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing <span className="font-medium text-text-secondary">{startItem}-{endItem}</span> of{" "}
          <span className="font-medium text-text-secondary">{filtered.length}</span> posts
        </p>
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
  );
}
